"use strict";
/* Lecteur de séance : carrousel précédent / en cours / suivant, deux barres de temps, commandes. */
(function (C) {
  var S = C.state;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return C.esc(s); };
  var P = { steps: [], before: [], total: 0, idx: 0, rem: 0, run: false, done: false, endAt: 0, timer: null, last: -1, r: null, logged: false, figs: [] };

  function stepTitle(s) { return s.title + (s.side ? " · " + s.side : ""); }

  /* ---------- son, voix, vibration, écran allumé ---------- */
  var ac = null;
  function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch (e) {} }
  function beep(f, d, w) {
    if (!S.prefs.son || !ac) return;
    try {
      var t = ac.currentTime + (w || 0), o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.03);
    } catch (e) {}
  }
  function say(t) {
    if (!S.prefs.voix || !("speechSynthesis" in window)) return;
    try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(t); u.lang = "fr-FR"; u.rate = 1.05; speechSynthesis.speak(u); } catch (e) {}
  }
  function hush() { try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch (e) {} }
  function buzz(p) { if (!S.prefs.vibration) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  var lock = null;
  function wake() { try { if ("wakeLock" in navigator && !lock) navigator.wakeLock.request("screen").then(function (l) { lock = l; l.addEventListener("release", function () { lock = null; }); }, function () {}); } catch (e) {} }
  function unwake() { try { if (lock) lock.release(); } catch (e) {} lock = null; }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && P.run) wake(); });

  /* ---------- construction ---------- */
  function build() {
    var track = $("#p-track"); track.innerHTML = ""; P.figs = [];
    P.steps.forEach(function (s, i) {
      var c = document.createElement("div");
      c.className = "pcard cat-" + s.cat; c.dataset.i = i;
      c.innerHTML = '<div class="fig pfig"></div><div class="pc-txt"><strong></strong><span></span></div><span class="pc-dur"></span>';
      c.querySelector("strong").textContent = stepTitle(s);
      c.querySelector(".pc-txt span").textContent = s.tag || C.CATS[s.cat] || "";
      c.querySelector(".pc-dur").textContent = C.fmt(s.dur);
      c.addEventListener("click", function () { if (i !== P.idx) jump(i); });
      track.appendChild(c);
      var h = Figure.mount(c.querySelector(".pfig"), C.mv(s.id), { animate: false });
      P.figs.push(h);
    });
    P.before = []; var acc = 0;
    P.steps.forEach(function (s) { P.before.push(acc); acc += s.dur; });
    P.total = acc;
    $("#p-name").textContent = P.r.nom;
    $("#p-tot").textContent = C.fmt(P.total);
  }
  function place() {
    var track = $("#p-track"), vp = $("#p-carousel"), cards = track.children;
    if (!cards.length) return;
    var w = cards[0].offsetWidth, gap = parseFloat(getComputedStyle(track).columnGap) || 12;
    var x = vp.clientWidth / 2 - (P.idx * (w + gap) + w / 2);
    track.style.transform = "translateX(" + x.toFixed(1) + "px)";
  }
  window.addEventListener("resize", function () { if (!$("#player").hidden) place(); });

  /* ---------- moteur ---------- */
  function enter() {
    var s = P.steps[P.idx], n = P.steps[P.idx + 1];
    if (s.cat === "repos") { beep(440, 0.25); buzz(80); say("Repos." + (n ? " Ensuite, " + stepTitle(n) : "")); }
    else if (s.id === "depart") { beep(660, 0.2); say("Préparez-vous." + (n ? " Premier exercice, " + stepTitle(n) : "")); }
    else if (s.id === "fin") { beep(660, 0.2, 0); beep(880, 0.2, 0.25); beep(1100, 0.45, 0.5); buzz([200, 80, 200, 80, 400]); say("Séance terminée. Bravo."); log(true); }
    else { beep(880, 0.35); buzz([60, 40, 60]); say(stepTitle(s)); }
  }
  function tick() {
    var now = performance.now();
    P.rem = P.endAt - now;
    while (P.rem <= 0) {
      if (P.idx >= P.steps.length - 1) { finish(); return; }
      var over = -P.rem; P.idx++; P.rem = P.steps[P.idx].dur * 1000 - over; P.endAt = now + P.rem; P.last = -1;
      enter(); show();
    }
    var sec = Math.ceil(P.rem / 1000);
    if (sec !== P.last) { P.last = sec; if (sec >= 1 && sec <= 3 && P.steps[P.idx].dur > 3) beep(600, 0.1); }
    clock();
  }
  function play() {
    audio();
    if (P.done) { restart(); return; }
    P.run = true; P.endAt = performance.now() + P.rem;
    clearInterval(P.timer); P.timer = setInterval(tick, 100); wake(); show();
  }
  function pause() { P.rem = P.endAt - performance.now(); P.run = false; clearInterval(P.timer); unwake(); hush(); show(); }
  function finish() {
    P.run = false; P.done = true; clearInterval(P.timer); unwake(); P.rem = 0;
    if (!P.logged) log(true);
    show();
    var d = $("#p-done");
    $("#p-done-txt").textContent = P.r.nom + " · " + C.fmt(P.total) + ". Séance ajoutée au journal.";
    d.hidden = false; $("#p-done .btn.primary").focus();
  }
  function jump(i) {
    i = Math.min(P.steps.length - 1, Math.max(0, i));
    P.done = false; $("#p-done").hidden = true;
    P.idx = i; P.rem = P.steps[i].dur * 1000; P.last = -1;
    if (P.run) { P.endAt = performance.now() + P.rem; enter(); }
    show();
  }
  function prev() { var el = P.steps[P.idx].dur * 1000 - P.rem; jump(el > 2500 && !P.done ? P.idx : P.idx - 1); }
  function restart() { P.done = false; P.logged = false; $("#p-done").hidden = true; P.idx = 0; P.rem = P.steps[0].dur * 1000; P.last = -1; P.run = false; play(); enter(); }

  function elapsed() { return P.done ? P.total : P.before[P.idx] + (P.steps[P.idx].dur * 1000 - Math.max(0, P.rem)) / 1000; }
  function log(ok) {
    if (P.logged) return;
    var el = ok ? P.total : Math.round(elapsed());
    P.logged = true;
    C.addJournal({ t: Date.now(), r: P.r.id, nom: P.r.nom, dur: Math.round(el), ok: ok });
  }

  /* ---------- affichage ---------- */
  function show() {
    var s = P.steps[P.idx], n = P.steps[P.idx + 1];
    $("#player").dataset.cat = P.done ? "special" : s.cat;
    var cards = $("#p-track").children;
    for (var i = 0; i < cards.length; i++) {
      var d = i - P.idx;
      cards[i].classList.toggle("is-cur", d === 0);
      cards[i].classList.toggle("is-side", Math.abs(d) === 1);
      cards[i].classList.toggle("is-past", d < 0);
      cards[i].setAttribute("aria-hidden", d === 0 ? "false" : "true");
      if (P.figs[i]) P.figs[i].active = Math.abs(d) <= 1;
    }
    place();
    $("#p-tag").textContent = [C.CATS[s.cat], s.tag, s.side ? "côté " + s.side : ""].filter(Boolean).join(" · ");
    $("#p-cue").textContent = s.cat === "repos" ? (n ? "Ensuite : " + stepTitle(n) : "") : s.cue;
    $("#p-vig").textContent = s.cat === "repos" ? "" : s.vig;
    $("#p-vig").hidden = !s.vig || s.cat === "repos";
    $("#p-step").textContent = "étape " + (P.idx + 1) + "/" + P.steps.length;
    var lbl = P.done ? "Recommencer" : P.run ? "Pause" : "Reprendre";
    $("#p-play .lbl").textContent = lbl; $("#p-play").setAttribute("aria-label", lbl);
    $("#p-play").classList.toggle("is-run", P.run);
    $("#p-prev").disabled = P.idx === 0 && P.steps[0].dur * 1000 - P.rem < 2500;
    $("#p-next").disabled = P.idx >= P.steps.length - 1;
    clock();
  }
  function clock() {
    var s = P.steps[P.idx], rem = P.done ? 0 : Math.max(0, P.rem), sec = Math.ceil(rem / 1000);
    $("#p-clock").textContent = sec >= 60 ? C.fmt(sec) : String(sec);
    $("#p-exrem").textContent = C.fmt(sec) + " restant";
    $("#p-exbar").style.width = (P.done ? 100 : 100 - rem / (s.dur * 1000) * 100).toFixed(1) + "%";
    var el = elapsed();
    $("#p-el").textContent = C.fmt(el);
    $("#p-allbar").style.width = (el / P.total * 100).toFixed(2) + "%";
  }

  function close() {
    var el = elapsed();
    var finishClose = function () {
      clearInterval(P.timer); P.run = false; unwake(); hush();
      $("#player").hidden = true; document.body.classList.remove("playing");
      $("#p-track").innerHTML = ""; P.figs = [];
      C.render();
    };
    if (P.done || P.logged || el < 30) { finishClose(); return; }
    var wasRunning = P.run; if (wasRunning) pause();
    C.dialog({ title: "Arrêter la séance ?", text: "Elle sera notée comme interrompue dans le journal (" + C.fmt(el) + " faites).", buttons: [{ label: "Continuer", value: false }, { label: "Arrêter", value: true, danger: true, primary: true }] }).then(function (ok) {
      if (ok) { log(false); finishClose(); } else if (wasRunning) play();
    });
  }

  /* ---------- gestes et clavier ---------- */
  var sx = null, sy = null;
  function bind() {
    var car = $("#p-carousel");
    car.addEventListener("pointerdown", function (e) { sx = e.clientX; sy = e.clientY; });
    car.addEventListener("pointerup", function (e) {
      if (sx == null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) jump(P.idx + 1); else prev(); }
    });
    $("#p-play").addEventListener("click", function () { if (P.run) pause(); else play(); });
    $("#p-prev").addEventListener("click", prev);
    $("#p-next").addEventListener("click", function () { jump(P.idx + 1); });
    $("#p-close").addEventListener("click", close);
    $("#p-again").addEventListener("click", restart);
    $("#p-quit").addEventListener("click", close);
    ["son", "voix"].forEach(function (k) {
      var b = $("#p-" + k);
      b.addEventListener("click", function () {
        S.prefs[k] = !S.prefs[k]; C.savePrefs(); b.setAttribute("aria-pressed", String(S.prefs[k]));
        if (k === "son" && S.prefs.son) { audio(); beep(660, 0.15); }
        if (k === "voix" && S.prefs.voix) say("Voix activée");
      });
    });
    document.addEventListener("keydown", function (e) {
      if ($("#player").hidden || !$("#dlg").hidden) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.code === "Space") { e.preventDefault(); if (P.run) pause(); else play(); }
      else if (e.key === "ArrowRight") jump(P.idx + 1);
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") close();
    });
  }

  C.Player = {
    launch: function (r) {
      P.r = r; P.steps = C.steps(r); P.idx = 0; P.done = false; P.logged = false; P.last = -1;
      P.rem = P.steps[0].dur * 1000;
      $("#player").hidden = false; $("#p-done").hidden = true; document.body.classList.add("playing");
      ["son", "voix"].forEach(function (k) { $("#p-" + k).setAttribute("aria-pressed", String(!!S.prefs[k])); });
      build();
      requestAnimationFrame(function () { show(); play(); enter(); });
    },
    _state: P
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
})(window.CAL);
