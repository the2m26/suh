import { sb } from './supabase';

// ⚠️ userapp.html-ийн Push мэдэгдлийн логиктой ЯГ ИЖИЛ (VAPID, Service Worker,
// localStorage + Notification.permission давхар шалгуур).
const VAPID_PUBLIC_KEY = 'BAHU_k_7D1MVQSC5VlLga63Yr6ax1-dFHywpoo3uSrJVygt8sSQYDf_l5PZMzuyWU7Zg48rS6yITqIzb842ckME';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

let swRegistration = null;

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    // ⚠️ base замтай тохирч ажиллахын тулд sw.js-г import.meta.env.BASE_URL-аас олно.
    swRegistration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    return swRegistration;
  } catch (e) {
    console.error('Service Worker бүртгэхэд алдаа:', e);
    return null;
  }
}

export async function shouldShowPushBanner() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (Notification.permission === 'denied') return false;
  if (Notification.permission === 'granted') { localStorage.setItem('suh_push_enabled', '1'); return false; }
  if (localStorage.getItem('suh_push_dismissed') === '1') return false;
  if (localStorage.getItem('suh_push_enabled') === '1') return false;
  const reg = await registerServiceWorker();
  if (!reg) return false;
  const existing = await reg.pushManager.getSubscription();
  if (existing) { localStorage.setItem('suh_push_enabled', '1'); return false; }
  return true;
}

export function dismissPushBanner() {
  localStorage.setItem('suh_push_dismissed', '1');
}

export async function enablePush(userId) {
  const reg = swRegistration || await registerServiceWorker();
  if (!reg) return { ok: false, msg: 'Энэ browser Push дэмждэггүй' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, msg: 'Зөвшөөрөл өгөгдсөнгүй' };
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const subJson = sub.toJSON();
  const { error } = await sb.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: subJson.endpoint,
    p256dh: subJson.keys.p256dh,
    auth_key: subJson.keys.auth,
  }, { onConflict: 'user_id,endpoint' });
  if (error) return { ok: false, msg: 'Алдаа гарлаа — дахин оролдоно уу' };
  localStorage.setItem('suh_push_enabled', '1');
  return { ok: true };
}
