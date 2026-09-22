# Uber Eats : masquer les plats en double

Sur une page restaurant Uber Eats, le même plat apparaît souvent dans plusieurs
catégories (« Les plus populaires », une collab, une promo…). Ce script parcourt
la page, mémorise le nom des plats, et masque toute occurrence déjà affichée plus
haut. Si une catégorie n'a plus aucun plat visible, son titre est masqué aussi.

## Installation

Violentmonkey / Tampermonkey → nouveau script → coller
`ubereats-dedup.user.js`.

## Utilisation

Automatique sur `https://www.ubereats.com/*`. Le menu se chargeant au scroll, le
script se relance à chaque changement du DOM.

**Alt+Shift+D** : réafficher les doublons (et re-appuyer pour les remasquer).

## Notes

- Les éléments sont masqués (`display: none`), jamais supprimés : rien ne casse
  côté panier ou navigation.
- Uber Eats change régulièrement ses classes CSS. Le repérage se fait donc sur la
  structure (lien vers un item du menu + titre de la carte), pas sur des noms de
  classe. Si le script rate des doublons, c'est là qu'il faut regarder :
  `cartes()` et `nomDuPlat()`.
