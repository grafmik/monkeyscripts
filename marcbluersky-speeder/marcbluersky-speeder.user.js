// ==UserScript==
// @name        Controleur Vitesse MarcBluerSky
// @namespace   Violentmonkey Scripts
// @icon
// @version     1.0.0
//
// @match       https://marcbluersky.com/*
// @grant       none
//
// @author      Mik
// @description
// ==/UserScript==

(function() {
    'use strict';

    let currentSpeed = 1.5;
    let timer = null;

    function appliquerVitesse() {
        const medias = document.querySelectorAll('audio, video');
        medias.forEach(media => {
            media.playbackRate = currentSpeed;
        });
    }

    function afficherVitesse() {
        let badge = document.getElementById('speed-overlay-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'speed-overlay-badge';
            badge.style.cssText = 'position: fixed; top: 20px; right: 20px; background: rgba(0, 0, 0, 0.85); color: #ffffff; padding: 10px 16px; border-radius: 6px; font-size: 18px; font-weight: bold; font-family: sans-serif; z-index: 999999; pointer-events: none; transition: opacity 0.2s ease;';
            document.body.appendChild(badge);
        }

        badge.textContent = `${currentSpeed.toFixed(1)}x`;
        badge.style.opacity = '1';

        clearTimeout(timer);
        timer = setTimeout(() => {
            badge.style.opacity = '0';
        }, 1000);
    }

    function obtenirDateFormatee(texteDate) {
        const d = new Date();
        if (!texteDate) return d.toISOString().slice(0, 10).replace(/-/g, '');

        const txt = texteDate.toLowerCase().trim();

        if (txt.includes('hier') && !txt.includes('avant-hier')) {
            d.setDate(d.getDate() - 1);
        } else if (txt.includes('avant-hier')) {
            d.setDate(d.getDate() - 2);
        } else if (txt.includes('demain') && !txt.includes('après-demain')) {
            d.setDate(d.getDate() + 1);
        } else if (txt.includes('après-demain')) {
            d.setDate(d.getDate() + 2);
        } else if (txt.includes('il y a')) {
            const matchJours = txt.match(/il y a (\d+)\s*jour/);
            const matchSemaines = txt.match(/il y a (\d+)\s*semaine/);
            const matchMois = txt.match(/il y a (\d+)\s*mois/);
            const matchAns = txt.match(/il y a (\d+)\s*an/);

            if (matchJours) d.setDate(d.getDate() - parseInt(matchJours[1], 10));
            else if (matchSemaines) d.setDate(d.getDate() - parseInt(matchSemaines[1], 10) * 7);
            else if (matchMois) d.setMonth(d.getMonth() - parseInt(matchMois[1], 10));
            else if (matchAns) d.setFullYear(d.getFullYear() - parseInt(matchAns[1], 10));
        } else if (txt.includes('dans')) {
            const matchJours = txt.match(/dans (\d+)\s*jour/);
            const matchSemaines = txt.match(/dans (\d+)\s*semaine/);
            const matchMois = txt.match(/dans (\d+)\s*mois/);

            if (matchJours) d.setDate(d.getDate() + parseInt(matchJours[1], 10));
            else if (matchSemaines) d.setDate(d.getDate() + parseInt(matchSemaines[1], 10) * 7);
            else if (matchMois) d.setMonth(d.getMonth() + parseInt(matchMois[1], 10));
        }

        const annee = d.getFullYear();
        const mois = String(d.getMonth() + 1).padStart(2, '0');
        const jour = String(d.getDate()).padStart(2, '0');
        return `${annee}${mois}${jour}`;
    }

    function nettoyerTitre(titre) {
        return titre
            .replace(/🎵 Extrait/gi, '')
            .replace(/▶ Écouter/gi, '')
            .replace(/CHARGEMENT\.\.\./gi, '')
            .replace(/#\w+/g, '')
            .replace(/[/\\?%*:|"<>]/g, '')
            .trim();
    }

    function extraireInfosEpisode(el) {
        let parent = el.parentElement;
        let titre = '';
        let texteDate = '';

        while (parent && parent !== document.body) {
            // Refus strict si l'élément se trouve dans la section "À la une"
            if (parent.classList.contains('a-la-une') || parent.id === 'a-la-une' || (parent.innerText && parent.innerText.toLowerCase().includes('à la une du jour'))) {
                return null;
            }

            const elTitreClass = parent.querySelector('.episode-title');
            if (elTitreClass && !titre) {
                titre = elTitreClass.textContent.trim();
            }

            const timeEl = parent.querySelector('time');
            if (timeEl) {
                const datetimeAttr = timeEl.getAttribute('datetime');
                if (datetimeAttr && datetimeAttr.length >= 10) {
                    const cleanDate = datetimeAttr.slice(0, 10).replace(/-/g, '');
                    if (/^\d{8}$/.test(cleanDate)) {
                        texteDate = cleanDate;
                    }
                }
            }

            const rawText = parent.innerText || parent.textContent || '';
            const lignes = rawText.split('\n').map(l => l.trim()).filter(Boolean);

            for (const ligne of lignes) {
                const lLower = ligne.toLowerCase();
                if (!texteDate && (
                    lLower.includes('aujourd\'hui') ||
                    lLower.includes('hier') ||
                    lLower.includes('avant-hier') ||
                    lLower.includes('demain') ||
                    lLower.includes('après-demain') ||
                    lLower.includes('il y a') ||
                    lLower.includes('dans ')
                )) {
                    texteDate = ligne;
                }
            }

            if (titre && texteDate) break;
            parent = parent.parentElement;
        }

        if (!titre) return null;

        const dateFormatee = /^\d{8}$/.test(texteDate) ? texteDate : obtenirDateFormatee(texteDate);
        return { titre, dateFormatee };
    }

    function telechargerTout() {
        const tousLesElements = Array.from(document.querySelectorAll('*'));
        const enTetePublic = tousLesElements.find(el => {
            const txt = el.textContent.trim().toLowerCase();
            return txt === 'épisodes publics' || txt === 'episodes publics' || txt.includes('épisodes publics');
        });

        let conteneurPublic = null;
        if (enTetePublic) {
            let p = enTetePublic.parentElement;
            while (p && p !== document.body) {
                if (p.querySelectorAll('audio, source, [data-audio], [data-src]').length > 0) {
                    conteneurPublic = p;
                    break;
                }
                p = p.parentElement;
            }
        }

        const racine = conteneurPublic || document;
        const elementsAudio = Array.from(racine.querySelectorAll('audio, source, [data-audio], [data-src]'));
        const listeTelechargements = [];

        elementsAudio.forEach(el => {
            const url = el.src || el.getAttribute('data-audio') || el.getAttribute('data-src');
            if (!url || url.includes('click.mp3')) return;

            const infos = extraireInfosEpisode(el);
            if (!infos) return;

            const titreNettoye = nettoyerTitre(infos.titre);
            const nomFichier = `${infos.dateFormatee} - ${titreNettoye}.mp3`;

            if (!listeTelechargements.some(item => item.url === url)) {
                listeTelechargements.push({ url, nomFichier });
            }
        });

        if (listeTelechargements.length === 0) {
            alert("Aucun épisode public valide trouvé.");
            return;
        }

        listeTelechargements.forEach((item, index) => {
            setTimeout(() => {
                if (typeof GM_download === 'function') {
                    GM_download({ url: item.url, name: item.nomFichier });
                } else {
                    const a = document.createElement('a');
                    a.href = item.url;
                    a.download = item.nomFichier;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            }, index * 1000);
        });
    }

    function ajouterBoutonTelechargement() {
        if (document.getElementById('dl-all-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'dl-all-btn';
        btn.textContent = 'Télécharger Épisodes Publics';
        btn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #007bff; color: #fff; border: none; padding: 10px 15px; border-radius: 5px; font-weight: bold; cursor: pointer; z-index: 999999; font-family: sans-serif; box-shadow: 0 2px 6px rgba(0,0,0,0.3);';
        btn.onclick = telechargerTout;
        document.body.appendChild(btn);
    }

    document.addEventListener('play', function(event) {
        if (event.target instanceof HTMLMediaElement) {
            event.target.playbackRate = currentSpeed;
        }
    }, true);

    document.addEventListener('keydown', function(event) {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
            return;
        }

        const key = event.key.toLowerCase();
        if (key === 's') {
            currentSpeed = Math.max(0.1, Math.round((currentSpeed - 0.1) * 10) / 10);
            appliquerVitesse();
            afficherVitesse();
        } else if (key === 'd') {
            currentSpeed = Math.round((currentSpeed + 0.1) * 10) / 10;
            appliquerVitesse();
            afficherVitesse();
        }
    });

    window.addEventListener('DOMContentLoaded', ajouterBoutonTelechargement);
    setTimeout(ajouterBoutonTelechargement, 2000);
})();