// ==UserScript==
// @name        TROP : pause forcée à la Gaspar Noé
// @namespace   Violentmonkey Scripts
// @version     4.10.0
//
// @match       https://x.com/*
// @match       https://twitter.com/*
// @match       https://mobile.x.com/*
// @run-at      document-start
// @noframes
// @grant       none
//
// @author      Mik
// @description Après 15 minutes passées sur x.com (défiler les consomme 2 fois plus vite ; 60 minutes d'affilée loin de X les rendent ; lire un article X ne compte pas), bloque tous les onglets à la fois pendant une heure : « TROP » plein écran en blanc sur noir, qui bat comme un cœur, puis se brise lettre par lettre. Compte à rebours en haut à droite. Générique : il suffit d'ajouter des @match.
// ==/UserScript==

(function() {
    'use strict';

    // Rien ici n'est propre à x.com : pour d'autres sites, ajouter des @match.

    const MOT = 'TROP';
    const LARGEUR = 0.97;       // part de la largeur de l'écran occupée par le mot
    // Déclenchement : une jauge de BUDGET_MIN minutes. Chaque seconde passée sur X
    // (un onglet au premier plan) la remplit d'une seconde, une seconde passée à y
    // défiler de COUT_DEFILEMENT. Pleine → TROP, qui dure ATTENTE_MIN minutes :
    // c'est l'attente. À la fin, la jauge revient à zéro. Quitter X ne la vide pas
    // peu à peu, mais rester ATTENTE_MIN minutes D'AFFILÉE loin de X la remet à
    // zéro aussi ; revenir avant annule ce décompte.
    const BUDGET_MIN = 15;
    const COUT_DEFILEMENT = 2;
    const ATTENTE_MIN = 60;
    // Chronologie, en secondes depuis le début de la séquence. 60 minutes en tout,
    // en cinq parts égales : ~12 min où le mot bat et tremble, puis 12 min par
    // lettre — elle se fissure lentement, une fissure après l'autre, de plus en
    // plus vite, jusqu'à ce que ses éclats tombent —, puis le fondu.
    const DUREE_TOTALE = ATTENTE_MIN * 60;   // 60 minutes en tout
    const T_ENTREE = 0.9;       // zoom d'entrée des lettres
    const ECART_FISSURE = DUREE_TOTALE / (MOT.length + 1);  // 12 min par lettre
    const PAUSE_LETTRES = 3;    // silence entre la chute d'une lettre et la lettre suivante
    const DUREE_CHUTE = 1.8;    // de la chute des éclats à leur disparition
    const DUREE_BRIS = ECART_FISSURE - PAUSE_LETTRES;  // de la première fissure au dernier éclat
    const T_AVANT_CHUTE = DUREE_BRIS - DUREE_CHUTE;    // la lettre se fissure pendant ~11 min 55
    const DUREE_FONDU = 3.8;    // du dernier éclat à la page rendue
    // Durée du final, de la première fissure à la page rendue (~48 min)
    const DUREE_FINAL = (MOT.length - 1) * ECART_FISSURE + DUREE_BRIS + DUREE_FONDU;
    const T_FISSURE = DUREE_TOTALE - DUREE_FINAL;   // première lettre qui se fissure (~12 min)
    const T_COEUR = T_FISSURE - 0.3;                // fin des battements, juste avant
    const T_FONDU = T_FISSURE + (MOT.length - 1) * ECART_FISSURE + DUREE_BRIS;  // le noir s'efface
    const T_FIN = DUREE_TOTALE;   // la page est rendue à l'utilisateur
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
    const num = cle => Number(lire(cle)) || 0;
    const CLE = 'trop:debut';
    const CLE_BASE = 'trop:base', CLE_SURCOUT = 'trop:surcout', CLE_MAJ = 'trop:maj';
    const CLE_VU = 'trop:vu', CLE_DEFILE_VU = 'trop:defileVu';
    const CLE_ARTICLE_VU = 'trop:articleVu';   // dernier instant où un article était lu
    const CLE_RECUP = 'trop:recup';   // heure où la jauge revient à zéro (0 : pas épuisée)
    const lireDebut = () => num(CLE);
    const BUDGET_S = BUDGET_MIN * 60;
    const GRACE_MS = 1500;      // au-delà de ce silence, plus aucun onglet au premier plan

    let enCours = false;        // une séquence tourne dans cet onglet

    // « Regarder X », c'est l'onglet au premier plan ET sa fenêtre active. Le seul
    // visibilityState ne suffit pas : changer de bureau (Space, geste à trois
    // doigts) ou passer sur une autre appli laisse l'onglet « visible » mais fait
    // perdre le focus à la fenêtre — document.hasFocus() le voit, pas la visibilité.
    const auPremierPlan = () => document.visibilityState === 'visible' && document.hasFocus();

    // --- Jauge partagée entre onglets --------------------------------------------
    // Un seau de BUDGET_S secondes : CLE_BASE = temps regardé (une seconde par
    // seconde), CLE_SURCOUT = le surcoût du défilement par-dessus. Il se remplit
    // tant qu'un onglet du site est au premier plan (CLE_VU, rafraîchi chaque
    // seconde par les onglets actifs). Le quitter ne la vide pas peu à peu : elle
    // revient à zéro à l'heure CLE_RECUP (la fin du TROP), ou après ATTENTE_MIN
    // minutes d'affilée sans aucun onglet au premier plan (CLE_VU trop ancien) ;
    // revenir avant remet ce décompte à zéro, puisque CLE_VU est rafraîchi.
    // Une seule horloge (CLE_MAJ) avance le solde : le premier onglet qui s'éveille
    // consomme le temps écoulé puis repousse l'horloge, les autres voient alors
    // dt ≈ 0 — rien n'est compté deux fois, quel que soit le nombre d'onglets.
    const consommation = () => ({regard: num(CLE_BASE), surcout: num(CLE_SURCOUT)});

    // Lire un article X (format long, 30 min de lecture parfois) ne remplit pas la
    // jauge : c'est de la lecture, pas du fil. Un article se reconnaît (relevé sur
    // x.com le 2026-11-14, aussi sans être connecté) :
    // - en plein écran, à son adresse : /<compte>/article/<id> ou /i/article/<id> ;
    // - dans la page du tweet /<compte>/status/<id>, aux liens vers
    //   /<compte>/article/<MÊME id> (titre, images). Un tweet qui en cite un
    //   autre, ou un article dans le fil, porte un autre id : pas de faux positif.
    function lectureArticle() {
        const p = location.pathname;
        if (/\/article\/\d+/.test(p)) return true;
        const m = p.match(/\/status\/(\d+)/);
        return !!m && !!document.querySelector(`a[href*="/article/${m[1]}"]`);
    }

    function avancer() {
        const now = Date.now();
        // Regardé = un onglet était déjà au premier plan au tic précédent. Lu AVANT
        // de marquer celui-ci : sinon, en rouvrant X, tout le temps passé sans
        // onglet ouvert (horloge figée depuis) serait compté comme regardé.
        const absence = now - num(CLE_VU);
        const regarde = absence < GRACE_MS;
        if (auPremierPlan() && !enCours) {
            ecrire(CLE_VU, String(now));
            if (lectureArticle()) ecrire(CLE_ARTICLE_VU, String(now));
        }
        const article = now - num(CLE_ARTICLE_VU) < GRACE_MS;
        const maj = num(CLE_MAJ) || now;
        let dt = (now - maj) / 1000;
        if (dt <= 0) { ecrire(CLE_MAJ, String(now)); return; }
        if (dt > 3600) dt = 3600;   // après une veille machine : au plus 1 h d'un coup
        let base = num(CLE_BASE), surcout = num(CLE_SURCOUT);
        const recup = num(CLE_RECUP);
        if (recup && now >= recup) {
            base = 0; surcout = 0;                                   // l'attente est finie : jauge rendue
            ecrire(CLE_RECUP, '0');
        } else if (enCours || recup) {
            // pendant la séquence, ou jauge épuisée en attente : solde gelé
        } else if (absence >= ATTENTE_MIN * 60000) {
            base = 0; surcout = 0;                                   // 60 min loin de X : jauge rendue
        } else if (article) {
            // on lit un article : jauge figée (ni remplie, ni décompte d'absence)
        } else if (regarde) {
            base += dt;                                              // on regarde X : +1 s/s
            if (now - num(CLE_DEFILE_VU) < GRACE_MS) surcout += dt * (COUT_DEFILEMENT - 1);
        }
        // on a quitté X depuis moins de ATTENTE_MIN : rien ne bouge
        ecrire(CLE_BASE, String(base));
        ecrire(CLE_SURCOUT, String(surcout));
        ecrire(CLE_MAJ, String(now));
    }

    // --- Mesure du défilement -----------------------------------------------------
    // Un défilement de l'utilisateur (molette, tactile, ou clavier/ascenseur juste
    // avant) marque l'instant : tant qu'il dure, la jauge monte COUT_DEFILEMENT fois
    // plus vite. Rien de X n'est intercepté.
    let dernierGeste = -Infinity;
    function noterDefilement() {
        if (!auPremierPlan() || enCours) return;
        const now = String(Date.now());
        ecrire(CLE_VU, now);
        ecrire(CLE_DEFILE_VU, now);
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

    // --- Déclenchement synchronisé ----------------------------------------------------
    // - une séquence est en cours : l'onglet la rejoint, calé sur la même horloge,
    //   et affiche exactement la même image ;
    // - la jauge est pleine : l'onglet VISIBLE en lance une nouvelle, note le
    //   moment où la jauge sera rendue (la fin de la séquence), et l'événement
    //   « storage » fait démarrer tous les autres onglets au même instant.

    function verifier() {
        const html = document.documentElement;
        if (!html || enCours) return;
        let debut = lireDebut();
        const maintenant = Date.now();
        if (maintenant - debut >= T_FIN * 1000) {
            const {regard, surcout} = consommation();
            if (document.visibilityState !== 'visible' || regard + surcout < BUDGET_S) return;
            debut = maintenant;
            if (!num(CLE_RECUP)) ecrire(CLE_RECUP, String(maintenant + T_FIN * 1000));
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
    // sans défiler, soit tout bonnement ce qui reste à remplir dans la jauge.
    // Il descend d'une seconde par seconde quand on regarde, deux fois plus vite
    // quand on défile, et ne remonte pas quand on quitte X.
    function secondesAvantTrop({regard, surcout}) {
        return Math.max(0, BUDGET_S - regard - surcout);
    }
    const duree = s => {
        s = Math.max(0, Math.round(s));
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };

    // Un panneau, une jauge : la barre se remplit du temps passé à regarder (blanc)
    // et de ce que le défilement a coûté en plus (rouge). Le voyant « ×2 » s'allume
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
    .voyant.article { background: #30d158; color: #000; }
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
        // Loin de X (fenêtre visible mais sans le focus) : le titre montre le
        // décompte avant que la jauge soit rendue
        const absence = Date.now() - num(CLE_VU);
        const rendue = !num(CLE_RECUP) && absence >= GRACE_MS && conso.regard + conso.surcout > 0;
        ui.titre.textContent = rendue ? `Rendu dans ${duree(ATTENTE_MIN * 60 - absence / 1000)}` : `${MOT} dans ${duree(s)}`;
        ui.titre.classList.toggle('urgent', !rendue && s < 60);
        // Article en cours de lecture : le voyant passe au vert, « ARTICLE », jauge figée
        const article = Date.now() - num(CLE_ARTICLE_VU) < GRACE_MS;
        ui.voyant.textContent = article ? 'ARTICLE' : `×${COUT_DEFILEMENT}`;
        ui.voyant.classList.toggle('article', article);
        ui.voyant.classList.toggle('actif', !article && Date.now() - num(CLE_DEFILE_VU) < GRACE_MS);

        const regard = Math.min(conso.regard, BUDGET_S);
        const surcout = Math.min(conso.surcout, BUDGET_S - regard);
        ui.regard.style.width = (100 * regard / BUDGET_S) + '%';
        ui.surcout.style.left = ui.regard.style.width;
        ui.surcout.style.width = (100 * surcout / BUDGET_S) + '%';
        ui.total.textContent = `${duree(Math.min(conso.regard + conso.surcout, BUDGET_S))} / ${BUDGET_MIN}:00`;
        ui.perdu.textContent = conso.surcout >= 1 ? `−${duree(conso.surcout)} en défilant` : '';
    }

    // Pour certains gestionnaires, document-start tombe avant même que <html>
    // existe : on attend alors sa création (aucune saisie possible entre-temps).
    const toutVerifier = () => { avancer(); verifier(); majCompteur(); };
    if (document.documentElement) toutVerifier();
    else new MutationObserver((_, o) => {
        if (!document.documentElement) return;
        o.disconnect();
        toutVerifier();
    }).observe(document, {childList: true});
    addEventListener('storage', e => {
        if (e.key === CLE) verifier();
        if (e.key === CLE || e.key === CLE_BASE || e.key === CLE_SURCOUT || e.key === CLE_RECUP) majCompteur();
    });
    document.addEventListener('visibilitychange', toutVerifier);
    // Changer de bureau (Space) ou d'appli ne change pas la visibilité mais fait
    // perdre/reprendre le focus : on recalcule aussitôt pour que la jauge se mette
    // à se remplir (ou à s'arrêter) sans attendre le tic suivant.
    addEventListener('blur', toutVerifier);
    addEventListener('focus', toutVerifier);
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

        // X lance ses vidéos tout seul : on les remet en pause pendant la séquence.
        // Le listener « play » rattrape toute lecture qui DÉMARRE ; mais une vidéo
        // déjà en cours au déclenchement ne refire pas « play », donc son son
        // continuerait derrière le noir : on met en pause tout de suite ce qui joue.
        const pasDeLecture = e => { if (e.target instanceof HTMLMediaElement) e.target.pause(); };
        document.addEventListener('play', pasDeLecture, true);
        document.querySelectorAll('video, audio').forEach(m => { try { m.pause(); } catch (e) { /* lecture protégée */ } });

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
        // Hasard reproductible pour les fissures et les éclats : tiré d'une graine
        // faite de l'heure de début de la séquence (commune à tous les onglets) et
        // du rang de la lettre. Chaque onglet, chaque rechargement, brise donc la
        // lettre exactement de la même façon (mise à l'échelle de sa taille).
        const hasardGraine = graine => {
            let a = (graine >>> 0) || 1;
            return (x, y) => {   // mulberry32
                a = (a + 0x6D2B79F5) >>> 0;
                let t = a;
                t = Math.imul(t ^ (t >>> 15), t | 1);
                t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
                return x + (((t ^ (t >>> 14)) >>> 0) / 4294967296) * (y - x);
            };
        };
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

        function briser(lettre, rang) {
            const hasard = hasardGraine(Math.imul((debut % 2147483647) ^ 0x5bd1e995, rang + 1) + rang);
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
            // La lettre entière reste dessous jusqu'à la chute : elle masque les
            // joints des éclats, qui sinon dessineraient d'avance toutes les fissures

            // Les fissures, en noir, apparaissent une à une pendant ~3 minutes : le
            // choc ouvre les premières depuis le point d'impact, puis chaque rayon
            // s'allonge par tronçons et les anneaux se referment, de plus en plus
            // vite. Chaque nouvelle fissure secoue la lettre. Tout est calé sur
            // l'horloge t (et non sur des animations à délai) : un onglet qui
            // rejoint la séquence en cours voit la lettre au même stade.
            const svg = document.createElementNS(SVG, 'svg');
            svg.setAttribute('width', w);
            svg.setAttribute('height', h);
            const trait = Math.max(2, taille * 0.012);
            const segments = [];
            const tracer = (pts, rang) => {
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
                segments.push({p, rang});
            };
            // Rang = ordre d'apparition : le cœur des rayons d'abord, leurs bouts
            // ensuite (dans l'ordre, sur un même rayon), les anneaux en dernier
            for (let i = 0; i < n; i++) {
                const rangs = [0, 1, 2].map(k => k * 0.3 + hasard(0, 0.35)).sort((a, b) => a - b);
                for (let k = 0; k < 3; k++) tracer([Q[i][k], B[i][k], Q[i][k + 1]], rangs[k]);
                for (const k of [1, 2]) tracer([Q[i][k], ...A[i][k], Q[(i + 1) % n][k]], 0.2 + 0.3 * k + hasard(0, 0.35));
            }
            // Chaque fissure avance en deux temps : elle s'ouvre à moitié, puis se
            // prolonge jusqu'au bout un peu plus tard (deux étapes par fissure)
            const etapes = segments.flatMap(sg => [
                {sg, moitie: 0, rang: sg.rang},
                {sg, moitie: 1, rang: sg.rang + hasard(0.05, 0.3)},
            ]).sort((a, b) => a.rang - b.rang);
            // Le choc ouvre d'un coup les premières fissures ; les autres viennent
            // ensuite, de plus en plus serrées (puissance 0,65 : rares au début)
            const IMPACT = 3, DUREE_FISSURES = T_AVANT_CHUTE - 2;
            const N = etapes.length;
            etapes.forEach((ps, j) => {
                const impact = j < IMPACT;
                ps.t0 = impact ? 0 : DUREE_FISSURES * Math.pow((j - IMPACT + 1) / (N - IMPACT), 0.65);
                ps.duree = impact ? 0.7 : hasard(0.25, 0.6);
                ps.choc = impact ? 18 : 4 + 8 * ps.t0 / DUREE_FISSURES;
            });
            lettre.el.appendChild(svg);
            lettre.svg = svg;
            lettre.segments = segments;
            lettre.etapes = etapes;
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
            // (pendant le bris, la nervosité monte à mesure que la lettre se fissure)
            let force = 0;
            if (t < T_COEUR + 0.3) force = 2 + 9 * borne(t / T_COEUR) + 14 * p + (t < T_ENTREE ? 10 : 0);
            else if (t < T_FONDU) force = 1.2 + 2.5 * borne(((t - T_FISSURE) % ECART_FISSURE) / T_AVANT_CHUTE);
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
                if (t >= tFissure && !l.eclats) {
                    fissuresPosees = true;
                    briser(l, i);
                }
                const vieFissure = t - tFissure;

                // Les fissures s'ouvrent à leur heure ; chacune donne un choc à la lettre
                let choc = 0, ouvertes = 0;
                if (l.segments) {
                    l.segments.forEach(sg => { sg.ouvert = 0; });
                    l.etapes.forEach(ps => {
                        const v = vieFissure - ps.t0;
                        if (v < 0) return;
                        ouvertes++;
                        ps.sg.ouvert += 0.5 * (1 - Math.pow(1 - borne(v / ps.duree), 3));
                        if (v < 0.6) choc += ps.choc * Math.exp(-v / 0.09);
                    });
                    l.segments.forEach(sg => { sg.p.style.strokeDashoffset = String(1 - sg.ouvert); });
                }
                const cx = secousse[i].x + choc * hasard(-1, 1);
                const cy = secousse[i].y + choc * hasard(-1, 1);
                l.el.style.transform = `translate(${cx}px, ${cy}px) scale(${s})`;
                l.el.style.opacity = String(borne(u * 3));
                if (!l.eclats) return;

                // La lettre se disjoint à mesure que les fissures s'ouvrent
                const disjoint = ouvertes / l.etapes.length;
                l.eclats.forEach(e => {
                    const tc = t - tFissure - T_AVANT_CHUTE - e.retard;
                    if (tc <= 0) {
                        // Avant la chute : les éclats s'écartent à peine, la lettre se disjoint
                        const ecart = e.ecart * disjoint;
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
                l.el.style.color = t > tChute ? 'transparent' : '';
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
