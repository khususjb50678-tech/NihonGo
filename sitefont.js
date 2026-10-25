// Font seluruh website: dipilih Admin, disimpan sebagai file kecil di Storage bucket "media"
// (tanpa ubah tabel database). Disimpan di folder "site/" supaya admin tambahan yang diberi menu Font juga boleh mengubahnya.
import { supabase, sbReady } from './supabase.js';

const JP_SANS = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif';
const JP_SERIF = '"Noto Serif JP","Hiragino Mincho ProN","Yu Mincho",serif';

export const FONTS = [
  { id: 'akemi', name: 'Bawaan Akemi', note: 'Tampilan asli website', sample: '"Plus Jakarta Sans","Zen Maru Gothic",sans-serif',
    g: 'Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&family=Zen+Maru+Gothic:wght@400;500;700;900&family=Klee+One:wght@400;600' },
  { id: 'times', name: 'Times New Roman', note: 'Klasik dan resmi', stack: `"Times New Roman",Times,${JP_SERIF}` },
  { id: 'standar', name: 'Standar (Sistem)', note: 'Font bawaan perangkat, paling ringan', stack: `system-ui,-apple-system,"Segoe UI",Roboto,Arial,${JP_SANS}` },
  { id: 'arial', name: 'Arial', note: 'Bersih dan netral', stack: `Arial,Helvetica,${JP_SANS}` },
  { id: 'georgia', name: 'Georgia', note: 'Serif nyaman dibaca', stack: `Georgia,"Times New Roman",${JP_SERIF}` },
  { id: 'verdana', name: 'Verdana', note: 'Lebar, jelas di layar kecil', stack: `Verdana,Geneva,${JP_SANS}` },
  { id: 'trebuchet', name: 'Trebuchet MS', note: 'Santai dan modern', stack: `"Trebuchet MS",Arial,${JP_SANS}` },
  { id: 'inter', name: 'Inter', note: 'Modern, rapi', g: 'Inter:wght@400;500;600;700;800', stack: `Inter,${JP_SANS}` },
  { id: 'poppins', name: 'Poppins', note: 'Bulat dan ramah', g: 'Poppins:wght@400;500;600;700;800', stack: `Poppins,${JP_SANS}` },
  { id: 'roboto', name: 'Roboto', note: 'Seperti aplikasi Android', g: 'Roboto:wght@400;500;700;900', stack: `Roboto,${JP_SANS}` },
  { id: 'nunito', name: 'Nunito', note: 'Lembut, cocok untuk belajar', g: 'Nunito:wght@400;500;600;700;800', stack: `Nunito,${JP_SANS}` },
  { id: 'montserrat', name: 'Montserrat', note: 'Tegas dan elegan', g: 'Montserrat:wght@400;500;600;700;800', stack: `Montserrat,${JP_SANS}` },
  { id: 'lato', name: 'Lato', note: 'Hangat dan profesional', g: 'Lato:wght@400;700;900', stack: `Lato,${JP_SANS}` },
  { id: 'merriweather', name: 'Merriweather', note: 'Serif untuk bacaan panjang', g: 'Merriweather:wght@400;700;900', stack: `Merriweather,Georgia,${JP_SERIF}` },
  { id: 'playfair', name: 'Playfair Display', note: 'Serif mewah', g: 'Playfair+Display:wght@400;500;600;700;800', stack: `"Playfair Display",Georgia,${JP_SERIF}` },
  { id: 'notosansjp', name: 'Noto Sans JP', note: 'Paling pas untuk kanji dan kana', g: 'Noto+Sans+JP:wght@400;500;700;900', stack: `"Noto Sans JP",Arial,sans-serif` },
  { id: 'notoserifjp', name: 'Noto Serif JP', note: 'Kanji gaya Mincho (buku)', g: 'Noto+Serif+JP:wght@400;500;600;700;900', stack: `"Noto Serif JP","Times New Roman",serif` },
  { id: 'zenmaru', name: 'Zen Maru Gothic', note: 'Kanji dan kana bulat, ramah', g: 'Zen+Maru+Gothic:wght@400;500;700;900', stack: `"Zen Maru Gothic","Noto Sans JP",sans-serif` }
];
export const DEFAULT_FONT = 'times';
const STORE_KEY = 'site/font.json';
const LS_KEY = 'itco_site_font';

export const cleanFont = id => (FONTS.some(f => f.id === id) ? id : DEFAULT_FONT);

function ensureLink(id, href) {
  let l = document.getElementById(id);
  if (!l) { l = document.createElement('link'); l.id = id; l.rel = 'stylesheet'; document.head.appendChild(l); }
  if (l.getAttribute('href') !== href) l.setAttribute('href', href);
}

export function applySiteFont(id) {
  const f = FONTS.find(x => x.id === id) || FONTS.find(x => x.id === DEFAULT_FONT);
  const r = document.documentElement;
  r.dataset.sitefont = f.id;
  if (f.stack) r.style.setProperty('--site-font', f.stack); else r.style.removeProperty('--site-font');
  if (f.g) ensureLink('sitefont-link', `https://fonts.googleapis.com/css2?family=${f.g}&display=swap`);
  return f.id;
}

// Dipakai halaman Admin untuk menampilkan contoh tiap font.
export function loadAllFontsForPreview() {
  const fam = FONTS.filter(f => f.g).map(f => 'family=' + f.g).join('&');
  ensureLink('sitefont-preview', `https://fonts.googleapis.com/css2?${fam}&display=swap`);
}

export function loadCachedFont() {
  try { const v = localStorage.getItem(LS_KEY); return v ? cleanFont(v) : null; } catch { return null; }
}

export async function fetchSiteFont() {
  if (!sbReady) return null;
  try {
    const { data } = supabase.storage.from('media').getPublicUrl(STORE_KEY);
    const r = await fetch(`${data.publicUrl}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const id = cleanFont((await r.json())?.id);
    try { localStorage.setItem(LS_KEY, id); } catch { /* abaikan */ }
    return id;
  } catch { return null; }
}

export async function saveSiteFont(id) {
  const clean = cleanFont(id);
  const blob = new Blob([JSON.stringify({ id: clean })], { type: 'application/json' });
  const { error } = await supabase.storage.from('media').upload(STORE_KEY, blob, { upsert: true, contentType: 'application/json', cacheControl: '0' });
  if (error) throw error;
  try { localStorage.setItem(LS_KEY, clean); } catch { /* abaikan */ }
  return clean;
}
