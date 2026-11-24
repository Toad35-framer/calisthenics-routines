/* Génère la bibliothèque : un fichier JSON par mouvement, l'index, le bundle de secours et les routines de base. */
const fs = require("fs");
const path = require("path");
const { POSES } = require(path.join(__dirname, "poses.js"));
const OUT = path.join(__dirname, "..", "app");

const yt = q => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q).replace(/%20/g, "+");

/* Nouveaux pictogrammes (même format que poses.js). */
const STAND = (arm) => ({ h: [100, -9], n: [[100,5,100,-9],[100,49,100,27,100,5],[100,121,100,85,100,49],arm], f: [], t: [] });
const NEW = {
  depart: [STAND([100,8,103,30,106,52]), STAND([100,8,104,30,108,52])],
  repos: [STAND([100,8,102,30,104,52]), { h: [100,-11], n: [[100,3,100,-11],[100,49,100,26,100,3],[100,121,100,85,100,49],[100,6,106,28,110,50]], f: [], t: [] }],
  fin: [STAND([100,8,104,30,108,52]), STAND([100,8,110,-14,118,-36])],
  "pompes-inclinees": [
    { h: [148, 54], n: [[134,62,148,54],[34,121,84,92,134,62],[134,62,134,85,134,108]], f: [], t: [[116,108,152,108],[148,108,148,121],[120,108,120,121]] },
    { h: [152, 80], n: [[138,88,152,80],[34,121,86,105,138,88],[138,88,120,96,134,108]], f: [], t: [[116,108,152,108],[148,108,148,121],[120,108,120,121]] }
  ],
  gainage: [
    { h: [154, 92], n: [[138,99,154,92],[24,118,81,108,138,99],[138,99,138,121,162,121]], f: [], t: [] },
    { h: [154, 91], n: [[138,98,154,91],[24,118,81,106,138,98],[138,98,138,121,162,121]], f: [], t: [] }
  ],
  "gainage-lateral": [
    { h: [146, 70], n: [[132,80,146,70],[30,119,81,100,132,80],[132,80,130,104,150,121],[132,80,112,90,94,96]], f: [], t: [] },
    { h: [146, 70], n: [[132,80,146,70],[30,119,81,100,132,80],[132,80,130,104,150,121],[132,80,134,56,136,32]], f: [], t: [] }
  ]
};
/* Poses du Flow C */
const BEAST0 = { h: [138, 62], n: [[124,72,138,62],[80,72,102,72,124,72],[124,72,124,96,124,121],[80,72,84,108,50,121]], f: [[116,74,116,98,116,121],[88,72,92,108,58,121]], t: [] };
Object.assign(NEW, {
  "marche-genoux": [
    { h: [100,-9], n: [[100,5,100,-9],[100,49,100,27,100,5],[100,49,136,49,136,85],[100,8,90,30,84,50]], f: [[100,121,100,85,100,49],[100,8,112,28,124,40]], t: [] },
    { h: [100,-9], n: [[100,5,100,-9],[100,49,100,27,100,5],[100,121,100,85,100,49],[100,8,112,28,124,40]], f: [[100,49,136,49,136,85],[100,8,90,30,84,50]], t: [] }
  ],
  curlup: [
    { h: [30,110], n: [[48,116,30,110],[48,116,70,116,92,116],[92,116,114,88,134,119],[48,116,62,121,80,119]], f: [[92,116,128,118,164,120]], t: [] },
    { h: [34,99], n: [[50,108,34,99],[50,108,71,114,92,116],[92,116,114,88,134,119],[50,108,62,119,80,119]], f: [[92,116,128,118,164,120]], t: [] }
  ],
  "beast-touches": [
    BEAST0,
    { h: [138, 62], n: [[124,72,138,62],[80,72,102,72,124,72],[124,72,138,88,124,76],[80,72,84,108,50,121]], f: [[116,74,116,98,116,121],[88,72,92,108,58,121]], t: [] }
  ],
  grimpeur: [
    { h: [152,65], n: [[136,75,152,65],[81,97,108,86,136,75],[136,75,136,98,136,121],[81,97,53,108,26,119]], f: [[81,97,110,104,94,121]], t: [] },
    { h: [152,65], n: [[136,75,152,65],[81,97,108,86,136,75],[136,75,136,98,136,121],[81,97,110,104,94,121]], f: [[81,97,53,108,26,119]], t: [] }
  ],
  "etirement-lateral": [
    { h: [100,-9], n: [[100,5,100,-9],[100,49,100,27,100,5],[100,49,88,85,82,121],[100,49,112,85,118,121],[92,8,88,-14,86,-36],[108,8,110,30,112,52]], f: [], t: [] },
    { h: [121,-4], n: [[111,7,121,-4],[100,49,104,28,111,7],[100,49,88,85,82,121],[100,49,112,85,118,121],[104,8,110,-16,130,-30],[116,10,120,31,122,53]], f: [], t: [] }
  ],
  pallof: [
    { h: [100,-9], n: [[100,5,100,-9],[100,49,100,27,100,5],[100,121,102,85,100,49],[100,8,114,18,108,26]], f: [], t: [[108,26,22,28]] },
    { h: [100,-9], n: [[100,5,100,-9],[100,49,100,27,100,5],[100,121,102,85,100,49],[100,8,123,10,146,12]], f: [], t: [[146,12,22,28]] }
  ]
});
const frames = id => NEW[id] || POSES[id];

/* Fiches. Durées en secondes. Zones : tronc, dos, épaules, pectoraux, bras, poignets, hanches, fessiers, cuisses, ischios. */
const M = [
  { id: "depart", nom: "Départ", categorie: "special", duree: 10, description: "Compte à rebours avant le premier exercice.", consigne: "Installe-toi sur le tapis et prends la première position.", vigilance: "", zones: [], dos: true, materiel: ["tapis"], youtube: "" },
  { id: "fin", nom: "Fin", categorie: "special", duree: 5, description: "Fin de la séance.", consigne: "Bravo. Respire calmement et bois un verre d'eau.", vigilance: "", zones: [], dos: true, materiel: [], youtube: "" },
  { id: "repos", nom: "Repos", categorie: "repos", duree: 20, description: "Récupération entre deux exercices.", consigne: "Respire lentement par le nez, relâche les épaules.", vigilance: "", zones: [], dos: true, materiel: [], youtube: "" },

  { id: "chatvache", nom: "Chat-vache", categorie: "echauffement", duree: 60, description: "Mobilise toute la colonne en douceur, en alternant dos rond et dos creusé.", consigne: "À quatre pattes : dos rond en expirant, dos légèrement creusé en inspirant. 10 répétitions lentes.", vigilance: "Amplitude douce : ne force pas la cambrure en bas du dos.", zones: ["dos", "tronc"], dos: true, materiel: ["tapis"], youtube: yt("chat vache exercice dos tutoriel") },
  { id: "birddog", nom: "Bird-dog", categorie: "echauffement", duree: 60, description: "Gainage dynamique qui apprend au tronc à stabiliser la colonne pendant que les membres bougent.", consigne: "À quatre pattes, tends un bras et la jambe opposée, tiens 2 secondes, puis change de côté.", vigilance: "Le bassin ne tourne pas et le dos ne se creuse pas. Mieux vaut lever moins haut.", zones: ["tronc", "dos", "fessiers"], dos: true, materiel: ["tapis"], youtube: yt("bird dog exercice tutoriel") },
  { id: "pont", nom: "Pont fessier", categorie: "echauffement", duree: 60, description: "Réveille les fessiers, qui soulagent le bas du dos.", consigne: "Sur le dos, genoux fléchis. Monte le bassin en serrant les fessiers, redescends lentement.", vigilance: "En haut, ne creuse pas le bas du dos : c'est le fessier qui pousse.", zones: ["fessiers", "ischios"], dos: true, materiel: ["tapis"], youtube: yt("pont fessier exercice tutoriel") },
  { id: "poignets", nom: "Mobilité des poignets", categorie: "echauffement", duree: 60, description: "Prépare les poignets aux appuis au sol de l'Animal Flow.", consigne: "À quatre pattes, mains à plat. Balance-toi doucement d'avant en arrière.", vigilance: "Reste dans une zone sans douleur.", zones: ["poignets"], dos: true, materiel: ["tapis"], youtube: yt("mobilité poignets échauffement") },
  { id: "hanches", nom: "Cercles de hanches", categorie: "echauffement", duree: 60, description: "Mobilise les hanches à quatre pattes.", consigne: "À quatre pattes, dessine de petits cercles avec le bassin, 5 dans chaque sens.", vigilance: "Petits cercles, sans forcer la rotation du bas du dos.", zones: ["hanches", "dos"], dos: true, materiel: ["tapis"], youtube: yt("cercles de hanches quatre pattes mobilité") },

  { id: "pompes", nom: "Pompes", categorie: "force", duree: 40, description: "Renforce pectoraux, épaules et bras, avec un gros travail de gainage.", consigne: "Corps gainé. Descends la poitrine vers le sol, repousse. Garde 2 répétitions en réserve.", vigilance: "Ne laisse pas tomber le bassin : le corps reste droit comme une planche.", zones: ["pectoraux", "bras", "épaules", "tronc"], dos: true, materiel: ["tapis"], youtube: yt("pompes technique débutant"), facile: "pompes-inclinees" },
  { id: "pompes-inclinees", nom: "Pompes inclinées", categorie: "force", duree: 40, description: "Version plus facile des pompes, mains surélevées.", consigne: "Mains sur un meuble stable ou un plan de travail. Descends la poitrine vers le bord, repousse.", vigilance: "Vérifie que le support ne glisse pas. Corps gainé.", zones: ["pectoraux", "bras", "épaules"], dos: true, materiel: ["meuble"], youtube: yt("pompes inclinées débutant"), difficile: "pompes" },
  { id: "squats", nom: "Squats", categorie: "force", duree: 40, description: "Le mouvement de base pour les cuisses et les fessiers.", consigne: "Pieds largeur d'épaules. Descends comme pour t'asseoir, jusqu'aux cuisses parallèles au sol.", vigilance: "Dos droit, genoux dans l'axe des pieds. Réduis la profondeur si le bas du dos s'arrondit.", zones: ["cuisses", "fessiers"], dos: true, materiel: [], youtube: yt("squat poids du corps technique débutant") },
  { id: "rowing", nom: "Rowing élastique", categorie: "force", duree: 40, description: "Renforce le haut du dos et corrige la posture.", consigne: "Assis, jambes tendues, élastique autour des pieds. Tire les coudes vers l'arrière, omoplates serrées.", vigilance: "Dos droit, sans te pencher en arrière pour tirer.", zones: ["dos", "bras", "épaules"], dos: true, materiel: ["tapis", "elastique"], youtube: yt("rowing assis élastique exercice") },
  { id: "deadbug", nom: "Dead bug", categorie: "force", duree: 40, description: "Gainage sur le dos qui renforce les abdominaux profonds sans flexion de la colonne.", consigne: "Sur le dos, bras et genoux en l'air. Descends lentement un bras et la jambe opposée, puis change.", vigilance: "Le bas du dos reste collé au sol. S'il décolle, réduis l'amplitude.", zones: ["tronc"], dos: true, materiel: ["tapis"], youtube: yt("dead bug exercice tutoriel") },
  { id: "gainage", nom: "Gainage planche", categorie: "force", duree: 30, description: "Gainage statique sur les avant-bras.", consigne: "Avant-bras au sol, coudes sous les épaules, corps droit des talons à la tête. Respire.", vigilance: "Bassin aligné, ni trop haut ni affaissé. Commence par 15 à 20 secondes.", zones: ["tronc", "épaules"], dos: true, materiel: ["tapis"], youtube: yt("gainage planche technique débutant") },
  { id: "gainage-lateral", nom: "Gainage latéral", categorie: "force", duree: 20, cotes: true, description: "Renforce les muscles latéraux du tronc, très utiles pour protéger le bas du dos.", consigne: "Sur le côté, avant-bras au sol sous l'épaule. Monte le bassin, corps aligné.", vigilance: "Variante facile : genoux fléchis au sol.", zones: ["tronc", "hanches"], dos: true, materiel: ["tapis"], youtube: yt("gainage latéral débutant genoux") },

  { id: "ape", nom: "Ape", categorie: "flow", duree: 20, description: "Position Animal Flow du singe : accroupi profond, mains au sol.", consigne: "Accroupi, mains au sol entre les pieds, dos le plus droit possible.", vigilance: "Descends seulement là où c'est confortable pour le dos.", zones: ["hanches", "cuisses", "épaules"], dos: true, materiel: ["tapis"], youtube: yt("animal flow ape tutorial") },
  { id: "beast", nom: "Beast", categorie: "flow", duree: 20, description: "Position de base de l'Animal Flow : la bête.", consigne: "À quatre pattes, genoux décollés de quelques centimètres, dos plat.", vigilance: "Dos plat, genoux juste au-dessus du sol.", zones: ["épaules", "tronc", "cuisses"], dos: true, materiel: ["tapis"], youtube: yt("animal flow beast tutorial") },
  { id: "crab", nom: "Crab reach", categorie: "flow", duree: 25, cotes: true, description: "Ouvre l'avant du corps et les épaules, depuis la position du crabe.", consigne: "Assis, mains derrière toi, bassin levé. Un bras passe au-dessus de la tête en tournant le buste.", vigilance: "Rotation modérée : ne force pas la torsion du bas du dos.", zones: ["épaules", "hanches", "tronc"], dos: true, materiel: ["tapis"], youtube: yt("animal flow crab reach tutorial") },

  { id: "marche-genoux", nom: "Marche genoux hauts", categorie: "echauffement", duree: 60, description: "Cardio doux, sans impact : fait monter le cœur et réveille les hanches.", consigne: "Debout, monte un genou à hauteur de hanche puis l'autre, bras opposés qui balancent. Rythme soutenu, sans sauter.", vigilance: "Buste droit. On marche sur place, on ne saute pas.", zones: ["cuisses", "hanches", "tronc"], dos: true, materiel: [], youtube: yt("marche sur place genoux hauts sans impact") },
  { id: "curlup", nom: "Curl-up McGill", categorie: "force", duree: 40, description: "La version du crunch conçue par Stuart McGill : elle travaille les grands droits, les « tablettes », sans enrouler le bas du dos.", consigne: "Sur le dos, une jambe pliée, l'autre tendue, mains sous le creux des reins. Décolle tête et épaules de quelques centimètres d'un bloc, tiens 8 à 10 secondes, redescends. Change de jambe à mi-temps.", vigilance: "Ne rentre pas le menton et n'écrase pas le dos sur les mains : le mouvement est minuscule.", zones: ["tronc"], dos: true, materiel: ["tapis"], youtube: yt("McGill curl up modifié tutoriel") },
  { id: "beast-touches", nom: "Beast · touches d'épaule", categorie: "force", duree: 40, description: "Gainage anti-rotation en position Animal Flow : les obliques empêchent le bassin de tourner.", consigne: "En position Beast, genoux décollés. Touche l'épaule opposée avec une main, repose-la, change. Lentement.", vigilance: "Le bassin ne tangue pas : écarte un peu les pieds si besoin.", zones: ["tronc", "épaules"], dos: true, materiel: ["tapis"], youtube: yt("bear plank shoulder taps tutorial"), facile: "beast", difficile: "pallof" },
  { id: "grimpeur", nom: "Grimpeur lent", categorie: "force", duree: 40, description: "Gainage dynamique qui fait aussi monter le cœur : utile pour dépenser plus pendant la séance.", consigne: "En planche haute, mains sous les épaules. Amène un genou vers la poitrine, repose, change. Rythme régulier, sans sauter.", vigilance: "Bassin à hauteur des épaules, dos plat. Ralentis si le bas du dos se creuse.", zones: ["tronc", "épaules", "cuisses"], dos: true, materiel: ["tapis"], youtube: yt("mountain climber lent débutant"), facile: "gainage" },
  { id: "pallof", nom: "Pallof press", categorie: "force", duree: 30, cotes: true, description: "L'exercice de référence pour les obliques en anti-rotation, avec ton élastique.", consigne: "Élastique attaché sur le côté à hauteur de poitrine. Debout de profil, tiens-le contre la poitrine, tends les bras devant toi sans laisser le buste tourner, tiens 2 secondes, reviens.", vigilance: "Bassin et épaules restent face à l'avant. Genoux légèrement fléchis.", zones: ["tronc"], dos: true, materiel: ["elastique"], youtube: yt("pallof press élastique tutoriel"), facile: "beast-touches" },
  { id: "etirement-lateral", nom: "Étirement latéral debout", categorie: "etirement", duree: 20, cotes: true, description: "Étire les flancs, les obliques et le carré des lombes.", consigne: "Debout, pieds écartés. Lève un bras et penche-toi doucement du côté opposé, sans tourner le buste. Respire.", vigilance: "Amplitude douce, sans rebond. Stoppe si ça tire dans le bas du dos ou dans la jambe.", zones: ["tronc", "dos"], dos: true, materiel: [], youtube: yt("étirement latéral debout obliques") },
  { id: "fente", nom: "Fente basse", categorie: "etirement", duree: 45, cotes: true, description: "Étire l'avant de la hanche, souvent raide quand on est assis longtemps.", consigne: "Un genou au sol. Avance doucement le bassin pour étirer l'avant de la hanche.", vigilance: "Buste droit, sans cambrer le bas du dos.", zones: ["hanches"], dos: true, materiel: ["tapis"], youtube: yt("étirement fente basse fléchisseurs de hanche") },
  { id: "ischios", nom: "Ischios sur le dos", categorie: "etirement", duree: 45, cotes: true, description: "Étire l'arrière des cuisses sans charger le dos. C'est l'étirement clé pour toucher tes pieds.", consigne: "Sur le dos, serviette sous le pied, tends la jambe vers le plafond.", vigilance: "Le bas du dos reste au sol. Stoppe si ça tire jusque dans le pied.", zones: ["ischios"], dos: true, materiel: ["tapis"], youtube: yt("étirement ischio jambiers allongé serviette") },
  { id: "enfant", nom: "Posture de l'enfant", categorie: "etirement", duree: 45, description: "Relâche le dos et les hanches en fin de séance.", consigne: "Assis sur les talons, bras allongés devant toi, front vers le sol. Respire lentement.", vigilance: "Écarte les genoux si le ventre gêne.", zones: ["dos", "hanches"], dos: true, materiel: ["tapis"], youtube: yt("posture de l'enfant yoga tutoriel") }
];

const files = [];
for (const m of M) {
  const fr = frames(m.id);
  if (!fr) throw new Error("pas de pose pour " + m.id);
  const obj = {
    id: m.id, nom: m.nom, categorie: m.categorie, duree: m.duree, cotes: !!m.cotes,
    description: m.description, consigne: m.consigne, vigilance: m.vigilance,
    zones: m.zones, niveau: m.niveau || "debutant", materiel: m.materiel, dos: m.dos,
    youtube: m.youtube,
    variantes: { facile: m.facile || null, difficile: m.difficile || null },
    animation: { type: "baton", images: fr }
  };
  const name = m.id + ".json";
  fs.writeFileSync(path.join(OUT, "bibliotheque", name), JSON.stringify(obj, null, 2) + "\n");
  files.push(name);
}
const index = { version: 1, maj: "2026-11-12", mouvements: files };
fs.writeFileSync(path.join(OUT, "bibliotheque", "index.json"), JSON.stringify(index, null, 2) + "\n");

/* Routines de base */
const it = (mv, dur, extra) => Object.assign({ mv, dur }, extra || {});
const stretches = [it("fente", 45), it("ischios", 45), it("enfant", 45)];
const R = [
  { id: "routine-a", nom: "Routine A · Force", fav: true, jours: [1, 3, 5], depart: 10, fin: 5,
    items: [it("chatvache", 60), it("birddog", 60), it("pont", 60),
      { bloc: true, rounds: 2, items: [it("pompes", 40), it("repos", 20), it("squats", 40), it("repos", 20), it("rowing", 40), it("repos", 20), it("deadbug", 40), it("repos", 20)] },
      ...stretches] },
  { id: "routine-b", nom: "Routine B · Animal Flow", fav: true, jours: [2, 4], depart: 10, fin: 5,
    items: [it("poignets", 60), it("chatvache", 60), it("hanches", 60),
      { bloc: true, rounds: 4, items: [it("ape", 20), it("beast", 20), it("crab", 25), it("beast", 20), it("repos", 5)] },
      ...stretches] }
];
R.push({ id: "routine-c", nom: "Routine C · Ventre et obliques", fav: true, jours: [], depart: 10, fin: 5,
  items: [it("chatvache", 45), it("birddog", 45), it("marche-genoux", 60),
    { bloc: true, rounds: 3, items: [it("curlup", 40), it("repos", 15), it("gainage-lateral", 20), it("repos", 15), it("pallof", 20), it("repos", 15), it("grimpeur", 40), it("repos", 15)] },
    it("enfant", 45), it("etirement-lateral", 20)] });
const routines = { version: 1, routines: R };
fs.writeFileSync(path.join(OUT, "routines", "routines-de-base.json"), JSON.stringify(routines, null, 2) + "\n");

/* Bundle de secours, si la page ne peut pas lire les fichiers JSON. */
const bundle = { index, mouvements: M.map(m => JSON.parse(fs.readFileSync(path.join(OUT, "bibliotheque", m.id + ".json"), "utf8"))), routines };
fs.writeFileSync(path.join(OUT, "bibliotheque", "bundle.js"),
  "/* Copie de secours générée à partir des fichiers JSON de ce dossier. Ne pas modifier à la main. */\nwindow.BIBLIO_BUNDLE = " + JSON.stringify(bundle) + ";\n");
console.log("mouvements:", files.length);
