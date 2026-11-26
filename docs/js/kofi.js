"use strict";
/* Soutien Ko-fi : compteur d'ouvertures gardé dans ce navigateur, petit message de remerciement
   toutes les 10 ouvertures. Aucune donnée n'est envoyée à un serveur. */
(function () {
  var URL_KOFI = "https://ko-fi.com/jeanpineau";
  var CLE = "nb_utilisations_calisthenics-routines";
  var MESSAGES = [
    "Cette app a l'air de vous plaire ! N'hésitez pas à me faire vos retours et à me payer un café ☕",
    "Déjà {n} ouvertures de l'app ! Si elle vous rend service, un petit café me ferait très plaisir ☕",
    "Merci d'utiliser l'app aussi régulièrement ! Vos retours et un café m'aident à l'améliorer ☕",
    "Vous revenez souvent, ça fait plaisir ! Une idée, un avis, un café ? Tout est bienvenu ☕",
    "Cette app accompagne vos séances ? Soutenez son développement en m'offrant un café ☕",
    "Bravo pour votre régularité ! Si l'app vous aide, pensez à me payer un café ☕"
  ];
  window.KOFI = { url: URL_KOFI };

  var n;
  try {
    n = (parseInt(localStorage.getItem(CLE), 10) || 0) + 1;
    localStorage.setItem(CLE, String(n));
  } catch (e) { return; }      /* stockage indisponible : pas de compteur, pas de pop-up */
  if (n % 10 !== 0) return;

  function afficher() {
    if (document.getElementById("kofi-pop")) return;
    var box = document.createElement("div");
    box.id = "kofi-pop"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite");
    var p = document.createElement("p");
    p.textContent = MESSAGES[Math.floor(Math.random() * MESSAGES.length)].replace("{n}", n);
    var row = document.createElement("div"); row.className = "btnrow";
    var later = document.createElement("button"); later.type = "button"; later.className = "btn"; later.textContent = "Plus tard";
    var pay = document.createElement("a"); pay.className = "btn primary"; pay.href = URL_KOFI; pay.target = "_blank"; pay.rel = "noopener"; pay.textContent = "Payer un café";
    function fermer() { if (box.parentNode) box.parentNode.removeChild(box); }
    later.addEventListener("click", fermer);
    pay.addEventListener("click", function () { setTimeout(fermer, 0); });
    row.appendChild(later); row.appendChild(pay);
    box.appendChild(p); box.appendChild(row);
    document.body.appendChild(box);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(afficher, 1500); });
  else setTimeout(afficher, 1500);
})();
