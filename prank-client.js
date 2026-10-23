// "Kerjain Teman": sisi user (menerima kejutan) + tampilan kejutan yang dipakai juga untuk pratinjau admin.
import { supabase, sbReady } from './supabase.js';

const POLL_MS = 6000;
let timer = null, busy = false, showing = false;
const queue = [], seen = new Set();
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Menampilkan satu kejutan. Selalu bisa ditutup oleh user.
export function showPrank(m, { preview = false, onDone } = {}) {
  const style = ['modal', 'full', 'banner'].includes(m.style) ? m.style : 'modal';
  const ov = document.createElement('div');
  ov.className = 'prank-ov'; ov.dataset.style = style;
  ov.innerHTML = `<div class="prank-box" role="dialog" aria-label="Pesan dari Admin">
    <button type="button" class="prank-x" aria-label="Tutup">✕</button>
    ${m.title ? `<h3>${esc(m.title)}</h3>` : ''}
    ${m.image_url ? `<img src="${esc(m.image_url)}" alt="">` : ''}
    ${m.video_url ? `<video src="${esc(m.video_url)}" playsinline controls></video>` : ''}
    ${m.body ? `<p>${esc(m.body).replace(/\n/g, '<br>')}</p>` : ''}
    <button type="button" class="prank-play" hidden>🔊 Ketuk untuk memutar suara</button>
    <div class="prank-tag">${preview ? '👁 Pratinjau · ' : ''}💌 Pesan dari Admin</div>
  </div>`;
  document.body.appendChild(ov);
  let audio = null, autoT = null, closed = false;
  const stop = () => { try { audio && audio.pause(); } catch {} audio = null; };
  const close = () => {
    if (closed) return; closed = true; clearTimeout(autoT); stop();
    ov.querySelector('video')?.pause();
    document.removeEventListener('keydown', onKey); ov.remove();
    try { onDone && onDone(); } catch {}
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.querySelector('.prank-x').onclick = close;
  if (style !== 'full') ov.addEventListener('click', e => { if (e.target === ov) close(); });

  const playBtn = ov.querySelector('.prank-play');
  if (m.audio_url) {
    audio = new Audio(m.audio_url);
    audio.play().catch(() => { playBtn.hidden = false; });
    playBtn.onclick = () => { audio && audio.play().then(() => { playBtn.hidden = true; }).catch(() => {}); };
  }
  const v = ov.querySelector('video');
  if (v) v.play().catch(() => { /* user bisa menekan tombol play sendiri */ });
  const sec = Number(m.auto_close_sec) || 0;
  if (sec > 0) autoT = setTimeout(close, sec * 1000);
  return close;
}

function next() {
  if (showing || !queue.length) return;
  const m = queue.shift(); showing = true; seen.add(m.id);
  try { supabase.rpc('prank_seen', { p_id: m.id }); } catch {}
  showPrank(m, { onDone: () => { showing = false; setTimeout(next, 400); } });
}

async function poll() {
  if (document.hidden || busy || showing) return;
  busy = true;
  try {
    const { data, error } = await supabase.rpc('prank_pending');
    if (error) { if (/prank_pending|schema cache|does not exist/i.test(error.message || '')) stopPrankListener(); return; }
    if (Array.isArray(data)) data.forEach(m => { if (!seen.has(m.id) && !queue.some(q => q.id === m.id)) queue.push(m); });
    next();
  } catch { /* abaikan, coba lagi di putaran berikutnya */ }
  finally { busy = false; }
}

const onVis = () => { if (!document.hidden) poll(); };

export function startPrankListener() {
  if (!sbReady) return;
  stopPrankListener();
  timer = setInterval(poll, POLL_MS);
  document.addEventListener('visibilitychange', onVis);
  poll();
}

export function stopPrankListener() {
  if (timer) clearInterval(timer);
  timer = null; queue.length = 0;
  document.removeEventListener('visibilitychange', onVis);
}
