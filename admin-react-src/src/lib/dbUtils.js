import { sb } from './supabase';
import * as XLSX from 'xlsx';

// suh.html-ийн printCurrentPage()/exportTableToXlsx() (мөр ~6710-6726) — жагсаалтын
// хуудас бүрийн "Хэвлэх"/"Экспорт" товчны нийтлэг логик.
export function printCurrentPage() {
  window.print();
}

export function exportTableToXlsx(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) { alert('Хүснэгт олдсонгүй'); return; }
  try {
    const wb = XLSX.utils.table_to_book(table, { sheet: 'Sheet1', raw: true });
    XLSX.writeFile(wb, filename);
  } catch (e) {
    alert('Экспортод алдаа гарлаа: ' + e.message);
  }
}

// db.js-ийн triggerPushForRecipients() (мөр ~58) — send-push Edge Function
// дуудна, зөвхөн apt-той хүлээн авагчид үйлчилнэ. Алдаа гарвал зүгээр
// console-д бичээд үргэлжилнэ (гол үйл ажиллагааг зогсоохгүй).
export async function triggerPushForRecipients(recipientsWithTitle, fallbackTitle) {
  try {
    const apts = (recipientsWithTitle || [])
      .filter((r) => r.apt !== undefined && r.apt !== null && r.apt !== '')
      .map((r) => String(r.apt));
    if (!apts.length) {
      console.warn('triggerPushForRecipients: apt-той хүлээн авагч алга — push дуудахгүй');
      return;
    }
    const title = fallbackTitle || 'СӨХ — Шинэ мэдэгдэл';
    const body = recipientsWithTitle[0]?.content ? String(recipientsWithTitle[0].content).slice(0, 120) : '';
    const { error } = await sb.functions.invoke('send-push', { body: { apts, title, body } });
    if (error) console.error('send-push дуудахад алдаа:', error);
  } catch (e) {
    console.error('Push илгээхэд алдаа (үл хамаарна, гол үйлдэл үргэлжилнэ):', e);
  }
}

// db.js-ийн logActivity() (мөр ~78) — currentUser/currentProfile-г параметр
// болгосон (global биш) хувилбар.
export async function logActivity(currentUser, currentProfile, action, module, recordId, recordLabel, details) {
  try {
    const { error } = await sb.from('activity_log').insert({
      actor_id: currentUser?.id || null,
      actor_name: currentProfile?.full_name || currentUser?.email || null,
      actor_role: currentProfile?.role || null,
      action, module,
      record_id: recordId || null,
      record_label: recordLabel || null,
      details: details || null,
    });
    if (error) console.error('activity_log insert error:', error.message);
  } catch (e) {
    console.error('logActivity алдаа:', e);
  }
}
