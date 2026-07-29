// sw.js — "suh" мобайл апп-ийн Service Worker
// Зорилго: апп ХААЛТТАЙ үед ч Push мэдэгдлийг утсан дээр харуулах.
// ⚠️ Энэ файл userapp.html-тэй ЯГ НЭГ (root) хавтаст байрлах ёстой —
// service worker-ийн "scope" нь өөрийнхөө байрлалаас доош үйлчилдэг.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push эвент ирэхэд — мэдэгдлийг систем рүү (утасны notification tray) харуулна
self.addEventListener('push', (event) => {
  let data = { title: 'СӨХ — Шинэ мэдэгдэл', body: '', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  const options = {
    body: data.body || '',
    icon: 'icon-192.png',
    badge: 'favicon-32x32.png',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'СӨХ — Шинэ мэдэгдэл', options).then(() =>
      // ⚠️ Апп ХААЛТТАЙ үед ч Home screen icон дээрх badge-ыг шууд тавина —
      // одоогоор ХАРАГДАЖ БУЙ (хараахан хаагдаагүй/дараагүй) мэдэгдлийн
      // тоог "уншаагүй" гэж тооцно.
      self.registration.getNotifications().then((list) => {
        if ('setAppBadge' in navigator) navigator.setAppBadge(list.length).catch(() => {});
      })
    )
  );
});

// Мэдэгдэл дээр товшиход — апп руу шилжүүлэх (аль хэдийн нээлттэй tab байвал түүнийг фокуслана)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    Promise.all([
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      }),
      self.registration.getNotifications().then((list) => {
        if ('setAppBadge' in navigator) {
          if (list.length > 0) navigator.setAppBadge(list.length).catch(() => {});
          else if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
        }
      }),
    ])
  );
});
