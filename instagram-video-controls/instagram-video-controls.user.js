// ==UserScript==
// @name        Instagram : barre de contrôle vidéo
// @namespace   Violentmonkey Scripts
// @version     3.0.0
//
// @match       https://www.instagram.com/*
// @grant       none
//
// @author      Mik
// @description Barre de progression cliquable, lecture/pause, temps écoulé et raccourcis clavier (← → espace) sur les vidéos Instagram (feed et reels).
// ==/UserScript==

(function() {
    'use strict';

    // Une seule barre, en position: fixed sur <body>, recalée sur la vidéo visible.
    // Ancrée dans la page plutôt que dans le conteneur de la vidéo : les ancêtres
    // Instagram ont un z-index: 0 qui crée un contexte d'empilement et ferait
    // passer la barre DERRIÈRE les overlays (auteur, légende, boutons).
    const HAUTEUR = 34;         // hauteur de la barre, en px
    const MARGE_SURVOL = 8;     // tolérance autour de la vidéo pour garder la barre visible
    const SAUT = 5;             // secondes gagnées par appui sur ← / →
    const FLASH = 1200;         // ms d'affichage de la barre après un raccourci clavier

    const mmss = s => {
        if (!isFinite(s)) return '0:00';
        const m = Math.floor(s / 60), r = Math.floor(s % 60);
        return m + ':' + String(r).padStart(2, '0');
    };

    const CSS = `
#bic-barre {
    position: fixed; z-index: 2147483000; display: none;
    box-sizing: border-box; height: ${HAUTEUR}px;
    align-items: center; gap: 10px; padding: 0 12px;
    background: linear-gradient(transparent, rgba(0,0,0,.75));
    font: 12px/1 -apple-system, system-ui, sans-serif; color: #fff;
    opacity: 0; transition: opacity .15s ease;
}
#bic-barre.bic-visible { display: flex; opacity: 1; }
#bic-barre button {
    all: unset; cursor: pointer; flex: none; width: 16px; text-align: center;
    font-size: 13px; line-height: 1;
}
#bic-piste { position: relative; flex: 1; height: ${HAUTEUR}px; cursor: pointer; display: flex; align-items: center; }
#bic-piste::before {
    content: ''; position: absolute; left: 0; right: 0; height: 3px;
    background: rgba(255,255,255,.4); border-radius: 2px;
}
#bic-remplie { position: relative; height: 3px; width: 0; background: #fff; border-radius: 2px; }
#bic-remplie::after {
    content: ''; position: absolute; right: -5px; top: -3.5px;
    width: 10px; height: 10px; border-radius: 50%; background: #fff;
    opacity: 0; transition: opacity .15s ease;
}
#bic-barre:hover #bic-remplie::after { opacity: 1; }
#bic-temps { flex: none; font-variant-numeric: tabular-nums; }
`;

    const style = document.createElement('style');
    style.textContent = CSS;
    document.documentElement.appendChild(style);

    const barre = document.createElement('div');
    barre.id = 'bic-barre';
    barre.innerHTML =
        '<button id="bic-play" aria-label="Lecture/pause">▶</button>' +
        '<div id="bic-piste"><div id="bic-remplie"></div></div>' +
        '<span id="bic-temps">0:00 / 0:00</span>';
    document.body.appendChild(barre);

    const boutonPlay = barre.querySelector('#bic-play');
    const piste = barre.querySelector('#bic-piste');
    const remplie = barre.querySelector('#bic-remplie');
    const temps = barre.querySelector('#bic-temps');

    let cible = null;           // la vidéo actuellement contrôlée
    let souris = {x: -1, y: -1};
    let glisse = false;
    let flashJusqua = 0;        // montre la barre un instant après un raccourci

    const zoneDe = v => v.getBoundingClientRect();
    const dansLaZone = r =>
        souris.x >= r.left - MARGE_SURVOL && souris.x <= r.right + MARGE_SURVOL &&
        souris.y >= r.top - MARGE_SURVOL && souris.y <= r.bottom + MARGE_SURVOL;

    // La vidéo contrôlée est celle qu'on survole — règle prévisible quand le feed
    // en affiche plusieurs. À défaut, celle dont on voit la plus grande hauteur.
    function choisirCible() {
        const vues = [...document.querySelectorAll('video')]
            .map(v => {
                const r = zoneDe(v);
                return {v, r, vu: Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0))};
            })
            .filter(o => o.r.height > 80 && o.vu > 40);
        if (!vues.length) return null;
        const survolee = vues.find(o => dansLaZone(o.r));
        return (survolee || vues.sort((a, b) => b.vu - a.vu)[0]).v;
    }

    function boucle() {
        cible = glisse ? cible : choisirCible();
        if (!cible) {
            barre.classList.remove('bic-visible');
        } else {
            const r = cible.getBoundingClientRect();
            barre.style.left = r.left + 'px';
            barre.style.width = r.width + 'px';
            // si la vidéo déborde sous le pli, la barre reste collée au bas de l'écran
            barre.style.top = Math.max(0, Math.min(r.bottom - HAUTEUR, innerHeight - HAUTEUR)) + 'px';
            // en portrait (reels), le bouton son d'Instagram occupe le coin bas droit
            barre.style.paddingRight = (r.height > r.width ? 46 : 12) + 'px';
            barre.classList.toggle('bic-visible',
                glisse || dansLaZone(r) || performance.now() < flashJusqua);

            const d = cible.duration || 0;
            remplie.style.width = d ? (cible.currentTime / d * 100) + '%' : '0';
            temps.textContent = mmss(cible.currentTime) + ' / ' + mmss(d);
            boutonPlay.textContent = cible.paused ? '▶' : '❚❚';
        }
        requestAnimationFrame(boucle);
    }

    addEventListener('mousemove', e => { souris = {x: e.clientX, y: e.clientY}; }, true);

    // Instagram écoute les clics sur toute la zone vidéo : on garde les nôtres pour
    // nous. Le stopPropagation doit se faire en phase de remontée — en capture, il
    // priverait les boutons de la barre de leur propre clic.
    const capter = e => { e.preventDefault(); e.stopPropagation(); };
    barre.addEventListener('click', e => e.stopPropagation());

    boutonPlay.addEventListener('click', e => {
        capter(e);
        if (!cible) return;
        if (cible.paused) cible.play(); else cible.pause();
    });

    function seekVers(clientX) {
        if (!cible || !cible.duration) return;
        const r = piste.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
        cible.currentTime = ratio * cible.duration;
    }

    piste.addEventListener('pointerdown', e => {
        capter(e);
        if (!cible) return;
        glisse = true;
        piste.setPointerCapture(e.pointerId);
        seekVers(e.clientX);
    });
    piste.addEventListener('pointermove', e => { if (glisse) { capter(e); seekVers(e.clientX); } });
    const relacher = e => { if (glisse) { capter(e); glisse = false; } };
    piste.addEventListener('pointerup', relacher);
    piste.addEventListener('pointercancel', relacher);

    // --- Raccourcis clavier -------------------------------------------------
    // Instagram lie déjà l'espace (lecture/pause de son côté, et défilement par
    // défaut du navigateur) et les flèches (défilement, reel suivant/précédent).
    // On écoute en phase de capture sur window et on coupe la propagation :
    // l'événement n'atteint ni Instagram ni le comportement par défaut.
    const champDeSaisie = el =>
        !!el && (el.isContentEditable ||
                 /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

    function raccourci(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (champDeSaisie(e.target) || champDeSaisie(document.activeElement)) return;

        const v = cible || choisirCible();
        if (!v) return;

        if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
            const sens = e.code === 'ArrowRight' ? 1 : -1;
            // sur une vidéo courte, viser la fin exacte la ferait boucler
            const fin = (v.duration || v.currentTime) - 0.15;
            v.currentTime = Math.max(0, Math.min(fin, v.currentTime + sens * SAUT));
        } else if (e.code === 'Space') {
            if (v.paused) v.play(); else v.pause();
        } else {
            return;
        }

        cible = v;
        flashJusqua = performance.now() + FLASH;
        e.preventDefault();
        e.stopImmediatePropagation();   // prive Instagram de la touche
    }

    addEventListener('keydown', raccourci, true);
    // certains gestionnaires d'Instagram agissent sur keyup / keypress
    addEventListener('keyup', e => {
        if (!champDeSaisie(e.target) && ['ArrowRight', 'ArrowLeft', 'Space'].includes(e.code)) {
            e.preventDefault(); e.stopImmediatePropagation();
        }
    }, true);

    requestAnimationFrame(boucle);
})();
