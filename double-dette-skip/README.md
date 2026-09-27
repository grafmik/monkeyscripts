# Double Dette : sauter la fin du niveau

Deux raccourcis clavier pour [Double Dette](https://double-dette.vercel.app/),
actifs seulement pendant un niveau :

| Touche | Effet |
| --- | --- |
| `,` | **Quasi-fin** du niveau : ennemis et arènes réglés, le joueur est posé juste avant la fin réelle. Il reste quelques pas vers la droite, ou un coup à porter au boss final (laissé à 1 PV). Sur un niveau bonus, il reste 3 s au chrono. |
| `,` (2ᵉ appui) | Niveau suivant |
| `.` | Niveau suivant, directement |

« Niveau suivant » passe par la vraie fin du jeu (score, trophées, déblocage),
puis valide tout seul l'écran de résultats. L'intro du niveau suivant avance
d'elle-même.

## Installation

Violentmonkey / Tampermonkey → nouveau script → coller
`double-dette-skip.user.js`, ou ouvrir directement
[le script brut](https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/double-dette-skip/double-dette-skip.user.js).

Le script doit tourner **dans la page** (`@inject-into page`, `@run-at
document-start`) : sinon il ne peut pas intercepter le chargement du jeu.

## Comment il accède au jeu

Le jeu tient dans un `<canvas>` et n'expose rien d'exploitable sur `window` :
l'état du niveau vit dans des closures de modules. Le bundle contient pourtant,
pour ses propres tests, un objet `debug:{world, game}` créé à chaque niveau.

Au démarrage, le script empêche le module d'entrée (`assets/index-*.js`) de
s'exécuter, télécharge le bundle `app-*.js`, y remplace cet objet par
`window.__ddSim = {world, game}`, puis lance le jeu depuis un module `blob:`
(autorisé par la CSP du site). Les imports relatifs et `import.meta.url` sont
réécrits en URL absolues pour que les workers et les autres modules se
chargent normalement.

Si l'ancre `debug:{world,game}` disparaît dans une future version du jeu, le
script le signale en console et relance le jeu d'origine : le jeu marche,
seuls les raccourcis sont inopérants.

## À savoir

- Une des dispositions clavier du jeu met l'attaque sur `.` : pendant un
  niveau, le script garde `,` et `.` pour lui.
- Les boss des niveaux 3, 5, 6 et 7 ne sont pas encore dans la version en
  ligne du jeu : il termine ces combats instantanément. La quasi-fin y pose le
  joueur juste avant le déclencheur ; un pas en avant finit le niveau.
- Testé le 2026-09-27 sur les niveaux 1 à 4 et le bonus « Prime à la casse ».
