// Gaya kolom (kartu): wallpaper, efek cahaya merah-biru, goyang seirama.
// Pengaturan dari Admin disimpan sebagai file kecil di Storage bucket "media" (tanpa perlu ubah tabel database).
import { supabase, sbReady } from './supabase.js';

const svgUri = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

function seigaiha() {
  let g = '';
  for (let k = -3; k <= 3; k++) {
    const y = 12 * k + 12;
    for (let m = -1; m <= 1; m++) {
      const x = 48 * m + (k % 2 !== 0 ? 24 : 0);
      g += `<circle cx="${x}" cy="${y}" r="24" fill="#0b1022" stroke="#5b8cff" stroke-opacity=".42" stroke-width="1"/>`;
      [18, 12, 6].forEach(r => { g += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#5b8cff" stroke-opacity=".3" stroke-width="1"/>`; });
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="24" viewBox="0 0 48 24">${g}</svg>`;
}

const star = (x, y, s) => `radial-gradient(${s}px ${s}px at ${x}% ${y}%,#fff 60%,transparent 62%)`;

export const PRESETS = [
  { id: 'klasik', name: 'Hitam Klasik', css: 'linear-gradient(145deg,#171717,#0b0b0b)' },
  { id: 'sakura', name: 'Sakura Malam', css: 'radial-gradient(circle at 18% 20%,rgba(255,120,170,.34),transparent 46%),radial-gradient(circle at 88% 86%,rgba(110,150,255,.26),transparent 54%),linear-gradient(145deg,#1d0f1a,#0a0a12)' },
  { id: 'neon', name: 'Neon Tokyo', css: 'linear-gradient(120deg,rgba(255,45,85,.38),transparent 42%),linear-gradient(300deg,rgba(45,123,255,.4),transparent 44%),repeating-linear-gradient(0deg,rgba(255,255,255,.045) 0 1px,transparent 1px 24px),#09090f' },
  { id: 'gelombang', name: 'Gelombang Seigaiha', css: `${svgUri(seigaiha())} 0 0/48px 24px repeat,linear-gradient(145deg,#0d1226,#080a14)` },
  { id: 'shoji', name: 'Pintu Shoji', css: 'repeating-linear-gradient(90deg,rgba(255,255,255,.07) 0 1px,transparent 1px 30px),repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 1px,transparent 1px 30px),linear-gradient(145deg,#1a1512,#0b0908)' },
  { id: 'langit', name: 'Langit Bintang', css: `${star(14, 24, 1.4)},${star(38, 68, 1.2)},${star(62, 18, 1.6)},${star(78, 52, 1.2)},${star(90, 82, 1.4)},${star(26, 88, 1)},radial-gradient(circle at 84% 22%,rgba(255,236,190,.95) 0 7px,rgba(255,236,190,.16) 8px 26px,transparent 28px),linear-gradient(180deg,#0a0f2e,#1b1033 62%,#2b0f1a)` }
];

export const DEFAULT_STYLE = { preset: 'klasik', url: '', dim: 0.3, glow: true, sway: true };
const STORE_KEY = 'branding/card-style.json';
const LS_KEY = 'itco_card_style';

export function cleanStyle(s) {
  const o = { ...DEFAULT_STYLE, ...(s && typeof s === 'object' ? s : {}) };
  o.url = typeof o.url === 'string' ? o.url : '';
  if (o.preset === 'foto') { if (!/^https?:\/\//i.test(o.url)) o.preset = 'klasik'; }
  else if (!PRESETS.some(p => p.id === o.preset)) o.preset = 'klasik';
  let d = Number(o.dim); if (!Number.isFinite(d)) d = DEFAULT_STYLE.dim;
  o.dim = Math.min(0.9, Math.max(0, d));
  o.glow = o.glow !== false;
  o.sway = o.sway !== false;
  return o;
}

function bgFor(s) {
  if (s.preset === 'foto' && s.url) {
    const u = s.url.replace(/["'\\\s()<>]/g, c => encodeURIComponent(c));
    return `url("${u}") center/cover no-repeat,#0b0b0b`;
  }
  return (PRESETS.find(p => p.id === s.preset) || PRESETS[0]).css;
}

export function applyCardStyle(style) {
  const st = cleanStyle(style);
  const r = document.documentElement;
  r.style.setProperty('--cw-bg', bgFor(st));
  r.style.setProperty('--cw-dim', String(st.dim));
  r.dataset.glow = st.glow ? 'on' : 'off';
  r.dataset.sway = st.sway ? 'on' : 'off';
  return st;
}

export function loadCachedStyle() {
  try { return cleanStyle(JSON.parse(localStorage.getItem(LS_KEY) || 'null')); } catch { return cleanStyle(null); }
}

export async function fetchCardStyle() {
  if (!sbReady) return null;
  try {
    const { data } = supabase.storage.from('media').getPublicUrl(STORE_KEY);
    const r = await fetch(`${data.publicUrl}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const st = cleanStyle(await r.json());
    try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch { /* abaikan */ }
    return st;
  } catch { return null; }
}

export async function saveCardStyle(style) {
  const st = cleanStyle(style);
  const blob = new Blob([JSON.stringify(st)], { type: 'application/json' });
  const { error } = await supabase.storage.from('media').upload(STORE_KEY, blob, { upsert: true, contentType: 'application/json', cacheControl: '0' });
  if (error) throw error;
  try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch { /* abaikan */ }
  return st;
}

// ---- Gerak & cahaya: hanya kolom yang terlihat di layar yang dianimasikan (hemat baterai),
// dan semuanya memakai jam yang sama supaya gerakannya seirama.
let io = null;
function setOn(el, on) {
  if (on) {
    el.style.setProperty('--fxd', `-${((performance.now() % 20000) / 1000).toFixed(3)}s`);
    el.classList.add('fx-on');
  } else el.classList.remove('fx-on');
}
export function runFx() {
  if (io) { io.disconnect(); io = null; }
  const els = document.querySelectorAll('.fx-card,.fx-float,.fx-ring');
  if (!('IntersectionObserver' in window)) { els.forEach(e => setOn(e, true)); return; }
  io = new IntersectionObserver(list => list.forEach(en => setOn(en.target, en.isIntersecting)), { rootMargin: '60px' });
  els.forEach(e => io.observe(e));
}
