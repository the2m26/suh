import { sb } from './supabase';

// newseditor.js-ийн _newsMediaPathFromUrl()/_deleteNewsMediaByUrl() (мөр
// ~200-215) — Supabase Storage-ийн "news-media" bucket-тэй ажиллах туслах.

export function newsMediaPathFromUrl(url) {
  if (!url) return null;
  const marker = '/storage/v1/object/public/news-media/';
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

export async function deleteNewsMediaByUrl(url) {
  const path = newsMediaPathFromUrl(url);
  if (!path) return;
  const { error } = await sb.storage.from('news-media').remove([path]);
  if (error) console.error('news-media устгахад алдаа:', path, error);
}

export async function uploadNewsPhoto(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from('news-media').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data: pub } = sb.storage.from('news-media').getPublicUrl(path);
  return pub.publicUrl;
}

export async function uploadNewsPdf(file) {
  const path = `pdf/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const { error } = await sb.storage.from('news-media').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data: pub } = sb.storage.from('news-media').getPublicUrl(path);
  return pub.publicUrl;
}
