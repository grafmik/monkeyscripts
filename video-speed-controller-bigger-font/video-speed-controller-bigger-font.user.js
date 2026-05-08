// ==UserScript==
// @name         VSC Controller Persistent Resizer (Lucide Icons + Shortcuts)
// @version      1.7
// @description  Agrandissement du VSC (icônes Lucide + raccourcis J/K) compatible Trusted Types
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let currentScale = parseFloat(localStorage.getItem('vsc-custom-scale')) || 1.0;
    const SVG_NS = "http://www.w3.org/2000/svg";

    // Fonctions de redimensionnement
    const scaleUp = (controller) => {
        currentScale += 0.1;
        saveAndApply(controller);
    };

    const scaleDown = (controller) => {
        currentScale = Math.max(0.5, currentScale - 0.1);
        saveAndApply(controller);
    };

    const saveAndApply = (controller) => {
        localStorage.setItem('vsc-custom-scale', currentScale);
        applyStyle(controller);
    };

    function applyStyle(controller) {
        if (controller) {
            controller.style.setProperty('transform', `scale(${currentScale})`, 'important');
            controller.style.setProperty('transform-origin', 'left top', 'important');
        }
    }

    function createSvgIcon(type) {
        const svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("width", "14");
        svg.setAttribute("height", "14");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.classList.add("lucide");

        const paths = [
            createPath("M3.5 13h6"),
            createPath("m2 16 4.5-9 4.5 9")
        ];

        if (type === 'up') {
            paths.push(createPath("M18 16V7"), createPath("m14 11 4-4 4 4"));
        } else {
            paths.push(createPath("M18 7v9"), createPath("m14 12 4 4 4-4"));
        }

        paths.forEach(p => svg.appendChild(p));
        return svg;
    }

    function createPath(d) {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", d);
        return path;
    }

    function createBtn(iconType, onClick) {
        const btn = document.createElement('button');
        btn.classList.add('resizer-btn');
        Object.assign(btn.style, {
            cursor: 'pointer', background: 'transparent', color: 'white',
            border: 'none', padding: '0 3px', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', opacity: '0.8'
        });

        const iconWrapper = document.createElement('span');
        iconWrapper.classList.add('vsc-btn-icon');
        iconWrapper.style.display = 'flex';
        iconWrapper.appendChild(createSvgIcon(iconType));
        btn.appendChild(iconWrapper);

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        };
        return btn;
    }

    function inject() {
        const host = document.querySelector('.vsc-controller');
        if (!host || !host.shadowRoot) return;

        const controller = host.shadowRoot.querySelector('#controller');
        const controls = host.shadowRoot.querySelector('#controls');

        if (controller) applyStyle(controller);

        if (controls && !host.shadowRoot.querySelector('.resizer-btn')) {
            controls.appendChild(createBtn('down', () => scaleDown(controller)));
            controls.appendChild(createBtn('up', () => scaleUp(controller)));
        }
    }

    // Gestion des raccourcis clavier
    window.addEventListener('keydown', (e) => {
        // On évite de déclencher si l'utilisateur écrit dans un champ texte
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

        const host = document.querySelector('.vsc-controller');
        if (!host || !host.shadowRoot) return;
        const controller = host.shadowRoot.querySelector('#controller');

        if (e.key.toLowerCase() === 'é') {
            scaleUp(controller);
        } else if (e.key.toLowerCase() === 'à') {
            scaleDown(controller);
        }
    }, true);

    setInterval(inject, 1000);
})();