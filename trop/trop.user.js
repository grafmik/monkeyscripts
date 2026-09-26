// ==UserScript==
// @name        TROP : pause forcée à la Gaspar Noé
// @namespace   Violentmonkey Scripts
// @version     2.0.0
//
// @match       https://x.com/*
// @match       https://twitter.com/*
// @match       https://mobile.x.com/*
// @run-at      document-start
// @noframes
// @grant       none
//
// @author      Mik
// @description Toutes les 10 minutes, en même temps sur tous les onglets, bloque la page 20 s : « TROP » plein écran en blanc sur noir, qui bat comme un cœur, se fissure et tombe en morceaux. Générique : il suffit d'ajouter des @match.
// ==/UserScript==

(function() {
    'use strict';

    // Rien ici n'est propre à x.com : pour d'autres sites, ajouter des @match.

    const MOT = 'TROP';
    const LARGEUR = 0.97;       // part de la largeur de l'écran occupée par le mot
    const PERIODE = 10 * 60;    // secondes entre deux séquences
    // Chronologie, en secondes depuis le début de la séquence
    const T_ENTREE = 0.9;       // zoom d'entrée des lettres
    const T_COEUR = 9.7;        // fin des battements
    const T_FISSURE = 10;       // première lettre qui se fissure
    const ECART_FISSURE = 0.45; // délai entre les fissures de deux lettres
    const T_CHUTE = 12.4;       // les éclats commencent à tomber
    const T_FONDU = 16.2;       // le noir s'efface et laisse voir la page
    const T_FIN = 20;           // la page est rendue à l'utilisateur
    const BPM_DEBUT = 58, BPM_FIN = 104;  // le cœur s'emballe
    const IMAGES_PAR_S = 24;    // le tremblement saute comme une pellicule

    // Futura Extra Bold Condensed : la fonte des affiches de « Seul contre tous »
    // et des génériques d'« Enter the Void » et de « Climax ». Chargée depuis les
    // polices installées (macOS la fournit) : un local() ne télécharge rien, donc
    // la CSP de x.com (font-src) ne peut pas le bloquer. Sinon, repli sur Impact.
    const NOMS_FUTURA = [
        'Futura-CondensedExtraBold', 'Futura Condensed ExtraBold',
        'FuturaPT-CondExtraBold', 'Futura PT Cond Extra Bold',
        'FuturaStd-ExtraBoldCond', 'Futura Std Extra Bold Condensed',
        'FuturaBT-ExtraBlackCondensed', 'Futura XBlkCn BT',
    ];
    const POLICE = `'TropNoe', 'Futura', 'Impact', 'Haettenschweiler', 'Arial Narrow', sans-serif`;

    // --- Synchronisation entre onglets -------------------------------------------
    // L'heure de début de la dernière séquence est partagée dans le localStorage
    // du site, commun à tous ses onglets. Chaque onglet en déduit la suivante :
    // - une séquence est en cours (moins de 20 s) : l'onglet la rejoint, calé sur
    //   la même horloge, et affiche exactement la même image ;
    // - 10 min sont passées : le premier onglet VISIBLE en lance une nouvelle,
    //   et l'événement « storage » fait démarrer tous les autres au même instant.
    // Aucun onglet X visible à l'échéance : la séquence part dès qu'on y revient.
    const CLE = 'trop:debut';
    let debutMemoire = 0;       // repli si le localStorage est inaccessible
    const lireDebut = () => {
        try { return Number(localStorage.getItem(CLE)) || 0; } catch (e) { return debutMemoire; }
    };
    const ecrireDebut = d => {
        debutMemoire = d;
        try { localStorage.setItem(CLE, String(d)); } catch (e) { /* onglet isolé */ }
    };

    let enCours = false;
    function verifier() {
        const html = document.documentElement;
        if (!html || enCours) return;
        let debut = lireDebut();
        const maintenant = Date.now();
        if (maintenant - debut >= T_FIN * 1000) {
            if (maintenant - debut < PERIODE * 1000 || document.visibilityState !== 'visible') return;
            debut = maintenant;
            ecrireDebut(debut);
        }
        enCours = true;
        rituel(html, debut, () => { enCours = false; });
    }

    // Police chargée une fois pour toutes (quelques ms au plus)
    let policePrete = Promise.resolve();
    try {
        const futura = new FontFace('TropNoe', NOMS_FUTURA.map(n => `local('${n}')`).join(', '),
                                    {weight: '800', stretch: 'condensed'});
        document.fonts.add(futura);
        policePrete = Promise.race([futura.load(), new Promise(r => setTimeout(r, 1500))]).catch(() => {});
    } catch (e) { /* pas d'API FontFace : la pile de repli prend le relais */ }

    // Pour certains gestionnaires, document-start tombe avant même que <html>
    // existe : on attend alors sa création (aucune saisie possible entre-temps).
    if (document.documentElement) verifier();
    else new MutationObserver((_, o) => {
        if (!document.documentElement) return;
        o.disconnect();
        verifier();
    }).observe(document, {childList: true});
    addEventListener('storage', e => { if (e.key === CLE) verifier(); });
    document.addEventListener('visibilitychange', verifier);
    setInterval(verifier, 1000);

    function rituel(html, debut, surFin) {

        // --- 1. Verrouillage ----------------------------------------------------
        // Écouteurs posés dès document-start, en capture sur window : ils passent
        // avant ceux du site (raccourcis j/k de X, etc.) et avant le navigateur
        // (défilement, espace, F5…). Ce que le navigateur garde pour lui (⌘W, ⌘T,
        // ⌘L) reste hors de portée d'une page, et c'est tant mieux.
        const EVENEMENTS = [
            'keydown', 'keyup', 'keypress', 'beforeinput', 'wheel', 'mousewheel',
            'touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointerup',
            'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu',
            'dragstart', 'selectstart', 'gesturestart',
        ];
        const bloquer = e => {
            if (e.cancelable) e.preventDefault();
            e.stopImmediatePropagation();
        };
        const OPTIONS = {capture: true, passive: false};
        EVENEMENTS.forEach(t => window.addEventListener(t, bloquer, OPTIONS));

        // X lance ses vidéos tout seul : on les remet en pause pendant la séquence
        const pasDeLecture = e => { if (e.target instanceof HTMLMediaElement) e.target.pause(); };
        document.addEventListener('play', pasDeLecture, true);

        const debordementAvant = html.style.getPropertyValue('overflow');
        const prioriteAvant = html.style.getPropertyPriority('overflow');
        html.style.setProperty('overflow', 'hidden', 'important');

        // <body> n'existe pas encore à document-start : on le rend inerte dès qu'il
        // apparaît (plus de focus, plus de saisie, même au clavier).
        let corpsInerte = null;
        const rendreInerte = () => {
            if (corpsInerte || !document.body) return;
            corpsInerte = document.body;
            corpsInerte.inert = true;
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        };
        rendreInerte();
        const guetteur = new MutationObserver(rendreInerte);
        if (!corpsInerte) guetteur.observe(html, {childList: true});

        // --- 2. Scène -----------------------------------------------------------
        // Un élément à nous, enfant de <html> (hors du <body> que gère React), avec
        // un shadow root fermé : ni les styles de X, ni ceux de l'extension Minimal
        // Twitter ne peuvent l'atteindre. Placé dans le top layer (popover) : il
        // passe au-dessus de tout, quel que soit le z-index des autres.
        const hote = document.createElement('trop-noe');
        const styleHote = {
            all: 'initial', position: 'fixed', inset: '0', margin: '0', padding: '0',
            border: '0', width: '100vw', height: '100vh', 'max-width': 'none',
            'max-height': 'none', overflow: 'hidden', background: '#000',
            'z-index': '2147483647', display: 'block', opacity: '1',
            'pointer-events': 'auto', 'user-select': 'none', cursor: 'none',
        };
        for (const [p, v] of Object.entries(styleHote)) hote.style.setProperty(p, v, 'important');
        html.appendChild(hote);
        try { hote.popover = 'manual'; hote.showPopover(); } catch (e) { /* le z-index suffira */ }

        const racine = hote.attachShadow({mode: 'closed'});
        const CSS = `
    .scene {
        position: absolute; inset: 0; overflow: hidden; background: #000;
        display: flex; align-items: center; justify-content: center;
        perspective: 1400px;
    }
    .mot {
        position: absolute; display: flex; white-space: nowrap;
        font-family: ${POLICE}; font-weight: 800; font-stretch: condensed;
        font-size: 100px; line-height: 1; color: #fff;
        -webkit-font-smoothing: antialiased; will-change: transform;
    }
    .echo { color: transparent; -webkit-text-stroke: 2px rgba(255,255,255,.9); filter: blur(3px); }
    .lettre { position: relative; display: block; padding: .06em .012em; will-change: transform; }
    .eclat {
        position: absolute; left: 0; top: 0; width: 100%; height: 100%;
        box-sizing: border-box; padding: inherit; color: #fff; will-change: transform;
    }
    svg { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
    `;
        // Feuille construite plutôt que <style> : l'API CSSOM échappe à la CSP style-src
        try {
            const feuille = new CSSStyleSheet();
            feuille.replaceSync(CSS);
            racine.adoptedStyleSheets = [feuille];
        } catch (e) {
            const style = document.createElement('style');
            style.textContent = CSS;
            racine.appendChild(style);
        }

        // Construction au DOM, sans innerHTML (x.com impose les Trusted Types)
        const el = (balise, classe, parent) => {
            const n = document.createElement(balise);
            if (classe) n.className = classe;
            if (parent) parent.appendChild(n);
            return n;
        };
        const scene = el('div', 'scene', racine);
        const echo = el('div', 'mot echo', scene);
        const mot = el('div', 'mot', scene);
        const lettres = [...MOT].map(c => {
            el('span', 'lettre', echo).textContent = c;
            const l = el('span', 'lettre', mot);
            l.textContent = c;
            return {el: l, c};
        });
        echo.style.opacity = '0';

        // --- 3. Mise à l'échelle ---------------------------------------------------
        let taille = 100;
        function ajuster() {
            mot.style.fontSize = echo.style.fontSize = '100px';
            const l = mot.offsetWidth, h = mot.offsetHeight;
            if (!l || !h) return;
            taille = Math.min(100 * innerWidth * LARGEUR / l, 100 * innerHeight * 0.9 / h);
            mot.style.fontSize = echo.style.fontSize = taille + 'px';
        }
        const surRedimension = () => { if (!fissuresPosees) ajuster(); };
        addEventListener('resize', surRedimension);

        // --- 4. Battements ----------------------------------------------------------
        // Un battement = « poum » puis « pa » plus faible, attaque sèche, retombée
        // exponentielle. Le rythme accélère de BPM_DEBUT à BPM_FIN.
        const battements = [];
        for (let t = T_ENTREE; t < T_COEUR;) {
            const bpm = BPM_DEBUT + (BPM_FIN - BPM_DEBUT) * (t - T_ENTREE) / (T_COEUR - T_ENTREE);
            const periode = 60 / bpm;
            battements.push({t, force: 1}, {t: t + Math.max(0.16, 0.26 * periode), force: 0.55});
            t += periode;
        }
        const enveloppe = dt => dt < 0 ? 0 : dt < 0.04 ? dt / 0.04 : Math.exp(-(dt - 0.04) / 0.13);
        const pouls = t => battements.reduce((s, b) => s + b.force * enveloppe(t - b.t), 0);
        const dernierPoum = t => {
            let d = -1;
            for (const b of battements) if (b.force === 1 && b.t <= t) d = b.t;
            return d;
        };

        const hasard = (a, b) => a + Math.random() * (b - a);
        const borne = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
        const sortieDos = u => { const s = 2.2; u -= 1; return u * u * ((s + 1) * u + s) + 1; };

        // Le tremblement n'est retiré qu'à 24 images/s : saccadé comme une caméra épaule
        let imageTremble = -1, secousseMot = {x: 0, y: 0, r: 0};
        const secousse = lettres.map(() => ({x: 0, y: 0}));

        // --- 5. Fissures et éclats ------------------------------------------------
        // Chaque lettre éclate depuis un point d'impact : des rayons partent du point,
        // deux anneaux les recoupent, chaque case devient un éclat. Les points sont
        // partagés entre cases voisines, les éclats s'emboîtent donc au pixel près.
        // Un éclat est une copie de la lettre découpée par un clip-path ; les fissures
        // sont tracées en noir par-dessus (invisibles sur le fond noir, visibles sur
        // le blanc des lettres seulement).
        const SVG = 'http://www.w3.org/2000/svg';
        let fissuresPosees = false;

        function briser(lettre) {
            const w = lettre.el.offsetWidth, h = lettre.el.offsetHeight;
            const D = Math.hypot(w, h);
            const P = {x: w * hasard(0.3, 0.7), y: h * hasard(0.3, 0.65)};
            const n = Math.floor(hasard(7, 10));
            const pas = 2 * Math.PI / n, depart = hasard(0, pas);
            const angles = Array.from({length: n}, (_, i) => depart + i * pas + hasard(-0.25, 0.25) * pas);
            const rayons = [0, D * hasard(0.16, 0.26), D * hasard(0.42, 0.58), D * 1.6];
            const pt = (a, r) => ({x: P.x + r * Math.cos(a), y: P.y + r * Math.sin(a)});

            // Q[i][k] : croisement du rayon i et de l'anneau k
            const Q = angles.map(a => rayons.map((r, k) =>
                k === 0 ? {...P} : pt(a + hasard(-0.04, 0.04), r * (k === 3 ? 1 : hasard(0.85, 1.15)))));
            // B[i][k] : cassure au milieu du segment de rayon Q[i][k] → Q[i][k+1]
            const B = Q.map(q => [0, 1, 2].map(k => {
                const a = q[k], b = q[k + 1];
                const dx = b.x - a.x, dy = b.y - a.y, lg = Math.hypot(dx, dy) || 1;
                const d = hasard(-0.08, 0.08) * lg, m = hasard(0.35, 0.65);
                return {x: a.x + dx * m - dy / lg * d, y: a.y + dy * m + dx / lg * d};
            }));
            // A[i][k] : points intermédiaires de l'arc k entre les rayons i et i+1
            const A = angles.map((a, i) => rayons.map((r, k) => {
                if (k === 0 || k === 3) return [];
                let a2 = angles[(i + 1) % n];
                if (a2 < a) a2 += 2 * Math.PI;
                return [1 / 3, 2 / 3].map(f => pt(a + (a2 - a) * f, r * hasard(0.88, 1.12)));
            }));

            const eclats = [];
            for (let i = 0; i < n; i++) {
                const j = (i + 1) % n;
                for (let k = 0; k < 3; k++) {
                    const poly = [Q[i][k], ...A[i][k], Q[j][k], B[j][k], Q[j][k + 1],
                                  ...[...A[i][k + 1]].reverse(), Q[i][k + 1], B[i][k]];
                    const e = el('span', 'eclat', lettre.el);
                    e.textContent = lettre.c;
                    e.style.clipPath = 'polygon(' + poly.map(p => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(',') + ')';
                    const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
                    const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
                    e.style.transformOrigin = `${cx}px ${cy}px`;
                    const dx = cx - P.x, dy = cy - P.y, lg = Math.hypot(dx, dy) || 1;
                    eclats.push({
                        el: e, ux: dx / lg, uy: dy / lg, cx, cy,
                        ecart: hasard(1, 2.5) * (k + 1) / 2,
                        retard: hasard(0, 0.55) + (1 - cy / h) * 0.35,
                        vx: dx / lg * hasard(40, 160) + hasard(-40, 40),
                        vy: -hasard(40, 260),
                        vz: hasard(-1, 1),
                        rz: hasard(-320, 320), rx: hasard(-220, 220),
                    });
                }
            }
            lettre.el.style.color = 'transparent';

            // Les fissures, en noir, poussent depuis le point d'impact
            const svg = document.createElementNS(SVG, 'svg');
            svg.setAttribute('width', w);
            svg.setAttribute('height', h);
            const trait = Math.max(2, taille * 0.012);
            const tracer = (pts, delai, duree) => {
                const p = document.createElementNS(SVG, 'polyline');
                p.setAttribute('points', pts.map(q => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '));
                p.setAttribute('fill', 'none');
                p.setAttribute('stroke', '#000');
                p.setAttribute('stroke-width', trait);
                p.setAttribute('stroke-linejoin', 'bevel');
                p.setAttribute('pathLength', '1');
                p.style.strokeDasharray = '1';
                p.style.strokeDashoffset = '1';
                svg.appendChild(p);
                p.animate([{strokeDashoffset: 1}, {strokeDashoffset: 0}],
                          {duration: duree, delay: delai, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards'});
            };
            for (let i = 0; i < n; i++) {
                tracer([Q[i][0], B[i][0], Q[i][1], B[i][1], Q[i][2], B[i][2], Q[i][3]], hasard(0, 60), 700);
                for (const k of [1, 2]) {
                    tracer([Q[i][k], ...A[i][k], Q[(i + 1) % n][k]], 90 + k * 90 + hasard(0, 80), 260);
                }
            }
            lettre.el.appendChild(svg);
            lettre.svg = svg;
            lettre.eclats = eclats;
        }

        // --- 6. Boucle --------------------------------------------------------------
        // Horloge murale commune à tous les onglets : passer de l'un à l'autre en
        // cours de séquence montre le même instant.
        let t = 0, termine = false;

        function image() {
            if (termine) return;
            try {
                t = (Date.now() - debut) / 1000;
                dessiner();
                if (t >= T_FIN) return terminer();
                requestAnimationFrame(image);
            } catch (e) {
                terminer();   // en cas de pépin, ne jamais laisser la page bloquée
                throw e;
            }
        }

        function dessiner() {
            const p = pouls(t);
            const numero = Math.floor(t * IMAGES_PAR_S);
            const nouvelleImage = numero !== imageTremble;
            imageTremble = numero;

            // Intensité du tremblement : monte avec le temps, bondit à chaque battement,
            // puis un reste de nervosité pendant les fissures
            let force = 0;
            if (t < T_COEUR + 0.3) force = 2 + 9 * borne(t / T_COEUR) + 14 * p + (t < T_ENTREE ? 10 : 0);
            else if (t < T_CHUTE) force = 1.2;
            if (nouvelleImage) {
                secousseMot = {x: hasard(-1, 1) * force, y: hasard(-1, 1) * force, r: hasard(-1, 1) * force * 0.05};
                secousse.forEach(s => { s.x = hasard(-1, 1) * force * 0.35; s.y = hasard(-1, 1) * force * 0.35; });
            }

            // Le mot entier avance lentement vers le spectateur et enfle à chaque battement
            const approche = 0.94 + 0.08 * borne(t / T_FISSURE);
            const echelle = t < T_FISSURE ? approche * (1 + 0.09 * p) : approche;
            mot.style.transform = `translate(${secousseMot.x}px, ${secousseMot.y}px) rotate(${secousseMot.r}deg) scale(${echelle})`;

            // Écho fantôme : un contour flou jaillit à chaque « poum »
            const d = dernierPoum(t);
            if (d >= 0 && t < T_FISSURE) {
                const u = borne((t - d) / 0.55);
                echo.style.opacity = String(0.45 * (1 - u));
                echo.style.transform = `translate(${-secousseMot.x}px, ${-secousseMot.y}px) scale(${approche * (1 + 0.28 * u)})`;
            } else {
                echo.style.opacity = '0';
            }

            lettres.forEach((l, i) => {
                // Entrée : chaque lettre surgit du fond, avec un léger rebond
                const u = borne((t - i * 0.09) / (T_ENTREE - 0.27));
                const s = t < T_ENTREE ? Math.max(0, sortieDos(u)) : 1;
                const tFissure = T_FISSURE + i * ECART_FISSURE;
                // Choc de l'impact au moment où la lettre se fend
                const choc = t >= tFissure ? Math.exp(-(t - tFissure) / 0.09) : 0;
                const cx = secousse[i].x + choc * hasard(-18, 18);
                const cy = secousse[i].y + choc * hasard(-18, 18);
                l.el.style.transform = `translate(${cx}px, ${cy}px) scale(${s})`;
                l.el.style.opacity = String(borne(u * 3));

                if (t >= tFissure && !l.eclats) {
                    fissuresPosees = true;
                    briser(l);
                }
                if (!l.eclats) return;

                const vieFissure = t - tFissure;
                l.eclats.forEach(e => {
                    const tc = t - T_CHUTE - i * 0.12 - e.retard;
                    if (tc <= 0) {
                        // Avant la chute : les éclats s'écartent à peine, la lettre se disjoint
                        const ecart = e.ecart * borne(vieFissure / 0.5);
                        e.el.style.transform = `translate(${e.ux * ecart}px, ${e.uy * ecart}px)`;
                        return;
                    }
                    const g = 1600;
                    const x = e.ux * e.ecart + e.vx * tc;
                    const y = e.uy * e.ecart + e.vy * tc + 0.5 * g * tc * tc;
                    e.el.style.transform =
                        `translate3d(${x}px, ${y}px, ${e.vz * 120 * tc}px) rotateX(${e.rx * tc}deg) rotateZ(${e.rz * tc}deg)`;
                });
                // Les traits de fissure s'effacent quand les morceaux se détachent
                if (l.svg && t > T_CHUTE) l.svg.style.opacity = String(1 - borne((t - T_CHUTE) / 0.15));
            });

            // Fondu final : le noir se retire et la page réapparaît
            hote.style.setProperty('opacity', String(1 - borne((t - T_FONDU) / (T_FIN - T_FONDU))), 'important');
        }

        // --- 7. Fin -------------------------------------------------------------------
        function terminer() {
            if (termine) return;
            termine = true;
            EVENEMENTS.forEach(ev => window.removeEventListener(ev, bloquer, OPTIONS));
            document.removeEventListener('play', pasDeLecture, true);
            removeEventListener('resize', surRedimension);
            guetteur.disconnect();
            if (corpsInerte) corpsInerte.inert = false;
            if (debordementAvant) html.style.setProperty('overflow', debordementAvant, prioriteAvant);
            else html.style.removeProperty('overflow');
            if (html.getAttribute('style') === '') html.removeAttribute('style');
            try { hote.hidePopover(); } catch (e) { /* pas de popover */ }
            hote.remove();
            surFin();
        }

        // --- 8. Départ ------------------------------------------------------------------
        // L'écran est déjà noir ; l'animation part dès que la police est prête.
        policePrete.then(() => {
            if (termine) return;
            ajuster();
            requestAnimationFrame(image);
        });
    }
})();
