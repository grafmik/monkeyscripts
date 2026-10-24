# Suno : télécharger la librairie ou l'écran

Un petit panneau **⬇ Écran · Librairie** en bas à droite de suno.com récupère
les chansons en MP3 dans `~/Downloads/suno-<compte>` (par ex.
`~/Downloads/suno-grafmik`, le nom du compte est lu chez Suno).

- **Écran** : les chansons visibles à l'écran (liste, librairie, Explore…), ou
  celle de la page `/song/…`.
- **Librairie** : toutes les chansons de la librairie du compte connecté
  (hors corbeille).

Les fichiers s'appellent `<titre> - <8 premiers caractères de l'id>.mp3` :
une génération donne deux prises du même titre. Ce qui est déjà dans le
dossier n'est pas retéléchargé, on peut donc relancer « Librairie » de temps
en temps pour ne récupérer que les nouvelles.

Les mêmes actions sont dans le menu de l'extension (Violentmonkey /
Tampermonkey).

## Installation

Violentmonkey / Tampermonkey → nouveau script → coller `suno-download.user.js`, ou
ouvrir directement
[le script brut](https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/suno-download/suno-download.user.js).

## Chansons non débloquées

Le script passe par le **téléchargement officiel** de Suno. Sur un compte
gratuit, une chanson ne se télécharge qu'une fois « débloquée » (menu ⋯ →
Download → MP3 → *Unlock & Download*), ce qui consomme un téléchargement du
quota. Le script ne débloque rien lui-même : il liste à la fin les chansons
non débloquées, à débloquer à la main si on les veut.

Il n'enregistre pas le flux d'écoute pour contourner ce quota.

## Où vont les fichiers

**Chrome / Edge** : au premier clic, le navigateur demande un dossier.
Choisir **Téléchargements** : le script y crée `suno-<compte>`. Si Chrome
refuse le dossier Téléchargements entier (« fichiers système »), y créer
`suno-<compte>` dans la boîte de dialogue et choisir celui-là. Le choix est
mémorisé ; aux lancements suivants, Chrome redemande seulement l'autorisation
d'écrire, d'un clic.

**Firefox** : pas de choix de dossier, le script passe par `GM_download` avec
le sous-dossier `suno-<compte>/`. Avec Tampermonkey, régler *Paramètres →
Téléchargements → Download Mode* sur **Browser API**, sinon le sous-dossier
est ignoré. Le script note les chansons déjà récupérées (stockage de
l'extension) pour ne pas les refaire.

## Comment ça marche

Tout passe par l'API de suno.com, avec la session déjà ouverte (cookie
`__session`) :

| Étape | Appel |
| --- | --- |
| Nom du compte | `GET studio-api-prod.suno.com/api/session/` → `user.handle` |
| Librairie | `GET /api/feed/v2?page=N` (20 par page, jusqu'à `has_more: false`) |
| Chanson à l'écran | `a[href*="/song/<id>"]` visibles, puis `GET /api/clip/<id>` |
| MP3 | `GET /api/download/clip/<id>?format=mp3` → `download_url` (après un ou deux « processing ») ; `not_authorized` si non débloquée |
