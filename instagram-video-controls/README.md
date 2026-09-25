# Instagram : barre de contrôle vidéo

Instagram ne donne aucun contrôle sur ses vidéos : impossible de revenir en
arrière, de sauter un passage ou de mettre en pause proprement. Ce script ajoute
une barre en bas de la vidéo survolée, avec **progression cliquable**,
**lecture/pause** et **temps écoulé**. Fonctionne sur le feed comme sur les
reels.

## Installation

Violentmonkey / Tampermonkey → nouveau script → coller
`instagram-video-controls.user.js`. Actif sur `https://www.instagram.com/*`.

## Utilisation

Survole une vidéo : la barre apparaît en bas de celle-ci. Clique ou fais glisser
sur la piste pour te déplacer dans la vidéo, clique sur ▶ / ❚❚ pour la
lecture. La barre contrôle toujours la vidéo que tu survoles ; sans survol, elle
suit la vidéo la plus visible à l'écran.

### Raccourcis clavier

| Touche | Effet |
| --- | --- |
| → | avance de 5 s |
| ← | recule de 5 s |
| Espace | lecture / pause |

Ils fonctionnent sans survol (la barre s'affiche brièvement pour montrer où on
en est) et **remplacent ceux d'Instagram**, mesurés avant/après :

- sur `/reels/`, l'espace faisait passer au reel suivant — il met maintenant en
  pause, et l'URL du reel ne bouge plus ;
- dans le feed, l'espace faisait défiler la page d'un écran — le défilement ne
  se produit plus ;
- les flèches n'étaient utilisées ni par Instagram ni par le navigateur sur ces
  deux pages : elles sont donc gagnées sans rien perdre.

Quand le curseur est dans un champ de saisie (recherche, commentaire), les
touches sont laissées à Instagram : vérifié en tapant « ab c » dans la recherche,
l'espace arrive bien dans le champ.

## Choix d'implémentation (relevés sur le DOM réel)

- **Une seule barre, en `position: fixed` sur `<body>`**, recalée à chaque frame
  sur la vidéo ciblée. Une barre posée dans le conteneur de la vidéo passait
  *derrière* les overlays d'Instagram (auteur, légende, boutons) : ses ancêtres
  portent `z-index: 0`, ce qui crée un contexte d'empilement et plafonne tout
  `z-index` interne, même 9999.
- **Survol détecté en JavaScript**, pas en CSS `:hover` : les overlays
  d'Instagram ne sont pas des descendants du conteneur de la vidéo, donc
  survoler la vidéo ne déclenchait jamais le `:hover` attendu.
- **`stopPropagation` en phase de remontée uniquement.** En phase de capture sur
  la barre, il privait les boutons de la barre de leur propre clic — le bouton
  lecture/pause ne faisait rien.
- La barre est **bornée au bas du viewport** : dans le feed, une vidéo dépasse
  souvent sous le pli et la barre partait hors écran.
- En portrait (reels), un `padding-right` de 46 px évite que le compteur passe
  sous le bouton son d'Instagram.
- Les raccourcis sont interceptés **en phase de capture sur `window`**, avec
  `preventDefault()` et `stopImmediatePropagation()` : c'est ce qui prive
  Instagram de la touche. Le `keyup` est neutralisé aussi, certains gestionnaires
  agissant à la remontée de touche.
- La barre est `pointer-events: none`, et seuls le bouton et la piste reprennent
  les clics (`pointer-events: auto`). Sans cela, son fond — large comme la vidéo
  — avalait les clics destinés au **bouton son d'Instagram**, placé dessous en
  bas à droite. Mesuré : avant, `elementFromPoint` sur le bouton son renvoyait la
  barre et le bouton recevait 0 clic ; après, il les reçoit normalement.
- Un saut de +5 s sur une vidéo courte tombait pile sur la fin et la faisait
  boucler : la cible est bornée à `durée - 0,15 s`.

## Vérifié

Testé sur le feed et sur `/reels/` en pilotant Chrome : barre bien au premier
plan (`elementFromPoint` renvoie la piste, pas un overlay Instagram), clic à 60 %
de la piste → saut à 60 % de la durée, clic sur ▶ / ❚❚ → la lecture bascule.
