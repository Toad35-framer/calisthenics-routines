"use strict";
/* Interface : routines, éditeur, bibliothèque, fiche, module mouvement, journal, réglages. */
(function (C) {
  var S = C.state;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var CATS = { echauffement: "Échauffement", force: "Force", flow: "Flow", etirement: "Étirement", repos: "Repos", special: "Départ / fin" };
  var CAT_ORDER = ["echauffement", "force", "flow", "etirement", "repos", "special"];
  var ZONES = ["tronc", "dos", "épaules", "pectoraux", "bras", "poignets", "hanches", "fessiers", "cuisses", "ischios"];
  var NIVEAUX = { debutant: "Débutant", intermediaire: "Intermédiaire", avance: "Avancé" };
  var MATERIEL = { tapis: "Tapis", elastique: "Élastique", meuble: "Meuble stable" };
  var DAYS = [[1, "L"], [2, "Ma"], [3, "Me"], [4, "J"], [5, "V"], [6, "S"], [0, "D"]];
  var DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var uid = function (p) { return p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); };
  var ytSearch = function (q) { return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q).replace(/%20/g, "+"); };
  C.esc = esc; C.CATS = CATS;

  Figure.resolve = C.mv;
  Figure.mediaUrl = function (ref) { return C.media.url(ref); };

  /* ---------- petits composants ---------- */
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.tm); toast.tm = setTimeout(function () { t.hidden = true; }, 2600);
  }
  C.toast = toast;
  /* Boîte de dialogue : renvoie la valeur du bouton choisi (ou null). */
  function dialog(o) {
    return new Promise(function (res) {
      var d = $("#dlg");
      d.innerHTML = '<div class="dlg-card" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h2 id="dlg-t">' + esc(o.title) + "</h2>" +
        (o.text ? "<p>" + esc(o.text) + "</p>" : "") + (o.html || "") +
        '<div class="dlg-btns">' + (o.buttons || [{ label: "OK", value: true, primary: true }]).map(function (b, i) {
          return '<button type="button" class="btn ' + (b.primary ? "primary" : "") + (b.danger ? " danger" : "") + '" data-i="' + i + '">' + esc(b.label) + "</button>";
        }).join("") + "</div></div>";
      d.hidden = false;
      var btns = o.buttons || [{ label: "OK", value: true }];
      function close(v) { d.hidden = true; d.innerHTML = ""; d.onclick = null; document.removeEventListener("keydown", key); res(v); }
      function key(e) { if (e.key === "Escape") close(null); }
      document.addEventListener("keydown", key);
      d.onclick = function (e) {
        var b = e.target.closest("[data-i]");
        if (b) close(btns[+b.dataset.i].value);
        else if (e.target === d) close(null);
      };
      var f = d.querySelector(".btn.primary") || d.querySelector(".btn"); if (f) f.focus();
    });
  }
  C.dialog = dialog;

  function durInputs(key, sec, label) {
    sec = Math.max(0, Math.round(sec) || 0);
    return '<div class="dur" role="group" aria-label="' + esc(label || "Durée") + '">' +
      '<input type="number" inputmode="numeric" min="0" max="59" data-dur="' + key + '" data-part="m" value="' + Math.floor(sec / 60) + '" aria-label="Minutes"><span>min</span>' +
      '<input type="number" inputmode="numeric" min="0" max="59" data-dur="' + key + '" data-part="s" value="' + (sec % 60) + '" aria-label="Secondes"><span>s</span></div>';
  }
  function readDur(key) {
    var m = +($('[data-dur="' + key + '"][data-part="m"]') || {}).value || 0;
    var s = +($('[data-dur="' + key + '"][data-part="s"]') || {}).value || 0;
    return Math.max(0, Math.round(m) * 60 + Math.round(s));
  }
  function fig(id, anim, cls) { return '<div class="fig ' + (cls || "") + '" data-fig="' + esc(id) + '"' + (anim ? ' data-anim="1"' : "") + "></div>"; }
  function mountFigs(root) {
    root.querySelectorAll("[data-fig]").forEach(function (el) {
      var m = el.dataset.draft ? nav.params.preview : C.mv(el.dataset.fig);
      Figure.mount(el, m, { animate: el.dataset.anim === "1" });
    });
  }
  function catPill(cat) { return '<span class="pill cat-' + cat + '">' + esc(CATS[cat] || cat) + "</span>"; }
  function daysLabel(j) { return DAYS.filter(function (d) { return (j || []).indexOf(d[0]) >= 0; }).map(function (d) { return d[1]; }).join(" "); }
  function mvOptions(sel, excludeSpecial) {
    return CAT_ORDER.filter(function (c) { return !(excludeSpecial && c === "special"); }).map(function (c) {
      var list = C.allMv().filter(function (m) { return m.categorie === c; }).sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); });
      if (!list.length) return "";
      return '<optgroup label="' + esc(CATS[c]) + '">' + list.map(function (m) {
        return '<option value="' + esc(m.id) + '"' + (m.id === sel ? " selected" : "") + ">" + esc(m.nom) + (C.origin(m.id) === "perso" ? " (perso)" : "") + "</option>";
      }).join("") + "</optgroup>";
    }).join("");
  }

  /* ---------- navigation ---------- */
  var nav = { view: "routines", params: {} }, stack = [];
  function go(view, params) { stack.push(nav); nav = { view: view, params: params || {} }; render(); window.scrollTo(0, 0); }
  function back() { nav = stack.pop() || { view: "routines", params: {} }; render(); }
  function tab(view) { stack = []; nav = { view: view, params: {} }; render(); window.scrollTo(0, 0); }
  C.go = go; C.back = back;

  var VIEWS = {};
  function render() {
    var v = VIEWS[nav.view] || VIEWS.routines;
    var html = v(nav.params);
    if (html == null) return;
    $("#view").innerHTML = html;
    mountFigs($("#view"));
    var main = { routines: 1, biblio: 1, journal: 1, reglages: 1, fiche: 1 }[nav.view];
    document.body.classList.toggle("has-tabs", !!main);
    document.body.classList.toggle("has-launch", nav.view === "editeur");
    document.querySelectorAll("#tabs [data-tab]").forEach(function (b) {
      var on = b.dataset.tab === nav.view || (b.dataset.tab === "biblio" && (nav.view === "fiche" || nav.view === "mvedit") && !stack.some(function (s) { return s.view === "editeur"; }));
      b.classList.toggle("on", on); b.setAttribute("aria-current", on ? "page" : "false");
    });
    if (v.after) v.after(nav.params);
  }
  C.render = render;

  /* ---------- statistiques ---------- */
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function weekStart(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function doneDays() { var s = {}; S.journal.forEach(function (e) { if (e.ok) s[dayKey(e.t)] = 1; }); return s; }
  function weekCount() {
    var ws = weekStart(new Date()).getTime(), seen = {};
    S.journal.forEach(function (e) { if (e.ok && e.t >= ws) seen[dayKey(e.t)] = 1; });
    return Object.keys(seen).length;
  }
  function streak() {
    var done = doneDays(), d = new Date(), n = 0;
    d.setHours(12, 0, 0, 0);
    if (!done[dayKey(d)]) d.setDate(d.getDate() - 1);
    for (var guard = 0; guard < 400; guard++) {
      var wd = d.getDay();
      if (wd === 0 || wd === 6) { if (done[dayKey(d)]) n++; d.setDate(d.getDate() - 1); continue; }
      if (!done[dayKey(d)]) break;
      n++; d.setDate(d.getDate() - 1);
    }
    return n;
  }

  /* =========================================================
     ROUTINES (accueil)
     ========================================================= */
  function firstEx(r) { var s = C.steps(r).filter(function (x) { return x.cat !== "special" && x.cat !== "repos"; })[0]; return s ? s.id : "depart"; }
  function routineMeta(r) {
    var d = daysLabel(r.jours);
    return C.fmt(C.total(r)) + " · " + C.countEx(r) + " exercices" + (d ? " · " + d : "");
  }
  VIEWS.routines = function () {
    if (!S.loaded) return '<p class="empty">Chargement de la bibliothèque…</p>';
    var today = new Date().getDay();
    var rs = S.routines || [];
    var todays = rs.filter(function (r) { return (r.jours || []).indexOf(today) >= 0; });
    var favs = rs.filter(function (r) { return r.fav; });
    var others = rs.filter(function (r) { return !r.fav; });
    var wk = weekCount(), obj = S.prefs.objectif;
    var html = '<header class="top"><div><p class="eyebrow">' + esc(cap(DAY_NAMES[today])) + " · " + wk + "/" + obj + ' séances cette semaine</p><h1>Routines</h1></div>' +
      '<button type="button" class="btn primary" data-act="new-routine">+ Nouvelle</button></header>';
    if (todays.length) {
      html += '<section class="today"><h2 class="sec">Aujourd\'hui</h2>' + todays.map(function (r) {
        return '<div class="today-row"><div><strong>' + esc(r.nom) + '</strong><span class="meta">' + C.fmt(C.total(r)) + '</span></div><button type="button" class="btn primary" data-act="launch" data-id="' + esc(r.id) + '">Lancer</button></div>';
      }).join("") + "</section>";
    }
    html += '<section><h2 class="sec">Favorites</h2>';
    html += favs.length ? '<div class="cards">' + favs.map(function (r) {
      return '<article class="rcard">' + fig(firstEx(r), true, "rcard-fig") +
        '<div class="rcard-body"><h3>' + esc(r.nom) + '</h3><p class="meta">' + esc(routineMeta(r)) + "</p></div>" +
        '<button type="button" class="star on" data-act="fav" data-id="' + esc(r.id) + '" aria-label="Retirer des favorites" aria-pressed="true">★</button>' +
        '<div class="rcard-actions"><button type="button" class="btn" data-act="edit-routine" data-id="' + esc(r.id) + '">Modifier</button>' +
        '<button type="button" class="btn primary" data-act="launch" data-id="' + esc(r.id) + '">Lancer</button></div></article>';
    }).join("") + "</div>" : '<p class="empty">Touche l\'étoile d\'une routine pour l\'épingler ici.</p>';
    html += '</section><section><h2 class="sec">Autres routines</h2>';
    html += others.length ? '<ul class="rows">' + others.map(function (r) {
      return '<li class="row"><button type="button" class="row-main" data-act="edit-routine" data-id="' + esc(r.id) + '"><strong>' + esc(r.nom) + '</strong><span class="meta">' + esc(routineMeta(r)) + "</span></button>" +
        '<button type="button" class="star" data-act="fav" data-id="' + esc(r.id) + '" aria-label="Ajouter aux favorites" aria-pressed="false">☆</button>' +
        '<button type="button" class="btn primary sm" data-act="launch" data-id="' + esc(r.id) + '">Lancer</button></li>';
    }).join("") + "</ul>" : '<p class="empty">' + (rs.length ? "Toutes tes routines sont en favorites." : 'Aucune routine. Crée-en une avec « + Nouvelle », ou réinstalle les routines de base dans Réglages.') + "</p>";
    return html + "</section>";
  };

  function routineById(id) { return (S.routines || []).filter(function (r) { return r.id === id; })[0]; }

  /* =========================================================
     ÉDITEUR DE ROUTINE
     ========================================================= */
  function getAt(r, path) {
    var p = String(path).split(".").map(Number);
    if (p.length === 1) return { arr: r.items, i: p[0], item: r.items[p[0]] };
    var bloc = r.items[p[0]];
    return { arr: bloc.items, i: p[1], item: bloc.items[p[1]], bloc: bloc };
  }
  function itemRow(it, path) {
    if (it.bloc) {
      var inner = { depart: 1, fin: 1, items: [it] }, blocDur = C.total({ depart: 0, fin: 0, items: [it] }) - 2;
      void inner;
      return '<li class="bloc" data-path="' + path + '"><div class="bloc-head"><strong>Bloc répété</strong>' +
        '<div class="stepper sm"><button type="button" data-act="rounds" data-d="-1" data-path="' + path + '" aria-label="Un tour de moins">−</button><span>× ' + it.rounds + " tour" + (it.rounds > 1 ? "s" : "") + '</span><button type="button" data-act="rounds" data-d="1" data-path="' + path + '" aria-label="Un tour de plus">+</button></div></div>' +
        (it.items.length ? '<ol class="items">' + it.items.map(function (c, j) { return itemRow(c, path + "." + j); }).join("") + "</ol>"
          : '<p class="empty">Bloc vide. Plus bas, choisis « Dans : Bloc » pour y ajouter des exercices.</p>') +
        '<p class="hint">Durée du bloc : ' + C.fmt(Math.max(0, blocDur)) + (it.rounds > 1 ? ". Le repos à la fin du dernier tour est sauté." : "") + "</p>" +
        tools(path, null) + "</li>";
    }
    var m = C.mv(it.mv), cat = m ? m.categorie : "repos";
    var sides = m && m.cotes;
    return '<li class="item cat-' + cat + '" data-path="' + path + '"><div class="item-main">' + fig(it.mv, false, "thumb") +
      '<div class="item-txt"><strong>' + esc(m ? m.nom : "Mouvement introuvable") + '</strong><span class="meta">' + esc(CATS[cat] || "") +
      (sides ? (it.cotes !== false ? " · gauche puis droite" : " · un seul côté") : "") + "</span></div>" +
      durInputs(path, it.dur, sides && it.cotes !== false ? "Durée par côté" : "Durée") + "</div>" + tools(path, sides ? it : null) + "</li>";
  }
  function tools(path, sidesItem) {
    return '<div class="item-tools">' +
      '<button type="button" class="tool" data-act="move" data-d="-1" data-path="' + path + '" aria-label="Monter">↑</button>' +
      '<button type="button" class="tool" data-act="move" data-d="1" data-path="' + path + '" aria-label="Descendre">↓</button>' +
      (sidesItem ? '<button type="button" class="tool chip ' + (sidesItem.cotes !== false ? "on" : "") + '" data-act="sides" data-path="' + path + '" aria-pressed="' + (sidesItem.cotes !== false) + '">G + D</button>' : "") +
      '<button type="button" class="tool" data-act="dup" data-path="' + path + '">Dupliquer</button>' +
      '<button type="button" class="tool danger" data-act="del" data-path="' + path + '">Retirer</button></div>';
  }
  VIEWS.editeur = function (p) {
    var r = routineById(p.id);
    if (!r) { setTimeout(back, 0); return ""; }
    if (!p.addMv || !C.mv(p.addMv)) p.addMv = "pompes";
    var am = C.mv(p.addMv);
    if (p.addDur == null) p.addDur = am ? am.duree : 30;
    var blocs = []; r.items.forEach(function (it, i) { if (it.bloc) blocs.push(i); });
    if (p.target !== "root" && blocs.indexOf(+p.target) < 0) p.target = "root";
    var total = C.total(r);
    return '<header class="top"><button type="button" class="btn ghost" data-act="back">← Retour</button>' +
      '<span class="saved" id="saved" aria-live="polite">Enregistré</span>' +
      '<button type="button" class="btn ghost" data-act="routine-menu" data-id="' + esc(r.id) + '">Options</button></header>' +
      '<label class="sr" for="r-name">Nom de la routine</label><input id="r-name" class="title-input" data-bind="r-name" value="' + esc(r.nom) + '" placeholder="Nom de la routine">' +
      '<div class="r-opts"><button type="button" class="star ' + (r.fav ? "on" : "") + '" data-act="fav" data-id="' + esc(r.id) + '" aria-pressed="' + !!r.fav + '">' + (r.fav ? "★ Favorite" : "☆ Favorite") + "</button>" +
      '<div class="days" role="group" aria-label="Jours prévus">' + DAYS.map(function (d) {
        var on = (r.jours || []).indexOf(d[0]) >= 0;
        return '<button type="button" class="chip ' + (on ? "on" : "") + '" data-act="day" data-d="' + d[0] + '" aria-pressed="' + on + '">' + d[1] + "</button>";
      }).join("") + "</div></div>" +
      '<ol class="items main-list">' +
      '<li class="item fixed cat-special"><div class="item-main">' + fig("depart", false, "thumb") + '<div class="item-txt"><strong>Départ</strong><span class="meta">Compte à rebours</span></div>' + durInputs("depart", r.depart) + "</div></li>" +
      r.items.map(function (it, i) { return itemRow(it, String(i)); }).join("") +
      '<li class="item fixed cat-special"><div class="item-main">' + fig("fin", false, "thumb") + '<div class="item-txt"><strong>Fin</strong><span class="meta">Écran de fin</span></div>' + durInputs("fin", r.fin) + "</div></li></ol>" +
      '<section class="addcard" aria-labelledby="add-h"><h2 class="sec" id="add-h">Ajouter un exercice</h2>' +
      '<label for="add-mv">Exercice de la bibliothèque</label>' +
      '<div class="addrow"><select id="add-mv" data-bind="add-mv">' + mvOptions(p.addMv, true) + "</select>" +
      '<button type="button" class="btn icon" data-act="new-mv" aria-label="Créer un nouveau mouvement" title="Créer un mouvement">+</button></div>' +
      '<div class="addrow2"><div><span class="lbl">Durée' + (am && am.cotes ? " par côté" : "") + "</span>" + durInputs("add", p.addDur) + "</div>" +
      (blocs.length ? '<div><label class="lbl" for="add-target">Dans</label><select id="add-target" data-bind="add-target"><option value="root">La routine</option>' +
        blocs.map(function (i, k) { return '<option value="' + i + '"' + (String(p.target) === String(i) ? " selected" : "") + ">Bloc " + (k + 1) + " (× " + r.items[i].rounds + ")</option>"; }).join("") + "</select></div>" : "") +
      "</div>" +
      '<button type="button" class="btn primary wide" data-act="add">Ajouter</button>' +
      '<div class="quick"><button type="button" class="btn" data-act="add-rest">+ Repos</button><button type="button" class="btn" data-act="add-bloc">+ Bloc répété</button></div></section>' +
      '<div class="launchbar"><div><span class="eyebrow">Durée totale</span><strong class="tot">' + C.fmt(total) + '</strong><span class="meta">' + C.countEx(r) + " exercices</span></div>" +
      '<button type="button" class="btn primary big" data-act="launch" data-id="' + esc(r.id) + '">Lancer</button></div>';
  };
  function saveCur(r, rerender) {
    C.saveRoutine(r);
    var s = $("#saved"); if (s) { s.classList.remove("flash"); void s.offsetWidth; s.classList.add("flash"); }
    if (rerender !== false) render();
  }

  /* =========================================================
     BIBLIOTHÈQUE
     ========================================================= */
  VIEWS.biblio = function (p) {
    p.cat = p.cat || "tous";
    return '<header class="top"><div><p class="eyebrow">' + C.allMv().length + ' mouvements</p><h1>Bibliothèque</h1></div><button type="button" class="btn primary" data-act="new-mv">+ Mouvement</button></header>' +
      '<label class="sr" for="bq">Rechercher</label><input id="bq" class="search" type="search" placeholder="Rechercher un mouvement" data-bind="bq" value="' + esc(p.q || "") + '">' +
      '<div class="chips" role="group" aria-label="Catégorie">' + ["tous"].concat(CAT_ORDER).map(function (c) {
        return '<button type="button" class="chip ' + (p.cat === c ? "on" : "") + '" data-act="bcat" data-c="' + c + '" aria-pressed="' + (p.cat === c) + '">' + (c === "tous" ? "Tous" : esc(CATS[c])) + "</button>";
      }).join("") + "</div>" +
      '<div class="chips" role="group" aria-label="Filtres"><button type="button" class="chip ' + (p.dos ? "on" : "") + '" data-act="bdos" aria-pressed="' + !!p.dos + '">Compatible dos</button>' +
      '<label class="sr" for="bz">Zone travaillée</label><select id="bz" class="chip-select" data-bind="bz"><option value="">Toutes les zones</option>' + ZONES.map(function (z) { return '<option value="' + z + '"' + (p.zone === z ? " selected" : "") + ">" + cap(z) + "</option>"; }).join("") + "</select></div>" +
      '<div class="grid" id="grid"></div>';
  };
  VIEWS.biblio.after = function (p) { fillGrid(p); };
  function fillGrid(p) {
    var q = (p.q || "").trim().toLowerCase();
    var list = C.allMv().filter(function (m) {
      if (p.cat !== "tous" && m.categorie !== p.cat) return false;
      if (p.dos && !m.dos) return false;
      if (p.zone && (m.zones || []).indexOf(p.zone) < 0) return false;
      if (q && (m.nom + " " + (m.description || "") + " " + (m.zones || []).join(" ")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return CAT_ORDER.indexOf(a.categorie) - CAT_ORDER.indexOf(b.categorie) || a.nom.localeCompare(b.nom, "fr"); });
    var g = $("#grid");
    g.innerHTML = list.length ? list.map(function (m) {
      var o = C.origin(m.id);
      return '<button type="button" class="mvcard cat-' + m.categorie + '" data-act="fiche" data-id="' + esc(m.id) + '">' + fig(m.id, true, "mvfig") +
        '<span class="mv-name">' + esc(m.nom) + "</span>" +
        '<span class="meta">' + esc(CATS[m.categorie]) + " · " + C.fmt(m.duree) + (m.cotes ? " × 2" : "") + "</span>" +
        (o === "perso" ? '<span class="badge">Perso</span>' : o === "modifie" ? '<span class="badge">Modifié</span>' : "") + "</button>";
    }).join("") : '<p class="empty">Aucun mouvement ne correspond. Essaie un autre filtre, ou crée-le avec « + Mouvement ».</p>';
    mountFigs(g);
  }

  /* =========================================================
     FICHE D'UN MOUVEMENT
     ========================================================= */
  VIEWS.fiche = function (p) {
    var m = C.mv(p.id);
    if (!m) { setTimeout(back, 0); return ""; }
    var o = C.origin(m.id);
    var yt = m.youtube || ytSearch(m.nom + " exercice tutoriel");
    var variante = function (k, label) {
      var v = m.variantes && m.variantes[k] && C.mv(m.variantes[k]);
      return v ? '<button type="button" class="btn" data-act="fiche" data-id="' + esc(v.id) + '">' + label + " : " + esc(v.nom) + "</button>" : "";
    };
    var vars = variante("facile", "Plus facile") + variante("difficile", "Plus difficile");
    return '<header class="top"><button type="button" class="btn ghost" data-act="back">← Retour</button></header>' +
      '<div class="fiche-fig cat-' + m.categorie + '">' + fig(m.id, true, "big") + "</div>" +
      '<h1 class="fiche-title">' + esc(m.nom) + "</h1>" +
      '<div class="pills">' + catPill(m.categorie) + '<span class="pill soft">' + esc(NIVEAUX[m.niveau] || "Débutant") + "</span>" +
      (m.dos ? '<span class="pill ok">Compatible dos</span>' : "") + (o === "perso" ? '<span class="pill soft">Perso</span>' : o === "modifie" ? '<span class="pill soft">Modifié</span>' : "") + "</div>" +
      (m.description ? '<p class="lead">' + esc(m.description) + "</p>" : "") +
      (m.consigne ? '<h2 class="sec">Consigne</h2><p>' + esc(m.consigne) + "</p>" : "") +
      (m.vigilance ? '<div class="vig"><strong>Vigilance</strong><p>' + esc(m.vigilance) + "</p></div>" : "") +
      '<dl class="facts"><div><dt>Durée par défaut</dt><dd>' + C.fmt(m.duree) + (m.cotes ? " par côté" : "") + "</dd></div>" +
      "<div><dt>Côtés</dt><dd>" + (m.cotes ? "Gauche puis droite" : "Non") + "</dd></div>" +
      "<div><dt>Zones</dt><dd>" + esc((m.zones || []).map(cap).join(", ") || "—") + "</dd></div>" +
      "<div><dt>Matériel</dt><dd>" + esc((m.materiel || []).map(function (x) { return MATERIEL[x] || x; }).join(", ") || "Aucun") + "</dd></div></dl>" +
      (vars ? '<h2 class="sec">Variantes</h2><div class="btnrow">' + vars + "</div>" : "") +
      (m.categorie !== "special" ? '<a class="btn wide yt" href="' + esc(yt) + '" target="_blank" rel="noopener">Voir des démonstrations sur YouTube</a>' : "") +
      '<div class="btnrow">' +
      '<button type="button" class="btn primary" data-act="edit-mv" data-id="' + esc(m.id) + '">Modifier</button>' +
      (m.categorie !== "special" ? '<button type="button" class="btn" data-act="dup-mv" data-id="' + esc(m.id) + '">Dupliquer</button>' : "") +
      (o === "modifie" ? '<button type="button" class="btn" data-act="restore-mv" data-id="' + esc(m.id) + '">Rétablir l\'original</button>' : "") +
      (o === "perso" ? '<button type="button" class="btn danger" data-act="del-mv" data-id="' + esc(m.id) + '">Supprimer</button>' : "") +
      '<button type="button" class="btn" data-act="export-mv" data-id="' + esc(m.id) + '">Exporter la fiche</button></div>' +
      '<p class="source">' + (o === "perso" ? "Mouvement perso, enregistré dans ton compte." : "Fichier source : bibliotheque/" + esc(m.id) + ".json" + (o === "modifie" ? " (ta version modifiée est enregistrée dans ton compte)" : "")) + "</p>";
  };

  /* =========================================================
     MODULE MOUVEMENT : création / modification
     ========================================================= */
  function blankMv() {
    return { id: "", nom: "", categorie: "force", duree: 30, cotes: false, description: "", consigne: "", vigilance: "", zones: [], niveau: "debutant", materiel: ["tapis"], dos: true, youtube: "", variantes: { facile: null, difficile: null }, animation: { type: "baton", ref: "repos" } };
  }
  function openMvEdit(id, opts) {
    opts = opts || {};
    var src = id ? C.mv(id) : null;
    var d = src ? C.clone(src) : blankMv();
    if (opts.duplicate) { d.id = ""; d.nom = d.nom + " (copie)"; }
    var a = d.animation || {};
    var draft = {
      mv: d, isNew: !src || !!opts.duplicate, srcId: src && !opts.duplicate ? src.id : null,
      mode: a.type === "medias" && a.medias && a.medias.length ? "medias" : "baton",
      medias: a.type === "medias" ? (a.medias || []).slice() : [],
      ref: a.type === "baton" && a.images ? "__own" : (a.ref || "repos"),
      ownImages: a.type === "baton" && a.images ? a.images : null,
      added: [], removed: [], fromRoutine: !!opts.fromRoutine, busy: false
    };
    if (opts.duplicate && draft.medias.length) {
      /* Copie indépendante des photos : on garde les mêmes références tant qu'on ne supprime pas l'original. */
      draft.sharedMedias = true;
    }
    go("mvedit", { draft: draft, preview: null });
  }
  function previewMv(dr) {
    var m = C.clone(dr.mv);
    if (dr.mode === "medias" && dr.medias.length) m.animation = { type: "medias", medias: dr.medias.slice() };
    else m.animation = dr.ref === "__own" && dr.ownImages ? { type: "baton", images: dr.ownImages } : { type: "baton", ref: dr.ref };
    return m;
  }
  VIEWS.mvedit = function (p) {
    var dr = p.draft, m = dr.mv;
    p.preview = previewMv(dr);
    var special = m.categorie === "special";
    var batonList = C.allMv().filter(function (x) { return x.animation && x.animation.type === "baton" && x.animation.images; })
      .sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); });
    var mvSel = function (k) {
      var cur = m.variantes && m.variantes[k];
      return '<select id="mv-' + k + '" data-bind="mv-var" data-k="' + k + '"><option value="">Aucune</option>' +
        C.allMv().filter(function (x) { return x.id !== m.id && x.categorie !== "special" && x.categorie !== "repos"; }).sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); })
          .map(function (x) { return '<option value="' + esc(x.id) + '"' + (cur === x.id ? " selected" : "") + ">" + esc(x.nom) + "</option>"; }).join("") + "</select>";
    };
    return '<header class="top"><button type="button" class="btn ghost" data-act="mv-cancel">Annuler</button><strong>' + (dr.isNew ? "Nouveau mouvement" : "Modifier") + "</strong>" +
      '<button type="button" class="btn primary" data-act="mv-save"' + (dr.busy ? " disabled" : "") + ">Enregistrer</button></header>" +
      '<div class="form">' +
      '<section class="fbox"><h2 class="sec">Visuel</h2>' +
      '<div class="preview cat-' + esc(m.categorie) + '"><div class="fig big" data-fig="draft" data-draft="1" data-anim="1"></div></div>' +
      '<div class="seg" role="group" aria-label="Type de visuel"><button type="button" class="' + (dr.mode === "medias" ? "on" : "") + '" data-act="mv-mode" data-m="medias" aria-pressed="' + (dr.mode === "medias") + '">Photos ou GIF</button>' +
      '<button type="button" class="' + (dr.mode === "baton" ? "on" : "") + '" data-act="mv-mode" data-m="baton" aria-pressed="' + (dr.mode === "baton") + '">Bonhomme</button></div>' +
      (dr.mode === "medias" ?
        (dr.medias.length ? '<ol class="medias">' + dr.medias.map(function (ref, i) {
          return '<li><img alt="Image ' + (i + 1) + '" data-media="' + esc(ref) + '"><div class="media-tools">' +
            '<button type="button" class="tool" data-act="media-move" data-i="' + i + '" data-d="-1" aria-label="Avancer">←</button>' +
            '<button type="button" class="tool" data-act="media-move" data-i="' + i + '" data-d="1" aria-label="Reculer">→</button>' +
            '<button type="button" class="tool danger" data-act="media-del" data-i="' + i + '" aria-label="Retirer">✕</button></div></li>';
        }).join("") + "</ol>" : "") +
        '<div class="btnrow"><label class="btn file"><input type="file" accept="image/*" capture="environment" data-file="1">Prendre une photo</label>' +
        '<label class="btn file"><input type="file" accept="image/*,.gif" multiple data-file="1">Importer image ou GIF</label></div>' +
        '<p class="hint">' + (dr.busy ? "Enregistrement des images…" : "Avec 2 photos ou plus, elles alternent pendant la séance : position de départ, puis d'arrivée. Un GIF s'anime tout seul. Les photos sont réduites automatiquement ; un GIF peut peser jusqu'à 3 Mo.") + "</p>"
        : '<label for="mv-ref">Bonhomme utilisé</label><select id="mv-ref" data-bind="mv-ref">' +
          (dr.ownImages ? '<option value="__own"' + (dr.ref === "__own" ? " selected" : "") + ">Bonhomme d'origine</option>" : "") +
          batonList.filter(function (x) { return !dr.srcId || x.id !== dr.srcId || !dr.ownImages; }).map(function (x) { return '<option value="' + esc(x.id) + '"' + (dr.ref === x.id ? " selected" : "") + ">" + esc(x.nom) + "</option>"; }).join("") + "</select>" +
          '<p class="hint">Choisis le bonhomme d\'un mouvement proche. Pour un dessin sur mesure, demande-le en session : il sera ajouté aux fichiers de la bibliothèque.</p>') +
      "</section>" +
      '<section class="fbox"><h2 class="sec">Fiche</h2>' +
      '<label for="mv-nom">Nom *</label><input id="mv-nom" data-bind="mv" data-f="nom" value="' + esc(m.nom) + '" placeholder="Ex. : Fente arrière" required>' +
      (special ? "" : '<label for="mv-cat">Catégorie</label><select id="mv-cat" data-bind="mv" data-f="categorie">' + CAT_ORDER.filter(function (c) { return c !== "special"; }).map(function (c) { return '<option value="' + c + '"' + (m.categorie === c ? " selected" : "") + ">" + CATS[c] + "</option>"; }).join("") + "</select>") +
      '<label for="mv-desc">Description</label><textarea id="mv-desc" rows="2" data-bind="mv" data-f="description" placeholder="À quoi sert ce mouvement ?">' + esc(m.description) + "</textarea>" +
      '<label for="mv-cons">Consigne</label><textarea id="mv-cons" rows="3" data-bind="mv" data-f="consigne" placeholder="Comment le faire. Affichée pendant la séance.">' + esc(m.consigne) + "</textarea>" +
      '<label for="mv-vig">Points de vigilance</label><textarea id="mv-vig" rows="2" data-bind="mv" data-f="vigilance" placeholder="Ex. : garder le bas du dos au sol">' + esc(m.vigilance) + "</textarea>" +
      '<span class="lbl">Durée par défaut</span>' + durInputs("mvdur", m.duree) +
      (special ? "" : '<label class="check"><input type="checkbox" data-bind="mv-check" data-f="cotes"' + (m.cotes ? " checked" : "") + "> Se fait côté gauche puis côté droit</label>" +
        '<label class="check"><input type="checkbox" data-bind="mv-check" data-f="dos"' + (m.dos ? " checked" : "") + "> Compatible avec un dos fragile</label>") +
      "</section>" +
      (special ? "" : '<section class="fbox"><h2 class="sec">Classement</h2>' +
        '<span class="lbl">Zones travaillées</span><div class="chips">' + ZONES.map(function (z) {
          var on = (m.zones || []).indexOf(z) >= 0;
          return '<button type="button" class="chip ' + (on ? "on" : "") + '" data-act="mv-tog" data-f="zones" data-v="' + z + '" aria-pressed="' + on + '">' + cap(z) + "</button>";
        }).join("") + "</div>" +
        '<span class="lbl">Niveau</span><div class="seg">' + Object.keys(NIVEAUX).map(function (k) {
          return '<button type="button" class="' + (m.niveau === k ? "on" : "") + '" data-act="mv-niv" data-v="' + k + '" aria-pressed="' + (m.niveau === k) + '">' + NIVEAUX[k] + "</button>";
        }).join("") + "</div>" +
        '<span class="lbl">Matériel</span><div class="chips">' + Object.keys(MATERIEL).map(function (k) {
          var on = (m.materiel || []).indexOf(k) >= 0;
          return '<button type="button" class="chip ' + (on ? "on" : "") + '" data-act="mv-tog" data-f="materiel" data-v="' + k + '" aria-pressed="' + on + '">' + MATERIEL[k] + "</button>";
        }).join("") + "</div>" +
        '<label for="mv-facile">Variante plus facile</label>' + mvSel("facile") +
        '<label for="mv-difficile">Variante plus difficile</label>' + mvSel("difficile") +
        '<label for="mv-yt">Lien YouTube</label><input id="mv-yt" type="url" inputmode="url" data-bind="mv" data-f="youtube" value="' + esc(m.youtube) + '" placeholder="Vide = recherche YouTube automatique">' +
        "</section>") +
      "</div>";
  };
  VIEWS.mvedit.after = function () {
    document.querySelectorAll("img[data-media]").forEach(function (img) {
      C.media.url(img.dataset.media).then(function (u) { if (u) img.src = u; else img.alt = "Image introuvable"; });
    });
  };
  function refreshPreview() {
    var dr = nav.params.draft; nav.params.preview = previewMv(dr);
    var el = $('[data-fig="draft"]'); if (el) Figure.mount(el, nav.params.preview, { animate: true });
  }

  /* Réduction des photos ; les GIF restent intacts pour garder l'animation. */
  function loadImage(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () { res({ img: im, done: function () { URL.revokeObjectURL(u); } }); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error("image")); };
      im.src = u;
    });
  }
  function shrink(file) {
    return loadImage(file).then(function (o) {
      var w = o.img.naturalWidth, h = o.img.naturalHeight, s = Math.min(1, 900 / Math.max(w, h));
      var c = document.createElement("canvas"); c.width = Math.round(w * s); c.height = Math.round(h * s);
      c.getContext("2d").drawImage(o.img, 0, 0, c.width, c.height); o.done();
      return new Promise(function (res) { c.toBlob(function (b) { res(b || file); }, "image/jpeg", 0.82); });
    }).catch(function () { return file; });
  }
  function addFiles(files) {
    var dr = nav.params.draft;
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    dr.busy = true; render();
    var chain = Promise.resolve();
    list.forEach(function (f) {
      chain = chain.then(function () {
        if (!/^image\//.test(f.type) && !/\.gif$/i.test(f.name)) { toast("« " + f.name + " » n'est pas une image."); return; }
        var isGif = f.type === "image/gif" || /\.gif$/i.test(f.name);
        if (isGif && f.size > 3 * 1024 * 1024) { toast("Ce GIF fait " + (f.size / 1048576).toFixed(1) + " Mo : la limite est de 3 Mo."); return; }
        return (isGif ? Promise.resolve(f) : shrink(f)).then(C.media.put).then(function (ref) { dr.medias.push(ref); dr.added.push(ref); });
      }).catch(function () { toast("Impossible d'enregistrer cette image."); });
    });
    chain.then(function () { dr.busy = false; dr.mode = "medias"; if (nav.view === "mvedit") render(); });
  }
  function saveMvDraft() {
    var dr = nav.params.draft, m = dr.mv;
    m.nom = (m.nom || "").trim();
    if (!m.nom) { toast("Donne un nom au mouvement."); var n = $("#mv-nom"); if (n) n.focus(); return; }
    m.duree = Math.max(1, readDur("mvdur") || m.duree || 30);
    if (!m.youtube) m.youtube = "";
    m.animation = previewMv(dr).animation;
    if (dr.isNew) { m.id = uid("perso"); m.origine = "perso"; }
    else m.origine = S.base[m.id] ? "modifie" : "perso";
    C.saveMv(m);
    if (!dr.sharedMedias) dr.removed.forEach(function (ref) { if (!stillUsed(ref, m.id)) C.media.remove(ref); });
    toast(dr.isNew ? "Mouvement ajouté à la bibliothèque" : "Mouvement enregistré");
    var fromRoutine = dr.fromRoutine;
    back();
    if (fromRoutine && nav.view === "editeur") { nav.params.addMv = m.id; nav.params.addDur = m.duree; render(); }
    else if (dr.isNew) { go("fiche", { id: m.id }); }
  }
  function stillUsed(ref, exceptId) {
    return C.allMv().some(function (x) { return x.id !== exceptId && x.animation && x.animation.medias && x.animation.medias.indexOf(ref) >= 0; });
  }
  function cancelMv() {
    var dr = nav.params.draft;
    dr.added.forEach(function (ref) { if (!stillUsed(ref, null)) C.media.remove(ref); });
    back();
  }
  function usages(id) {
    return (S.routines || []).filter(function (r) {
      return r.items.some(function (it) { return it.mv === id || (it.bloc && it.items.some(function (c) { return c.mv === id; })); });
    });
  }

  /* =========================================================
     JOURNAL
     ========================================================= */
  VIEWS.journal = function (p) {
    var now = new Date();
    if (p.y == null) { p.y = now.getFullYear(); p.m = now.getMonth(); }
    var done = doneDays();
    var first = new Date(p.y, p.m, 1), lead = (first.getDay() + 6) % 7, nd = new Date(p.y, p.m + 1, 0).getDate();
    var monthEntries = S.journal.filter(function (e) { var d = new Date(e.t); return d.getFullYear() === p.y && d.getMonth() === p.m; });
    var mins = Math.round(monthEntries.reduce(function (a, e) { return a + (e.dur || 0); }, 0) / 60);
    var cells = ""; for (var i = 0; i < lead; i++) cells += '<span class="cal-empty"></span>';
    for (var d = 1; d <= nd; d++) {
      var k = p.y + "-" + (p.m + 1) + "-" + d, isToday = dayKey(now) === k;
      cells += '<span class="cal-day' + (done[k] ? " done" : "") + (isToday ? " today" : "") + '"' + (done[k] ? ' aria-label="' + d + ', séance faite"' : "") + ">" + d + "</span>";
    }
    var monthName = first.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    var list = S.journal.slice().sort(function (a, b) { return b.t - a.t; }).slice(0, 60);
    return '<header class="top"><div><p class="eyebrow">Suivi</p><h1>Journal</h1></div></header>' +
      '<div class="stats"><div><strong>' + weekCount() + "/" + S.prefs.objectif + "</strong><span>cette semaine</span></div>" +
      "<div><strong>" + streak() + "</strong><span>" + (streak() > 1 ? "jours" : "jour") + " de suite<br>(week-ends non comptés)</span></div>" +
      "<div><strong>" + mins + "</strong><span>minutes ce mois</span></div></div>" +
      '<section class="cal"><div class="cal-head"><button type="button" class="btn ghost" data-act="cal" data-d="-1" aria-label="Mois précédent">←</button><strong>' + esc(cap(monthName)) + '</strong><button type="button" class="btn ghost" data-act="cal" data-d="1" aria-label="Mois suivant">→</button></div>' +
      '<div class="cal-grid"><span class="cal-dow">L</span><span class="cal-dow">M</span><span class="cal-dow">M</span><span class="cal-dow">J</span><span class="cal-dow">V</span><span class="cal-dow">S</span><span class="cal-dow">D</span>' + cells + "</div></section>" +
      '<section><h2 class="sec">Séances</h2>' + (list.length ? '<ul class="rows">' + list.map(function (e) {
        var dt = new Date(e.t);
        return '<li class="row"><div class="row-main static"><strong>' + esc(e.nom) + '</strong><span class="meta">' + esc(dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })) + " · " + dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + " · " + C.fmt(e.dur) + "</span></div>" +
          '<span class="pill ' + (e.ok ? "ok" : "soft") + '">' + (e.ok ? "Terminée" : "Interrompue") + "</span>" +
          '<button type="button" class="tool danger" data-act="del-journal" data-t="' + e.t + '" aria-label="Supprimer cette séance">✕</button></li>';
      }).join("") + "</ul>" : '<p class="empty">Aucune séance pour l\'instant. Elles s\'ajoutent toutes seules à la fin de chaque routine.</p>') + "</section>";
  };

  /* =========================================================
     RÉGLAGES : préférences, sauvegarde, export / import
     ========================================================= */
  var SYNC_TXT = {
    compte: "Synchronisé avec ton compte : tes routines, tes mouvements et ton journal sont sur tous tes appareils.",
    connexion: "Connexion à ton compte…",
    lent: "Ton compte ne répond pas pour l'instant. Tout est enregistré sur cet appareil et sera envoyé dès que possible.",
    local: "Enregistré sur cet appareil seulement. Pense à copier ta sauvegarde de temps en temps."
  };
  VIEWS.reglages = function (p) {
    var pr = S.prefs;
    var t = function (k, label) { return '<label class="check"><input type="checkbox" data-bind="pref" data-k="' + k + '"' + (pr[k] ? " checked" : "") + "> " + label + "</label>"; };
    return '<header class="top"><div><p class="eyebrow">Application</p><h1>Réglages</h1></div></header>' +
      '<section class="fbox"><h2 class="sec">Enregistrement</h2><p class="sync sync-' + S.sync + '">' + esc(SYNC_TXT[S.sync] || SYNC_TXT.local) + "</p>" +
      '<p class="hint">Photos : enregistrées ' + (C.media.where() === "compte" ? "dans ton compte." : "sur cet appareil.") + " Bibliothèque : " + C.allMv().length + " mouvements, chargés depuis " + esc(S.source === "fichiers" ? "les fichiers du dossier bibliotheque." : "la copie intégrée.") + "</p></section>" +
      '<section class="fbox"><h2 class="sec">Pendant la séance</h2>' + t("son", "Bips sonores") + t("voix", "Voix qui annonce les exercices") + t("vibration", "Vibrations") +
      '<span class="lbl">Objectif de séances par semaine</span><div class="stepper"><button type="button" data-act="obj" data-d="-1" aria-label="Moins">−</button><span>' + pr.objectif + '</span><button type="button" data-act="obj" data-d="1" aria-label="Plus">+</button></div></section>' +
      '<section class="fbox"><h2 class="sec">Sauvegarde</h2><p class="hint">Copie le texte pour le garder ou me le donner en session. Les photos ne sont pas incluses.</p>' +
      '<div class="btnrow"><button type="button" class="btn primary" data-act="export-all">Copier ma sauvegarde</button>' +
      (C.hasDownloads() ? '<button type="button" class="btn" data-act="download-all">Télécharger (.json)</button>' : "") + "</div>" +
      (p.exportText ? '<label class="sr" for="exp">Texte de la sauvegarde</label><textarea id="exp" class="code" rows="5" readonly>' + esc(p.exportText) + "</textarea>" : "") +
      '<label for="imp">Importer une sauvegarde, une routine ou un mouvement</label><textarea id="imp" class="code" rows="4" placeholder="Colle ici le texte copié"></textarea>' +
      '<button type="button" class="btn" data-act="import">Importer</button></section>' +
      '<section class="fbox"><h2 class="sec">Routines de base</h2><p class="hint">Réinstalle les routines ' + S.baseRoutines.map(function (r) { return r.nom; }).join(", ") + ' dans leur version d\'origine.</p><button type="button" class="btn" data-act="reinstall">Réinstaller les routines de base</button></section>';
  };
  function exportPayload(type, extra) { return JSON.stringify(Object.assign({ format: "calisthenics", version: 1, type: type, date: new Date().toISOString() }, extra), null, 1); }
  function copyText(text) {
    try { return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; }); }
    catch (e) { return Promise.resolve(false); }
  }
  function doImport(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { toast("Ce texte n'est pas une sauvegarde valide."); return; }
    if (!data || data.format !== "calisthenics") { toast("Ce texte ne vient pas de cette application."); return; }
    if (data.type === "sauvegarde") {
      C.importAll(data);
      toast((data.routines || []).length + " routines et " + Object.keys(data.mouvements || {}).length + " mouvements importés");
    } else if (data.type === "routine" && data.routine) {
      var r = data.routine;
      Object.keys(data.mouvements || {}).forEach(function (k) { if (!C.mv(k)) C.saveMv(data.mouvements[k]); });
      if (routineById(r.id)) { r.id = uid("r"); r.nom += " (importée)"; }
      r.cree = Date.now(); C.saveRoutine(r); toast("Routine « " + r.nom + " » importée");
    } else if (data.type === "mouvement" && data.mouvement) {
      var m = data.mouvement; m.origine = S.base[m.id] ? "modifie" : "perso"; C.saveMv(m); toast("Mouvement « " + m.nom + " » importé");
    } else { toast("Rien à importer dans ce texte."); return; }
    var imp = $("#imp"); if (imp) imp.value = "";
  }

  /* =========================================================
     ACTIONS
     ========================================================= */
  var ACT = {
    back: back,
    "new-routine": function () {
      var r = { id: uid("r"), nom: "Nouvelle routine", fav: false, jours: [], depart: 10, fin: 5, items: [] };
      C.saveRoutine(r); go("editeur", { id: r.id });
      setTimeout(function () { var n = $("#r-name"); if (n) { n.focus(); n.select(); } }, 50);
    },
    "edit-routine": function (el) { go("editeur", { id: el.dataset.id }); },
    launch: function (el) {
      var r = routineById(el.dataset.id); if (!r) return;
      if (!r.items.length) { toast("Ajoute au moins un exercice avant de lancer."); return; }
      C.Player.launch(r);
    },
    fav: function (el) { var r = routineById(el.dataset.id); if (!r) return; r.fav = !r.fav; C.saveRoutine(r); render(); },
    day: function (el) {
      var r = routineById(nav.params.id), d = +el.dataset.d; r.jours = r.jours || [];
      var i = r.jours.indexOf(d); if (i >= 0) r.jours.splice(i, 1); else r.jours.push(d);
      saveCur(r);
    },
    move: function (el) {
      var r = routineById(nav.params.id), at = getAt(r, el.dataset.path), j = at.i + (+el.dataset.d);
      if (j < 0 || j >= at.arr.length) return;
      var x = at.arr.splice(at.i, 1)[0]; at.arr.splice(j, 0, x); saveCur(r);
    },
    dup: function (el) { var r = routineById(nav.params.id), at = getAt(r, el.dataset.path); at.arr.splice(at.i + 1, 0, C.clone(at.item)); saveCur(r); },
    del: function (el) {
      var r = routineById(nav.params.id), at = getAt(r, el.dataset.path);
      var go2 = function () { at.arr.splice(at.i, 1); saveCur(r); };
      if (at.item.bloc && at.item.items.length) dialog({ title: "Retirer ce bloc ?", text: "Ses " + at.item.items.length + " exercices seront retirés aussi.", buttons: [{ label: "Annuler", value: false }, { label: "Retirer", value: true, danger: true, primary: true }] }).then(function (ok) { if (ok) go2(); });
      else go2();
    },
    sides: function (el) { var r = routineById(nav.params.id), at = getAt(r, el.dataset.path); at.item.cotes = at.item.cotes === false; saveCur(r); },
    rounds: function (el) { var r = routineById(nav.params.id), at = getAt(r, el.dataset.path); at.item.rounds = Math.min(20, Math.max(1, at.item.rounds + (+el.dataset.d))); saveCur(r); },
    add: function () {
      var r = routineById(nav.params.id), p = nav.params, m = C.mv(p.addMv); if (!m) return;
      var dur = readDur("add") || m.duree;
      var it = { mv: m.id, dur: dur };
      (p.target !== "root" && r.items[+p.target] && r.items[+p.target].bloc ? r.items[+p.target].items : r.items).push(it);
      saveCur(r); toast(m.nom + " ajouté");
    },
    "add-rest": function () {
      var r = routineById(nav.params.id), p = nav.params, rest = C.mv("repos");
      (p.target !== "root" && r.items[+p.target] && r.items[+p.target].bloc ? r.items[+p.target].items : r.items).push({ mv: "repos", dur: rest ? rest.duree : 20 });
      saveCur(r);
    },
    "add-bloc": function () {
      var r = routineById(nav.params.id);
      r.items.push({ bloc: true, rounds: 2, items: [] });
      nav.params.target = String(r.items.length - 1); saveCur(r);
      toast("Bloc ajouté : les prochains exercices iront dedans");
    },
    "routine-menu": function (el) {
      var r = routineById(el.dataset.id);
      dialog({ title: r.nom, buttons: [{ label: "Dupliquer", value: "dup" }, { label: "Copier pour export", value: "exp" }, { label: "Supprimer", value: "del", danger: true }, { label: "Fermer", value: null, primary: true }] }).then(function (v) {
        if (v === "dup") { var c = C.clone(r); c.id = uid("r"); c.nom += " (copie)"; c.fav = false; c.cree = Date.now(); C.saveRoutine(c); nav = { view: "editeur", params: { id: c.id } }; render(); toast("Copie créée"); }
        if (v === "exp") {
          var used = {}; JSON.stringify(r).replace(/"mv":"([^"]+)"/g, function (_, id) { if (C.origin(id) === "perso") used[id] = C.mv(id); });
          var txt = exportPayload("routine", { routine: r, mouvements: used });
          copyText(txt).then(function (ok) { if (ok) toast("Routine copiée"); else dialog({ title: "Copie la routine", html: '<textarea class="code" rows="6" readonly>' + esc(txt) + "</textarea>" }); });
        }
        if (v === "del") dialog({ title: "Supprimer « " + r.nom + " » ?", text: "Cette action est définitive. Le journal garde ses séances.", buttons: [{ label: "Annuler", value: false }, { label: "Supprimer", value: true, danger: true, primary: true }] }).then(function (ok) { if (ok) { C.deleteRoutine(r.id); tab("routines"); toast("Routine supprimée"); } });
      });
    },
    "new-mv": function () { openMvEdit(null, { fromRoutine: nav.view === "editeur" }); },
    fiche: function (el) { go("fiche", { id: el.dataset.id }); },
    "edit-mv": function (el) { openMvEdit(el.dataset.id); },
    "dup-mv": function (el) { openMvEdit(el.dataset.id, { duplicate: true }); },
    "restore-mv": function (el) {
      var id = el.dataset.id;
      dialog({ title: "Rétablir l'original ?", text: "Ta version modifiée sera remplacée par celle du fichier de la bibliothèque.", buttons: [{ label: "Annuler", value: false }, { label: "Rétablir", value: true, primary: true }] }).then(function (ok) {
        if (!ok) return;
        var mine = S.mouvements[id];
        C.deleteMv(id);
        if (mine && mine.animation && mine.animation.medias) mine.animation.medias.forEach(function (ref) { if (!stillUsed(ref, id)) C.media.remove(ref); });
        render(); toast("Version d'origine rétablie");
      });
    },
    "del-mv": function (el) {
      var id = el.dataset.id, m = C.mv(id), u = usages(id);
      dialog({ title: "Supprimer « " + m.nom + " » ?", text: u.length ? "Il est utilisé dans " + u.length + " routine" + (u.length > 1 ? "s" : "") + " (" + u.map(function (r) { return r.nom; }).join(", ") + "). Il y apparaîtra comme introuvable." : "Ses photos seront supprimées aussi.", buttons: [{ label: "Annuler", value: false }, { label: "Supprimer", value: true, danger: true, primary: true }] }).then(function (ok) {
        if (!ok) return;
        C.deleteMv(id);
        if (m.animation && m.animation.medias) m.animation.medias.forEach(function (ref) { if (!stillUsed(ref, id)) C.media.remove(ref); });
        back(); toast("Mouvement supprimé");
      });
    },
    "export-mv": function (el) {
      var m = C.mv(el.dataset.id), txt = exportPayload("mouvement", { mouvement: m });
      copyText(txt).then(function (ok) { if (ok) toast("Fiche copiée (sans les photos)"); else dialog({ title: "Copie la fiche", html: '<textarea class="code" rows="6" readonly>' + esc(txt) + "</textarea>" }); });
    },
    "mv-save": saveMvDraft,
    "mv-cancel": cancelMv,
    "mv-mode": function (el) { nav.params.draft.mode = el.dataset.m; render(); },
    "mv-tog": function (el) {
      var m = nav.params.draft.mv, f = el.dataset.f, v = el.dataset.v; m[f] = m[f] || [];
      var i = m[f].indexOf(v); if (i >= 0) m[f].splice(i, 1); else m[f].push(v);
      el.classList.toggle("on", i < 0); el.setAttribute("aria-pressed", String(i < 0));
    },
    "mv-niv": function (el) { nav.params.draft.mv.niveau = el.dataset.v; el.parentNode.querySelectorAll("button").forEach(function (b) { var on = b === el; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }); },
    "media-move": function (el) { var a = nav.params.draft.medias, i = +el.dataset.i, j = i + (+el.dataset.d); if (j < 0 || j >= a.length) return; var x = a.splice(i, 1)[0]; a.splice(j, 0, x); render(); },
    "media-del": function (el) { var dr = nav.params.draft, ref = dr.medias.splice(+el.dataset.i, 1)[0]; if (dr.added.indexOf(ref) >= 0) { dr.added.splice(dr.added.indexOf(ref), 1); C.media.remove(ref); } else dr.removed.push(ref); render(); },
    bcat: function (el) { nav.params.cat = el.dataset.c; render(); },
    bdos: function () { nav.params.dos = !nav.params.dos; render(); },
    cal: function (el) { var p = nav.params, d = new Date(p.y, p.m + (+el.dataset.d), 1); p.y = d.getFullYear(); p.m = d.getMonth(); render(); },
    "del-journal": function (el) {
      dialog({ title: "Supprimer cette séance du journal ?", buttons: [{ label: "Annuler", value: false }, { label: "Supprimer", value: true, danger: true, primary: true }] }).then(function (ok) { if (ok) { C.deleteJournal(+el.dataset.t); render(); } });
    },
    obj: function (el) { S.prefs.objectif = Math.min(7, Math.max(1, S.prefs.objectif + (+el.dataset.d))); C.savePrefs(); render(); },
    "export-all": function () {
      var txt = exportPayload("sauvegarde", { routines: S.routines, mouvements: S.mouvements, journal: S.journal, prefs: S.prefs });
      nav.params.exportText = txt; render();
      copyText(txt).then(function (ok) { toast(ok ? "Sauvegarde copiée" : "Sélectionne le texte ci-dessous pour le copier"); });
    },
    "download-all": function () {
      var txt = exportPayload("sauvegarde", { routines: S.routines, mouvements: S.mouvements, journal: S.journal, prefs: S.prefs });
      C.download("calisthenics-sauvegarde-" + new Date().toISOString().slice(0, 10) + ".json", txt).then(function () { toast("Fichier enregistré"); }, function () { toast("Téléchargement annulé"); });
    },
    "import": function () { var t = $("#imp"); if (t && t.value.trim()) doImport(t.value.trim()); else toast("Colle d'abord le texte à importer."); },
    reinstall: function () {
      var existing = S.baseRoutines.filter(function (b) { return routineById(b.id); });
      var doIt = function () { S.baseRoutines.forEach(function (b) { var c = C.clone(b); c.cree = (routineById(b.id) || {}).cree || Date.now(); C.saveRoutine(c); }); toast("Routines de base réinstallées"); };
      if (existing.length) dialog({ title: "Remplacer les routines de base ?", text: "Tes modifications sur ces routines seront perdues. Les autres routines ne changent pas.", buttons: [{ label: "Annuler", value: false }, { label: "Remplacer", value: true, primary: true }] }).then(function (ok) { if (ok) doIt(); });
      else doIt();
    }
  };

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-tab]");
    if (t) { tab(t.dataset.tab); return; }
    var a = e.target.closest("[data-act]");
    if (!a || a.disabled || !$("#view").contains(a) && !$("#tabs").contains(a)) return;
    var fn = ACT[a.dataset.act]; if (fn) { e.preventDefault(); fn(a, e); }
  });
  document.addEventListener("input", function (e) {
    var el = e.target, b = el.dataset && el.dataset.bind;
    if (!b || !$("#view").contains(el)) return;
    if (b === "r-name") { var r = routineById(nav.params.id); r.nom = el.value; clearTimeout(ACT.nameTm); ACT.nameTm = setTimeout(function () { saveCur(r, false); }, 400); }
    else if (b === "bq") { nav.params.q = el.value; fillGrid(nav.params); }
    else if (b === "mv") { nav.params.draft.mv[el.dataset.f] = el.value; }
  });
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (!$("#view").contains(el)) return;
    if (el.dataset.file) { addFiles(el.files); el.value = ""; return; }
    if (el.dataset.dur) {
      var key = el.dataset.dur, sec = readDur(key);
      if (nav.view === "editeur") {
        var p = nav.params, r = routineById(p.id);
        if (key === "add") { p.addDur = sec; return; }
        sec = Math.max(1, sec);
        if (key === "depart" || key === "fin") r[key] = sec; else getAt(r, key).item.dur = sec;
        saveCur(r);
      } else if (nav.view === "mvedit") { nav.params.draft.mv.duree = Math.max(1, sec); }
      return;
    }
    var b = el.dataset.bind;
    if (b === "add-mv") { var m = C.mv(el.value); nav.params.addMv = el.value; nav.params.addDur = m ? m.duree : 30; render(); }
    else if (b === "add-target") { nav.params.target = el.value; }
    else if (b === "bz") { nav.params.zone = el.value; render(); }
    else if (b === "mv") { nav.params.draft.mv[el.dataset.f] = el.value; if (el.dataset.f === "categorie") render(); }
    else if (b === "mv-check") { nav.params.draft.mv[el.dataset.f] = el.checked; }
    else if (b === "mv-ref") { nav.params.draft.ref = el.value; refreshPreview(); }
    else if (b === "mv-var") { var dm = nav.params.draft.mv; dm.variantes = dm.variantes || {}; dm.variantes[el.dataset.k] = el.value || null; }
    else if (b === "pref") { S.prefs[el.dataset.k] = el.checked; C.savePrefs(); }
  });

  /* Données reçues d'un autre appareil : on rafraîchit, sauf pendant une saisie. */
  var pendingRender = false;
  C.on(function (kind) {
    if (kind && kind.type === "erreur") { toast(kind.message); return; }
    if (kind === "caps" && nav.view !== "reglages") return;
    if (nav.view === "mvedit") return;
    var a = document.activeElement;
    if (a && $("#view").contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { pendingRender = true; return; }
    render();
  });
  document.addEventListener("focusout", function () { if (pendingRender) { pendingRender = false; setTimeout(function () { var a = document.activeElement; if (!a || !/INPUT|TEXTAREA|SELECT/.test(a.tagName)) render(); else pendingRender = true; }, 50); } });

  C.journalStats = { weekCount: weekCount };

  /* ---------- démarrage ---------- */
  function boot() {
    render();
    C.loadLibrary().then(function () { render(); }, function () {
      $("#view").innerHTML = '<p class="empty">La bibliothèque n\'a pas pu être chargée. Recharge la page.</p>';
    }).then(function () { C.connect(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(window.CAL);
