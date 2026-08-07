import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ndbhgzohmjumicziefnr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYmhnem9obWp1bWljemllZm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NTE3OTYsImV4cCI6MjA5OTQyNzc5Nn0.6iDl7omVwM4_cp5zRFE-2lnl_Y6CBgTWO6JUPxmqu-g';

// ⚠️ userapp-react дээр 2026-08-02-нд олдсон "Multiple GoTrueClient instances"
// алдаанаас сургамж авав: client-ийг НЭГ Л УДАА үүсгэж, "Намайг сана" (Remember me)
// солиход client дахин үүсгэхгүй — зөвхөн storage-ыг ДИНАМИК (getItem/setItem үед
// тухайн мөчид аль storage ашиглахаа шийддэг) объект болгож дотоод flag-ыг л сольдог.
let _rememberMe = localStorage.getItem('suh_admin_remember_me') === '1';

const dynamicStorage = {
  getItem: (key) => (_rememberMe ? window.localStorage : window.sessionStorage).getItem(key),
  setItem: (key, value) => (_rememberMe ? window.localStorage : window.sessionStorage).setItem(key, value),
  removeItem: (key) => (_rememberMe ? window.localStorage : window.sessionStorage).removeItem(key),
};

// ⚠️ suh.html (vanilla) болон энэ admin-react хоёр ӨӨР localStorage key
// (suh_admin_remember_me vs suh_remember_me) ашиглана — Supabase auth session key
// нь өөрөө URL-аас гардаг тул хоёр apps ижил project-д зэрэг нэвтэрсэн ч
// давхцахгүй, гэхдээ "Намайг сана" тохиргоо нь тус тусдаа хадгалагдана.
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: dynamicStorage, persistSession: true },
});

export function setRememberMe(remember) {
  _rememberMe = !!remember;
  localStorage.setItem('suh_admin_remember_me', _rememberMe ? '1' : '0');
  return sb;
}
