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

## Vérifié

Testé sur le feed et sur `/reels/` en pilotant Chrome : barre bien au premier
plan (`elementFromPoint` renvoie la piste, pas un overlay Instagram), clic à 60 %
de la piste → saut à 60 % de la durée, clic sur ▶ / ❚❚ → la lecture bascule.
