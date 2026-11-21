// ==UserScript==
// @name        X : fil sans politique ni religion
// @namespace   Violentmonkey Scripts
// @version     1.0.0
//
// @match       https://x.com/*
// @match       https://twitter.com/*
// @run-at      document-idle
// @noframes
// @grant       none
//
// @author      Mik
// @description Sur le fil Accueil de X, replie les posts qui parlent de politique, de religion ou d'immigration (texte, citation, carte de lien et sous-titres auto des vidéos) et clique « Ce post ne m'intéresse pas » à rythme lent pour éduquer l'algorithme.
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Réglages ----------
  const CONFIG = {
    DRY_RUN: false,             // true = ne clique rien, se contente de masquer et journaliser
    AUTO_NOT_INTERESTED: true,  // clique « Ce post ne m'intéresse pas » sur les posts détectés
    ONLY_HOME: true,            // n'agit que sur /home (pas sur les profils, recherches, threads)
    MIN_GAP_MS: 10000,          // au moins 10 s entre deux clics
    DAILY_CAP: 80,              // au plus 80 clics par jour
    SCAN_SUBTITLES: true,       // lit les sous-titres auto des vidéos quand X en fournit
    MAX_SUB_SEGMENTS: 12,       // ne lit pas plus de 12 segments de sous-titres par vidéo
    HIDE: true,                 // replie le post détecté (un clic sur le bandeau le réaffiche)
  };

  // Comptes jamais touchés (handles sans @, minuscules)
  const WHITELIST = new Set([]);

  // Mots et expressions (insensibles à la casse et aux accents, mot entier)
  const KEYWORDS = [
    // politique FR
    'Macron', 'Le Pen', 'Bardella', 'Mélenchon', 'LFI', 'RN', 'Rassemblement national', 'Zemmour', 'Retailleau',
    'facho', 'fachos', 'gauchiste', 'gauchistes', 'woke', 'wokisme', 'islamogauchiste', 'Assemblée nationale',
    'présidentielle', 'extrême droite', 'extrême gauche', "d'Ornellas",
    'EELV', 'Tondelier', 'Sandrine Rousseau', 'Jadot', 'Hidalgo', 'Glucksmann', 'Ruffin', 'Attal', 'Bayrou',
    'Darmanin', 'Wauquiez', 'Ciotti', 'Marion Maréchal',
    // étiquettes
    'lefties', 'leftist', 'leftists', 'libtard', 'libtards', 'liberals', 'écologiste', 'écologistes', 'écolo', 'écolos',
    'gauchos', 'droitards', 'antifa', 'féministe', 'féministes', 'néoféministe', 'socialiste', 'socialistes',
    'communiste', 'communistes', 'fasciste', 'fascistes', 'nazis', 'Greta Thunberg',
    // politique US
    'MAGA', 'Trump', 'Biden', 'Kamala', 'Democrats', 'Republicans',
    // géopolitique
    'Gaza', 'Hamas', 'Israël', 'Palestine', 'sionistes', 'Poutine', 'Zelensky',
    // mobilisations
    'manif', 'grève',
    // immigration
    'migrant', 'migrants', 'immigration', 'immigrés', 'clandestins', 'OQTF', 'sans-papiers', 'grand remplacement',
    'remigration', 'insécurité',
    // religion
    'religion', 'islam', 'islamiste', 'islamisme', 'musulman', 'musulmans', 'chrétien', 'chrétiens', 'catholique',
    'mosquée', 'église', 'Coran', 'Bible', 'Jésus', 'Allah', 'charia', 'voile islamique', 'laïcité', 'pape',
  ];

  // ---------- Outils ----------
  const TAG = '[x-feed-filter]';
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'").toLowerCase().replace(/\s+/g, ' ');
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const KW_RE = new RegExp('(^|[^a-z0-9_])(' + KEYWORDS.map(k => esc(norm(k)).replace(/ /g, '\\s+')).join('|') + ')(?=$|[^a-z0-9_])');
  const match = text => { const m = norm(text).match(KW_RE); return m ? m[2] : null; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = (...a) => {
    console.log(TAG, ...a);
    try {
      const L = JSON.parse(localStorage.getItem('xff_log') || '[]');
      L.push(new Date().toISOString().slice(0, 19) + ' ' + a.join(' '));
      localStorage.setItem('xff_log', JSON.stringify(L.slice(-300)));
    } catch (e) { /* quota */ }
  };

  function tweetOf(el) {
    const k = Object.keys(el).find(k => k.startsWith('__reactFiber'));
    let f = k && el[k];
    for (let d = 0; f && d < 60; d++, f = f.return) {
      const p = f.memoizedProps;
      if (p && p.tweet && p.tweet.id_str) return p.tweet;
    }
    return null;
  }

  // ---------- Sous-titres ----------
  const subCache = new Map(); // media_key -> Promise<string>
  async function subtitlesOf(tweet) {
    const media = ((tweet.extended_entities || {}).media || []).filter(m => m.video_info);
    let all = '';
    for (const v of media) {
      const key = v.media_key || v.id_str;
      if (!subCache.has(key)) subCache.set(key, fetchSubs(v).catch(() => ''));
      all += ' ' + await subCache.get(key);
    }
    return all;
  }
  async function fetchSubs(v) {
    const hls = (v.video_info.variants || []).find(x => /mpegurl/i.test(x.content_type || ''));
    if (!hls) return '';
    const master = await (await fetch(hls.url)).text();
    const line = master.split('\n').find(l => /TYPE=SUBTITLES/.test(l));
    if (!line) return '';
    const uri = new URL(line.match(/URI="([^"]+)"/)[1], hls.url).href;
    const pl = await (await fetch(uri)).text();
    const segs = pl.split('\n').filter(l => l && !l.startsWith('#')).slice(0, CONFIG.MAX_SUB_SEGMENTS);
    let text = '';
    for (const s of segs) {
      const vtt = await (await fetch(new URL(s, uri).href)).text();
      text += ' ' + vtt.replace(/^WEBVTT.*$/m, '').replace(/<[^>]+>/g, ' ').replace(/[\d:.]+ --> [\d:.]+.*$/gm, ' ');
    }
    return text;
  }

  // ---------- Masquage ----------
  function hide(article, reason) {
    if (!CONFIG.HIDE || article.dataset.xffHidden) return;
    article.dataset.xffHidden = '1';
    const bar = document.createElement('div');
    bar.textContent = `Masqué (${reason}) — cliquer pour afficher`;
    bar.style.cssText = 'padding:6px 16px;font:13px system-ui;color:#71767b;cursor:pointer;border-bottom:1px solid #2f3336';
    bar.addEventListener('click', () => { article.style.display = ''; bar.remove(); });
    article.style.display = 'none';
    article.parentElement.insertBefore(bar, article);
  }

  // ---------- File « pas intéressé » ----------
  const queue = [];
  const done = new Set();
  const today = () => new Date().toISOString().slice(0, 10);
  function budget() {
    const c = JSON.parse(localStorage.getItem('xff_count') || '{}');
    return c.day === today() ? c : { day: today(), n: 0 };
  }
  function spend() { const c = budget(); c.n++; localStorage.setItem('xff_count', JSON.stringify(c)); }

  async function notInterested(id, handle) {
    const link = document.querySelector(`article a[href$="/status/${id}"]`);
    const article = link && link.closest('article');
    if (!article) return 'gone';
    const t = tweetOf(article);
    if (!t || t.id_str !== id) return 'mismatch';
    const caret = article.querySelector('[data-testid="caret"]');
    if (!caret) return 'no-caret';
    caret.click();
    let item = null;
    for (let i = 0; i < 20 && !item; i++) {
      await sleep(150);
      const menu = document.querySelector('[role="menu"]');
      item = menu && [...menu.querySelectorAll('[role="menuitem"]')].find(m => /ne m'int[ée]resse pas|pas int[ée]ress[ée]|not interested/i.test(m.innerText));
    }
    if (!item) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'no-item'; }
    item.click();
    return 'ok';
  }

  async function worker() {
    let last = 0;
    for (;;) {
      await sleep(1000);
      if (!queue.length) continue;
      if (Date.now() - last < CONFIG.MIN_GAP_MS) continue;
      if (CONFIG.ONLY_HOME && location.pathname !== '/home') continue;
      if (budget().n >= CONFIG.DAILY_CAP) continue;
      const job = queue.shift();
      const r = await notInterested(job.id, job.handle);
      log('pas intéressé', '@' + job.handle, job.id, job.reason, '→', r);
      if (r === 'ok') { spend(); last = Date.now(); }
    }
  }

  // ---------- Analyse des posts ----------
  async function inspect(article) {
    if (article.dataset.xffSeen) return;
    article.dataset.xffSeen = '1';
    if (CONFIG.ONLY_HOME && location.pathname !== '/home') return;
    const t = tweetOf(article);
    if (!t) return;
    const handle = ((t.user || t.core?.user_results?.result?.legacy || {}).screen_name || '').toLowerCase();
    if (WHITELIST.has(handle)) return;
    const text = [article.innerText, t.full_text, t.note_tweet?.note_tweet_results?.result?.text].join(' ');
    let hit = match(text), where = 'texte';
    if (!hit && CONFIG.SCAN_SUBTITLES) { hit = match(await subtitlesOf(t)); where = 'vidéo'; }
    if (!hit) return;
    const reason = `${where} : ${hit}`;
    hide(article, reason);
    if (CONFIG.AUTO_NOT_INTERESTED && !CONFIG.DRY_RUN && !done.has(t.id_str)) {
      done.add(t.id_str);
      queue.push({ id: t.id_str, handle, reason });
    } else {
      log('détecté', '@' + handle, t.id_str, reason, CONFIG.DRY_RUN ? '(dry run)' : '');
    }
  }

  const scan = () => document.querySelectorAll('article[data-testid="tweet"]:not([data-xff-seen])').forEach(a => { inspect(a).catch(e => log('erreur', e.message)); });
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
  worker();
  log('actif', CONFIG.DRY_RUN ? '(dry run)' : '');
})();
