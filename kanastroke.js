// Animasi urutan goresan Hiragana/Katakana.
// Data goresan diambil dari KanjiVG (CC BY-SA 3.0, https://kanjivg.tagaini.net) saat tombol Play ditekan,
// lalu disimpan di localStorage supaya berikutnya cepat dan bisa dipakai offline.

const SOURCES = [
  id => `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${id}.svg`,
  id => `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${id}.svg`
];
const NS = 'http://www.w3.org/2000/svg';
const memory = new Map();
const stages = new WeakMap();
const live = new Set();

const hexId = ch => ch.codePointAt(0).toString(16).padStart(5, '0');

function readCache(id) {
  try { const v = JSON.parse(localStorage.getItem('kvg2_' + id) || 'null'); return Array.isArray(v) && v.length ? v : null; } catch { return null; }
}
function writeCache(id, v) { try { localStorage.setItem('kvg2_' + id, JSON.stringify(v)); } catch { /* penyimpanan penuh / diblokir: abaikan */ } }

async function fetchText(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(timer); }
}

async function loadChar(ch) {
  const id = hexId(ch);
  if (memory.has(id)) return memory.get(id);
  const cached = readCache(id);
  if (cached) { memory.set(id, cached); return cached; }
  let lastErr = new Error('Tidak ada sumber data');
  for (const src of SOURCES) {
    try {
      const txt = await fetchText(src(id));
      const strokes = [...txt.matchAll(/<path\b[^>]*?\sd="([^"]+)"/g)].map(m => m[1]);
      if (!strokes.length) throw new Error('Data goresan kosong');
      memory.set(id, strokes); writeCache(id, strokes);
      return strokes;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// "きゃ" -> dua huruf, masing-masing dimuat sendiri. Hasil: array goresan per huruf.
export function loadKana(text) { return Promise.all([...text].map(loadChar)); }

function mk(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent.appendChild(e);
  return e;
}

export function buildStage(svg, sets) {
  stopStage(svg);
  const n = sets.length;
  svg.setAttribute('viewBox', `0 0 ${109 * n} 109`);
  svg.textContent = '';
  for (let i = 0; i < n; i++) mk('path', { class: 'ks-guide', d: `M${i * 109 + 54.5} 4V105M${i * 109 + 4} 54.5H${i * 109 + 105}` }, svg);
  sets.forEach((paths, i) => {
    const g = mk('g', { transform: `translate(${i * 109} 0)` }, svg);
    paths.forEach(d => mk('path', { class: 'ks-ghost', d }, g));
  });
  const strokes = [];
  sets.forEach((paths, i) => {
    const g = mk('g', { transform: `translate(${i * 109} 0)` }, svg);
    paths.forEach(d => {
      const p = mk('path', { class: 'ks-ink', d, pathLength: 1 }, g);
      p.style.strokeDasharray = '1 3';
      p.style.strokeDashoffset = '1';
      let len = 60, start = { x: 0, y: 0 };
      try { len = p.getTotalLength(); start = p.getPointAtLength(0); } catch { /* biarkan default */ }
      const m = mk('g', { class: 'ks-mark' }, g);
      mk('circle', { cx: start.x, cy: start.y, r: 5.5 }, m);
      const t = mk('text', { x: start.x, y: start.y }, m);
      t.textContent = String(strokes.length + 1);
      strokes.push({ p, m, len });
    });
  });
  const st = { svg, strokes, timers: [], anims: [], resolve: null };
  stages.set(svg, st);
  live.add(st);
  return st;
}

function resetStage(st) {
  st.timers.forEach(clearTimeout);
  st.anims.forEach(a => { try { a.cancel(); } catch { /* sudah selesai */ } });
  st.timers = []; st.anims = [];
  st.strokes.forEach(s => { s.p.style.strokeDashoffset = '1'; s.m.style.opacity = '0'; });
  if (st.resolve) { const r = st.resolve; st.resolve = null; r(false); }
}

export function stopStage(svg) {
  const st = stages.get(svg);
  if (st) resetStage(st);
}
export function stopAllStages() {
  live.forEach(resetStage);
  live.clear();
}

// Mengembalikan Promise<boolean>: true = selesai ditulis, false = dihentikan di tengah jalan.
export function playStage(svg) {
  const st = stages.get(svg);
  if (!st) return Promise.resolve(false);
  resetStage(st);
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return new Promise(resolve => {
    st.resolve = resolve;
    if (reduce) {
      st.strokes.forEach(s => { s.p.style.strokeDashoffset = '0'; s.m.style.opacity = '1'; });
      st.resolve = null; resolve(true); return;
    }
    let t = 250;
    st.strokes.forEach(s => {
      const dur = Math.min(1100, Math.max(430, s.len * 13));
      st.timers.push(setTimeout(() => {
        s.m.style.opacity = '1';
        try {
          st.anims.push(s.p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: dur, easing: 'ease-in-out', fill: 'forwards' }));
        } catch { s.p.style.strokeDashoffset = '0'; }
      }, t));
      t += dur + 220;
    });
    st.timers.push(setTimeout(() => { st.resolve = null; resolve(true); }, t));
  });
}
