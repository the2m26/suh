// sw.js — "suh" мобайл апп-ийн Service Worker
// Зорилго: апп ХААЛТТАЙ vед ч Push мэдэгдлийг утсан дээр харуулах.
// ⚠️ Энэ файл userapp.html-тэй ЯГ НЭГ (root) хавтаст байрлах ёстой —
// service worker-ийн "scope" нь өөрийнхөө байрлалаас доош vйлчилдэг.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push эвент ирэхэд — мэдэгдлийг систем рvv (утасны notification tray) харуулна
self.addEventListener('push', (event) => {
  let data = { title: 'СӨХ — Шинэ мэдэгдэл', body: '', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  const options = {
    body: data.body || '',
    icon: 'files/android-chrome-192x192.png',
    badge: 'files/favicon-32x32.png',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification(data.title || 'СӨХ — Шинэ мэдэгдэл', options));
});

// Мэдэгдэл дээр товшиход — апп руу шилжvvлэх (аль хэдийн нээлттэй tab байвал тvvнийг фокуслана)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
