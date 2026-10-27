# TROP : pause forcée à la Gaspar Noé

X est fait pour qu'on y reste. Ce script impose un temps d'arrêt **quand on y a
passé trop de temps** (20 minutes dans la dernière heure, et défiler les
consomme trois fois plus vite), en même temps sur tous les onglets X : la page
est **bloquée 45 secondes** et le mot **TROP** envahit l'écran, en blanc sur
noir, sur toute la largeur. Il bat comme un cœur qui s'emballe, puis se brise
lettre par lettre, et la page réapparaît.

## Installation

Violentmonkey / Tampermonkey → nouveau script → coller `trop.user.js`, ou
ouvrir directement
[le script brut](https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/trop/trop.user.js).
Actif sur `x.com`, `twitter.com` et `mobile.x.com`.

## Déroulé (45 s)

| Temps | Ce qui se passe |
| --- | --- |
| 0 → 0,9 s | Les lettres surgissent du fond l'une après l'autre, avec un léger rebond |
| 0,9 → 20 s | Le mot bat comme un cœur (« poum-pa »), de 58 à 104 battements/min. Il tremble à 24 images/s comme une caméra à l'épaule, avance lentement vers le spectateur, et un contour fantôme flou jaillit à chaque battement |
| 20 s | Le T se fend : choc, fissures noires qui partent du point d'impact. 1,2 s plus tard, ses éclats tombent en tournoyant en 3D (~3 s en tout) |
| 23 → 26 s | Pause : « ROP » reste seul, il frémit |
| 26 s, 32 s, 38 s | Même chose pour R, puis O, puis P : 3 s de bris, 3 s de pause |
| 41 → 44,8 s | Le noir s'efface, la page apparaît en fondu |
| 44,8 s | Clavier, souris et défilement sont rendus |

Tout se règle dans les constantes en tête de script (`MOT`, `T_FISSURE`,
`DUREE_BRIS`, `PAUSE_LETTRES`, `T_AVANT_CHUTE`, `BPM_DEBUT`…) ; la fin et le
fondu se recalculent tout seuls.

## La fonte

Gaspar Noé utilise la **Futura Extra Bold Condensed** : affiches de *Seul
contre tous*, génériques d'*Enter the Void* et de *Climax*.
Le script la prend dans les polices installées : **macOS la fournit
d'origine** (Futura Condensed ExtraBold). Sur une machine qui n'a pas de
Futura, il se rabat sur Impact.

La police n'est pas téléchargée : x.com interdit les polices externes (CSP
`font-src`), alors qu'une police locale (`local()`) ne passe pas par le réseau.

## Ce qui est bloqué pendant la séquence

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

Pas à l'arrivée : seulement quand on a **trop** utilisé X récemment. On dispose
d'un **budget de 20 minutes sur l'heure glissante** :

- chaque seconde passée **à regarder** X (onglet au premier plan, fenêtre non
  réduite) en coûte **une** ;
- chaque seconde passée **à défiler** en coûte **trois** : défiler fait fondre
  le temps restant trois fois plus vite. En défilant sans arrêt, le budget
  tient donc ~6 min 40.

Budget épuisé → TROP, et **tout repart de zéro**.

Le temps est mesuré par tranches de 10 s : chaque seconde, un onglet X affiché
marque la tranche en cours ; molette, tactile, ou un défilement juste après
une touche (espace, j/k, flèches) ou un clic (ascenseur) la marque en plus
comme « défilée ». Une tranche ne compte qu'une fois, même avec plusieurs
onglets. Les repositionnements faits par X lui-même ne comptent pas comme du
défilement, les secondes de la séquence TROP ne comptent pas du tout.
Précision : ±10 s par coup d'œil (un regard de 2 s compte une tranche entière).

Réglages : `BUDGET_MIN`, `FENETRE_MIN`, `COUT_DEFILEMENT`, `TRANCHE_S`.

### Partage entre onglets

Les compteurs et l'heure de la dernière séquence sont partagés entre les onglets
du site (`localStorage`, clés `trop:presence`, `trop:defile` et `trop:debut`) :

- quand le budget est épuisé, l'onglet affiché lance la séquence, remet les
  compteurs à zéro, et tous les autres onglets X démarrent au même instant, sur
  la même horloge : changer d'onglet n'y échappe pas ;
- un onglet ouvert pendant une séquence la rejoint là où elle en est.

## Le panneau en haut à droite

```
TROP dans 4:25                  [×3]
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬────────────
15:30 / 20:00       −5:20 en défilant
```

Mis à jour chaque seconde, dans tous les onglets :

- **le titre** : le temps restant si l'on continue à regarder sans défiler.
  Il passe **au rouge dans la dernière minute** ;
- **le voyant ×3** s'allume en rouge tant qu'on défile : le compte à rebours
  perd alors 3 s par seconde (20 s d'un coup à chaque nouvelle tranche) ;
- **la barre** se remplit du temps passé à regarder (blanc) et de ce que le
  défilement a coûté en plus (rouge) ;
- dessous : le budget consommé, et ce qui a été perdu à défiler.

Une pause fait remonter le compte, comme les vieilles tranches qui sortent de
la fenêtre d'une heure.

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
- (v3) fin mesurée à 20,8 s après la navigation (0,5 s de chargement + 20 s), puis
  clavier, clic et défilement refonctionnent, `<html>` et `<body>` retrouvent
  leur état d'origine ;
- budget (v4, Chrome, page locale) : un onglet affiché consomme 10 s par
  tranche, un coup de molette 20 s de plus ; à 1 190 s rien ne se passe, un coup
  de molette fait passer à 1 210 s → TROP, compteurs remis à zéro ; le compte
  à rebours perd 20 s au premier défilement (4:48 → 4:25 en 3 s) ;
- bris lettre par lettre (v4) : à 21,6 s le T tombe, à 24,5 s « ROP » est
  intact (pause), à 39,6 s le P tombe ; page rendue à 44,8 s ;
- (v3) captures à chaque étape (entrée, battements, fissures, chute, fondu), en
  1440 × 900 et en portrait 390 × 844 : le mot tient dans la largeur.

Pas pu être vérifié ici : le rendu avec la vraie Futura (absente de Linux ; le
mécanisme `local()` a été validé avec une autre police installée) et la
cohabitation avec Minimal Twitter sur le vrai x.com.
