const C = 'rankforge-shell-v320';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const sameOrigin = u.origin === location.origin;
  const cdn = /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(u.host);
  if (!sameOrigin && !cdn) return;
  e.respondWith(
    caches.open(C).then(async c => {
      const net = () => fetch(r).then(res => {
        if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone());
        return res;
      });
      if (sameOrigin) {
        const cached = await c.match(r, { ignoreSearch: true });
        return net().catch(() => cached);
      }
      const cached = await c.match(r);
      return cached || net();
    })
  );
});

