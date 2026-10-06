// Panel besar untuk Kana & Kanji: Huruf + cara baca (+ arti) + animasi goresan berukuran besar.
// Dibuka langsung saat kartu diketuk, dan animasi langsung berjalan.
import { loadKana, buildStage, playStage, stopStage, drawableChars, layout } from './kanastroke.js';

let modal = null, items = [], index = 0, token = 0, lastFocus = null;

export function closeStudy() {
  token++;
  if (!modal) return;
  const svg = modal.querySelector('.study-stage');
  if (svg) stopStage(svg);
  document.removeEventListener('keydown', onKey, true);
  document.documentElement.classList.remove('study-open');
  modal.remove();
  modal = null;
  if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch { /* abaikan */ } }
  lastFocus = null;
}

function onKey(e) {
  if (!modal) return;
  if (e.key === 'Escape') { e.preventDefault(); closeStudy(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
}

function go(step) {
  const next = index + step;
  if (next < 0 || next >= items.length) return;
  show(next);
}

// items: [{ glyph, reading, meaning, animate }]
export function openStudy(list, start = 0) {
  if (!Array.isArray(list) || !list.length) return;
  closeStudy();
  items = list;
  lastFocus = document.activeElement;
  document.body.insertAdjacentHTML('beforeend', `<div class="study-backdrop" id="studyModal"><div class="study-modal" role="dialog" aria-modal="true" aria-labelledby="studyGlyph">
    <button type="button" class="study-close" aria-label="Tutup">×</button>
    <div class="study-head"><div class="study-glyph" id="studyGlyph" lang="ja"></div><div class="study-info"><div class="study-reading"></div><div class="study-meaning"></div></div></div>
    <div class="study-stage-wrap"><svg class="study-stage" aria-hidden="true"></svg><div class="study-static" lang="ja"></div><div class="study-msg" role="status" aria-live="polite"></div></div>
    <div class="study-actions"><button type="button" class="study-nav" data-step="-1" aria-label="Sebelumnya">‹</button><button type="button" class="study-play">▶ Putar</button><button type="button" class="study-nav" data-step="1" aria-label="Berikutnya">›</button></div>
    <div class="study-count"></div>
  </div></div>`);
  modal = document.querySelector('#studyModal');
  document.documentElement.classList.add('study-open');
  modal.onclick = e => { if (e.target === modal) closeStudy(); };
  modal.querySelector('.study-close').onclick = closeStudy;
  modal.querySelectorAll('.study-nav').forEach(b => b.onclick = () => go(Number(b.dataset.step)));
  modal.querySelector('.study-play').onclick = () => play(token);
  document.addEventListener('keydown', onKey, true);
  show(Math.min(Math.max(0, start), items.length - 1));
  modal.querySelector('.study-close').focus({ preventScroll: true });
}

function setWrapSize(count) {
  const wrap = modal.querySelector('.study-stage-wrap');
  const { cols, rows } = layout(Math.max(1, count));
  const ratio = cols / rows;
  wrap.style.aspectRatio = String(ratio);
  wrap.style.width = `min(100%, calc(52vh * ${ratio}))`;
}

function show(i) {
  index = i;
  const it = items[i];
  const my = ++token;
  const svg = modal.querySelector('.study-stage');
  stopStage(svg);
  svg.textContent = '';

  const glyph = String(it.glyph ?? '');
  const len = [...glyph].length;
  const gl = modal.querySelector('.study-glyph');
  gl.textContent = glyph;
  gl.style.fontSize = len <= 2 ? '68px' : len <= 4 ? '50px' : '36px';
  modal.querySelector('.study-reading').textContent = it.reading || '';
  const mean = modal.querySelector('.study-meaning');
  mean.textContent = it.meaning || '';
  mean.hidden = !it.meaning;
  modal.querySelector('.study-count').textContent = `${i + 1} / ${items.length}`;
  modal.querySelectorAll('.study-nav').forEach(b => { b.disabled = (Number(b.dataset.step) < 0 && i === 0) || (Number(b.dataset.step) > 0 && i === items.length - 1); });

  const wrap = modal.querySelector('.study-stage-wrap');
  const stat = modal.querySelector('.study-static');
  const play$ = modal.querySelector('.study-play');
  const msg = modal.querySelector('.study-msg');
  wrap.classList.remove('drawing', 'failed');
  msg.textContent = '';

  const chars = drawableChars(glyph);
  const animate = it.animate !== false && chars.length > 0;
  stat.textContent = glyph;
  const sz = Math.max(1, [...glyph].length);
  stat.style.fontSize = sz <= 1 ? 'min(46vh,300px)' : sz <= 2 ? 'min(30vh,190px)' : sz <= 4 ? 'min(20vh,130px)' : 'min(14vh,90px)';

  if (!animate) {
    wrap.style.aspectRatio = '';
    wrap.style.width = 'min(100%, 420px)';
    wrap.style.minHeight = 'min(48vh, 320px)';
    wrap.classList.add('no-anim');
    play$.hidden = true;
    return;
  }
  wrap.classList.remove('no-anim');
  wrap.style.minHeight = '';
  play$.hidden = false;
  setWrapSize(chars.length);
  play(my, true);
}

async function play(my, fresh = false) {
  if (!modal || my !== token) return;
  const it = items[index];
  const svg = modal.querySelector('.study-stage');
  const wrap = modal.querySelector('.study-stage-wrap');
  const btn = modal.querySelector('.study-play');
  const msg = modal.querySelector('.study-msg');
  const built = svg.childElementCount > 0 && !fresh;
  btn.disabled = true;
  try {
    if (!built) {
      btn.textContent = 'Memuat…';
      msg.textContent = 'Memuat animasi…';
      const sets = await loadKana(it.glyph);
      if (!modal || my !== token) return;
      buildStage(svg, sets);
      setWrapSize(sets.length);
    }
    msg.textContent = '';
    wrap.classList.remove('failed');
    wrap.classList.add('drawing');
    btn.textContent = 'Menulis…';
    btn.disabled = false;
    const done = await playStage(svg);
    if (!modal || my !== token) return;
    if (done) btn.textContent = '↻ Ulangi';
  } catch (err) {
    if (!modal || my !== token) return;
    console.warn('Animasi goresan gagal dimuat:', err);
    wrap.classList.remove('drawing');
    wrap.classList.add('failed');
    msg.textContent = 'Animasi belum bisa dimuat. Cek koneksi internet, lalu coba lagi.';
    btn.textContent = '↻ Coba lagi';
    btn.disabled = false;
    svg.textContent = '';
  }
}
