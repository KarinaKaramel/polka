'use strict';
/* =====================================================================
   polka. — полка для всего, что ты сохраняешь в соцсетях.
   Ссылка → воркер достаёт подпись/видео/картинки → Gemini разбирает →
   карточка (рецепт, макияж, книги, тренировка, места…) с кадрами из видео.
   Данные: localStorage + IndexedDB (кадры), синхронизация — Google Drive.
   ===================================================================== */

const CONF = {
  worker: 'https://polka-worker.karishechka2000.workers.dev',
  gclient: '982088762046-i7278ln85vn6kie8q92e92qsd597e718.apps.googleusercontent.com',
  home: 'https://karinakaramel.github.io/polka/',
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; };
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), ms); }

/* ---------------- иконки ---------------- */
const ICONS = {
  home: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  shelf: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 12h18M8 4v8M15 12v8"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  more: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
  paste: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  clip: '<path d="m21.4 11.6-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  cloud: '<path d="M17.5 19H8a6 6 0 1 1 1.7-11.8A7 7 0 0 1 22 12.5 4.5 4.5 0 0 1 17.5 19z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  ext: '<path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8a2 2 0 0 0 2-1.6L21 7H6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  share: '<path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  map: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
};
const I = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;
const GLOGO = '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

/* ---------------- категории ---------------- */
const CATS = {
  recipe: { name: 'Рецепты', one: 'Рецепт', e: '🍳', c: '#E8833A' },
  beauty: { name: 'Макияж и уход', one: 'Макияж и уход', e: '💄', c: '#D9578A' },
  books: { name: 'Книги', one: 'Книги', e: '📚', c: '#6B5BD6' },
  workout: { name: 'Тренировки', one: 'Тренировка', e: '💪', c: '#2E9E6B' },
  places: { name: 'Места', one: 'Места', e: '📍', c: '#2B8AC9' },
  products: { name: 'Покупки', one: 'Покупки', e: '🛍️', c: '#C9A227' },
  howto: { name: 'Как сделать', one: 'Инструкция', e: '🛠️', c: '#7A8B99' },
  outfit: { name: 'Образы', one: 'Образ', e: '👗', c: '#B0569E' },
  watch: { name: 'Посмотреть', one: 'Фильмы и сериалы', e: '🎬', c: '#D64545' },
  ideas: { name: 'Идеи и советы', one: 'Идеи', e: '💡', c: '#D9A21B' },
};
const cat = t => CATS[t] || CATS.ideas;
const PLAT = { tiktok: ['TikTok', 'T'], instagram: ['Instagram', 'IG'], pinterest: ['Pinterest', 'P'], youtube: ['YouTube', '▶'], web: ['Сайт', '⌘'], file: ['Мои файлы', '⬆'] };
const pf = p => `<span class="pfi ${esc(p || 'web')}" title="${esc((PLAT[p] || PLAT.web)[0])}">${esc((PLAT[p] || PLAT.web)[1])}</span>`;
const platformOf = url => { try { const h = new URL(url).hostname; return /tiktok/.test(h) ? 'tiktok' : /instagram/.test(h) ? 'instagram' : /pinterest|pin\.it/.test(h) ? 'pinterest' : /youtu/.test(h) ? 'youtube' : 'web'; } catch (e) { return 'web'; } };

/* ---------------- состояние ---------------- */
const KEY = 'polka.state';
const blank = () => ({ version: 1, items: [], shop: [], settings: { geminiKey: '', lang: 'ru', model: 'auto', worker: '' }, settingsU: 0, tomb: {} });
let S = (() => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.items) return { ...blank(), ...s, settings: { ...blank().settings, ...s.settings } }; } catch (e) { } return blank(); })();
let ui = { tab: 'home', cat: 'all', q: '', searching: false, open: null, list: 'shop', bookF: 'all', servings: {}, checked: {} };
let saveT;
function save(now) { clearTimeout(saveT); const f = () => { stamp(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Память браузера переполнена'); } syncSoon(); }; if (now) f(); else saveT = setTimeout(f, 250); }
const workerUrl = () => (S.settings.worker || CONF.worker).replace(/\/$/, '');
const item = id => S.items.find(x => x.id === id);

/* ---------------- IndexedDB для картинок ---------------- */
const MDB = (() => {
  let dbp;
  const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('polka', 1); r.onupgradeneeded = () => r.result.createObjectStore('media'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('media', mode); const st = t.objectStore('media'); const r = fn(st); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
  const cache = new Map();
  return {
    async get(id) { if (cache.has(id)) return cache.get(id); const v = await tx('readonly', s => s.get(id)); if (v) cache.set(id, v); return v; },
    peek: id => cache.get(id),
    async put(id, v) { cache.set(id, v); await tx('readwrite', s => s.put(v, id)); },
    async del(id) { cache.delete(id); await tx('readwrite', s => s.delete(id)); },
    async keys() { return tx('readonly', s => s.getAllKeys()); },
  };
})();

/* ---------------- медиа: загрузка, сжатие, кадры из видео ---------------- */
async function fetchJ(url, opt) { const r = await fetch(url, opt); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; }
async function fetchMedia(url, ck) {
  const r = await fetch(workerUrl() + '/media?url=' + encodeURIComponent(url) + (ck ? '&ck=' + encodeURIComponent(ck) : ''));
  if (!r.ok) throw new Error('media ' + r.status);
  return r.blob();
}
function blobToImg(blob) {
  if (window.createImageBitmap) return createImageBitmap(blob).catch(() => viaImg());
  return viaImg();
  function viaImg() { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('картинка не читается')); i.src = URL.createObjectURL(blob); }); }
}
function drawScaled(src, w0, h0, max, q = .78) {
  const k = Math.min(1, max / Math.max(w0 || 1, h0 || 1));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}
async function shrink(blob, max, q) { const im = await blobToImg(blob); return drawScaled(im, im.width || im.naturalWidth, im.height || im.naturalHeight, max, q); }
const b64 = d => String(d).split(',')[1];
const blobToB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
async function pool(arr, n, fn) { const out = new Array(arr.length); let i = 0; await Promise.all(Array.from({ length: Math.min(n, arr.length) }, async () => { while (i < arr.length) { const k = i++; out[k] = await fn(arr[k], k); } })); return out; }

/* Умный выбор кадров: для каждого шага берём несколько кадров из его фрагмента,
   выбираем самый резкий и светлый и следим, чтобы у разных шагов кадры не повторялись. */
async function pickFrames(blob, targets, max = 960) {
  const out = {}; if (!targets.length) return out;
  const url = URL.createObjectURL(blob);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = url;
  const wait = (ev, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout ' + ev)), ms); v.addEventListener(ev, () => { clearTimeout(t); res(); }, { once: true }); });
  const sc = document.createElement('canvas'), sx = sc.getContext('2d', { willReadFrequently: true });
  const seek = async t => { const s = wait('seeked', 7000); v.currentTime = t; await s; await new Promise(r => requestAnimationFrame(() => r())); };
  const measure = () => {
    const w = 160, h = Math.max(40, Math.round(160 * (v.videoHeight || 16) / (v.videoWidth || 9)));
    sc.width = w; sc.height = h; sx.drawImage(v, 0, 0, w, h);
    const d = sx.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
    let br = 0; for (let i = 0; i < w * h; i++) { g[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]; br += g[i]; }
    br /= w * h;
    let s = 0, s2 = 0, n = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w]; s += l; s2 += l * l; n++; }
    const sharp = s2 / n - (s / n) ** 2;
    const sig = []; const bw = w / 12, bh = h / 12;
    for (let by = 0; by < 12; by++) for (let bx = 0; bx < 12; bx++) sig.push(g[Math.floor((by + .5) * bh) * w + Math.floor((bx + .5) * bw)]);
    return { sharp, br, sig };
  };
  const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
  const chosen = [], chosenT = new Set();
  try {
    const ready = v.readyState >= 2 ? null : wait('loadeddata', 15000);
    v.play().then(() => v.pause()).catch(() => { });
    if (ready) await ready;
    const D = v.duration && isFinite(v.duration) ? v.duration : 60;
    const clamp = t => Math.min(Math.max(t, .1), Math.max(D - .15, .1));
    for (const tg of targets) {
      try {
        let a = +tg.from, b = +tg.to;
        if (!(isFinite(a) && isFinite(b) && b > a)) { a = tg.t - 1.5; b = tg.t + 1; }
        a = clamp(a); b = clamp(b); if (b - a < .4) { a = clamp(a - .5); b = clamp(b + .5); }
        const N = Math.min(8, Math.max(4, Math.round((b - a) / .4) + 1));
        const cands = [];
        for (let k = 0; k < N; k++) { const t = Math.round((a + (b - a) * k / (N - 1)) * 10) / 10; await seek(t); cands.push({ t, ...measure() }); }
        const maxSharp = Math.max(...cands.map(c => c.sharp)) || 1;
        for (const c of cands) c.val = c.sharp / maxSharp - (c.br < 35 ? .6 : 0) - (c.br > 235 ? .3 : 0) - .08 * Math.abs(c.t - clamp(tg.t));
        cands.sort((x, y) => y.val - x.val);
        let best = cands[0];
        if (!tg.cover && chosen.length) {
          const pool2 = cands.filter(c => !chosenT.has(c.t));
          const pool = pool2.length ? pool2 : cands;
          for (const c of pool) c.md = Math.min(...chosen.map(s => diff(s, c.sig)));
          best = pool.find(c => c.val > cands[0].val - .45 && c.md > 9) || pool.slice().sort((x, y) => (y.val + .03 * y.md) - (x.val + .03 * x.md))[0];
        }
        if (!tg.cover) { chosen.push(best.sig); chosenT.add(best.t); }
        tg.o.t = best.t;
        await seek(best.t);
        out['t' + best.t] = drawScaled(v, v.videoWidth, v.videoHeight, max, .82);
      } catch (e) { console.warn('frame', e); }
    }
  } catch (e) { console.warn('frames', e); }
  finally { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { } URL.revokeObjectURL(url); }
  return out;
}

async function grabFrames(blob, times, max = 640) {
  const out = {}; if (!times.length) return out;
  const url = URL.createObjectURL(blob);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = url;
  const wait = (ev, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout ' + ev)), ms); v.addEventListener(ev, () => { clearTimeout(t); res(); }, { once: true }); });
  try {
    const ready = v.readyState >= 2 ? null : wait('loadeddata', 12000);
    v.play().then(() => v.pause()).catch(() => { });
    if (ready) await ready;
    for (const t of times) {
      try {
        const tt = Math.min(Math.max(+t || 0, .2), Math.max((v.duration || 1) - .2, .2));
        const s = wait('seeked', 7000); v.currentTime = tt; await s;
        await new Promise(r => requestAnimationFrame(() => r()));
        out[t] = drawScaled(v, v.videoWidth, v.videoHeight, max, .76);
      } catch (e) { }
    }
  } catch (e) { console.warn('frames', e); }
  finally { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { } URL.revokeObjectURL(url); }
  return out;
}

/* ---------------- Gemini ---------------- */
const GAPI = 'https://generativelanguage.googleapis.com';
const LANGS = { ru: 'русском', uk: 'украинском', en: 'английском' };
const gver = n => { const m = n.match(/gemini-(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
async function modelList() {
  const key = S.settings.geminiKey, set = S.settings.model;
  const fallback = ['gemini-flash-latest', 'gemini-2.5-flash'];
  if (set && set !== 'auto') return [...new Set([set, ...fallback])];
  let c = null; try { c = JSON.parse(localStorage.getItem('polka.models')); } catch (e) { }
  if (!c || c.key !== key.slice(-6) || Date.now() - c.at > 3 * 864e5) {
    try {
      const j = await fetchJ(`${GAPI}/v1beta/models?pageSize=1000&key=${encodeURIComponent(key)}`);
      const names = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', ''));
      const flash = names.filter(n => /^gemini-\d+(\.\d+)?-flash$/.test(n)).sort((a, b) => gver(b) - gver(a));
      c = { at: Date.now(), key: key.slice(-6), list: flash.slice(0, 3), all: names.filter(n => /^gemini-/.test(n) && !/tts|image|live|embed|audio|transcribe|robotics|computer|omni|veo|lyria|imagen/.test(n)) };
      localStorage.setItem('polka.models', JSON.stringify(c));
    } catch (e) { }
  }
  return [...new Set([...(c && c.list || []), ...fallback])];
}
function parseJSON(t) {
  t = String(t).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (e) { }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error('Gemini ответил не в том формате');
}
async function gemini(parts, { json = true, temp = .3 } = {}) {
  const key = S.settings.geminiKey; if (!key) { const e = new Error('Добавь ключ Gemini в настройках'); e.nokey = true; throw e; }
  let last;
  for (const m of await modelList()) {
    let r, j;
    try {
      r = await fetch(`${GAPI}/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: temp, ...(json ? { responseMimeType: 'application/json' } : {}) } }),
      });
      j = await r.json().catch(() => ({}));
    } catch (e) { last = new Error('Нет связи с Gemini'); continue; }
    if (r.ok) {
      const txt = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map(p => p.text || '').join('');
      if (!txt) { last = new Error(j.promptFeedback && j.promptFeedback.blockReason ? 'Gemini отказался разбирать: ' + j.promptFeedback.blockReason : 'Gemini вернул пустой ответ'); continue; }
      ui.lastModel = m;
      return json ? parseJSON(txt) : txt.trim();
    }
    const msg = (j.error && j.error.message) || ('HTTP ' + r.status);
    if (/API key not valid|API_KEY_INVALID/i.test(msg)) throw new Error('Ключ Gemini не подходит — проверь его в настройках');
    last = new Error(r.status === 429 ? 'Лимит Gemini на сегодня исчерпан, попробуй позже' : 'Gemini: ' + msg);
  }
  throw last || new Error('Gemini недоступен');
}
async function gUpload(blob, mime) {
  const key = encodeURIComponent(S.settings.geminiKey);
  const st = await fetch(`${GAPI}/upload/v1beta/files?key=${key}`, {
    method: 'POST', body: JSON.stringify({ file: { display_name: 'polka-' + Date.now() } }),
    headers: { 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(blob.size), 'X-Goog-Upload-Header-Content-Type': mime, 'Content-Type': 'application/json' },
  });
  const up = st.headers.get('x-goog-upload-url'); if (!up) throw new Error('Видео слишком большое для Gemini');
  const r = await fetch(up, { method: 'POST', headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: blob });
  let f = (await r.json()).file;
  for (let i = 0; i < 60 && f && f.state === 'PROCESSING'; i++) { await sleep(2500); f = await fetchJ(`${GAPI}/v1beta/${f.name}?key=${key}`); }
  if (!f || f.state === 'FAILED') throw new Error('Gemini не смог открыть видео');
  return { file_data: { mime_type: mime, file_uri: f.uri } };
}

function buildPrompt(it, src, nImg, hasVideo) {
  const lang = LANGS[S.settings.lang] || LANGS.ru;
  return `Ты — ИИ приложения «polka.», которое превращает сохранённые посты из соцсетей в полезные карточки.
Пост: ${it.url || 'файлы пользователя'} (платформа: ${src.platform || it.platform}${src.kind === 'board' ? ', это целая доска Pinterest' : ''}).
Автор: ${src.author || '—'}. Заголовок: ${src.title || '—'}.
${hasVideo ? 'Есть ВИДЕО со звуком: смотри картинку, слушай речь, читай текст на экране.' : 'Видео нет.'}
${nImg ? `Есть ${nImg} картинок, пронумерованы с 0 (подписаны «Картинка N»).` : 'Картинок нет.'}
${it.hint ? 'Комментарий пользователя: ' + it.hint : ''}
Подпись / текст страницы:
"""
${(src.text || '').slice(0, 14000) || '—'}
"""

Задача: определи, что это за контент, и извлеки ВСЮ полезную информацию максимально подробно и точно, чтобы по карточке можно было повторить без исходника. Ничего не выдумывай; если граммовки или детали не названы — оцени разумно и пометь «≈». Хештеги, рекламу и призывы подписаться игнорируй.
Пиши на ${lang} языке. Названия книг и фильмов — как они изданы на этом языке (если знаешь), оригинал — в поле original.

Верни ТОЛЬКО JSON:
{"type": "recipe|beauty|books|workout|places|products|howto|outfit|watch|ideas",
 "title": "короткое понятное название, до 60 символов",
 "emoji": "один эмодзи",
 "summary": "1–2 предложения: что это и чем полезно",
 "tags": ["3–6 коротких тегов в нижнем регистре"],
 "cover": {"t": секунда_видео} или {"image": индекс} или null — лучший кадр для обложки (готовое блюдо, итоговый образ…),
 "data": {…}}

Схемы data:
recipe: {"servings": число|null, "time": "общее время", "difficulty": "легко|средне|сложно", "cuisine": "", "ingredients": [{"name":"", "qty": число|null, "unit":"г|мл|шт|ст. л.|ч. л.|щепотка|…", "note":"", "group":"основа|соус|тесто|… или пусто"}], "steps": [{"text":"подробно, с температурой и временем", "t": секунда|null, "image": индекс|null, "timer": минуты|null}], "tips": [""], "nutrition": "≈ ккал/порцию или пусто"}
beauty (макияж, уход, волосы, ногти): {"look":"", "skin":"для какого типа/случая", "products":[{"category":"праймер|тон|консилер|румяна|тени|тушь|помада|…", "name":"", "brand":"", "shade":""}], "tools":[""], "steps":[{"zone":"кожа|брови|глаза|скулы|губы|волосы|…", "text":"подробно как и чем", "product":"", "tool":"", "t": секунда|null, "image": индекс|null}], "tips":[""]}
books: {"books":[{"title":"", "author":"", "original":"оригинальное название", "genre":"", "year": число|null, "about":"1–2 предложения о книге", "image": индекс|null}]}
workout: {"level":"", "duration":"", "equipment":[""], "exercises":[{"name":"", "sets": число|null, "reps":"", "time":"", "rest":"", "muscles":"", "how":"техника выполнения", "t": секунда|null, "image": индекс|null}], "tips":[""]}
places: {"city":"", "places":[{"name":"", "kind":"кафе|ресторан|музей|пляж|отель|…", "address":"", "city":"", "country":"", "note":"что там особенного", "price":""}]}
products: {"products":[{"name":"", "brand":"", "category":"", "price":"", "where":"где купить", "note":"", "image": индекс|null}]}
howto (DIY, уборка, лайфхаки, техника, любые пошаговые инструкции): {"materials":[""], "steps":[{"text":"", "t": секунда|null, "image": индекс|null}], "tips":[""]}
outfit: {"vibe":"", "items":[{"piece":"", "color":"", "brand":"", "note":"", "image": индекс|null}], "tips":[""]}
watch (фильмы, сериалы, аниме, видео): {"titles":[{"title":"", "original":"", "year": число|null, "kind":"фильм|сериал|…", "genre":"", "about":"", "image": индекс|null}]}
ideas (советы, цитаты, мысли, всё остальное): {"points":["подробные пункты"], "quote":""}

Правила:
- Для видео у каждого шага/упражнения/товара/вещи добавь три поля: "t_from" и "t_to" — начало и конец фрагмента видео, где показан именно этот шаг, и "t" — лучший момент внутри него (с точностью до 0,1 с). Из этого фрагмента вырежем кадр-иллюстрацию, поэтому "t" выбирай ближе к концу шага, когда результат хорошо виден, камера не дёргается и кадр не перекрыт текстом или руками. У разных шагов фрагменты и "t" должны быть РАЗНЫМИ — не ставь двум шагам одну и ту же секунду. Для картинок вместо этого — "image" с индексом.
- Если это доска или подборка картинок с книгами — распознай ВСЕ книги на всех картинках (обложки, корешки, списки), без повторов. Аналогично для фильмов, мест и товаров.
- Если в посте несколько тем — выбери главную.`;
}

function normalize(r) {
  r = r && typeof r === 'object' ? r : {};
  if (!CATS[r.type]) r.type = 'ideas';
  r.title = String(r.title || 'Без названия').slice(0, 90);
  r.emoji = String(r.emoji || cat(r.type).e).slice(0, 4);
  r.summary = String(r.summary || '');
  r.tags = (Array.isArray(r.tags) ? r.tags : []).map(String).slice(0, 8);
  const d = r.data = r.data && typeof r.data === 'object' ? r.data : {};
  const arr = k => { d[k] = Array.isArray(d[k]) ? d[k].filter(x => x != null) : []; };
  ({ recipe: ['ingredients', 'steps', 'tips'], beauty: ['products', 'tools', 'steps', 'tips'], books: ['books'], workout: ['equipment', 'exercises', 'tips'], places: ['places'], products: ['products'], howto: ['materials', 'steps', 'tips'], outfit: ['items', 'tips'], watch: ['titles'], ideas: ['points'] })[r.type].forEach(arr);
  for (const k of ['steps', 'exercises']) if (d[k]) d[k] = d[k].map(s => typeof s === 'string' ? { text: s } : s);
  for (const k of ['tips', 'tools', 'equipment', 'materials', 'points']) if (d[k]) d[k] = d[k].map(x => typeof x === 'string' ? x : (x.text || x.name || JSON.stringify(x)));
  return r;
}
function collectTargets(r) {
  const out = [];
  const walk = x => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) return x.forEach(walk); if (typeof x.t === 'number' && x.t >= 0) out.push({ o: x, t: x.t, from: x.t_from, to: x.t_to }); Object.values(x).forEach(walk); };
  walk(r.data);
  if (r.cover && typeof r.cover.t === 'number') out.push({ o: r.cover, t: r.cover.t, cover: true });
  else out.push({ o: (r.cover = { t: Math.max(1, ...out.map(x => x.t)) }), t: r.cover.t, cover: true });
  return out.slice(0, 32);
}
function collectRefs(r) {
  const times = new Set(), imgs = new Set();
  const walk = x => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) return x.forEach(walk); if (typeof x.t === 'number' && x.t >= 0) times.add(Math.round(x.t * 2) / 2); if (Number.isInteger(x.image) && x.image >= 0) imgs.add(x.image); Object.values(x).forEach(walk); };
  walk(r.data); if (r.cover) walk([r.cover]);
  return { times: [...times].sort((a, b) => a - b).slice(0, 30), imgs: [...imgs].slice(0, 50) };
}
const fkey = o => o == null ? null : (typeof o.t === 'number' && o.t >= 0 ? 't' + Math.round(o.t * 10) / 10 : Number.isInteger(o.image) ? 'i' + o.image : null);

/* ---------------- разбор ссылки ---------------- */
const pendingFiles = new Map();
function setStage(it, s) { it.stage = s; if (!ui.open) renderSoon(); }
async function processItem(it) {
  let src;
  const files = pendingFiles.get(it.id);
  if (it.platform === 'file') {
    if (!files) throw new Error('Файлы потерялись после перезагрузки — добавь их ещё раз');
    src = { platform: 'file', title: '', text: it.hint || '', images: [] };
  } else {
    setStage(it, 'Открываю ссылку…');
    src = await fetchJ(workerUrl() + '/resolve?url=' + encodeURIComponent(it.url));
  }
  it.platform = src.platform || it.platform; if (src.url) it.url = src.url;
  it.src = { title: src.title || '', author: src.author || '', text: (src.text || '').slice(0, 2500), thumb: src.thumb || '', kind: src.kind || '', source: src.source || '' };

  let video = null; const imgs = [];
  if (files) {
    for (const f of files) {
      if (f.type.startsWith('video/') && !video) video = f;
      else if (f.type.startsWith('image/')) { try { imgs.push({ blob: f, g: await shrink(f, 1280, .82) }); } catch (e) { } }
    }
  } else {
    if (src.video) {
      setStage(it, 'Скачиваю видео…');
      try { const b = await fetchMedia(src.video, src.mediaCookie); if (b.size > 5000 && !/json|html/.test(b.type)) video = b; } catch (e) { console.warn(e); }
    }
    const urls = (src.images || []).slice(0, 30);
    if (urls.length) setStage(it, urls.length > 1 ? `Загружаю картинки (${urls.length})…` : 'Загружаю картинку…');
    const got = await pool(urls, 5, async u => { try { const b = await fetchMedia(u); return { blob: b, g: await shrink(b, urls.length > 12 ? 768 : 1024, .8) }; } catch (e) { return null; } });
    imgs.push(...got.filter(Boolean));
  }
  if (!video && !imgs.length && !src.youtube && !(src.text || '').trim()) throw new Error('Не получилось ничего достать по ссылке. Возможно, пост закрытый — попробуй добавить скриншоты или видео файлом');

  const parts = [{ text: buildPrompt(it, src, imgs.length, !!(video || src.youtube)) }];
  if (video) {
    setStage(it, 'Отправляю видео в Gemini…');
    const mime = /^video\//.test(video.type) ? video.type : 'video/mp4';
    parts.push(video.size < 12e6 ? { inline_data: { mime_type: mime, data: await blobToB64(video) } } : await gUpload(video, mime));
  } else if (src.youtube) parts.push({ file_data: { file_uri: src.youtube } });
  imgs.forEach((im, i) => { parts.push({ text: `Картинка ${i}:` }); parts.push({ inline_data: { mime_type: 'image/jpeg', data: b64(im.g) } }); });
  setStage(it, video || src.youtube ? 'Gemini смотрит видео…' : 'Gemini разбирает…');
  const r = normalize(await gemini(parts));

  setStage(it, 'Готовлю картинки…');
  const rev = (it.mrev || 0) + 1;
  const media = { frames: {}, cover: null, rev };
  const refs = collectRefs(r);
  if (video) {
    setStage(it, 'Подбираю лучшие кадры…');
    Object.assign(media.frames, await pickFrames(video, collectTargets(r)));
  }
  for (const i of refs.imgs) if (imgs[i]) { try { media.frames['i' + i] = await shrink(imgs[i].blob, 640, .76); } catch (e) { } }
  const ck = fkey(r.cover);
  media.cover = (ck && media.frames[ck]) || null;
  if (!media.cover && imgs[0]) media.cover = await shrink(imgs[0].blob, 720, .78).catch(() => null);
  if (!media.cover && src.thumb) media.cover = await fetchMedia(src.thumb).then(b => shrink(b, 720, .78)).catch(() => null);
  if (!media.cover && media.frames.t1) media.cover = media.frames.t1;
  await MDB.put(it.id, media);
  pendingFiles.delete(it.id);

  Object.assign(it, { type: r.type, title: r.title, emoji: r.emoji, summary: r.summary, tags: r.tags, data: r.data, coverKey: ck, status: 'done', stage: '', error: '', mrev: rev, model: ui.lastModel });
  if (r.type === 'books') enrichBooks(it);
}

async function enrichBooks(it) {
  const books = (it.data && it.data.books) || [];
  await pool(books, 3, async b => {
    if (b.ol !== undefined) return;
    try {
      const q = new URLSearchParams({ q: `${b.original || b.title} ${b.author || ''}`.trim(), limit: '1', fields: 'cover_i,key,first_publish_year' });
      const j = await fetchJ('https://openlibrary.org/search.json?' + q);
      const d = j.docs && j.docs[0];
      b.ol = d && d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '';
    } catch (e) { b.ol = ''; }
  });
  save(); if (ui.open === it.id || ui.tab === 'lists') render();
}

let running = false;
async function runQueue() {
  if (running) return; running = true;
  try {
    for (; ;) {
      const it = S.items.find(x => x.status === 'queue');
      if (!it) break;
      if (!S.settings.geminiKey) { render(); break; }
      it.status = 'work'; it.stage = 'В очереди…'; render();
      try { await processItem(it); }
      catch (e) {
        console.error(e);
        it.status = e.nokey ? 'queue' : 'error'; it.error = e.message || String(e); it.stage = '';
        if (e.nokey) { save(); render(); break; }
      }
      save(); render();
    }
  } finally { running = false; }
}
function addLinks(text, hint) {
  const urls = [...new Set((String(text).match(/https?:\/\/[^\s<>"']+|(?:www\.|vm\.|vt\.)?(?:tiktok\.com|instagram\.com|pinterest\.[a-z.]+|pin\.it|youtu\.be|youtube\.com)\/[^\s<>"']*/gi) || []).map(u => u.replace(/[).,;!?»]+$/, '')))];
  if (!urls.length) { toast('Не вижу ссылки — вставь адрес поста'); return 0; }
  let added = 0;
  for (const raw of urls) {
    const url = /^https?:/i.test(raw) ? raw : 'https://' + raw;
    const dup = S.items.find(x => x.url === url || x.origUrl === url);
    if (dup) { if (urls.length === 1) { toast('Эта ссылка уже на полке'); openItem(dup.id); } continue; }
    S.items.unshift({ id: uid(), url, origUrl: url, platform: platformOf(url), added: Date.now(), status: 'queue', stage: '', hint: hint || '', qa: [] });
    added++;
  }
  if (added) { save(true); ui.tab = 'home'; ui.cat = 'all'; render(); runQueue(); if (!S.settings.geminiKey) setTimeout(() => toast('Ссылка сохранена. Чтобы разобрать — добавь ключ Gemini в настройках', 4500), 300); else toast(added > 1 ? `Добавлено ${added} ${plural(added, 'ссылка', 'ссылки', 'ссылок')} — разбираю` : 'Разбираю…'); }
  return added;
}
function addFiles(files, hint) {
  files = [...files].filter(f => /^(image|video)\//.test(f.type));
  if (!files.length) return;
  const id = uid();
  pendingFiles.set(id, files);
  S.items.unshift({ id, url: '', platform: 'file', added: Date.now(), status: 'queue', stage: '', hint: hint || '', qa: [] });
  save(true); ui.tab = 'home'; render(); runQueue();
}

/* =====================================================================
   ОТРИСОВКА
   ===================================================================== */
let rT;
function renderSoon() { if (rT) return; rT = requestAnimationFrame(() => { rT = null; render(); }); }
function render() {
  const app = $('#app');
  const y = window.scrollY;
  if (!SY.on && !S.skipLogin) { app.innerHTML = vWelcome(); return; }
  let h = '';
  if (ui.tab === 'home') h = vHome(); else if (ui.tab === 'lists') h = vLists(); else h = vSettings();
  h += tabbar();
  // не перерисовываем поле ввода, если в нём курсор
  const act = document.activeElement, keep = act && act.id && ['addInput', 'searchInput', 'shopInput'].includes(act.id) ? { id: act.id, v: act.value, s: act.selectionStart } : null;
  app.innerHTML = h;
  if (keep) { const el = $('#' + keep.id); if (el) { el.value = keep.v; el.focus(); try { el.setSelectionRange(keep.s, keep.s); } catch (e) { } } }
  window.scrollTo(0, y);
  renderDetail();
  hydrate();
}
function hydrate(root = document) {
  for (const img of $$('img[data-m]', root)) {
    const [id, k] = img.dataset.m.split('|');
    const set = m => { const src = m && (k === 'cover' ? m.cover : m.frames && m.frames[k]); if (src) { img.src = src; img.removeAttribute('data-m'); } else if ('fb' in img.dataset) { img.outerHTML = img.dataset.fb; } };
    const c = MDB.peek(id); if (c) set(c); else MDB.get(id).then(set).catch(() => { });
  }
}
const tabbar = () => `<nav class="tabbar">
  <button class="tab ${ui.tab === 'home' ? 'on' : ''}" data-act="tab" data-v="home">${I('shelf')}Полка</button>
  <button class="tab ${ui.tab === 'lists' ? 'on' : ''}" data-act="tab" data-v="lists">${I('list')}Списки</button>
  <button class="tab ${ui.tab === 'me' ? 'on' : ''}" data-act="tab" data-v="me">${I('gear')}Настройки</button></nav>`;

/* ---------------- вход ---------------- */
function vWelcome() {
  const f = [['🍳', 'Рецепт из рилса', 'с ингредиентами, шагами и кадрами из видео'], ['💄', 'Макияж по шагам', 'какие продукты и в каком порядке наносить'], ['📚', 'Книги с Pinterest', 'кидаешь доску — получаешь список книг'], ['📍', 'Места, тренировки, покупки', 'всё само раскладывается по полкам']];
  return `<div class="welcome">
    <div class="logo">polka<b>.</b></div>
    <div class="lead">Кидай ссылки из Instagram, TikTok, Pinterest и YouTube — я разберу их и разложу по полкам.</div>
    ${f.map(x => `<div class="feat"><div class="e">${x[0]}</div><div><b>${x[1]}</b><div class="muted small">${x[2]}</div></div></div>`).join('')}
    <button class="gbtn" data-act="login">${GLOGO}Войти через Google</button>
    <div class="tiny faint" style="text-align:center;margin-top:12px">Твои карточки хранятся в скрытой папке твоего Google Drive и синхронизируются между телефоном и ноутбуком.</div>
    <button class="small muted" style="margin-top:18px" data-act="skipLogin">Попробовать без входа</button>
  </div>`;
}

/* ---------------- главная ---------------- */
function matches(it, q) {
  const hay = [it.title, it.summary, (it.tags || []).join(' '), it.src && it.src.title, it.src && it.src.author, it.note, cat(it.type).name, JSON.stringify(it.data || {})].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
function vHome() {
  const counts = {}; let favs = 0;
  for (const it of S.items) { if (it.status === 'done') counts[it.type] = (counts[it.type] || 0) + 1; if (it.fav) favs++; }
  let list = S.items;
  if (ui.cat === 'fav') list = list.filter(x => x.fav);
  else if (ui.cat !== 'all') list = list.filter(x => x.type === ui.cat);
  if (ui.q) list = list.filter(x => matches(x, ui.q));
  const noKey = !S.settings.geminiKey && S.items.some(x => x.status === 'queue');
  return `<div class="page">
    <div class="top"><div class="logo grow">polka<b>.</b></div>
      ${syncButton()}
      <button class="ib" data-act="toggleSearch" title="Поиск">${I('search')}</button>
      <button class="ib" data-act="tab" data-v="me" title="Настройки">${SY.pic ? `<img class="avatar" src="${esc(SY.pic)}" alt="">` : I('gear')}</button></div>
    <div class="add">
      <input id="addInput" placeholder="Ссылка на пост…" autocomplete="off" inputmode="url" enterkeyhint="go">
      <button class="ib" data-act="paste" title="Вставить из буфера">${I('paste')}</button>
      <button class="ib" data-act="pickFiles" title="Скриншоты или видео">${I('clip')}</button>
      <button class="go" data-act="add">Разобрать</button>
    </div>
    ${noKey ? `<div class="hint" style="color:var(--warn)">Чтобы разбирать ссылки, добавь бесплатный ключ Gemini → <a href="#" data-act="tab" data-v="me">Настройки</a></div>` : S.items.length ? '' : `<div class="hint">Instagram, TikTok, Pinterest (пины и целые доски), YouTube и любые сайты. Можно сразу несколько ссылок.</div>`}
    ${ui.searching || ui.q ? `<div class="search"><input id="searchInput" placeholder="Поиск: «паста с креветками», «тушь», «Ремарк»…" value="${esc(ui.q)}" autocomplete="off"></div>` : ''}
    ${S.items.length ? `<div class="chips">
      <button class="chip ${ui.cat === 'all' ? 'on' : ''}" data-act="cat" data-v="all">Все <span class="n">${S.items.length}</span></button>
      ${favs ? `<button class="chip ${ui.cat === 'fav' ? 'on' : ''}" data-act="cat" data-v="fav">⭐ Избранное <span class="n">${favs}</span></button>` : ''}
      ${Object.entries(CATS).filter(([k]) => counts[k]).sort((a, b) => counts[b[0]] - counts[a[0]]).map(([k, c]) => `<button class="chip ${ui.cat === k ? 'on' : ''}" data-act="cat" data-v="${k}">${c.e} ${c.name} <span class="n">${counts[k]}</span></button>`).join('')}
    </div>` : ''}
    ${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : emptyHome()}
  </div>`;
}
function emptyHome() {
  if (S.items.length) return `<div class="empty"><div class="big">🔍</div><h3>Ничего не нашлось</h3><div>Попробуй другие слова или категорию</div></div>`;
  return `<div class="empty"><div class="big">🗂️</div><h3>Полка пока пустая</h3>
    <div>Скопируй ссылку на рилс с рецептом, туториал по макияжу или доску Pinterest с книгами и вставь сверху.</div>
    <div class="btns" style="justify-content:center;margin-top:16px"><button class="btn" data-act="howShare">${I('share')} Как добавлять в один тап</button></div></div>`;
}
function card(it) {
  const c = cat(it.type);
  if (it.status !== 'done') {
    let host = ''; try { host = it.url ? new URL(it.url).hostname.replace(/^www\./, '') : 'скриншоты и видео'; } catch (e) { }
    return `<div class="card ${it.status === 'error' ? 'err' : 'work'}" data-act="open" data-id="${it.id}">
      <div class="cv ph" style="--c:#bdb3a7;aspect-ratio:5/3">${it.status === 'error' ? '⚠️' : '⏳'}</div>
      <span class="pf">${pf(it.platform)}</span>
      <div class="bd"><div class="tt" style="font-size:14px">${esc(it.src && it.src.title || host)}</div>
      ${it.status === 'error' ? `<div class="state" style="padding:8px 0 0;color:var(--err)">${esc(it.error)}</div><div class="btns" style="margin-top:8px"><button class="btn" style="padding:8px 12px" data-act="retry" data-id="${it.id}">${I('refresh')} Ещё раз</button></div>`
      : `<div class="state" style="padding:8px 0 0"><span class="loader"></span><span>${esc(it.status === 'queue' ? (S.settings.geminiKey ? 'В очереди…' : 'Ждёт ключ Gemini') : it.stage || 'Разбираю…')}</span></div>`}</div></div>`;
  }
  return `<button class="card" data-act="open" data-id="${it.id}" style="--c:${c.c}">
    <img class="cv" data-m="${it.id}|cover" data-fb='<div class="cv ph">${esc(it.emoji || c.e)}</div>' alt="" style="aspect-ratio:auto;min-height:110px;max-height:330px">
    <span class="pf">${pf(it.platform)}</span>${it.fav ? '<span class="fav">★</span>' : ''}
    <div class="bd"><div class="ct">${c.e} ${esc(c.one)}</div><div class="tt">${esc(it.title)}</div>
    <div class="mt">${cardMeta(it)}</div></div></button>`;
}
function cardMeta(it) {
  const d = it.data || {};
  switch (it.type) {
    case 'recipe': return [d.time, d.ingredients && d.ingredients.length ? `${d.ingredients.length} ингр.` : ''].filter(Boolean).map(esc).join(' · ');
    case 'books': return `${d.books.length} ${plural(d.books.length, 'книга', 'книги', 'книг')}`;
    case 'watch': return `${d.titles.length} ${plural(d.titles.length, 'тайтл', 'тайтла', 'тайтлов')}`;
    case 'places': return `${d.places.length} ${plural(d.places.length, 'место', 'места', 'мест')}${d.city ? ' · ' + esc(d.city) : ''}`;
    case 'products': return `${d.products.length} ${plural(d.products.length, 'товар', 'товара', 'товаров')}`;
    case 'workout': return [d.duration, d.exercises.length ? `${d.exercises.length} упр.` : ''].filter(Boolean).map(esc).join(' · ');
    case 'beauty': case 'howto': return d.steps && d.steps.length ? `${d.steps.length} ${plural(d.steps.length, 'шаг', 'шага', 'шагов')}` : '';
    default: return esc(it.src && it.src.author || '');
  }
}

/* ---------------- карточка целиком ---------------- */
function renderDetail() {
  let box = $('#detail');
  const it = ui.open && item(ui.open);
  if (!it) { if (box) box.remove(); document.body.style.overflow = ''; return; }
  if (!box) { box = document.createElement('div'); box.id = 'detail'; box.className = 'detail'; document.body.appendChild(box); }
  const st = box.scrollTop, act = document.activeElement, keepId = act && box.contains(act) && act.id ? act.id : null, keepV = keepId && act.value;
  box.innerHTML = vDetail(it);
  box.scrollTop = st;
  if (keepId) { const el = $('#' + keepId, box); if (el) { el.value = keepV; el.focus(); } }
  document.body.style.overflow = 'hidden';
  hydrate(box);
}
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const img = (it, k, cls = '', fb = '') => k ? `<img class="${cls}" data-m="${it.id}|${k}" ${fb ? `data-fb='${fb}'` : `data-fb=''`} alt="" loading="lazy">` : fb;
const searchUrl = q => 'https://www.google.com/search?q=' + encodeURIComponent(q);
const mapsUrl = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

function vDetail(it) {
  const c = cat(it.type), d = it.data || {};
  const pname = (PLAT[it.platform] || PLAT.web)[0];
  const head = `<div class="hero ${it.status === 'done' ? '' : 'ph'}" style="--c:${c.c}">
      ${it.status === 'done' ? img(it, 'cover', '', `<div class="hero ph" style="--c:${c.c}">${esc(it.emoji || c.e)}</div>`) : (it.status === 'error' ? '⚠️' : '⏳')}
      <div class="hbar"><button class="hbtn" data-act="close">${I('back')}</button><div class="grow"></div>
      ${it.status === 'done' ? `<button class="hbtn" data-act="fav" data-id="${it.id}" style="${it.fav ? 'color:#FFC83D' : ''}">${it.fav ? '★' : I('star')}</button>` : ''}
      <button class="hbtn" data-act="more" data-id="${it.id}">${I('more')}</button></div></div>`;
  const src = `<div class="src">${pf(it.platform)}<span class="grow">${esc(it.src && it.src.author || pname)}</span>${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener" class="row" style="gap:5px">Открыть в ${esc(pname)} ${I('ext').replace('<svg', '<svg style="width:15px;height:15px"')}</a>` : ''}</div>`;
  if (it.status !== 'done') {
    return `<div class="dwrap">${head}<div class="dbody">
      <div class="dtitle">${it.status === 'error' ? 'Не получилось разобрать' : 'Разбираю…'}</div>
      <div class="dsum">${esc(it.status === 'error' ? it.error : it.stage || 'В очереди')}</div>${src}
      <div class="btns" style="margin-top:20px">${it.status === 'error' ? `<button class="btn pri" data-act="retry" data-id="${it.id}">${I('refresh')} Попробовать ещё раз</button>` : ''}
      <button class="btn danger" data-act="del" data-id="${it.id}">${I('trash')} Удалить</button></div>
      ${it.status === 'error' && it.platform !== 'file' ? `<div class="sec"><h3>Что можно сделать</h3><div class="muted">Если пост закрытый или соцсеть не отдаёт видео — сохрани видео или сделай скриншоты и добавь их через скрепку 📎 на главной. Можно дописать подсказку (например, «это рецепт, нужен список ингредиентов»).</div></div>` : ''}
    </div></div>`;
  }
  const R = { recipe: rRecipe, beauty: rBeauty, books: rBooks, workout: rWorkout, places: rPlaces, products: rProducts, howto: rHowto, outfit: rOutfit, watch: rWatch, ideas: rIdeas }[it.type] || rIdeas;
  return `<div class="dwrap">${head}<div class="dbody" style="--c:${c.c}">
    <div class="ct" style="font-size:12px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:${c.c}">${c.e} ${esc(c.one)}</div>
    <div class="dtitle">${esc(it.title)}</div>
    ${it.summary ? `<div class="dsum">${esc(it.summary)}</div>` : ''}
    ${src}
    ${(it.tags || []).length ? `<div class="tags">${it.tags.map(t => `<button class="tag" data-act="tagSearch" data-v="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
    ${R(it, d)}
    <div class="sec"><h3>✍️ Мои заметки</h3><textarea id="note_${it.id}" data-input="note" data-id="${it.id}" placeholder="Что поменяла, понравилось ли, с чем подать…">${esc(it.note || '')}</textarea></div>
    <div class="sec"><h3>${I('sparkle').replace('<svg', '<svg style="width:20px;height:20px;color:var(--accent)"')} Спросить ИИ</h3>
      <div class="add"><input id="ask_${it.id}" placeholder="${esc(askHint(it.type))}" enterkeyhint="send"><button class="go" data-act="ask" data-id="${it.id}">Спросить</button></div>
      <div class="qa">${(it.qa || []).slice().reverse().map(x => `<div class="q">${esc(x.q)}</div><div class="a">${x.a ? esc(x.a) : '<span class="loader" style="display:inline-block"></span>'}</div>`).join('')}</div></div>
    <div class="btns" style="margin-top:28px">
      <button class="btn ghost" data-act="shareItem" data-id="${it.id}">${I('share')} Поделиться</button>
      <button class="btn ghost" data-act="retry" data-id="${it.id}">${I('refresh')} Разобрать заново</button>
      <button class="btn ghost" data-act="changeCat" data-id="${it.id}">${I('tag')} Категория</button>
    </div>
    <div class="tiny faint" style="margin-top:16px">Добавлено ${new Date(it.added).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}${it.model ? ' · ' + esc(it.model) : ''}</div>
  </div></div>`;
}
const askHint = t => ({ recipe: 'Чем заменить сливки? Как сделать без духовки?', beauty: 'Чем заменить этот тон? Подойдёт ли для жирной кожи?', books: 'С какой книги начать? Что похожее почитать?', workout: 'Как сделать легче? Сколько раз в неделю?', places: 'Как построить маршрут? Что рядом ещё?', watch: 'Что похожее посмотреть?' }[t] || 'Задай вопрос по этой карточке');

function stepCard(it, s, i, extra = '') {
  const k = fkey(s);
  const tchip = typeof s.t === 'number' ? (it.platform === 'youtube' ? `<a class="tbtn" href="${esc(it.url)}&t=${Math.floor(s.t)}s" target="_blank" rel="noopener">${I('play').replace('<svg', '<svg style="width:12px;height:12px"')} ${fmtT(s.t)}</a>` : `<span class="tiny faint" style="margin-left:6px">${fmtT(s.t)}</span>`) : '';
  return `<div class="step">${k ? img(it, k) : ''}<div class="sb"><div class="num">${i + 1}</div><div class="grow">
    ${s.zone ? `<div class="zone">${esc(s.zone)}</div>` : ''}<div>${esc(s.text || s.name || '')}${tchip}</div>${extra}
    ${s.timer ? `<button class="tbtn" data-act="timer" data-min="${+s.timer}" data-label="${esc((it.title || '').slice(0, 24) + ' · шаг ' + (i + 1))}">${I('timer').replace('<svg', '<svg style="width:14px;height:14px"')} ${+s.timer} мин</button>` : ''}
  </div></div></div>`;
}
const tipsSec = (arr, title = '💡 Советы') => arr && arr.length ? `<div class="sec"><h3>${title}</h3><ul class="tips">${arr.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : '';
const metas = arr => { arr = arr.filter(x => x[1]); return arr.length ? `<div class="metas">${arr.map(([k, v]) => `<div class="meta"><span>${esc(k)}</span><b>${typeof v === 'string' ? esc(v) : v}</b></div>`).join('')}</div>` : ''; };
const goSteps = (it, label) => `<button class="btn pri wide" style="margin-top:14px" data-act="cook" data-id="${it.id}">${I('play')} ${label}</button>`;
const ck = on => `<span class="ck ${on ? 'on' : ''}">${on ? I('check') : ''}</span>`;

function fmtQty(q) {
  if (q == null || q === '' || isNaN(q)) return '';
  q = +q; if (q >= 100) return String(Math.round(q / 5) * 5);
  if (q >= 10) return String(Math.round(q));
  const r = Math.round(q * 4) / 4, w = Math.floor(r), f = r - w;
  const fr = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[f] || '';
  return (w ? w : '') + fr || '0';
}
function rRecipe(it, d) {
  const base = +d.servings || 0, cur = ui.servings[it.id] || base, f = base && cur ? cur / base : 1;
  const groups = {}; d.ingredients.forEach((g, i) => { (groups[g.group || ''] = groups[g.group || ''] || []).push([g, i]); });
  const ing = Object.entries(groups).map(([g, arr]) => (g && Object.keys(groups).length > 1 ? `<div class="grp">${esc(g)}</div>` : '') + arr.map(([x, i]) => {
    const on = ui.checked[it.id + ':' + i], q = fmtQty(x.qty != null ? x.qty * f : null);
    return `<button class="li ${on ? 'done' : ''}" style="width:100%;text-align:left" data-act="checkIng" data-id="${it.id}" data-i="${i}">${ck(on)}<span class="t grow">${esc(x.name)}${x.note ? `<span class="faint small"> · ${esc(x.note)}</span>` : ''}</span><span class="q">${esc([q, x.unit].filter(Boolean).join(' '))}</span></button>`;
  }).join('')).join('');
  return metas([['Время', d.time], ['Сложность', d.difficulty], ['Кухня', d.cuisine], ['КБЖУ', d.nutrition]]) +
    `<div class="sec"><h3><span class="grow">🥕 Ингредиенты</span>${base ? `<span class="stepper"><button data-act="serv" data-id="${it.id}" data-d="-1">−</button><b>${cur}</b><button data-act="serv" data-id="${it.id}" data-d="1">+</button></span><span class="small muted" style="font-family:inherit;font-weight:500">порц.</span>` : ''}</h3>
     <div class="box">${ing || '<div class="li muted">Ингредиенты не найдены</div>'}</div>
     ${d.ingredients.length ? `<button class="btn wide" style="margin-top:10px" data-act="toShop" data-id="${it.id}">${I('cart')} В список покупок</button>` : ''}</div>
    <div class="sec"><h3>👩‍🍳 Приготовление</h3><div class="steps">${d.steps.map((s, i) => stepCard(it, s, i)).join('')}</div>${d.steps.length ? goSteps(it, 'Готовить по шагам') : ''}</div>` + tipsSec(d.tips);
}
function rBeauty(it, d) {
  return metas([['Образ', d.look], ['Кому подойдёт', d.skin]]) +
    (d.products.length ? `<div class="sec"><h3>🧴 Продукты</h3><div class="box">${d.products.map((p, i) => `<div class="li"><div class="grow"><div class="tiny faint" style="text-transform:uppercase;font-weight:700;letter-spacing:.3px">${esc(p.category)}</div><div><b>${esc(p.name || '')}</b>${p.brand ? ' · ' + esc(p.brand) : ''}${p.shade ? `<span class="muted"> · оттенок ${esc(p.shade)}</span>` : ''}</div></div><button class="ib" data-act="prodToShop" data-id="${it.id}" data-i="${i}" title="В список покупок">${I('cart')}</button></div>`).join('')}</div></div>` : '') +
    (d.tools.length ? `<div class="sec"><h3>🖌️ Инструменты</h3><div class="tags">${d.tools.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>` : '') +
    `<div class="sec"><h3>✨ По шагам</h3><div class="steps">${d.steps.map((s, i) => stepCard(it, s, i, [s.product, s.tool].some(Boolean) ? `<div class="extra">${[s.product && '🧴 ' + esc(s.product), s.tool && '🖌️ ' + esc(s.tool)].filter(Boolean).join(' &nbsp; ')}</div>` : '')).join('')}</div>${d.steps.length ? goSteps(it, 'Повторять по шагам') : ''}</div>` + tipsSec(d.tips);
}
const BST = { '': 'Отметить', want: 'Хочу прочитать', doing: 'Читаю', done: 'Прочитано ✓' };
const WST = { '': 'Отметить', want: 'Хочу посмотреть', done: 'Посмотрено ✓' };
function bookRow(it, b, i, showFrom) {
  const cover = b.ol ? `<img class="cov" src="${esc(b.ol)}" alt="" loading="lazy">` : Number.isInteger(b.image) ? img(it, 'i' + b.image, 'cov', '<div class="cov ph">📕</div>') : '<div class="cov ph">📕</div>';
  return `<div class="bk">${cover}<div class="grow"><div class="nm">${esc(b.title)}</div><div class="au">${esc(b.author || '')}${b.year ? ' · ' + b.year : ''}</div>
    ${b.genre ? `<div class="tiny faint" style="margin-top:3px">${esc(b.genre)}${b.original && b.original !== b.title ? ' · ' + esc(b.original) : ''}</div>` : ''}
    ${b.about ? `<div class="ab">${esc(b.about)}</div>` : ''}
    ${showFrom ? `<div class="from" style="margin-top:4px">из «${esc(it.title)}»</div>` : ''}
    <div class="row wrap" style="gap:6px"><button class="st ${b.st || ''}" data-act="bookSt" data-id="${it.id}" data-i="${i}">${BST[b.st || '']}</button>
    <a class="st" href="${searchUrl(`${b.title} ${b.author || ''} книга`)}" target="_blank" rel="noopener">Найти ↗</a></div></div></div>`;
}
function rBooks(it, d) {
  const n = d.books.length, done = d.books.filter(b => b.st === 'done').length;
  return metas([['Книг', String(n)], ['Прочитано', done ? `${done} из ${n}` : '']]) + `<div class="sec"><h3>📚 Список</h3><div class="box">${d.books.map((b, i) => bookRow(it, b, i)).join('') || '<div class="li muted">Книги не найдены</div>'}</div>
    <button class="btn wide" style="margin-top:10px" data-act="allBooks">${I('list')} Все мои книги</button></div>`;
}
function rWorkout(it, d) {
  return metas([['Уровень', d.level], ['Длительность', d.duration], ['Инвентарь', (d.equipment || []).join(', ')]]) +
    `<div class="sec"><h3>🏋️ Упражнения</h3><div class="steps">${d.exercises.map((s, i) => stepCard(it, { ...s, text: s.name }, i,
      `<div class="extra">${[s.sets && `${s.sets} × ${esc(s.reps || '')}`, !s.sets && s.reps && esc(s.reps), s.time && '⏱ ' + esc(s.time), s.rest && 'отдых ' + esc(s.rest), s.muscles && '🎯 ' + esc(s.muscles)].filter(Boolean).join(' · ')}</div>${s.how ? `<div class="extra">${esc(s.how)}</div>` : ''}`)).join('')}</div>${d.exercises.length ? goSteps(it, 'Начать тренировку') : ''}</div>` + tipsSec(d.tips);
}
function rPlaces(it, d) {
  return metas([['Город', d.city], ['Мест', String(d.places.length)]]) + `<div class="sec"><h3>📍 Места</h3><div class="box">${d.places.map((p, i) => placeRow(it, p, i)).join('')}</div>
    ${d.places.length > 1 ? `<a class="btn wide" style="margin-top:10px" target="_blank" rel="noopener" href="${mapsUrl(d.places.map(p => p.name).slice(0, 6).join(', ') + ' ' + (d.city || ''))}">${I('map')} Открыть на карте</a>` : ''}</div>`;
}
function placeRow(it, p, i, showFrom) {
  return `<div class="li"><button data-act="placeSt" data-id="${it.id}" data-i="${i}">${ck(p.st === 'done')}</button><div class="grow">
    <div><b>${esc(p.name)}</b>${p.kind ? `<span class="muted small"> · ${esc(p.kind)}</span>` : ''}</div>
    ${p.address || p.city ? `<div class="small muted">${esc([p.address, p.city, p.country].filter(Boolean).join(', '))}</div>` : ''}
    ${p.note ? `<div class="small" style="margin-top:3px">${esc(p.note)}</div>` : ''}${p.price ? `<div class="tiny faint">${esc(p.price)}</div>` : ''}
    ${showFrom ? `<div class="from">из «${esc(it.title)}»</div>` : ''}</div>
    <a class="ib" target="_blank" rel="noopener" href="${mapsUrl([p.name, p.address, p.city || it.data.city, p.country].filter(Boolean).join(' '))}">${I('map')}</a></div>`;
}
function rProducts(it, d) {
  return `<div class="sec"><h3>🛍️ Товары</h3><div class="box">${d.products.map((p, i) => `<div class="li">${Number.isInteger(p.image) ? img(it, 'i' + p.image, 'cov', '').replace('class="cov"', 'class="cov" style="width:56px;height:56px;border-radius:10px;object-fit:cover;flex:none"') : ''}<div class="grow">
    <div class="tiny faint" style="text-transform:uppercase;font-weight:700">${esc(p.category || '')}</div><div><b>${esc(p.name)}</b>${p.brand ? ' · ' + esc(p.brand) : ''}</div>
    ${p.price || p.where ? `<div class="small muted">${esc([p.price, p.where].filter(Boolean).join(' · '))}</div>` : ''}${p.note ? `<div class="small">${esc(p.note)}</div>` : ''}</div>
    <div class="row" style="gap:0"><a class="ib" target="_blank" rel="noopener" href="${searchUrl([p.brand, p.name, 'купить'].filter(Boolean).join(' '))}">${I('search')}</a><button class="ib" data-act="prodToShop" data-id="${it.id}" data-i="${i}">${I('cart')}</button></div></div>`).join('')}</div></div>`;
}
function rHowto(it, d) {
  return (d.materials.length ? `<div class="sec"><h3>🧰 Понадобится</h3><div class="box">${d.materials.map((m, i) => { const on = ui.checked[it.id + ':m' + i]; return `<button class="li ${on ? 'done' : ''}" style="width:100%;text-align:left" data-act="checkMat" data-id="${it.id}" data-i="${i}">${ck(on)}<span class="t">${esc(m)}</span></button>`; }).join('')}</div></div>` : '') +
    `<div class="sec"><h3>🪜 По шагам</h3><div class="steps">${d.steps.map((s, i) => stepCard(it, s, i)).join('')}</div>${d.steps.length ? goSteps(it, 'Делать по шагам') : ''}</div>` + tipsSec(d.tips);
}
function rOutfit(it, d) {
  return metas([['Стиль', d.vibe]]) + `<div class="sec"><h3>👚 Вещи</h3><div class="steps">${d.items.map((p, i) => `<div class="step">${Number.isInteger(p.image) ? img(it, 'i' + p.image) : ''}<div class="sb"><div class="grow"><b>${esc(p.piece)}</b>${p.color ? `<span class="muted"> · ${esc(p.color)}</span>` : ''}${p.brand ? `<div class="small muted">${esc(p.brand)}</div>` : ''}${p.note ? `<div class="small">${esc(p.note)}</div>` : ''}</div>
    <a class="ib" target="_blank" rel="noopener" href="${searchUrl([p.color, p.piece, p.brand, 'купить'].filter(Boolean).join(' '))}">${I('search')}</a><button class="ib" data-act="outfitToShop" data-id="${it.id}" data-i="${i}">${I('cart')}</button></div></div>`).join('')}</div></div>` + tipsSec(d.tips);
}
function watchRow(it, t, i, showFrom) {
  return `<div class="bk">${Number.isInteger(t.image) ? img(it, 'i' + t.image, 'cov', '<div class="cov ph">🎬</div>') : '<div class="cov ph">🎬</div>'}<div class="grow"><div class="nm">${esc(t.title)}</div>
    <div class="au">${esc([t.kind, t.year, t.genre].filter(Boolean).join(' · '))}</div>${t.original && t.original !== t.title ? `<div class="tiny faint">${esc(t.original)}</div>` : ''}
    ${t.about ? `<div class="ab">${esc(t.about)}</div>` : ''}${showFrom ? `<div class="from" style="margin-top:4px">из «${esc(it.title)}»</div>` : ''}
    <div class="row wrap" style="gap:6px"><button class="st ${t.st || ''}" data-act="watchSt" data-id="${it.id}" data-i="${i}">${WST[t.st || '']}</button><a class="st" href="${searchUrl(`${t.title} ${t.year || ''} смотреть`)}" target="_blank" rel="noopener">Найти ↗</a></div></div></div>`;
}
function rWatch(it, d) { return `<div class="sec"><h3>🎬 Что посмотреть</h3><div class="box">${d.titles.map((t, i) => watchRow(it, t, i)).join('')}</div></div>`; }
function rIdeas(it, d) {
  return (d.quote ? `<div class="sec"><div class="box" style="padding:18px;font-family:var(--serif);font-size:19px;line-height:1.4">«${esc(d.quote)}»</div></div>` : '') +
    ((d.points || []).length ? `<div class="sec"><h3>📝 Главное</h3><ul class="tips">${d.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : '');
}

/* ---------------- списки ---------------- */
function vLists() {
  const segs = [['shop', '🛒 Покупки'], ['books', '📚 Книги'], ['watch', '🎬 Посмотреть'], ['places', '📍 Места']];
  let body = '';
  if (ui.list === 'shop') {
    const open = S.shop.filter(x => !x.done), done = S.shop.filter(x => x.done);
    const groups = {}; for (const x of open) (groups[x.from || ''] = groups[x.from || ''] || []).push(x);
    const row = x => `<button class="li ${x.done ? 'done' : ''}" style="width:100%;text-align:left" data-act="shopCk" data-id="${x.id}">${ck(x.done)}<span class="t grow">${esc(x.text)}</span><span class="q">${esc(x.qty || '')}</span></button>`;
    body = `<div class="add" style="margin-bottom:14px"><input id="shopInput" placeholder="Добавить: молоко, тушь…" enterkeyhint="done"><button class="go" data-act="shopAdd">+</button></div>
      ${open.length ? Object.entries(groups).map(([from, arr]) => { const it = item(from); return `<div class="box" style="margin-bottom:12px">${`<div class="grp">${it ? `${cat(it.type).e} ${esc(it.title)}` : 'Своё'}</div>`}${arr.map(row).join('')}</div>`; }).join('') : `<div class="empty"><div class="big">🛒</div><h3>Список пуст</h3><div>Добавляй ингредиенты из рецептов и продукты из туториалов кнопкой ${I('cart').replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')}</div></div>`}
      ${done.length ? `<div class="box" style="opacity:.75">${done.map(row).join('')}</div>` : ''}
      <div class="btns" style="margin-top:12px">${open.length ? `<button class="btn ghost" data-act="shopShare">${I('share')} Отправить список</button>` : ''}${done.length ? `<button class="btn ghost" data-act="shopClear">${I('trash')} Убрать купленное</button>` : ''}</div>`;
  } else if (ui.list === 'books' || ui.list === 'watch') {
    const isB = ui.list === 'books', key = isB ? 'books' : 'titles', ST = isB ? BST : WST;
    const rows = []; for (const it of S.items) if (it.status === 'done' && it.data && Array.isArray(it.data[key]) && (isB ? it.type === 'books' : it.type === 'watch')) it.data[key].forEach((b, i) => rows.push([it, b, i]));
    const f = ui.bookF; const shown = rows.filter(([, b]) => f === 'all' || (b.st || '') === (f === 'none' ? '' : f));
    const cnt = k => rows.filter(([, b]) => (b.st || '') === k).length;
    const filters = isB ? [['all', 'Все', rows.length], ['want', 'Хочу', cnt('want')], ['doing', 'Читаю', cnt('doing')], ['done', 'Прочитано', cnt('done')]] : [['all', 'Все', rows.length], ['want', 'Хочу', cnt('want')], ['done', 'Посмотрено', cnt('done')]];
    body = rows.length ? `<div class="chips" style="padding-top:0">${filters.map(([k, n, c]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="bookF" data-v="${k}">${n} <span class="n">${c}</span></button>`).join('')}</div>
      <div class="box">${shown.map(([it, b, i]) => isB ? bookRow(it, b, i, true) : watchRow(it, b, i, true)).join('') || '<div class="li muted">Здесь пока пусто</div>'}</div>`
      : `<div class="empty"><div class="big">${isB ? '📚' : '🎬'}</div><h3>${isB ? 'Книг пока нет' : 'Пока пусто'}</h3><div>${isB ? 'Кинь доску или пин Pinterest с книгами, пост-подборку из Instagram или TikTok — книги появятся здесь' : 'Кинь подборку фильмов или сериалов — они появятся здесь'}</div></div>`;
  } else {
    const rows = []; for (const it of S.items) if (it.status === 'done' && it.type === 'places') it.data.places.forEach((p, i) => rows.push([it, p, i]));
    const byCity = {}; for (const r of rows) { const c = r[1].city || r[0].data.city || 'Без города'; (byCity[c] = byCity[c] || []).push(r); }
    body = rows.length ? Object.entries(byCity).map(([c, arr]) => `<div class="box" style="margin-bottom:12px"><div class="grp">${esc(c)} · ${arr.length}</div>${arr.map(([it, p, i]) => placeRow(it, p, i, true)).join('')}</div>`).join('')
      : `<div class="empty"><div class="big">📍</div><h3>Мест пока нет</h3><div>Кидай рилсы «куда сходить в …» — места соберутся здесь по городам</div></div>`;
  }
  return `<div class="page"><div class="h1">Списки</div>
    <div class="seg">${segs.map(([k, n]) => `<button class="chip ${ui.list === k ? 'on' : ''}" data-act="list" data-v="${k}">${n}</button>`).join('')}</div>${body}</div>`;
}

/* ---------------- настройки ---------------- */
function vSettings() {
  const s = S.settings;
  let mc = null; try { mc = JSON.parse(localStorage.getItem('polka.models')); } catch (e) { }
  const done = S.items.filter(x => x.status === 'done').length;
  return `<div class="page"><div class="h1">Настройки</div>
    <div class="sec" style="margin-top:6px"><h3>Аккаунт</h3><div class="box">
      ${SY.on ? `<div class="li">${SY.pic ? `<img class="avatar" src="${esc(SY.pic)}" alt="">` : GLOGO.replace('<svg', '<svg style="width:28px;height:28px"')}<div class="grow"><b>${esc(SY.name || 'Google')}</b><div class="small muted">${esc(SY.email || '')}</div><div class="tiny faint">${esc(syncLabel())}</div></div></div>
        <button class="opt" data-act="syncNow">${I('cloud')} Синхронизировать сейчас</button>
        <button class="opt" data-act="logout">${I('logout')} Выйти</button>`
      : `<div class="li"><div class="grow">Без входа карточки хранятся только на этом устройстве.</div></div><button class="opt" data-act="login">${GLOGO} Войти через Google</button>`}
    </div></div>
    <div class="sec"><h3>ИИ — Google Gemini</h3><div class="box" style="padding:14px">
      <div class="field"><label>Ключ API (бесплатный)</label><input id="gkey" type="password" value="${esc(s.geminiKey)}" placeholder="AIza…" autocomplete="off"></div>
      <div class="btns"><button class="btn pri" data-act="saveKey">Сохранить и проверить</button><a class="btn ghost" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Получить ключ ↗</a></div>
      <div class="small muted" style="margin-top:10px">Ключ хранится только у тебя (на устройстве и в скрытой папке твоего Drive). ${mc && mc.list && mc.list[0] ? 'Сейчас работает: <b>' + esc(s.model !== 'auto' && s.model || mc.list[0]) + '</b>' : ''}</div>
      <div class="field" style="margin-top:14px"><label>Язык разборов</label><select data-input="lang">${Object.entries({ ru: 'Русский', uk: 'Українська', en: 'English' }).map(([k, v]) => `<option value="${k}" ${s.lang === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field" style="margin-bottom:0"><label>Модель</label><select data-input="model"><option value="auto">Автоматически — самая новая Flash</option>${(mc && mc.all || []).map(m => `<option value="${esc(m)}" ${s.model === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
    </div></div>
    <div class="sec"><h3>Добавлять в один тап</h3><div class="box"><button class="opt" data-act="howShare">${I('share')} Кнопка «Поделиться → polka.» на iPhone</button></div></div>
    <div class="sec"><h3>Данные</h3><div class="box">
      <div class="li"><div class="grow">На полке: <b>${S.items.length}</b>, разобрано: <b>${done}</b></div></div>
      <button class="opt" data-act="export">${I('share')} Скачать бэкап (JSON)</button>
      <button class="opt" data-act="import">${I('plus')} Загрузить бэкап</button>
      <button class="opt" data-act="advanced">${I('gear')} Адрес воркера</button>
    </div></div>
    <div class="tiny faint" style="text-align:center;margin-top:26px">polka. · сделано для Карины</div></div>`;
}

/* ---------------- пошаговый режим ---------------- */
let wake = null;
function stepsOf(it) {
  const d = it.data || {};
  if (it.type === 'workout') return d.exercises.map(e => ({ ...e, text: e.name, extra: [e.sets && `${e.sets} × ${e.reps || ''}`, !e.sets && e.reps, e.time && '⏱ ' + e.time, e.rest && 'отдых ' + e.rest].filter(Boolean).join(' · '), how: e.how, timerSec: parseDur(e.time) || null, restSec: parseDur(e.rest) }));
  return (d.steps || []).map(s => ({ ...s, extra: [s.product && '🧴 ' + s.product, s.tool && '🖌️ ' + s.tool].filter(Boolean).join('   ') }));
}
function parseDur(s) {
  if (!s) return 0; s = String(s).toLowerCase();
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(мин|min|м\b|m\b)/), c = s.match(/(\d+)\s*(сек|sec|с\b|s\b)/);
  return Math.round((m ? parseFloat(m[1].replace(',', '.')) * 60 : 0) + (c ? +c[1] : 0));
}
function renderCook() {
  const ov = $('#overlay');
  document.body.classList.toggle('cooking', !!ui.cook);
  if (!ui.cook) { ov.innerHTML = ''; if (wake) { wake.release().catch(() => { }); wake = null; } return; }
  const it = item(ui.cook.id); if (!it) { ui.cook = null; return renderCook(); }
  const st = stepsOf(it), i = Math.min(ui.cook.i, st.length - 1), s = st[i], k = fkey(s), last = i === st.length - 1;
  const tb = (sec, label) => `<button class="tbtn" style="font-size:15px;padding:9px 14px" data-act="timer" data-sec="${sec}" data-label="${esc(label)}">${I('timer').replace('<svg', '<svg style="width:16px;height:16px"')} ${sec >= 60 ? Math.round(sec / 6) / 10 + ' мин' : sec + ' сек'}</button>`;
  ov.innerHTML = `<div class="cook">
    <div class="row"><button class="ib" data-act="cookClose">${I('close')}</button><div class="bar"><i style="width:${(i + 1) / st.length * 100}%"></i></div><div class="small" style="min-width:52px;text-align:right">${i + 1} / ${st.length}</div>
    ${it.type === 'recipe' ? `<button class="ib" data-act="cookIng" title="Ингредиенты">🥕</button>` : ''}</div>
    <div class="cimg">${k ? img(it, k) : `<div style="font-size:90px">${esc(it.emoji || cat(it.type).e)}</div>`}</div>
    ${s.zone ? `<div class="small" style="text-transform:uppercase;font-weight:800;letter-spacing:.5px;color:${cat(it.type).c};margin-bottom:6px">${esc(s.zone)}</div>` : ''}
    <div class="ctext">${esc(s.text)}</div>
    ${s.extra ? `<div style="margin-top:8px;color:#b9afa4">${esc(s.extra)}</div>` : ''}${s.how ? `<div style="margin-top:6px;color:#b9afa4;font-size:15px">${esc(s.how)}</div>` : ''}
    <div class="row wrap" style="gap:8px">${s.timer ? tb(Math.round(s.timer * 60), `шаг ${i + 1}`) : ''}${s.timerSec ? tb(s.timerSec, s.text) : ''}${s.restSec ? tb(s.restSec, 'отдых') : ''}</div>
    <div class="cnav"><button data-act="cookNav" data-d="-1" ${i === 0 ? 'style="opacity:.4"' : ''}>Назад</button><button class="pri" data-act="cookNav" data-d="1">${last ? 'Готово 🎉' : 'Дальше'}</button></div></div>`;
  hydrate(ov);
  if (!wake && navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { wake = w; }).catch(() => { });
}

/* ---------------- таймеры ---------------- */
let TIMERS = [];
function startTimer(sec, label) {
  TIMERS.push({ id: uid(), label, end: Date.now() + sec * 1000 });
  if (window.Notification && Notification.permission === 'default') Notification.requestPermission().catch(() => { });
  tickTimers(); toast('Таймер запущен');
}
function tickTimers() {
  let box = $('#timersG');
  if (!box) { box = document.createElement('div'); box.id = 'timersG'; box.className = 'timers'; document.body.appendChild(box); }
  box.innerHTML = TIMERS.map(t => {
    const left = Math.ceil((t.end - Date.now()) / 1000);
    if (left <= 0 && !t.rang) { t.rang = true; ring(t); }
    return `<button class="timer ${left <= 0 ? 'ring' : ''}" data-act="timerStop" data-id="${t.id}">⏱ ${left > 0 ? fmtT(left) : 'Готово!'} <span class="small" style="opacity:.7;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.label)}</span> ✕</button>`;
  }).join('');
}
function ring(t) {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)();
    [0, .35, .7, 1.4, 1.75, 2.1].forEach(d => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.25, a.currentTime + d); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + d + .3); o.start(a.currentTime + d); o.stop(a.currentTime + d + .3); });
  } catch (e) { }
  try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) { }
  try { if (window.Notification && Notification.permission === 'granted') new Notification('⏱ Время вышло', { body: t.label, icon: 'icon-192.png' }); } catch (e) { }
}
setInterval(() => { if (TIMERS.length) tickTimers(); }, 1000);

/* ---------------- листы ---------------- */
function sheet(html) {
  closeSheet();
  const w = document.createElement('div'); w.className = 'sheetwrap';
  w.innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`;
  w.addEventListener('click', e => { if (e.target === w) closeSheet(); });
  document.body.appendChild(w); return w;
}
function closeSheet() { $$('.sheetwrap').forEach(x => x.remove()); }

/* ---------------- текст для «Поделиться» ---------------- */
function itemText(it) {
  const d = it.data || {}, L = [`${it.emoji || ''} ${it.title}`.trim()];
  if (it.summary) L.push(it.summary);
  const num = (a, f) => a.map((x, i) => `${i + 1}. ${f(x)}`).join('\n');
  switch (it.type) {
    case 'recipe': L.push('', 'Ингредиенты:', d.ingredients.map(x => `• ${x.name}${x.qty != null || x.unit ? ' — ' + [fmtQty(x.qty), x.unit].filter(Boolean).join(' ') : ''}`).join('\n'), '', 'Приготовление:', num(d.steps, s => s.text)); break;
    case 'beauty': L.push('', 'Продукты:', d.products.map(p => `• ${p.category ? p.category + ': ' : ''}${[p.brand, p.name, p.shade].filter(Boolean).join(' ')}`).join('\n'), '', 'Шаги:', num(d.steps, s => (s.zone ? s.zone + ': ' : '') + s.text)); break;
    case 'books': L.push('', num(d.books, b => `${b.title}${b.author ? ' — ' + b.author : ''}`)); break;
    case 'watch': L.push('', num(d.titles, b => `${b.title}${b.year ? ' (' + b.year + ')' : ''}`)); break;
    case 'workout': L.push('', num(d.exercises, e => `${e.name}${e.sets ? ` — ${e.sets}×${e.reps || ''}` : e.reps ? ' — ' + e.reps : ''}`)); break;
    case 'places': L.push('', num(d.places, p => `${p.name}${p.address ? ', ' + p.address : ''}${p.note ? ' — ' + p.note : ''}`)); break;
    case 'products': L.push('', num(d.products, p => [p.brand, p.name, p.price].filter(Boolean).join(' · '))); break;
    case 'howto': if (d.materials.length) L.push('', 'Понадобится: ' + d.materials.join(', ')); L.push('', num(d.steps, s => s.text)); break;
    case 'outfit': L.push('', d.items.map(p => `• ${[p.piece, p.color, p.brand].filter(Boolean).join(', ')}`).join('\n')); break;
    default: if (d.quote) L.push('', '«' + d.quote + '»'); L.push('', (d.points || []).map(p => '• ' + p).join('\n'));
  }
  if (d.tips && d.tips.length) L.push('', 'Советы:', d.tips.map(t => '• ' + t).join('\n'));
  if (it.url) L.push('', it.url);
  return L.join('\n');
}
async function shareText(title, text) {
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast('Скопировано'); } catch (e) { toast('Не удалось скопировать'); }
}

/* =====================================================================
   ДЕЙСТВИЯ
   ===================================================================== */
function openItem(id) { ui.open = id; history.pushState({ o: id }, ''); renderDetail(); }
function closeItem() { if (ui.open) { ui.open = null; renderDetail(); } }
window.addEventListener('popstate', () => { if (ui.cook) { ui.cook = null; renderCook(); history.pushState({ o: ui.open }, ''); return; } if ($('.sheetwrap')) { closeSheet(); return; } closeItem(); render(); });
function delItem(id) {
  S.items = S.items.filter(x => x.id !== id); MDB.del(id).catch(() => { }); pendingFiles.delete(id);
  save(true); if (ui.open === id) { ui.open = null; history.back(); } render(); toast('Удалено');
}
function addShop(list, from) {
  let n = 0;
  for (const [text, qty] of list) { if (!text) continue; const ex = S.shop.find(x => !x.done && x.text.toLowerCase() === text.toLowerCase() && x.from === from); if (ex) continue; S.shop.push({ id: uid(), text, qty: qty || '', from: from || '', done: false, added: Date.now() }); n++; }
  save(); toast(n ? `В списке покупок +${n}` : 'Уже в списке');
}
const cycle = (v, arr) => arr[(arr.indexOf(v || '') + 1) % arr.length];

const A = {
  tab: el => { ui.tab = el.dataset.v; closeItem(); render(); window.scrollTo(0, 0); },
  cat: el => { ui.cat = el.dataset.v; render(); },
  toggleSearch: () => { ui.searching = !ui.searching; if (!ui.searching) ui.q = ''; render(); setTimeout(() => $('#searchInput') && $('#searchInput').focus(), 30); },
  tagSearch: el => { ui.q = el.dataset.v; ui.searching = true; ui.cat = 'all'; ui.tab = 'home'; ui.open = null; history.back(); render(); },
  add: () => { const v = $('#addInput').value; if (addLinks(v)) $('#addInput').value = ''; },
  paste: async () => { try { const t = await navigator.clipboard.readText(); if (!t) return toast('Буфер пуст'); if (!addLinks(t)) $('#addInput').value = t; } catch (e) { toast('Разреши доступ к буферу или вставь вручную'); $('#addInput').focus(); } },
  pickFiles: () => $('#filePick').click(),
  open: el => openItem(el.dataset.id),
  close: () => history.back(),
  fav: el => { const it = item(el.dataset.id); it.fav = !it.fav; save(); renderDetail(); },
  more: el => {
    const it = item(el.dataset.id);
    sheet(`<h2>${esc(it.title || 'Карточка')}</h2><div class="box">
      ${it.url ? `<a class="opt" href="${esc(it.url)}" target="_blank" rel="noopener">${I('ext')} Открыть оригинал</a><button class="opt" data-act="copyLink" data-id="${it.id}">${I('paste')} Скопировать ссылку</button>` : ''}
      <button class="opt" data-act="retryHint" data-id="${it.id}">${I('sparkle')} Разобрать заново с подсказкой</button>
      ${it.status === 'done' ? `<button class="opt" data-act="changeCat" data-id="${it.id}">${I('tag')} Сменить категорию</button>` : ''}
      <button class="opt" data-act="del" data-id="${it.id}" style="color:var(--err)">${I('trash').replace('<svg', '<svg style="color:var(--err)"')} Удалить</button></div>`);
  },
  copyLink: el => { closeSheet(); navigator.clipboard.writeText(item(el.dataset.id).url).then(() => toast('Ссылка скопирована')); },
  retry: el => { const it = item(el.dataset.id); if (!it) return; closeSheet(); it.status = 'queue'; it.error = ''; it.stage = ''; save(true); render(); runQueue(); if (!S.settings.geminiKey) toast('Сначала добавь ключ Gemini в настройках'); },
  retryHint: el => { const it = item(el.dataset.id); sheet(`<h2>Подсказка для ИИ</h2><div class="field"><textarea id="hintIn" placeholder="Например: это рецепт, распиши граммовки; или: нужен только список книг">${esc(it.hint || '')}</textarea></div><button class="btn pri wide" data-act="retryHintGo" data-id="${it.id}">Разобрать заново</button>`); setTimeout(() => $('#hintIn').focus(), 50); },
  retryHintGo: el => { const it = item(el.dataset.id); it.hint = $('#hintIn').value.trim(); A.retry(el); },
  del: el => { const it = item(el.dataset.id); sheet(`<h2>Удалить «${esc(it.title || 'карточку')}»?</h2><div class="muted" style="margin-bottom:16px">Карточка удалится со всех устройств.</div><div class="btns"><button class="btn grow" data-act="closeSheet">Отмена</button><button class="btn pri grow" style="background:var(--err)" data-act="delYes" data-id="${it.id}">Удалить</button></div>`); },
  delYes: el => { closeSheet(); delItem(el.dataset.id); },
  closeSheet: () => closeSheet(),
  changeCat: el => { const it = item(el.dataset.id); sheet(`<h2>Какая это категория?</h2><div class="muted small" style="margin-bottom:12px">ИИ разберёт пост заново под выбранную категорию.</div><div class="box">${Object.entries(CATS).map(([k, c]) => `<button class="opt" data-act="setCat" data-id="${it.id}" data-v="${k}"><span style="font-size:20px">${c.e}</span> ${c.name} ${it.type === k ? '✓' : ''}</button>`).join('')}</div>`); },
  setCat: el => { const it = item(el.dataset.id); it.hint = `Пользователь уточнил: это категория «${CATS[el.dataset.v].name}», тип ${el.dataset.v}. Используй именно этот type.`; A.retry(el); },
  checkIng: el => { const k = el.dataset.id + ':' + el.dataset.i; ui.checked[k] = !ui.checked[k]; renderDetail(); },
  checkMat: el => { const k = el.dataset.id + ':m' + el.dataset.i; ui.checked[k] = !ui.checked[k]; renderDetail(); },
  serv: el => { const it = item(el.dataset.id), base = +it.data.servings; ui.servings[it.id] = Math.max(1, (ui.servings[it.id] || base) + +el.dataset.d); renderDetail(); },
  toShop: el => { const it = item(el.dataset.id), d = it.data, base = +d.servings || 0, f = base && ui.servings[it.id] ? ui.servings[it.id] / base : 1; addShop(d.ingredients.filter((x, i) => !ui.checked[it.id + ':' + i]).map(x => [x.name, [fmtQty(x.qty != null ? x.qty * f : null), x.unit].filter(Boolean).join(' ')]), it.id); },
  prodToShop: el => { const it = item(el.dataset.id), p = it.data.products[+el.dataset.i]; addShop([[[p.brand, p.name, p.shade && '(' + p.shade + ')'].filter(Boolean).join(' '), p.price || '']], it.id); },
  outfitToShop: el => { const it = item(el.dataset.id), p = it.data.items[+el.dataset.i]; addShop([[[p.piece, p.color, p.brand].filter(Boolean).join(', '), '']], it.id); },
  bookSt: el => { const it = item(el.dataset.id), b = it.data.books[+el.dataset.i]; b.st = cycle(b.st, ['', 'want', 'doing', 'done']); save(); render(); },
  watchSt: el => { const it = item(el.dataset.id), b = it.data.titles[+el.dataset.i]; b.st = cycle(b.st, ['', 'want', 'done']); save(); render(); },
  placeSt: el => { const it = item(el.dataset.id), p = it.data.places[+el.dataset.i]; p.st = p.st === 'done' ? '' : 'done'; save(); render(); },
  allBooks: () => { ui.tab = 'lists'; ui.list = 'books'; ui.bookF = 'all'; ui.open = null; history.back(); render(); },
  cook: el => { ui.cook = { id: el.dataset.id, i: 0 }; history.pushState({ c: 1 }, ''); renderCook(); },
  cookNav: el => { const st = stepsOf(item(ui.cook.id)); const n = ui.cook.i + +el.dataset.d; if (n >= st.length) { history.back(); toast('Готово! 🎉'); return; } ui.cook.i = Math.max(0, n); renderCook(); },
  cookClose: () => history.back(),
  cookIng: () => { const it = item(ui.cook.id); sheet(`<h2>Ингредиенты</h2><div class="box">${it.data.ingredients.map(x => `<div class="li"><span class="grow">${esc(x.name)}</span><span class="q">${esc([fmtQty(x.qty), x.unit].filter(Boolean).join(' '))}</span></div>`).join('')}</div>`); },
  timer: el => startTimer(el.dataset.sec ? +el.dataset.sec : Math.round(+el.dataset.min * 60), el.dataset.label || 'Таймер'),
  timerStop: el => { TIMERS = TIMERS.filter(t => t.id !== el.dataset.id); tickTimers(); },
  ask: async el => {
    const it = item(el.dataset.id), inp = $('#ask_' + it.id), q = inp.value.trim(); if (!q) return inp.focus();
    inp.value = ''; it.qa = it.qa || []; const qa = { q, a: '' }; it.qa.push(qa); renderDetail();
    try {
      const ctx = JSON.stringify({ title: it.title, type: it.type, summary: it.summary, data: it.data, source: it.src && it.src.text, note: it.note }).slice(0, 30000);
      qa.a = await gemini([{ text: `Вот карточка из приложения polka. (JSON): ${ctx}\n\nОтветь на вопрос по-${S.settings.lang === 'uk' ? 'украински' : S.settings.lang === 'en' ? 'английски' : 'русски'}, кратко и по делу, можно пунктами, без markdown-разметки (без ** и #). Используй и карточку, и общие знания.\nВопрос: ${q}` }], { json: false, temp: .5 });
    } catch (e) { qa.a = '⚠️ ' + e.message; }
    save(); renderDetail();
  },
  shareItem: el => { const it = item(el.dataset.id); shareText(it.title, itemText(it)); },
  list: el => { ui.list = el.dataset.v; ui.bookF = 'all'; render(); },
  bookF: el => { ui.bookF = el.dataset.v; render(); },
  shopCk: el => { const x = S.shop.find(s => s.id === el.dataset.id); x.done = !x.done; save(); render(); },
  shopAdd: () => { const v = $('#shopInput').value.trim(); if (!v) return; v.split(/[,\n]/).map(s => s.trim()).filter(Boolean).forEach(t => S.shop.push({ id: uid(), text: t, qty: '', from: '', done: false, added: Date.now() })); $('#shopInput').value = ''; save(); render(); $('#shopInput').focus(); },
  shopShare: () => shareText('Список покупок', '🛒 Список покупок\n\n' + S.shop.filter(x => !x.done).map(x => `• ${x.text}${x.qty ? ' — ' + x.qty : ''}`).join('\n')),
  shopClear: () => { S.shop = S.shop.filter(x => !x.done); save(); render(); },
  login: () => gLogin(false),
  logout: () => { SY = {}; sySave(); S.skipLogin = true; save(true); render(); toast('Ты вышла. Карточки остались на этом устройстве'); },
  skipLogin: () => { S.skipLogin = true; save(true); render(); },
  syncNow: () => syncNow(true),
  saveKey: async () => {
    const k = $('#gkey').value.trim(); S.settings.geminiKey = k; S.settingsU = Date.now(); localStorage.removeItem('polka.models'); save(true);
    if (!k) return toast('Ключ удалён');
    toast('Проверяю ключ…');
    try { const r = await gemini([{ text: 'Ответь одним словом: ок' }], { json: false, temp: 0 }); toast('✓ Ключ работает (' + (ui.lastModel || 'Gemini') + ')'); render(); runQueue(); }
    catch (e) { toast(e.message, 4500); }
  },
  export: () => {
    const data = JSON.stringify({ ...S, settings: { ...S.settings, geminiKey: '' } }, null, 1);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = `polka-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  },
  import: () => $('#importPick').click(),
  advanced: () => sheet(`<h2>Адрес воркера</h2><div class="muted small" style="margin-bottom:12px">Воркер Cloudflare достаёт видео и подписи из соцсетей. Оставь пустым, чтобы использовать адрес по умолчанию.</div><div class="field"><input id="wIn" value="${esc(S.settings.worker)}" placeholder="${esc(CONF.worker)}"></div><div class="btns"><button class="btn pri grow" data-act="saveWorker">Сохранить</button><button class="btn grow" data-act="testWorker">Проверить</button></div>`),
  saveWorker: () => { S.settings.worker = $('#wIn').value.trim(); S.settingsU = Date.now(); save(true); closeSheet(); toast('Сохранено'); },
  testWorker: async () => { const u = ($('#wIn').value.trim() || CONF.worker).replace(/\/$/, ''); try { const j = await fetchJ(u + '/ping'); toast(j.ok ? '✓ Воркер отвечает' : 'Странный ответ'); } catch (e) { toast('Воркер не отвечает: ' + e.message, 4000); } },
  howShare: () => sheet(`<h2>Добавлять в один тап</h2>
    <div class="muted" style="margin-bottom:14px">Сделай «Быструю команду» — и в Instagram, TikTok или Pinterest будет пункт <b>polka.</b> в меню «Поделиться».</div>
    <ol style="padding-left:20px;margin:0 0 14px;line-height:1.55">
      <li>Открой приложение <b>Быстрые команды</b> → <b>+</b>.</li>
      <li>Нажми на название сверху → <b>Показывать в меню «Поделиться»</b>. Тип входных данных: <b>URL</b> и <b>Текст</b>.</li>
      <li>Добавь действие <b>Кодировать URL</b> (Входные данные быстрой команды).</li>
      <li>Добавь действие <b>Открыть URL</b> и впиши:<br><code style="word-break:break-all;background:var(--surface2);padding:2px 6px;border-radius:6px">${esc(CONF.home)}?add=</code> + переменная <b>URL-кодированный текст</b>.</li>
      <li>Назови команду <b>polka.</b> и выбери иконку.</li></ol>
    <div class="muted small">Теперь: пост → «Поделиться» → <b>polka.</b> — приложение откроется и сразу начнёт разбор. На Android: установи polka. на главный экран — она появится в меню «Поделиться» сама.</div>
    <button class="btn wide" style="margin-top:16px" data-act="closeSheet">Понятно</button>`),
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const f = A[el.dataset.act]; if (!f) return;
  if (el.tagName === 'A' && !el.target) e.preventDefault();
  if (el.tagName === 'A' && el.target) return;
  e.preventDefault(); f(el, e);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'searchInput') { ui.q = el.value; render(); return; }
  if (el.dataset.input === 'note') { const it = item(el.dataset.id); it.note = el.value; save(); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.input === 'lang' || el.dataset.input === 'model') { S.settings[el.dataset.input] = el.value; S.settingsU = Date.now(); save(true); toast('Сохранено'); }
  if (el.id === 'filePick') { addFiles(el.files); el.value = ''; }
  if (el.id === 'importPick') {
    const f = el.files[0]; el.value = ''; if (!f) return;
    f.text().then(t => { const d = JSON.parse(t); if (!Array.isArray(d.items)) throw 0; let n = 0; for (const it of d.items) if (!item(it.id)) { S.items.push(it); n++; } for (const x of d.shop || []) if (!S.shop.find(s => s.id === x.id)) S.shop.push(x); S.items.sort((a, b) => b.added - a.added); save(true); render(); toast(`Загружено карточек: ${n}`); }).catch(() => toast('Это не бэкап polka.'));
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.shiftKey) return;
  const id = e.target.id || '';
  if (id === 'addInput') { e.preventDefault(); A.add(); }
  else if (id === 'shopInput') { e.preventDefault(); A.shopAdd(); }
  else if (id.startsWith('ask_')) { e.preventDefault(); A.ask({ dataset: { id: id.slice(4) } }); }
  else if (id === 'searchInput') e.target.blur();
});
document.addEventListener('paste', e => {
  if (e.target.id !== 'addInput') return;
  const files = [...(e.clipboardData && e.clipboardData.files || [])];
  if (files.length) { e.preventDefault(); addFiles(files); }
});

/* =====================================================================
   СИНХРОНИЗАЦИЯ: Google Drive, скрытая папка приложения
   polka.json — все карточки (текст), polka-m-<id>-<rev>.json — картинки карточки
   ===================================================================== */
const GSCOPE = 'https://www.googleapis.com/auth/drive.appdata openid email profile';
const GREDIRECT = location.origin + location.pathname;
const SYKEY = 'polka.sync';
let SY = (() => { try { return JSON.parse(localStorage.getItem(SYKEY)) || {}; } catch (e) { return {}; } })();
const sySave = () => { try { localStorage.setItem(SYKEY, JSON.stringify(SY)); } catch (e) { } };
const tokenOk = () => SY.token && SY.exp > Date.now() + 60e3;
let syState = '';

const COLS = ['items', 'shop'];
const TRANSIENT = new Set(['u', 'stage']);
let lastSig = null;
function sigOf() {
  const sig = {};
  for (const c of COLS) for (const x of S[c]) { if (!x.id) x.id = uid(); const o = {}; for (const k in x) if (!TRANSIENT.has(k)) o[k] = x[k]; sig[c + ':' + x.id] = JSON.stringify(o); }
  sig.settings = JSON.stringify(S.settings);
  return sig;
}
function stamp() {
  const now = Date.now(), sig = sigOf();
  S.tomb = S.tomb || {};
  for (const c of COLS) for (const x of S[c]) { const k = c + ':' + x.id; if (lastSig && lastSig[k] !== sig[k]) x.u = now; else if (!x.u) x.u = 1; }
  if (lastSig && lastSig.settings !== sig.settings) S.settingsU = Math.max(S.settingsU || 0, now);
  if (lastSig) for (const k in lastSig) if (k !== 'settings' && !(k in sig)) S.tomb[k] = now;
  lastSig = sig;
}
function mergeState(R) {
  const tomb = { ...(S.tomb || {}) };
  for (const [k, v] of Object.entries(R.tomb || {})) tomb[k] = Math.max(tomb[k] || 0, v);
  for (const c of COLS) {
    const m = new Map(S[c].map(x => [x.id, x]));
    for (const r of R[c] || []) { const l = m.get(r.id); if (!l || (r.u || 0) > (l.u || 0)) { if (l && l.status === 'work' && r.status !== 'done') continue; m.set(r.id, r); } }
    S[c] = [...m.values()].filter(x => !(tomb[c + ':' + x.id] >= (x.u || 0)));
  }
  S.items.sort((a, b) => (b.added || 0) - (a.added || 0));
  if ((R.settingsU || 0) > (S.settingsU || 0)) { S.settings = { ...S.settings, ...R.settings }; S.settingsU = R.settingsU; }
  const old = Date.now() - 90 * 864e5; for (const k in tomb) if (tomb[k] < old) delete tomb[k];
  S.tomb = tomb;
}
const payload = () => ({ version: 1, items: S.items.map(x => { const { stage, ...r } = x; return r; }), shop: S.shop, settings: S.settings, settingsU: S.settingsU || 0, tomb: S.tomb || {} });

function gLogin(silent) {
  if (CONF.gclient === 'GOOGLE_CLIENT_ID') { toast('Вход через Google ещё не настроен (нет Client ID)'); return; }
  const q = new URLSearchParams({ client_id: CONF.gclient, redirect_uri: GREDIRECT, response_type: 'token', scope: GSCOPE, include_granted_scopes: 'true', state: silent ? 'polka-silent' : 'polka' });
  if (silent) { q.set('prompt', 'none'); if (SY.email) q.set('login_hint', SY.email); SY.silentAt = Date.now(); }
  else q.set('prompt', SY.email ? 'consent' : 'select_account consent');
  sySave(); save(true);
  location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + q;
}
async function gfetch(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + SY.token, ...(opt.headers || {}) } });
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
  return r;
}
const DAPI = 'https://www.googleapis.com/drive/v3/files', DUP = 'https://www.googleapis.com/upload/drive/v3/files';
async function listFiles(q) {
  let out = [], page = '';
  do {
    const j = await (await gfetch(`${DAPI}?spaces=appDataFolder&pageSize=1000&q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,modifiedTime)&orderBy=modifiedTime desc${page ? '&pageToken=' + page : ''}`)).json();
    out = out.concat(j.files || []); page = j.nextPageToken;
  } while (page);
  return out;
}
async function putFile(id, name, data) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  if (!id) id = (await (await gfetch(`${DAPI}?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parents: ['appDataFolder'], mimeType: 'application/json' }) })).json()).id;
  await gfetch(`${DUP}/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
  return id;
}

let syncing = false, syncAgain = false, syncT;
function syncSoon() { if (!SY.on) return; clearTimeout(syncT); syncT = setTimeout(syncNow, 2500); }
async function syncNow(manual) {
  if (!SY.on) { if (manual) gLogin(false); return; }
  if (!tokenOk()) { SY.need = true; sySave(); setSync('err'); if (manual) gLogin(false); return; }
  if (syncing) { syncAgain = true; return; }
  syncing = true; setSync('sync');
  try {
    let id = SY.fileId, remote = null;
    if (!id) { const f = await listFiles("name='polka.json'"); id = f[0] && f[0].id; }
    if (id) {
      try { remote = await (await gfetch(`${DAPI}/${id}?alt=media`)).json(); }
      catch (e) { if (e.status === 404) { const f = await listFiles("name='polka.json'"); id = f[0] && f[0].id; if (id) remote = await (await gfetch(`${DAPI}/${id}?alt=media`)).json(); } else throw e; }
    }
    const before = JSON.stringify(payload());
    if (remote) { mergeState(remote); lastSig = sigOf(); }
    const after = JSON.stringify(payload());
    if (after !== before) { localStorage.setItem(KEY, JSON.stringify(S)); render(); runQueue(); }
    if (!remote || JSON.stringify(remote) !== after) id = await putFile(id, 'polka.json', after);
    SY.fileId = id; SY.last = Date.now(); SY.need = false; SY.err = null;
    await syncMedia();
    setSync('');
    if (manual) toast('Синхронизировано ✓');
  } catch (e) {
    console.warn('sync', e);
    if (e.status === 401 || e.status === 403) { SY.token = null; SY.need = true; } else SY.err = e.message;
    setSync('err'); if (manual) toast(SY.need ? 'Нужно снова войти в Google' : 'Нет связи с Google Drive, попробую позже');
  } finally { syncing = false; sySave(); if (syncAgain) { syncAgain = false; syncSoon(); } }
}
async function syncMedia() {
  const files = await listFiles("name contains 'polka-m-'");
  const byName = new Map(files.map(f => [f.name, f.id]));
  const want = new Map(S.items.filter(x => x.status === 'done' && x.mrev).map(x => [x.id, `polka-m-${x.id}-${x.mrev}.json`]));
  let got = 0;
  await pool([...want], 3, async ([id, name]) => {
    const local = await MDB.get(id).catch(() => null);
    const it = item(id);
    if (local && local.rev === it.mrev) { if (!byName.has(name)) await putFile(null, name, local).catch(e => console.warn(e)); }
    else if (byName.has(name)) { try { const m = await (await gfetch(`${DAPI}/${byName.get(name)}?alt=media`)).json(); await MDB.put(id, m); got++; } catch (e) { console.warn(e); } }
  });
  // старые версии и удалённые карточки
  const keep = new Set(want.values());
  const stale = files.filter(f => !keep.has(f.name) && !S.items.some(x => f.name.startsWith(`polka-m-${x.id}-`) && x.status !== 'done'));
  await pool(stale.slice(0, 20), 3, f => gfetch(`${DAPI}/${f.id}`, { method: 'DELETE' }).catch(() => { }));
  if (got) render();
}
function setSync(st) { syState = st; const b = $('#syncBtn'); if (b) { b.className = 'ib ' + (st === 'sync' ? 'spin' : st === 'err' ? 'warn' : ''); b.title = syncLabel(); } }
function syncLabel() {
  if (!SY.on) return 'Синхронизация выключена';
  if (SY.need) return 'Нужно снова войти в Google';
  if (syState === 'sync') return 'Синхронизация…';
  return SY.last ? 'Синхронизировано в ' + new Date(SY.last).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : 'Синхронизация включена';
}
const syncButton = () => SY.on ? `<button class="ib ${SY.need ? 'warn' : syState === 'sync' ? 'spin' : ''}" id="syncBtn" data-act="syncNow" title="${esc(syncLabel())}">${I('cloud')}</button>` : '';
function syncInit() {
  if (location.hash.includes('access_token=') || location.hash.includes('error=')) {
    const h = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname + location.search);
    if (h.get('access_token')) {
      SY.token = h.get('access_token'); SY.exp = Date.now() + (+h.get('expires_in') || 3600) * 1000;
      const first = !SY.on; SY.on = true; SY.need = false; sySave();
      if (first) setTimeout(() => toast('☁️ Готово! Полка синхронизируется с Google Drive'), 600);
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + SY.token } }).then(r => r.json()).then(j => { if (j.email) { SY.email = j.email; SY.name = j.name || j.given_name || ''; SY.pic = j.picture || ''; sySave(); render(); } }).catch(() => { });
    } else if (SY.on) { SY.need = true; sySave(); }
    else if (h.get('error') && h.get('state') !== 'polka-silent') setTimeout(() => toast('Вход не удался: ' + h.get('error')), 500);
  }
  lastSig = sigOf();
}
function syncStart() {
  if (!SY.on) return;
  if (!tokenOk()) { trySilent(); return; }
  syncNow();
  setInterval(() => { if (!document.hidden) syncNow(); }, 90000);
}
function trySilent() {
  if (!SY.on || tokenOk() || $('.sheetwrap') || running) return;
  if (Date.now() - (SY.silentAt || 0) > 10 * 60e3) gLogin(true); else { SY.need = true; sySave(); setSync('err'); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden || !SY.on) return; if (tokenOk()) syncNow(); else trySilent(); });

/* =====================================================================
   ЗАПУСК
   ===================================================================== */
(function init() {
  syncInit();
  for (const it of S.items) if (it.status === 'work') { it.status = 'queue'; it.stage = ''; }
  const p = new URLSearchParams(location.search);
  const shared = ['add', 'url', 'text', 'title'].map(k => p.get(k)).filter(Boolean).join(' ');
  if (p.toString()) history.replaceState(null, '', location.pathname);
  history.replaceState({ root: 1 }, '');
  render();
  if (shared) addLinks(shared);
  runQueue();
  syncStart();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
})();
