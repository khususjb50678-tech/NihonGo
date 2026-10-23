// "Fitur Admin Tambahan": halaman Admin Utama untuk mengatur menu apa saja yang boleh dibuka tiap admin tambahan.
const SOAL = ['parts', 'questions', 'sheetpdf', 'quick'];
function toast(msg) {
  let el = document.querySelector('#spToast');
  if (!el) { el = document.createElement('div'); el.id = 'spToast'; el.className = 'sp-toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800);
}

export async function accessPage({ app, esc, supabase, items }) {
  const head = `<div class="admin-header"><div><div class="eyebrow">KHUSUS ADMIN UTAMA</div><h1>Fitur Admin Tambahan</h1>
    <p class="muted">Atur menu apa saja yang boleh dibuka tiap admin tambahan (Sensei). Menu Dashboard selalu ada. Menu khusus Admin Utama (Branding, Tampilan Kolom, Pengaturan Nilai, Peringatan Salin, Tambah Admin, Kerjain Teman, dan halaman ini) tidak bisa diberikan ke admin tambahan mana pun.</p></div></div>`;
  const { data, error } = await supabase.rpc('owner_list_admins');
  if (error) { app(`${head}<div class="card admin-card alert">${esc(/owner_list_admins|schema cache|does not exist/i.test(error.message) ? 'Jalankan supabase-akses-admin.sql di Supabase (SQL Editor) satu kali dulu.' : error.message)}</div>`); return; }
  const admins = (Array.isArray(data) ? data : []).filter(a => a.role !== 'owner');
  const keys = items.map(([k]) => k);
  const card = a => {
    const on = k => !Array.isArray(a.menus) || a.menus.includes(k);
    const n = Array.isArray(a.menus) ? keys.filter(k => a.menus.includes(k)).length : keys.length;
    return `<article class="card admin-card ak-card" data-u="${esc(a.user_id)}">
      <div class="sp-top"><b>${esc(a.name || a.email || 'Admin')}</b><span class="mode-pill">${Array.isArray(a.menus) ? n + ' dari ' + keys.length + ' menu' : 'Semua menu (bawaan)'}</span></div>
      <p class="muted" style="margin:0 0 8px">${esc(a.email || '')}</p>
      <div class="ak-grid">${items.map(([k, t]) => `<label class="ak-opt"><input type="checkbox" data-k="${k}" ${on(k) ? 'checked' : ''}>${esc(t)}</label>`).join('')}</div>
      <div class="kt-tools"><button type="button" class="btn sp-mini" data-pre="all">Pilih semua</button><button type="button" class="btn sp-mini" data-pre="soal">Hanya soal</button><button type="button" class="btn sp-mini" data-pre="none">Kosongkan</button></div>
      <div class="kt-actions"><button type="button" class="btn red" data-save>Simpan akses</button><button type="button" class="btn" data-reset>Kembalikan ke bawaan</button>${admins.length > 1 ? '<button type="button" class="btn" data-all>Terapkan ke semua Sensei</button>' : ''}</div>
    </article>`;
  };
  app(head + (admins.length ? admins.map(card).join('') : '<div class="card admin-card"><p class="muted">Belum ada admin tambahan. Tambahkan dulu lewat menu <b>Tambah Admin</b>.</p></div>'));

  const picked = el => [...el.querySelectorAll('[data-k]')].filter(i => i.checked).map(i => i.dataset.k);
  // Semua dicentang = "bawaan" (NULL), supaya menu baru di masa depan otomatis ikut.
  const toArg = list => list.length === keys.length ? null : list;
  const set = async (uid, list) => { const { error } = await supabase.rpc('owner_set_admin_menus', { p_user_id: uid, p_menus: toArg(list) }); if (error) throw new Error(error.message); };

  document.querySelectorAll('.ak-card').forEach(el => {
    const uid = el.dataset.u;
    el.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => {
      const m = b.dataset.pre;
      el.querySelectorAll('[data-k]').forEach(i => { i.checked = m === 'all' ? true : m === 'soal' ? SOAL.includes(i.dataset.k) : false; });
    });
    el.querySelector('[data-save]').onclick = async () => { try { await set(uid, picked(el)); toast('✓ Akses tersimpan'); accessPage({ app, esc, supabase, items }); } catch (e) { alert('Gagal menyimpan: ' + e.message); } };
    el.querySelector('[data-reset]').onclick = async () => { try { await set(uid, keys); toast('✓ Dikembalikan ke bawaan'); accessPage({ app, esc, supabase, items }); } catch (e) { alert('Gagal: ' + e.message); } };
    const all = el.querySelector('[data-all]');
    if (all) all.onclick = async () => {
      if (!confirm('Terapkan pilihan menu ini ke SEMUA admin tambahan?')) return;
      try { const list = picked(el); for (const a of admins) await set(a.user_id, list); toast('✓ Diterapkan ke semua Sensei'); accessPage({ app, esc, supabase, items }); } catch (e) { alert('Gagal: ' + e.message); }
    };
  });
}
