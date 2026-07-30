// sw.js — "suh" мобайл апп-ийн Service Worker
// Зорилго: апп ХААЛТТАЙ үед ч Push мэдэгдлийг утсан дээр харуулах, мөн
// PWA badge (апп-ийн дүрс дээрх улаан тоо)-г шинэчлэх.
// ⚠️ 2026-07-30 засав: (1) icon зам "files/android-chrome-192x192.png" гэсэн
// БАЙХГүй фолдер луу заасан байсныг public/-д бодитоор байгаа файлын нэрээр
// (icon-192.png, favicon-32x32.png) сольсон; (2) push handler badge-г ХЭЗЭЭ Ч
// шинэчилдэггүй байсан тул апп хаалттай үед ирсэн push badge-д тусахгүй
// байсныг олж, self.registration.setAppBadge() дуудалт нэмэв.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ⚠️ Service Worker дахин ачаалагдах бүрд 0-ээс эхэлдэг, тул үнэн зөв
// тоо биш ч, апп хаалттай үед "шинэ зүйл ирсэн" гэдгийг л илэрхийлнэ —
// апп нээгдэх бүрд React тал (App.jsx) бодит тоог дахин тооцоолж засна.
let pendingBadgeCount = 0;

// Push эвент ирэхэд — мэдэгдлийг систем рүү (утасны notification tray) харуулж,
// PWA badge-ийг нэмэгдүүлнэ
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
  pendingBadgeCount++;
  event.waitUntil(Promise.all([
    self.registration.showNotification(data.title || 'СӨХ — Шинэ мэдэгдэл', options),
    ('setAppBadge' in self.registration) ? self.registration.setAppBadge(pendingBadgeCount).catch(() => {}) : Promise.resolve(),
  ]));
});

// Мэдэгдэл дээр товшиход — апп руу шилжүүлэх (аль хэдийн нээлттэй tab байвал түүнийг фокуслана)
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
