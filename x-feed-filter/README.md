# X : fil sans politique, religion ni immigration

Les mots masqués de X ne regardent que le texte du post. Une vidéo politique
publiée avec une légende neutre (« 😳 regardez ça ») passe donc entre les mailles.
Ce script lit aussi **les sous-titres automatiques des vidéos**, repère les posts
qui parlent de politique, de religion ou d'immigration, les replie, puis clique
« Ce post ne m'intéresse pas » pour que l'algorithme en propose moins.

## Installation

Violentmonkey / Tampermonkey → nouveau script → coller `x-feed-filter.user.js`,
ou ouvrir directement
[le script brut](https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/x-feed-filter/x-feed-filter.user.js).
Actif sur `x.com` et `twitter.com`, mais n'agit que sur le fil **Accueil**
(`/home`).

Sur Chrome, Tampermonkey demande en plus d'activer « Autoriser les scripts
utilisateur » dans `chrome://extensions` → Détails.

## Ce qui est analysé

Pour chaque post du fil, dans cet ordre :

1. le texte affiché (post, citation, titre de la carte de lien) et le texte
   complet des posts longs ;
2. si rien n'a été trouvé et que le post contient une vidéo : ses sous-titres,
   quand X en a généré (une partie des vidéos seulement).

Un post qui contient un des mots de `KEYWORDS` est replié sous un bandeau
« Masqué (vidéo : Trump) — cliquer pour afficher ». La recherche ignore la casse
et les accents, et ne prend que des mots entiers : `RN` ne touche pas
« RNA », `manif` ne touche pas « manifeste ».

## « Ce post ne m'intéresse pas »

Les posts détectés passent dans une file d'attente traitée lentement, pour ne
pas ressembler à un robot aux yeux de X :

- au moins 10 s entre deux clics (`MIN_GAP_MS`) ;
- au plus 80 clics par jour (`DAILY_CAP`, compteur dans `localStorage.xff_count`) ;
- avant de cliquer, le script vérifie que l'`article` porte bien le même
  identifiant de post que celui détecté.

`DRY_RUN: true` : rien n'est cliqué, les posts sont seulement repliés et notés
dans la console. Le journal des 300 dernières actions est dans
`localStorage.xff_log`.

## Comment il lit le post et les sous-titres

- L'objet tweet complet se lit dans la fibre React de l'`article`
  (`memoizedProps.tweet`) : texte, auteur et `extended_entities.media[].video_info`.
- La variante HLS de la vidéo (`application/x-mpegURL`, sur `video.twimg.com`)
  se lit en `fetch` depuis x.com. Quand X a généré des sous-titres, le master
  playlist a une ligne `#EXT-X-MEDIA:TYPE=SUBTITLES` → playlist → segments
  WebVTT, dont on retire les horodatages et les balises `<X-word-ms …>`.
- Les sous-titres sont mis en cache par vidéo, au plus 12 segments lus.

## Réglages (en tête du script)

| Réglage | Défaut | Effet |
| --- | --- | --- |
| `DRY_RUN` | `false` | ne clique rien |
| `AUTO_NOT_INTERESTED` | `true` | clique « Ce post ne m'intéresse pas » |
| `ONLY_HOME` | `true` | n'agit que sur `/home` |
| `MIN_GAP_MS` | `10000` | écart minimal entre deux clics |
| `DAILY_CAP` | `80` | clics maximum par jour |
| `SCAN_SUBTITLES` | `true` | lit les sous-titres des vidéos |
| `HIDE` | `true` | replie les posts détectés |

`WHITELIST` : comptes jamais touchés (handles sans @, en minuscules).

## Limites

- Ne tourne que dans le navigateur où il est installé ; les clics « pas
  intéressé » profitent quand même au fil sur tous les appareils.
- Une vidéo sans légende parlante ni sous-titres n'est pas détectée.
- `Trump`, `Israël`, `Poutine` ou `grève` replient aussi de l'actualité non
  militante, y compris dans des posts business : retirer le mot de `KEYWORDS`
  si c'est gênant.
