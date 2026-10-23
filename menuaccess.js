// Aturan menu admin: siapa boleh membuka menu apa. Dipisah supaya mudah diuji.
// Menu ini selalu khusus Admin Utama (dan dikunci juga di database), tidak bisa diberikan ke admin tambahan.
export const OWNER_ONLY = ['branding', 'tampilan', 'nilai', 'guard', 'admins', 'prank', 'access'];
export const ALWAYS = ['dashboard'];

// allowed = daftar menu yang diizinkan untuk admin tambahan (null / belum diatur = semua menu bawaan Sensei).
export function canOpen(key, role, allowed) {
  if (role === 'owner') return true;
  if (OWNER_ONLY.includes(key)) return false;
  if (ALWAYS.includes(key)) return true;
  return !Array.isArray(allowed) || allowed.includes(key);
}
export const visibleMenus = (all, role, allowed) => all.filter(([k]) => canOpen(k, role, allowed));
// Menu yang bisa diatur Admin Utama untuk admin tambahan.
export const grantable = all => all.filter(([k]) => !OWNER_ONLY.includes(k) && !ALWAYS.includes(k));
