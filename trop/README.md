# TROP : pause forcée à la Gaspar Noé

X est fait pour qu'on y reste. Ce script impose un temps d'arrêt **quand on y a
passé trop de temps** (12 minutes cumulées, défiler les consomme deux fois plus
vite, et seule une heure d'affilée loin de X les rend), en même temps sur tous les onglets X : la
page est **bloquée une heure** et le mot **TROP** envahit l'écran, en blanc sur
noir, sur toute la largeur. Il bat comme un cœur qui s'emballe pendant douze
minutes, puis chaque lettre se fissure lentement, douze minutes chacune, avant
de tomber en éclats, et la page réapparaît avec ses 12 minutes rendues.

## Installation

Violentmonkey / Tampermonkey → nouveau script → coller `trop.user.js`, ou
ouvrir directement
[le script brut](https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/trop/trop.user.js).
Actif sur `x.com`, `twitter.com` et `mobile.x.com`.

## Déroulé (1 h)

`DUREE_TOTALE = ATTENTE_MIN × 60 = 3 600 s`, en cinq parts égales : ~12 min de
battements, puis **12 min par lettre** (`ECART_FISSURE = 720 s`), puis le fondu.

| Temps | Ce qui se passe |
| --- | --- |
| 0 → 0,9 s | Les lettres surgissent du fond l'une après l'autre, avec un léger rebond |
| 0,9 → ~719 s | Le mot bat comme un cœur (« poum-pa »), de 58 à 104 battements/min, sur ~12 min. Il tremble à 24 images/s comme une caméra à l'épaule, avance lentement vers le spectateur, et un contour fantôme flou jaillit à chaque battement |
| 719 s | Le T reçoit le choc : les premières fissures noires partent du point d'impact |
| 719 → 1434 s | Le T se fissure lentement, en ~80 étapes : chaque fissure (tronçon de rayon, puis arc d'anneau) s'ouvre à moitié puis se prolonge plus tard ; rares au début, de plus en plus serrées ; chacune secoue la lettre, qui se disjoint peu à peu. Le reste du mot frémit, de plus en plus nerveux |
| 1434 → 1436 s | Les éclats du T tombent en tournoyant en 3D |
| 1436 → 1439 s | Pause : « ROP » reste seul, il frémit |
| 1439 s, 2159 s, 2879 s | Même chose pour R, puis O, puis P : 12 min chacune |
| 3596 → 3600 s | Le noir s'efface, la page apparaît en fondu |
| 3600 s | Clavier, souris et défilement sont rendus, la jauge revient à zéro |

**Mêmes fissures partout** : le motif de chaque lettre (point d'impact,
fissures, ordre d'apparition, trajectoires des éclats) est tiré d'un hasard
reproductible dont la graine est l'heure de début de la séquence, commune à
tous les onglets, et le rang de la lettre. Deux onglets, ou un onglet rechargé,
montrent exactement les mêmes fissures au même moment, mises à l'échelle de
l'écran. Seul le tremblement reste tiré au hasard par chaque onglet.

Tout se règle dans les constantes en tête de script (`MOT`, `DUREE_TOTALE`,
`ATTENTE_MIN`, `PAUSE_LETTRES`, `DUREE_CHUTE`, `BPM_DEBUT`…) ; les durées par
lettre, `T_FISSURE`, la fin et le fondu se recalculent tout seuls à partir de
la durée totale.

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
**jauge de 12 minutes** qui se remplit quand on regarde, et **ne se vide pas
peu à peu quand on part** :

- chaque seconde passée **à regarder** X (onglet au premier plan **et** fenêtre
  active) la remplit d'**une** seconde ;
- chaque seconde passée **à défiler** la remplit de **deux** : défiler fait monter
  la jauge deux fois plus vite. En défilant sans arrêt, elle se remplit en
  6 min ;
- **quitter X** arrête de la remplir, mais ne rend rien seconde par seconde : il
  lance un **décompte d'une heure** (voir plus bas). « Quitter X », c'est changer d'onglet, réduire la fenêtre,
  **changer de bureau (Space)** ou passer sur une autre appli : tout ce qui fait
  que la fenêtre n'est plus au premier plan (`visibilityState` *et*
  `document.hasFocus()`).

**Lire un article X ne compte pas.** Les articles (format long, parfois 30 min
de lecture) obligent à défiler sans arrêt : au tarif du fil, la jauge serait
pleine au premier tiers. Pendant qu'un article est à l'écran, la jauge est
**figée** : elle ne se remplit pas, et le décompte d'absence ne court pas non
plus (on est sur X). Le voyant du panneau passe au vert : **ARTICLE**.
Reconnaissance (relevée sur x.com le 2026-11-14) : l'adresse
`/<compte>/article/<id>` (vue plein écran), ou, sur la page du tweet
`/<compte>/status/<id>`, des liens vers `/<compte>/article/<même id>`. Un tweet
qui cite un article, ou un article aperçu dans le fil, ne fige rien.

Les 12 minutes reviennent d'un coup, et seulement après **une heure**
(`ATTENTE_MIN`) d'attente, de l'une de ces deux façons :

- **en partant de X** : dès qu'aucun onglet X n'est plus au premier plan, le
  décompte démarre. Une heure d'affilée loin de X → jauge à zéro, même sans
  être allé jusqu'à TROP. Revenir sur X avant la fin **annule** le décompte : la
  jauge reprend là où elle était, et le prochain départ repart de 60:00. Le
  décompte court aussi quand aucun onglet X n'est ouvert, ou quand la machine
  est en veille : la remise à zéro se fait à la réouverture ;
- **par TROP** : jauge pleine → TROP, pendant une heure : c'est l'attente. À
  la fin de la séquence, la jauge revient à zéro (clé `trop:recup`). Fermer
  l'onglet n'y change rien : un onglet X rouvert pendant cette heure rejoint
  la séquence là où elle en est.

Le solde avance seconde par seconde (lissé, sans à-coups). Un défilement, c'est
molette, tactile, ou un défilement juste après une touche (espace, j/k, flèches)
ou un clic (ascenseur) ; les repositionnements faits par X lui-même ne comptent
pas, et les secondes de la séquence TROP ne comptent ni dans un sens ni dans
l'autre (solde gelé).

Réglages : `BUDGET_MIN`, `COUT_DEFILEMENT`, `ATTENTE_MIN`.

### Partage entre onglets

Le solde et l'heure de la dernière séquence sont partagés entre les onglets du
site (`localStorage`, clés `trop:base`, `trop:surcout`, `trop:maj`, `trop:vu`,
`trop:defileVu`, `trop:debut` et `trop:recup`) :

- une **seule horloge** (`trop:maj`) fait avancer le solde : le premier onglet
  qui s'éveille consomme le temps écoulé puis repousse l'horloge, les autres
  voient alors un delta nul. Le temps n'est donc compté qu'une fois, quel que
  soit le nombre d'onglets. Seul compte le temps où un onglet était déjà au
  premier plan à la seconde précédente : en rouvrant X après une absence, le
  temps passé sans onglet ouvert n'est pas compté ;
- quand la jauge est pleine, l'onglet affiché lance la séquence, note l'heure
  de récupération (sa fin), et tous les autres onglets X démarrent au même
  instant, sur la même horloge : changer d'onglet n'y échappe pas ;
- un onglet ouvert pendant une séquence la rejoint là où elle en est.

## Le panneau en haut à droite

```
TROP dans 4:25                  [×2]
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬────────────
7:35 / 12:00        −5:20 en défilant
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

Quitter X fige le compte. Si la fenêtre reste visible sans avoir le focus
(autre appli à côté, second écran), le titre devient **« Rendu dans 44:59 »** :
le décompte avant que la jauge soit rendue.

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
  que sur le blanc des lettres. Le hasard de la découpe est un générateur à
  graine (mulberry32), pour que tous les onglets brisent la lettre pareil.
- **Filet de sécurité** : si une erreur survient pendant l'animation, la page
  est aussitôt débloquée. X n'est jamais rendu inutilisable.

## Vérifié

x.com n'étant pas accessible depuis l'environnement de test, vérifié dans
Chromium sur une page qui en reproduit les contraintes (CSP stricte sur les
styles et les polices, Trusted Types, champ de saisie en `autofocus`) :

- pendant la séquence : 0 touche, 0 clic, 0 défilement parviennent à la page ;
  rien n'est saisi dans le champ ;
- (v3, séquence de 20 s de l'époque) fin mesurée à 20,8 s après la navigation
  (0,5 s de chargement + 20 s), puis clavier, clic et défilement refonctionnent,
  `<html>` et `<body>` retrouvent leur état d'origine ;
- durée totale (v4.3) : portée à 10 min (`DUREE_TOTALE = 600 s`) ; la casse et le
  fondu gardent leur rythme (final ~25 s, de 575 s à 600 s), c'est la montée des
  battements qui s'étire. Recalcul de la chronologie vérifié ; le rendu sur 10 min
  réelles n'a pas été rejoué en navigateur ;
- 15 min et bris lent (v4.4, Chrome headless sur une page locale, séquence
  rejointe à différents instants) : battements à 60 s, T à peine fendu à 182 s,
  de plus en plus fissuré à 260 s et 330 s, éclats en chute à 355 s, « ROP »
  seul à 356 s, O fissuré à 700 s, fondu à 898 s, page rendue à 900 s. Les
  fissures pas encore ouvertes ne se devinent pas (la lettre intacte reste
  dessous jusqu'à la chute) ;
- jauge (v4.2 : logique simulée hors navigateur, horloge et visibilité
  pilotées) : 300 s à regarder remplissent ~300 s ; 60 s à défiler en ajoutent
  120 (60 + 60 de surcoût, ×2) ; en quittant l'onglet, la jauge se vide d'une
  seconde par seconde (le surcoût d'abord) et revient à 0 [remplacé en v4.6] ; deux « onglets » qui
  avancent la même seconde ne la comptent qu'une fois. Le déroulé de la séquence
  TROP lui-même n'a pas été rejoué en v4.2 (inchangé depuis v4) ;
- jauge sans vidange (v4.6, Chrome headless, focus émulé, localStorage préparé) :
  revenir après 10 min sans onglet X n'ajoute rien (100 → 102 s en 2 s de
  regard ; avant correction : 702) ; jauge pleine → TROP et récupération fixée à
  3 600 s (15 min de séquence + 45 min) ; TROP relancé pendant l'attente : jauge
  toujours pleine, heure de récupération inchangée ; attente écoulée → jauge à 0 ;
- articles (v4.9, sur le vrai x.com, non connecté, script injecté, focus
  émulé) : en 6 s, la jauge reste à 100 s sur la page du tweet-article et sur
  l'article plein écran (voyant ARTICLE), et passe à 105 s sur un tweet normal ;
- décompte d'absence (v4.8, Chrome headless, focus émulé ou non) : retour après
  44 min → jauge intacte (600 → 602 s) ; retour après 46 min → jauge à 0 ;
  fenêtre visible sans focus depuis 10 min → jauge inchangée, panneau
  « Rendu dans 34:57 » ; sans focus depuis 46 min → jauge à 0 ;
- 45 min (v4.7, Chrome headless, séquence rejointe à différents instants) :
  battements à 120 s, choc du T à 541 s, T de plus en plus fissuré à 700, 900 et
  1070 s, « ROP » seul à 1076 s, choc du R à 1079 s, O fissuré à 2000 s, fondu à
  2698 s, page rendue à 2701 s. Cohérence : la même séquence chargée deux fois,
  en 1440 × 900 puis en 900 × 700, montre le même motif de fissures ; une
  séquence au début différent en montre un autre ;
- bris lettre par lettre (v4, quand la séquence durait 44,8 s) : à 21,6 s le T
  tombe, à 24,5 s « ROP » est intact (pause), à 39,6 s le P tombe ; page rendue à
  44,8 s. En v4.3 le même final se joue de 575 s à 600 s ;
- (v3) captures à chaque étape (entrée, battements, fissures, chute, fondu), en
  1440 × 900 et en portrait 390 × 844 : le mot tient dans la largeur.

Pas pu être vérifié ici : le rendu avec la vraie Futura (absente de Linux ; le
mécanisme `local()` a été validé avec une autre police installée) et la
cohabitation avec Minimal Twitter sur le vrai x.com.
