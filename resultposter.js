// Poster hasil latihan: tampilan "foto" bernilai + tombol simpan jadi gambar PNG.
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0)), m = Math.floor(s / 60), r = s % 60;
  return m ? `${m} menit ${r} detik` : `${r} detik`;
}
export function fmtWhen(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d)) return '-';
  const tgl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
  return `${tgl}, pukul ${jam}`;
}

// o: { title, name, score, correct, wrong, unanswered, duration, startedAt, finishedAt, siteName, image, tier:{icon,title,sub,color}, emojis }
export function posterHTML(o) {
  const t = o.tier || { icon: '🎌', title: '', sub: '', color: '#f5c542' };
  const hx = String(t.color || '#f5c542').replace('#', '');
  const glow = `rgba(${parseInt(hx.slice(0, 2), 16)},${parseInt(hx.slice(2, 4), 16)},${parseInt(hx.slice(4, 6), 16)},.32)`;
  const img = o.image ? `;--poster-img:url("${encodeURI(o.image).replace(/\(/g, '%28').replace(/\)/g, '%29')}")` : '';
  const score = Math.max(0, Math.min(100, Math.round(Number(o.score) || 0)));
  return `<div class="poster-block"><div class="result-card tier-custom poster" style="--tier:${esc(t.color)};--tier-glow:${glow}${img}">
    ${o.emojis ? `<div class="result-emoji" aria-hidden="true">${o.emojis}</div>` : ''}
    <div class="poster-top"><div><div class="poster-brand">${esc(o.siteName || 'ITCO JAPAN')}</div><div class="poster-kicker">HASIL LATIHAN</div></div><div class="poster-icon" aria-hidden="true">${esc(t.icon)}</div></div>
    <div><h2>${esc(o.title)}</h2><div class="poster-name">${esc(o.name || '')}</div></div>
    <div class="poster-ring" style="--p:${score}"><div><b>${score}</b><small>/ 100</small></div></div>
    <div class="poster-tier">${esc(t.title)}${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</div>
    <div class="poster-stats"><span><b>${Number(o.correct) || 0}</b>Benar</span><span><b>${Number(o.wrong) || 0}</b>Salah</span><span><b>${Number(o.unanswered) || 0}</b>Kosong</span></div>
    <div class="poster-info"><div><span>Waktu pengerjaan</span><b>${esc(fmtDuration(o.duration))}</b></div><div><span>Mulai mengerjakan</span><b>${esc(fmtWhen(o.startedAt))}</b></div><div><span>Selesai</span><b>${esc(fmtWhen(o.finishedAt))}</b></div></div>
    <div class="poster-foot">${esc(o.siteName || 'ITCO JAPAN')} · 頑張ってね！！</div>
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

export async function drawPoster(o) {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), ff = getComputedStyle(document.body).fontFamily || 'serif';
  const tier = (o.tier && o.tier.color) || '#f5c542', score = Math.max(0, Math.min(100, Math.round(Number(o.score) || 0)));
  g.fillStyle = '#0b0b0e'; g.fillRect(0, 0, W, H);
  const im = await loadImg(o.image);
  if (im) { const s = Math.max(W / im.width, H / im.height), w = im.width * s, h = im.height * s; g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); }
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,.88)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = tier; g.lineWidth = 8; rr(g, 14, 14, W - 28, H - 28, 56); g.stroke();
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left'; g.fillStyle = '#ececf0'; g.font = `700 34px ${ff}`; g.fillText(String(o.siteName || 'ITCO JAPAN').toUpperCase(), 80, 118);
  g.fillStyle = tier; g.font = `700 28px ${ff}`; g.fillText('HASIL LATIHAN', 80, 166);
  g.textAlign = 'right'; g.font = `80px ${ff}`; g.fillStyle = '#fff'; g.fillText((o.tier && o.tier.icon) || '🎌', W - 80, 150);
  g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = `700 62px ${ff}`;
  const tl = wrap(g, o.title, W - 160, 2); tl.forEach((l, i) => g.fillText(l, 80, 260 + i * 72));
  g.fillStyle = '#e2e2e8'; g.font = `400 36px ${ff}`; g.fillText(String(o.name || ''), 80, 260 + tl.length * 72 + 8);
  const cx = W / 2, cy = 640, R = 190;
  g.lineCap = 'round'; g.lineWidth = 38; g.strokeStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  if (score > 0) { g.strokeStyle = tier; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * score / 100); g.stroke(); }
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = `700 150px ${ff}`; g.fillText(String(score), cx, cy + 32);
  g.fillStyle = '#cfcfd6'; g.font = `400 38px ${ff}`; g.fillText('/ 100', cx, cy + 88);
  g.fillStyle = '#fff'; g.font = `700 40px ${ff}`; g.fillText(String((o.tier && o.tier.title) || ''), cx, 928, W - 160);
  const bx = 80, bw = 290, gap = 25, by = 975, bh = 130;
  [['Benar', o.correct], ['Salah', o.wrong], ['Kosong', o.unanswered]].forEach(([lab, val], i) => {
    const x = bx + i * (bw + gap); g.fillStyle = 'rgba(255,255,255,.12)'; rr(g, x, by, bw, bh, 26); g.fill();
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = `700 58px ${ff}`; g.fillText(String(Number(val) || 0), x + bw / 2, by + 68);
    g.fillStyle = '#e8e8ec'; g.font = `400 28px ${ff}`; g.fillText(lab, x + bw / 2, by + 108);
  });
  const rows = [['Waktu pengerjaan', fmtDuration(o.duration)], ['Mulai mengerjakan', fmtWhen(o.startedAt)], ['Selesai', fmtWhen(o.finishedAt)]];
  rows.forEach(([lab, val], i) => {
    const y = 1170 + i * 58; g.textAlign = 'left'; g.fillStyle = '#d6d6dc'; g.font = `400 30px ${ff}`; g.fillText(lab, 80, y);
    g.textAlign = 'right'; g.fillStyle = '#fff'; g.font = `700 32px ${ff}`; g.fillText(val, W - 80, y, 560);
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 2; g.beginPath(); g.moveTo(80, y + 16); g.lineTo(W - 80, y + 16); g.stroke();
  });
  g.textAlign = 'center'; g.fillStyle = '#cfcfd6'; g.font = `400 26px ${ff}`; g.fillText(`${o.siteName || 'ITCO JAPAN'} · 頑張ってね！！`, cx, 1322);
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
