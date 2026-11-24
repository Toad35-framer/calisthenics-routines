# Bibliothèque de mouvements

Chaque mouvement est un fichier JSON de ce dossier. `index.json` liste les fichiers chargés par l'application.

## Format d'un mouvement

| Champ | Contenu |
| --- | --- |
| `id` | Identifiant unique, en minuscules, identique au nom du fichier |
| `nom` | Nom affiché |
| `categorie` | `echauffement`, `force`, `flow`, `etirement`, `repos` ou `special` (Départ, Fin) |
| `duree` | Durée par défaut, en secondes |
| `cotes` | `true` si l'exercice se fait côté gauche puis côté droit |
| `description` | À quoi sert le mouvement |
| `consigne` | Comment le faire, affichée pendant la séance |
| `vigilance` | Points de vigilance, notamment pour le dos |
| `zones` | Zones travaillées : tronc, dos, épaules, pectoraux, bras, poignets, hanches, fessiers, cuisses, ischios |
| `niveau` | `debutant`, `intermediaire` ou `avance` |
| `materiel` | `tapis`, `elastique`, `meuble` |
| `dos` | `true` si le mouvement est compatible avec un dos fragile |
| `youtube` | Lien vers des vidéos de démonstration |
| `variantes` | `facile` et `difficile` : identifiants d'autres mouvements |
| `animation` | `{"type":"baton","images":[image1, image2]}` : deux images du bonhomme, interpolées |

## Format d'une image du bonhomme

Vue de côté, personnage tourné vers la droite, sol à `y = 121`.

- `h` : centre de la tête `[x, y]`
- `n` : traits pleins (corps, membres proches), chaque trait est une liste `x1, y1, x2, y2, …`
- `f` : traits atténués (membres éloignés)
- `t` : traits fins (élastique, support)

Les deux images doivent avoir le même nombre de traits et de points.

## Mouvements personnels

Les mouvements créés dans l'application, avec leurs photos, sont enregistrés dans le compte de l'utilisateur, pas dans ce dossier. On peut les intégrer ici en les exportant depuis leur fiche.
