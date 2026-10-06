// Service worker sederhana: supaya Chrome menampilkan menu "Install aplikasi".
// Strategi network-first: selalu ambil versi terbaru dari internet, cache hanya dipakai saat offline,
// jadi perubahan dari GitHub tidak "tertahan" di cache lama.
const CACHE = 'itco-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      if (req.mode === 'navigate') { const home = await caches.match('./index.html'); if (home) return home; }
      return Response.error();
    })
  );
});
