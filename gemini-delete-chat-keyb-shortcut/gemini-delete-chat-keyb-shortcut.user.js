// ==UserScript==
// @name         Gemini Quick Delete & Next (Targeted)
// @namespace    https://violentmonkey.github.io/
// @version      1.3
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

    async function deleteAndNext() {
        // 1. On trouve l'élément <a> sélectionné (celui que tu m'as montré)
        const currentChat = document.querySelector('a[data-test-id="conversation"].selected');

        if (!currentChat) {
            console.error("Aucun chat sélectionné trouvé.");
            return;
        }

        // 2. On repère le prochain chat AVANT de supprimer
        // On cherche le prochain élément dans la liste qui a le même data-test-id
        const allChats = Array.from(document.querySelectorAll('a[data-test-id="conversation"]'));
        const currentIndex = allChats.indexOf(currentChat);
        const nextChat = allChats[currentIndex + 1] || allChats[currentIndex - 1];

        console.log("Chat actuel :", currentChat.innerText);
        if (nextChat) console.log("Prochain chat cible :", nextChat.innerText);

        // 3. Ouvrir le menu de suppression
        // Le bouton menu est généralement un frère ou un enfant dans la structure de Gemini
        const menuButton = currentChat.querySelector('[data-test-id="actions-menu-button"]') ||
                           currentChat.parentElement.querySelector('[data-test-id="actions-menu-button"]');

        if (!menuButton) {
            console.error("Bouton menu introuvable.");
            return;
        }

        menuButton.click();
        await sleep(200);

        // 4. Clic sur Supprimer
        const deleteBtn = Array.from(document.querySelectorAll('.mat-mdc-menu-item'))
                               .find(el => /supprimer|delete/i.test(el.textContent));
        if (deleteBtn) {
            deleteBtn.click();
            await sleep(300);

            // 5. Confirmation dans la modale
            const confirmBtn = Array.from(document.querySelectorAll('mat-dialog-actions button'))
                                    .find(el => /supprimer|delete/i.test(el.textContent));

            if (confirmBtn) {
                confirmBtn.click();
                console.log("Suppression confirmée.");

                // 6. C'est ici qu'on clique sur l'élément <a> du suivant
                if (nextChat) {
                    await sleep(400); // On attend que la modale disparaisse
                    nextChat.click();
                    console.log("Navigation vers le chat suivant réussie.");
                }
            }
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
})();