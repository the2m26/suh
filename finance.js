// finance.js — Гүйлгээ, Төлбөр, Тайлан, Тарифын тохиргооны модуль
// (suh.html-ээс тусгаарлав)
// Хамаарал: sb (db.js), residents/businesses/assets дата (тэдгээрийн модулиуд).








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

let feeSettings = {perSqm: 2500, utility: 15000, extra: 0, penalty: 2, garage: 25000, storageSqm: 1500, fundAmount: 5000000, pendingMonths: 1, overdueMonths: 2, riskMonths: 12};
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
function calcFee(sqm) {
  return sqm * feeSettings.perSqm + feeSettings.utility + feeSettings.extra;
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
  if(name==='fees') calcFeePreview();
  if(name==='rent') calcRentPreview();
}
// DB-ээс ачаалсан feeSettings/rentSettings-г бодит HTML талбарт харуулна
// (Өмнө нь энэ холбоос байхгүй байсан тул F5 дарахад тохиргоо "ресетлэгдэж" харагддаг байсан алдаа)
function populateTariffFields() {
  const feeMap = {
    'fee-per-sqm': feeSettings.perSqm, 'fee-garage': feeSettings.garage, 'fee-storage': feeSettings.storageSqm,
    'fee-utility': feeSettings.utility, 'fee-penalty': feeSettings.penalty, 'fee-fund-amount': feeSettings.fundAmount,
    'fee-pending-months': feeSettings.pendingMonths, 'fee-overdue-months': feeSettings.overdueMonths, 'fee-risk-months': feeSettings.riskMonths,
  };
  const rentMap = {
    'rent-per-sqm': rentSettings.perSqm, 'rent-garage': rentSettings.garage, 'rent-storage': rentSettings.storageSqm,
    'rent-waste': rentSettings.waste, 'rent-extra': rentSettings.extra,
    'rent-penalty': rentSettings.penalty,
    'rent-pending-months': rentSettings.pendingMonths, 'rent-overdue-months': rentSettings.overdueMonths, 'rent-risk-months': rentSettings.riskMonths,
  };
  Object.entries({...feeMap, ...rentMap}).forEach(([id,val])=>{
    const el = document.getElementById(id);
    if(el && val!==undefined && val!==null) el.value = val;
  });
}
// view: 'list' (үндсэн жагсаалт) эсвэл 'depreciation' (элэгдэл) — ХОЁУЛАА ЯГ ТЭР НЭГ assets массиваас уншина








// --- Актлах ---
// --- Хөрөнгийн дэлгэрэнгүй (Info) modal ---

// --- Засварын дэлгэрэнгүй (Info) modal ---



// --- Засвар, үйлчилгээ ---





let rentSettings = {perSqm: 15000, garage: 25000, storageSqm: 1500, waste: 50000, extra: 0, penalty: 2, pendingMonths: 1, overdueMonths: 2, riskMonths: 12};
function calcRentPreview() {
  rentSettings.perSqm = +(document.getElementById('rent-per-sqm')?.value)||15000;
  rentSettings.garage = +(document.getElementById('rent-garage')?.value)||25000;
  rentSettings.storageSqm = +(document.getElementById('rent-storage')?.value)||1500;
  rentSettings.waste = +(document.getElementById('rent-waste')?.value)||50000;
  rentSettings.extra = +(document.getElementById('rent-extra')?.value)||0;
  const sqm = +(document.getElementById('rent-preview-sqm')?.value)||50;
  const garages = +(document.getElementById('rent-preview-garage')?.value)||0;
  const stSqm = +(document.getElementById('rent-preview-storage-sqm')?.value)||0;
  const units = +(document.getElementById('rent-preview-units')?.value)||1;
  const base = sqm * rentSettings.perSqm;
  const gar = garages * rentSettings.garage;
  const stor = stSqm * rentSettings.storageSqm;
  const waste = units * rentSettings.waste;
  const extra = rentSettings.extra;
  const total = base + gar + stor + waste + extra;
  const el = document.getElementById('rent-preview-result'); if(!el) return;
  el.innerHTML = `
    <div class="summary-row"><span class="summary-key">Түрээсийн талбайн төлбөр (${sqm}м²)</span><span class="summary-val">${fmtMoney(base)}</span></div>
    <div class="summary-row"><span class="summary-key">Зогсоолын СӨХ-ийн төлбөр (${garages} зогсоол)</span><span class="summary-val">${fmtMoney(gar)}</span></div>
    <div class="summary-row"><span class="summary-key">Агуулахын СӨХ-ийн төлбөр (${stSqm}м²)</span><span class="summary-val">${fmtMoney(stor)}</span></div>
    <div class="summary-row"><span class="summary-key">Хог хаягдлын төлбөр (${units} нэгж)</span><span class="summary-val">${fmtMoney(waste)}</span></div>
    <div class="summary-row"><span class="summary-key">Нэмэлт үйлчилгээ</span><span class="summary-val">${fmtMoney(extra)}</span></div>
    <div class="summary-row" style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
      <span class="summary-key" style="font-weight:700;color:var(--text)">Нийт түрээсийн төлбөр</span>
      <span class="summary-val text-accent" style="font-size:18px">${fmtMoney(total)}</span>
    </div>`;
}
async function saveRentSettings() {
  rentSettings.perSqm = +(document.getElementById('rent-per-sqm')?.value)||15000;
  rentSettings.garage = +(document.getElementById('rent-garage')?.value)||25000;
  rentSettings.storageSqm = +(document.getElementById('rent-storage')?.value)||1500;
  rentSettings.waste = +(document.getElementById('rent-waste')?.value)||50000;
  rentSettings.extra = +(document.getElementById('rent-extra')?.value)||0;
  rentSettings.penalty = +(document.getElementById('rent-penalty')?.value)||2;
  rentSettings.pendingMonths = +(document.getElementById('rent-pending-months')?.value)||1;
  rentSettings.overdueMonths = +(document.getElementById('rent-overdue-months')?.value)||2;
  rentSettings.riskMonths = +(document.getElementById('rent-risk-months')?.value)||12;
  const ok = await db_saveSettings('rent', rentSettings);
  if(!ok) { toast('Хадгалахад алдаа гарлаа — консол шалгана уу','error'); return; }
  // Тариф өөрчлөгдсөн тул одоо санах ойд байгаа бүх бизнесийн сарын төлбөрийг
  // шинэ тарифаар шууд дахин тооцоолно (хуудас дахин ачаалах шаардлагагүй)
  if (typeof businesses !== 'undefined' && typeof computeBizFee === 'function') {
    businesses.forEach(b => { b.monthlyFee = computeBizFee(b); });
  }
  toast('Түрээсийн төлбөрийн тохиргоо хадгалагдлаа','success');
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
  feeSettings.perSqm=+document.getElementById('fee-per-sqm').value||2500;
  feeSettings.utility=+document.getElementById('fee-utility').value||15000;
  feeSettings.garage=+(document.getElementById('fee-garage')?.value)||25000;
  feeSettings.storageSqm=+(document.getElementById('fee-storage')?.value)||1500;
  const sqm=+(document.getElementById('preview-sqm')?.value)||95;
  const garages=+(document.getElementById('preview-garage')?.value)||0;
  const stSqm=+(document.getElementById('preview-storage-sqm')?.value)||0;
  const base=sqm*feeSettings.perSqm;const util=feeSettings.utility;
  const gar=garages*feeSettings.garage;const stor=stSqm*feeSettings.storageSqm;
  const total=base+util+gar+stor;
  const el=document.getElementById('fee-preview-result');if(!el)return;
  el.innerHTML=`
    <div class="summary-row"><span class="summary-key">Өрхийн СӨХ-ийн төлбөр (${sqm}м²)</span><span class="summary-val">${fmt(base)}</span></div>
    <div class="summary-row"><span class="summary-key">Зогсоолын СӨХ-ийн төлбөр (${garages} зогсоол)</span><span class="summary-val">${fmt(gar)}</span></div>
    <div class="summary-row"><span class="summary-key">Агуулахын СӨХ-ийн төлбөр (${stSqm}м²)</span><span class="summary-val">${fmt(stor)}</span></div>
    <div class="summary-row"><span class="summary-key">Нэмэлт үйлчилгээний төлбөр</span><span class="summary-val">${fmt(util)}</span></div>
    <div class="summary-row" style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
      <span class="summary-key font-bold" style="font-weight:700;color:var(--text)">Нийт СӨХ-ийн төлбөр</span>
      <span class="summary-val text-accent" style="font-size:18px">${fmt(total)}</span></div>`;
}
async function saveFeeSettings(){
  feeSettings.perSqm=+document.getElementById('fee-per-sqm').value||2500;
  feeSettings.utility=+document.getElementById('fee-utility').value||15000;
  feeSettings.penalty=+document.getElementById('fee-penalty').value||2;
  feeSettings.garage=+(document.getElementById('fee-garage')?.value)||25000;
  feeSettings.storageSqm=+(document.getElementById('fee-storage')?.value)||1500;
  feeSettings.fundAmount=+(document.getElementById('fee-fund-amount')?.value)||5000000;
  feeSettings.pendingMonths=+(document.getElementById('fee-pending-months')?.value)||1;
  feeSettings.overdueMonths=+(document.getElementById('fee-overdue-months')?.value)||2;
  feeSettings.riskMonths=+(document.getElementById('fee-risk-months')?.value)||12;
  const ok = await db_saveSettings('fee', feeSettings);
  if(!ok) { toast('Хадгалахад алдаа гарлаа — консол шалгана уу','error'); return; }
  toast('СӨХ-ийн төлбөрийн тохиргоо хадгалагдлаа ✓','success');
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
  const fee = calcFee(residentSqm(r));
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
    const fee = calcFee(residentSqm(r));
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
    const area=+b.area||0;
    const areaFee=isTenant?area*(rentSettings.perSqm||0):0;
    const garCount=(b.parkings||[]).length;
    const garFee=garCount*(rentSettings.garage||0);
    const storSqm=(b.storages||[]).reduce((s,label)=>s+getSpotSqm('storage',label),0);
    const storFee=storSqm*(rentSettings.storageSqm||0);
    const wasteFee=rentSettings.waste||0;
    const extraFee=rentSettings.extra||0; // ⚠️ Өмчлөгч ЗӨВХӨН Талбайн төлбөрөөс чөлөөлөгдөнө
    const total=areaFee+garFee+storFee+wasteFee+extraFee;
    const bd=document.getElementById('pay-fee-breakdown');
    bd.style.display='block';
    bd.innerHTML=`<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">📋 ${esc(b.name)} — СӨХ-ийн төлбөрийн задаргаа</div>
      ${isTenant?`<div class="summary-row"><span class="summary-key">Түрээсийн талбайн төлбөр (${area}м²)</span><span class="summary-val font-mono">${fmt(areaFee)}</span></div>`:`<div class="summary-row"><span class="summary-key" style="color:var(--text-dim)">Талбайн төлбөрөөс чөлөөлөгдсөн (Өмчлөгч)</span></div>`}
      ${garFee?`<div class="summary-row"><span class="summary-key">Зогсоолын төлбөр (${garCount} зогсоол)</span><span class="summary-val font-mono">${fmt(garFee)}</span></div>`:''}
      ${storFee?`<div class="summary-row"><span class="summary-key">Агуулахын төлбөр (${storSqm}м²)</span><span class="summary-val font-mono">${fmt(storFee)}</span></div>`:''}
      <div class="summary-row"><span class="summary-key">Хог хаягдлын төлбөр</span><span class="summary-val font-mono">${fmt(wasteFee)}</span></div>
      <div class="summary-row"><span class="summary-key">Нэмэлт үйлчилгээ</span><span class="summary-val font-mono">${fmt(extraFee)}</span></div>
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
  const sqm=residentSqm(r);
  const base=sqm*(feeSettings.perSqm||2500);
  const util=feeSettings.utility||15000;
  const garCount=(r.parkings||[]).length;
  const storSqm=(r.storages||[]).reduce((s,label)=>s+getSpotSqm('storage',label),0);
  const gar=garCount*(feeSettings.garage||25000);
  const stor=storSqm*(feeSettings.storageSqm||1500);
  const total=base+util+gar+stor;
  const aptCode=String(r.apt);
  const bd=document.getElementById('pay-fee-breakdown');
  bd.style.display='block';
  bd.innerHTML=`<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">📋 ${aptCode} — СӨХ-ийн төлбөрийн задаргаа</div>
    <div class="summary-row"><span class="summary-key">Өрхийн төлбөр (${sqm}м²)</span><span class="summary-val font-mono">${fmt(base)}</span></div>
    <div class="summary-row"><span class="summary-key">Нэмэлт үйлчилгээ</span><span class="summary-val font-mono">${fmt(util)}</span></div>
    ${gar?`<div class="summary-row"><span class="summary-key">Гаражийн төлбөр (${garCount} зогсоол)</span><span class="summary-val font-mono">${fmt(gar)}</span></div>`:''}
    ${stor?`<div class="summary-row"><span class="summary-key">Агуулахын төлбөр (${storSqm}м²)</span><span class="summary-val font-mono">${fmt(stor)}</span></div>`:''}
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
  await db_loadIncomeSubcats();
  renderIncomeSubcatsList();
  closeModal('modal-income-subcat');
  toast('Хадгалагдлаа ✓', 'success');
}
async function deleteIncomeSubcat(id) {
  if (currentProfile?.role !== 'admin' && !canWrite('accounting')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  if (!confirm('Устгах уу?')) return;
  const { error } = await sb.from('income_subcategories').delete().eq('id', id);
  if (error) { toast('Устгахад алдаа гарлаа: ' + error.message, 'error'); return; }
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
