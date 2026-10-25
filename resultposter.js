// Poster hasil latihan: tampilan "foto" bernilai + tombol simpan jadi gambar PNG.
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

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
const BLN=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
export function fmtShort(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d)) return '-';
  return `${d.getDate()} ${BLN[d.getMonth()]} ${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
const durText = s => (Number(s) > 0 ? fmtDuration(s) : 'Tidak tercatat');
const limitText = s => (Number(s) > 0 ? fmtDuration(s) : 'Tanpa batas waktu');

// o: { title, name, score, correct, wrong, unanswered, duration, startedAt, finishedAt, siteName, image, tier:{icon,title,sub,color}, emojis }
export function posterHTML(o) {
  const t = o.tier || { icon: '🎌', title: '', sub: '', color: '#f5c542' };
  const hx = String(t.color || '#f5c542').replace('#', '');
  const glow = `rgba(${parseInt(hx.slice(0, 2), 16)},${parseInt(hx.slice(2, 4), 16)},${parseInt(hx.slice(4, 6), 16)},.32)`;
  const img = o.image ? `;--poster-img:url("${encodeURI(o.image).replace(/\(/g, '%28').replace(/\)/g, '%29')}")` : '';
  const score = Math.max(0, Math.min(100, Math.round(Number(o.score) || 0)));
  return `<div class="poster-block"><div class="result-card tier-custom poster" style="--tier:${esc(t.color)};--tier-glow:${glow}${img}">
    ${o.emojis ? `<div class="result-emoji" aria-hidden="true">${o.emojis}</div>` : ''}
    <div class="poster-center"><h2>${esc(o.title)}</h2><div class="poster-name">${esc(o.name || '')}</div></div>
    <div class="poster-ring" style="--p:${score}"><div><b>${score}</b><small>/ 100</small></div></div>
    <div class="poster-tier">${esc(t.title)}</div>
  </div><div class="poster-actions"><button type="button" class="btn red" data-poster-save>📷 Simpan sebagai foto</button></div></div>`;
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
  const cx = W / 2;
  // latar bersih + pola ombak Jepang yang samar (tanpa wallpaper)
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#13131a'); bg.addColorStop(1, '#07070a');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  seigaiha(g, W, H, 110, 'rgba(255,255,255,.045)');
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
  g.fillStyle = '#fff'; g.font = `700 150px ${ff}`; g.fillText(String(score), cx, cy + 30);
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
  // rincian waktu
  const rows = [['Waktu pengerjaan', durText(o.duration)]];
  if (o.limit !== undefined && o.limit !== null) rows.push(['Batas waktu', limitText(o.limit)]);
  rows.push(['Mulai mengerjakan', fmtWhen(o.startedAt)], ['Selesai', fmtWhen(o.finishedAt)]);
  rows.forEach(([lab, val], i) => {
    const y = 1330 + i * 46; g.textAlign = 'left'; g.fillStyle = '#d0d0d8'; g.font = `400 30px ${ff}`; g.fillText(lab, 100, y);
    g.textAlign = 'right'; g.fillStyle = '#fff'; g.font = `700 31px ${ff}`; g.fillText(val, W - 100, y, 600);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; g.beginPath(); g.moveTo(100, y + 16); g.lineTo(W - 100, y + 16); g.stroke();
  });
  g.textAlign = 'center'; g.fillStyle = '#c4c4cc'; g.font = `400 26px ${ff}`; g.fillText(`${o.siteName || 'ITCO JAPAN'} · 頑張ってね！！`, cx, 1534);
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
