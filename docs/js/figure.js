"use strict";
/* Affichage d'un mouvement : bonhomme bâton animé, photos qui alternent ou GIF. */
window.Figure = (function () {
  var NS = "http://www.w3.org/2000/svg";
  var live = new Set();
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var api = {
    resolve: function () { return null; },          /* id -> mouvement, fourni par l'appli */
    mediaUrl: function () { return Promise.resolve(null); } /* ref média -> url, fourni par l'appli */
  };

  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }

  function fitBox(frames) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    frames.forEach(function (fr) {
      ["n", "f", "t"].forEach(function (g) {
        (fr[g] || []).forEach(function (l) {
          for (var k = 0; k < l.length; k += 2) {
            x0 = Math.min(x0, l[k]); x1 = Math.max(x1, l[k]);
            y0 = Math.min(y0, l[k + 1]); y1 = Math.max(y1, l[k + 1]);
          }
        });
      });
      x0 = Math.min(x0, fr.h[0] - 9); x1 = Math.max(x1, fr.h[0] + 9);
      y0 = Math.min(y0, fr.h[1] - 9); y1 = Math.max(y1, fr.h[1] + 9);
    });
    y1 = Math.max(y1, 132); x0 -= 12; x1 += 12; y0 -= 8;
    var w = x1 - x0, h = y1 - y0, r = 200 / 140;
    if (w / h < r) { var nw = h * r; x0 -= (nw - w) / 2; w = nw; } else { var nh = w / r; y0 -= (nh - h); h = nh; }
    return { x: x0, y: y0, w: w, h: h };
  }

  /* Trouve les images du bonhomme d'un mouvement (directes ou par référence). */
  function batonFrames(mv, depth) {
    if (!mv || !mv.animation || depth > 4) return null;
    var a = mv.animation;
    if (a.type === "baton" && a.images && a.images.length) return a.images;
    if (a.type === "baton" && a.ref) return batonFrames(api.resolve(a.ref), (depth || 0) + 1);
    if (a.type === "medias" && a.ref) return batonFrames(api.resolve(a.ref), (depth || 0) + 1);
    return null;
  }

  function mountBaton(host, frames, handle) {
    var B = fitBox(frames), K = B.w / 200;
    var svg = el("svg", { viewBox: [B.x, B.y, B.w, B.h].map(function (v) { return v.toFixed(1); }).join(" "), "aria-hidden": "true", "class": "fig-svg" });
    svg.appendChild(el("rect", { "class": "mat", x: (B.x + 4).toFixed(1), y: 123, width: (B.w - 8).toFixed(1), height: (6 * K).toFixed(1), rx: (3 * K).toFixed(1) }));
    var parts = [];
    [["f", "far"], ["t", "thin"], ["n", "near"]].forEach(function (g) {
      (frames[0][g[0]] || []).forEach(function (_, i) { var p = el("polyline", { "class": g[1] }); svg.appendChild(p); parts.push({ g: g[0], i: i, el: p }); });
    });
    var head = el("circle", { "class": "head", r: (9 * K).toFixed(1) });
    svg.appendChild(head);
    host.appendChild(svg);
    var a = frames[0], b = frames[1] || frames[0];
    function draw(u) {
      parts.forEach(function (p) {
        var x = a[p.g][p.i], y = (b[p.g] && b[p.g][p.i]) || x, pts = [];
        for (var k = 0; k < x.length; k += 2) pts.push((x[k] + (y[k] - x[k]) * u).toFixed(1) + "," + (x[k + 1] + (y[k + 1] - x[k + 1]) * u).toFixed(1));
        p.el.setAttribute("points", pts.join(" "));
      });
      head.setAttribute("cx", (a.h[0] + (b.h[0] - a.h[0]) * u).toFixed(1));
      head.setAttribute("cy", (a.h[1] + (b.h[1] - a.h[1]) * u).toFixed(1));
    }
    draw(0);
    handle.tick = function (ts) { draw(reduce ? 0 : (1 - Math.cos(ts / 2600 * 2 * Math.PI)) / 2); };
  }

  function mountMedias(host, refs, handle) {
    var img = document.createElement("img");
    img.alt = ""; img.className = "fig-img"; img.decoding = "async";
    host.appendChild(img);
    var urls = [];
    Promise.all(refs.map(function (r) { return api.mediaUrl(r).catch(function () { return null; }); })).then(function (list) {
      urls = list.filter(Boolean);
      if (!urls.length) { host.innerHTML = ""; placeholder(host, "Photo introuvable"); return; }
      img.src = urls[0];
    });
    var cur = 0;
    handle.tick = function (ts) {
      if (urls.length < 2 || reduce) return;
      var i = Math.floor(ts / 1300) % urls.length;
      if (i !== cur) { cur = i; img.src = urls[i]; }
    };
  }

  function placeholder(host, text) {
    var d = document.createElement("div");
    d.className = "fig-empty"; d.textContent = text || "Pas de visuel";
    host.appendChild(d);
  }

  /* Monte le visuel d'un mouvement dans host. Renvoie un objet dont on règle .active. */
  function mount(host, mv, opts) {
    opts = opts || {};
    host.innerHTML = "";
    var handle = { host: host, active: opts.animate !== false, tick: function () {} };
    var a = mv && mv.animation;
    if (a && a.type === "medias" && a.medias && a.medias.length) mountMedias(host, a.medias, handle);
    else {
      var fr = batonFrames(mv, 0);
      if (fr) mountBaton(host, fr, handle);
      else placeholder(host, mv ? "Pas de visuel" : "Mouvement introuvable");
    }
    live.add(handle);
    return handle;
  }

  function loop(ts) {
    live.forEach(function (h) {
      if (!h.host.isConnected) { live.delete(h); return; }
      if (h.active) h.tick(ts);
    });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  api.mount = mount;
  api.fitBox = fitBox;
  api.hasBaton = function (mv) { return !!batonFrames(mv, 0); };
  return api;
})();
