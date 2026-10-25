// Poster hasil latihan: kartu di layar + tombol simpan jadi gambar PNG.
const esc = s => String(s ?? '').replace(/[&<>\"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0)), m = Math.floor(s / 60), r = s % 60;
  return m ? `${m} menit ${r} detik` : `${r} detik`;
}
function tzName(d) {
  const off = -d.getTimezoneOffset() / 60;
  return off === 7 ? 'WIB' : off === 8 ? 'WITA' : off === 9 ? 'WIT' : `GMT${off >= 0 ? '+' : ''}${off}`;
}
export function fmtWhen(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d)) return 'Tidak tercatat';
  const tgl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const p = n => String(n).padStart(2, '0');
  return `${tgl}, ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${tzName(d)}`;
}
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export function fmtShort(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d)) return '-';
  return `${d.getDate()} ${BLN[d.getMonth()]} ${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const isNum = v => v !== null && v !== undefined && v !== '' && !isNaN(Number(v));
const durText = s => (isNum(s) ? fmtDuration(Number(s)) : 'Tidak tercatat');
const limitText = s => (!isNum(s) ? 'Tidak tercatat' : Number(s) > 0 ? fmtDuration(Number(s)) : 'Tanpa batas waktu');
const limitLabel = by => (by === 'user' ? 'Waktu diatur user' : 'Waktu diatur admin');

// Baris waktu yang sama dipakai di kartu layar dan di foto (real-time dari data pengerjaan)
export function timeRows(o) {
  return [
    ['Mulai mengerjakan', fmtWhen(o.startedAt)],
    ['Selesai mengerjakan', fmtWhen(o.finishedAt)],
    ['Waktu penyelesaian', durText(o.duration)],
    [limitLabel(o.limitBy), limitText(o.limit)],
  ];
}

// o: { title, name, score, correct, wrong, unanswered, duration, limit, limitBy, startedAt, finishedAt, siteName, image, logo, tier:{icon,title,sub,color,bgemoji}, emojis }
export function posterHTML(o) {
  const t = o.tier || { icon: '🎌', title: '', sub: '', color: '#f5c542' };
  const hx = String(t.color || '#f5c542').replace('#', '');
  const glow = `rgba(${parseInt(hx.slice(0, 2), 16)},${parseInt(hx.slice(2, 4), 16)},${parseInt(hx.slice(4, 6), 16)},.32)`;
  const emote = String(t.bgemoji || '').trim();
  // kalau ada emoji latar, wallpaper tidak dipakai
  const img = (!emote && o.image) ? `;--poster-img:url("${encodeURI(o.image).replace(/\(/g, '%28').replace(/\)/g, '%29')}")` : '';
  const score = Math.max(0, Math.min(100, Math.round(Number(o.score) || 0)));
  // kartu layar: hanya nama part, nama user, nilai, dan pengucapan
  return `<div class="poster-block"><div class="result-card tier-custom pst" style="--tier:${esc(t.color)};--tier-glow:${glow}${img}">
    ${emote ? `<div class="poster-bgemoji" aria-hidden="true">${esc(emote)}</div>` : ''}
    ${o.emojis ? `<div class="result-emoji" aria-hidden="true">${o.emojis}</div>` : ''}
    <h3 class="pst-title">${esc(o.title)}</h3>
    <div class="pst-name">${esc(o.name || '')}</div>
    <div class="pst-ring" style="--p:${score}"><div><b>${score}</b><small>/ 100</small></div></div>
    <p class="pst-tier">${esc(t.title)}</p>
  </div><div class="poster-actions"><button type="button" class="btn red" data-poster-save>📷 Simpan sebagai foto</button></div></div>`;
}

// ===== Suara hasil =====
// Nilai bagus/buruk memutar suara ±1 menit lalu mengulang sampai dihentikan (maks. 10 menit).
// Kalau admin mengunggah MP3, file itu yang diputar dan diulang.
export const SOUND_OPTIONS = {
  good: [['fanfare', 'Fanfare kemenangan'], ['bell', 'Lonceng selamat']],
  bad: [['sad', 'Nada sedih'], ['wah', 'Wah-wah kecewa']],
};
const BLOCK = 60;            // detik per blok suara
const MAX_PLAY = 10 * 60000; // batas putar otomatis (ms)
let _actx = null, _master = null, _nodes = [], _timer = null, _stopTimeout = null, _nextBlock = 0, _audioEl = null, _stopBtn = null;

function audioCtx() {
  try {
    _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
    if (_actx.state === 'suspended') _actx.resume().catch(() => {});
    return _actx;
  } catch { return null; }
}
// buka kunci audio pada sentuhan/klik pertama user (syarat browser)
if (typeof document !== 'undefined') {
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, () => { audioCtx(); }, { passive: true }));
}
if (typeof window !== 'undefined') window.addEventListener('hashchange', () => stopResultSound());

function showStop() {
  if (_stopBtn || typeof document === 'undefined') return;
  _stopBtn = document.createElement('button');
  _stopBtn.type = 'button';
  _stopBtn.textContent = '🔇 Hentikan suara';
  _stopBtn.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:4000;padding:12px 20px;border-radius:999px;border:1px solid #444;background:#1a1a22;color:#fff;font-weight:700;box-shadow:0 8px 24px #000a;cursor:pointer';
  _stopBtn.onclick = () => stopResultSound();
  document.body.appendChild(_stopBtn);
}
export function stopResultSound() {
  clearInterval(_timer); _timer = null;
  clearTimeout(_stopTimeout); _stopTimeout = null;
  _nodes.forEach(n => { try { n.stop(); } catch {} }); _nodes = [];
  if (_audioEl) { try { _audioEl.pause(); } catch {} _audioEl = null; }
  if (_master) { try { _master.disconnect(); } catch {} _master = null; }
  if (_stopBtn) { _stopBtn.remove(); _stopBtn = null; }
}
function tone(ctx, dest, freq, start, dur, type, gain, slideTo) {
  const o = ctx.createOscillator(), gn = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  gn.gain.setValueAtTime(0.0001, start);
  gn.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), start + 0.02);
  gn.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(gn); gn.connect(dest);
  o.start(start); o.stop(start + dur + 0.05);
  o._end = start + dur + 0.05; _nodes.push(o);
}
const T = (c, f, s, d, type, g, slide) => tone(c.ctx, c.dest, f, s, d, type, g, slide);

// setiap "frasa" menulis nadanya lalu mengembalikan panjangnya (detik)
function phraseFanfare(c, t0) {
  const m = [[523, 0, .22], [659, .25, .22], [784, .5, .22], [1047, .75, .5], [784, 1.3, .22], [1047, 1.55, .22], [1319, 1.8, 1.0]];
  m.forEach(([f, t, d]) => { T(c, f, t0 + t, d, 'triangle', .22); T(c, f * 2, t0 + t, d, 'sine', .05); });
  [523, 659, 784].forEach(f => T(c, f, t0 + 2.9, 2.1, 'sine', .14));
  [1047, 1319].forEach(f => T(c, f, t0 + 2.9, 2.1, 'triangle', .07));
  for (let i = 0; i < 8; i++) T(c, 1568, t0 + 3.3 + i * .12, .12, 'sine', .04);
  return 5.0;
}
function phraseBell(c, t0) {
  [[1047, 0], [1319, .85], [1568, 1.7], [2093, 2.7]].forEach(([f, t]) => {
    [[1, .25], [2.76, .1], [5.4, .04]].forEach(([r, g]) => T(c, f * r, t0 + t, 3.2, 'sine', g));
  });
  [523, 659, 784].forEach(f => T(c, f, t0 + 3.4, 1.6, 'sine', .08));
  return 6.0;
}
function phraseSad(c, t0) {
  [[392, 0, 1.1, 349], [349, 1.2, 1.1, 330], [330, 2.4, 1.1, 294], [294, 3.6, 1.9, 220]]
    .forEach(([f, t, d, to]) => { T(c, f, t0 + t, d, 'triangle', .3, to); T(c, f / 2, t0 + t, d, 'sine', .12); });
  return 5.5;
}
function phraseWah(c, t0) {
  [[0, 466, 311], [1.5, 415, 277], [3.0, 370, 233]].forEach(([t, a, b]) => T(c, a, t0 + t, 1.4, 'sawtooth', .08, b));
  T(c, 155, t0 + 4.5, 1.2, 'sawtooth', .1, 122);
  return 5.7;
}
function scheduleBlock(c, start, phrase) {
  const len = phrase(c, start);
  for (let t = start + len; t < start + BLOCK; t += len) phrase(c, t);
}
function startLoop(c, phrase) {
  _nextBlock = c.ctx.currentTime + 0.05;
  const fill = () => {
    _nodes = _nodes.filter(n => n._end > c.ctx.currentTime);
    while (_nextBlock < c.ctx.currentTime + BLOCK + 5) { scheduleBlock(c, _nextBlock, phrase); _nextBlock += BLOCK; }
  };
  fill();
  _timer = setInterval(fill, 5000);
}

export function playResultSound(score, sound, opts) {
  const s = Object.assign({ enabled: true, threshold: 70, volume: 60, good: 'fanfare', bad: 'sad', good_url: '', bad_url: '' }, sound || {});
  if (!s.enabled && !(opts && opts.force)) return;
  stopResultSound();
  const good = Number(score) >= Number(s.threshold);
  const vol = Math.max(0, Math.min(1, (Number(s.volume) || 0) / 100));
  const url = good ? s.good_url : s.bad_url;
  _stopTimeout = setTimeout(stopResultSound, MAX_PLAY);
  if (url) {
    try {
      const a = new Audio(url); a.loop = true; a.volume = vol; _audioEl = a;
      a.play().catch(() => {});
      showStop();
    } catch { /* abaikan */ }
    return;
  }
  const ctx = audioCtx(); if (!ctx) return;
  _master = ctx.createGain(); _master.gain.value = vol * 1.5; _master.connect(ctx.destination);
  const c = { ctx, dest: _master };
  const phrase = good ? (s.good === 'bell' ? phraseBell : phraseFanfare) : (s.bad === 'wah' ? phraseWah : phraseSad);
  startLoop(c, phrase);
  showStop();
}

function loadImg(src) {
  return new Promise(res => {
    if (!src) return res(null);
    const im = new Image(); im.crossOrigin = 'anonymous';
    const t = setTimeout(() => res(null), 6000);
    im.onload = () => { clearTimeout(t); res(im); };
    im.onerror = () => { clearTimeout(t); res(null); };
    im.src = src;
  });
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, text, maxW, maxLines) {
  const words = String(text || '').split(/\s+/), lines = []; let cur = '';
  for (const w of words) { const test = cur ? cur + ' ' + w : w; if (g.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test; }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '…'); }
  return lines;
}

function seigaiha(g, W, H, rad, color) {
  g.save(); g.strokeStyle = color; g.lineWidth = 2;
  for (let row = 0; row * rad / 2 < H + rad; row++) {
    const y = row * rad / 2;
    for (let col = -1; col * rad < W + rad; col++) {
      const x = col * rad + (row % 2 ? rad / 2 : 0);
      for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(x, y, rad * k / 3.4, 0, Math.PI); g.stroke(); }
    }
  }
  g.restore();
}
function spaced(g, text, x, y, sp) { try { g.letterSpacing = sp + 'px'; } catch { /* abaikan */ } g.fillText(text, x, y); try { g.letterSpacing = '0px'; } catch { /* abaikan */ } }

export async function drawPoster(o) {
  const W = 1080, H = 1590, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), ff = getComputedStyle(document.body).fontFamily || 'serif';
  const tier = (o.tier && o.tier.color) || '#f5c542', score = Math.max(0, Math.min(100, Math.round(Number(o.score) || 0)));
  const emote = String((o.tier && o.tier.bgemoji) || '').trim();
  const cx = W / 2;
  // latar bersih + pola ombak Jepang yang samar
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#13131a'); bg.addColorStop(1, '#07070a');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  seigaiha(g, W, H, 110, 'rgba(255,255,255,.045)');
  // emoji besar transparan di tengah (menggantikan wallpaper)
  if (emote) { g.save(); g.globalAlpha = .22; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `400 640px ${ff}`; g.fillText(emote, cx, 900); g.restore(); }
  const glow = g.createRadialGradient(cx, 820, 40, cx, 820, 520); glow.addColorStop(0, 'rgba(255,255,255,.10)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fillRect(0, 300, W, 1000);
  // bingkai ganda
  g.strokeStyle = tier; g.lineWidth = 6; rr(g, 28, 28, W - 56, H - 56, 40); g.stroke();
  g.globalAlpha = .45; g.lineWidth = 2; rr(g, 50, 50, W - 100, H - 100, 28); g.stroke(); g.globalAlpha = 1;
  g.textBaseline = 'alphabetic'; g.textAlign = 'center';
  // logo
  const logo = await loadImg(o.logo);
  g.save(); g.beginPath(); g.arc(cx, 150, 66, 0, Math.PI * 2); g.closePath(); g.fillStyle = '#f4f4f6'; g.fill(); g.clip();
  if (logo) { const s = Math.max(132 / logo.width, 132 / logo.height), w = logo.width * s, h = logo.height * s; g.drawImage(logo, cx - w / 2, 150 - h / 2, w, h); }
  else { g.fillStyle = '#111'; g.font = `70px ${ff}`; g.fillText('⛩', cx, 176); }
  g.restore(); g.strokeStyle = tier; g.lineWidth = 5; g.beginPath(); g.arc(cx, 150, 69, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#f2f2f5'; g.font = `700 40px ${ff}`; spaced(g, String(o.siteName || 'ITCO JAPAN').toUpperCase(), cx, 290, 8);
  g.fillStyle = tier; g.font = `700 28px ${ff}`; spaced(g, 'HASIL LATIHAN', cx, 340, 10);
  g.strokeStyle = tier; g.lineWidth = 2; g.beginPath(); g.moveTo(120, 330); g.lineTo(330, 330); g.moveTo(W - 330, 330); g.lineTo(W - 120, 330); g.stroke();
  // judul + nama
  g.fillStyle = '#fff'; g.font = `700 66px ${ff}`;
  const tl = wrap(g, o.title, W - 200, 2); tl.forEach((l, i) => g.fillText(l, cx, 440 + i * 76));
  g.fillStyle = '#d6d6dc'; g.font = `400 38px ${ff}`; g.fillText(String(o.name || ''), cx, 440 + tl.length * 76 + 6);
  // lingkaran nilai
  const nameY = 440 + tl.length * 76 + 6, cy = Math.round((nameY + 30 + 1030) / 2), R = 165;
  g.lineCap = 'round'; g.lineWidth = 36; g.strokeStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  if (score > 0) { g.strokeStyle = tier; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * score / 100); g.stroke(); }
  g.fillStyle = '#fff'; g.font = `700 ${String(score).length > 2 ? 118 : 150}px ${ff}`; g.fillText(String(score), cx, cy + 30);
  g.fillStyle = '#cfcfd6'; g.font = `400 36px ${ff}`; g.fillText('/ 100', cx, cy + 86);
  // predikat
  const t = o.tier || {};
  g.fillStyle = '#fff'; g.font = `700 42px ${ff}`; g.fillText(`${t.icon || ''} ${t.title || ''}`.trim(), cx, 1068, W - 160);
  if (t.sub) { g.fillStyle = '#cfcfd6'; g.font = `400 30px ${ff}`; g.fillText(t.sub, cx, 1114, W - 180); }
  // statistik
  const bw = 290, gap = 25, bx = (W - (bw * 3 + gap * 2)) / 2, by = 1160, bh = 118;
  [['Benar', o.correct], ['Salah', o.wrong], ['Kosong', o.unanswered]].forEach(([lab, val], i) => {
    const x = bx + i * (bw + gap); g.fillStyle = 'rgba(255,255,255,.09)'; rr(g, x, by, bw, bh, 24); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; rr(g, x, by, bw, bh, 24); g.stroke();
    g.fillStyle = '#fff'; g.font = `700 54px ${ff}`; g.fillText(String(Number(val) || 0), x + bw / 2, by + 64);
    g.fillStyle = '#dcdce2'; g.font = `400 28px ${ff}`; g.fillText(lab, x + bw / 2, by + 102);
  });
  // rincian waktu (mulai, selesai, penyelesaian, batas dari admin/user)
  timeRows(o).forEach(([lab, val], i) => {
    const y = 1318 + i * 46;
    g.textAlign = 'left'; g.fillStyle = '#d0d0d8'; g.font = `400 28px ${ff}`; g.fillText(lab, 100, y);
    g.textAlign = 'right'; g.fillStyle = '#fff'; g.font = `700 28px ${ff}`; g.fillText(val, W - 100, y, 560);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; g.beginPath(); g.moveTo(100, y + 14); g.lineTo(W - 100, y + 14); g.stroke();
  });
  g.textAlign = 'center'; g.fillStyle = '#c4c4cc'; g.font = `400 26px ${ff}`; g.fillText(`${o.siteName || 'ITCO JAPAN'} · 頑張ってね！！`, cx, 1508);
  return c;
}

export function bindPoster(root, o) {
  const btn = (root || document).querySelector('[data-poster-save]');
  if (!btn) return;
  btn.onclick = async () => {
    const label = btn.textContent; btn.disabled = true; btn.textContent = 'Membuat foto…';
    try {
      const c = await drawPoster(o);
      const blob = await new Promise((ok, no) => c.toBlob(b => (b ? ok(b) : no(new Error('gagal'))), 'image/png'));
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `hasil-${String(o.title || 'latihan').replace(/[^\w\-]+/g, '_').slice(0, 40)}-${o.score}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      btn.textContent = '✓ Tersimpan';
    } catch { btn.textContent = 'Gagal, coba lagi'; }
    setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 2200);
  };
}
