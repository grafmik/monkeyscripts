# Uber Eats : masquer les plats en double

Sur une page restaurant Uber Eats, le même plat apparaît dans plusieurs endroits :
le carrousel « Articles en vedette », une promo, une collab, puis sa vraie
catégorie. Ce script ne garde qu'une occurrence de chaque plat, masque les
catégories qui n'ont plus rien à montrer, et retire leur entrée du sommaire de
gauche.

Mesuré sur *La Petite Ferme - Lyon 6* : 49 cartes → 34, deux catégories
entièrement redondantes masquées (« Articles en vedette », « Collab La petite x
Greekia »), aucune vraie catégorie perdue.

## Installation

Violentmonkey / Tampermonkey → nouveau script → coller
`ubereats-dedup.user.js`. Actif sur `https://www.ubereats.com/*/store/*`.

**Alt+Shift+D** : réafficher les doublons (re-appuyer pour les remasquer).

## Comment il reconnaît un doublon

Chaque carte porte `data-testid="store-item-<uuid>"`. Deux cartes du même plat
partagent le même UUID — c'est la clé de dédoublonnage, insensible au libellé et
à la mise en forme. Les catégories sont repérées par
`data-testid="catalog-section-title"`, et le bloc d'une catégorie est le `<li>`
qui contient son titre (vrai aussi bien pour une grille verticale que pour un
carrousel).

## `PRIORITE_MENU` (en tête du script)

Le carrousel « Articles en vedette » en haut de page reprend 14 des 49 plats. En
appliquant strictement « le premier affiché gagne », il vidait **5 catégories
réelles**, dont « 🏆 Nos incontournables » et « 🥗 Les salades ».

- `true` (défaut) : les cartes du menu sont prioritaires, le doublon du
  carrousel saute — le carrousel disparaît donc quand il n'apportait rien.
- `false` : strictement le premier affiché qui gagne.

## Notes

- Les éléments sont masqués (`display: none`), jamais supprimés : rien ne casse
  côté panier ou navigation.
- Le menu se complétant au scroll, un `MutationObserver` débouncé relance le
  nettoyage après chaque salve.
