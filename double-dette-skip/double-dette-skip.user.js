// ==UserScript==
// @name        Double Dette : sauter la fin du niveau
// @namespace   Violentmonkey Scripts
// @version     3.0.0
//
// @match       https://double-dette.vercel.app/*
// @run-at      document-start
// @noframes
// @grant       none
//
// @author      Mik
// @description Deux boutons en haut à droite (et les touches N / M) dans Double Dette : quasi-fin du niveau, niveau suivant.
// ==/UserScript==

(function() {
    'use strict';

    // Le jeu (un seul <canvas>) ne pose rien d'utile sur window : tout vit dans
    // des closures de modules. Il construit pourtant pour ses tests un objet
    // debug:{world, game} par niveau. On bloque le script d'entrée, on recharge
    // le bundle en y exposant cet objet (window.__ddSim), et on démarre le jeu
    // nous-mêmes.
    //
    // Ce qui suit ne touche qu'au DOM : ça marche que le gestionnaire place le
    // script dans la page ou dans son monde isolé. Tout le code qui parle au jeu
    // (pageMain) est injecté comme module blob:, seul type de script que la CSP
    // du site laisse passer — une injection « page » classique y est bloquée.

    const estEntree = n => n.tagName === 'SCRIPT' && n.type === 'module' && /\/assets\/index-[\w-]+\.js$/.test(n.src);

    if ([...document.scripts].some(estEntree)) {
        console.warn('[double-dette-skip] injecté trop tard (après le chargement du jeu) : boutons indisponibles');
        return;
    }

    const obs = new MutationObserver(muts => {
        for (const m of muts) for (const n of m.addedNodes) {
            if (!estEntree(n)) continue;
            obs.disconnect();
            // Un observer passe avant l'exécution d'un script inséré par le parseur :
            // changer son type suffit à l'empêcher de tourner.
            n.type = 'javascript/bloque';
            const code = `(${pageMain})(${JSON.stringify(n.src)});`;
            const s = document.createElement('script');
            s.type = 'module';
            s.src = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
            s.onerror = () => relancerOrigine(n.src);
            (document.head || document.documentElement).appendChild(s);
            return;
        }
    });
    obs.observe(document, { childList: true, subtree: true });

    function relancerOrigine(src) {
        console.error('[double-dette-skip] module injecté refusé, jeu d\'origine relancé');
        const s = document.createElement('script');
        s.type = 'module';
        s.src = src;
        document.head.appendChild(s);
    }

    // --- Tout ce qui suit tourne dans la page ----------------------------------

    function pageMain(srcEntree) {
        const RECUL = 220;          // px laissés avant la ligne d'arrivée (ou le déclencheur du boss)
        const PV_BOSS = 1;          // PV laissés au boss final : un coup suffit
        const DELAI_RESULTATS = 1200; // ms avant de valider l'écran de résultats (il ignore les touches pendant 1 s)

        demarrer(srcEntree).catch(e => {
            console.error('[double-dette-skip] chargement patché impossible, jeu d\'origine relancé', e);
            const s = document.createElement('script');
            s.type = 'module';
            s.src = srcEntree;
            document.head.appendChild(s);
        });

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

        // e.key plutôt que e.code : « m » n'est pas au même endroit en AZERTY et en QWERTY.
        const ACTIONS = { n: quasiFin, m: suivant };
        const action = e => ACTIONS[e.key.toLowerCase()];

        window.addEventListener('keydown', e => {
            if (!action(e) || e.ctrlKey || e.metaKey || e.altKey || !e.isTrusted) return;
            const s = niveau();
            if (!s) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.repeat || s.game.level.completeAt >= 0) return;
            bulle(action(e)(s));
        }, true);
        window.addEventListener('keyup', e => {
            if (action(e) && e.isTrusted && niveau()) e.stopImmediatePropagation();
        }, true);

        // --- Boutons -----------------------------------------------------------

        const BOUTONS = [['Quasi-fin', 'N', quasiFin], ['Niveau suivant', 'M', suivant]];
        const barre = document.createElement('div');
        barre.style.cssText = 'position:fixed;top:9vh;right:1.5vw;z-index:9;display:none;gap:6px';
        for (const [texte, touche, fn] of BOUTONS) {
            const b = document.createElement('button');
            b.textContent = texte;
            b.title = `${texte} (touche ${touche})`;
            b.tabIndex = -1;    // sinon Entrée / Espace (touches du jeu) le redéclencheraient
            b.style.cssText = 'padding:4px 10px;background:rgba(6,6,29,.7);color:#ffd84a;border:1px solid #ffd84a;'
                + 'border-radius:3px;font:600 12px/1.3 system-ui,sans-serif;cursor:pointer;opacity:.6';
            b.onmouseenter = () => { b.style.opacity = '1'; };
            b.onmouseleave = () => { b.style.opacity = '.6'; };
            b.addEventListener('pointerdown', e => e.stopPropagation());
            b.addEventListener('click', e => {
                e.stopPropagation();
                const s = niveau();
                if (s && s.game.level.completeAt < 0) bulle(fn(s));
                document.getElementById('game')?.focus();
            });
            barre.appendChild(b);
        }
        const poser = () => document.body.appendChild(barre);
        document.body ? poser() : document.addEventListener('DOMContentLoaded', poser, { once: true });
        setInterval(() => { barre.style.display = niveau() ? 'flex' : 'none'; }, 250);

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
    }
})();
