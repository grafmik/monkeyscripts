// ==UserScript==
// @name        Double Dette : sauter la fin du niveau
// @namespace   Violentmonkey Scripts
// @version     1.0.0
//
// @match       https://double-dette.vercel.app/*
// @run-at      document-start
// @inject-into page
// @noframes
// @grant       none
//
// @author      Mik
// @description Raccourcis « , » (quasi-fin du niveau, puis niveau suivant au 2e appui) et « . » (niveau suivant directement) dans Double Dette.
// ==/UserScript==

(function() {
    'use strict';

    // Le jeu (un seul <canvas>) ne pose rien d'utile sur window : tout vit dans
    // des closures de modules. Il construit pourtant pour ses tests un objet
    // debug:{world, game} par niveau. On bloque le script d'entrée, on recharge
    // le bundle en y exposant cet objet (window.__ddSim), et on démarre le jeu
    // nous-mêmes. La CSP du site autorise les modules blob:.
    const RECUL = 220;          // px laissés avant la ligne d'arrivée (ou le déclencheur du boss)
    const PV_BOSS = 1;          // PV laissés au boss final : un coup suffit
    const DELAI_RESULTATS = 1200; // ms avant de valider l'écran de résultats (il ignore les touches pendant 1 s)

    // --- Chargement du jeu patché ---------------------------------------------

    const estEntree = n => n.tagName === 'SCRIPT' && n.type === 'module' && /\/assets\/index-[\w-]+\.js$/.test(n.src);
    const obs = new MutationObserver(muts => {
        for (const m of muts) for (const n of m.addedNodes) {
            if (!estEntree(n)) continue;
            obs.disconnect();
            // Un observer passe avant l'exécution d'un script inséré par le parseur :
            // changer son type suffit à l'empêcher de tourner.
            n.type = 'javascript/bloque';
            demarrer(n.src).catch(e => {
                console.error('[double-dette-skip] chargement patché impossible, jeu d\'origine relancé', e);
                n.remove();
                const s = document.createElement('script');
                s.type = 'module';
                s.src = n.src;
                document.head.appendChild(s);
            });
            return;
        }
    });
    obs.observe(document, { childList: true, subtree: true });

    async function demarrer(srcEntree) {
        const base = srcEntree.replace(/[^/]+$/, '');
        const entree = await (await fetch(srcEntree)).text();
        const app = entree.match(/app-[\w-]+\.js/)[0];
        const platform = entree.match(/platform-[\w-]+\.js/)[0];
        let code = await (await fetch(base + app)).text();
        const patche = code.replace(/debug:\{world:(\w+),game:(\w+)\}/, 'debug:(window.__ddSim={world:$1,game:$2})');
        if (patche === code) throw new Error('ancre « debug:{world,game} » introuvable');
        code = patche
            // Depuis un blob:, les chemins relatifs ne se résolvent plus.
            .replace(/from"\.\/([\w-]+\.js)"/g, (_, f) => `from"${base}${f}"`)
            .split('import.meta.url').join(JSON.stringify(base + app));
        const blob = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
        if (document.readyState === 'loading') {
            await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
        }
        const { createPlatform } = await import(base + platform);
        const { createApp } = await import(blob);
        await (await createApp(createPlatform(document.getElementById('game')))).start();
    }

    // --- Sauts -----------------------------------------------------------------

    const niveau = () => {
        const s = window.__ddSim;
        return window.__dd?.scene === 'level' && s?.game?.level ? s : null;
    };
    let quasiFait = null;       // niveau (objet du jeu) sur lequel « , » a déjà servi
    let bossAAffaiblir = null;  // rencontre finale dont le boss doit tomber à PV_BOSS

    function teleporter(s, x) {
        const w = s.world, def = s.game.level.def;
        w.camera.reset(x - 200, w.levelLength);
        w.floor.setBand(def.floor.top, def.floor.bottom, 0);
        const y = (def.floor.top + def.floor.bottom) / 2;
        for (let i = 0; i < 2; i++) {
            const p = w.players[i];
            if (!p?.alive) continue;
            p.x = p.px = x + i * 50;
            p.y = p.py = y + i * 20;
            p.vx = p.vy = 0;
        }
    }

    // Tout est réglé sauf la toute fin : quelques pas vers la droite, ou un coup
    // sur le boss final, et le jeu termine le niveau lui-même (score, résultats).
    function quasiFin(s) {
        const w = s.world, g = s.game, L = g.level;
        if (L.def.kind === 'bonus') {
            L.bonusTimer = Math.min(L.bonusTimer, 180);
            return 'Bonus : 3 s restantes';
        }
        const encs = L.encounters;
        const fin = encs.find(e => e.def.role === 'final') || encs.find(e => e.def.role === 'boss') || encs[encs.length - 1];
        if (fin?.state === 'active') {
            bossAAffaiblir = fin;
            return 'Boss à 1 PV';
        }
        w.spawns.clear();
        for (const a of w.live) if (a.alive && (a.kind === 'enemy' || a.kind === 'boss')) w.despawn(a);
        for (const e of L.events) e.fired = true;   // plus de dialogues ni de scripts en route
        for (const a of L.arenas) a.state = 'cleared';
        for (const e of encs) if (e !== fin) { e.state = 'done'; e.arena.state = 'cleared'; }
        L.active = null;
        L.timer = null;
        L.goArrow = 'off';
        L.fleers.length = 0;
        w.camera.unlock();
        if (!fin) {
            teleporter(s, L.def.length - g.t.level.finishMargin - RECUL);
            return 'Quasi-fin : avancez →';
        }
        // Le jeu lance lui-même le combat final (intro comprise) en passant le déclencheur.
        teleporter(s, Math.max(fin.arena.def.bounds.left, fin.arena.def.trigger - RECUL));
        bossAAffaiblir = fin;
        return 'Quasi-fin : avancez → boss à 1 PV';
    }

    function suivant(s) {
        const L = s.game.level;
        if (L.completeAt < 0) {
            L.completeAt = s.world.tick;
            L.onComplete();
        }
        validerResultats();
        return 'Niveau suivant';
    }

    // L'écran de résultats attend Entrée ; l'intro du niveau suivant avance seule.
    function validerResultats() {
        const debut = Date.now();
        let vu = 0;
        const t = setInterval(() => {
            const scene = window.__dd?.scene;
            if (scene === 'results') {
                if (!vu) vu = Date.now();
                if (Date.now() - vu >= DELAI_RESULTATS) appuyer('Enter');
            } else if (vu || Date.now() - debut > 15000) {
                clearInterval(t);
            }
        }, 400);
    }

    function appuyer(code) {
        const ev = type => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
        ev('keydown');
        setTimeout(() => ev('keyup'), 60);
    }

    setInterval(() => {
        const fin = bossAAffaiblir, s = window.__ddSim;
        if (!fin || !s?.game) return;
        if (!s.game.level.encounters.includes(fin) || fin.state === 'done') { bossAAffaiblir = null; return; }
        const b = s.game.boss.list.find(b => b.id === fin.bossId), a = b && s.world.actor(b.id);
        if (!a || b.intro > 0) return;
        a.hp = Math.min(a.hp, PV_BOSS);
        bossAAffaiblir = null;
    }, 100);

    // --- Clavier ---------------------------------------------------------------

    window.addEventListener('keydown', e => {
        if (e.key !== ',' && e.key !== '.') return;
        if (e.ctrlKey || e.metaKey || e.altKey || !e.isTrusted) return;
        const s = niveau();
        if (!s) return;
        // Capture + arrêt : une des dispositions clavier du jeu met l'attaque sur « . ».
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat || s.game.level.completeAt >= 0) return;
        let msg;
        if (e.key === '.' || quasiFait === s.game.level) {
            msg = suivant(s);
        } else {
            quasiFait = s.game.level;
            msg = quasiFin(s);
        }
        bulle(msg);
    }, true);
    window.addEventListener('keyup', e => {
        if ((e.key === ',' || e.key === '.') && e.isTrusted && niveau()) e.stopImmediatePropagation();
    }, true);

    let bulleEl = null, bulleT = 0;
    function bulle(texte) {
        if (!bulleEl) {
            bulleEl = document.createElement('div');
            bulleEl.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:9;'
                + 'padding:6px 14px;background:rgba(6,6,29,.85);color:#ffd84a;border:1px solid #ffd84a;'
                + 'font:600 15px/1.3 system-ui,sans-serif;pointer-events:none;transition:opacity .3s';
            document.body.appendChild(bulleEl);
        }
        bulleEl.textContent = texte;
        bulleEl.style.opacity = '1';
        clearTimeout(bulleT);
        bulleT = setTimeout(() => { bulleEl.style.opacity = '0'; }, 1600);
    }
})();
