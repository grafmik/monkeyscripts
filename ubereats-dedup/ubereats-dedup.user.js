// ==UserScript==
// @name        Uber Eats : masquer les plats en double
// @namespace   Violentmonkey Scripts
// @version     2.0.0
//
// @match       https://www.ubereats.com/*/store/*
// @grant       none
//
// @author      Mik
// @description Masque les plats déjà affichés plus haut dans la page, les catégories devenues vides et leur entrée de sommaire.
// ==/UserScript==

(function() {
    'use strict';

    // Le carrousel « Articles en vedette » en haut de page reprend une bonne partie
    // du menu : en pure priorité au premier affiché, il vide des catégories entières.
    // true  = le plat est gardé dans sa vraie catégorie, le doublon du carrousel saute.
    // false = strictement le premier affiché qui gagne.
    const PRIORITE_MENU = true;

    const MARQUE = 'data-dedup-cache';       // mémorise le display d'origine
    const ITEM = '[data-testid^="store-item-"]';
    const TITRE = '[data-testid="catalog-section-title"]';
    const CARROUSEL = '[data-testid="store-desktop-catalog-section-carousel"]';

    let actif = true;

    // Un plat est identifié par l'UUID de son data-testid : deux cartes du même plat
    // portent le même UUID, quels que soient le libellé et la mise en forme.
    const identifiant = el => el.getAttribute('data-testid').slice('store-item-'.length);

    // Nom lisible (pour le log) : premier rich-text de la carte, hors badge « le plus aimé ».
    function nomDuPlat(el) {
        return [...el.querySelectorAll('[data-testid="rich-text"]')]
            .map(e => e.textContent.trim())
            .filter(t => t && !/le plus aimé/i.test(t))[0] || '';
    }

    // La tuile cliquable = le <li> qui enveloppe la carte.
    const tuileDe = el => el.closest('li');
    // Le bloc d'une catégorie (titre + grille, ou carrousel entier) = le <li> du titre.
    const blocDe = titre => titre.closest('li');

    function masquer(el) {
        if (!el || el.hasAttribute(MARQUE)) return;
        el.setAttribute(MARQUE, el.style.display || '');
        el.style.display = 'none';
    }

    function demasquerTout() {
        document.querySelectorAll('[' + MARQUE + ']').forEach(el => {
            el.style.display = el.getAttribute(MARQUE);
            el.removeAttribute(MARQUE);
        });
    }

    const estMasque = el => el && el.hasAttribute(MARQUE);

    function nettoyer() {
        if (!actif) return;

        let cartes = [...document.querySelectorAll(ITEM)];

        // Ordre de priorité : les cartes du menu d'abord, le carrousel ensuite.
        // L'ordre du document est conservé à l'intérieur de chaque groupe.
        if (PRIORITE_MENU) {
            const dansCarrousel = el => !!el.closest(CARROUSEL);
            cartes = [...cartes.filter(el => !dansCarrousel(el)),
                      ...cartes.filter(dansCarrousel)];
        }

        // 1) doublons
        const vus = new Set();
        cartes.forEach(carte => {
            const cle = identifiant(carte);
            if (vus.has(cle)) masquer(tuileDe(carte));
            else vus.add(cle);
        });

        // 2) catégories dont plus aucun plat n'est visible
        const titresMasques = [];
        document.querySelectorAll(TITRE).forEach(titre => {
            const bloc = blocDe(titre);
            if (!bloc) return;
            const dedans = [...bloc.querySelectorAll(ITEM)];
            if (dedans.length && dedans.every(c => estMasque(tuileDe(c)))) {
                titresMasques.push(titre.textContent.trim());
                masquer(bloc);
            }
        });

        // 3) entrées de sommaire pointant vers une catégorie masquée
        if (titresMasques.length) {
            document.querySelectorAll('nav a, nav button').forEach(lien => {
                if (titresMasques.includes(lien.textContent.trim())) {
                    masquer(lien.closest('li') || lien);
                }
            });
        }
    }

    // Le menu se complète au scroll : on relance après chaque salve de mutations.
    let timer = null;
    new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(nettoyer, 300);
    }).observe(document.body, { childList: true, subtree: true });

    // Alt+Shift+D : réafficher / remasquer les doublons
    document.addEventListener('keydown', e => {
        if (e.altKey && e.shiftKey && e.code === 'KeyD') {
            e.preventDefault();
            actif = !actif;
            if (actif) nettoyer(); else demasquerTout();
        }
    }, true);

    nettoyer();
})();
