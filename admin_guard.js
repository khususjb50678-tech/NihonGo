(() => {
  if (localStorage.getItem('bn_admin_session') !== '1') {
    const next = encodeURIComponent(location.pathname.split('/').pop() || 'admin_index.html');
    location.replace(`admin_login.html?next=${next}`);
    return;
  }
  window.logoutAdmin = () => {
    localStorage.removeItem('bn_admin_session');
    localStorage.removeItem('bn_admin_email');
    location.replace('admin_login.html');
  };
})();
