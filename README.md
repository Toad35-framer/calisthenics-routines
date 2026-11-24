# Mes routines Calisthenics

Application web pour créer et suivre des routines courtes de calisthenics, d'Animal Flow et d'étirements, pensée pour le téléphone et la tablette. Chaque mouvement est animé par un petit bonhomme bâton, ou par tes propres photos et GIF.

## Fonctionnalités

- **Routines** : création, favorites, jours prévus, durée totale calculée en direct. Départ (compte à rebours) et Fin ajoutés automatiquement.
- **Éditeur** : exercices pris dans la bibliothèque, durées en minutes et secondes, repos, blocs répétés (× N tours), exercices côté gauche puis droite.
- **Lecteur de séance** : carrousel exercice précédent / en cours / suivant, barre de l'exercice et barre de la séance, pause, précédent, suivant, glisser du doigt, bips, voix, vibrations, écran maintenu allumé.
- **Bibliothèque** : 27 mouvements avec consigne, points de vigilance (dos fragile), zones travaillées, niveau, matériel, variantes et lien YouTube. Création et modification de mouvements avec photo, image ou GIF.
- **Journal** : séances terminées, calendrier, série de jours, objectif hebdomadaire.
- **Sauvegarde** : export et import en texte.

Routines fournies : A · Force (14:40), B · Animal Flow (14:35), C · Ventre et obliques (14:55).

## Utiliser l'application

- **En ligne avec GitHub Pages** : dans le dépôt, *Settings → Pages → Source : GitHub Actions*. Le workflow `.github/workflows/pages.yml` publie le dossier `app/` à chaque envoi sur `main`. L'adresse s'affiche ensuite dans *Settings → Pages*.
- **En local** : ouvre `app/index.html` dans un navigateur. La page fonctionne même ouverte seule.

Hors de claude.ai, les routines, mouvements perso, photos et le journal sont enregistrés **dans le navigateur de l'appareil** (pas de synchronisation entre appareils). Utilise *Réglages → Sauvegarde* pour les transférer.

## Structure

```
app/                      Le site publié
  index.html              Application complète (scripts intégrés)
  js/                     Code source : figure.js, store.js, player.js, app.js
  bibliotheque/           Un fichier JSON par mouvement, index.json, LISEZMOI.md
  routines/               Routines de base
outils/                   Construction
  gen-lib.js              Génère bibliotheque/ et routines/ (fiches, poses, routines)
  poses.js                Dessins du bonhomme des premiers mouvements
  index.src.html          Modèle de la page (styles et structure)
  build.py                Intègre les scripts dans app/index.html
```

## Modifier ou ajouter un mouvement

1. Ajoute ou modifie la fiche dans `outils/gen-lib.js` (tableau `M`) et, si besoin, ses deux images de bonhomme (`NEW`). Le format est décrit dans `app/bibliotheque/LISEZMOI.md`.
2. Reconstruis :

```sh
node outils/gen-lib.js
python3 outils/build.py
```

3. Envoie les changements sur GitHub : la page se met à jour toute seule.

Si tu modifies `app/js/*.js` ou `outils/index.src.html`, relance seulement `python3 outils/build.py`.

## Avertissement

Programme conçu pour un dos fragile (hernie L5-S1) : pas de crunch ni de flexion lombaire chargée. Il ne remplace pas l'avis d'un médecin ou d'un kinésithérapeute. Arrête un exercice si une douleur descend dans la jambe.
