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

Une ligne en bas à droite indique où en est le chargement (« prêt » puis elle
disparaît). Si elle reste en rouge, elle dit à quelle étape ça bloque.

## Comment il accède au jeu

Le jeu tient dans un `<canvas>` et n'expose rien d'exploitable sur `window` :
l'état du niveau vit dans des closures de modules. Le bundle contient pourtant,
pour ses propres tests, un objet `debug:{world, game}` créé à chaque niveau.

Au démarrage, le script empêche le module d'entrée (`assets/index-*.js`) de
s'exécuter, télécharge le bundle `app-*.js`, y remplace cet objet par
`window.__ddSim = {world, game}`, puis lance le jeu depuis un module `blob:`.
Les imports relatifs et `import.meta.url` sont réécrits en URL absolues pour
que les workers et les autres modules se chargent normalement.

La CSP du site n'autorise que les scripts du site et les `blob:`. Le script
tourne donc dans le monde isolé du gestionnaire (`@inject-into content`) et
n'y fait que du DOM ; tout le code qui parle au jeu est injecté dans la page
sous forme de module `blob:`.

### Particularités de Firefox (Violentmonkey)

Testé le 2026-09-27 dans Firefox 156 + Violentmonkey 2.49 :

- En mode « page », l'injection est bloquée par la CSP et Violentmonkey ne se
  rabat sur le monde isolé qu'une fois le jeu lancé : d'où `@inject-into content`.
- Un `<script>` (et un `blob:`) créé depuis le monde isolé reste attaché à
  l'extension : la page refuse de le charger ou d'y faire des `import()`. Ils
  sont créés par la page elle-même, via `wrappedJSObject`.
- Sur une page en cache, le script arrive après la lecture de la balise du jeu :
  trop tard pour la bloquer. Mais le module d'entrée ne s'est pas encore
  exécuté : le script piège `window.__dd`, que la plateforme du jeu d'origine
  pose en premier, pour faire échouer son démarrage ; seul le jeu patché tourne.
- Firefox refuse un événement audio pendant qu'une courbe est en cours (Chrome
  l'accepte). Les fondus de réverbération du jeu en enchaînent parfois deux
  très vite (début du niveau 2 après un saut) et le jeu partait sur son écran
  d'erreur. Le script neutralise ce fondu précis au lieu de planter.

Si l'ancre `debug:{world,game}` disparaît dans une future version du jeu, le
script le signale en console et relance le jeu d'origine : le jeu marche,
seuls les boutons et les raccourcis sont inopérants.

## À savoir

- `N` et `M` ne servent à rien dans le jeu, quelle que soit la disposition
  clavier choisie. Pendant un niveau, le script les garde pour lui.
- Les boss des niveaux 3, 5, 6 et 7 ne sont pas encore dans la version en
  ligne du jeu : il termine ces combats instantanément. La quasi-fin y pose le
  joueur juste avant le déclencheur ; un pas en avant finit le niveau.
- Testé le 2026-09-27 : Chrome (niveaux 1 à 4, bonus) et Firefox +
  Violentmonkey (niveaux 1 et 2, boutons, rechargements successifs).
