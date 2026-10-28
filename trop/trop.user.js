// ==UserScript==
// @name        TROP : pause forcée à la Gaspar Noé
// @namespace   Violentmonkey Scripts
// @version     4.1.0
//
// @match       https://x.com/*
// @match       https://twitter.com/*
// @match       https://mobile.x.com/*
// @run-at      document-start
// @noframes
// @grant       none
//
// @author      Mik
// @description Après 20 minutes sur x.com dans l'heure (défiler les consomme 6 fois plus vite), bloque tous les onglets à la fois : « TROP » plein écran en blanc sur noir, qui bat comme un cœur, puis se brise lettre par lettre. Compte à rebours en haut à droite. Générique : il suffit d'ajouter des @match.
// ==/UserScript==

(function() {
    'use strict';

    // Rien ici n'est propre à x.com : pour d'autres sites, ajouter des @match.

    const MOT = 'TROP';
    const LARGEUR = 0.97;       // part de la largeur de l'écran occupée par le mot
    // Déclenchement : un budget de BUDGET_MIN minutes sur les FENETRE_MIN dernières.
    // Chaque seconde d'onglet affiché en coûte une ; une seconde passée à défiler
    // en coûte COUT_DEFILEMENT. Mesuré par tranches de TRANCHE_S secondes.
    const FENETRE_MIN = 60;
    const BUDGET_MIN = 20;
    const COUT_DEFILEMENT = 6;
    const TRANCHE_S = 10;
    // Chronologie, en secondes depuis le début de la séquence
    const T_ENTREE = 0.9;       // zoom d'entrée des lettres
    const T_COEUR = 19.7;       // fin des battements
    const T_FISSURE = 20;       // première lettre qui se fissure
    const T_AVANT_CHUTE = 1.2;  // entre la fissure d'une lettre et la chute de ses éclats
    const DUREE_BRIS = 3;       // d'une fissure à la disparition des derniers éclats
    const PAUSE_LETTRES = 3;    // silence entre deux lettres
    const ECART_FISSURE = DUREE_BRIS + PAUSE_LETTRES;
    const T_FONDU = T_FISSURE + (MOT.length - 1) * ECART_FISSURE + DUREE_BRIS;  // le noir s'efface
    const T_FIN = T_FONDU + 3.8;  // la page est rendue à l'utilisateur
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

    // --- Stockage partagé entre onglets --------------------------------------------
    // localStorage du site, commun à tous ses onglets ; repli en mémoire s'il est
    // inaccessible (l'onglet fonctionne alors seul).
    const memoire = {};
    const lire = cle => {
        try { return localStorage.getItem(cle); } catch (e) { return memoire[cle] ?? null; }
    };
    const ecrire = (cle, v) => {
        memoire[cle] = v;
        try { localStorage.setItem(cle, v); } catch (e) { /* onglet isolé */ }
    };
    const CLE = 'trop:debut', CLE_PRESENCE = 'trop:presence', CLE_DEFILE = 'trop:defile';
    const lireDebut = () => Number(lire(CLE)) || 0;
    const trancheCourante = () => Math.floor(Date.now() / (TRANCHE_S * 1000));
    const TRANCHES_FENETRE = FENETRE_MIN * 60 / TRANCHE_S;
    const BUDGET_S = BUDGET_MIN * 60;
    // Tranches encore dans la fenêtre glissante
    const lireListe = cle => {
        let m;
        try { m = JSON.parse(lire(cle) || '[]'); } catch (e) { m = []; }
        const debutFenetre = trancheCourante() - TRANCHES_FENETRE + 1;
        return Array.isArray(m) ? m.filter(x => x >= debutFenetre) : [];
    };
    const marquer = cle => {
        const tranches = lireListe(cle), t = trancheCourante();
        if (tranches.includes(t)) return;
        tranches.push(t);
        ecrire(cle, JSON.stringify(tranches));
    };
    // Secondes consommées : regard (une par seconde) et surcoût du défilement
    function consommation() {
        const presence = lireListe(CLE_PRESENCE), defile = lireListe(CLE_DEFILE);
        return {presence, defile, regard: presence.length * TRANCHE_S,
                surcout: defile.length * TRANCHE_S * (COUT_DEFILEMENT - 1)};
    }

    // --- Mesure -------------------------------------------------------------------
    // Chaque seconde, un onglet affiché marque la tranche de TRANCHE_S s en cours ;
    // un défilement la marque en plus comme « défilée ». Une tranche ne compte
    // qu'une fois, quel que soit le nombre d'onglets. Rien de X n'est intercepté.
    let enCours = false;        // une séquence tourne dans cet onglet
    let derniereDefilee = -1;   // évite de relire le stockage à chaque cran de molette
    let dernierGeste = -Infinity;
    const regarde = () => document.visibilityState === 'visible' && !enCours;
    function noterDefilement() {
        if (!regarde() || trancheCourante() === derniereDefilee) return;
        derniereDefilee = trancheCourante();
        marquer(CLE_PRESENCE);
        marquer(CLE_DEFILE);
        majCompteur();
    }
    ['wheel', 'touchmove'].forEach(t =>
        window.addEventListener(t, noterDefilement, {capture: true, passive: true}));
    // Clavier (espace, j/k, flèches) ou ascenseur : le « scroll » qui suit est
    // bien un défilement de l'utilisateur, pas un repositionnement fait par X.
    ['keydown', 'pointerdown'].forEach(t =>
        window.addEventListener(t, () => { dernierGeste = performance.now(); }, {capture: true, passive: true}));
    window.addEventListener('scroll', () => {
        if (performance.now() - dernierGeste < 1000) noterDefilement();
    }, {capture: true, passive: true});
    function noterPresence() {
        if (regarde()) marquer(CLE_PRESENCE);
    }

    // --- Déclenchement synchronisé ----------------------------------------------------
    // - une séquence est en cours : l'onglet la rejoint, calé sur la même horloge,
    //   et affiche exactement la même image ;
    // - le budget est épuisé : l'onglet VISIBLE en lance une nouvelle, remet les
    //   compteurs à zéro, et l'événement « storage » fait démarrer tous les autres
    //   onglets au même instant.

    function verifier() {
        const html = document.documentElement;
        if (!html || enCours) return;
        let debut = lireDebut();
        const maintenant = Date.now();
        if (maintenant - debut >= T_FIN * 1000) {
            const {regard, surcout} = consommation();
            if (document.visibilityState !== 'visible' || regard + surcout < BUDGET_S) return;
            debut = maintenant;
            ecrire(CLE_PRESENCE, '[]');
            ecrire(CLE_DEFILE, '[]');
            ecrire(CLE, String(debut));
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

    // --- Compte à rebours ------------------------------------------------------------
    // En haut à droite : le temps avant le prochain TROP si l'on reste à regarder
    // sans défiler, c'est-à-dire la première tranche U où la fenêtre glissante
    // dépasserait le budget (tranches déjà consommées encore dans la fenêtre, plus
    // toutes celles d'ici U). Défiler le fait fondre six fois plus vite ; une
    // pause le fait remonter, comme les tranches qui sortent de la fenêtre.
    function secondesAvantTrop({presence, defile}) {
        const c = trancheCourante();
        const cout = x => TRANCHE_S * (defile.includes(x) ? COUT_DEFILEMENT : 1);
        const aVenir = presence.includes(c) ? 0 : 1;
        for (let u = c; ; u++) {
            const gardees = presence.filter(x => x >= u - TRANCHES_FENETRE + 1);
            const total = gardees.reduce((s, x) => s + cout(x), 0) + (u - c + aVenir) * TRANCHE_S;
            if (total >= BUDGET_S) {
                return Math.max(0, Math.ceil((u * TRANCHE_S * 1000 - Date.now()) / 1000));
            }
        }
    }
    const duree = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    // Un panneau, une jauge : la barre se remplit du temps passé à regarder (blanc)
    // et de ce que le défilement a coûté en plus (rouge). Le voyant « ×6 » s'allume
    // tant qu'on défile, et le titre vire au rouge dans la dernière minute.
    // Même blindage que la scène : enfant de <html>, shadow root fermé, et
    // transparent aux clics (pointer-events: none) pour ne rien gêner sur X.
    let hoteCompteur = null, ui = null;
    function majCompteur() {
        const html = document.documentElement;
        if (!html) return;
        if (!hoteCompteur) {
            hoteCompteur = document.createElement('trop-compteur');
            const racine = hoteCompteur.attachShadow({mode: 'closed'});
            const CSS = `
    .panneau {
        position: fixed; top: 8px; right: 8px; z-index: 2147483646; width: 210px;
        padding: 6px 10px 8px; border-radius: 8px; background: rgba(0,0,0,.8); color: #fff;
        font-variant-numeric: tabular-nums; pointer-events: none; user-select: none;
        box-shadow: 0 2px 10px rgba(0,0,0,.25);
    }
    .tete { display: flex; align-items: center; justify-content: space-between; }
    .titre {
        font: 800 condensed 18px/1.2 ${POLICE}; letter-spacing: .04em; white-space: nowrap;
        transition: color .3s;
    }
    .titre.urgent, .detail b { color: #ff453a; }
    .voyant {
        font: 800 condensed 13px/1 ${POLICE}; padding: 3px 6px; border-radius: 4px;
        background: rgba(255,255,255,.12); color: rgba(255,255,255,.35); transition: all .2s;
    }
    .voyant.actif { background: #ff453a; color: #fff; }
    .barre {
        position: relative; height: 6px; margin-top: 5px; border-radius: 3px;
        overflow: hidden; background: rgba(255,255,255,.22);
    }
    .regard, .surcout { position: absolute; top: 0; bottom: 0; transition: width .3s, left .3s; }
    .regard { left: 0; background: #fff; }
    .surcout { background: #ff453a; }
    .detail {
        display: flex; justify-content: space-between; margin-top: 4px; white-space: nowrap;
        font: 600 11px/1.3 -apple-system, system-ui, sans-serif; color: rgba(255,255,255,.7);
    }
    `;
            try {
                const feuille = new CSSStyleSheet();
                feuille.replaceSync(CSS);
                racine.adoptedStyleSheets = [feuille];
            } catch (e) {
                const style = document.createElement('style');
                style.textContent = CSS;
                racine.appendChild(style);
            }
            // Construction au DOM, sans innerHTML (Trusted Types de x.com)
            const el = (classe, parent, texte, balise = 'div') => {
                const n = document.createElement(balise);
                n.className = classe;
                if (texte) n.textContent = texte;
                parent.appendChild(n);
                return n;
            };
            const panneau = el('panneau', racine);
            const tete = el('tete', panneau);
            const titre = el('titre', tete);
            const voyant = el('voyant', tete, `×${COUT_DEFILEMENT}`);
            const barre = el('barre', panneau);
            const regard = el('regard', barre), surcout = el('surcout', barre);
            const detail = el('detail', panneau);
            const total = el('', detail, '', 'span');
            const perdu = el('', detail, '', 'b');
            ui = {titre, voyant, regard, surcout, total, perdu};
        }
        // X peut remplacer le contenu de <html> : on se replace au besoin
        if (hoteCompteur.parentNode !== html) html.appendChild(hoteCompteur);
        hoteCompteur.style.setProperty('display', enCours ? 'none' : 'block', 'important');
        if (enCours) return;

        const conso = consommation();
        const s = secondesAvantTrop(conso);
        ui.titre.textContent = `${MOT} dans ${duree(s)}`;
        ui.titre.classList.toggle('urgent', s < 60);
        const c = trancheCourante();
        ui.voyant.classList.toggle('actif', conso.defile.includes(c) || conso.defile.includes(c - 1));

        const regard = Math.min(conso.regard, BUDGET_S);
        const surcout = Math.min(conso.surcout, BUDGET_S - regard);
        ui.regard.style.width = (100 * regard / BUDGET_S) + '%';
        ui.surcout.style.left = ui.regard.style.width;
        ui.surcout.style.width = (100 * surcout / BUDGET_S) + '%';
        ui.total.textContent = `${duree(Math.min(conso.regard + conso.surcout, BUDGET_S))} / ${BUDGET_MIN}:00`;
        ui.perdu.textContent = conso.surcout ? `−${duree(conso.surcout)} en défilant` : '';
    }

    // Pour certains gestionnaires, document-start tombe avant même que <html>
    // existe : on attend alors sa création (aucune saisie possible entre-temps).
    const toutVerifier = () => { noterPresence(); verifier(); majCompteur(); };
    if (document.documentElement) toutVerifier();
    else new MutationObserver((_, o) => {
        if (!document.documentElement) return;
        o.disconnect();
        toutVerifier();
    }).observe(document, {childList: true});
    addEventListener('storage', e => {
        if (e.key === CLE) verifier();
        if (e.key === CLE || e.key === CLE_PRESENCE || e.key === CLE_DEFILE) majCompteur();
    });
    document.addEventListener('visibilitychange', toutVerifier);
    setInterval(toutVerifier, 1000);

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
                        retard: hasard(0, 0.35) + (1 - cy / h) * 0.25,
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
            else if (t < T_FONDU) force = 1.2;
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
                    const tc = t - tFissure - T_AVANT_CHUTE - e.retard;
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
                const tChute = tFissure + T_AVANT_CHUTE;
                if (l.svg && t > tChute) l.svg.style.opacity = String(1 - borne((t - tChute) / 0.15));
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
