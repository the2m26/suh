// db.js — Supabase холболт ба CRUD-ийн үндсэн орчуулагч (suh.html-ээс тусгаарлав)
// Хамаарал: SUPABASE_URL/SUPABASE_KEY/sb клиентийг энд тодорхойлно.
// Бусад БҮХ файл (buildings.js, businesses.js, finance.js, parking-storage.js,
// market-valuation.js, residents.js, assets.js, polls.js) энэ файлын `sb` глобал
// клиентийг ашигладаг тул ЭНЭ ФАЙЛ ХАМГИЙН ЭХЭНД ачаалагдах ёстой.
// db_init() нь бусад бүх модулийн db_load*() функцүүдийг дуудаж, эхний өгөгдлийг
// нэг дор ачаална — иймд db_init() өөрөө зөвхөн бүх script ачаалагдсаны ДАРАА
// (нэвтэрсний дараа) дуудагддаг тул load дараалал асуудалгүй.

// ============================================================
// SUPABASE ХОЛБОЛТ
// ============================================================
const SUPABASE_URL = 'https://ndbhgzohmjumicziefnr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYmhnem9obWp1bWljemllZm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NTE3OTYsImV4cCI6MjA5OTQyNzc5Nn0.6iDl7omVwM4_cp5zRFE-2lnl_Y6CBgTWO6JUPxmqu-g';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// #1 НЭГДСЭН АЛДАА БОЛОВСРУУЛАГЧ (2026-07-19 нэмэв)
// ============================================================
// Аудитаар: Supabase дуудлагуудын алдаа боловсруулалт файл бүрт өөр өөрөөр,
// заримдаа огт байхгүй байсныг олсон. Цаашид бүх ШИНЭ/засварлагдсан дуудлага
// энэ функцээр дамжина — хуучин ad-hoc `if(error){toast(...)}` хэвээрээ ажиллах
// тул нэг дороос дахин бичих шаардлагагүй, аажмаар шилжинэ.
//
// Ашиглах хэлбэр:
//   const {data, error} = await sb.from('...').select();
//   if (sbErr(error, 'Оршин суугч ачаалах')) return;
//
// context: хэрэглэгчид харагдах товч тайлбар (ж: "Хөрөнгө хадгалах")
// opts.silent: true бол toast харуулахгүй, зөвхөн console.error (уншилтын
//   дэвсгэр дуудлагад тохиромжтой, хэрэглэгчийг тасалдуулахгүй)
function sbErr(error, context, opts = {}) {
  if (!error) return false;
  console.error(`[${context}]`, error.message, error);
  if (!opts.silent && typeof toast === 'function') {
    toast(`${context}: алдаа гарлаа — ${error.message}`, 'error');
  }
  return true;
}

// ============================================================
// #2 ҮЙЛ АЖИЛЛАГААНЫ ТҮҮХ / ACTIVITY LOG (2026-07-19 нэмэв)
// ============================================================
// ⚠️ Ашиглахын өмнө Supabase дээр `activity_log` хүснэгэл + RLS policy үүсгэх
// шаардлагатай — SQL-ийг доор өгсөн, дэлгэрэнгүй тайлбарыг хариултаас үзнэ үү.
//
// Дуудах хэлбэр: save/delete амжилттай хийгдсэний ДАРАА, гол урсгалыг
// саатуулахгүйгээр (алдаа гарвал зөвхөн console-д, toast цацахгүй):
//   logActivity('add', 'residents', data.id, `${data.firstname} ${data.lastname}`);
//   logActivity('delete', 'assets', id, a.name);
async function logActivity(action, module, recordId, recordLabel, details) {
  try {
    const { error } = await sb.from('activity_log').insert({
      actor_id: currentUser?.id || null,
      actor_name: currentProfile?.full_name || currentUser?.email || null,
      actor_role: currentProfile?.role || null,
      action, module,
      record_id: recordId || null,
      record_label: recordLabel || null,
      details: details || null
    });
    if (error) console.error('activity_log insert error:', error.message);
  } catch (e) {
    console.error('activity_log insert exception:', e);
  }
}

// ⚠️ 2026-07-20: suh.html-ийн AUTH_ACTION_LABELS-тай ЯГ ИЖИЛ нэршил ашиглана
// (Хандах эрхийн тохиргооны товчнуудад бичигдсэн нэрсийг шууд авав) — "И-баримт"
// гэсэн үйлдэл үнэндээ байхгүй байсныг олж, зассан.
const ACTLOG_ACTION_LABELS = {
  add: 'Нэмэх', edit: 'Засах', delete: 'Устгах', print: 'Хэвлэх', export: 'Экспорт',
  payroll: 'Сарын цалин тооцох', invoice: 'Нэхэмжлэх илгээх',
  notify: 'Мэдэгдэл илгээх', payment: 'Төлбөр бүртгэх'
};
const ACTLOG_MODULE_LABELS = {
  dashboard: 'Хянах самбар', residents: 'Сууц өмчлөгч', businesses: 'Аж ахуйн нэгж',
  clientele: 'Харилцагч', transactions: 'Гүйлгээний бүртгэл', assets: 'Үндсэн хөрөнгө',
  payments: 'Төлбөр төлөлт', apartments: 'Тоот/Зогсоол/Агуулах', reports: 'Тайлан гаргах',
  gov_reports: 'Албан тайлан', notifications: 'Зар мэдэгдэл илгээх', polls: 'Сонгууль, санал асуулга',
  accounting: 'Нягтлан бодох бүртгэл', employees: 'Ажилтан', admin: 'Хаягжилт тохиргоо',
  'sokh-settings': 'СӨХ тохиргоо', 'tariff-settings': 'Тариф тохиргоо',
  'nbb-settings': 'НББ тохиргоо', 'asset-settings': 'Үндсэн хөрөнгө тохиргоо',
  'market-valuation': 'Зах зээлийн үнэлгээ', auth_levels: 'Хандах эрхийн тохиргоо',
  users: 'Хэрэглэгч удирдлага', 'app-settings': 'Апп тохиргоо'
};
async function renderActivityLogPage() {
  const el = document.getElementById('activity-log-table');
  if (!el) return;
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';
  const moduleFilter = document.getElementById('actlog-module-filter')?.value || '';
  const actionFilter = document.getElementById('actlog-action-filter')?.value || '';
  let q = sb.from('activity_log').select('*').order('created_at', { ascending: false }).limit(200);
  if (moduleFilter) q = q.eq('module', moduleFilter);
  if (actionFilter) q = q.eq('action', actionFilter);
  const { data, error } = await q;
  if (sbErr(error, 'Үйл ажиллагааны түүх ачаалах')) { el.innerHTML = '<div class="empty-state">Алдаа гарлаа</div>'; return; }
  if (!data || !data.length) { el.innerHTML = '<div class="empty-state">Бичлэг олдсонгүй</div>'; return; }
  el.innerHTML = `<table class="data-table">
    <thead><tr><th>Огноо, цаг</th><th>Хэн</th><th>Үйлдэл</th><th>Модуль</th><th>Объект</th></tr></thead>
    <tbody>${data.map(r => `
      <tr>
        <td class="dt-mono">${esc(new Date(r.created_at).toLocaleString('mn-MN'))}</td>
        <td class="dt-text">${esc(r.actor_name || '—')}${r.actor_role ? ` <span class="tag" style="font-size:10px">${esc(r.actor_role)}</span>` : ''}</td>
        <td class="dt-text">${esc(ACTLOG_ACTION_LABELS[r.action] || r.action)}</td>
        <td class="dt-muted">${esc(ACTLOG_MODULE_LABELS[r.module] || r.module)}</td>
        <td class="dt-text">${esc(r.record_label || '—')}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}
// --- INIT: бүх өгөгдөл ачаалах ---
async function db_init() {
  const loading = document.getElementById('db-loading');
  if(loading) loading.style.display='flex';
  try {
    // Buildings болон apt_types-г эхлээд ачаалах
    await db_loadBuildings();
    await db_loadAptTypes();
    await db_loadParkingTypes();
    await db_loadStorageTypes();

    await Promise.all([
      db_loadResidents(),
      db_loadBusinesses(),
      db_loadMarketValuations(),
      db_loadClientele(),
      db_loadAssets(),
      db_loadAssetSettings(),
      db_loadMaintenance(),
      db_loadTransactions(),
      db_loadSettings(),
      db_loadNotifications(),
      db_loadEmployees(),
      db_loadJobPositions(),
      db_loadIncomeSubcats()
    ]);
    // Аж ахуйн нэгжийн сарын төлбөрийг (Талбай × Тариф) БҮХ өгөгдөл (rentSettings
    // хамт) бүрэн ачаалагдсаны ДАРАА дахин тооцоолно — Promise.all зэрэг ажилладаг
    // тул businesses/settings аль нь эрт дуусахаас үл хамааран үргэлж зөв тариф
    // ашиглахыг баталгаажуулна (race condition-оос сэргийлнэ).
    businesses.forEach(b => { b.monthlyFee = computeBizFee(b); });
    syncAssetDepreciationSnapshots(); // background — sar bolgon snapshot-г тааруухан шинэчилнэ, UI-г хүлээлгэхгүй
    syncMonthlyDepreciationExpenses(); // background — элэгдлийг ledger-ийн бодит үлдэгдэлтэй харьцуулж, зөрүүг (gap) нөхнө
    if (typeof reconcileAssetPurchaseEntries === 'function') reconcileAssetPurchaseEntries(); // background — Excel импорт зэргээс болж дутуу үлдсэн худалдан авалтын бичилтийг нөхнө

    // nextId-г бодит өгөгдлийн хамгийн их ID-с давуулж тохируулах — DB-ийн бодит ID-тай мөргөлдөхөөс сэргийлнэ
    const allIds = [
      ...residents.map(r=>r.id), ...businesses.map(b=>b.id),
      ...transactions.map(t=>t.id), ...notifications.map(n=>n.id),
      ...assets.map(a=>a.id), ...employees.map(e=>e.id), ...clientele.map(c=>c.id)
    ].filter(id => typeof id === 'number' && !isNaN(id));
    if(allIds.length) nextId = Math.max(nextId, ...allIds) + 1;

    toast('Өгөгдөл ачаалагдлаа ✓','success');
  } catch(e) {
    console.error('DB init error:',e);
    toast('Өгөгдөл ачаалахад алдаа гарлаа','error');
  } finally {
    if(loading) loading.style.display='none';
  }
  refreshDashboard();
  onExpTypeChange();
  updateSidebarCount();
}
