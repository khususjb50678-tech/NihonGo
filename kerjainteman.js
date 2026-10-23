// "Kerjain Teman": halaman admin (khusus Admin Utama) untuk mengirim kejutan foto/video/suara/teks ke user yang sedang membuka web.
import { supabase } from './supabase.js';
import { showPrank } from './prank-client.js';

const LIMIT_MB = { image: 8, video: 30, audio: 15 };
const fmt = d => new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function toast(msg) {
  let el = document.querySelector('#spToast');
  if (!el) { el = document.createElement('div'); el.id = 'spToast'; el.className = 'sp-toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800);
}
async function upload(file, kind) {
  const path = `prank/${Date.now()}-${kind}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const up = await supabase.storage.from('media').upload(path, file, { upsert: true, contentType: file.type || undefined, cacheControl: '31536000' });
  if (up.error) throw new Error(up.error.message);
  return supabase.storage.from('media').getPublicUrl(path).data?.publicUrl || '';
}

export async function prankPage({ app, esc }) {
  const { data: ud } = await supabase.rpc('admin_list_users');
  const users = (Array.isArray(ud) ? ud : []).sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || String(a.name || '').localeCompare(String(b.name || '')));
  const picked = new Set(), files = { image: null, video: null, audio: null };
  app(`<div class="admin-header"><div><div class="eyebrow">KHUSUS ADMIN UTAMA</div><h1>Kerjain Teman 😈</h1>
    <p class="muted">Kirim kejutan (foto, video, suara, teks) ke user yang sedang membuka web, di halaman mana pun. User selalu bisa menutupnya dengan tombol ✕, dan tampilannya diberi label "Pesan dari Admin".</p></div></div>
    <div class="card admin-card"><h3>1. Pilih target</h3>
      <label class="kt-row"><input type="radio" name="ktT" value="all" checked> Semua user (${users.length})</label>
      <label class="kt-row"><input type="radio" name="ktT" value="pick"> Pilih user tertentu</label>
      <div id="ktPick" hidden>
        <input class="input" id="ktSearch" placeholder="Cari nama / email">
        <div class="kt-tools"><button type="button" class="btn sp-mini" data-kt="online">Pilih yang online</button><button type="button" class="btn sp-mini" data-kt="all">Pilih semua</button><button type="button" class="btn sp-mini" data-kt="none">Kosongkan</button></div>
        <div class="kt-users" id="ktUsers"></div>
        <p class="muted" id="ktCount"></p>
      </div>
      <label>Berlaku selama (menit)<input class="input" id="ktExp" type="number" min="1" max="120" value="3"></label>
      <p class="muted">Kejutan hanya muncul pada user yang membuka web selama waktu ini. Yang sedang offline dan baru buka setelah waktunya habis tidak akan menerima.</p>
    </div>
    <div class="card admin-card"><h3>2. Isi kejutan</h3>
      <label>Judul (opsional)<input class="input" id="ktTitle" maxlength="80"></label>
      <label>Teks (opsional)<textarea class="input" id="ktBody" rows="3" maxlength="500"></textarea></label>
      <div class="kt-files">
        <label class="btn sp-audio">🖼 <span id="ktFi">Foto dari HP</span><input hidden type="file" accept="image/*" data-kf="image"></label>
        <label class="btn sp-audio">🎬 <span id="ktFv">Video dari HP</span><input hidden type="file" accept="video/*" data-kf="video"></label>
        <label class="btn sp-audio">🔊 <span id="ktFa">Suara dari HP</span><input hidden type="file" accept="audio/*" data-kf="audio"></label>
      </div>
      <label>Gaya tampil<select class="input" id="ktStyle"><option value="modal">Popup di tengah</option><option value="full">Layar penuh</option><option value="banner">Banner di atas</option></select></label>
      <label>Tutup otomatis setelah (detik, 0 = menunggu user menutup)<input class="input" id="ktAuto" type="number" min="0" max="120" value="0"></label>
      <div class="kt-actions"><button type="button" class="btn" id="ktPrev">👁 Pratinjau</button><button type="button" class="btn red" id="ktSend">🚀 Kirim sekarang</button></div>
      <p class="muted" id="ktMsg"></p>
    </div>
    <div class="card admin-card"><h3>Riwayat kiriman</h3><div id="ktHist"><p class="muted">Memuat…</p></div></div>`);

  const $ = s => document.querySelector(s), val = s => $(s).value.trim();
  const mode = () => document.querySelector('input[name="ktT"]:checked').value;

  const paintUsers = () => {
    const q = val('#ktSearch').toLowerCase();
    $('#ktUsers').innerHTML = users.filter(u => !q || String(u.name || '').toLowerCase().includes(q) || String(u.email || '').toLowerCase().includes(q)).map(u =>
      `<label class="kt-user"><input type="checkbox" data-u="${esc(u.user_id)}" ${picked.has(u.user_id) ? 'checked' : ''}><span><b>${esc(u.name || u.email || 'User')}</b><small>${esc(u.email || '')}${u.online ? ' · <i class="kt-on">● online</i>' : ''}${u.current_page ? ' · ' + esc(u.current_page) : ''}</small></span></label>`).join('') || '<p class="muted">Tidak ada user.</p>';
    $('#ktCount').textContent = `${picked.size} user dipilih`;
  };
  paintUsers();
  document.querySelectorAll('input[name="ktT"]').forEach(r => r.onchange = () => { $('#ktPick').hidden = mode() !== 'pick'; });
  $('#ktSearch').oninput = paintUsers;
  $('#ktUsers').onchange = e => { const id = e.target.dataset.u; if (!id) return; e.target.checked ? picked.add(id) : picked.delete(id); $('#ktCount').textContent = `${picked.size} user dipilih`; };
  document.querySelectorAll('[data-kt]').forEach(b => b.onclick = () => {
    const k = b.dataset.kt; if (k === 'none') picked.clear();
    else users.filter(u => k === 'all' || u.online).forEach(u => picked.add(u.user_id));
    paintUsers();
  });
  document.querySelectorAll('[data-kf]').forEach(inp => inp.onchange = () => {
    const kind = inp.dataset.kf, f = inp.files?.[0] || null;
    if (f && f.size > LIMIT_MB[kind] * 1024 * 1024) { alert(`Ukuran file terlalu besar. Maksimal ${LIMIT_MB[kind]} MB untuk ${kind === 'image' ? 'foto' : kind === 'video' ? 'video' : 'suara'}.`); inp.value = ''; return; }
    files[kind] = f; $(kind === 'image' ? '#ktFi' : kind === 'video' ? '#ktFv' : '#ktFa').textContent = f ? f.name : (kind === 'image' ? 'Foto dari HP' : kind === 'video' ? 'Video dari HP' : 'Suara dari HP');
  });

  const base = () => ({ title: val('#ktTitle'), body: val('#ktBody'), style: val('#ktStyle'), auto_close_sec: Math.max(0, Math.min(120, +$('#ktAuto').value || 0)) });
  const hasContent = m => m.title || m.body || files.image || files.video || files.audio;
  $('#ktPrev').onclick = () => {
    const m = base(); if (!hasContent(m)) return alert('Isi dulu teks, foto, video, atau suara.');
    showPrank({ ...m, image_url: files.image && URL.createObjectURL(files.image), video_url: files.video && URL.createObjectURL(files.video), audio_url: files.audio && URL.createObjectURL(files.audio) }, { preview: true });
  };
  $('#ktSend').onclick = async () => {
    const m = base(); if (!hasContent(m)) return alert('Isi dulu teks, foto, video, atau suara.');
    const all = mode() === 'all';
    if (!all && !picked.size) return alert('Pilih minimal satu user.');
    const who = all ? `SEMUA user (${users.length})` : `${picked.size} user terpilih`;
    if (!confirm(`Kirim kejutan ke ${who} sekarang?`)) return;
    const btn = $('#ktSend'), msg = $('#ktMsg'); btn.disabled = true;
    try {
      const row = { ...m, target_all: all, target_ids: all ? [] : [...picked], expires_at: new Date(Date.now() + Math.max(1, Math.min(120, +$('#ktExp').value || 3)) * 60000).toISOString() };
      for (const [kind, key] of [['image', 'image_url'], ['video', 'video_url'], ['audio', 'audio_url']]) if (files[kind]) { msg.textContent = `Mengunggah ${kind === 'image' ? 'foto' : kind === 'video' ? 'video' : 'suara'}…`; row[key] = await upload(files[kind], kind); }
      msg.textContent = 'Mengirim…';
      const { error } = await supabase.from('prank_messages').insert(row);
      if (error) throw new Error(/prank_messages|schema cache|does not exist/i.test(error.message) ? 'Jalankan supabase-kerjain-teman.sql di Supabase (SQL Editor) satu kali dulu.' : error.message);
      msg.textContent = ''; toast('✓ Terkirim'); history();
    } catch (err) { msg.textContent = ''; alert('Gagal mengirim: ' + (err.message || err)); }
    btn.disabled = false;
  };

  async function history() {
    const box = $('#ktHist'); if (!box) return;
    const { data, error } = await supabase.from('prank_messages').select('*').order('created_at', { ascending: false }).limit(15);
    if (error) { box.innerHTML = `<p class="muted">${esc(/prank_messages|schema cache|does not exist/i.test(error.message) ? 'Jalankan supabase-kerjain-teman.sql di Supabase (SQL Editor) satu kali dulu.' : error.message)}</p>`; return; }
    const rows = data || [], cnt = {};
    if (rows.length) { const r = await supabase.from('prank_receipts').select('message_id').in('message_id', rows.map(x => x.id)); (r.data || []).forEach(x => { cnt[x.message_id] = (cnt[x.message_id] || 0) + 1; }); }
    box.innerHTML = rows.map(r => {
      const live = r.active && new Date(r.expires_at) > new Date();
      const what = [r.title, r.body].filter(Boolean).join(' · ') || [r.image_url && 'foto', r.video_url && 'video', r.audio_url && 'suara'].filter(Boolean).join(', ');
      return `<div class="kt-hist"><div><b>${fmt(r.created_at)}</b> · ${r.target_all ? 'Semua user' : (r.target_ids || []).length + ' user'} · <i class="${live ? 'kt-on' : ''}">${live ? 'Aktif' : 'Selesai'}</i><br><small>${esc(what).slice(0, 120)}</small><br><small>Dilihat: ${cnt[r.id] || 0} orang</small></div>
        <div class="kt-hbtn">${live ? `<button type="button" class="btn sp-mini" data-stop="${r.id}">Hentikan</button>` : ''}<button type="button" class="btn sp-mini danger" data-rm="${r.id}">Hapus</button></div></div>`;
    }).join('') || '<p class="muted">Belum ada kiriman.</p>';
  }
  $('#ktHist').onclick = async e => {
    const st = e.target.closest('[data-stop]'), rm = e.target.closest('[data-rm]');
    if (st) { const { error } = await supabase.from('prank_messages').update({ active: false }).eq('id', st.dataset.stop); if (error) return alert(error.message); toast('✓ Dihentikan'); history(); }
    if (rm) { if (!confirm('Hapus kiriman ini dari riwayat?')) return; const { error } = await supabase.from('prank_messages').delete().eq('id', rm.dataset.rm); if (error) return alert(error.message); toast('✓ Dihapus'); history(); }
  };
  history();
}
