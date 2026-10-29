# TROP : pause forcée à la Gaspar Noé

X est fait pour qu'on y reste. Ce script impose un temps d'arrêt **quand on y a
passé trop de temps** (20 minutes cumulées, défiler les consomme deux fois plus
vite, et quitter l'onglet les rend une par une), en même temps sur tous les
onglets X : la page
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
- les vidéos : celle en cours de lecture est stoppée dès le déclenchement, et
  celles que X relance toutes seules sont remises en pause.

Restent hors de portée d'une page web, par conception du navigateur : ⌘W,
⌘T, ⌘L, ⌘Q, la barre d'onglets. Fermer l'onglet reste donc possible, et c'est
très bien comme ça.

## Quand ça se déclenche

Pas à l'arrivée : seulement quand on a **trop** utilisé X récemment. C'est une
**jauge de 20 minutes** qui se remplit quand on regarde et se **vide quand on
part** :

- chaque seconde passée **à regarder** X (onglet au premier plan **et** fenêtre
  active) la remplit d'**une** seconde ;
- chaque seconde passée **à défiler** la remplit de **deux** : défiler fait monter
  la jauge deux fois plus vite. En défilant sans arrêt, elle se remplit en
  ~10 min ;
- dès qu'on **quitte X**, elle se **vide d'une seconde par seconde**, le surcoût
  du défilement (rouge) d'abord, jusqu'à revenir **pleinement à zéro**. Autant de
  temps passé ailleurs, autant de temps rendu. « Quitter X », c'est changer
  d'onglet, réduire la fenêtre, **changer de bureau (Space)** ou passer sur une
  autre appli : tout ce qui fait que la fenêtre n'est plus au premier plan
  (`visibilityState` *et* `document.hasFocus()`).

Jauge pleine → TROP, et **tout repart de zéro**.

Le solde avance seconde par seconde (lissé, sans à-coups). Un défilement, c'est
molette, tactile, ou un défilement juste après une touche (espace, j/k, flèches)
ou un clic (ascenseur) ; les repositionnements faits par X lui-même ne comptent
pas, et les secondes de la séquence TROP ne comptent ni dans un sens ni dans
l'autre (solde gelé).

Réglages : `BUDGET_MIN`, `COUT_DEFILEMENT`.

### Partage entre onglets

Le solde et l'heure de la dernière séquence sont partagés entre les onglets du
site (`localStorage`, clés `trop:base`, `trop:surcout`, `trop:maj`, `trop:vu`,
`trop:defileVu` et `trop:debut`) :

- une **seule horloge** (`trop:maj`) fait avancer le solde : le premier onglet
  qui s'éveille consomme le temps écoulé puis repousse l'horloge, les autres
  voient alors un delta nul. Le temps n'est donc compté qu'une fois, quel que
  soit le nombre d'onglets. La jauge ne se vide que lorsque **plus aucun** onglet
  du site n'est au premier plan ;
- quand la jauge est pleine, l'onglet affiché lance la séquence, remet le solde
  à zéro, et tous les autres onglets X démarrent au même instant, sur la même
  horloge : changer d'onglet n'y échappe pas ;
- un onglet ouvert pendant une séquence la rejoint là où elle en est.

## Le panneau en haut à droite

```
TROP dans 4:25                  [×2]
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬────────────
15:30 / 20:00       −5:20 en défilant
```

Mis à jour chaque seconde, dans tous les onglets :

- **le titre** : le temps restant si l'on continue à regarder sans défiler.
  Il descend d'une seconde par seconde, et passe **au rouge dans la dernière
  minute** ;
- **le voyant ×2** s'allume en rouge tant qu'on défile : le compte à rebours
  perd alors 2 s par seconde ;
- **la barre** se remplit du temps passé à regarder (blanc) et de ce que le
  défilement a coûté en plus (rouge) ;
- dessous : le budget consommé, et ce qui a été perdu à défiler.

Quitter l'onglet fait **remonter** le compte d'une seconde par seconde (et
rétrécir la barre) jusqu'à son plein.

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
- jauge (v4.2 : logique simulée hors navigateur, horloge et visibilité
  pilotées) : 300 s à regarder remplissent ~300 s ; 60 s à défiler en ajoutent
  120 (60 + 60 de surcoût, ×2) ; en quittant l'onglet, la jauge se vide d'une
  seconde par seconde (le surcoût d'abord) et revient à 0 ; deux « onglets » qui
  avancent la même seconde ne la comptent qu'une fois. Le déroulé de la séquence
  TROP lui-même n'a pas été rejoué en v4.2 (inchangé depuis v4) ;
- bris lettre par lettre (v4) : à 21,6 s le T tombe, à 24,5 s « ROP » est
  intact (pause), à 39,6 s le P tombe ; page rendue à 44,8 s ;
- (v3) captures à chaque étape (entrée, battements, fissures, chute, fondu), en
  1440 × 900 et en portrait 390 × 844 : le mot tient dans la largeur.

Pas pu être vérifié ici : le rendu avec la vraie Futura (absente de Linux ; le
mécanisme `local()` a été validé avec une autre police installée) et la
cohabitation avec Minimal Twitter sur le vrai x.com.
