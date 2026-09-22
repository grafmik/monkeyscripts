// ==UserScript==
// @name        Uber Eats : masquer les plats en double
// @namespace   Violentmonkey Scripts
// @version     1.0.0
//
// @match       https://www.ubereats.com/*
// @grant       none
//
// @author      Mik
// @description Masque les plats déjà affichés plus haut dans la page, et masque une catégorie qui devient vide.
// ==/UserScript==

(function() {
    'use strict';

    const MARQUE = 'data-dedup-cache';   // marque posée sur les éléments qu'on masque
    let actif = true;

    // --- Repérage des cartes de plat ---------------------------------------
    // Uber Eats change souvent ses classes : on identifie une carte par le fait
    // qu'elle contient un lien vers un item du menu, et on remonte au <li> parent.
    function cartes() {
        const liens = document.querySelectorAll('a[href*="/store/"]');
        const vues = new Set();
        const res = [];
        liens.forEach(lien => {
            const href = lien.getAttribute('href') || '';
            // les liens de plat portent un modificateur de quick view ou un segment /item/
            if (!/mod=quickView|modctx=|\/item\//.test(href)) return;
            const tuile = lien.closest('li') || lien.parentElement;
            if (!tuile || vues.has(tuile)) return;
            vues.add(tuile);
            res.push(tuile);
        });
        return res;
    }

    // Nom du plat : le premier titre de la carte, sinon la première ligne de texte.
    function nomDuPlat(tuile) {
        const titre = tuile.querySelector('h1, h2, h3, h4, h5, span[data-testid*="title"]');
        const texte = (titre ? titre.textContent : tuile.textContent) || '';
        return texte.trim().toLowerCase().replace(/\s+/g, ' ');
    }

    // Les titres de catégorie sont les headings qui ne sont PAS dans une carte.
    function titresDeCategorie(tuiles) {
        const dansUneCarte = el => tuiles.some(t => t.contains(el));
        return Array.from(document.querySelectorAll('h1, h2, h3'))
            .filter(h => h.textContent.trim() && !dansUneCarte(h));
    }

    function masquer(el) {
        if (el.getAttribute(MARQUE)) return;
        el.setAttribute(MARQUE, el.style.display || '');
        el.style.display = 'none';
    }

    function demasquerTout() {
        document.querySelectorAll(`[${MARQUE}]`).forEach(el => {
            el.style.display = el.getAttribute(MARQUE);
            el.removeAttribute(MARQUE);
        });
    }

    function visible(el) {
        return !el.getAttribute(MARQUE) && el.offsetParent !== null;
    }

    function nettoyer() {
        if (!actif) return;

        const tuiles = cartes();
        const dejaVus = new Set();

        // 1) doublons : on garde la première occurrence dans l'ordre du document
        tuiles.forEach(tuile => {
            const nom = nomDuPlat(tuile);
            if (!nom) return;
            if (dejaVus.has(nom)) masquer(tuile);
            else dejaVus.add(nom);
        });

        // 2) catégories devenues vides : plus aucune carte visible entre ce titre
        //    et le titre suivant (comparaison par position dans le document).
        const titres = titresDeCategorie(tuiles);
        titres.forEach((titre, i) => {
            const suivant = titres[i + 1] || null;
            const dansLaSection = tuiles.filter(t => {
                const apres = titre.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING;
                const avantLeSuivant = !suivant ||
                    (suivant.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_PRECEDING);
                return apres && avantLeSuivant;
            });
            if (dansLaSection.length && !dansLaSection.some(visible)) {
                // on masque le titre et, si elle existe, la section qui l'enveloppe
                masquer(titre.closest('section') || titre);
            }
        });
    }

    // Le menu se charge et se complète au scroll : on relance après chaque mutation.
    let timer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(nettoyer, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Alt+Shift+D : réafficher / remasquer les doublons
    document.addEventListener('keydown', e => {
        if (e.altKey && e.shiftKey && e.code === 'KeyD') {
            e.preventDefault();
            actif = !actif;
            if (actif) nettoyer();
            else demasquerTout();
        }
    }, true);

    nettoyer();
})();
