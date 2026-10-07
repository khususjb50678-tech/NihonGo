// Akun pengguna: daftar + masuk (Supabase Auth, email + password).
import { supabase, sbReady } from './supabase.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export async function currentUser() {
  if (!sbReady) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
}

export function userName(u) {
  return String(u?.user_metadata?.name || '').trim() || String(u?.email || '').split('@')[0] || '';
}

// Pesan error Supabase -> bahasa Indonesia yang mudah dipahami.
export function authMessage(err) {
  const m = String(err?.message || err || '').toLowerCase();
  if (m.includes('invalid login')) return 'Email atau password salah.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Email ini sudah terdaftar. Silakan masuk.';
  if (m.includes('email not confirmed')) return 'Email belum dikonfirmasi. Cek kotak masuk emailmu.';
  if (m.includes('password') && (m.includes('least') || m.includes('weak') || m.includes('short'))) return 'Password terlalu pendek. Gunakan minimal 6 karakter.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  if (m.includes('valid email') || m.includes('invalid email') || m.includes('email address') && m.includes('invalid')) return 'Format email tidak valid.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Pendaftaran akun sedang ditutup oleh Admin.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Tidak bisa terhubung ke server. Cek koneksi internetmu.';
  return 'Terjadi kesalahan: ' + (err?.message || 'coba lagi');
}

// Layar masuk / daftar. onSuccess(user) dipanggil setelah berhasil.
export function renderAuth(root, brand, onSuccess) {
  const b = brand || {};
  const logo = b.logo_url
    ? `<img src="${esc(b.logo_url)}" alt="" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{textContent:'⛩'}))">`
    : '<span>⛩</span>';
  let mode = 'login';

  const draw = (notice = '') => {
    const reg = mode === 'register';
    root.innerHTML = `<div class="auth-wrap"><div class="auth-card">
      <div class="auth-logo">${logo}</div>
      <h1 class="auth-title">${esc(b.site_name || 'ITCO JAPAN')}</h1>
      <p class="auth-sub">${esc(b.corporate_name || 'TOP CORPORATION')}</p>
      <div class="auth-tabs" role="tablist"><button type="button" role="tab" class="${reg ? '' : 'on'}" data-mode="login" aria-selected="${!reg}">Masuk</button><button type="button" role="tab" class="${reg ? 'on' : ''}" data-mode="register" aria-selected="${reg}">Daftar</button></div>
      <p class="auth-hint">${reg ? 'Buat akunmu dulu supaya bisa belajar dan latihan.' : 'Masuk dengan akun yang sudah kamu daftarkan.'}</p>
      <div class="auth-notice" id="authNotice" role="alert">${esc(notice)}</div>
      <form id="authForm" class="auth-form" novalidate>
        ${reg ? '<label>Nama<input class="input" id="auName" autocomplete="name" maxlength="60" placeholder="Nama lengkapmu"></label>' : ''}
        <label>Email<input class="input" id="auEmail" type="email" inputmode="email" autocomplete="email" placeholder="nama@email.com"></label>
        <label>Password<span class="auth-pass"><input class="input" id="auPass" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="${reg ? 'Minimal 6 karakter' : 'Password'}"><button type="button" class="auth-eye" id="auEye" aria-label="Tampilkan password">Lihat</button></span></label>
        ${reg ? '<label>Ulangi password<input class="input" id="auPass2" type="password" autocomplete="new-password" placeholder="Ketik ulang password"></label>' : ''}
        <button class="btn red fullbtn" type="submit" id="auSubmit">${reg ? 'Buat akun' : 'Masuk'}</button>
      </form>
      <p class="auth-switch">${reg ? 'Sudah punya akun?' : 'Belum punya akun?'} <button type="button" data-mode="${reg ? 'login' : 'register'}">${reg ? 'Masuk' : 'Daftar di sini'}</button></p>
    </div></div>`;

    root.querySelectorAll('[data-mode]').forEach(x => x.onclick = () => { mode = x.dataset.mode; draw(); });
    const notice$ = root.querySelector('#authNotice');
    const pass = root.querySelector('#auPass');
    root.querySelector('#auEye').onclick = e => {
      const show = pass.type === 'password';
      pass.type = show ? 'text' : 'password';
      const p2 = root.querySelector('#auPass2'); if (p2) p2.type = pass.type;
      e.currentTarget.textContent = show ? 'Sembunyi' : 'Lihat';
    };
    const fail = (m, el) => { notice$.textContent = m; notice$.classList.add('err'); el?.focus(); };

    root.querySelector('#authForm').onsubmit = async e => {
      e.preventDefault();
      notice$.textContent = ''; notice$.classList.remove('err');
      const email = root.querySelector('#auEmail').value.trim();
      const password = pass.value;
      const btn = root.querySelector('#auSubmit');
      let name = '';
      if (reg) {
        name = root.querySelector('#auName').value.trim();
        if (!name) return fail('Nama wajib diisi.', root.querySelector('#auName'));
      }
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) return fail('Isi email dengan benar.', root.querySelector('#auEmail'));
      if (!password) return fail('Password wajib diisi.', pass);
      if (reg) {
        if (password.length < 6) return fail('Password minimal 6 karakter.', pass);
        if (password !== root.querySelector('#auPass2').value) return fail('Kedua password belum sama.', root.querySelector('#auPass2'));
      }
      btn.disabled = true; const label = btn.textContent; btn.textContent = 'Memproses…';
      try {
        if (reg) {
          const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
          if (error) throw error;
          if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('already registered');
          if (data.session) return onSuccess(data.session.user);
          mode = 'login';
          return draw('Akun berhasil dibuat. Cek emailmu untuk konfirmasi, lalu masuk.');
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess(data.user);
      } catch (err) {
        fail(authMessage(err));
        btn.disabled = false; btn.textContent = label;
      }
    };
  };
  draw();
}
