// ==UserScript==
// @name        Suno : télécharger la librairie ou l'écran
// @namespace   Violentmonkey Scripts
// @version     1.2.1
//
// @match       https://suno.com/*
// @run-at      document-idle
// @noframes
// @grant       GM_download
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @connect     suno-data-uploads.s3.amazonaws.com
// @connect     cdn*.suno.ai
//
// @author      Mik
// @description Récupère en MP3 toutes les chansons de sa librairie Suno, ou celles visibles à l'écran, dans ~/Downloads/suno-<compte> (ex. suno-grafmik). Téléchargement officiel pour les chansons débloquées ; les non débloquées (quota) sont récupérées directement via leur flux d'écoute (audio_url), sans appel API en plus. Téléchargements en parallèle (jusqu'à 4).
// ==/UserScript==

(function() {
    'use strict';

    const API = 'https://studio-api-prod.suno.com';
    const ATTENTE_PRET_S = 90;   // délai max pendant que Suno prépare un MP3 (« processing »)
    const CONCURRENCE = 4;       // téléchargements en parallèle pour aller plus vite en librairie
    const ID_RE = /\/song\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

    const pause = ms => new Promise(r => setTimeout(r, ms));

    // ---------- API Suno ----------

    // Jeton Clerk : relu à chaque appel, Suno le renouvelle toutes les minutes.
    function jeton() {
        return document.cookie.match(/(?:^|;\s*)__session=([^;]+)/)?.[1] || null;
    }

    async function api(chemin) {
        for (let essai = 0; essai < 4; essai++) {
            const t = jeton();
            if (!t) throw new Error('pas connecté à Suno');
            const r = await fetch(API + chemin, { headers: { Authorization: 'Bearer ' + t } });
            if (r.status === 401 || r.status === 429) { await pause(3000 * (essai + 1)); continue; }
            if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`);
            return r.json();
        }
        throw new Error(`${chemin} : refusé (jeton expiré ou trop de requêtes)`);
    }

    // Nom du compte (handle), demandé dès le chargement : au clic, le sélecteur
    // de dossier doit s'ouvrir sans attendre le réseau (geste utilisateur).
    let compte = null;
    const compteP = api('/api/session/')
        .then(s => (compte = s.user?.handle || s.user?.username || null))
        .catch(() => null);

    async function librairie(progres) {
        const clips = [];
        for (let page = 0; page < 1000; page++) {
            const j = await api('/api/feed/v2?page=' + page);
            clips.push(...(j.clips || []));
            progres(`Lecture de la librairie… ${clips.length}${j.num_total_results ? '/' + j.num_total_results : ''}`);
            if (!j.has_more || !j.clips?.length) break;
        }
        return clips.filter(c => !c.is_trashed);
    }

    function idsALEcran() {
        const ids = new Set();
        const ici = location.pathname.match(ID_RE);
        if (ici) ids.add(ici[1]);
        for (const a of document.querySelectorAll('a[href*="/song/"]')) {
            const b = a.getBoundingClientRect();
            if (!b.width || b.bottom <= 0 || b.top >= innerHeight || b.right <= 0 || b.left >= innerWidth) continue;
            const m = a.getAttribute('href').match(ID_RE);
            if (m) ids.add(m[1]);
        }
        return [...ids];
    }

    // Flux d'écoute d'un clip : URL directe du MP3 servi par le CDN, sans avoir à
    // « débloquer » la chanson (pas besoin de consommer le quota de téléchargements).
    async function adresseStream(id) {
        const j = await api('/api/clip/' + id);
        const url = j.audio_url || j.source_stream_audio_url || j.stream_audio_url || j.source_audio_url;
        if (!url) throw new Error('pas de flux d\'écoute disponible');
        return url;
    }

    // Adresse du MP3 d'un clip. Pour une chanson non débloquée, on utilise directement
    // le flux d'écoute (audio_url) déjà présent dans les données de la librairie ou du
    // clip lu à l'écran : aucun appel API supplémentaire, aucun quota consommé. Pour une
    // chanson débloquée, on passe par le téléchargement officiel (fichier fiable).
    async function adresseMp3(clip) {
        const urlFlux = clip.audio_url || clip.source_stream_audio_url || clip.stream_audio_url || clip.source_audio_url;
        if (clip.is_download_unlocked === false) {
            if (urlFlux) return urlFlux;                     // flux d'écoute déjà dans les données
        } else {
            const fin = Date.now() + ATTENTE_PRET_S * 1000;
            while (true) {
                const j = await api(`/api/download/clip/${clip.id}?format=mp3`);
                if (j.download_url) return j.download_url;
                if (j.ok === false) break;                   // not_authorized : finalement pas débloquée
                if (Date.now() > fin) throw new Error('MP3 toujours en préparation chez Suno');
                await pause(2500);                           // status « processing »
            }
        }
        // Repli : les données ne portaient pas le flux (ex. lecture à l'écran échouée),
        // on va le chercher via /api/clip/<id>.
        return adresseStream(clip.id);
    }

    // ---------- Écriture des fichiers ----------

    function nomFichier(clip) {
        const titre = (clip.title || 'sans titre')
            .replace(/[\/\\:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
        return `${titre} - ${clip.id.slice(0, 8)}.mp3`;   // deux prises par génération : même titre
    }

    // Chrome/Edge : dossier choisi une fois (File System Access), mémorisé dans IndexedDB.
    // On voit ce qui est déjà dans le dossier : rien n'est retéléchargé.
    const fsa = typeof window.showDirectoryPicker === 'function';

    function idb(mode, fn) {
        return new Promise((ok, ko) => {
            const req = indexedDB.open('suno-download', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('dossiers');
            req.onerror = () => ko(req.error);
            req.onsuccess = () => {
                const tx = req.result.transaction('dossiers', mode);
                const r = fn(tx.objectStore('dossiers'));
                tx.oncomplete = () => ok(r?.result);
                tx.onerror = () => ko(tx.error);
            };
        });
    }

    // Appelé pendant le clic (geste utilisateur) : autorisation ou sélecteur.
    // Chrome refuse parfois de donner tout ~/Downloads : on peut alors y créer
    // et choisir directement le dossier suno-<compte>.
    async function dossierCompte(nom, etat) {
        let racine = await idb('readonly', s => s.get(nom)).catch(() => null);
        if (racine && await racine.requestPermission({ mode: 'readwrite' }) !== 'granted') racine = null;
        if (!racine) {
            etat(`Choisir le dossier Téléchargements (ou y créer et choisir « ${nom} »).`);
            racine = await window.showDirectoryPicker({ id: 'suno-download', mode: 'readwrite', startIn: 'downloads' });
            await idb('readwrite', s => s.put(racine, nom)).catch(() => {});
        }
        return racine.name === nom ? racine : racine.getDirectoryHandle(nom, { create: true });
    }

    // Un vrai MP3 commence par « ID3 » ou par un header de trame MPEG (0xFF 0xE0…).
    // Quand le CDN refuse le flux d'écoute, il renvoie une petite erreur XML
    // (≈ 111 octets) : on ne veut pas l'enregistrer en `.mp3`.
    function mp3Valide(buf) {
        if (buf.byteLength < 1024) return false;   // un MP3 fait au moins ~1 Ko
        const d = new Uint8Array(buf);
        if (d[0] === 0x49 && d[1] === 0x44 && d[2] === 0x33) return true;   // « ID3 »
        for (let i = 0; i < Math.min(d.length - 1, 32); i++) {
            if (d[i] === 0xFF && (d[i + 1] & 0xE0) === 0xE0) return true;   // sync MPEG
            if (d[i] !== 0) break;   // octet non nul qui n'est pas un sync : pas un MP3
        }
        return false;
    }

    async function existe(dossier, fichier) {
        try {
            const meta = await (await dossier.getFileHandle(fichier)).getFile();
            return meta.size > 1024;   // un fichier de 111 octets est une erreur du CDN : à refaire
        } catch { return false; }
    }

    async function ecrireFsa(dossier, fichier, url) {
        const r = await fetch(url, { credentials: 'include' });   // cookie signé CloudFront pour le flux
        if (!r.ok) throw new Error('MP3 : HTTP ' + r.status);
        const buf = await r.arrayBuffer();
        if (!mp3Valide(buf)) throw new Error('réponse non-MP3 (CDN refusé ?)');
        const f = await (await dossier.getFileHandle(fichier, { create: true })).createWritable();
        await f.write(buf);
        await f.close();
    }

    // Ailleurs (Firefox) : GM_download avec un sous-dossier (Tampermonkey : régler
    // « Download Mode » sur « Browser API »). Les chansons faites sont mémorisées.
    // On vérifie d'abord le contenu (un fetch, pas d'écriture) pour ne pas laisser
    // une erreur XML du CDN arriver en `.mp3`.
    async function ecrireGm(nom, fichier, url) {
        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) throw new Error('MP3 : HTTP ' + r.status);
        const buf = await r.arrayBuffer();
        if (!mp3Valide(buf)) throw new Error('réponse non-MP3 (CDN refusé ?)');
        return new Promise((ok, ko) => GM_download({
            url, name: `${nom}/${fichier}`, conflictAction: 'overwrite', saveAs: false,
            onload: ok, onerror: e => ko(new Error('GM_download : ' + (e?.error || 'échec'))),
            ontimeout: () => ko(new Error('GM_download : délai dépassé')),
        }));
    }

    // ---------- Déroulé ----------

    let enCours = false;

    async function lancer(mode) {
        if (enCours) return;
        enCours = true;
        const etat = panneau.etat;
        try {
            const handle = compte || await compteP;
            if (!handle) throw new Error('compte Suno introuvable (connecté ?)');
            const nom = 'suno-' + handle;
            const dossier = fsa ? await dossierCompte(nom, etat) : null;
            const faits = new Set(fsa ? [] : GM_getValue('faits:' + nom, []));

            let clips;
            if (mode === 'librairie') {
                clips = await librairie(etat);
            } else {
                const ids = idsALEcran();
                if (!ids.length) { etat('Aucune chanson à l\'écran.'); return; }
                clips = [];
                for (const id of ids) {
                    etat(`Lecture des chansons à l'écran… ${clips.length + 1}/${ids.length}`);
                    try { clips.push(await api('/api/clip/' + id)); } catch { clips.push({ id, title: id }); }
                }
            }

            let ok = 0, deja = 0, flux = 0;
            const erreurs = [];
            let suivant = 0;
            const travailleurs = Array(Math.min(CONCURRENCE, clips.length)).fill().map(async () => {
                while (suivant < clips.length) {
                    const i = suivant++;
                    const clip = clips[i];
                    const fichier = nomFichier(clip);
                    etat(`${i + 1}/${clips.length} · ${clip.title || clip.id}`);
                    if (fsa ? await existe(dossier, fichier) : faits.has(clip.id)) { deja++; continue; }
                    try {
                        const url = await adresseMp3(clip);
                        // adresseMp3 : téléchargement officiel (débloquée), sinon flux d'écoute.
                        // L'URL officielle vient toujours du bucket s3 ; les autres sont le flux d'écoute.
                        if (!/suno-data-uploads\.s3\.amazonaws\.com/.test(url)) flux++;
                        if (fsa) await ecrireFsa(dossier, fichier, url);
                        else { await ecrireGm(nom, fichier, url); faits.add(clip.id); }
                        ok++;
                    } catch (e) {
                        erreurs.push(`${clip.title || clip.id} : ${e.message}`);
                    }
                }
            });
            await Promise.all(travailleurs);
            if (!fsa) GM_setValue('faits:' + nom, [...faits]);   // mémorise tout d'un coup (évite les courses)

            const lignes = [`~/Downloads/${nom} : ${ok} téléchargée(s), ${deja} déjà là.`];
            if (flux) lignes.push(`${flux} récupérée(s) via le flux d'écoute (non débloquée(s), sans consommer le quota).`);
            if (erreurs.length) lignes.push(`${erreurs.length} erreur(s) :`, ...erreurs.map(e => '  · ' + e));
            etat(lignes.join('\n'));
            console.info('[suno-download]\n' + lignes.join('\n'));
        } catch (e) {
            etat(e.name === 'AbortError' ? 'Annulé.' : 'Erreur : ' + e.message);
        } finally {
            enCours = false;
        }
    }

    // ---------- Panneau ----------

    function el(tag, props = {}, ...enfants) {
        const n = Object.assign(document.createElement(tag), props);
        n.append(...enfants);
        return n;
    }

    const panneau = (() => {
        const hote = el('div');
        hote.style.cssText = 'position:fixed;right:16px;bottom:96px;z-index:2147483646';
        const ombre = hote.attachShadow({ mode: 'open' });
        const style = el('style', { textContent: `
            .p { font: 13px/1.35 system-ui, sans-serif; color: #eee; background: rgba(20,20,20,.92);
                 border: 1px solid #444; border-radius: 12px; padding: 8px; max-width: 360px;
                 box-shadow: 0 4px 16px rgba(0,0,0,.5) }
            .b { display: flex; gap: 6px; align-items: center }
            button { font: inherit; color: #eee; background: #333; border: 1px solid #555;
                     border-radius: 8px; padding: 5px 10px; cursor: pointer }
            button:hover { background: #444 }
            .x { background: none; border: none; padding: 2px 6px; color: #999 }
            .e { white-space: pre-wrap; margin-top: 6px; max-height: 40vh; overflow: auto; font-size: 12px; color: #ccc }
            .e:empty { display: none }` });
        const message = el('div', { className: 'e' });
        const bouton = (texte, titre, mode) => {
            const b = el('button', { textContent: texte, title: titre });
            b.addEventListener('click', () => lancer(mode));
            return b;
        };
        const effacer = el('button', { className: 'x', textContent: '✕', title: 'Effacer le message' });
        effacer.addEventListener('click', () => { message.textContent = ''; });
        ombre.append(style, el('div', { className: 'p' },
            el('div', { className: 'b' },
                el('span', { textContent: '⬇', title: 'Télécharger depuis Suno' }),
                bouton('Écran', 'Chansons visibles à l\'écran (ou celle de la page)', 'ecran'),
                bouton('Librairie', 'Toutes les chansons de ma librairie', 'librairie'),
                effacer),
            message));
        document.body.appendChild(hote);
        return { etat: t => { message.textContent = t; } };
    })();

    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('Télécharger les chansons à l\'écran', () => lancer('ecran'));
        GM_registerMenuCommand('Télécharger toute la librairie', () => lancer('librairie'));
    }
})();
