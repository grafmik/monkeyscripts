// ==UserScript==
// @name         Gemini Quick Delete & Next (Targeted)
// @namespace    https://violentmonkey.github.io/
// @version      2.0
// @description  Supprime et sélectionne le suivant via data-test-id
// @author       Gemini AI
// @match        https://gemini.google.com/app*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const isShortcut = (e) => e.altKey && e.shiftKey && e.code === 'KeyD';

    document.addEventListener('keydown', function(e) {
        if (isShortcut(e)) {
            e.preventDefault();
            deleteAndNext();
        }
    }, true);

    // Attend qu'un élément apparaisse dans le DOM (les menus/modales s'ouvrent de façon asynchrone)
    async function waitFor(getter, timeoutMs = 3000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const el = getter();
            if (el) return el;
            await sleep(100);
        }
        return null;
    }

    // Les boutons Gemini sont des composants (<gem-icon-button>, <gem-button>) :
    // le clic doit cibler le <button> natif interne
    function realButton(el) {
        if (!el) return null;
        return el.tagName === 'BUTTON' ? el : el.querySelector('button');
    }

    async function deleteAndNext() {
        // 1. Le chat courant est le lien marqué aria-current="page" dans la liste
        const currentLink = document.querySelector('[data-test-id="conversation"] a[aria-current="page"]');

        if (!currentLink) {
            console.error("[Quick Delete] Aucun chat sélectionné trouvé.");
            return;
        }
        const currentChat = currentLink.closest('[data-test-id="conversation"]');

        // 2. On mémorise le href du prochain chat AVANT de supprimer :
        // Angular re-rend la liste après suppression, les références DOM deviennent invalides
        const allChats = Array.from(document.querySelectorAll('[data-test-id="conversation"]'));
        const currentIndex = allChats.indexOf(currentChat);
        const nextChat = allChats[currentIndex + 1] || allChats[currentIndex - 1];
        const nextHref = nextChat ? nextChat.querySelector('a')?.getAttribute('href') : null;
        const currentHref = currentLink.getAttribute('href');

        console.log("[Quick Delete] Chat actuel :", currentChat.innerText.trim());
        if (nextChat) console.log("[Quick Delete] Prochain chat cible :", nextChat.innerText.trim());

        // 3. Ouvrir le menu d'actions du chat courant
        const menuButton = realButton(currentChat.querySelector('[data-test-id="actions-menu-button"]'));

        if (!menuButton) {
            console.error("[Quick Delete] Bouton menu introuvable.");
            return;
        }
        menuButton.click();

        // 4. Clic sur Supprimer dans le menu
        const deleteBtn = await waitFor(() =>
            document.querySelector('.mat-mdc-menu-item[data-test-id="delete-button"]') ||
            Array.from(document.querySelectorAll('.mat-mdc-menu-item'))
                 .find(el => /supprimer|delete/i.test(el.textContent)));
        if (!deleteBtn) {
            console.error("[Quick Delete] Item Supprimer introuvable dans le menu.");
            return;
        }
        deleteBtn.click();

        // 5. Confirmation dans la modale
        const confirmBtn = await waitFor(() =>
            realButton(document.querySelector('[data-test-id="confirm-button"]')) ||
            Array.from(document.querySelectorAll('mat-dialog-actions button'))
                 .find(el => /supprimer|delete/i.test(el.textContent)));
        if (!confirmBtn) {
            console.error("[Quick Delete] Bouton de confirmation introuvable.");
            return;
        }
        confirmBtn.click();
        console.log("[Quick Delete] Suppression confirmée.");

        // 6. On attend que le chat supprimé disparaisse de la liste, puis on
        // retrouve le suivant par son href (la liste a été re-rendue)
        if (nextHref) {
            await waitFor(() => !document.querySelector(`[data-test-id="conversation"] a[href="${currentHref}"]`) || null, 5000);
            const nextLink = await waitFor(() =>
                document.querySelector(`[data-test-id="conversation"] a[href="${nextHref}"]`));
            if (nextLink) {
                nextLink.click();
                console.log("[Quick Delete] Navigation vers le chat suivant réussie.");
            } else {
                console.warn("[Quick Delete] Chat suivant introuvable après suppression.");
            }
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
})();
