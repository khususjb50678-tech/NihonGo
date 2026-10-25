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
  prompt: d.question, user: d.user_answer, answer: d.correct_answer, ok: !!d.correct, type: d.type, explanation: d.explanation, photo_url: d.photo_url || d.media_url || '', media_type: d.media_type || '', duration_seconds: d.duration_seconds, started_at: d.started_at, finished_at: d.finished_at,
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

// Bersihkan HTML yang ditempel dari Word/Google Docs (font, warna, dsb). Hanya <u> dan <br> yang dipertahankan, di kedalaman berapa pun.
// Membersihkan dari dalam ke luar (anak dibersihkan dulu) supaya elemen terlarang yang bersarang di dalam <u> ikut terbongkar.
export function sanitizePromptHTML(value) {
  const clean = node => {
    const out = document.createDocumentFragment();
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) { out.appendChild(child.cloneNode()); return; }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const tag = child.tagName.toLowerCase(), inner = clean(child);
      if (tag === 'u' || tag === 'br') { const el = document.createElement(tag); el.appendChild(inner); out.appendChild(el); }
      else out.appendChild(inner);
    });
    return out;
  };
  const t = document.createElement('template'); t.innerHTML = String(value || '');
  const div = document.createElement('div'); div.appendChild(clean(t.content));
  return div.innerHTML;
}
export function formatAnswer(v, type) { if (!v) return ''; if (type === 'matching') { const o = parseJSON(v, {}); return Object.entries(o).map(([a, b]) => `${a} = ${b}`).join(', '); } return String(v); }

// Satu kartu jawaban (dipakai baik untuk soal PDF maupun soal biasa yang bukan PDF).
function plainItemHTML(x, i) {
  const expl = x.explanation ? `<div class="review-expl">📝 <b>Penjelasan:</b> ${sanitizePromptHTML(x.explanation)}</div>` : '<div class="review-expl review-no-expl">📝 Penjelasan belum tersedia.</div>';
  const photo = x.photo_url ? `<div class="review-media"><span>📷 Foto soal</span><a href="${esc(x.photo_url)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(x.photo_url)}" alt="Foto soal ${i+1}" onerror="this.closest('.review-media')?.classList.add('media-failed')"></a></div>` : '';
  const audio = x.audio_url && !x.sheet_page_url ? `<div class="review-audio">🔊 Audio soal <audio controls preload="none" src="${esc(x.audio_url)}"></audio></div>` : '';
  return `<article class="review ${x.ok ? 'ok' : 'bad'}"><span class="review-pill">${x.ok ? '✅ Benar' : '❌ Salah'}</span><b>${i + 1}. ${sanitizePromptHTML(x.prompt)||'<span class="muted">Soal tidak tersimpan dalam riwayat lama</span>'}</b>${photo}${audio}<span>Jawaban kamu: ${esc(formatAnswer(x.user, x.type)) || '— (tidak dijawab)'}</span><span>Jawaban benar: ${esc(formatAnswer(x.answer, x.type))||'—'}</span><span class="review-status">${x.ok?'✅ Jawaban benar':'❌ Jawaban salah / tidak dijawab'}</span>${expl}</article>`;
}
// Daftar lengkap review (bukan soal PDF), dikelompokkan Benar/Salah — sama persis dengan halaman hasil milik user.
export function plainReviewHTML(reviews) {
  const okN = reviews.filter(x => x.ok).length;
  return `<div class="review-list"><p class="review-sum">✅ ${okN} benar · ❌ ${reviews.length - okN} salah atau kosong</p>${reviews.map((x, i) => plainItemHTML(x, i)).join('')}</div>`;
}

// Lingkaran nilai berwarna (skala tetap) + baris statistik Benar/Salah/Kosong, dipakai di daftar hasil (Admin & Akun).
export function scoreBadgeHTML(score) {
  const s = Number(score) || 0, c = s >= 90 ? '#f5c542' : s >= 70 ? '#4ade80' : s >= 50 ? '#60a5fa' : '#f87171';
  return `<span class="ures-score" style="--c:${c}">${s}</span>`;
}
export function statRowHTML({ correct = 0, wrong = 0, unanswered = 0, extra = '' }) {
  return `<p class="result-stats ures-stats"><span class="rs-ok">✅ Benar <b>${correct}</b></span><span class="rs-bad">❌ Salah <b>${wrong}</b></span><span class="rs-blank">➖ Kosong <b>${unanswered}</b></span>${extra ? `<span class="ures-extra">${extra}</span>` : ''}</p>`;
}
