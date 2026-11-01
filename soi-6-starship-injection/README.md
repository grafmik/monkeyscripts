# Soi 6 Starship : panneau score / injection

Un petit panneau en haut à droite sur la page du jeu
[Soi 6 Starship](https://marcbluersky.com/soi_6_starship/), avec deux
mini-onglets :

| Onglet | Fonction |
| --- | --- |
| **Score** | Saisir et envoyer un score arbitraire (score + wave) au serveur |
| **Injection** | Envoyer un payload dans `score` / `wave` pour injecter du JS dans le classement |

Le panneau se **replie vers la droite** (bouton `«` → `»`) pour ne laisser
qu'une petite poignée sur le bord droit et mieux voir le site ; il se
**redéplie vers la gauche** pour revoir les formulaires.

## Installation

Violentmonkey / Tampermonkey → nouveau script → coller
`soi-6-starship-injection.user.js`, ou ouvrir directement
[le script brut](https://github.com/grafmik/monkeyscripts/raw/refs/heads/main/soi-6-starship-injection/soi-6-starship-injection.user.js).

## Ce que fait l'onglet Score

Il envoie exactement la même requête que `saveScoreToServer()` du jeu
(`soi_6_starship.js`, lignes 834-863) : un `POST` `application/x-www-form-urlencoded`
vers `../action.php` avec `action=save_score&score=…&wave=…`. Le cookie de
session `PHPSESSID` est joint automatiquement par le navigateur.

Un bouton **Reprendre la partie** lit le score affiché dans le HUD (`#hudScore`)
et calcule la wave comme le jeu (`floor(score/500)+1`).

## Ce que fait l'onglet Injection

Le classement est reconstruit côté client avec `innerHTML`. Le JS protège le
nom (`escapeHtml(item.name)`) mais insère `item.wave` (et `item.rank`) **bruts**.
Comme `action.php` ne force pas `wave` en entier, on peut envoyer un payload qui
casse le HTML, par exemple :

```
</span><img src=x onerror=alert(document.domain)>
```

Le serveur le stocke, et il s'exécute dans le navigateur de **tout joueur** qui
consulte le classement du mois : c'est une XSS stockée, pas une exécution côté
serveur PHP.

> Le champ `score`, lui, est reformaté par le client avec
> `Intl.NumberFormat('fr-FR').format(item.score)`, qui le force en nombre :
> un payload dans `score` finit en `NaN pts` et ne s'exécute pas. Le vecteur
> fiable est donc **`wave`** (le champ est inséré tel quel dans `V.…`).

## Onglet Injection : exemples et saisie personnalisée

Le champ **Wave** accepte n'importe quel payload. Une liste déroulante
**Exemples** propose quelques injections prêtes à l'emploi :

| Exemple | Effet |
| --- | --- |
| **Alert (preuve de concept)** | Ferme le `<span>` « V. » puis injecte une `<img>` invalide qui exécute `alert(document.domain)` |
| **Alert personnalisée** | Même principe avec un message custom |
| **Deface (recouvre la page)** | Injecte un `<div>` plein écran « HACKED » qui recouvre le jeu/classement |
| **Exfiltrer le cookie** | Redirige le navigateur vers un domaine contrôlé en joignant `document.cookie` |

Choisir un exemple remplit le champ et affiche un **sous-titre d'explication**
de ce que fait l'injection. On peut aussi simplement taper son propre payload :
dès qu'on modifie le champ, la sélection est désactivée et le sous-titre passe
en « saisie personnalisée ».

## À savoir

- Le serveur refuse les visiteurs non connectés (le jeu affiche le message de
  refus) : il faut être connecté sur le site pour que l'envoi aboutisse.
- Le panneau fonctionne avec `@grant none`, donc le `fetch` est celui de la page
  et partage le cookie de session.
- La réponse brute du serveur est loggée en console (`🔍 [soi6] …`), comme le
  fait le jeu lui-même.

## Script Details

| Field | Value |
|-------|-------|
| Version | 1.1.0 |
| Match | `https://marcbluersky.com/soi_6_starship/*` |
| Permissions | none |
