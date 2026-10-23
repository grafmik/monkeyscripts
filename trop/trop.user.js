// ==UserScript==
// @name        TROP : pause forcée à la Gaspar Noé
// @namespace   Violentmonkey Scripts
// @version     3.2.0
//
// @match       https://x.com/*
// @match       https://twitter.com/*
// @match       https://mobile.x.com/*
// @run-at      document-start
// @noframes
// @grant       none
//
// @author      Mik
// @description Après 7 minutes de défilement actif sur les 10 dernières, ou 20 minutes sur x.com dans l'heure, bloque 20 s tous les onglets à la fois : « TROP » plein écran en blanc sur noir, qui bat comme un cœur, se fissure et tombe en morceaux. Compte à rebours en haut à droite. Générique : il suffit d'ajouter des @match.
// ==/UserScript==

(function() {
    'use strict';

    // Rien ici n'est propre à x.com : pour d'autres sites, ajouter des @match.

    const MOT = 'TROP';
    const LARGEUR = 0.97;       // part de la largeur de l'écran occupée par le mot
    // Déclenchement : SEUIL_MIN minutes « actives » parmi les FENETRE_MIN dernières.
    // Une minute est active si, onglet affiché, le site a chargé de nouveaux posts
    // au plus DELAI_GESTE secondes après un geste (défilement, clic, touche).
    const FENETRE_MIN = 10;
    const SEUIL_MIN = 7;
    const DELAI_GESTE = 30;
    // Ou bien : SEUIL_PRESENCE_MIN minutes d'onglet affiché sur les
    // FENETRE_PRESENCE_MIN dernières, mesurées par tranches de TRANCHE_S secondes.
    const FENETRE_PRESENCE_MIN = 60;
    const SEUIL_PRESENCE_MIN = 20;
    const TRANCHE_S = 10;
    // Requêtes qui chargent des posts, par site. Sans motif pour le site courant,
    // toute requête fetch/XHR compte.
    // X : ses requêtes GraphQL de fil (HomeTimeline, SearchTimeline…) et de posts.
    const POSTS_X = /\/i\/api\/graphql\/[^/]+\/(\w*Timeline|TweetDetail|UserTweets\w*|UserMedia|Likes|Bookmarks)\b/;
    const REQUETES_POSTS = {'x.com': POSTS_X, 'twitter.com': POSTS_X, 'mobile.x.com': POSTS_X};
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
    const CLE = 'trop:debut', CLE_MINUTES = 'trop:minutes', CLE_PRESENCE = 'trop:presence';
    const lireDebut = () => Number(lire(CLE)) || 0;
    const minuteCourante = () => Math.floor(Date.now() / 60000);
    const trancheCourante = () => Math.floor(Date.now() / (TRANCHE_S * 1000));
    const TRANCHES_FENETRE = FENETRE_PRESENCE_MIN * 60 / TRANCHE_S;
    const SEUIL_TRANCHES = SEUIL_PRESENCE_MIN * 60 / TRANCHE_S;
    // Liste d'unités (minutes ou tranches) encore dans la fenêtre glissante
    const lireListe = (cle, courant, fenetre) => {
        let m;
        try { m = JSON.parse(lire(cle) || '[]'); } catch (e) { m = []; }
        return Array.isArray(m) ? m.filter(x => x >= courant - fenetre + 1) : [];
    };
    const lireMinutes = () => lireListe(CLE_MINUTES, minuteCourante(), FENETRE_MIN);
    const lirePresence = () => lireListe(CLE_PRESENCE, trancheCourante(), TRANCHES_FENETRE);

    // --- Mesure d'activité --------------------------------------------------------
    // On OBSERVE les requêtes (PerformanceObserver) sans intercepter fetch ni XHR :
    // rien de X n'est modifié, aucun conflit possible avec Minimal Twitter.
    // Une minute ne compte qu'une fois, quel que soit le nombre d'onglets ou de
    // requêtes : on mesure du temps passé, pas du volume.
    let enCours = false;        // une séquence tourne dans cet onglet
    let dernierGeste = -Infinity;
    const noterGeste = () => {
        if (document.visibilityState === 'visible') dernierGeste = performance.now();
    };
    ['wheel', 'scroll', 'keydown', 'pointerdown', 'touchmove'].forEach(t =>
        window.addEventListener(t, noterGeste, {capture: true, passive: true}));

    const motif = REQUETES_POSTS[location.hostname];
    function surRequetes(liste) {
        if (document.visibilityState !== 'visible' || enCours) return;
        const utile = liste.getEntries().some(e =>
            (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest') &&
            (!motif || motif.test(e.name)) &&
            e.startTime >= dernierGeste && e.startTime - dernierGeste <= DELAI_GESTE * 1000);
        if (!utile) return;
        const minutes = lireMinutes(), m = minuteCourante();
        if (minutes.includes(m)) return;
        minutes.push(m);
        ecrire(CLE_MINUTES, JSON.stringify(minutes));
        verifier();
        majCompteur();
    }
    try {
        new PerformanceObserver(surRequetes).observe({type: 'resource', buffered: true});
    } catch (e) { /* navigateur trop ancien : jamais de déclenchement par l'activité */ }

    // --- Mesure de présence -------------------------------------------------------
    // Chaque seconde, un onglet affiché marque la tranche de TRANCHE_S s en cours ;
    // une tranche ne compte qu'une fois, quel que soit le nombre d'onglets.
    function noterPresence() {
        if (document.visibilityState !== 'visible' || enCours) return;
        const tranches = lirePresence(), t = trancheCourante();
        if (tranches.includes(t)) return;
        tranches.push(t);
        ecrire(CLE_PRESENCE, JSON.stringify(tranches));
    }

    // --- Déclenchement synchronisé ----------------------------------------------------
    // - une séquence est en cours (moins de 20 s) : l'onglet la rejoint, calé sur
    //   la même horloge, et affiche exactement la même image ;
    // - un des deux seuils (activité ou présence) est atteint : l'onglet VISIBLE en
    //   lance une nouvelle, remet les deux compteurs à zéro, et l'événement
    //   « storage » fait démarrer tous les autres onglets au même instant.

    function verifier() {
        const html = document.documentElement;
        if (!html || enCours) return;
        let debut = lireDebut();
        const maintenant = Date.now();
        if (maintenant - debut >= T_FIN * 1000) {
            const trop = lireMinutes().length >= SEUIL_MIN || lirePresence().length >= SEUIL_TRANCHES;
            if (document.visibilityState !== 'visible' || !trop) return;
            debut = maintenant;
            ecrire(CLE_MINUTES, '[]');
            ecrire(CLE_PRESENCE, '[]');
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
    // En haut à droite : le temps minimal avant le prochain TROP si l'on continue
    // sans s'arrêter, pour chacun des deux seuils. C'est la première unité U (minute
    // ou tranche) dont la fenêtre glissante contiendrait le seuil, en comptant les
    // unités déjà comptées encore dans la fenêtre, plus toutes celles d'ici U.
    // Une pause le fait remonter.
    function attente(liste, courant, fenetre, seuil, dureeMs) {
        const dejaCompte = liste.includes(courant) ? 1 : 0;
        for (let u = courant; ; u++) {
            const gardees = liste.filter(x => x >= u - fenetre + 1).length;
            if (gardees + u - courant + 1 - dejaCompte >= seuil) {
                return Math.max(0, Math.ceil((u * dureeMs - Date.now()) / 1000));
            }
        }
    }
    const duree = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    // Un panneau, deux jauges : « défilement » (minutes actives, en cases) et
    // « présence » (temps d'onglet affiché, en barre). Le titre donne le plus court
    // des deux comptes à rebours, la jauge qui le fixe est en pleine lumière, et
    // il vire au rouge dans la dernière minute.
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
    .titre { font: 800 condensed 18px/1.2 ${POLICE}; letter-spacing: .04em; transition: color .3s; }
    .titre.urgent { color: #ff453a; }
    .ligne {
        display: grid; grid-template-columns: 62px 1fr 64px; align-items: center; gap: 6px;
        margin-top: 4px; font: 600 11px/1.3 -apple-system, system-ui, sans-serif;
        opacity: .5; transition: opacity .3s;
    }
    .ligne.proche { opacity: 1; }
    .valeur { text-align: right; white-space: nowrap; }
    .jauge { display: flex; gap: 2px; height: 6px; }
    .case, .barre { flex: 1; border-radius: 2px; background: rgba(255,255,255,.22); }
    .case.pleine { background: #fff; }
    .barre { position: relative; overflow: hidden; }
    .rempli { position: absolute; left: 0; top: 0; bottom: 0; background: #fff; }
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
            const el = (classe, parent, texte) => {
                const n = document.createElement('div');
                n.className = classe;
                if (texte) n.textContent = texte;
                parent.appendChild(n);
                return n;
            };
            const panneau = el('panneau', racine);
            const titre = el('titre', panneau);
            const ligne = nom => {
                const l = el('ligne', panneau);
                el('nom', l, nom);
                return {l, jauge: el('jauge', l), valeur: el('valeur', l)};
            };
            const def = ligne('défilement'), pres = ligne('présence');
            const cases = Array.from({length: SEUIL_MIN}, () => el('case', def.jauge));
            const rempli = el('rempli', el('barre', pres.jauge));
            ui = {titre, def, pres, cases, rempli};
        }
        // X peut remplacer le contenu de <html> : on se replace au besoin
        if (hoteCompteur.parentNode !== html) html.appendChild(hoteCompteur);
        hoteCompteur.style.setProperty('display', enCours ? 'none' : 'block', 'important');
        if (enCours) return;

        const minutes = lireMinutes(), tranches = lirePresence();
        const sDef = attente(minutes, minuteCourante(), FENETRE_MIN, SEUIL_MIN, 60000);
        const sPres = attente(tranches, trancheCourante(), TRANCHES_FENETRE, SEUIL_TRANCHES, TRANCHE_S * 1000);
        const s = Math.min(sDef, sPres);
        ui.titre.textContent = `${MOT} dans ${duree(s)}`;
        ui.titre.classList.toggle('urgent', s < 60);
        ui.def.l.classList.toggle('proche', sDef <= sPres);
        ui.pres.l.classList.toggle('proche', sPres < sDef);

        const n = Math.min(minutes.length, SEUIL_MIN);
        ui.cases.forEach((c, i) => c.classList.toggle('pleine', i < n));
        ui.def.valeur.textContent = `${n} / ${SEUIL_MIN} min`;
        const vu = Math.min(tranches.length * TRANCHE_S, SEUIL_PRESENCE_MIN * 60);
        ui.rempli.style.width = (100 * vu / (SEUIL_PRESENCE_MIN * 60)) + '%';
        ui.pres.valeur.textContent = `${Math.floor(vu / 60)} / ${SEUIL_PRESENCE_MIN} min`;
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
        if (e.key === CLE || e.key === CLE_MINUTES || e.key === CLE_PRESENCE) majCompteur();
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
