// Soal PDF "mirip asli": tiap halaman PDF difoto, lalu dipotong per soal.
// User cukup membaca gambar soal lalu klik A/B/C di bawahnya. Ikon suara (kode 【Y15-10】) bisa diputar.
import { loadPdfJs } from './pdfsoal.js';
const SC = 2.2, CIRC = '①②③④⑤⑥⑦⑧';
const T = s => String(s || '').normalize('NFKC');
const CHOICES = { abc: ['a','b','c'], abcd: ['a','b','c','d'], ab: ['a','b'], marks: ['○','×'] };
const CT_LABEL = { abc: 'A B C', abcd: 'A B C D', ab: 'A B', marks: '○ ×' };
const cl = v => Math.max(0, Math.min(1, v));
const DEF_HOT = { x: .03, y: .2, w: .085, h: .25 };
function tapHot(img, ev) {
  const r = img.getBoundingClientRect(), cx = (ev.clientX - r.left) / r.width, cy = (ev.clientY - r.top) / r.height;
  const w = .085, h = Math.min(.9, w * img.naturalWidth / Math.max(1, img.naturalHeight));
  return { x: Math.min(cl(cx - w / 2), 1 - w), y: Math.min(cl(cy - h / 2), 1 - h), w, h };
}
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

async function cropBlob(cv, y0, y1) {
  const W = cv.width, x0 = Math.round(W * .055), w = Math.round(W * .91);
  y0 = Math.max(0, Math.round(y0)); y1 = Math.min(cv.height, Math.round(y1));
  const h = Math.max(8, y1 - y0), c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(cv, x0, y0, w, h, 0, 0, w, h);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
  return { blob, x0, w0: w, y0, h };
}

// Posisi pasangan kurung （ ） pada satu baris -> kotak jawaban (relatif terhadap halaman, 0..1)
function parenSlots(line, W, H) {
  const chars = [];
  for (const it of line.items) { const n = it.s.length || 1; for (let k = 0; k < it.s.length; k++) chars.push({ c: it.s[k], x0: it.x + it.w * k / n, x1: it.x + it.w * (k + 1) / n }); }
  const out = []; let open = null;
  for (const ch of chars) { if (/[（(]/.test(ch.c)) open = ch; else if (/[）)]/.test(ch.c) && open) { out.push({ x0: open.x0, x1: ch.x1 }); open = null; } }
  const h = line.fs * 1.25 / H, cy = (line.y - line.fs * .35) / H;
  return out.map(o => ({ x: cl(o.x0 / W), y: cl(cy - h / 2), w: Math.min(1, (o.x1 - o.x0) / W), h }));
}
const hotPage = g => g.hot ? { x: (g.crop.x0 + g.hot.x * g.crop.w0) / g.W, y: (g.crop.y0 + g.hot.y * g.crop.h) / g.H, w: g.hot.w * g.crop.w0 / g.W, h: g.hot.h * g.crop.h / g.H } : null;
const slotOf = (g, b) => g.slots[b] || { x: .72, y: Math.min(.97, (g.crop.y0 + g.crop.h) / g.H - .02 - (b - g.slots.length) * .03), w: .2, h: .02 };

// Membaca PDF: foto tiap halaman + posisi teks -> potongan per soal.
export async function analyzePdf(file, onProgress) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const groups = [], pages = {}; let curSec = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress && onProgress(p, pdf.numPages);
    const page = await pdf.getPage(p), vp = page.getViewport({ scale: SC });
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    const W = cv.width, H = cv.height, tc = await page.getTextContent(), rows = [];
    for (const it of tc.items) {
      if (!String(it.str || '').trim()) continue;
      const fs = Math.abs(it.transform[3]) || it.height || 0; if (fs < 8) continue; // lewati furigana kecil
      const [px, py] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
      let r = rows.find(r => Math.abs(r.y - py) <= 5); if (!r) { r = { y: py, fs: 0, items: [] }; rows.push(r); }
      r.fs = Math.max(r.fs, fs * SC); r.items.push({ x: px, w: (it.width || 0) * SC, s: it.str });
    }
    const lines = rows.map(r => {
      r.items.sort((a, b) => a.x - b.x);
      return { y: r.y, fs: r.fs, items: r.items, top: r.y - r.fs * .95, bottom: r.y + r.fs * .3, x0: r.items[0].x, x1: Math.max(...r.items.map(i => i.x + i.w)),
        text: T(r.items.map(i => i.s).join(' ')).replace(/\s+/g, ' ').trim() };
    }).sort((a, b) => a.top - b.top);
    let ftop = H;
    for (const l of lines) if (l.top > H * .8 && (/japan\s*foundation/i.test(l.text) || (/^\d{1,2}$/.test(l.text) && l.top > H * .88))) ftop = Math.min(ftop, l.top - 3 * SC);
    const mk = []; let m;
    for (const l of lines) {
      if (l.top >= ftop) continue;
      if (l.x0 < W * .22 && (m = l.text.match(/^(\d{1,2})\s*\.(?!\d)/))) mk.push({ kind: 'sec', no: +m[1], l });
      else if ((m = l.text.match(/^\(\s*(\d{1,2})\s*\)/))) mk.push({ kind: 'item', no: +m[1], l });
    }
    const PAD = 14 * SC;
    const reg = mk.map((k, i) => {
      const start = Math.max(0, k.l.top - PAD);
      let end = i + 1 < mk.length ? Math.max(start + 20, mk[i + 1].l.top - PAD) : ftop;
      if (i === mk.length - 1) {
        const inr = lines.filter(l => l.top >= k.l.top - 2 && l.top < ftop && !/^\d{1,3}$/.test(l.text.replace(/\s/g, '')));
        if (inr.length) end = Math.min(end, Math.max(...inr.map(l => l.bottom)) + 20 * SC);
      }
      return { k, start, end };
    });
    for (let i = 0; i < reg.length; i++) {
      const { k, start, end } = reg[i];
      if (k.kind === 'sec') { curSec = k.no; continue; }
      const c = await cropBlob(cv, start, end);
      const inr = lines.filter(l => l.top >= start && l.top < end), txt = inr.map(l => l.text).join('\n');
      const letters = new Set(); for (const mm of txt.matchAll(/(?:^|\s)([a-d])\s*\./g)) letters.add(mm[1]);
      const mx = letters.size ? Math.max(...[...letters].map(ch => ch.charCodeAt(0) - 96)) : 0;
      const marks = /○/.test(txt) && /×/.test(txt);
      const ctype = marks ? 'marks' : mx >= 4 ? 'abcd' : mx === 2 ? 'ab' : 'abc';
      let blanks = Math.max(1, inr.filter(l => /答\s*え\s*\(/.test(l.text)).length);
      if (marks) { const bl = [...inr].reverse().find(l => /^[\s()]+$/.test(l.text)); blanks = bl ? Math.max(1, (bl.text.match(/\(/g) || []).length) : 4; }
      let hot = null; const al = inr.find(l => /Y\s*\d{1,3}\s*[^\d\s]?\s*\d{1,3}/.test(l.text));
      if (al) {
        const hx0 = al.x0 - 54 * SC, hx1 = al.x1 + 6 * SC, hy0 = al.y - 26 * SC, hy1 = al.y + 14 * SC;
        const x = cl((hx0 - c.x0) / c.w0), y = cl((hy0 - c.y0) / c.h);
        hot = { x, y, w: Math.min(1 - x, (hx1 - hx0) / c.w0), h: Math.min(1 - y, (hy1 - hy0) / c.h) };
      }
      const slotLines = inr.filter(l => /答\s*え\s*\(/.test(l.text)); let slots = [];
      if (marks) { const bl = [...inr].reverse().find(l => /^[\s()]+$/.test(l.text)); if (bl) slots = parenSlots(bl, W, H); }
      else slotLines.forEach(l => { const ps = parenSlots(l, W, H); if (ps.length) slots.push(ps[ps.length - 1]); });
      groups.push({ id: uid(), page: p, sec: curSec, no: k.no, blob: c.blob, url: URL.createObjectURL(c.blob),
        W, H, crop: { x0: c.x0, y0: c.y0, w0: c.w0, h: c.h }, slots, blanks, ctype, hot, audioFile: null, keys: [], include: true });
    }
    if (groups.some(g => g.page === p)) { const pb = await new Promise(r => cv.toBlob(r, 'image/jpeg', .82)); pages[p] = { blob: pb, W, H }; }
  }
  return { groups, pages, count: pdf.numPages };
}

const labelOf = g => `Hal ${g.page} · Soal ${g.sec}-(${g.no})`;
const hotHTML = (h) => h ? `<span class="sheet-hot" style="left:${h.x * 100}%;top:${h.y * 100}%;width:${h.w * 100}%;height:${h.h * 100}%" title="Area ikon suara"></span>` : '';

function cardHTML(g, i, esc) {
  const ch = CHOICES[g.ctype];
  const keys = Array.from({ length: g.blanks }, (_, b) => `<div class="sp-key"><span>${g.blanks > 1 ? (g.ctype === 'marks' ? 'Gambar ' : 'Jawaban ') + CIRC[b] : 'Jawaban benar'}</span>${ch.map(v => `<label class="sp-opt${g.keys[b] === v ? ' on' : ''}"><input type="radio" name="k${i}_${b}" value="${esc(v)}" data-k="${i}" data-b="${b}" ${g.keys[b] === v ? 'checked' : ''}>${g.ctype === 'marks' ? v : v.toUpperCase()}</label>`).join('')}</div>`).join('');
  return `<article class="card admin-card sp-card" data-g="${i}">
    <div class="sp-top"><label><input type="checkbox" data-inc="${i}" ${g.include ? 'checked' : ''}> Masukkan</label><b>${esc(labelOf(g))}</b></div>
    <div class="sp-img"><img src="${g.url}" alt="">${hotHTML(g.hot)}</div>
    <div class="sp-ctrl">
      <label>Jumlah jawaban <input class="input" type="number" min="1" max="8" value="${g.blanks}" data-bl="${i}"></label>
      <label>Pilihan <select class="input" data-ct="${i}">${Object.keys(CHOICES).map(k => `<option value="${k}" ${g.ctype === k ? 'selected' : ''}>${CT_LABEL[k]}</option>`).join('')}</select></label>
    </div>
    ${keys}
    <p class="muted" style="margin:6px 0">🔊 Soal ini ada audio? Ketuk gambar tepat di ikon suara untuk menandai posisinya, lalu pilih audio.</p>
    <label class="btn sp-audio">🔊 ${g.audioFile ? esc(g.audioFile.name) : 'Pilih audio dari HP'}<input hidden type="file" accept="audio/*" data-au="${i}"></label>
  </article>`;
}

async function upl(supabase, path, blob, type) {
  const up = await supabase.storage.from('media').upload(path, blob, { upsert: true, contentType: type || undefined, cacheControl: '31536000' });
  if (up.error) throw new Error(up.error.message);
  return supabase.storage.from('media').getPublicUrl(path).data?.publicUrl || '';
}

export async function sheetPdfPage({ app, esc, supabase }) {
  const { data: parts } = await supabase.from('parts').select('*').order('part_number');
  app(`<div class="admin-header"><div><div class="eyebrow">LATIHAN</div><h1>Soal PDF (Mirip Asli)</h1>
    <p class="muted">Upload PDF: tiap halaman difoto utuh. User menggulir halaman dari atas ke bawah seperti PDF, lalu mengetuk kotak jawaban untuk memilih A/B/C. Kamu tinggal memilih jawaban yang benar, dan memasang audio (dari file HP) untuk soal yang punya ikon suara.</p></div></div>
    <div class="card admin-card"><label>Part tujuan<select class="input" id="spPart">${(parts || []).map(p => `<option value="${p.id}">Part ${p.part_number} — ${esc(p.name)}</option>`).join('')}</select></label>
    <label>File PDF soal<input type="file" accept="application/pdf" id="spFile" class="input"></label><div id="spOut"></div></div>
    <div id="spExisting"></div>`);
  const partSel = document.querySelector('#spPart'), out = document.querySelector('#spOut'), ex = document.querySelector('#spExisting');
  let G = [], PG = {}; const HOT = {};
  partSel.onchange = () => listExisting();
  listExisting();

  document.querySelector('#spFile').onchange = async e => {
    const f = e.target.files?.[0]; if (!f) return;
    out.innerHTML = '<p class="muted">Membaca PDF…</p>';
    try {
      const r = await analyzePdf(f, (p, n) => { out.innerHTML = `<p class="muted">Memfoto halaman ${p} dari ${n}…</p>`; });
      G = r.groups; PG = r.pages;
      if (!G.length) { out.innerHTML = '<p class="muted">Tidak ada soal terdeteksi. Pastikan PDF berisi teks (bukan hasil scan) dan nomor soal berbentuk （１）（２）…</p>'; return; }
      const html = G.map((g, i) => cardHTML(g, i, esc)).join('');
      out.innerHTML = `<p><b>${G.length} soal terdeteksi dari ${r.count} halaman.</b> Periksa gambar, jumlah jawaban, dan pilih jawaban yang benar. Matikan "Masukkan" untuk soal yang tidak dipakai.</p>${html}<button class="btn red fullbtn" id="spSave" type="button">Simpan ke Part</button><p id="spMsg" class="muted"></p>`;
      document.querySelector('#spSave').onclick = save;
    } catch (err) { out.innerHTML = `<p class="muted">${esc(err.message || err)}</p>`; }
  };

  const redraw = i => { const el = out.querySelector(`[data-g="${i}"]`); if (el) el.outerHTML = cardHTML(G[i], i, esc); };
  out.addEventListener('change', e => {
    const t = e.target, d = t.dataset;
    if (d.inc != null) G[d.inc].include = t.checked;
    else if (d.bl != null) { const g = G[d.bl]; g.blanks = Math.max(1, Math.min(8, +t.value || 1)); g.keys.length = Math.min(g.keys.length, g.blanks); redraw(d.bl); }
    else if (d.ct != null) { const g = G[d.ct]; g.ctype = t.value; g.keys = []; redraw(d.ct); }
    else if (d.k != null) { G[d.k].keys[+d.b] = t.value; t.closest('.sp-key').querySelectorAll('.sp-opt').forEach(l => l.classList.toggle('on', l.contains(t))); }
    else if (d.au != null) { G[d.au].audioFile = t.files?.[0] || null; redraw(d.au); }
  });

  out.addEventListener('click', e => {
    const im = e.target.closest('.sp-img img'), card = im && im.closest('[data-g]'); if (!card) return;
    const i = +card.dataset.g; G[i].hot = tapHot(im, e); redraw(i);
  });

  async function save() {
    const msg = document.querySelector('#spMsg'), btn = document.querySelector('#spSave'), part = partSel.value;
    const use = G.filter(g => g.include);
    use.forEach(g => { if (g.audioFile && !g.hot) g.hot = { ...DEF_HOT }; });
    if (!use.length) return alert('Tidak ada soal yang dipilih.');
    const miss = use.filter(g => Array.from({ length: g.blanks }).some((_, b) => !g.keys[b]));
    if (miss.length) return alert(`Masih ada ${miss.length} soal tanpa jawaban benar, misalnya ${labelOf(miss[0])}. Lengkapi dulu.`);
    const noAudio = use.filter(g => g.hot && !g.audioFile);
    if (noAudio.length && !confirm(`${noAudio.length} soal punya ikon suara tetapi audionya belum dipilih. Tetap simpan? (Audio bisa ditambah nanti di daftar bawah.)`)) return;
    btn.disabled = true;
    try {
      const batch = Date.now().toString(36), pageUrl = {}, rows = [], base = Date.now();
      for (const p of [...new Set(use.map(g => g.page))]) { msg.textContent = `Mengunggah halaman ${p}…`; pageUrl[p] = await upl(supabase, `sheets/${batch}/page-${p}.jpg`, PG[p].blob, 'image/jpeg'); }
      let n = 0;
      for (let i = 0; i < use.length; i++) {
        const g = use[i]; msg.textContent = `Menyiapkan soal ${i + 1} dari ${use.length}…`;
        let aUrl = '';
        if (g.audioFile) aUrl = await upl(supabase, `sheets/${batch}/audio-${g.sec}-${g.no}-${Date.now()}-${g.audioFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`, g.audioFile, g.audioFile.type);
        const ch = CHOICES[g.ctype], hp = hotPage(g);
        for (let b = 0; b < g.blanks; b++) {
          n++;
          rows.push({ id: uid(), part_id: part, prompt: labelOf(g) + (g.blanks > 1 ? ` · ${CIRC[b]}` : ''), reading: '', instruction: '', type: 'multiple_choice', options: ch, answer: g.keys[b], active: true,
            created_at: new Date(base + n * 1000).toISOString(), source_page: g.page, q_number: n,
            sheet_page_url: pageUrl[g.page], sheet_slot: slotOf(g, b), sheet_hot: hp,
            sheet_label: g.blanks > 1 ? (g.ctype === 'marks' ? 'Gambar ' : 'Jawaban ') + CIRC[b] : '', sheet_group: batch, audio_url: aUrl || null });
        }
      }
      msg.textContent = 'Menyimpan soal…';
      let r = await supabase.from('questions').insert(rows);
      if (r.error && /source_page|q_number/.test(r.error.message)) r = await supabase.from('questions').insert(rows.map(({ source_page, q_number, ...x }) => x));
      if (r.error) throw new Error(/sheet_/.test(r.error.message) ? 'Kolom baru belum ada. Jalankan supabase-lembar-pdf.sql di Supabase (SQL Editor) satu kali, lalu coba lagi.' : r.error.message);
      alert(`${rows.length} jawaban dari ${use.length} soal tersimpan ke Part.`);
      out.innerHTML = ''; G = []; listExisting();
    } catch (err) { msg.textContent = ''; alert('Gagal menyimpan: ' + (err.message || err)); btn.disabled = false; }
  }

  async function listExisting() {
    const part = partSel.value;
    const { data, error } = await supabase.from('questions').select('*').eq('part_id', part).or('sheet_url.not.is.null,sheet_page_url.not.is.null').order('created_at');
    if (error) { ex.innerHTML = `<div class="card admin-card"><p class="muted">${esc(/sheet_/.test(error.message) ? 'Jalankan supabase-lembar-pdf.sql di Supabase (SQL Editor) satu kali dulu.' : error.message)}</p></div>`; return; }
    Object.keys(HOT).forEach(k => delete HOT[k]);
    const pages = new Map(), crops = new Map();
    (data || []).forEach(r => {
      if (r.sheet_page_url) { if (!pages.has(r.sheet_page_url)) pages.set(r.sheet_page_url, []); pages.get(r.sheet_page_url).push(r); }
      else { if (!crops.has(r.sheet_url)) { crops.set(r.sheet_url, []); HOT[r.sheet_url] = r.sheet_hot || null; } crops.get(r.sheet_url).push(r); }
    });
    const keyRow = (r, lab) => { const o = Array.isArray(r.options) ? r.options : ['a','b','c']; return `<div class="sp-key"><span>${lab}</span>${o.map(v => `<label class="sp-opt${r.answer === v ? ' on' : ''}"><input type="radio" name="e${r.id}" value="${esc(v)}" data-ek="${r.id}" ${r.answer === v ? 'checked' : ''}>${/[○×]/.test(v) ? v : v.toUpperCase()}</label>`).join('')}</div>`; };
    const pageCard = ([url, rs], n) => {
      const hg = new Map(); rs.forEach(r => { if (r.sheet_hot) { const k = JSON.stringify(r.sheet_hot); if (!hg.has(k)) hg.set(k, []); hg.get(k).push(r); } });
      const ov = rs.map(r => { const s = r.sheet_slot; return s ? `<span class="sp-slot" style="left:${s.x * 100}%;top:${s.y * 100}%;width:${s.w * 100}%;height:${s.h * 100}%"></span>` : ''; }).join('') + [...hg.keys()].map(k => hotHTML(JSON.parse(k))).join('');
      return `<article class="card admin-card sp-card" data-page="${esc(url)}"><div class="sp-top"><b>Halaman ${n} · ${rs.length} jawaban</b><button class="btn danger" type="button" data-delpage="${esc(url)}">Hapus halaman</button></div>
        <div class="sp-page"><img src="${esc(url)}" alt="" loading="lazy">${ov}</div>
        ${rs.map(r => keyRow(r, esc(r.prompt.replace(/^Hal \d+ · /, '')))).join('')}
        ${[...hg.values()].map(g => `<div class="sp-audio-row"><b>🔊 ${esc(g[0].prompt.replace(/^Hal \d+ · /, '').replace(/ · [①-⑧]$/, ''))}</b><br><label class="btn sp-audio">${g[0].audio_url ? 'Ganti audio' : 'Pilih audio dari HP'}<input hidden type="file" accept="audio/*" data-eaids="${g.map(r => r.id).join(',')}"></label>${g[0].audio_url ? `<audio controls preload="none" src="${esc(g[0].audio_url)}" style="width:100%;margin-top:8px"></audio>` : ''}</div>`).join('')}
      </article>`;
    };
    const cropCard = ([url, rs]) => `<article class="card admin-card sp-card" data-url="${esc(url)}">
      <div class="sp-top"><b>${esc(rs[0].prompt.replace(/ · [①-⑧]$/, ''))} <small>(format lama)</small></b><button class="btn danger" type="button" data-del="${esc(url)}">Hapus</button></div>
      <div class="sp-img"><img src="${esc(url)}" alt="" loading="lazy">${hotHTML(rs[0].sheet_hot)}</div>
      ${rs.map(r => keyRow(r, esc(r.sheet_label || 'Jawaban benar'))).join('')}
      <p class="muted" style="margin:6px 0">🔊 Soal ini ada audio? Ketuk gambar tepat di ikon suara untuk menandai posisinya (kotak merah), lalu pilih audio.</p>
      <label class="btn sp-audio">🔊 ${rs[0].audio_url ? 'Ganti audio' : 'Pilih audio dari HP'}<input hidden type="file" accept="audio/*" data-eau="${esc(url)}"></label>${rs[0].audio_url ? `<audio controls preload="none" src="${esc(rs[0].audio_url)}" style="width:100%;margin-top:8px"></audio>` : ''}
    </article>`;
    ex.innerHTML = `<div class="card admin-card"><h3>Soal PDF di Part ini (${(data || []).length} jawaban)</h3><p class="muted">Ubah jawaban benar dengan memilihnya, dan pasang audio di bawah halaman. Perubahan tersimpan otomatis. Kotak hijau = tempat user menjawab, kotak merah = ikon suara.</p></div>` + [...pages.entries()].map((e, i) => pageCard(e, i + 1)).join('') + [...crops.entries()].map(cropCard).join('');
  }
  ex.addEventListener('change', async e => {
    const t = e.target, d = t.dataset;
    if (d.ek) { const { error } = await supabase.from('questions').update({ answer: t.value }).eq('id', d.ek); if (error) return alert(error.message); t.closest('.sp-key').querySelectorAll('.sp-opt').forEach(l => l.classList.toggle('on', l.contains(t))); }
    else if (d.eaids && t.files?.[0]) {
      const f = t.files[0];
      try { const u = await upl(supabase, `sheets/audio/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`, f, f.type); const { error } = await supabase.from('questions').update({ audio_url: u }).in('id', d.eaids.split(',')); if (error) throw error; listExisting(); }
      catch (err) { alert('Audio gagal disimpan: ' + (err.message || err)); }
    }
    else if (d.eau && t.files?.[0]) {
      const f = t.files[0];
      try { const u = await upl(supabase, `sheets/audio/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`, f, f.type); const { error } = await supabase.from('questions').update({ audio_url: u, sheet_hot: HOT[d.eau] || { ...DEF_HOT } }).eq('sheet_url', d.eau).eq('part_id', partSel.value); if (error) throw error; listExisting(); }
      catch (err) { alert('Audio gagal disimpan: ' + (err.message || err)); }
    }
  });
  ex.addEventListener('click', async e => {
    const im = e.target.closest('.sp-img img'), card = im && im.closest('[data-url]');
    if (card) { const { error } = await supabase.from('questions').update({ sheet_hot: tapHot(im, e) }).eq('sheet_url', card.dataset.url).eq('part_id', partSel.value); if (error) return alert(error.message); return listExisting(); }
    const dp = e.target.closest('[data-delpage]');
    if (dp) { if (!confirm('Hapus halaman ini beserta soal-soalnya dari Part?')) return; const { error } = await supabase.from('questions').delete().eq('sheet_page_url', dp.dataset.delpage).eq('part_id', partSel.value); if (error) return alert(error.message); return listExisting(); }
    const b = e.target.closest('[data-del]'); if (!b || !confirm('Hapus soal ini dari Part?')) return;
    const { error } = await supabase.from('questions').delete().eq('sheet_url', b.dataset.del).eq('part_id', partSel.value);
    if (error) return alert(error.message); listExisting();
  });
}
