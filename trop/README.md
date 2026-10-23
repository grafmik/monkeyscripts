# TROP : pause forcée à la Gaspar Noé

X est fait pour qu'on y reste. Ce script impose un temps d'arrêt **quand on y a
passé trop de temps** (7 minutes de défilement actif sur les 10 dernières, ou
20 minutes passées sur X dans la dernière heure), en
même temps sur tous les onglets X : la page est **bloquée 20
secondes** et le mot
**TROP** envahit l'écran, en blanc sur noir, sur toute la largeur. Il bat comme
un cœur qui s'emballe, se fissure, tombe en morceaux, puis la page réapparaît
et on reprend la main.

## Installation

Violentmonkey / Tampermonkey → nouveau script → coller `trop.user.js`, ou
ouvrir directement
[le script brut](https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/trop/trop.user.js).
Actif sur `x.com`, `twitter.com` et `mobile.x.com`.

## Déroulé (20 s)

| Temps | Ce qui se passe |
| --- | --- |
| 0 → 0,9 s | Les lettres surgissent du fond l'une après l'autre, avec un léger rebond |
| 0,9 → 10 s | Le mot bat comme un cœur (« poum-pa »), de 58 à 104 battements/min. Il tremble à 24 images/s comme une caméra à l'épaule, avance lentement vers le spectateur, et un contour fantôme flou jaillit à chaque battement |
| 10 → 12,4 s | Les lettres se fendent une à une (T, R, O, P) : choc, fissures noires qui partent du point d'impact, morceaux qui se disjoignent |
| 12,4 → 16 s | Les éclats se détachent et tombent en tournoyant en 3D |
| 16,2 → 20 s | Le noir s'efface, la page apparaît en fondu |
| 20 s | Clavier, souris et défilement sont rendus |

Tout se règle dans les constantes en tête de script (`MOT`, `T_FISSURE`,
`T_CHUTE`, `T_FIN`, `BPM_DEBUT`…).

## La fonte

Gaspar Noé utilise la **Futura Extra Bold Condensed** : affiches de *Seul
contre tous*, génériques d'*Enter the Void* et de *Climax*.
Le script la prend dans les polices installées : **macOS la fournit
d'origine** (Futura Condensed ExtraBold). Sur une machine qui n'a pas de
Futura, il se rabat sur Impact.

La police n'est pas téléchargée : x.com interdit les polices externes (CSP
`font-src`), alors qu'une police locale (`local()`) ne passe pas par le réseau.

## Ce qui est bloqué pendant 20 s

- clavier (y compris les raccourcis de X et du navigateur que la page peut
  intercepter : espace, flèches, F5…), souris, molette, tactile, clic droit,
  sélection ;
- le défilement de la page ;
- le focus : le `<body>` est rendu `inert`, rien ne peut recevoir de saisie ;
- les vidéos : celles que X lance toutes seules sont remises en pause.

Restent hors de portée d'une page web, par conception du navigateur : ⌘W,
⌘T, ⌘L, ⌘Q, la barre d'onglets. Fermer l'onglet reste donc possible, et c'est
très bien comme ça.

## Quand ça se déclenche

Pas à l'arrivée : seulement quand on a **trop** utilisé X récemment. Deux
seuils, le premier atteint déclenche :

- **défilement** : **7 minutes actives sur les 10 dernières** (détaillé
  ci-dessous) ;
- **présence** : **20 minutes d'onglet X affiché sur la dernière heure
  glissante**, qu'on défile ou non.

Après un TROP, **les deux compteurs repartent de zéro**.

### Défilement

Une minute est **active** si, pendant cette minute, l'onglet X est affiché et X
a **chargé de nouveaux posts dans les 30 s suivant un geste** (défilement, clic,
touche, tactile). Les rafraîchissements automatiques de X en arrière-plan ne
comptent pas, et une minute ne compte qu'une fois quel que soit le nombre
d'onglets ou de requêtes : on mesure du temps passé, pas du volume.

Les chargements de posts sont repérés par leur URL (requêtes GraphQL de X dont
l'opération se termine par `Timeline`, ou `TweetDetail`, `UserTweets`…) grâce à
un `PerformanceObserver`, qui **observe** les requêtes sans intercepter `fetch`
ni `XHR` : rien de X n'est modifié. Le motif est dans la constante
`REQUETES_POSTS` ; si X renomme ses opérations, c'est là qu'il faut ajuster.
Sur un site sans motif, toute requête `fetch`/`XHR` compte.

### Présence

Chaque seconde, un onglet X affiché (onglet au premier plan, fenêtre non
réduite) marque la tranche de 10 s en cours. Une tranche ne compte qu'une fois,
même avec plusieurs onglets ; 20 minutes = 120 tranches dans les 60 dernières
minutes. Les secondes pendant la séquence TROP ne comptent pas. Précision :
±10 s par coup d'œil (un regard de 2 s compte une tranche entière).

Réglages : `SEUIL_PRESENCE_MIN`, `FENETRE_PRESENCE_MIN`, `TRANCHE_S`.

### Partage entre onglets

Les compteurs et l'heure de la dernière séquence sont partagés entre les onglets
du site (`localStorage`, clés `trop:minutes`, `trop:presence` et `trop:debut`) :

- quand le seuil est atteint, l'onglet affiché lance la séquence, remet le
  compteur à zéro, et tous les autres onglets X démarrent au même instant, sur
  la même horloge : changer d'onglet n'y échappe pas ;
- un onglet ouvert pendant une séquence la rejoint là où elle en est ;
- après un TROP, il faut de nouveau 7 minutes actives ou 20 minutes de
  présence pour le suivant.

Réglages : `SEUIL_MIN`, `FENETRE_MIN`, `DELAI_GESTE` en tête de script.

## Le panneau en haut à droite

```
TROP dans 3:06
défilement  ■■■□□□□     3 / 7 min
présence    ▬▬▬▬▬▬───  12 / 20 min
```

Mis à jour chaque seconde, dans tous les onglets :

- **le titre** donne le temps **minimal** avant le prochain TROP si l'on
  continue sans s'arrêter : le plus court des deux comptes à rebours. Il
  passe **au rouge dans la dernière minute** ;
- **défilement** : une case par minute active, sur les 7 du seuil ;
- **présence** : une barre qui se remplit jusqu'aux 20 minutes ;
- la jauge qui fixe le compte à rebours est en pleine lumière, l'autre est
  atténuée.

Le compte ne descend pas forcément jusqu'à zéro : une pause le fait remonter
(la minute ou les secondes ne sont pas comptées), comme les vieilles minutes
qui sortent de la fenêtre. À `0:00` côté défilement, c'est le prochain
chargement de posts qui déclenche TROP ; côté présence, il part tout seul.

Le panneau laisse passer les clics (`pointer-events: none`), vit dans un shadow
root fermé comme la scène, et disparaît pendant la séquence.

## Compatibilité avec Minimal Twitter

L'extension [Minimal Theme for Twitter](https://chromewebstore.google.com/detail/minimal-theme-for-twitter/pobhoodpcipjmedfenaigbeloiidbflp)
restyle la page de X avec sa propre CSS. Le script ne peut pas entrer en conflit
avec elle :

- la scène est un élément à part, enfant de `<html>` et hors du `<body>` que
  gèrent X et l'extension ;
- son contenu vit dans un **shadow root fermé** : aucune CSS extérieure (ni
  celle de X, ni celle de Minimal Twitter) ne l'atteint ;
- elle est placée dans le **top layer** du navigateur (API popover) : elle passe
  au-dessus de tout, quel que soit le `z-index` des autres éléments ;
- le script ne lit ni ne modifie le DOM de X.

## Sur d'autres sites

Le code n'a rien de propre à X. Pour l'appliquer ailleurs, ajouter une ligne
`@match` dans l'en-tête, par exemple :

```
// @match       https://www.instagram.com/*
// @match       https://www.reddit.com/*
```

## Choix d'implémentation

- **`@run-at document-start`** : l'écran est noir avant même que le fil
  s'affiche, pas le temps d'apercevoir le moindre tweet. Selon le gestionnaire,
  `<html>` n'existe pas encore à ce moment-là : le script attend sa création.
- **Écouteurs en capture sur `window`**, posés avant ceux du site, avec
  `preventDefault()` + `stopImmediatePropagation()`.
- **Aucun `innerHTML`** (x.com impose les Trusted Types) et styles via une
  feuille construite (`CSSStyleSheet`), que la CSP `style-src` ne bloque pas.
- **Les éclats** : chaque lettre est découpée depuis un point d'impact par des
  rayons et deux anneaux irréguliers ; chaque case devient une copie de la
  lettre découpée par `clip-path`. Les points sont partagés entre cases
  voisines, les morceaux s'emboîtent donc exactement. Les fissures sont
  tracées en noir par-dessus : invisibles sur le fond noir, elles n'apparaissent
  que sur le blanc des lettres.
- **Filet de sécurité** : si une erreur survient pendant l'animation, la page
  est aussitôt débloquée. X n'est jamais rendu inutilisable.

## Vérifié

x.com n'étant pas accessible depuis l'environnement de test, vérifié dans
Chromium sur une page qui en reproduit les contraintes (CSP stricte sur les
styles et les polices, Trusted Types, champ de saisie en `autofocus`) :

- pendant la séquence : 0 touche, 0 clic, 0 défilement parviennent à la page ;
  rien n'est saisi dans le champ ;
- fin mesurée à 20,8 s après la navigation (0,5 s de chargement + 20 s), puis
  clavier, clic et défilement refonctionnent, `<html>` et `<body>` retrouvent
  leur état d'origine ;
- mesure d'activité : rien à l'arrivée ; un chargement sans geste préalable ou
  dans un onglet caché n'est pas compté ; geste puis chargement → la minute est
  comptée ; 6 minutes actives → rien, 7 → TROP simultané sur 2 onglets et
  compteur remis à zéro ; le motif d'URL reconnaît `HomeTimeline`,
  `TweetDetail`, `UserTweetsAndReplies`… et ignore `Viewer`, `badge_count` ;
- présence (v3.2, Chrome, page locale) : un onglet affiché ajoute une tranche
  par 10 s ; à la 120e tranche, TROP part sans aucun défilement et les deux
  compteurs sont remis à zéro ; le panneau affiche les deux jauges, passe au
  rouge sous la minute et disparaît pendant la séquence ;
- captures à chaque étape (entrée, battements, fissures, chute, fondu), en
  1440 × 900 et en portrait 390 × 844 : le mot tient dans la largeur.

Pas pu être vérifié ici : le rendu avec la vraie Futura (absente de Linux ; le
mécanisme `local()` a été validé avec une autre police installée) et la
cohabitation avec Minimal Twitter sur le vrai x.com.
