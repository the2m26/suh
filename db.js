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
const SUPABASE_URL = 'https://vkkhwemfefgpbximudev.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZra2h3ZW1mZWZncGJ4aW11ZGV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MjgwNjUsImV4cCI6MjA5ODMwNDA2NX0.BluP4n2IkiEFEn5r-Fe6X8w3IRTAjzxxryHpHj3-NuU';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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
      db_loadJobPositions()
    ]);
    syncAssetDepreciationSnapshots(); // background — sar bolgon snapshot-г тааруухан шинэчилнэ, UI-г хүлээлгэхгүй
    syncMonthlyDepreciationExpenses(); // background — элэгдлийг ledger-ийн бодит үлдэгдэлтэй харьцуулж, зөрүүг (gap) нөхнө
    if (typeof reconcileAssetPurchaseEntries === 'function') reconcileAssetPurchaseEntries(); // background — Excel импорт зэргээс болж дутуу үлдсэн худалдан авалтын бичилтийг нөхнө

    // nextId-г бодит өгөгдлийн хамгийн их ID-с давуулж тохируулах — DB-ийн бодит ID-тай мөргөлдөхөөс сэргийлнэ
    const allIds = [
      ...residents.map(r=>r.id), ...businesses.map(b=>b.id),
      ...transactions.map(t=>t.id), ...notifications.map(n=>n.id)
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
