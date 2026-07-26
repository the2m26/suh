// finance.js — Гүйлгээ, Төлбөр, Тайлан, Тарифын тохиргооны модуль
// (suh.html-ээс тусгаарлав)
// Хамаарал: sb (db.js), residents/businesses/assets дата (тэдгээрийн модулиуд).

// ⚠️ 2026-07-20 нэмэв: Тариф тохиргооны талбаруудад "0" утга оруулахад
// `+val||default` хэлбэрийн код "0"-г falsy гэж андуурч үндсэн утга руу
// БУЦААДАГ (жиш: талбай "0" гэж оруулахад 210 хэвээрээ үлдэж, 0×210 биш
// 15000×210 гэж тооцогддог) байсан ноцтой алдааг үүнээр засав — "0" бол
// хүчинтэй тоо, зөвхөн ХООСОН эсвэл буруу утга үед л үндсэн утгыг ашиглана.
function _numField(id, def) {
  const el = document.getElementById(id);
  if (!el) return def;
  const raw = el.value;
  if (raw === '' || raw === null || raw === undefined) return def;
  const n = +raw;
  return isNaN(n) ? def : n;
}








// created_at (ISO timestamp)-аас Цаг:Минутыг задлана. Хуучин, бөөнөөр
// орсон демо дата (import хийсэн цагаа заана) ба шинээр UI-аас орсон
// гүйлгээ (жинхэнэ бүртгэсэн цагаа заана) хоёулаа адилхан ажиллана.
// "ХУГАЦАА" нэгдсэн багана — Огноо+Цаг+Минут+Секунд нэг мөрт
// YYYY/MM/DD HH/MM/SS форматаар (createdAt-аас бодит цагийг задална,
// байхгүй бол зөвхөн огноог харуулна).
function _fmtTxDateTime(t) {
  const dateSlash = _fmtDateSlash(t.date);
  if(!t.createdAt) return dateSlash;
  const d = new Date(t.createdAt);
  if(isNaN(d.getTime())) return dateSlash;
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  const ss = String(d.getSeconds()).padStart(2,'0');
  return `${dateSlash} ${hh}:${mm}:${ss}`;
}

// --- TRANSACTIONS ---
async function db_loadTransactions() {
  const {data,error} = await sb.from('transactions').select('*').order('id');
  if(error){console.error('transactions load error:', JSON.stringify(error), error.message);return;}
  if(!data){console.error('transactions: data is null');return;}
  transactions = data.filter(Boolean).map(t=>({
    id:t.id, apt:t.apt, aptId:t.resident_id, desc:t.description||'',
    subcat:t.subcat||'', type:t.type, amount:+t.amount, method:t.method||'',
    ref:t.ref||'', month:t.month, year:t.year, date:t.date||'', createdAt:t.created_at||null,
    status:t.status||'completed', category:t.category||'', clienteleId:t.clientele_id||null, assetId:t.asset_id||null, businessId:t.business_id||null
  }));
}
async function db_saveTransaction(t) {
  const row = {
    apt:t.apt||null,
    resident_id:t.aptId||null,
    description:t.description||t.desc||'',
    subcat:t.subcat, type:t.type, amount:t.amount, method:t.method,
    ref:t.ref, month:t.month, year:t.year, date:t.date,
    status:t.status, category:t.category, clientele_id:t.clienteleId||null,
    business_id:t.businessId||null, asset_id:t.assetId||null
  };
  const {data,error} = await sb.from('transactions').insert(row).select().single();
  if(error){console.error('transaction insert error:',error); return false;}
  t.id = data.id;
  return true;
}
// --- SETTINGS ---
async function db_loadSettings() {
  const {data,error} = await sb.from('settings').select('*');
  if(error){console.error('settings load error:', JSON.stringify(error), error.message);return;}
  if(!data){console.error('settings: data null');return;}
  data.forEach(s=>{
    if(s.key==='fee') Object.assign(feeSettings, s.value);
    if(s.key==='rent') Object.assign(rentSettings, s.value);
    if(s.key==='system_start' && s.value?.date) systemStartDate = s.value.date;
  });
}
async function db_saveSettings(key, value) {
  const {error} = await sb.from('settings').upsert({key, value, updated_at:new Date().toISOString()}, {onConflict:'key'});
  if(error) { console.error('settings save error:', error.message); return false; }
  return true;
}
// ============================================================
// DATA STORE
// ============================================================

// ⚠️ 2026-07-26 засав: perSqm/utility/garage/storageSqm/extra зэрэг тарифын
// ДvН-vvдийг ЭНЭ ОБЪЕКТООС АВАХГvй БОЛЛОО — тэдгээр нь одоо `fee_catalog`
// хvснэгэлд (Тариф тохиргоо → Тарифын каталог) мөр болгон хадгалагдана.
// feeSettings/rentSettings-д зөвхөн ХУГАЦААНЫ ХОЦРОГДЛЫН босго vлдлээ.
let feeSettings = {penalty: 2, fundAmount: 5000000, pendingMonths: 1, overdueMonths: 2, riskMonths: 12};
// "СӨХ тохиргоо → Системийн эхлэлт"-д тохируулсан огноо (YYYY-MM-DD) — 1-12 сарын
// badge-үүдэд, энэ огнооноос ӨМНӨх сарыг "идэвхгүй" (future-той адил) харуулахад ашиглана.
let systemStartDate = null;
// Тухайн (жил, сар) нь "Системийн эхлэлт"-д тохируулсан огнооноос ӨМНӨ эсэхийг
// шалгана — 1-12 сарын badge-үүдэд, систем ашиглагдаагүй үеийн сарыг "идэвхгүй"
// (future-той адил, улаан "unpaid" биш) харуулахад ашиглана.
function isBeforeSystemStart(year, month) {
  if (!systemStartDate) return false;
  const d = new Date(systemStartDate);
  if (isNaN(d)) return false;
  const sy = d.getFullYear(), sm = d.getMonth() + 1;
  return (year < sy) || (year === sy && month < sm);
}
// ============================================================
// ТАРИФЫН КАТАЛОГ (2026-07-26 нэмэв — feeSettings/rentSettings-ийн
// хатуу кодлогдсон тарифын дvнгийн оронд, tax_types/salary_components-той
// адил зарчмаар Supabase-backed динамик жагсаалт болгов)
// ============================================================
let feeCatalog = [];
async function db_loadFeeCatalog() {
  const { data, error } = await sb.from('fee_catalog').select('*').order('sort_order').order('id');
  if (sbErr(error, 'Тарифын каталог ачаалах')) return;
  feeCatalog = data || [];
}
// Тухайн этитид (resident/business) ногдох "quantity" (юугаар vржих)-ийг
// unit_type-аас хамааруулж тодорхойлно. ⚠️ business type==='owner' зөвхөн
// ГАЗРЫН ТАЛБАЙН (main_sqm) төлбөрөөс чөлөөлөгдөнө — бусад бvгдийг (зогсоол/
// агуулах/ашиглалт/хог/нэмэлт) хэвээрээ төлнө (өмнөх computeBizFee()-ийн зарчим).
function _feeQuantity(entity, entityType, unitType) {
  if (unitType === 'flat') return 1;
  if (unitType === 'main_sqm') {
    if (entityType === 'resident') return residentSqm(entity);
    if (entity.type === 'owner') return 0;
    return +entity.area || 0;
  }
  if (unitType === 'storage_sqm') {
    return (entity.storages || []).reduce((s, label) => s + getSpotSqm('storage', label), 0);
  }
  if (unitType === 'storage_count') {
    return (entity.storages || []).length;
  }
  if (unitType === 'parking_sqm') {
    return (entity.parkings || []).reduce((s, label) => s + getSpotSqm('parking', label), 0);
  }
  if (unitType === 'parking_count') {
    return (entity.parkings || []).length;
  }
  return 0;
}
// Нэгдсэн тооцооллын engine — Сууц/ААН хоёуланд адилхан ашиглана.
// entityType: 'resident' | 'business'. Идэвхгvй (active=false) мөрийг алгасна.
function calcEntityFee(entity, entityType) {
  const rows = feeCatalog.filter(f => f.active && f.applies_to === entityType);
  const total = rows.reduce((s, f) => s + _feeQuantity(entity, entityType, f.unit_type) * (+f.rate || 0), 0);
  return Math.round(total);
}
// ⚠️ 2026-07-26 засав: ӨМНӨ зөвхөн (sqm) авч, Зогсоол/Агуулахыг ОРХИГДУУЛДАГ
// байсан — accounting-bridge.js/residents.js-ийн гараар хуулбарласан хувилбар
// vvнийг тооцдог байсан тул 2 газар ХАРИЛЦАН ЗӨРЖ байсан. Одоо бvтэн resident
// object авч, ЯГ НЭГ л эх сурвалжаас (feeCatalog) тооцно — бvх дуудагч газар
// (calcFee(r)) ижил, зөв тоо авна.
function calcFee(r) {
  return calcEntityFee(r, 'resident');
}
// ============================================================
// ОРЛОГО / ЗАРЛАГЫН АНГИЛАЛ
// ============================================================
// ⚠️ 2026-07-15: INCOME_CATS хатуу бичигдсэн массив байсныг Supabase-backed
// (income_subcategories хүснэгэл) динамик жагсаалт болгов — "НББ тохиргоо →
// Орлогын дэд ангилалын нэрс" tab-аас Админ засварлана. Зөвхөн Орлогын
// дэд ангиллыг л шилжүүлсэн (Зарлагын EXPENSE_CATS хэвээрээ, доор тайлбар үзнэ үү).
let incomeSubcats = [];
async function db_loadIncomeSubcats() {
  const { data, error } = await sb.from('income_subcategories').select('*').order('sort_order').order('name');
  if (error) { console.error('income_subcategories load error:', error.message); return; }
  incomeSubcats = data || [];
}
const EXPENSE_CATS = {
  'Урсгал зардал': ['Цалин хөлсний зардал','НДШ зардал','Татварын зардал (ХХОАТ)','Ашиглалтын зардалд төлсөн (цахилгаан, ус, дулаан, санхүүгийн програм)','Барилга гүйцэтгүүлсэн ажил, үйлчилгээ (харуул, хог ачит, лифт, генератор, ариутгал)','Цэвэрлэгээний материал','Гэрэлтүүлэг, цахилгаан кабель','Сантехникийн материал','Барилга, аж ахуйн материал','Лифтний сэлбэг','Ачааны машин, шалны машины сэлбэг','Камер, домофон, галын дохиоллын сэлбэг','Зогсоолын хаалга, хаалт, сэлбэг хэрэгсэл','Орцны хаалга, сэлбэг, шил','Интернет, шуудан холбоо, бичиг хэрэг','Баяр ёслолын зардал','Шатахуун, тээврийн хөлс','Банкны шимтгэл','Хангамжийн материал (БҮТЗЭ)','Ажилчдын хоолны материал','Нотриат, Шүүх эмнэлгийн зардал','Хохирлын үнэлгээний төлбөр','Бусад /данс андуурсан гүйлгээ буцаалт/'],
  'Хөрөнгө оруулалтын зардал': ['Шалны машины төлбөр','Автомат хаалганы төлбөр','Зогсоолын хаалга','Баримт шүүгээ','Сагсны талбай','Шалны чулуу','Бусад'],
  'Хуримтлалын сан': ['Хуримтлалын сан'],
  'Элэгдэл': ['Үндсэн хөрөнгийн элэгдэл'],
};
function onExpTypeChange() {
  loadExpCats(document.getElementById('exp-type').value);
}
// ============================================================
// FINANCE TABS
// ============================================================
function switchFinTab(name, el) {
  ['fin-income','fin-expenses'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  document.getElementById('fin-'+name).style.display='block';
  document.querySelectorAll('#fin-tabs .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  if(name==='income') renderIncomeTable();
  if(name==='expenses') renderExpenseTable();
}
function switchTariffTab(name, el) {
  ['tariff-fund','tariff-fees','tariff-rent'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  document.getElementById('tariff-'+name).style.display='block';
  document.querySelectorAll('#tariff-tabs .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  populateTariffFields();
  if(name==='fees') { renderFeeCatalogTable('resident'); calcFeePreview(); }
  if(name==='rent') { renderFeeCatalogTable('business'); calcRentPreview(); }
}
// DB-ээс ачаалсан feeSettings/rentSettings-г бодит HTML талбарт харуулна
// (Өмнө нь энэ холбоос байхгүй байсан тул F5 дарахад тохиргоо "ресетлэгдэж" харагддаг байсан алдаа)
// ⚠️ 2026-07-26 засав: тарифын дvн (perSqm/garage/...) одоо Тарифын каталогт
// орсон тул энд зөвхөн хугацааны хоцрогдлын босго л vлдэв.
function populateTariffFields() {
  const feeMap = {
    'fee-penalty': feeSettings.penalty, 'fee-fund-amount': feeSettings.fundAmount,
    'fee-pending-months': feeSettings.pendingMonths, 'fee-overdue-months': feeSettings.overdueMonths, 'fee-risk-months': feeSettings.riskMonths,
  };
  const rentMap = {
    'rent-penalty': rentSettings.penalty,
    'rent-pending-months': rentSettings.pendingMonths, 'rent-overdue-months': rentSettings.overdueMonths, 'rent-risk-months': rentSettings.riskMonths,
  };
  Object.entries({...feeMap, ...rentMap}).forEach(([id,val])=>{
    const el = document.getElementById(id);
    if(el && val!==undefined && val!==null) el.value = val;
  });
}
// ============================================================
// ТАРИФЫН КАТАЛОГ — ЖАГСААЛТ, НЭМЭХ/ЗАСАХ/УСТГАХ (2026-07-26 нэмэв)
// ============================================================
// ⚠️ 2026-07-27 засав: Сууц/ААН-ий тохиргоог БvРЭН ТУСГААРЛАВ (applies_to='both'
// бvрэн арилгав) — 2 систем хоорондоо ямар ч хамааралгvй, тус тусдаа мөр.
// unit_type-ын дэлгэцэнд ЗӦВХӦН 3 цэвэр сонголт (Талбайгаар/Тоогоор/Тогтмол).
// "locked" мөрvvд (Тоот/ААН/Зогсоол/Агуулах — Хаягжилт тохиргооны бодит тоот/
// зогсоол/агуулахтай шууд уяатай) — эдгээрийн НЭРИЙГ ХЭЗЭЭ Ч санамсаргvй солиж
// болохгvй (invoice/мэдэгдэл дэх бичвэр бvрэн эндvvрэлд хvргэнэ) тул Нэр талбарыг
// disable, устгах товчийг нуана. Тооцооллын арга/Хэмжээ (тарифын бодлого тул) чөлөөтэй.
const FEE_UNIT_LABELS = {
  main_sqm: { badge:'Талбайгаар (₮/м²/сар)', tag:'tag-accent', rateLabel:'Хэмжээ (₮/м²/сар)' },
  storage_sqm: { badge:'Талбайгаар (₮/м²/сар)', tag:'tag-accent', rateLabel:'Хэмжээ (₮/м²/сар)' },
  storage_count: { badge:'Тоогоор (₮/ш/сар)', tag:'tag-warning', rateLabel:'Хэмжээ (₮/ширхэг/сар)' },
  parking_sqm: { badge:'Талбайгаар (₮/м²/сар)', tag:'tag-accent', rateLabel:'Хэмжээ (₮/м²/сар)' },
  parking_count: { badge:'Тоогоор (₮/ш/сар)', tag:'tag-warning', rateLabel:'Хэмжээ (₮/ширхэг/сар)' },
  flat: { badge:'Тогтмол (₮/сар)', tag:'tag-success', rateLabel:'Хэмжээ (₮/сар)' },
};
// ⚠️ 2026-07-27 нэмэв: "Зогсоол"/"Агуулах" мөр тус бvр ӨӨРИЙНХӨӨ физик объектоор
// (parking эсвэл storage) л тооцогдох ёстой — өмнө нь "Тоогоор" сонговол ямар ч
// мөрөнд ЗОГСООЛЫН тоог, "Талбайгаар" сонговол Сууц/ААН-ий өөрийнх нь м²-г авдаг
// байсан (өөр объектын утга алгаар орж ирдэг АЛДАА байсан). Одоо object_type-аар
// нь (main/parking/storage) ЗӨВ 2 сонголтыг л харуулна — аль ч СӨХ Зогсоол,
// Агуулахаа хvссэнээрээ (м²-гээр эсвэл ширхэгээр) чөлөөтэй тохируулж болно.
const FEE_OBJECT_UNIT_OPTIONS = {
  main: [ ['main_sqm','Талбайгаар (₮/м²/сар)'], ['flat','Тогтмол (₮/сар)'] ],
  parking: [ ['parking_sqm','Талбайгаар (₮/м²/сар)'], ['parking_count','Тоогоор (₮/ш/сар)'] ],
  storage: [ ['storage_sqm','Талбайгаар (₮/м²/сар)'], ['storage_count','Тоогоор (₮/ш/сар)'] ],
  custom: [ ['main_sqm','Талбайгаар (₮/м²/сар)'], ['flat','Тогтмол (₮/сар)'] ],
};
function renderFeeCatalogTable(tab) {
  const tbody = document.getElementById('fee-catalog-tbody-'+tab);
  const countEl = document.getElementById('fee-catalog-count-'+tab);
  if (!tbody) return;
  const rows = feeCatalog.filter(f => f.applies_to === tab)
    .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  if (countEl) countEl.textContent = `${rows.length} төлбөрийн мөр`;
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Төлбөрийн мөр алга</div></td></tr>'; return; }
  tbody.innerHTML = rows.map(f => {
    const u = FEE_UNIT_LABELS[f.unit_type] || FEE_UNIT_LABELS.flat;
    return `<tr>
      <td style="font-weight:600">${f.locked?'<span title="Хаягжилт тохиргооны бодит тоот/зогсоол/агуулахтай шууд уяатай тул нэрийг нь засах боломжгvй — тооцооллын арга/хэмжээг чөлөөтэй өөрчилнө" style="margin-right:5px">🔒</span>':''}${esc(f.name)}</td>
      <td><span class="tag ${u.tag}">${u.badge}</span></td>
      <td class="font-mono">${fmtMoney(f.rate)}₮</td>
      <td>${f.active ? '<span class="tag tag-success">Идэвхтэй</span>' : '<span class="tag" style="background:rgba(100,116,139,0.12);color:var(--text-muted)">Идэвхгvй</span>'}</td>
      <td><div class="flex gap-8">
        <button class="btn btn-ghost btn-sm" style="padding:4px" title="Засах" onclick="openFeeCatalogModal(${f.id},'${tab}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        ${f.locked ? '' : `<button class="btn btn-ghost btn-sm" style="padding:4px;color:var(--danger)" title="Устгах" onclick="deleteFeeCatalogRow(${f.id})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>`}
      </div></td>
    </tr>`;
  }).join('');
}
let _feeCatalogEditingId = null;
let _feeCatalogEditingTab = null;
function onFeeCatalogUnitTypeChange() {
  const t = document.getElementById('fee-catalog-unit-type').value;
  document.getElementById('fee-catalog-rate-label').textContent = (FEE_UNIT_LABELS[t]||FEE_UNIT_LABELS.flat).rateLabel;
}
function openFeeCatalogModal(id, defaultTab) {
  if (id && !canWrite('tariff-settings')) { toast('Танд энэ vйлдлийг хийх эрх байхгvй байна','error'); return; }
  if (!id && !canAdd('tariff-settings')) { toast('Танд энэ vйлдлийг хийх эрх байхгvй байна','error'); return; }
  _feeCatalogEditingId = id || null;
  const f = id ? feeCatalog.find(x=>x.id===id) : null;
  _feeCatalogEditingTab = f ? f.applies_to : (defaultTab || 'resident');
  document.getElementById('modal-fee-catalog-title').textContent = f ? 'Төлбөр засах' : 'Шинэ төлбөр нэмэх';
  const nameInput = document.getElementById('fee-catalog-name');
  nameInput.value = f ? f.name : '';
  nameInput.disabled = !!(f && f.locked);
  // ⚠️ Мөрийн object_type-д (main/parking/storage) тохирох ЗӨВ 2 сонголтыг л
  // харуулна — тухайн физик объектод хамааралгvй утга санамсаргvй сонгогдохгvй.
  const objectType = f ? (f.object_type || 'custom') : 'custom';
  const options = FEE_OBJECT_UNIT_OPTIONS[objectType] || FEE_OBJECT_UNIT_OPTIONS.custom;
  const unitSel = document.getElementById('fee-catalog-unit-type');
  unitSel.innerHTML = options.map(([v,label]) => `<option value="${v}">${label}</option>`).join('');
  unitSel.value = f ? f.unit_type : options[0][0];
  unitSel.disabled = false;
  document.getElementById('fee-catalog-rate').value = f ? f.rate : '';
  document.getElementById('fee-catalog-active').checked = f ? f.active : true;
  const lockNote = document.getElementById('fee-catalog-lock-note');
  if (lockNote) lockNote.style.display = (f && f.locked) ? 'block' : 'none';
  onFeeCatalogUnitTypeChange();
  openModal('modal-fee-catalog');
}
async function saveFeeCatalogRow() {
  if (!(_feeCatalogEditingId ? canWrite('tariff-settings') : canAdd('tariff-settings'))) { toast('Танд энэ vйлдлийг хийх эрх байхгvй байна','error'); return; }
  const existing = _feeCatalogEditingId ? feeCatalog.find(x=>x.id===_feeCatalogEditingId) : null;
  const name = (existing && existing.locked) ? existing.name : document.getElementById('fee-catalog-name').value.trim();
  if (!name) { toast('Нэрийг оруулна уу','error'); return; }
  const row = {
    name,
    unit_type: document.getElementById('fee-catalog-unit-type').value,
    rate: +document.getElementById('fee-catalog-rate').value || 0,
    applies_to: _feeCatalogEditingTab,
    active: document.getElementById('fee-catalog-active').checked,
    updated_at: new Date().toISOString(),
  };
  let error;
  if (_feeCatalogEditingId) {
    ({ error } = await sb.from('fee_catalog').update(row).eq('id', _feeCatalogEditingId));
  } else {
    row.sort_order = (feeCatalog.reduce((m,f)=>Math.max(m,f.sort_order||0),0)) + 10;
    ({ error } = await sb.from('fee_catalog').insert(row));
  }
  if (sbErr(error, 'Тарифын каталог хадгалах')) return;
  logActivity(_feeCatalogEditingId ? 'edit' : 'add', 'tariff-settings', _feeCatalogEditingId || null, `${name} (${_feeCatalogEditingTab==='resident'?'Сууц':'ААН'}) — ${fmtMoney(row.rate)}`);
  await db_loadFeeCatalog();
  closeModal('modal-fee-catalog');
  renderFeeCatalogTable('resident');
  renderFeeCatalogTable('business');
  if (typeof businesses !== 'undefined') businesses.forEach(b => { b.monthlyFee = computeBizFee(b); });
  calcFeePreview(); calcRentPreview();
  toast('Хадгалагдлаа ✓','success');
}
async function deleteFeeCatalogRow(id) {
  if (!canDelete('tariff-settings')) { toast('Танд энэ vйлдлийг хийх эрх байхгvй байна','error'); return; }
  const f = feeCatalog.find(x=>x.id===id);
  if (f && f.locked) { toast('Энэ мөрийг устгах боломжгvй — Хаягжилт тохиргооны бодит тоот/зогсоол/агуулахтай шууд уяатай','error'); return; }
  if (!confirm('Энэ төлбөрийг устгах уу? Тооцоолол шууд өөрчлөгдөнө.')) return;
  const { error } = await sb.from('fee_catalog').delete().eq('id', id);
  if (sbErr(error, 'Тарифын каталог устгах')) return;
  logActivity('delete', 'tariff-settings', id, f ? `${f.name} (${f.applies_to==='resident'?'Сууц':'ААН'})` : null);
  await db_loadFeeCatalog();
  renderFeeCatalogTable('resident');
  renderFeeCatalogTable('business');
  if (typeof businesses !== 'undefined') businesses.forEach(b => { b.monthlyFee = computeBizFee(b); });
  calcFeePreview(); calcRentPreview();
  toast('Устгагдлаа','success');
}
// view: 'list' (үндсэн жагсаалт) эсвэл 'depreciation' (элэгдэл) — ХОЁУЛАА ЯГ ТЭР НЭГ assets массиваас уншина








// --- Актлах ---
// --- Хөрөнгийн дэлгэрэнгүй (Info) modal ---

// --- Засварын дэлгэрэнгүй (Info) modal ---



// --- Засвар, үйлчилгээ ---





let rentSettings = {penalty: 2, pendingMonths: 1, overdueMonths: 2, riskMonths: 12};
function calcRentPreview() {
  const sqm = _numField('rent-preview-sqm', 50);
  const garages = _numField('rent-preview-garage', 0);
  const stSqm = _numField('rent-preview-storage-sqm', 0);
  const rows = feeCatalog.filter(f => f.active && f.applies_to==='business');
  let total = 0; const lines = [];
  rows.forEach(f => {
    let qty;
    if (f.unit_type==='flat') qty = 1;
    else if (f.unit_type==='main_sqm') qty = sqm;
    else if (f.unit_type==='storage_sqm') qty = stSqm;
    else if (f.unit_type==='storage_count') qty = garages; // жишээ карт дээр "Агуулах тоо" тусдаа талбар байхгvй тул "Зогсоол тоо"-той ижил утгыг ашиглав
    else if (f.unit_type==='parking_sqm') qty = stSqm; // "Зогсоолын м²" тусдаа талбар байхгvй тул "Агуулах м²"-тэй ижил утгыг ашиглав
    else if (f.unit_type==='parking_count') qty = garages;
    else qty = 0;
    const amt = qty * (+f.rate||0);
    total += amt;
    lines.push(`<div class="summary-row"><span class="summary-key">${esc(f.name)}</span><span class="summary-val">${fmtMoney(amt)}</span></div>`);
  });
  const el = document.getElementById('rent-preview-result'); if(!el) return;
  el.innerHTML = lines.join('') + `
    <div class="summary-row" style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
      <span class="summary-key" style="font-weight:700;color:var(--text)">Нийт түрээсийн төлбөр</span>
      <span class="summary-val text-accent" style="font-size:18px">${fmtMoney(Math.round(total))}</span>
    </div>`;
}
async function saveRentSettings() {
  rentSettings.penalty = _numField('rent-penalty', 2);
  rentSettings.pendingMonths = _numField('rent-pending-months', 1);
  rentSettings.overdueMonths = _numField('rent-overdue-months', 2);
  rentSettings.riskMonths = _numField('rent-risk-months', 12);
  const ok = await db_saveSettings('rent', rentSettings);
  if(!ok) { toast('Хадгалахад алдаа гарлаа — консол шалгана уу','error'); return; }
  toast('Хугацааны хоцрогдлын тохиргоо хадгалагдлаа','success');
}
// Гүйлгээний огноонд үндэслэн Он-ы dropdown-г динамикаар үүсгэнэ (Бүх он = анхны утга)
function populateYearFilterOptions(selectId, txType) {
  const sel = document.getElementById(selectId);
  if(!sel) return;
  const years = [...new Set(transactions.filter(t=>t && t.type===txType && t.year).map(t=>t.year))].sort((a,b)=>b-a);
  const expectedCount = years.length + 1; // +1 үчир "Бүх он"
  if(sel.options.length === expectedCount && sel.dataset.yearsKey === years.join(',')) return; // өөрчлөгдөөгүй бол дахин зурахгүй
  const curVal = sel.value;
  sel.innerHTML = '<option value="">Бүх он</option>' + years.map(y=>`<option value="${y}">${y}</option>`).join('');
  sel.value = curVal;
  sel.dataset.yearsKey = years.join(',');
}
function populateDayFilterOptions(selectId) {
  const el = document.getElementById(selectId);
  if(!el || el.dataset.init) return;
  const opts = [];
  for(let d=1; d<=31; d++) opts.push(`<option value="${d}">${d}</option>`);
  el.innerHTML = '<option value="">Бүх өдөр</option>' + opts.join('');
  el.dataset.init = '1';
}
function _txDay(t) {
  const parts = (t.date||'').split('-');
  return parts.length===3 ? +parts[2] : null;
}
function renderIncomeTable() {
  populateYearFilterOptions('inc-year-filter', 'income');
  populateDayFilterOptions('inc-day-filter');
  const mf=document.getElementById('inc-month-filter')?.value;
  const yf=document.getElementById('inc-year-filter')?.value;
  const df=document.getElementById('inc-day-filter')?.value;
  const q=(document.getElementById('inc-apt-filter')?.value||'').toLowerCase();
  const list=transactions.filter(t=>{
    if(!t||t.type!=='income') return false;
    if(mf&&t.month!=mf) return false;
    if(yf&&t.year!=yf) return false;
    if(df&&_txDay(t)!=df) return false;
    if(q){
      const r=residents.find(x=>String(x.apt)===String(t.apt));
      const aptStr=String(t.apt||'').toLowerCase();
      const nameStr=r?((r.firstname||'')+(r.lastname||'')).toLowerCase():'';
      const fmtStr=r?String(r.apt).toLowerCase():'';
      const descStr=(t.desc||'').toLowerCase();
      const subcatStr=(t.subcat||'').toLowerCase();
      if(!aptStr.includes(q)&&!nameStr.includes(q)&&!fmtStr.includes(q)&&!descStr.includes(q)&&!subcatStr.includes(q)) return false;
    }
    return true;
  }).sort((a,b)=>b.id-a.id);
  const body=document.getElementById('income-table-body');
  if(!body)return;
  body.innerHTML=list.map(t=>{
    // "Сүүлийн гүйлгээ" картын адил загвар: аж ахуйн нэгж бол нэрийг нь,
    // сууц өмчлөгч бол тоотыг нь харуулна.
    let lbl;
    if (t.category === 'business' && t.businessId) {
      const b = businesses.find(x=>x.id===t.businessId);
      lbl = b ? esc(b.name) : '—';
    } else {
      const r = residents.find(x=>String(x.apt)===String(t.apt));
      lbl = r ? String(r.apt) : String(t.apt||'—');
    }
    const acctCode = t.category === 'business' ? '5400' : '5100';
    const acct = getAccountByCode(acctCode);
    return `<tr>
      <td class="dt-muted dt-mono">${_fmtTxDateTime(t)}</td>
      <td><span class="dt-title dt-mono">${lbl}</span></td>
      <td class="dt-text">${esc(t.desc)}</td>
      <td class="dt-text dt-mono" title="${esc(acct?.name||'')}">${acctCode}</td>
      <td class="text-success dt-mono">${fmtMoney(t.amount)}</td>
      <td class="dt-text">${methodName(t.method)}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Орлого байхгүй</td></tr>';
}
function renderExpenseTable() {
  populateYearFilterOptions('exp-year-filter', 'expense');
  populateDayFilterOptions('exp-day-filter');
  const mf=document.getElementById('tx-month-filter')?.value;
  const yf=document.getElementById('exp-year-filter')?.value;
  const df=document.getElementById('exp-day-filter')?.value;
  const subcatQ=(document.getElementById('exp-subcat-filter')?.value||'').toLowerCase();
  const list=transactions.filter(t=>{
    if(!t||t.type!=='expense') return false;
    if(mf&&t.month!=mf) return false;
    if(yf&&t.year!=yf) return false;
    if(df&&_txDay(t)!=df) return false;
    if(subcatQ&&!(t.subcat||'').toLowerCase().includes(subcatQ)&&!(t.desc||'').toLowerCase().includes(subcatQ)) return false;
    return true;
  }).sort((a,b)=>b.id-a.id);
  const body=document.getElementById('expense-table-body');
  if(!body)return;
  body.innerHTML=list.map(t=>{
    const cl=t.clienteleId ? clientele.find(c=>c.id===t.clienteleId) : null;
    const acctCode = mapExpenseSubcatToAccount(t.subcat);
    const acct = getAccountByCode(acctCode);
    return `<tr>
    <td class="dt-muted dt-mono">${_fmtTxDateTime(t)}</td>
    <td class="dt-title">${esc(t.subcat||t.desc)}</td>
    <td class="dt-text dt-mono" title="${esc(acct?.name||'')}">${acctCode}</td>
    <td class="dt-text">${cl?esc(cl.legalName):'—'}</td>
    <td class="dt-text">${(t.desc&&t.desc!==t.subcat)?esc(t.desc):''}</td>
    <td class="text-danger dt-mono">${fmtMoney(t.amount)}</td>
  </tr>`;
  }).join('')||'<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Зарлага байхгүй</td></tr>';
}
function calcFeePreview() {
  const sqm=_numField('preview-sqm', 95);
  const garages=_numField('preview-garage', 0);
  const stSqm=_numField('preview-storage-sqm', 0);
  const rows = feeCatalog.filter(f => f.active && f.applies_to==='resident');
  let total = 0; const lines = [];
  rows.forEach(f => {
    let qty;
    if (f.unit_type==='flat') qty = 1;
    else if (f.unit_type==='main_sqm') qty = sqm;
    else if (f.unit_type==='storage_sqm') qty = stSqm;
    else if (f.unit_type==='storage_count') qty = garages; // жишээ карт дээр "Агуулах тоо" тусдаа талбар байхгvй тул "Зогсоол тоо"-той ижил утгыг ашиглав
    else if (f.unit_type==='parking_sqm') qty = stSqm; // "Зогсоолын м²" тусдаа талбар байхгvй тул "Агуулах м²"-тэй ижил утгыг ашиглав
    else if (f.unit_type==='parking_count') qty = garages;
    else qty = 0;
    const amt = qty * (+f.rate||0);
    total += amt;
    lines.push(`<div class="summary-row"><span class="summary-key">${esc(f.name)}</span><span class="summary-val">${fmt(amt)}</span></div>`);
  });
  const el=document.getElementById('fee-preview-result');if(!el)return;
  el.innerHTML = lines.join('') + `
    <div class="summary-row" style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
      <span class="summary-key font-bold" style="font-weight:700;color:var(--text)">Нийт СӨХ-ийн төлбөр</span>
      <span class="summary-val text-accent" style="font-size:18px">${fmt(Math.round(total))}</span></div>`;
}
async function saveFeeSettings(){
  feeSettings.penalty=_numField('fee-penalty', 2);
  feeSettings.fundAmount=_numField('fee-fund-amount', 5000000);
  feeSettings.pendingMonths=_numField('fee-pending-months', 1);
  feeSettings.overdueMonths=_numField('fee-overdue-months', 2);
  feeSettings.riskMonths=_numField('fee-risk-months', 12);
  const ok = await db_saveSettings('fee', feeSettings);
  if(!ok) { toast('Хадгалахад алдаа гарлаа — консол шалгана уу','error'); return; }
  toast('Хугацааны хоцрогдлын тохиргоо хадгалагдлаа ✓','success');
}
// ============================================================
// PAYMENTS
// ============================================================
// ============================================================
// ТӨЛБӨР — 4 tab тус бүр тусдаа функц
// ============================================================

// ⚠️ "payments-table" (suh.html) яг 8 баганатай: ТООТ / ТӨЛБӨР ТӨЛӨГЧ / ДҮН / САР /
// ХУГАЦАА / ТӨЛБӨРИЙН ХЭЛБЭР / СТАТУС / ҮЙЛДЭЛ. Доорх мөр үүсгэгч функц бүр (_payRow,
// _payRowBiz, _renderPayCompleted, _renderPayRisk доторх мөрүүд) яг 8 <td> агуулсан
// байх ЁСТОЙ — нэг ч <td> дутвал баганууд шилжиж, товч/статус буруу баганад орно
// (2026-07-13-нд яг энэ шалтгаанаар "Бүртгэх" товч "Статус" баганад орсон алдаа гарч байсан).
// Шинэ багана нэмэх/хасах бол ЭНЭ бүх функцийг НЭГ ЗЭРЭГ шинэчилнэ үү.

// "ХУГАЦАА" баганад бүх tab (Төлөгдсөн/Хүлээлттэй/Хугацаа хэтэрсэн/Эрсдэлтэй)
// ЯГ НЭГ форматаар (YYYY/MM/DD) харуулахын тулд нэгдсэн туслах функцүүд.
function _fmtDateSlash(dateStr) {
  if(!dateStr) return '—';
  return String(dateStr).replaceAll('-', '/');
}
function _lastPaymentDateStrForResident(r) {
  const tx = transactions.filter(t=>t&&String(t.apt)===String(r.apt)&&t.type==='income'&&t.category==='resident').sort((a,b)=>(b.year*10000+b.month*100+(+((b.date||'').split('-')[2])||0))-(a.year*10000+a.month*100+(+((a.date||'').split('-')[2])||0)));
  return tx[0] ? _fmtDateSlash(tx[0].date) : 'Огт төлөөгүй';
}
function _lastPaymentDateStrForBusiness(b) {
  const tx = transactions.filter(t=>t&&t.businessId===b.id&&t.type==='income').sort((a,b2)=>(b2.year*10000+b2.month*100+(+((b2.date||'').split('-')[2])||0))-(a.year*10000+a.month*100+(+((a.date||'').split('-')[2])||0)));
  return tx[0] ? _fmtDateSlash(tx[0].date) : 'Огт төлөөгүй';
}
function _payRow(r, bgColor, textColor, statusText, showBtn) {
  const fee = calcFee(r);
  return `<tr style="cursor:pointer" onclick="openResidentDetail(${r.id})">
    <td><span class="dt-title dt-mono">${String(r.apt)}</span></td>
    <td><div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:${bgColor};color:${textColor}">${(r.firstname||r.owner||"?")[0]}</div><span class="dt-title">${esc((r.firstname||"")+" "+(r.lastname||""))}</span></div></td>
    <td class="dt-text dt-mono">${fmtMoney(fee)}</td>
    <td class="dt-text">${CUR_MONTH}-р сар</td>
    <td class="dt-muted">${_lastPaymentDateStrForResident(r)}</td>
    <td class="dt-muted">—</td>
    <td style="color:${textColor};font-size:12px;font-weight:600;white-space:nowrap">${statusText}</td>
    <td>${showBtn?`<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();quickPayForApt(${r.id})">Бүртгэх</button>`:'<span class="dt-muted">—</span>'}</td>
  </tr>`;
}
function _bizMatchesFilter(b, filter) {
  if(!filter) return true;
  const q = filter.toLowerCase();
  return (b.name||'').toLowerCase().includes(q) || (b.regno||'').toLowerCase().includes(q);
}
function monthsUnpaidForBusiness(b) {
  const relevantTx = transactions.filter(t=>t&&t.businessId===b.id&&t.type==='income').sort((a,b2)=>(b2.year*100+b2.month)-(a.year*100+a.month));
  const lastPay = relevantTx[0];
  if(lastPay) return Math.max(0, (CUR_YEAR - lastPay.year)*12 + (CUR_MONTH - lastPay.month));
  // ⚠️ 2026-07-18: monthsUnpaidForResident-тэй ижил зарчим — "999" сентинелийн
  // оронд "Гэрээ эхэлсэн огноо"-ноос хойш хэдэн сар өнгөрснийг тооцно.
  if(b.start) return monthsBetweenDates(b.start, todayStr());
  return 999;
}
function _bizThresholds(b) {
  // ⚠️ ААН (Өмчлөгч/Түрээслэгч аль аль нь) — үргэлж ААН-ы тариф тохиргоо (rentSettings)-г
  // ашиглана, Сууц өмчлөгчийн feeSettings-тэй хэзээ ч холихгүй.
  return {pending: rentSettings.pendingMonths||1, overdue: rentSettings.overdueMonths||2, risk: rentSettings.riskMonths||12};
}
function _payRowBiz(b, bgColor, textColor, statusText, showBtn) {
  return `<tr style="cursor:pointer" onclick="openBusinessDetail(${b.id})">
    <td><span class="dt-title dt-mono">АА</span></td>
    <td><div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:${bgColor};color:${textColor}">${(b.name||"?")[0]}</div><span class="dt-title">${esc(b.name)||''} <span class="dt-muted" style="font-size:10px">(Аж ахуй)</span></span></div></td>
    <td class="dt-text dt-mono">${fmtMoney(b.monthlyFee)}</td>
    <td class="dt-text">${CUR_MONTH}-р сар</td>
    <td class="dt-muted">${_lastPaymentDateStrForBusiness(b)}</td>
    <td class="dt-muted">—</td>
    <td style="color:${textColor};font-size:12px;font-weight:600;white-space:nowrap">${statusText}</td>
    <td>${showBtn?`<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openBizPayModal(businesses.find(x=>x.id===${b.id}))">Бүртгэх</button>`:'<span class="dt-muted">—</span>'}</td>
  </tr>`;
}
function _renderPayCompleted(body, filter='') {
  let paidTx = transactions.filter(t=>t&&t.type==='income').sort((a,b)=>b.id-a.id);
  if(filter) {
    const q = filter.toLowerCase();
    paidTx = paidTx.filter(t=>{
      const r = residents.find(x=>String(x.apt)===String(t.apt));
      const b = businesses.find(x=>x.id===t.businessId);
      return (r?String(r.apt):String(t.apt||'')).toLowerCase().includes(q)
        || (r?.firstname||'').toLowerCase().includes(q)
        || (r?.lastname||'').toLowerCase().includes(q)
        || (b?.name||'').toLowerCase().includes(q);
    });
  }
  body.innerHTML = paidTx.map(t=>{
    const r = residents.find(x=>String(x.apt)===String(t.apt));
    const b = !r ? businesses.find(x=>x.id===t.businessId) : null;
    if(b) {
      return `<tr style="cursor:pointer" onclick="openBusinessDetail(${b.id})">
        <td><span class="dt-title dt-mono">АА</span></td>
        <td><div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:rgba(139,92,246,0.18);color:#8B5CF6">${(b.name||"?")[0]}</div><span class="dt-title">${esc(b.name)} <span class="dt-muted" style="font-size:10px">(Аж ахуй)</span></span></div></td>
        <td class="dt-text dt-mono">${fmtMoney(t.amount)}</td>
        <td class="dt-text">${t.month}-р сар</td>
        <td class="dt-muted">${_fmtDateSlash(t.date)}</td>
        <td class="dt-text">${methodName(t.method)}</td>
        <td style="color:var(--success);font-size:12px;font-weight:600;white-space:nowrap">Төлсөн</td>
        <td class="dt-muted">—</td>
      </tr>`;
    }
    return `<tr style="cursor:pointer" onclick="if(${r?r.id:0})openResidentDetail(${r?r.id:0})">
      <td><span class="dt-title dt-mono">${r?String(r.apt):String(t.apt||'—')}</span></td>
      <td>${r?`<div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:rgba(59,130,246,0.18);color:#3B82F6">${(r.firstname||"?")[0]}</div><span class="dt-title">${esc(((r.firstname||"")+" "+(r.lastname||"")).trim())||"—"}</span></div>`:'<span class="dt-muted">—</span>'}</td>
      <td class="dt-text dt-mono">${fmtMoney(t.amount)}</td>
      <td class="dt-text">${t.month}-р сар</td>
      <td class="dt-muted">${_fmtDateSlash(t.date)}</td>
      <td class="dt-text">${methodName(t.method)}</td>
      <td style="color:var(--success);font-size:12px;font-weight:600;white-space:nowrap">Төлсөн</td>
      <td class="dt-muted">—</td>
    </tr>`;
  }).join('')||'<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">Төлөгдсөн гүйлгээ байхгүй</td></tr>';
}
function _renderPayPending(body, paidAptIds, filter='') {
  const overdueThreshold = feeSettings.overdueMonths || 2;
  const pendingThreshold = feeSettings.pendingMonths || 1;
  const list = residents.filter(r=>{
    if(!r || paidAptIds.map(String).includes(String(r.apt))) return false;
    if(!_residentMatchesFilter(r, filter)) return false;
    const mu = monthsUnpaidForResident(r);
    return mu >= pendingThreshold && mu < overdueThreshold;
  });
  const paidBizIds = transactions.filter(t=>t&&t.type==='income'&&t.category==='business'&&t.businessId&&t.month===CUR_MONTH).map(t=>t.businessId);
  const bizList = businesses.filter(b=>{
    if(!b || paidBizIds.includes(b.id)) return false;
    if(!_bizMatchesFilter(b, filter)) return false;
    const th = _bizThresholds(b);
    const mu = monthsUnpaidForBusiness(b);
    return mu >= th.pending && mu < th.overdue;
  });
  const rows = list.map(r=>_payRow(r,'rgba(245,158,11,0.15)','var(--warning)','Хүлээлттэй',true))
    .concat(bizList.map(b=>_payRowBiz(b,'rgba(245,158,11,0.15)','var(--warning)','Хүлээлттэй',true)));
  body.innerHTML = rows.join('')||'<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">Хүлээлттэй байхгүй</td></tr>';
}
function _renderPayOverdue(body, paidAptIds, filter='') {
  const overdueThreshold = feeSettings.overdueMonths || 2;
  const riskThreshold = feeSettings.riskMonths || 12;
  const list = residents.filter(r=>{
    if(!r || paidAptIds.map(String).includes(String(r.apt))) return false;
    if(!_residentMatchesFilter(r, filter)) return false;
    const mu = monthsUnpaidForResident(r);
    return mu >= overdueThreshold && mu < riskThreshold;
  });
  const paidBizIds = transactions.filter(t=>t&&t.type==='income'&&t.category==='business'&&t.businessId&&t.month===CUR_MONTH).map(t=>t.businessId);
  const bizList = businesses.filter(b=>{
    if(!b || paidBizIds.includes(b.id)) return false;
    if(!_bizMatchesFilter(b, filter)) return false;
    const th = _bizThresholds(b);
    const mu = monthsUnpaidForBusiness(b);
    return mu >= th.overdue && mu < th.risk;
  });
  const rows = list.map(r=>_payRow(r,'rgba(239,68,68,0.15)','var(--danger)','Хэтэрсэн',true))
    .concat(bizList.map(b=>_payRowBiz(b,'rgba(239,68,68,0.15)','var(--danger)','Хэтэрсэн',true)));
  body.innerHTML = rows.join('')||'<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">Хугацаа хэтэрсэн байхгүй</td></tr>';
}
function _renderPayRisk(body, filter='') {
  const riskThreshold = feeSettings.riskMonths || 12;
  const riskResidents = residents.filter(r=>r && monthsUnpaidForResident(r) >= riskThreshold && _residentMatchesFilter(r, filter));
  const riskBiz = businesses.filter(b=>{
    if(!b || !_bizMatchesFilter(b, filter)) return false;
    return monthsUnpaidForBusiness(b) >= _bizThresholds(b).risk;
  });
  const residentRows = riskResidents.map(r=>{
    const fee = calcFee(r);
    return `<tr style="cursor:pointer" onclick="openResidentDetail(${r.id})">
      <td><span class="dt-title dt-mono">${String(r.apt)}</span></td>
      <td><div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:rgba(239,68,68,0.2);color:#EF4444">${(r.firstname||"?")[0]}</div><span class="dt-title">${esc(((r.firstname||"")+" "+(r.lastname||"")).trim())||"—"}</span></div></td>
      <td class="dt-text dt-mono" style="color:var(--danger)">${fmtMoney(fee)}</td>
      <td class="dt-text" style="color:var(--danger)">${monthsUnpaidForResident(r)}+ сар</td>
      <td class="dt-muted">${_lastPaymentDateStrForResident(r)}</td>
      <td class="dt-muted">—</td>
      <td style="color:var(--danger);font-size:12px;font-weight:600;white-space:nowrap">Эрсдэлтэй</td>
      <td><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();quickPayForApt(${r.id})">Бүртгэх</button></td>
    </tr>`;
  });
  const bizRows = riskBiz.map(b=>{
    return `<tr style="cursor:pointer" onclick="openBusinessDetail(${b.id})">
      <td><span class="dt-title dt-mono">АА</span></td>
      <td><div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:rgba(239,68,68,0.2);color:#EF4444">${(b.name||"?")[0]}</div><span class="dt-title">${esc(b.name)} <span class="dt-muted" style="font-size:10px">(Аж ахуй)</span></span></div></td>
      <td class="dt-text dt-mono" style="color:var(--danger)">${fmtMoney(b.monthlyFee)}</td>
      <td class="dt-text" style="color:var(--danger)">${monthsUnpaidForBusiness(b)}+ сар</td>
      <td class="dt-muted">${_lastPaymentDateStrForBusiness(b)}</td>
      <td class="dt-muted">—</td>
      <td style="color:var(--danger);font-size:12px;font-weight:600;white-space:nowrap">Эрсдэлтэй</td>
      <td><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openBizPayModal(businesses.find(x=>x.id===${b.id}))">Бүртгэх</button></td>
    </tr>`;
  });
  body.innerHTML = residentRows.concat(bizRows).join('')||'<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">Эрсдэлтэй байхгүй</td></tr>';
}
let currentPayTab = 'completed';
function renderPaymentsTable(tab='completed') {
  currentPayTab = tab;
  const body = document.getElementById('payments-table-body');
  const filter = document.getElementById('payments-search')?.value || '';
  const paidAptIds = transactions.filter(t=>t&&t.type==='income'&&t.category==='resident'&&t.month===CUR_MONTH).map(t=>String(t.apt));
  if(tab==='completed') _renderPayCompleted(body, filter);
  else if(tab==='pending') _renderPayPending(body, paidAptIds, filter);
  else if(tab==='overdue') _renderPayOverdue(body, paidAptIds, filter);
  else if(tab==='risk') _renderPayRisk(body, filter);
  updatePaymentTabBadges();
}
function filterPayments() {
  renderPaymentsTable(currentPayTab);
}
// Хүлээлттэй/Хугацаа хэтэрсэн/Эрсдэлтэй tab бүрийн тоог (сууц өмчлөгч+
// аж ахуйн нэгж хамт) нэг дороос тооцоолно — tab badge, sidebar badge хоёул
// ЯГ ЭНЭ НЭГ функцийг ашиглана (тоо зөрүүлэхгүйн тулд).
function getPaymentTabCounts() {
  const paidAptIds = transactions.filter(t=>t&&t.type==='income'&&t.category==='resident'&&t.month===CUR_MONTH).map(t=>String(t.apt));
  const paidBizIds = transactions.filter(t=>t&&t.type==='income'&&t.category==='business'&&t.businessId&&t.month===CUR_MONTH).map(t=>t.businessId);
  const overdueThreshold = feeSettings.overdueMonths || 2;
  const pendingThreshold = feeSettings.pendingMonths || 1;
  const riskThreshold = feeSettings.riskMonths || 12;

  let pending = 0, overdue = 0, risk = 0;

  residents.forEach(r=>{
    if(!r) return;
    if(paidAptIds.includes(String(r.apt))) return;
    const mu = monthsUnpaidForResident(r);
    if(mu >= riskThreshold) risk++;
    else if(mu >= overdueThreshold) overdue++;
    else if(mu >= pendingThreshold) pending++;
  });
  businesses.forEach(b=>{
    if(!b) return;
    if(paidBizIds.includes(b.id)) return;
    const th = _bizThresholds(b);
    const mu = monthsUnpaidForBusiness(b);
    if(mu >= th.risk) risk++;
    else if(mu >= th.overdue) overdue++;
    else if(mu >= th.pending) pending++;
  });

  return { pending, overdue, risk };
}

function updatePaymentTabBadges() {
  const counts = getPaymentTabCounts();
  const pendingEl = document.getElementById('pay-tab-pending-badge');
  const overdueEl = document.getElementById('pay-tab-overdue-badge');
  const riskEl = document.getElementById('pay-tab-risk-badge');
  if(pendingEl) pendingEl.textContent = counts.pending;
  if(overdueEl) overdueEl.textContent = counts.overdue;
  if(riskEl) riskEl.textContent = counts.risk;

  const sidebarBadge = document.getElementById('overdue-badge');
  if(sidebarBadge) sidebarBadge.textContent = counts.pending + counts.overdue + counts.risk;
}

function switchPayTab(tab,el){
  document.querySelectorAll('#page-payments .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderPaymentsTable(tab);
}
function openPayModal() {
  // Normal горим руу reset
  document.getElementById('pay-resident-info').style.display='none';
  document.getElementById('pay-select-section').style.display='block';
  document.getElementById('pay-building-select').value='';
  document.getElementById('pay-apt-select').innerHTML='<option value="">— Эхлээд байр сонгох —</option>';
  document.getElementById('pay-apt-select').disabled=true;
  document.getElementById('pay-fee-breakdown').style.display='none';
  document.getElementById('pay-overdue-warning').style.display='none';
  document.getElementById('pay-amount').value='';
  document.getElementById('pay-ref').value='';
  document.getElementById('qpay-apt-hint').textContent='байр-тоот';
  openModal('modal-payment');
}
function onPayBuildingChange() {
  const val=document.getElementById('pay-building-select').value;
  const aptSel=document.getElementById('pay-apt-select');
  document.getElementById('pay-fee-breakdown').style.display='none';
  document.getElementById('pay-overdue-warning').style.display='none';
  document.getElementById('pay-amount').value='';
  if(!val){aptSel.innerHTML='<option value="">— Тоот сонгох —</option>';aptSel.disabled=true;return;}

  if(val==='biz') {
    // ⚠️ Аж ахуйн нэгж горим — доод (Төлөгч) нүдэнд бүртгэлтэй ААН-уудын жагсаалт дуудна
    aptSel.innerHTML='<option value="">— Байгууллага сонгох —</option>';
    if(businesses.length){
      businesses.forEach(b=>{const o=document.createElement('option');o.value='biz:'+b.id;o.textContent=b.name;aptSel.appendChild(o);});
      aptSel.disabled=false;
    } else {
      aptSel.innerHTML='<option value="">Бүртгэлтэй ААН байхгүй</option>';aptSel.disabled=true;
    }
    return;
  }

  const bId=+val;
  aptSel.innerHTML='<option value="">— Тоот сонгох —</option>';
  const bldRes=residents.filter(r=>r&&r.building===bId);
  if(bldRes.length){
    bldRes.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=String(r.apt)+' — '+(r.firstname||r.owner||'')+(r.lastname?' '+r.lastname:'');aptSel.appendChild(o);});
    aptSel.disabled=false;
  } else {
    aptSel.innerHTML='<option value="">Бүртгэлтэй өмчлөгч байхгүй</option>';aptSel.disabled=true;
  }
}
function onPayAptChange() {
  const val=document.getElementById('pay-apt-select').value;
  if(!val){document.getElementById('pay-fee-breakdown').style.display='none';document.getElementById('pay-overdue-warning').style.display='none';return;}

  if(String(val).startsWith('biz:')) {
    const bizId=+val.slice(4);
    const b=businesses.find(x=>x.id===bizId);if(!b)return;
    const isTenant=b.type!=='owner';
    const feeRows = feeCatalog.filter(f => f.active && f.applies_to==='business')
      .map(f => ({ name: f.name, amt: Math.round(_feeQuantity(b, 'business', f.unit_type) * (+f.rate||0)) }));
    const total = feeRows.reduce((s,x)=>s+x.amt, 0);
    const bd=document.getElementById('pay-fee-breakdown');
    bd.style.display='block';
    bd.innerHTML=`<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">📋 ${esc(b.name)} — СӨХ-ийн төлбөрийн задаргаа</div>
      ${(!isTenant)?`<div class="summary-row"><span class="summary-key" style="color:var(--text-dim)">Талбайн төлбөрөөс чөлөөлөгдсөн (Өмчлөгч)</span></div>`:''}
      ${feeRows.filter(x=>x.amt).map(x=>`<div class="summary-row"><span class="summary-key">${esc(x.name)}</span><span class="summary-val font-mono">${fmt(x.amt)}</span></div>`).join('')}
      <div class="summary-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:8px">
        <span class="summary-key" style="font-weight:700;color:var(--text)">Нийт дүн</span>
        <span class="summary-val text-accent" style="font-size:16px">${fmt(total)}</span></div>`;
    document.getElementById('pay-amount').value=total;
    document.getElementById('qpay-apt-hint').textContent=b.name;
    const hasPrev=transactions.some(t=>t.type==='income'&&t.category==='business'&&t.bizId===bizId&&t.month===CUR_MONTH);
    const ow=document.getElementById('pay-overdue-warning');
    if(hasPrev){ow.style.display='block';ow.innerHTML=`⚠️ ${esc(b.name)} энэ сарын СӨХ-ийн төлбөрийг аль хэдийн төлсөн байна!`;}
    else{ow.style.display='none';}
    return;
  }

  const resId=+val;
  const r=residents.find(x=>x.id===resId);if(!r)return;
  const feeRowsR = feeCatalog.filter(f => f.active && f.applies_to==='resident')
    .map(f => ({ name: f.name, amt: Math.round(_feeQuantity(r, 'resident', f.unit_type) * (+f.rate||0)) }));
  const total = feeRowsR.reduce((s,x)=>s+x.amt, 0);
  const aptCode=String(r.apt);
  const bd=document.getElementById('pay-fee-breakdown');
  bd.style.display='block';
  bd.innerHTML=`<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">📋 ${aptCode} — СӨХ-ийн төлбөрийн задаргаа</div>
    ${feeRowsR.filter(x=>x.amt).map(x=>`<div class="summary-row"><span class="summary-key">${esc(x.name)}</span><span class="summary-val font-mono">${fmt(x.amt)}</span></div>`).join('')}
    <div class="summary-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:8px">
      <span class="summary-key" style="font-weight:700;color:var(--text)">Нийт дүн</span>
      <span class="summary-val text-accent" style="font-size:16px">${fmt(total)}</span></div>`;
  document.getElementById('pay-amount').value=total;
  document.getElementById('qpay-apt-hint').textContent=aptCode;
  const hasPrev=transactions.some(t=>String(t.apt)===String(r.apt)&&t.type==='income'&&t.category==='resident'&&t.month===CUR_MONTH);
  const ow=document.getElementById('pay-overdue-warning');
  if(hasPrev){ow.style.display='block';ow.innerHTML='⚠️ Энэ айл 1-р сарын СӨХ-ийн төлбөрийг аль хэдийн төлсөн байна!';}
  else{ow.style.display='none';}
}
function quickPayForApt(resId) {
  const r=residents.find(x=>x.id===resId);if(!r)return;
  openPayModal();
  // Сууц өмчлөгчийн мэдээлэл харуулах горим
  document.getElementById('pay-resident-info').style.display='block';
  document.getElementById('pay-select-section').style.display='none';
  document.getElementById('pay-res-apt').textContent=String(r.apt);
  document.getElementById('pay-res-name').textContent=((r.firstname||'')+" "+(r.lastname||'')).trim()||r.owner||'—';
  // Сонгосон байдлаар тохируулах (savePayment-д хэрэгтэй)
  document.getElementById('pay-building-select').value=r.building;
  onPayBuildingChange();
  setTimeout(()=>{document.getElementById('pay-apt-select').value=resId;onPayAptChange();},60);
}
function selectPayMethod(el,method){
  document.querySelectorAll('.pay-method-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('pay-method').value=method;
  document.getElementById('qpay-info').style.display=method==='qpay'?'block':'none';
}
async function savePayment() {
  // Quick pay горимд pay-apt-select нуугдсан тул selectedAptForDetail ашиглана
  const selectEl = document.getElementById('pay-apt-select');
  const isQuickMode = document.getElementById('pay-resident-info').style.display !== 'none';
  const rawVal = isQuickMode ? (selectedAptForDetail?.id || 0) : selectEl.value;

  // ⚠️ Аж ахуйн нэгж горим (Байр сонгогчид "Аж ахуйн нэгж" сонгогдсон үед) —
  // Төлөгч нүдний утга "biz:<id>" хэлбэртэй байна.
  if(!isQuickMode && String(rawVal).startsWith('biz:')) {
    const bizId = +String(rawVal).slice(4);
    const b = businesses.find(x=>x.id===bizId);
    if(!b){toast('Байгууллага олдсонгүй','error');return;}
    const amount=+document.getElementById('pay-amount').value;
    const method=document.getElementById('pay-method').value;
    const ref=document.getElementById('pay-ref').value;
    const month=+document.getElementById('pay-month').value;
    if(!amount){toast('Дүн оруулна уу','error');return;}
    const data={
      apt:null, type:'income', amount, method, ref,
      month, year:CUR_YEAR, date:todayStr(), status:'completed',
      category:'business', businessId:b.id,
      description: b.name+' — '+month+'-р сарын СӨХ-ийн төлбөр', subcat:'Сарын төлбөр',
    };
    const ok = await db_saveTransaction(data);
    if(!ok) { toast('Бүртгэхэд алдаа гарлаа — таны рольд энэ үйлдэл хийх эрх байхгүй байж болзошгүй','error'); return; }
    transactions.push({id:nextId++,dbId:data.id,...data});
    if (typeof accountingRecordBusinessPayment === 'function') {
      accountingRecordBusinessPayment(b.id, amount, todayStr(), `${b.name} — ${month}-р сарын түрээс`)
        .then(res => { if (!res.success) console.warn('Journal entry үүсгэхэд алдаа:', res.error); })
        .catch(e => console.warn('Journal entry үүсгэхэд алдаа:', e));
    }
    logActivity('payment', 'transactions', b.id, `${b.name} — ${fmtMoney(amount)}`);
    closeModal('modal-payment');
    renderBusinesses();
    renderPaymentsTable('completed');
    toast(`${b.name} ${month}-р сарын төлбөр бүртгэгдлээ ✓`,'success');
    return;
  }

  let resId = isQuickMode ? (+rawVal||0) : +rawVal;
  if(!resId){toast('Тоот сонгоно уу','error');return;}
  const r=residents.find(x=>x.id===resId);
  if(!r){toast('Сууц өмчлөгч олдсонгүй','error');return;}
  const amount=+document.getElementById('pay-amount').value;
  const method=document.getElementById('pay-method').value;
  const ref=document.getElementById('pay-ref').value;
  const month=+document.getElementById('pay-month').value;
  if(!amount){toast('Дүн оруулна уу','error');return;}
  const data={
    apt:r.apt, aptId:r.id,
    description:'СӨХ-ийн төлбөр', subcat:'Сарын төлбөр',
    type:'income', amount, method, ref,
    month, year:CUR_YEAR,
    date:todayStr(), status:'completed', category:'resident'
  };
  const ok = await db_saveTransaction(data);
  if(!ok) { toast('Бүртгэхэд алдаа гарлаа — таны рольд энэ үйлдэл хийх эрх байхгүй байж болзошгүй','error'); return; }
  transactions.push({id:nextId++,dbId:data.id,...data});
  // Нягтлан бодох бүртгэлийн журнал бичилт (нэмэлт — гол гүйлгээг зогсоохгүй)
  if (typeof accountingRecordResidentPayment === 'function') {
    accountingRecordResidentPayment(r.apt, amount, todayStr(), `${r.apt} тоот — ${month}-р сарын төлбөр`)
      .then(res => { if (!res.success) console.warn('Journal entry үүсгэхэд алдаа:', res.error); })
      .catch(e => console.warn('Journal entry үүсгэхэд алдаа:', e));
  }
  logActivity('payment', 'transactions', r.id, `${String(r.apt)} тоот — ${fmtMoney(amount)}`);
  closeModal('modal-payment');
  renderResidents();
  renderPaymentsTable('completed');
  if(document.getElementById('page-apartments')?.classList.contains('active')){
    renderAptGrid(selectedBuilding);
  }
  toast(`${String(r.apt)} ${month}-р сарын төлбөр бүртгэгдлээ ✓`,'success');
}
function loadExpCats(type){
  const catSel=document.getElementById('exp-category');
  catSel.innerHTML='';
  if(type==='income'){
    incomeSubcats.forEach(c=>{const o=document.createElement('option');o.value=c.name;o.textContent=c.name;catSel.appendChild(o);});
  } else {
    Object.entries(EXPENSE_CATS).forEach(([group,items])=>{
      const og=document.createElement('optgroup');og.label=group;
      items.forEach(item=>{const o=document.createElement('option');o.value=item;o.textContent=item;og.appendChild(o);});
      catSel.appendChild(og);
    });
  }
}

// ============================================================
// "НББ тохиргоо → Орлогын дэд ангилалын нэрс" tab-ийн CRUD
// ============================================================
function renderIncomeSubcatsList() {
  const el = document.getElementById('income-subcats-list');
  if (!el) return;
  if (!incomeSubcats.length) { el.innerHTML = '<div class="empty-state">Дэд ангилал бүртгэгдээгүй байна</div>'; return; }
  const canEdit = currentProfile?.role === 'admin' || canWrite('accounting');
  el.innerHTML = `<table class="data-table"><thead><tr><th>Нэр</th><th style="width:90px">Үйлдэл</th></tr></thead><tbody>
    ${incomeSubcats.map(c => `<tr><td class="dt-text">${esc(c.name)}</td><td>${_rowActionIcons(c.id, canEdit, canEdit, 'editIncomeSubcat', 'deleteIncomeSubcat')}</td></tr>`).join('')}
  </tbody></table>`;
}
let editingIncomeSubcatId = null;
function openAddIncomeSubcat() {
  if (currentProfile?.role !== 'admin' && !canWrite('accounting')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  editingIncomeSubcatId = null;
  document.getElementById('modal-income-subcat-title').textContent = 'Орлогын дэд ангилал нэмэх';
  document.getElementById('income-subcat-name').value = '';
  openModal('modal-income-subcat');
}
function editIncomeSubcat(id) {
  if (currentProfile?.role !== 'admin' && !canWrite('accounting')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  const c = incomeSubcats.find(x => x.id === id); if (!c) return;
  editingIncomeSubcatId = id;
  document.getElementById('modal-income-subcat-title').textContent = 'Орлогын дэд ангилал засах';
  document.getElementById('income-subcat-name').value = c.name;
  openModal('modal-income-subcat');
}
async function saveIncomeSubcat() {
  const name = document.getElementById('income-subcat-name').value.trim();
  if (!name) { toast('Дэд ангиллын нэрийг оруулна уу', 'error'); return; }
  if (editingIncomeSubcatId) {
    const { error } = await sb.from('income_subcategories').update({ name }).eq('id', editingIncomeSubcatId);
    if (error) { toast('Хадгалахад алдаа гарлаа: ' + error.message, 'error'); return; }
  } else {
    const { error } = await sb.from('income_subcategories').insert({ name, sort_order: incomeSubcats.length + 1 });
    if (error) { toast('Хадгалахад алдаа гарлаа: ' + error.message, 'error'); return; }
  }
  logActivity(editingIncomeSubcatId ? 'edit' : 'add', 'nbb-settings', editingIncomeSubcatId || null, name);
  await db_loadIncomeSubcats();
  renderIncomeSubcatsList();
  closeModal('modal-income-subcat');
  toast('Хадгалагдлаа ✓', 'success');
}
async function deleteIncomeSubcat(id) {
  if (currentProfile?.role !== 'admin' && !canWrite('accounting')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  if (!confirm('Устгах уу?')) return;
  const delName = incomeSubcats.find(c=>c.id===id)?.name || null;
  const { error } = await sb.from('income_subcategories').delete().eq('id', id);
  if (error) { toast('Устгахад алдаа гарлаа: ' + error.message, 'error'); return; }
  logActivity('delete', 'nbb-settings', id, delName);
  await db_loadIncomeSubcats();
  renderIncomeSubcatsList();
  toast('Устгагдлаа', 'success');
}
function openAddExpense(){
  // ⚠️ 2026-07-19 аудит: "transactions" модулийн Нэмэх эрхийн шалгалт client-side-д байгаагүй
  if(!canAdd('transactions')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  document.getElementById('modal-expense-title').textContent='Зарлага нэмэх';
  document.getElementById('exp-type').value='expense';
  loadExpCats('expense');
  document.getElementById('exp-amount').value='';
  document.getElementById('exp-desc').value='';
  document.getElementById('exp-date').value=todayStr();
  populateClienteleSelect();
  document.getElementById('exp-clientele-group').style.display='block';
  document.getElementById('exp-clientele').value='';
  openModal('modal-expense');
}
function openAddIncome(){
  if(!canAdd('transactions')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  document.getElementById('modal-expense-title').textContent='Орлого нэмэх';
  document.getElementById('exp-type').value='income';
  loadExpCats('income');
  document.getElementById('exp-amount').value='';
  document.getElementById('exp-desc').value='';
  document.getElementById('exp-date').value=todayStr();
  document.getElementById('exp-clientele-group').style.display='none';
  openModal('modal-expense');
}
function populateClienteleSelect() {
  const sel = document.getElementById('exp-clientele');
  if(!sel) return;
  sel.innerHTML = '<option value="">— Сонгохгүй —</option>' +
    clientele.map(c=>`<option value="${c.id}">${esc(c.legalName)}</option>`).join('');
}
async function saveExpense(){
  if(!canAdd('transactions')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  const amount=+document.getElementById('exp-amount').value;
  const subcat=document.getElementById('exp-category').value;
  const desc=document.getElementById('exp-desc').value.trim()||subcat;
  const type=document.getElementById('exp-type').value;
  const dateRaw=document.getElementById('exp-date').value.trim();
  if(!amount){toast('Дүн оруулна уу','error');return;}
  const parts=dateRaw.replace(/\//g,'-').split('-');
  const month=+parts[1]||1; const year=+parts[0]||2026;
  const dateOut=parts[0]+'/'+String(parts[1]||'01').padStart(2,'0')+'/'+String(parts[2]||'01').padStart(2,'0');
  const clienteleIdRaw = type==='expense' ? document.getElementById('exp-clientele')?.value : '';
  const newTx = {id:nextId++,apt:null,desc,subcat,type,amount,method:'bank',ref:'',month,year,date:dateOut,status:'completed',category:type,clienteleId: clienteleIdRaw?+clienteleIdRaw:null};
  const ok = await db_saveTransaction(newTx);
  if(!ok) { toast('Хадгалахад алдаа гарлаа — таны рольд энэ үйлдэл хийх эрх байхгүй байж болзошгүй','error'); return; }
  transactions.push(newTx);
  // Нягтлан бодох бүртгэлийн журнал бичилт (нэмэлт — гол гүйлгээг зогсоохгүй)
  if (typeof accountingRecordExpense === 'function') {
    const jeDate = parts[0]+'-'+String(parts[1]||'01').padStart(2,'0')+'-'+String(parts[2]||'01').padStart(2,'0');
    const jePromise = type==='expense'
      ? accountingRecordExpense(subcat, amount, jeDate, desc)
      : accountingRecordIncome(subcat, amount, jeDate, desc);
    jePromise
      .then(res => { if (!res.success) console.warn('Journal entry үүсгэхэд алдаа:', res.error); })
      .catch(e => console.warn('Journal entry үүсгэхэд алдаа:', e));
  }
  logActivity('add', 'transactions', newTx.id, `${desc} — ${fmtMoney(amount)}`);
  closeModal('modal-expense');
  if(type==='expense')renderExpenseTable();else renderIncomeTable();
  renderClientele();
  toast((type==='expense'?'Зарлага':'Орлого')+' нэмэгдлээ ✓','success');
}
function quickPay() {
  if(!selectedAptForDetail){closeModal('modal-apt-detail');return;}
  closeModal('modal-apt-detail');
  quickPayForApt(selectedAptForDetail.id);
}
