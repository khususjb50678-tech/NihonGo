// Panel arti Kana & Kanji: kanji, cara baca, arti satu baris masing-masing, dan audio pelafalan.
let modal = null, items = [], index = 0, lastFocus = null;

export function closeStudy() {
  if (!modal) return;
  document.removeEventListener('keydown', onKey, true);
  document.documentElement.classList.remove('study-open');
  modal.remove();
  modal = null;
  if (lastFocus && document.contains(lastFocus)) {
    try { lastFocus.focus({ preventScroll: true }); } catch { /* abaikan */ }
  }
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
  if (next >= 0 && next < items.length) show(next);
}

export function openStudy(list, start = 0) {
  if (!Array.isArray(list) || !list.length) return;
  closeStudy();
  items = list;
  lastFocus = document.activeElement;
  document.body.insertAdjacentHTML('beforeend', `<div class="study-backdrop" id="studyModal"><div class="study-modal study-meaning-only" role="dialog" aria-modal="true" aria-labelledby="studyGlyph">
    <button type="button" class="study-close" aria-label="Tutup">×</button>
    <div class="study-head"><div class="study-glyph" id="studyGlyph" lang="ja"></div><div class="study-info"><div class="study-reading" lang="ja"></div><div class="study-meaning"></div></div></div>
    <button type="button" class="study-audio" aria-label="Putar pelafalan bahasa Jepang" title="Putar pelafalan">▶</button>
    <div class="study-actions"><button type="button" class="study-nav" data-step="-1" aria-label="Sebelumnya">‹</button><span class="study-spacer"></span><button type="button" class="study-nav" data-step="1" aria-label="Berikutnya">›</button></div>
    <div class="study-count"></div>
  </div></div>`);
  modal = document.querySelector('#studyModal');
  document.documentElement.classList.add('study-open');
  modal.onclick = e => { if (e.target === modal) closeStudy(); };
  modal.querySelector('.study-close').onclick = closeStudy;
  modal.querySelectorAll('.study-nav').forEach(b => b.onclick = () => go(Number(b.dataset.step)));
  modal.querySelector('.study-audio').onclick = speak;
  document.addEventListener('keydown', onKey, true);
  show(Math.min(Math.max(0, start), items.length - 1));
  modal.querySelector('.study-close').focus({ preventScroll: true });
}

function show(i) {
  index = i;
  const it = items[i];
  const glyph = String(it.glyph ?? '');
  const gl = modal.querySelector('.study-glyph');
  const rd = modal.querySelector('.study-reading');
  const mean = modal.querySelector('.study-meaning');
  gl.textContent = glyph;
  rd.textContent = it.reading || '';
  mean.textContent = it.meaning || '';
  mean.hidden = !it.meaning;
  fitOne(gl, 92, 28);
  fitOne(rd, 34, 16);
  fitOne(mean, 22, 12);
  modal.querySelector('.study-count').textContent = `${i + 1} / ${items.length}`;
  modal.querySelectorAll('.study-nav').forEach(b => {
    b.disabled = (Number(b.dataset.step) < 0 && i === 0) || (Number(b.dataset.step) > 0 && i === items.length - 1);
  });
}

function speak() {
  if (!modal || !('speechSynthesis' in window)) return;
  const it = items[index];
  const phrase = [it.glyph, it.reading].filter(Boolean).join('、');
  if (!phrase) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

// Paksa setiap teks tetap satu baris dan sesuaikan ukuran agar muat.
function fitOne(el, max, min) {
  if (!el) return;
  el.style.whiteSpace = 'nowrap';
  el.style.wordBreak = 'normal';
  let size = max;
  el.style.fontSize = size + 'px';
  const parent = el.parentElement;
  const limit = (parent ? parent.clientWidth : 0) || modal.clientWidth - 40;
  let guard = 60;
  while (size > min && el.scrollWidth > limit - 4 && guard-- > 0) {
    size -= 2;
    el.style.fontSize = size + 'px';
  }
}
