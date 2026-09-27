// ==UserScript==
// @name        Double Dette : sauter la fin du niveau
// @namespace   Violentmonkey Scripts
// @version     3.5.0
//
// @match       https://double-dette.vercel.app/*
// @run-at      document-start
// @inject-into content
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
    // @inject-into content : en mode « page », la CSP du site bloque l'injection
    // et Violentmonkey (Firefox) ne se rabat sur le monde isolé qu'une fois le jeu
    // lancé, trop tard pour l'intercepter.
    //
    // Ce qui suit ne touche qu'au DOM : ça marche que le gestionnaire place le
    // script dans la page ou dans son monde isolé. Tout le code qui parle au jeu
    // (pageMain) est injecté comme module blob:, seul type de script que la CSP
    // du site laisse passer — une injection « page » classique y est bloquée.

    const estEntree = n => n.tagName === 'SCRIPT' && n.type === 'module' && /\/assets\/index-[\w-]+\.js$/.test(n.src);

    // Diagnostic visible en bas à droite, étape par étape, pour savoir sans
    // console où le chargement s'arrête. La page répond via un attribut du DOM
    // (data-dds), seul canal commun au monde isolé du gestionnaire et à la page.
    let diagEl = null;
    function diag(texte, erreur = true) {
        console[erreur ? 'warn' : 'info']('[double-dette-skip] ' + texte);
        if (!diagEl) {
            diagEl = document.createElement('div');
            diagEl.style.cssText = 'position:fixed;bottom:6px;right:6px;z-index:10;padding:3px 8px;'
                + 'background:rgba(6,6,29,.85);border:1px solid;font:12px/1.3 system-ui,sans-serif;pointer-events:none';
            poser(diagEl);
        }
        diagEl.textContent = 'double-dette-skip : ' + texte;
        diagEl.style.color = diagEl.style.borderColor = erreur ? '#ff6b6b' : '#8fd18f';
    }
    // À document-start, la page n'a parfois pas encore d'élément racine.
    function poser(el) {
        if (document.documentElement) { (document.body || document.documentElement).appendChild(el); return; }
        const o = new MutationObserver(() => {
            if (!document.documentElement) return;
            o.disconnect();
            document.documentElement.appendChild(el);
        });
        o.observe(document, { childList: true });
    }
    diag('script actif, en attente du jeu…', false);

    // Violentmonkey sous Firefox injecte souvent le script après la lecture de
    // la balise du jeu (page en cache). Le module d'entrée ne s'exécute qu'en fin
    // de lecture : il est trop tard pour le bloquer, pas pour le piéger (pageMain).
    const dejaLa = [...document.scripts].find(estEntree);
    if (dejaLa) {
        if ((window.wrappedJSObject || window).__dd) {
            diag('chargé trop tard (le jeu tournait déjà) : recharger la page');
            return;
        }
        diag('jeu déjà en route, piège posé…', false);
        injecter(dejaLa.src, false);
        return;
    }

    const obs = new MutationObserver(muts => {
        for (const m of muts) for (const n of m.addedNodes) {
            if (!estEntree(n)) continue;
            obs.disconnect();
            // Un observer passe avant l'exécution d'un script inséré par le parseur :
            // changer son type suffit à l'empêcher de tourner.
            n.type = 'javascript/bloque';
            diag('jeu intercepté, chargement…', false);
            injecter(n.src, true);
            return;
        }
    });
    obs.observe(document, { childList: true, subtree: true });

    function injecter(src, bloque) {
        suivrePage(bloque ? src : null);
        const code = `(${pageMain})(${JSON.stringify(src)}, ${bloque});`;
        // Firefox (Violentmonkey) : un <script> créé depuis le monde isolé
        // reste attaché à l'extension, et la page refuse de le charger ou d'y
        // faire des import(). Créé par la page elle-même, il passe.
        const d = document.wrappedJSObject || document;
        const s = d.createElement('script');
        s.type = 'module';
        try {
            s.src = urlBlobPage(code);
        } catch (e) {
            diag('blob impossible : ' + e);
            if (bloque) relancerOrigine(src);
            return;
        }
        // Pas d'onerror : sous Firefox, la page n'a pas le droit d'appeler une
        // fonction du monde isolé. suivrePage() détecte un module resté muet.
        d.head.appendChild(s);
    }

    // Firefox : un blob: créé depuis le monde isolé d'une extension appartient à
    // l'extension, et la page refuse de le charger. On le fait donc créer par la
    // page elle-même (wrappedJSObject), en ne lui passant que des valeurs à elle.
    function urlBlobPage(code) {
        const page = window.wrappedJSObject;
        if (!page) return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
        const blob = new page.Blob(page.Array.of(code), page.JSON.parse('{"type":"text/javascript"}'));
        return page.URL.createObjectURL(blob);
    }

    // srcBloque : script d'entrée à relancer si la page n'exécute jamais pageMain.
    function suivrePage(srcBloque) {
        const debut = Date.now();
        const t = setInterval(() => {
            const etat = document.documentElement.dataset.dds;
            if (!etat) {
                if (Date.now() - debut < 10000) return;
                clearInterval(t);
                diag('module refusé par la page');
                if (srcBloque) relancerOrigine(srcBloque);
                return;
            }
            if (etat === 'ok') {
                clearInterval(t);
                diag('prêt', false);
                setTimeout(() => diagEl.remove(), 3000);
            } else {
                diag(etat, etat !== 'page');
                if (etat !== 'page') clearInterval(t);
            }
        }, 300);
    }

    function relancerOrigine(src) {
        // Créé par la page elle-même (Firefox refuse un module inséré par le monde isolé).
        const d = document.wrappedJSObject || document;
        const s = d.createElement('script');
        s.type = 'module';
        s.src = src;
        d.head.appendChild(s);
    }

    // --- Tout ce qui suit tourne dans la page ----------------------------------

    function pageMain(srcEntree, bloque) {
        const RECUL = 220;          // px laissés avant la ligne d'arrivée (ou le déclencheur du boss)
        const PV_BOSS = 1;          // PV laissés au boss final : un coup suffit
        const DELAI_RESULTATS = 1200; // ms avant de valider l'écran de résultats (il ignore les touches pendant 1 s)

        const signaler = etat => { document.documentElement.dataset.dds = etat; };
        signaler('page');

        // Firefox refuse tout nouvel événement sur un paramètre audio pendant
        // qu'une courbe y est en cours (Chrome l'accepte). Les fondus du jeu en
        // enchaînent parfois deux à moins de 1,5 s, par exemple en début de
        // niveau 2 après un saut, et le jeu part alors sur son écran d'erreur.
        // Sur ce refus précis, on annule la courbe en cours et on rejoue l'appel ;
        // si Firefox refuse encore (il garde la courbe active malgré l'annulation),
        // on laisse tomber ce fondu : un réglage audio un peu en retard plutôt
        // qu'une partie perdue.
        for (const nom of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime',
            'setTargetAtTime', 'setValueCurveAtTime']) {
            const orig = AudioParam.prototype[nom];
            AudioParam.prototype[nom] = function(...args) {
                try {
                    return orig.apply(this, args);
                } catch (e) {
                    if (e.name !== 'NotSupportedError') throw e;
                    this.cancelScheduledValues(0);
                    try {
                        return orig.apply(this, args);
                    } catch (e2) {
                        if (e2.name !== 'NotSupportedError') throw e2;
                        return this;
                    }
                }
            };
        }

        // Piège pour le jeu d'origine quand il n'a pas pu être bloqué : sa
        // plateforme pose window.__dd dès sa création ; on fait échouer cette
        // affectation, ce qui arrête son démarrage. Seule la nôtre passe.
        let notreTour = false, bridge;
        if (window.__dd) {
            signaler('chargé trop tard (le jeu tournait déjà) : recharger la page');
            return;
        }
        const ECARTE = '[double-dette-skip] jeu d\'origine écarté au profit du jeu patché';
        Object.defineProperty(window, '__dd', {
            configurable: true,
            get: () => bridge,
            set: v => {
                if (!notreTour) throw new Error(ECARTE);
                bridge = v;
            },
        });
        // L'erreur du jeu écarté peut arriver après le démarrage du nôtre, dont le
        // gestionnaire d'erreurs afficherait alors son « écran bleu ». Écoutés
        // avant les siens, ces filtres l'arrêtent.
        const taire = e => {
            const err = e.reason || e.error;
            if (err && err.message === ECARTE) { e.preventDefault(); e.stopImmediatePropagation(); }
        };
        window.addEventListener('unhandledrejection', taire, true);
        window.addEventListener('error', taire, true);

        demarrer(srcEntree).catch(e => {
            signaler('chargement patché impossible : ' + (e && e.message || e));
            if (bridge) return;         // notre jeu tourne malgré l'erreur
            // Rendre la main au jeu d'origine : piège retiré, entrée relancée
            // (nouvelle URL : un module déjà évalué ne se réexécute pas).
            delete window.__dd;
            const s = document.createElement('script');
            s.type = 'module';
            s.src = srcEntree + (bloque ? '' : '?relance');
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
            notreTour = true;
            let plateforme;
            try { plateforme = createPlatform(document.getElementById('game')); } finally { notreTour = false; }
            const jeu = await createApp(plateforme);
            signaler('ok');
            await jeu.start();
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
