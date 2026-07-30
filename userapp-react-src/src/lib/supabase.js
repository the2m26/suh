import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ndbhgzohmjumicziefnr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYmhnem9obWp1bWljemllZm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NTE3OTYsImV4cCI6MjA5OTQyNzc5Nn0.6iDl7omVwM4_cp5zRFE-2lnl_Y6CBgTWO6JUPxmqu-g';

// ⚠️ 2026-07-30: "Намайг сана" (Remember me) функцийг dist bundle-ээс дахин
// сэргээв — v8 үндэст энэ логик огт байгаагүй (энгийн createClient л байсан).
// export let ашигласнаар (ES module live binding) sb-г дахин үүсгэхэд бүх
// `import { sb } from '../lib/supabase'` хийсэн файл шинэ client-ийг харна.
export let sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: window.localStorage, persistSession: true },
});

// Нэвтрэх товч дарахаас ӨМНӨ дуудна: remember=true бол localStorage
// (browser хаагдсан ч сесс үлдэнэ), false бол sessionStorage (tab хаахад гарна).
export function setRememberMe(remember) {
  sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storage: remember ? window.localStorage : window.sessionStorage, persistSession: true },
  });
  return sb;
}
