// polka. — воркер: достаёт из ссылки подпись, картинки и видео и отдаёт их приложению.
// Ничего не хранит. Ключ Gemini сюда не попадает — ИИ вызывается из приложения.

const ALLOWED = [/^https:\/\/karinakaramel\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const DESK_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const BOT_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

export default {
  async fetch(req) {
    const origin = req.headers.get('Origin') || '';
    const okOrigin = ALLOWED.some(r => r.test(origin));
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : 'null',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, X-Final-Url',
      'Vary': 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const u = new URL(req.url);
    if (u.pathname === '/' || u.pathname === '/ping') return json({ ok: true, app: 'polka.' }, cors);
    if (!okOrigin) return json({ error: 'origin not allowed' }, cors, 403);
    try {
      if (u.pathname === '/resolve') return json(await resolve(u.searchParams.get('url') || ''), cors);
      if (u.pathname === '/media') return await media(req, u.searchParams.get('url') || '', cors);
      return json({ error: 'not found' }, cors, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, cors, 500);
    }
  },
};

const json = (o, cors, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });

/* ---------------- media proxy (видео/картинки с CORS, поддерживает Range) ---------------- */
async function media(req, target, cors) {
  if (!/^https?:\/\//i.test(target)) return json({ error: 'bad url' }, cors, 400);
  const t = new URL(target);
  const headers = { 'User-Agent': DESK_UA, 'Accept': '*/*' };
  const range = req.headers.get('Range');
  if (range) headers.Range = range;
  const ck = new URL(req.url).searchParams.get('ck');
  if (ck) headers.Cookie = ck;
  if (/tiktok|tikwm/.test(t.hostname)) headers.Referer = 'https://www.tiktok.com/';
  if (/pinimg|pinterest/.test(t.hostname)) headers.Referer = 'https://www.pinterest.com/';
  const r = await fetch(target, { headers, redirect: 'follow', cf: { cacheTtl: 3600, cacheEverything: true } });
  const h = new Headers(cors);
  for (const k of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) { const v = r.headers.get(k); if (v) h.set(k, v); }
  h.set('Cache-Control', 'public, max-age=3600');
  h.set('X-Final-Url', r.url);
  return new Response(r.body, { status: r.status, headers: h });
}

/* ---------------- resolve ---------------- */
async function resolve(input) {
  let url = String(input).trim();
  if (!url) throw new Error('пустая ссылка');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let u = new URL(url);
  const short = /^(vm|vt)\.tiktok\.com$|^pin\.it$|^t\.co$|^bit\.ly$|^tinyurl\.com$|^l\.instagram\.com$/i;
  if (short.test(u.hostname) || (/tiktok\.com$/.test(u.hostname) && u.pathname.startsWith('/t/'))) {
    url = await expand(url); u = new URL(url);
  }
  if (u.hostname === 'l.instagram.com' && u.searchParams.get('u')) { url = u.searchParams.get('u'); u = new URL(url); }
  const h = u.hostname.replace(/^(www|m|ru|uk|ua|ca|de|fr|br|in)\./, '');
  let out;
  if (/(^|\.)tiktok\.com$/.test(h)) out = await tiktok(url);
  else if (/(^|\.)instagram\.com$/.test(h)) out = await instagram(u);
  else if (/(^|\.)pinterest\.[a-z.]+$/.test(h)) out = await pinterest(u);
  else if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) out = await youtube(u);
  else out = await generic(url);
  out.images = [...new Set((out.images || []).filter(Boolean))].slice(0, 40);
  out.text = (out.text || '').slice(0, 15000);
  return out;
}

async function expand(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': DESK_UA }, redirect: 'follow' });
    let final = r.url || url;
    // pin.it иногда ведёт на api.pinterest.com/url_shortener/... с параметром
    const f = new URL(final);
    if (/api\.pinterest\.com$/.test(f.hostname)) {
      const html = await r.text();
      const m = html.match(/https:\/\/(?:[a-z]+\.)?pinterest\.[a-z.]+\/pin\/[^"'<>\s]+/i);
      if (m) final = m[0];
    }
    return final;
  } catch (e) { return url; }
}

/* ---------- TikTok ---------- */
async function tiktok(url) {
  const out = { platform: 'tiktok', url, images: [], warnings: [] };
  // 1) сама страница TikTok (данные в __UNIVERSAL_DATA_FOR_REHYDRATION__ + куки для скачивания видео)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': DESK_UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' }, redirect: 'follow' });
    const html = await r.text();
    const m = html.match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    const scope = m && JSON.parse(m[1]).__DEFAULT_SCOPE__;
    const it = scope && scope['webapp.video-detail'] && scope['webapp.video-detail'].itemInfo && scope['webapp.video-detail'].itemInfo.itemStruct;
    if (it) {
      const cookies = (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
      out.url = r.url || url;
      out.title = it.desc || ''; out.text = it.desc || '';
      out.author = it.author && (it.author.nickname || it.author.uniqueId) || '';
      out.duration = it.video && it.video.duration;
      out.thumb = it.video && (it.video.originCover || it.video.cover);
      const imgs = it.imagePost && it.imagePost.images;
      if (imgs && imgs.length) out.images = imgs.map(x => x.imageURL && x.imageURL.urlList && x.imageURL.urlList[0]).filter(Boolean);
      else {
        const v = it.video && (it.video.playAddr || it.video.downloadAddr || (it.video.bitrateInfo && it.video.bitrateInfo[0] && it.video.bitrateInfo[0].PlayAddr && it.video.bitrateInfo[0].PlayAddr.UrlList[0]));
        if (v) { out.video = v; out.mediaCookie = cookies; }
      }
      if (it.music && it.music.title) out.text += `\n[музыка: ${it.music.title}]`;
      if (it.contents) for (const c of it.contents) if (c.desc && !out.text.includes(c.desc)) out.text += '\n' + c.desc;
    } else out.warnings.push('tiktok page: нет данных');
  } catch (e) { out.warnings.push('tiktok page: ' + e.message); }
  // 2) запасной вариант — tikwm
  if (!out.video && !out.images.length) {
    try {
      const r = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': DESK_UA },
        body: new URLSearchParams({ url, hd: '0' }),
      });
      const j = await r.json();
      if (j && j.code === 0 && j.data) {
        const d = j.data, abs = s => (s && s.startsWith('/') ? 'https://www.tikwm.com' + s : s);
        if (!out.text) { out.title = d.title; out.text = d.title || ''; }
        out.author = out.author || (d.author && (d.author.nickname || d.author.unique_id)) || '';
        out.thumb = out.thumb || abs(d.origin_cover || d.cover);
        if (Array.isArray(d.images) && d.images.length) out.images = d.images.map(abs);
        else out.video = abs(d.play || d.wmplay || d.hdplay);
      } else out.warnings.push('tikwm: ' + (j && j.msg || 'нет данных'));
    } catch (e) { out.warnings.push('tikwm: ' + e.message); }
  }
  // 3) хотя бы подпись и обложка
  if (!out.text) {
    try {
      const j = await (await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(url), { headers: { 'User-Agent': DESK_UA } })).json();
      out.title = j.title || ''; out.text = j.title || ''; out.author = out.author || j.author_name; out.thumb = out.thumb || j.thumbnail_url;
    } catch (e) { out.warnings.push('oembed: ' + e.message); }
  }
  if (out.thumb && !out.images.length && !out.video) out.images = [out.thumb];
  return out;
}

/* ---------- Instagram ---------- */
async function instagram(u) {
  const m = u.pathname.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  const out = { platform: 'instagram', url: u.href, images: [], warnings: [] };
  if (!m) { out.warnings.push('Это не пост/рилс'); return Object.assign(out, await generic(u.href, 'instagram')); }
  const code = m[1];
  out.url = `https://www.instagram.com/${/reel/.test(u.pathname) ? 'reel' : 'p'}/${code}/`;

  // 1) GraphQL (как у публичных загрузчиков)
  try {
    const body = new URLSearchParams({
      av: '0', __d: 'www', __user: '0', __a: '1', lsd: 'AVqbxe3J_YA', fb_api_caller_class: 'RelayModern',
      fb_api_req_friendly_name: 'PolarisPostActionLoadPostQueryQuery',
      variables: JSON.stringify({ shortcode: code, fetch_tagged_user_count: null, hoisted_comment_id: null, hoisted_reply_id: null }),
      server_timestamps: 'true', doc_id: '8845758582119845',
    });
    const r = await fetch('https://www.instagram.com/graphql/query', {
      method: 'POST', body,
      headers: {
        'User-Agent': DESK_UA, 'Content-Type': 'application/x-www-form-urlencoded', 'X-IG-App-ID': '936619743392459',
        'X-FB-LSD': 'AVqbxe3J_YA', 'X-ASBD-ID': '129477', 'Sec-Fetch-Site': 'same-origin', 'Referer': out.url,
      },
    });
    const j = await r.json();
    const d = j && j.data && (j.data.xdt_shortcode_media || j.data.shortcode_media);
    if (d) {
      out.text = (d.edge_media_to_caption && d.edge_media_to_caption.edges[0] && d.edge_media_to_caption.edges[0].node.text) || '';
      out.author = d.owner && d.owner.username;
      out.thumb = d.display_url || d.thumbnail_src;
      out.duration = d.video_duration;
      const kids = d.edge_sidecar_to_children && d.edge_sidecar_to_children.edges.map(e => e.node);
      if (kids && kids.length) {
        for (const k of kids) { if (k.is_video && k.video_url && !out.video) out.video = k.video_url; else out.images.push(k.display_url); }
      } else if (d.is_video && d.video_url) out.video = d.video_url;
      else out.images.push(d.display_url);
    } else out.warnings.push('graphql: пусто');
  } catch (e) { out.warnings.push('graphql: ' + e.message); }

  // 2) embed-страница
  if (!out.video && !out.images.length || !out.text) {
    try {
      const html = await (await fetch(`https://www.instagram.com/p/${code}/embed/captioned/`, { headers: { 'User-Agent': DESK_UA } })).text();
      const variants = [html, unescapeOnce(html), unescapeOnce(unescapeOnce(html))];
      for (const s of variants) {
        if (!out.video) { const v = pickJsonStr(s, 'video_url'); if (v) out.video = v; }
        if (!out.thumb) { const v = pickJsonStr(s, 'display_url'); if (v) out.thumb = v; }
      }
      if (!out.text) {
        const c = html.match(/<div class="Caption">([\s\S]*?)<div class="CaptionComments">/) || html.match(/<div class="Caption">([\s\S]*?)<\/div>/);
        if (c) out.text = htmlToText(c[1].replace(/<a class="CaptionUsername"[\s\S]*?<\/a>/, ''));
      }
      const img = html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/);
      if (img && !out.images.length && !out.video) out.images.push(decodeEntities(img[1]));
      if (!out.author) { const a = html.match(/class="UsernameText">([^<]+)</); if (a) out.author = a[1]; }
    } catch (e) { out.warnings.push('embed: ' + e.message); }
  }

  // 3) og-теги (подпись почти всегда есть)
  if (!out.text || (!out.video && !out.images.length)) {
    try {
      const g = await generic(out.url, 'instagram', BOT_UA);
      if (!out.text && g.text) out.text = g.text;
      if (!out.thumb) out.thumb = g.thumb;
      if (!out.video && g.video) out.video = g.video;
      if (!out.video && !out.images.length && g.images.length) out.images = g.images;
      if (!out.title) out.title = g.title;
    } catch (e) { out.warnings.push('og: ' + e.message); }
  }
  if (!out.title) out.title = (out.text || '').split('\n')[0].slice(0, 90);
  return out;
}

/* ---------- Pinterest ---------- */
async function pinterest(u) {
  const out = { platform: 'pinterest', url: u.href, images: [], warnings: [] };
  const pin = u.pathname.match(/\/pin\/(?:[^/]*--)?(\d+)/);
  const H = { 'User-Agent': DESK_UA, 'Accept': 'application/json' };
  if (pin) {
    out.kind = 'pin';
    const j = await (await fetch('https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=' + pin[1], { headers: H })).json();
    const p = j && j.data && j.data[0];
    if (!p) { out.warnings.push('пин не найден'); return Object.assign(out, await generic(u.href, 'pinterest')); }
    out.title = decodeEntities(p.title || (p.rich_metadata && p.rich_metadata.title) || '');
    out.text = [p.title, p.description, p.rich_metadata && p.rich_metadata.description].filter(Boolean).map(decodeEntities).join('\n');
    out.author = p.pinner && (p.pinner.full_name || p.pinner.username);
    out.images.push(bestPinImage(p.images));
    const pages = p.story_pin_data && p.story_pin_data.pages || [];
    for (const pg of pages) {
      if (pg.image && pg.image.images) out.images.push(bestPinImage(pg.image.images));
      const v = pg.video && findMp4(pg.video); if (v && !out.video) out.video = v;
      for (const b of pg.blocks || []) { if (b.text) out.text += '\n' + b.text; const bv = b.video && findMp4(b.video); if (bv && !out.video) out.video = bv; }
    }
    if (!out.video && p.videos) out.video = findMp4(p.videos);
    out.thumb = out.images[0];
    // ссылка на источник (часто блог с рецептом) — подтягиваем текст
    if (p.link && !/pinterest\./.test(p.link)) {
      out.source = p.link;
      try { const g = await generic(p.link); if (g.text) out.text += '\n\n--- Текст со страницы-источника ---\n' + g.text; if (!out.title) out.title = g.title; } catch (e) { out.warnings.push('источник: ' + e.message); }
    }
    return out;
  }
  const seg = u.pathname.split('/').filter(Boolean);
  const reserved = ['search', 'ideas', 'today', 'pin', 'business', 'explore', 'settings'];
  if (seg.length >= 2 && !reserved.includes(seg[0]) && !['_saved', '_created', 'pins'].includes(seg[1])) {
    out.kind = 'board';
    const j = await (await fetch(`https://widgets.pinterest.com/v3/pidgets/boards/${seg[0]}/${seg[1]}/pins/`, { headers: H })).json();
    const d = j && j.data;
    if (d && d.pins) {
      out.title = decodeEntities(d.board && d.board.name || seg[1]);
      out.author = d.user && d.user.full_name;
      out.text = (d.board && d.board.description ? decodeEntities(d.board.description) + '\n' : '') +
        d.pins.map((p, i) => `[${i}] ${decodeEntities(p.description || '').slice(0, 200)}`).join('\n');
      out.images = d.pins.map(p => bestPinImage(p.images));
      out.thumb = out.images[0];
      return out;
    }
    out.warnings.push('доска не найдена (возможно, секретная)');
  }
  return Object.assign(out, await generic(u.href, 'pinterest'));
}
function bestPinImage(imgs) {
  if (!imgs) return null;
  const order = ['736x', '750x', '564x', 'originals', '474x', '236x', '237x'];
  for (const k of order) if (imgs[k] && imgs[k].url) return imgs[k].url;
  const any = Object.values(imgs).find(x => x && x.url); return any && any.url;
}
function findMp4(o) {
  let best = null;
  const walk = x => {
    if (!x || best) return;
    if (typeof x === 'string') { if (/^https:\/\/.+\.mp4(\?|$)/.test(x)) best = x; return; }
    if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x === 'object') {
      const vl = x.video_list;
      if (vl) for (const k of ['V_720P', 'V_EXP7', 'V_EXP6', 'V_EXP5', 'V_EXP4', 'V_EXP3']) if (vl[k] && vl[k].url && /\.mp4/.test(vl[k].url)) { best = vl[k].url; return; }
      Object.values(x).forEach(walk);
    }
  };
  walk(o); return best;
}

/* ---------- YouTube ---------- */
async function youtube(u) {
  let id = null;
  if (/youtu\.be$/.test(u.hostname)) id = u.pathname.slice(1);
  else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2];
  else id = u.searchParams.get('v');
  const url = id ? `https://www.youtube.com/watch?v=${id}` : u.href;
  const out = { platform: 'youtube', url, youtube: url, images: [], warnings: [] };
  try {
    const j = await (await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url))).json();
    out.title = j.title; out.author = j.author_name; out.thumb = j.thumbnail_url;
  } catch (e) { out.warnings.push('oembed: ' + e.message); }
  if (id && !out.thumb) out.thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  out.text = out.title || '';
  return out;
}

/* ---------- любые сайты ---------- */
async function generic(url, platform = 'web', ua = DESK_UA) {
  const out = { platform, url, images: [], warnings: [] };
  const r = await fetch(url, { headers: { 'User-Agent': ua, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'ru,uk;q=0.9,en;q=0.8' }, redirect: 'follow' });
  const ct = r.headers.get('content-type') || '';
  if (ct.startsWith('image/')) { out.images = [r.url]; out.thumb = r.url; out.title = ''; return out; }
  if (ct.startsWith('video/')) { out.video = r.url; return out; }
  let html = await r.text();
  if (html.length > 2e6) html = html.slice(0, 2e6);
  const meta = (k) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*>`, 'i');
    const tag = html.match(re); if (!tag) return '';
    const c = tag[0].match(/content=["']([^"']*)["']/i); return c ? decodeEntities(c[1]) : '';
  };
  out.title = meta('og:title') || decodeEntities((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '');
  const desc = meta('og:description') || meta('description');
  out.thumb = absUrl(meta('og:image') || meta('twitter:image'), r.url);
  if (out.thumb) out.images.push(out.thumb);
  const ogv = meta('og:video:secure_url') || meta('og:video:url') || meta('og:video');
  if (ogv && /\.mp4/.test(ogv)) out.video = absUrl(ogv, r.url);
  // JSON-LD (рецепты, товары, книги на сайтах)
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1].trim());
  let ldText = '';
  for (const s of ld) {
    try {
      const flat = [].concat(JSON.parse(s)).flatMap(x => x && x['@graph'] ? x['@graph'] : [x]);
      for (const x of flat) {
        const t = [].concat(x && x['@type'] || []).join(',');
        if (/Recipe|HowTo|Book|Product|Movie|TVSeries|Place|Restaurant|Article|ItemList/i.test(t)) {
          ldText += `\n[JSON-LD ${t}] ` + JSON.stringify(x).slice(0, 8000);
          const img = x.image && ([].concat(x.image)[0]); const iu = typeof img === 'string' ? img : img && img.url;
          if (iu) out.images.push(absUrl(iu, r.url));
        }
      }
    } catch (e) { }
  }
  const body = htmlToText(html.replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)[\s\S]*?<\/\1>/gi, ' ')).slice(0, 12000);
  out.text = [desc, ldText, body].filter(Boolean).join('\n\n');
  out.url = r.url || url;
  return out;
}

/* ---------- utils ---------- */
function absUrl(s, base) { try { return s ? new URL(s, base).href : ''; } catch (e) { return ''; } }
function unescapeOnce(s) { return s.replace(/\\(["\\/])/g, '$1'); }
function pickJsonStr(s, key) {
  const m = s.match(new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`));
  if (!m) return null;
  try { return JSON.parse('"' + m[1] + '"'); } catch (e) { return m[1].replace(/\\u0026/g, '&'); }
}
function decodeEntities(s) {
  return String(s || '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
function htmlToText(h) {
  return decodeEntities(String(h).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ').replace(/\n\s*\n\s*/g, '\n').trim();
}
