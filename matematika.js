// Matematika (hitung cepat) & Kraepelin (penjumlahan kolom). Pengaturan dikelola admin di tabel math_settings.
import { posterHTML, bindPoster } from './resultposter.js';

const DEF = {
  math: {
    enabled: true,
    ops: { tambah: { on: true, a: [3, 3], b: [3, 3] }, kurang: { on: true, a: [3, 3], b: [3, 3] }, kali: { on: true, a: [2, 2], b: [2, 2] }, bagi: { on: true, a: [3, 3], b: [1, 1] } },
    layout: 'rows', per_row: 5, rows: 4, count: 20,
    timer: { mode: 'unit', seconds: 30, minutes: 3 }
  },
  kraepelin: { enabled: true, columns: 10, digits: 11, timer: { mode: 'col', seconds: 15 } }
};
const OPS = { tambah: '+', kurang: '−', kali: '×', bagi: '÷' };
const OP_NAME = { tambah: 'Tambah', kurang: 'Kurang', kali: 'Kali', bagi: 'Bagi' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const rnd = n => Math.floor(Math.random() * n);

function merge(d, s) {
  const o = JSON.parse(JSON.stringify(d));
  if (!s || typeof s !== 'object') return o;
  for (const k of Object.keys(s)) {
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && o[k] && typeof o[k] === 'object') o[k] = merge(o[k], s[k]);
    else o[k] = s[k];
  }
  return o;
}
export async function loadMathCfg(supabase, sbReady) {
  let c = {};
  try {
    if (sbReady && supabase) {
      const { data } = await supabase.from('math_settings').select('config').eq('id', 1).maybeSingle();
      c = data?.config || {};
    }
  } catch { /* pakai bawaan */ }
  return merge(DEF, c);
}

// Simpan ke "Hasil Saya" (tabel assessment_results), hanya kalau user sudah login
export async function saveAssessment({ supabase, sbReady, user, test_type, score, correct, wrong, unanswered, duration, details }) {
  if (!(sbReady && user)) return;
  try {
    const { error } = await supabase.from('assessment_results').insert({ user_id: user.id, test_type, score, correct_count: correct, wrong_count: wrong, unanswered_count: unanswered, duration_seconds: duration, details });
    if (error) console.warn(`Hasil ${test_type} belum tersimpan:`, error.message);
  } catch (e) { console.warn(e); }
}

// Tampilan hasil seperti hasil latihan: kartu nilai (poster) + review jawaban
export function showResult({ shell, title, score, correct, wrong, unanswered, duration, reviewHTML, tierFor, name, siteName, logo, playSound, startedAt, finishedAt, limit, limitBy, backHref = '#home' }) {
  const pd = {
    title, name: name || '', score, correct, wrong, unanswered, duration,
    limit: limit ?? null, limitBy: limitBy || 'admin', startedAt: startedAt || null, finishedAt: finishedAt || new Date().toISOString(),
    siteName: siteName || 'ITCO JAPAN', image: '', logo: logo || '',
    tier: tierFor ? tierFor(score) : { icon: '', title: '', sub: '', color: '#f5c542' }
  };
  shell(`<section class="section result-exercise"><div class="result-wrap">${posterHTML(pd)}</div><div class="review-wrap">${reviewHTML}</div><a class="btn red fullbtn" href="${backHref}" style="margin-top:14px;display:block;text-align:center">← Beranda</a></section>`);
  bindPoster(document, pd);
  if (playSound) { try { playSound(score); } catch { /* abaikan */ } }
  return pd;
}
const reviewOf = items => items.map(r => `<article class="review ${r.correct ? 'ok' : 'bad'}"><b>${r.number}. ${esc(r.kana)}</b><span>Jawaban kamu: ${esc(r.user_answer) || '—'}</span><span>Jawaban benar: ${esc(r.correct_answer)}</span></article>`).join('');

// Mengacak angka: jumlah digit acak antara min dan max
function genNum([lo, hi]) {
  lo = Math.max(1, +lo || 1); hi = Math.max(lo, +hi || lo);
  const d = lo + rnd(hi - lo + 1);
  if (d === 1) return 1 + rnd(9);
  const min = 10 ** (d - 1), max = 10 ** d - 1;
  return min + rnd(max - min + 1);
}
function makeMathQs(cfg, n) {
  const ops = Object.keys(OPS).filter(k => cfg.ops[k] && cfg.ops[k].on);
  if (!ops.length) return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const op = ops[rnd(ops.length)], o = cfg.ops[op];
    let a = genNum(o.a), b = genNum(o.b), ans;
    if (op === 'tambah') ans = a + b;
    else if (op === 'kurang') { if (b > a) [a, b] = [b, a]; ans = a - b; }
    else if (op === 'kali') ans = a * b;
    else { if (b > a) [a, b] = [b, a]; ans = Math.floor(a / b); }
    out.push({ a, b, op, sym: OPS[op], ans, user: '' });
  }
  return out;
}

const STYLE = `<style id="mathStyle">
.math-q{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;margin-bottom:10px;background:rgba(255,255,255,.03)}
.math-q b{font-size:22px;letter-spacing:.5px}
.math-q input{width:120px;font-size:22px;text-align:center}
.math-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:6px 0 10px;font-weight:700}
.math-timer{font-size:20px;color:#f5c542}
.kr-wrap{display:flex;gap:10px;overflow-x:auto;padding:8px 2px 14px}
.kr-col{min-width:58px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 6px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.03)}
.kr-col.kr-on{border-color:#f5c542;box-shadow:0 0 0 2px rgba(245,197,66,.25)}
.kr-col.kr-done{opacity:.55}
.kr-d{font-size:20px;font-weight:700;line-height:1.2}
.kr-in{width:46px;height:34px;text-align:center;font-size:18px;padding:0}
</style>`;
function ensureStyle() { if (!document.querySelector('#mathStyle')) document.head.insertAdjacentHTML('beforeend', STYLE); }
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const progress = (pct, title, eyebrow, id = '') => `<div class="section-title"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2></div></div><div class="hira-progress"><i ${id ? `id="${id}"` : ''} style="width:${Math.min(100, pct)}%"></i></div>`;

// ===== Matematika =====
export async function mathRun({ shell, supabase, sbReady, state, tierFor, playSound, name, siteName, logo }) {
  ensureStyle();
  const cfg = (await loadMathCfg(supabase, sbReady)).math;
  if (!cfg.enabled) return shell(`<section class="section"><div class="card"><h2>Matematika belum dibuka</h2><p class="muted">Admin belum mengaktifkan fitur ini.</p><a class="btn" href="#home">← Beranda</a></div></section>`);
  const rowsMode = cfg.layout === 'rows';
  const perUnit = rowsMode ? Math.max(1, +cfg.per_row || 5) : 1;
  const unitCount = rowsMode ? Math.max(1, +cfg.rows || 4) : Math.max(1, +cfg.count || 20);
  const total = rowsMode ? perUnit * unitCount : unitCount;
  const qs = makeMathQs(cfg, total);
  if (!qs.length) return shell(`<section class="section"><div class="card"><h2>Belum ada operasi aktif</h2><p class="muted">Admin perlu mengaktifkan minimal satu operasi.</p><a class="btn" href="#home">← Beranda</a></div></section>`);
  const tm = cfg.timer || {};
  const unitSec = tm.mode === 'unit' ? Math.max(5, +tm.seconds || 30) : 0;
  const totalSec = tm.mode === 'total' ? Math.max(30, Math.round((+tm.minutes || 3) * 60)) : 0;
  const limit = tm.mode === 'unit' ? unitSec * unitCount : totalSec;
  const activeOps = Object.keys(OPS).filter(k => cfg.ops[k] && cfg.ops[k].on).map(k => OP_NAME[k]).join(', ');
  const rule = `${rowsMode ? `${unitCount} baris × ${perUnit} soal` : `${total} soal`}${tm.mode === 'unit' ? ` · ${unitSec} detik per ${rowsMode ? 'baris' : 'soal'}` : tm.mode === 'total' ? ` · ${Math.round(totalSec / 60)} menit total` : ' · tanpa timer'}`;
  let unit = 0, left = 0, timer = null, done = false, started = null;
  const stopTimer = () => { if (timer) clearInterval(timer); timer = null; };

  const finish = async () => {
    if (done) return; done = true; stopTimer();
    const items = qs.map((q, i) => { const ok = q.user !== '' && Number(q.user) === q.ans; return { number: i + 1, kana: `${q.a} ${q.sym} ${q.b} =`, romaji: '', user_answer: q.user, correct_answer: String(q.ans), correct: ok }; });
    const correct = items.filter(x => x.correct).length, unanswered = items.filter(x => x.user_answer === '').length, wrong = items.length - correct - unanswered;
    const score = Math.round(correct / items.length * 100), duration = Math.round((Date.now() - started) / 1000);
    await saveAssessment({ supabase, sbReady, user: state?.user, test_type: 'matematika', score, correct, wrong, unanswered, duration, details: items });
    showResult({ shell, title: 'Matematika', score, correct, wrong, unanswered, duration, reviewHTML: reviewOf(items), tierFor, name, siteName, logo, playSound, startedAt: new Date(started).toISOString(), limit, limitBy: 'admin' });
  };
  const paint = () => {
    const root = document.querySelector('#mathRoot'); if (!root) return stopTimer();
    const from = unit * perUnit, to = Math.min(total, from + perUnit);
    const label = rowsMode ? `Baris ${unit + 1} / ${unitCount}` : `Soal ${unit + 1} / ${total}`;
    const isLast = unit >= unitCount - 1 || to >= total;
    const pct = Math.round(unit / unitCount * 100);
    const timerTxt = tm.mode === 'none' ? '' : `⏱ ${fmt(left)}`;
    root.innerHTML = `${progress(pct, label, '📐 MATEMATIKA')}
      <div class="math-bar"><span>${rule}</span><span class="math-timer">${timerTxt}</span></div>
      ${qs.slice(from, to).map((q, j) => `<div class="math-q"><b>${q.a} ${q.sym} ${q.b} =</b><input type="text" inputmode="numeric" data-i="${from + j}" value="${esc(q.user)}" autocomplete="off"></div>`).join('')}
      <button class="btn red fullbtn" id="mathNext" type="button" style="margin-top:8px">${isLast ? 'Selesai ✓' : 'Lanjut →'}</button>`;
    root.querySelectorAll('input').forEach(inp => {
      inp.oninput = () => { qs[+inp.dataset.i].user = inp.value.replace(/[^0-9-]/g, ''); };
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const all = [...root.querySelectorAll('input')]; const nx = all[all.indexOf(inp) + 1]; nx ? nx.focus() : root.querySelector('#mathNext').click(); } };
    });
    root.querySelector('#mathNext').onclick = () => nextUnit();
    root.querySelector('input')?.focus();
  };
  const nextUnit = () => {
    if (done) return;
    if (unit >= unitCount - 1 || (unit + 1) * perUnit >= total) return finish();
    unit++; if (tm.mode === 'unit') left = unitSec; paint();
  };
  const start = () => {
    started = Date.now();
    if (tm.mode === 'total') left = totalSec; if (tm.mode === 'unit') left = unitSec;
    paint();
    timer = setInterval(() => {
      if (!document.querySelector('#mathRoot')) return stopTimer();
      if (tm.mode === 'none') return;
      left--;
      if (left <= 0) { if (tm.mode === 'total') return finish(); nextUnit(); return; }
      const el = document.querySelector('.math-timer'); if (el) el.textContent = `⏱ ${fmt(left)}`;
    }, 1000);
  };
  shell(`<section class="section"><div id="mathRoot"></div></section>`);
  const root = document.querySelector('#mathRoot');
  root.innerHTML = `<div class="card"><div class="eyebrow">📐 MATEMATIKA</div><h2>Siap mulai?</h2><p class="muted">Operasi: ${activeOps}</p><p class="muted">${rule}</p><p class="muted">Jawab sesuai soal. Tekan Enter untuk pindah ke kotak berikutnya.</p><button class="btn red fullbtn" id="mathStart" type="button">🚀 Mulai</button></div>`;
  root.querySelector('#mathStart').onclick = start;
}

// ===== Kraepelin =====
export async function kraepelinRun({ shell, supabase, sbReady, state, tierFor, playSound, name, siteName, logo }) {
  ensureStyle();
  const cfg = (await loadMathCfg(supabase, sbReady)).kraepelin;
  if (!cfg.enabled) return shell(`<section class="section"><div class="card"><h2>Kraepelin belum dibuka</h2><p class="muted">Admin belum mengaktifkan fitur ini.</p><a class="btn" href="#home">← Beranda</a></div></section>`);
  const C = Math.max(1, +cfg.columns || 10), D = Math.max(3, +cfg.digits || 11);
  const cols = Array.from({ length: C }, () => Array.from({ length: D }, () => rnd(10)));
  const ans = cols.map(() => Array(D - 1).fill(''));
  const tm = cfg.timer || {};
  const colSec = tm.mode === 'col' ? Math.max(5, +tm.seconds || 15) : 0;
  let c = 0, k = D - 2, left = colSec, timer = null, done = false, started = null;
  const stopTimer = () => { if (timer) clearInterval(timer); timer = null; };
  const totalPairs = C * (D - 1);
  const finish = async () => {
    if (done) return; done = true; stopTimer();
    const items = [];
    cols.forEach((col, ci) => col.slice(0, -1).forEach((_, ki) => {
      const v = ans[ci][ki], right = (col[ki] + col[ki + 1]) % 10;
      items.push({ number: items.length + 1, kana: `Kolom ${ci + 1}: ${col[ki]} + ${col[ki + 1]}`, romaji: '', user_answer: v, correct_answer: String(right), correct: v !== '' && Number(v) === right });
    }));
    const correct = items.filter(x => x.correct).length, unanswered = items.filter(x => x.user_answer === '').length, wrong = items.length - correct - unanswered;
    const score = Math.round(correct / totalPairs * 100), duration = Math.round((Date.now() - started) / 1000);
    await saveAssessment({ supabase, sbReady, user: state?.user, test_type: 'kraepelin', score, correct, wrong, unanswered, duration, details: items });
    showResult({ shell, title: 'Kraepelin', score, correct, wrong, unanswered, duration, reviewHTML: reviewOf(items), tierFor, name, siteName, logo, playSound, startedAt: new Date(started).toISOString(), limit: colSec ? colSec * C : 0, limitBy: 'admin' });
  };
  const isActive = (ci, ki) => ci === c && ki === k;
  const paint = () => {
    const root = document.querySelector('#krRoot'); if (!root) return stopTimer();
    root.querySelectorAll('.kr-col').forEach((el, ci) => { el.classList.toggle('kr-on', ci === c); el.classList.toggle('kr-done', ci < c); });
    root.querySelectorAll('.kr-in').forEach(inp => { const ci = +inp.dataset.c, ki = +inp.dataset.k; inp.disabled = ci !== c; inp.classList.toggle('kr-active', isActive(ci, ki)); });
    const el = root.querySelector(`.kr-in[data-c="${c}"][data-k="${k}"]`); if (el) el.focus();
    const info = document.querySelector('#krInfo'); if (info) info.textContent = `Kolom ${c + 1} / ${C} · isi dari bawah ke atas`;
    const bar = document.querySelector('#krBar'); if (bar) bar.style.width = `${Math.round(c / C * 100)}%`;
    const t = document.querySelector('#krTimer'); if (t) t.textContent = colSec ? `⏱ ${left}s` : '';
  };
  const nextColumn = () => { c++; k = D - 2; left = colSec; if (c >= C) return finish(); paint(); };
  const advance = () => { k--; if (k < 0) return nextColumn(); paint(); };
  const build = () => {
    const colsHTML = cols.map((col, ci) => {
      let h = '';
      for (let r = 0; r < D; r++) {
        h += `<div class="kr-d">${col[r]}</div>`;
        if (r < D - 1) h += `<input class="kr-in" inputmode="numeric" maxlength="1" autocomplete="off" data-c="${ci}" data-k="${r}" value="${esc(ans[ci][r])}">`;
      }
      return `<div class="kr-col" data-col="${ci}">${h}</div>`;
    }).join('');
    const root = document.querySelector('#krRoot');
    root.innerHTML = `${progress(0, 'Kraepelin', '🧮 KRAEPELIN', 'krBar')}<div class="math-bar"><span id="krInfo"></span><span class="math-timer" id="krTimer"></span></div><div class="kr-wrap">${colsHTML}</div>`;
    root.insertAdjacentHTML('afterbegin', '');
    root.querySelectorAll('.kr-in').forEach(inp => {
      inp.oninput = () => {
        const v = inp.value.replace(/[^0-9]/g, '').slice(-1);
        inp.value = v;
        ans[+inp.dataset.c][+inp.dataset.k] = v;
        if (v !== '' && isActive(+inp.dataset.c, +inp.dataset.k)) advance();
      };
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); if (isActive(+inp.dataset.c, +inp.dataset.k)) advance(); } };
    });
    paint();
  };
  const start = () => {
    started = Date.now(); left = colSec;
    build();
    timer = setInterval(() => {
      if (!document.querySelector('#krRoot')) return stopTimer();
      if (!colSec) return;
      left--;
      if (left <= 0) { nextColumn(); return; }
      const t = document.querySelector('#krTimer'); if (t) t.textContent = `⏱ ${left}s`;
    }, 1000);
  };
  shell(`<section class="section"><div id="krRoot"><div class="card"><div class="eyebrow">🧮 KRAEPELIN</div><h2>Siap mulai?</h2><p class="muted">${C} kolom · ${D} angka per kolom${colSec ? ` · ${colSec} detik per kolom` : ' · tanpa timer'}.</p><p class="muted">Jumlahkan dua angka yang berdekatan, ambil angka satuannya saja. Kerjakan dari bawah ke atas, lalu lanjut ke kolom kanan.</p><button class="btn red fullbtn" id="krStart" type="button">🚀 Mulai</button></div></div></section>`);
  document.querySelector('#krStart').onclick = start;
}
