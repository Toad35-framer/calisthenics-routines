"use strict";
/* Données : bibliothèque (fichiers), routines, mouvements perso, journal, préférences.
   Enregistrement local immédiat, puis synchronisation avec le compte quand la page le permet. */
window.CAL = window.CAL || {};
(function (C) {
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem("cal:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("cal:" + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  C.LS = LS;

  var S = C.state = {
    base: {}, baseRoutines: [], source: "", loaded: false,
    routines: LS.get("routines", null),
    mouvements: LS.get("mouvements", {}),       /* perso et versions modifiées, par id */
    journal: LS.get("journal", []),
    prefs: Object.assign({ son: true, voix: false, vibration: true, objectif: 5 }, LS.get("prefs", {})),
    sync: "local"                                /* local | connexion | compte */
  };

  /* ---------- événements ---------- */
  var listeners = [];
  C.on = function (fn) { listeners.push(fn); };
  function emit(kind) { listeners.forEach(function (fn) { try { fn(kind); } catch (e) { console.error(e); } }); }
  C.emit = emit;

  /* ---------- bibliothèque ---------- */
  C.mv = function (id) { return S.mouvements[id] || S.base[id] || null; };
  C.allMv = function () {
    var ids = {}; Object.keys(S.base).forEach(function (k) { ids[k] = 1; }); Object.keys(S.mouvements).forEach(function (k) { ids[k] = 1; });
    return Object.keys(ids).map(C.mv).filter(Boolean);
  };
  C.origin = function (id) { var m = S.mouvements[id]; return m ? (S.base[id] ? "modifie" : "perso") : (S.base[id] ? "base" : "absent"); };

  C.loadLibrary = function () {
    function viaFiles() {
      return fetch("bibliotheque/index.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("index"); return r.json(); }).then(function (idx) {
        return Promise.all(idx.mouvements.map(function (f) {
          return fetch("bibliotheque/" + f, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(f); return r.json(); });
        })).then(function (list) {
          return fetch("routines/routines-de-base.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : { routines: [] }; }).then(function (rt) {
            return { mouvements: list, routines: rt.routines || [], source: "fichiers" };
          });
        });
      });
    }
    function viaBundle() {
      var b = window.BIBLIO_BUNDLE;
      if (!b) throw new Error("bundle");
      return { mouvements: b.mouvements, routines: b.routines.routines, source: "copie intégrée" };
    }
    return viaFiles().catch(viaBundle).then(function (res) {
      S.base = {}; res.mouvements.forEach(function (m) { S.base[m.id] = m; });
      S.baseRoutines = res.routines; S.source = res.source; S.loaded = true;
      if (S.routines == null) { S.routines = clone(S.baseRoutines).map(stamp); LS.set("routines", S.routines); }
    });
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  C.clone = clone;
  function stamp(r, i) { r.cree = r.cree || Date.now() + (i || 0); r.maj = r.maj || r.cree; return r; }

  /* ---------- synchronisation compte ---------- */
  var db = null, assets = null, downloads = null;
  var queue = {};   /* chemin -> {timer, busy, next} */

  function useCap(name) {
    try { return (window.claude && window.claude.use) ? Promise.resolve(window.claude.use(name)).catch(function () { return null; }) : Promise.resolve(null); }
    catch (e) { return Promise.resolve(null); }
  }

  function write(path, body) {
    if (!db) return;
    var q = queue[path] || (queue[path] = { timer: null, busy: false, next: undefined });
    q.next = body;
    clearTimeout(q.timer);
    q.timer = setTimeout(function () { flush(path); }, 500);
  }
  function flush(path) {
    var q = queue[path]; if (!q || q.busy || q.next === undefined) return;
    var body = q.next; q.next = undefined; q.busy = true;
    var ref = db.doc(path);
    var op = body === null ? ref.delete() : ref.set(body);
    op.catch(function (e) {
      if (e && e.code === "unavailable") return new Promise(function (r) { setTimeout(r, 800 + Math.random() * 800); }).then(function () { return body === null ? ref.delete() : ref.set(body); });
      throw e;
    }).catch(function (e) {
      console.warn("sync", path, e);
      emit({ type: "erreur", message: e && e.code === "quota_exceeded" ? "Espace du compte plein : supprime d'anciennes photos ou routines." : "Synchronisation impossible pour l'instant. C'est enregistré sur cet appareil." });
    }).then(function () { q.busy = false; if (q.next !== undefined) flush(path); });
  }

  function monthKey(t) { var d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
  function pushJournalMonth(key) {
    var ent = S.journal.filter(function (e) { return monthKey(e.t) === key; });
    write("journal/" + key, ent.length ? { mois: key, entrees: ent } : null);
  }

  function migrateIfNeeded(kind, remoteEmpty) {
    if (!remoteEmpty || LS.get("sync-" + kind, false)) return false;
    LS.set("sync-" + kind, true);
    if (kind === "routines") (S.routines || []).forEach(function (r) { write("routines/" + r.id, r); });
    if (kind === "mouvements") Object.keys(S.mouvements).forEach(function (k) { write("mouvements/" + k, S.mouvements[k]); });
    if (kind === "journal") { var ks = {}; S.journal.forEach(function (e) { ks[monthKey(e.t)] = 1; }); Object.keys(ks).forEach(pushJournalMonth); }
    if (kind === "prefs") write("config/prefs", S.prefs);
    return true;
  }

  function subscribe(coll, kind, apply) {
    var timer = setTimeout(function () { if (S.sync === "connexion") { S.sync = "lent"; emit("sync"); } }, 10000);
    db.collection(coll).onSnapshot(function (snap) {
      if (snap.metadata.hasPendingWrites) return;
      if (snap.metadata.fromCache && snap.empty) return;
      if (!snap.metadata.fromCache) { clearTimeout(timer); if (S.sync !== "compte") { S.sync = "compte"; emit("sync"); } }
      if (snap.empty && migrateIfNeeded(kind, true)) return;
      LS.set("sync-" + kind, true);
      apply(snap.docs.map(function (d) { return d.data(); }));
      emit(kind);
    }, function (e) {
      clearTimeout(timer); console.warn("abonnement", coll, e);
      S.sync = "local"; emit("sync");
    });
  }

  C.connect = function () {
    useCap("assets").then(function (a) { assets = a; });
    useCap("downloads").then(function (d) { downloads = d; emit("caps"); });
    return useCap("db").then(function (d) {
      if (!d) return;
      db = d; S.sync = "connexion"; emit("sync");
      subscribe("routines", "routines", function (list) {
        S.routines = list.map(clone).sort(function (a, b) { return (a.cree || 0) - (b.cree || 0); });
        LS.set("routines", S.routines);
      });
      subscribe("mouvements", "mouvements", function (list) {
        S.mouvements = {}; list.forEach(function (m) { S.mouvements[m.id] = clone(m); });
        LS.set("mouvements", S.mouvements);
      });
      subscribe("journal", "journal", function (list) {
        var all = []; list.forEach(function (doc) { (doc.entrees || []).forEach(function (e) { all.push(e); }); });
        S.journal = all.sort(function (a, b) { return a.t - b.t; });
        LS.set("journal", S.journal);
      });
      subscribe("config", "prefs", function (list) {
        var p = list.filter(function (x) { return x && x.objectif != null; })[0];
        if (p) { S.prefs = Object.assign(S.prefs, p); LS.set("prefs", S.prefs); }
      });
    });
  };
  C.hasDownloads = function () { return !!downloads; };
  C.download = function (filename, text) { return downloads ? downloads.save({ filename: filename, data: text }) : Promise.reject(new Error("indisponible")); };

  /* ---------- écritures ---------- */
  C.saveRoutine = function (r) {
    r.maj = Date.now(); r.cree = r.cree || r.maj;
    var i = S.routines.findIndex(function (x) { return x.id === r.id; });
    if (i < 0) S.routines.push(r); else S.routines[i] = r;
    LS.set("routines", S.routines); write("routines/" + r.id, clone(r));
  };
  C.deleteRoutine = function (id) {
    S.routines = S.routines.filter(function (x) { return x.id !== id; });
    LS.set("routines", S.routines); write("routines/" + id, null);
  };
  C.saveMv = function (m) {
    m.maj = Date.now(); S.mouvements[m.id] = m;
    LS.set("mouvements", S.mouvements); write("mouvements/" + m.id, clone(m));
  };
  C.deleteMv = function (id) {
    delete S.mouvements[id];
    LS.set("mouvements", S.mouvements); write("mouvements/" + id, null);
  };
  C.addJournal = function (e) {
    S.journal.push(e); LS.set("journal", S.journal); pushJournalMonth(monthKey(e.t));
  };
  C.deleteJournal = function (t) {
    S.journal = S.journal.filter(function (e) { return e.t !== t; });
    LS.set("journal", S.journal); pushJournalMonth(monthKey(t));
  };
  C.savePrefs = function () { LS.set("prefs", S.prefs); write("config/prefs", clone(S.prefs)); };
  C.importAll = function (data) {
    (data.routines || []).forEach(function (r) { C.saveRoutine(r); });
    Object.keys(data.mouvements || {}).forEach(function (k) { C.saveMv(data.mouvements[k]); });
    var known = {}; S.journal.forEach(function (e) { known[e.t] = 1; });
    var months = {};
    (data.journal || []).forEach(function (e) { if (!known[e.t]) { S.journal.push(e); months[monthKey(e.t)] = 1; } });
    S.journal.sort(function (a, b) { return a.t - b.t; }); LS.set("journal", S.journal);
    Object.keys(months).forEach(pushJournalMonth);
  };

  /* ---------- médias : compte (assets) ou appareil (IndexedDB) ---------- */
  var idbP = null, mem = {}, urls = {};
  function idb() {
    if (idbP) return idbP;
    idbP = new Promise(function (res) {
      try {
        var r = indexedDB.open("calisthenics", 1);
        r.onupgradeneeded = function () { r.result.createObjectStore("medias"); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return idbP;
  }
  C.media = {
    where: function () { return assets ? "compte" : "appareil"; },
    put: function (blob) {
      if (assets) return assets.upload(blob).then(function (r) { urls["a:" + r.id] = r.url; return "a:" + r.id; }).catch(function () { return localPut(blob); });
      return localPut(blob);
    },
    url: function (ref) {
      if (urls[ref]) return Promise.resolve(urls[ref]);
      if (ref.indexOf("a:") === 0) { urls[ref] = "/_blob/" + ref.slice(2); return Promise.resolve(urls[ref]); }
      var id = ref.slice(2);
      if (mem[id]) { urls[ref] = URL.createObjectURL(mem[id]); return Promise.resolve(urls[ref]); }
      return idb().then(function (d) {
        if (!d) return null;
        return new Promise(function (res) {
          try {
            var q = d.transaction("medias").objectStore("medias").get(id);
            q.onsuccess = function () { if (!q.result) return res(null); urls[ref] = URL.createObjectURL(q.result); res(urls[ref]); };
            q.onerror = function () { res(null); };
          } catch (e) { res(null); }
        });
      });
    },
    remove: function (ref) {
      if (urls[ref] && ref.indexOf("l:") === 0) URL.revokeObjectURL(urls[ref]);
      delete urls[ref];
      if (ref.indexOf("a:") === 0) { if (assets) assets.delete(ref.slice(2)).catch(function () {}); return; }
      var id = ref.slice(2); delete mem[id];
      idb().then(function (d) { if (d) try { d.transaction("medias", "readwrite").objectStore("medias").delete(id); } catch (e) {} });
    }
  };
  function localPut(blob) {
    var id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    return idb().then(function (d) {
      if (!d) { mem[id] = blob; return "l:" + id; }
      return new Promise(function (res) {
        try {
          var t = d.transaction("medias", "readwrite"); t.objectStore("medias").put(blob, id);
          t.oncomplete = function () { res("l:" + id); };
          t.onerror = t.onabort = function () { mem[id] = blob; res("l:" + id); };
        } catch (e) { mem[id] = blob; res("l:" + id); }
      });
    });
  }

  /* ---------- déroulé d'une routine ---------- */
  C.steps = function (r) {
    var out = [];
    function add(it, tag) {
      var m = C.mv(it.mv);
      var base = {
        id: it.mv, cat: m ? m.categorie : "repos", dur: Math.max(1, Math.round(it.dur) || 1), tag: tag,
        title: m ? m.nom : "Mouvement introuvable",
        cue: m ? (m.consigne || m.description || "") : "Ce mouvement a été supprimé de la bibliothèque.",
        vig: m ? (m.vigilance || "") : "", side: ""
      };
      if (m && m.cotes && it.cotes !== false) {
        out.push(Object.assign({}, base, { side: "gauche" }));
        out.push(Object.assign({}, base, { side: "droite" }));
      } else out.push(base);
    }
    add({ mv: "depart", dur: r.depart }, "");
    (r.items || []).forEach(function (it) {
      if (it.bloc) {
        var n = Math.max(1, it.rounds | 0);
        for (var k = 0; k < n; k++) {
          it.items.forEach(function (c, j) {
            if (n > 1 && k === n - 1 && j === it.items.length - 1 && c.mv === "repos") return;
            add(c, "Tour " + (k + 1) + "/" + n);
          });
        }
      } else add(it, "");
    });
    add({ mv: "fin", dur: r.fin }, "");
    return out;
  };
  C.total = function (r) { return C.steps(r).reduce(function (a, s) { return a + s.dur; }, 0); };
  C.countEx = function (r) { return C.steps(r).filter(function (s) { return s.cat !== "repos" && s.cat !== "special"; }).length; };
  C.fmt = function (sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); };
  C.monthKey = monthKey;

  if (typeof module !== "undefined") module.exports = C;
})(window.CAL);
