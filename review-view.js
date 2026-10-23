// Tampilan "Review Jawaban" soal PDF (mirip asli), dipakai bersama oleh app.js (halaman hasil user)
// dan admin.js (detail hasil user di menu User), supaya keduanya identik.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
export function parseJSON(v, fallback = null) { if (Array.isArray(v) || (v && typeof v === 'object')) return v; try { return JSON.parse(v || ''); } catch { return fallback; } }
export const sheetShown = v => /^[a-d]$/i.test(String(v)) ? String(v).toUpperCase() : String(v);
export function slimHot(h) { if (!h || h.m) return h; if (h.w > .09) h = { x: h.x + .005, w: .06, y: h.y + Math.max(0, (h.h - .04) / 2), h: Math.min(h.h, .04) }; else if (h.w >= .07) return h; return { ...h, x: h.x + .006, y: h.y + .012 }; }
export const sheetBox = s => `left:${(s.x + s.w / 2) * 100}%;top:${(s.y + s.h / 2) * 100}%`;

// reviews: array of {user, answer, ok, sheet_page_url, sheet_slot, sheet_hot, audio_url}
export const hasSheetReview = reviews => Array.isArray(reviews) && reviews.length > 0 && reviews.every(x => x.sheet_page_url);

// Baris hasil tersimpan (dari tabel results.details) -> bentuk yang dipakai sheetReviewHTML.
export const fromSavedDetails = details => (Array.isArray(details) ? details : []).map(d => ({
  user: d.user_answer, answer: d.correct_answer, ok: !!d.correct,
  sheet_page_url: d.sheet_page_url, sheet_slot: d.sheet_slot, sheet_hot: d.sheet_hot, audio_url: d.audio_url,
}));

export function sheetReviewHTML(reviews) {
  const rs = reviews, pages = [], seen = {};
  rs.forEach((x, i) => { let p = pages.find(p => p.url === x.sheet_page_url); if (!p) { p = { url: x.sheet_page_url, items: [] }; pages.push(p); } p.items.push({ x, i }); });
  const bad = rs.map((x, i) => ({ x, i })).filter(o => !o.x.ok);
  const body = pages.map(p => {
    const spots = p.items.map(({ x }) => { const h = slimHot(parseJSON(x.sheet_hot, null)); if (!h || !x.audio_url) return ''; const key = `${x.audio_url}|${h.x.toFixed(3)}|${h.y.toFixed(3)}`; if (seen[key]) return ''; seen[key] = 1; return `<div class="sheet-hot" role="button" tabindex="0" data-audio="${esc(x.audio_url)}" aria-label="Putar audio" style="left:${h.x * 100}%;top:${h.y * 100}%;width:${h.w * 100}%;height:${h.h * 100}%"></div>`; }).join('');
    const slots = p.items.map(({ x, i }) => {
      const s = parseJSON(x.sheet_slot, null) || { x: .7, y: .9, w: .2, h: .02 }, blank = !String(x.user || '').trim(), cls = x.ok ? 'rv-ok' : blank ? 'rv-blank' : 'rv-bad';
      const mine = blank ? '–' : esc(sheetShown(x.user));
      const fix = x.ok ? '' : `<span class="sheet-fix${s.x + s.w > .80 ? ' l' : ''}">${esc(sheetShown(x.answer))}</span>`;
      return `<div class="sheet-slot ${cls}" data-i="${i}" style="${sheetBox(s)}">${mine}${fix}</div>`;
    }).join('');
    return `<div class="sheet-page"><img src="${esc(p.url)}" alt="Halaman soal" decoding="async">${spots}${slots}</div>`;
  }).join('');
  const chips = bad.length ? `<div class="rv-chips"><span>Salah / kosong:</span>${bad.map(o => `<button type="button" class="rv-chip" data-rv="${o.i}">${o.i + 1}</button>`).join('')}</div>` : '<p class="muted">Tidak ada yang salah. Sempurna! 🎉</p>';
  return `<div class="review-list sheet-review"><h2>Review Jawaban</h2><p class="muted sheet-hint">Lingkaran hijau = benar. Lingkaran merah = salah, dan lingkaran hijau kecil di sebelahnya adalah jawaban yang benar. Abu-abu = tidak dijawab.</p>${chips}${body}</div>`;
}

// Putar audio pada ikon 🔊 di dalam review (satu audio aktif per root). Panggil setelah HTML di atas dipasang ke DOM.
export function bindSheetReviewAudio(root = document) {
  let cur = null;
  const stop = () => { try { cur?.audio?.pause(); } catch {} cur?.btn?.classList.remove('playing'); cur = null; };
  root.querySelectorAll('.sheet-hot[data-audio]').forEach(b => { b.onclick = e => {
    e.preventDefault(); const u = b.dataset.audio;
    if (cur && cur.u === u) { stop(); return; }
    stop(); const a = new Audio(u); b.classList.add('playing'); cur = { audio: a, btn: b, u };
    a.onended = a.onpause = () => b.classList.remove('playing');
    a.play().catch(() => { b.classList.remove('playing'); cur = null; });
  }; });
  root.querySelectorAll('.rv-chip[data-rv]').forEach(b => { b.onclick = () => root.querySelector(`.sheet-slot[data-i="${b.dataset.rv}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
  return stop;
}

// Ukuran lingkaran jawaban & font mengikuti lebar halaman (sama seperti saat user mengerjakan).
export function fitSheetFonts(root = document) {
  root.querySelectorAll('.sheet-page').forEach(p => { const d = Math.min(30, Math.max(20, p.clientWidth * .052)); p.style.setProperty('--sdia', d + 'px'); p.style.setProperty('--sfs', (d * .58) + 'px'); });
}
