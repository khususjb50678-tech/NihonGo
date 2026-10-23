// "Kerjain Teman": sisi user (menerima kejutan) + tampilan kejutan yang dipakai juga untuk pratinjau admin.
// Media (foto/video/suara) diunduh dulu di belakang layar, baru ditampilkan sekaligus supaya langsung muncul tanpa jeda.
import { supabase, sbReady } from './supabase.js';

const POLL_MS = 4000, PRELOAD_MAX_MS = 3500;
const STYLES = ['modal', 'full', 'banner', 'scare', 'scare-fit'];
let timer = null, busy = false, again = false, showing = false, chan = null;
const queue = [], seen = new Set();
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Unduh semua media lebih dulu (maksimal PRELOAD_MAX_MS), lalu kembalikan elemen yang sudah siap pakai.
function preload(m) {
  const pre = {}, jobs = [];
  if (m.image_url) jobs.push(new Promise(res => {
    const i = new Image(); i.decoding = 'async'; pre.img = i;
    i.onload = () => { (i.decode ? i.decode() : Promise.resolve()).catch(() => {}).then(res); };
    i.onerror = () => { pre.img = null; res(); }; i.src = m.image_url;
  }));
  if (m.audio_url) jobs.push(new Promise(res => {
    const a = new Audio(); a.preload = 'auto'; pre.audio = a;
    a.addEventListener('canplaythrough', () => res(), { once: true }); a.addEventListener('error', () => { pre.audio = null; res(); }, { once: true });
    a.src = m.audio_url; a.load();
  }));
  if (m.video_url) jobs.push(new Promise(res => {
    const v = document.createElement('video'); v.preload = 'auto'; v.playsInline = true; v.setAttribute('playsinline', ''); pre.video = v;
    v.addEventListener('loadeddata', () => res(), { once: true }); v.addEventListener('error', () => { pre.video = null; res(); }, { once: true });
    v.src = m.video_url; v.load();
  }));
  return Promise.race([Promise.all(jobs), new Promise(res => setTimeout(res, PRELOAD_MAX_MS))]).then(() => pre);
}

// Menampilkan satu kejutan. Selalu bisa ditutup oleh user (tombol ✕ / ESC).
export function showPrank(m, { preview = false, onDone, pre = {} } = {}) {
  const style = STYLES.includes(m.style) ? m.style : 'modal';
  const ov = document.createElement('div');
  ov.className = 'prank-ov'; ov.dataset.style = style;
  ov.innerHTML = `<div class="prank-box" role="dialog" aria-label="Kejutan">
    <button type="button" class="prank-x" aria-label="Tutup">✕</button>
    ${m.title ? `<h3>${esc(m.title)}</h3>` : ''}
    <span class="prank-slot-img"></span><span class="prank-slot-vid"></span>
    ${m.body ? `<p>${esc(m.body).replace(/\n/g, '<br>')}</p>` : ''}
    <button type="button" class="prank-play" hidden>🔊</button>
    ${preview ? '<div class="prank-tag">👁 Pratinjau</div>' : ''}
  </div>`;
  const img = m.image_url ? (pre.img || Object.assign(new Image(), { src: m.image_url })) : null;
  if (img) { img.alt = ''; ov.querySelector('.prank-slot-img').replaceWith(img); } else ov.querySelector('.prank-slot-img').remove();
  const v = m.video_url ? (pre.video || Object.assign(document.createElement('video'), { src: m.video_url })) : null;
  if (v) { v.playsInline = true; v.setAttribute('playsinline', ''); v.controls = !style.startsWith('scare'); ov.querySelector('.prank-slot-vid').replaceWith(v); } else ov.querySelector('.prank-slot-vid').remove();
  document.body.appendChild(ov);

  let audio = m.audio_url ? (pre.audio || new Audio(m.audio_url)) : null, autoT = null, closed = false;
  const playBtn = ov.querySelector('.prank-play');
  const close = () => {
    if (closed) return; closed = true; clearTimeout(autoT);
    try { audio && audio.pause(); } catch {} audio = null;
    try { v && v.pause(); } catch {}
    document.removeEventListener('keydown', onKey); ov.remove();
    try { onDone && onDone(); } catch {}
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.querySelector('.prank-x').onclick = close;
  if (style === 'modal' || style === 'banner') ov.addEventListener('click', e => { if (e.target === ov) close(); });

  // Suara & video mulai bersamaan dengan munculnya gambar. Jika browser memblokir suara, sediakan tombol 🔊.
  if (audio) { audio.currentTime = 0; audio.play().catch(() => { playBtn.hidden = false; }); playBtn.onclick = () => { audio && audio.play().then(() => { playBtn.hidden = true; }).catch(() => {}); }; }
  if (v) v.play().catch(() => { v.muted = true; v.play().catch(() => {}); playBtn.hidden = false; playBtn.onclick = () => { v.muted = false; playBtn.hidden = true; }; });
  const sec = Number(m.auto_close_sec) || 0;
  if (sec > 0) autoT = setTimeout(close, sec * 1000);
  return close;
}

function next() {
  if (showing || !queue.length) return;
  const m = queue.shift(); showing = true; seen.add(m.id);
  try { supabase.rpc('prank_seen', { p_id: m.id }); } catch {}
  preload(m).then(pre => showPrank(m, { pre, onDone: () => { showing = false; setTimeout(next, 300); } }));
}

async function poll() {
  if (document.hidden || showing) return;
  if (busy) { again = true; return; }
  busy = true;
  try {
    const { data, error } = await supabase.rpc('prank_pending');
    if (error) { if (/prank_pending|schema cache|does not exist/i.test(error.message || '')) stopPrankListener(); return; }
    if (Array.isArray(data)) data.forEach(m => { if (!seen.has(m.id) && !queue.some(q => q.id === m.id)) queue.push(m); });
    next();
  } catch { /* abaikan, coba lagi di putaran berikutnya */ }
  finally { busy = false; if (again) { again = false; setTimeout(poll, 50); } }
}

const onVis = () => { if (!document.hidden) poll(); };

export function startPrankListener() {
  if (!sbReady) return;
  stopPrankListener();
  timer = setInterval(poll, POLL_MS);
  document.addEventListener('visibilitychange', onVis);
  // Sinyal instan dari admin (Realtime broadcast); polling tetap berjalan sebagai cadangan.
  try { chan = supabase.channel('itco-kerjain').on('broadcast', { event: 'ping' }, () => poll()).subscribe(); } catch { chan = null; }
  poll();
}

export function stopPrankListener() {
  if (timer) clearInterval(timer);
  timer = null; queue.length = 0;
  document.removeEventListener('visibilitychange', onVis);
  try { chan && supabase.removeChannel(chan); } catch {}
  chan = null;
}
