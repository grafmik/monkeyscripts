# Double Dette : sauter la fin du niveau

Deux boutons en haut à droite de [Double Dette](https://double-dette.vercel.app/),
sous « 2P », visibles seulement pendant un niveau (aussi au clavier : `N`, `M`) :

| Bouton | Effet |
| --- | --- |
| Quasi-fin (`N`) | **Quasi-fin** du niveau : ennemis et arènes réglés, le joueur est posé juste avant la fin réelle. Il reste quelques pas vers la droite, ou un coup à porter au boss final (laissé à 1 PV). Sur un niveau bonus, il reste 3 s au chrono. |
| Niveau suivant (`M`) | Niveau suivant, directement |

« Niveau suivant » passe par la vraie fin du jeu (score, trophées, déblocage),
puis valide tout seul l'écran de résultats. L'intro du niveau suivant avance
d'elle-même.

## Installation

Violentmonkey / Tampermonkey → nouveau script → coller
`double-dette-skip.user.js`, ou ouvrir directement
[le script brut](https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/double-dette-skip/double-dette-skip.user.js).

Le script doit démarrer à `document-start`, avant le chargement du jeu. S'il
arrive trop tard, il le signale en console et ne fait rien : recharger la page.

## Comment il accède au jeu

Le jeu tient dans un `<canvas>` et n'expose rien d'exploitable sur `window` :
l'état du niveau vit dans des closures de modules. Le bundle contient pourtant,
pour ses propres tests, un objet `debug:{world, game}` créé à chaque niveau.

Au démarrage, le script empêche le module d'entrée (`assets/index-*.js`) de
s'exécuter, télécharge le bundle `app-*.js`, y remplace cet objet par
`window.__ddSim = {world, game}`, puis lance le jeu depuis un module `blob:`.
Les imports relatifs et `import.meta.url` sont réécrits en URL absolues pour
que les workers et les autres modules se chargent normalement.

La CSP du site n'autorise que les scripts du site et les `blob:` : une
injection « page » classique d'un gestionnaire de scripts y est bloquée (cause
probable de l'échec de la v2 dans Violentmonkey). Le userscript ne fait
donc que du DOM, et injecte tout le code qui parle au jeu sous forme de module
`blob:`. Il marche ainsi dans le monde isolé du gestionnaire comme dans la page.

Si l'ancre `debug:{world,game}` disparaît dans une future version du jeu, le
script le signale en console et relance le jeu d'origine : le jeu marche,
seuls les boutons et les raccourcis sont inopérants.

## À savoir

- `N` et `M` ne servent à rien dans le jeu, quelle que soit la disposition
  clavier choisie. Pendant un niveau, le script les garde pour lui.
- Les boss des niveaux 3, 5, 6 et 7 ne sont pas encore dans la version en
  ligne du jeu : il termine ces combats instantanément. La quasi-fin y pose le
  joueur juste avant le déclencheur ; un pas en avant finit le niveau.
- Testé le 2026-09-27 sur les niveaux 1 à 4 et le bonus « Prime à la casse »,
  en injection isolée et en injection page.
