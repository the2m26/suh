import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ndbhgzohmjumicziefnr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYmhnem9obWp1bWljemllZm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NTE3OTYsImV4cCI6MjA5OTQyNzc5Nn0.6iDl7omVwM4_cp5zRFE-2lnl_Y6CBgTWO6JUPxmqu-g';

// ⚠️ 2026-08-02 засав: "Намайг сана" (Remember me)-г хэрэгжүүлэхдээ өмнө нь
// НЭВТРЭХ БүР ШИНЭ Supabase client үүсгэдэг байсан ("export let sb = ..." дахин
// оноолт) — үүнээс болж "Multiple GoTrueClient instances detected in the same
// browser context" анхааруулга гарч, ХЭД ХЭДЭН client НЭГ localStorage/session
// key дээр зэрэг бичиж/уншиж "тэмцэлддэг" болж, refresh token 400 алдаа,
// тохиргоо (Dark/Light г.м) чимээгүй хадгалагдахгүй байх зэрэг тайлбарлагдахгүй
// зан авир үүсгэж байсан гэж үзэж байна.
// Засвар: Client-ийг НЭГ Л УДАА үүсгэж, storage-ыг ДИНАМИК (getItem/setItem үед
// тухайн мөчид аль storage ашиглахаа шийддэг) объект болгож, "Намайг сана"
// солиход client дахин үүсгэхгүй, зүгээр л дотоод flag-ыг сольдог болгов.
let _rememberMe = localStorage.getItem('suh_remember_me') === '1';

const dynamicStorage = {
  getItem: (key) => (_rememberMe ? window.localStorage : window.sessionStorage).getItem(key),
  setItem: (key, value) => (_rememberMe ? window.localStorage : window.sessionStorage).setItem(key, value),
  removeItem: (key) => (_rememberMe ? window.localStorage : window.sessionStorage).removeItem(key),
};

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: dynamicStorage, persistSession: true },
});

// Нэвтрэх товч дарахаас ӨМНӨ дуудна: remember=true бол localStorage
// (browser хаагдсан ч сесс үлдэнэ), false бол sessionStorage (tab хаахад гарна).
// ⚠️ Client дахин үүсгэхгүй — зөвхөн дотоод flag-ыг л солино.
export function setRememberMe(remember) {
  _rememberMe = !!remember;
  localStorage.setItem('suh_remember_me', _rememberMe ? '1' : '0');
  return sb;
}
