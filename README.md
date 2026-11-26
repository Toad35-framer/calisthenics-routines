# Mes routines Calisthenics

Application web pour créer et suivre des routines courtes de calisthenics, d'Animal Flow et d'étirements, pensée pour le téléphone et la tablette. Chaque mouvement est animé par un petit bonhomme bâton, ou par tes propres photos et GIF.

## Fonctionnalités

- **Routines** : création, favorites, jours prévus, durée totale calculée en direct. Départ (compte à rebours) et Fin ajoutés automatiquement.
- **Éditeur** : exercices pris dans la bibliothèque, durées en minutes et secondes, repos, blocs répétés (× N tours), exercices côté gauche puis droite.
- **Lecteur de séance** : carrousel exercice précédent / en cours / suivant, barre de l'exercice et barre de la séance, pause, précédent, suivant, glisser du doigt, bips, voix, vibrations, écran maintenu allumé.
- **Bibliothèque** : 27 mouvements avec consigne, points de vigilance (dos fragile), zones travaillées, niveau, matériel, variantes et lien YouTube. Création et modification de mouvements avec photo, image ou GIF.
- **Journal** : séances terminées, calendrier, série de jours, objectif hebdomadaire.
- **Sauvegarde** : export et import en texte.
- **Soutien** : un lien discret « ☕ Payer un coup » vers Ko-fi, et un petit message de remerciement toutes les 10 ouvertures. Le compteur d'ouvertures reste dans le navigateur : aucune donnée n'est envoyée.

Routines fournies : A · Force (14:40), B · Animal Flow (14:35), C · Ventre et obliques (14:55).

## Mettre l'application en ligne (GitHub Pages)

1. Le dépôt doit être **public** : avec un compte GitHub gratuit, GitHub Pages ne fonctionne pas sur un dépôt privé.
2. Dans le dépôt : *Settings → Pages*.
3. *Source* : **Deploy from a branch**. *Branch* : **main**, dossier **/docs**, puis *Save*.
4. Attends une à deux minutes : l'adresse du site apparaît en haut de *Settings → Pages*, de la forme `https://TON-COMPTE.github.io/calisthenics-routines/`.

Autres réglages possibles : dossier **/(root)** (le fichier `index.html` à la racine redirige vers `docs/`), ou *Source : GitHub Actions* avec le workflow `.github/workflows/pages.yml`.

Sur github.com, ouvrir `docs/index.html` dans la liste des fichiers affiche le **code**, pas l'application : utilise l'adresse GitHub Pages.

**En local** : ouvre `docs/index.html` dans un navigateur. La page fonctionne même ouverte seule.

Hors de claude.ai, les routines, mouvements perso, photos et le journal sont enregistrés **dans le navigateur de l'appareil** (pas de synchronisation entre appareils). Utilise *Réglages → Sauvegarde* pour les transférer.

## Structure

```
index.html                Redirection vers docs/
docs/                     Le site publié (dossier lu par GitHub Pages)
  index.html              Application complète (scripts intégrés)
  .nojekyll               Publie les fichiers tels quels, sans traitement Jekyll
  js/                     Code source : figure.js, store.js, player.js, app.js
  bibliotheque/           Un fichier JSON par mouvement, index.json, LISEZMOI.md
  routines/               Routines de base
outils/                   Construction
  gen-lib.js              Génère bibliotheque/ et routines/ (fiches, poses, routines)
  poses.js                Dessins du bonhomme des premiers mouvements
  index.src.html          Modèle de la page (styles et structure)
  build.py                Intègre les scripts dans docs/index.html
```

## Modifier ou ajouter un mouvement

1. Ajoute ou modifie la fiche dans `outils/gen-lib.js` (tableau `M`) et, si besoin, ses deux images de bonhomme (`NEW`). Le format est décrit dans `docs/bibliotheque/LISEZMOI.md`.
2. Reconstruis :

```sh
node outils/gen-lib.js
python3 outils/build.py
```

3. Envoie les changements sur GitHub : la page se met à jour toute seule.

Si tu modifies `docs/js/*.js` ou `outils/index.src.html`, relance seulement `python3 outils/build.py`.

## Licence

© 2026 Jean Pineau · [Creative Commons BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr) : Attribution, Pas d'utilisation commerciale, Pas de modification. Voir [LICENSE.md](LICENSE.md).

## Avertissement

Les routines privilégient des exercices doux pour le dos : pas de crunch ni de flexion lombaire chargée. Cette application ne remplace pas l'avis d'un médecin ou d'un kinésithérapeute. Arrête un exercice en cas de douleur.
