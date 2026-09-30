(() => {
  const ADMIN_EMAIL = 'admin@belajarnnihongo.my.id';
  const ADMIN_PASSWORD = 'NihongoAdmin!2026';
  const form = document.getElementById('adminLogin');
  if (!form) return;
  if (localStorage.getItem('bn_admin_session') === '1') {
    const next = new URLSearchParams(location.search).get('next');
    location.replace(next || 'admin_index.html');
    return;
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const error = document.getElementById('loginError');
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      localStorage.setItem('bn_admin_session', '1');
      localStorage.setItem('bn_admin_email', email);
      const next = new URLSearchParams(location.search).get('next');
      location.replace(next || 'admin_index.html');
    } else {
      error.textContent = 'Email atau password admin salah.';
    }
  });
})();
