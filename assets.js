// assets.js — Үндсэн хөрөнгө, Элэгдэл, Засвар үйлчилгээний модуль (suh.html-ээс тусгаарлав)

let editingMaintenanceId = null;

// fixed_assets.responsible нь ажилтны fullName-г ТЕКСТЭЭР шууд хадгалдаг (id биш) тул,
// харуулахдаа тухайн fullName-тэй тохирох ажилтны бичлэгийг олж "АЖИЛТАН Эцэг/эхийн
// нэр" форматаар харуулна. Тохирох ажилтан олдохгүй бол (ажлаас гарсан, хуучин чөлөөт
// текст г.м.) хадгалагдсан түүхий утгыг л шууд харуулна.
function _responsibleDisplayName(name) {
  if (!name) return '';
  const emp = employees.find(e => e.fullName === name);
  return emp ? _employeeDisplayName(emp) : name;
}

async function db_loadAssets() {
  const {data,error} = await sb.from('fixed_assets').select('*').order('id');
  if(error){console.error('assets load error:', JSON.stringify(error), error.message);return;}
  if(!data){console.error('assets: data null');return;}
  assets = data.map(a=>({
    id:a.id, dbId:a.id, name:a.name||'', code:a.code||'', assetGroup:a.asset_group||'hoa',
    category:a.category||'office_equipment', subcategory:a.subcategory||'',
    quantity:+a.quantity||1, unit:a.unit||'ширхэг', purchaseDate:a.purchase_date||'',
    cost:+a.original_cost||0, vendor:a.vendor||'',
    location:a.location||'', responsible:a.responsible||'', note:a.note||'',
    usefulLife:a.useful_life_months||60,
    depMethod:a.depreciation_method||'straight_line', decliningRate:a.declining_rate||null,
    salvage:+a.salvage_value||0, status:a.status||'active',
    disposalDate:a.disposal_date||'', disposalReason:a.disposal_reason||'', disposalValue:a.disposal_value||null,
    accumulatedDepreciation:+a.accumulated_depreciation||0, netBookValue:a.net_book_value!=null?+a.net_book_value:null,
    depreciationUpdatedAt:a.depreciation_updated_at||''
  }));
}

async function db_saveAsset(a) {
  const row = {
    name:a.name, code:a.code, asset_group:a.assetGroup, category:a.category, subcategory:a.subcategory,
    quantity:a.quantity, unit:a.unit, purchase_date:a.purchaseDate||null, original_cost:a.cost,
    vendor:a.vendor||null, location:a.location, responsible:a.responsible, note:a.note,
    is_capitalized:true, useful_life_months:a.usefulLife,
    depreciation_method:a.depMethod, declining_rate:(a.depMethod==='declining_balance')?a.decliningRate:null,
    salvage_value:a.salvage,
    accumulated_depreciation:a.accumulatedDepreciation||0, net_book_value:a.netBookValue,
    depreciation_updated_at:new Date().toISOString()
  };
  if(a.id && a.dbId) {
    const {data, error} = await sb.from('fixed_assets').update(row).eq('id',a.dbId).select();
    if(error) { console.error('asset update error:',error.message); return false; }
    if(!data || data.length === 0) { console.warn('asset update: 0 мөр — эрхгүй байж болзошгүй'); return false; }
    return true;
  } else {
    const {data,error} = await sb.from('fixed_assets').insert(row).select().single();
    if(error){console.error('asset insert error:',error.message); return false;}
    if(data) a.dbId = data.id;
    return true;
  }
}

async function db_deleteAsset(id) {
  const {data, error} = await sb.from('fixed_assets').delete().eq('id',id).select();
  if(error) { console.error('asset delete error:',error); throw error; }
  if(!data || data.length === 0) { throw new Error('Устгах эрхгүй байна — таны рольд энэ үйлдэл хориотой'); }
}

async function db_loadMaintenance() {
  const {data,error} = await sb.from('asset_maintenance').select('*').order('id');
  if(error){console.error('maintenance load error:', JSON.stringify(error), error.message);return;}
  if(!data){console.error('maintenance: data null');return;}
  assetMaintenance = data.map(m=>({
    id:m.id, dbId:m.id, assetId:m.asset_id, date:m.maintenance_date||'',
    description:m.description||'', cost:+m.cost||0, vendor:m.vendor||''
  }));
}

async function db_saveMaintenance(m) {
  const row = {
    asset_id:m.assetId, maintenance_date:m.date||null, description:m.description,
    cost:m.cost, vendor:m.vendor||null
  };
  if(m.id && m.dbId) {
    const {data, error} = await sb.from('asset_maintenance').update(row).eq('id',m.dbId).select();
    if(error) { console.error('maintenance update error:',error.message); return false; }
    if(!data || data.length === 0) { console.warn('maintenance update: 0 мөр — эрхгүй байж болзошгүй'); return false; }
    return true;
  } else {
    const {data,error} = await sb.from('asset_maintenance').insert(row).select().single();
    if(error){console.error('maintenance insert error:',error.message); return false;}
    if(data) m.dbId = data.id;
    return true;
  }
}

async function db_deleteMaintenance(id) {
  const {data, error} = await sb.from('asset_maintenance').delete().eq('id',id).select();
  if(error) { console.error('maintenance delete error:',error); throw error; }
  if(!data || data.length === 0) { throw new Error('Устгах эрхгүй байна — таны рольд энэ үйлдэл хориотой'); }
}

let assets = [];

let assetMaintenance = [];

// ------------------------------------------------------------
// ХӨРӨНГИЙН АНГИЛАЛ/ТӨРӨЛ/БАЙРШИЛ — "Үндсэн хөрөнгө тохиргоо" хуудсанд
// удирдагдана. Өмнө нь JS-д хатуу кодлогдож байсныг Supabase руу
// шилжүүлэв (шинэ ангилал/төрөл/байршил нэмэх үед код дахин бичих
// шаардлагагүй болно).
// ------------------------------------------------------------
let ASSET_CATEGORIES = [];
let ASSET_TYPES = [];
let ASSET_LOCATIONS = [];

async function db_loadAssetSettings() {
  const [catRes, typeRes, locRes] = await Promise.all([
    sb.from('asset_categories').select('*').order('label'),
    sb.from('asset_types').select('*').order('label'),
    sb.from('asset_locations').select('*').order('label'),
  ]);
  if (catRes.error) console.error('asset_categories load error:', catRes.error.message);
  if (typeRes.error) console.error('asset_types load error:', typeRes.error.message);
  if (locRes.error) console.error('asset_locations load error:', locRes.error.message);
  ASSET_CATEGORIES = catRes.data || [];
  ASSET_TYPES = typeRes.data || [];
  ASSET_LOCATIONS = locRes.data || [];
}
function getAssetCategoryLabel(code) {
  return ASSET_CATEGORIES.find(c => c.code === code)?.label || code;
}

function renderAssetLifeAlerts() {
  const el = document.getElementById('asset-life-alerts-body');
  if(!el) return;
  const risky = (assets||[]).filter(a=>a.status!=='disposed')
    .sort((a,b)=>assetLifeProgressPct(b)-assetLifeProgressPct(a))
    .slice(0,5);
  if(!risky.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:4px 0">Үндсэн хөрөнгө бүртгэгдээгүй байна</div>';
    return;
  }
  el.innerHTML = risky.map(a=>{
    const pct = assetLifeProgressPct(a);
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim);margin-bottom:4px">
        <span>${esc(a.name)}</span><span>${pct}%</span>
      </div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%;background:${assetLifeProgressColor(pct)}"></div></div>
    </div>`;
  }).join('');
}


function updateAssetTypeOptions(keepValue) {
  const cat = document.getElementById('asset-category').value;
  const sel = document.getElementById('asset-subcategory');
  const types = ASSET_TYPES.filter(t => t.category_code === cat).map(t => t.label);
  sel.innerHTML = types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  if(keepValue && types.includes(keepValue)) sel.value = keepValue;
}

function applyAssetDefaultsForCategory() {
  const cat = document.getElementById('asset-category').value;
  const def = ASSET_CATEGORIES.find(c => c.code === cat);
  if(!def) return;
  document.getElementById('asset-useful-life').value = def.default_life_months;
  document.getElementById('asset-dep-method').value = def.default_dep_method;
  toggleDecliningRateField();
  updateAssetEndOfLifeDate();
  updateDepreciationPreview();
}

const ASSET_STATUS_LABELS = {active:'Ашиглаж байгаа', repair:'Засварт', disposed:'Актлагдсан'};

// "Үндсэн хөрөнгийн жагсаалт" болон "Элэгдэл" табын Хайх нүдний зүүн талд байрлах
// "Бүх хариуцагч"/"Бүх байршил" шүүлтүүр dropdown-уудыг угсарна (одоо байгаа
// ASSET_LOCATIONS/employees каталогоос — Хөрөнгийн модал дээрх сонголттой ижил эх сурвалж)
function populateAssetFilterSelects() {
  ['list','depreciation'].forEach(tab=>{
    const respSel = document.getElementById('asset-'+tab+'-responsible-filter');
    if(respSel) {
      const cur = respSel.value;
      respSel.innerHTML = '<option value="">Бүх хариуцагч</option>' + employees.map(e=>`<option value="${esc(e.fullName)}">${esc(_employeeDisplayName(e))}</option>`).join('');
      if(cur) respSel.value = cur;
    }
    const locSel = document.getElementById('asset-'+tab+'-location-filter');
    if(locSel) {
      const cur = locSel.value;
      locSel.innerHTML = '<option value="">Бүх байршил</option>' + ASSET_LOCATIONS.map(l=>`<option value="${esc(l.label)}">${esc(l.label)}</option>`).join('');
      if(cur) locSel.value = cur;
    }
  });
}

function switchAssetTab(name, el) {
  ['list','depreciation','maintenance'].forEach(id=>{const e=document.getElementById('asset-'+id);if(e)e.style.display='none';});
  document.getElementById('asset-'+name).style.display='block';
  document.querySelectorAll('#asset-tabs .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  filterAssets(name);
}

function assetLifeProgressPct(a) {
  if(!a.purchaseDate || !a.usefulLife) return 0;
  const monthsElapsed = monthsBetweenDates(a.purchaseDate, new Date().toISOString().slice(0,10));
  return Math.min(100, Math.round(monthsElapsed / a.usefulLife * 100));
}

function assetLifeProgressColor(pct) {
  if(pct >= 90) return 'var(--danger)';
  if(pct >= 70) return 'var(--warning)';
  return 'var(--success)';
}

function assetLifeProgressBarHTML(a) {
  const pct = assetLifeProgressPct(a);
  const endDate = a.purchaseDate ? addMonths(a.purchaseDate, a.usefulLife) : '';
  const title = endDate ? `Ашиглалтаас гарах огноо: ${_fmtDateSlash(endDate)} (${pct}%)` : 'Тодорхойгүйгүй';
  return `<div class="progress-wrap" style="width:90px;height:5px" title="${title}"><div class="progress-bar" style="width:${pct}%;background:${assetLifeProgressColor(pct)}"></div></div>`;
}

function updateAssetEndOfLifeDate() {
  const purchaseDate = document.getElementById('asset-purchase-date').value;
  const usefulLife = document.getElementById('asset-useful-life').value;
  document.getElementById('asset-end-of-life').value = purchaseDate ? addMonths(purchaseDate, usefulLife) : '';
}

function updateDepreciationPreview() {
  const cost = +document.getElementById('asset-cost').value || 0;
  const usefulLife = +document.getElementById('asset-useful-life').value || 60;
  const salvage = +document.getElementById('asset-salvage').value || 0;
  const purchaseDate = document.getElementById('asset-purchase-date').value;
  const decliningRate = +document.getElementById('asset-declining-rate').value || 20;

  // --- Шугаман элэгдэл ---
  const slMonthly = (cost - salvage) / usefulLife;
  const slYearly = slMonthly * Math.min(12, usefulLife);
  const slLive = computeDepreciation({cost, salvage, usefulLife, purchaseDate, depMethod:'straight_line', status:'active'});
  document.getElementById('dep-preview-sl-monthly').textContent = fmtMoney(Math.round(slMonthly));
  document.getElementById('dep-preview-sl-yearly').textContent = fmtMoney(Math.round(slYearly));
  document.getElementById('dep-preview-sl-accum').textContent = fmtMoney(Math.round(slLive.accumulated));
  document.getElementById('dep-preview-sl-book').textContent = fmtMoney(Math.round(slLive.bookValue));

  // --- Хурдасгасан элэгдэл ---
  const dbMonthlyRate = (decliningRate/100)/12;
  const dbMonthly = Math.min(cost - salvage, cost * dbMonthlyRate);
  let bal = cost, dbYearly = 0;
  for(let m=0; m<Math.min(12,usefulLife); m++) {
    const dep = Math.min(bal-salvage, bal*dbMonthlyRate);
    if(dep<=0) break;
    bal -= dep; dbYearly += dep;
  }
  const dbLive = computeDepreciation({cost, salvage, usefulLife, purchaseDate, depMethod:'declining_balance', decliningRate, status:'active'});
  document.getElementById('dep-preview-db-monthly').textContent = fmtMoney(Math.round(dbMonthly));
  document.getElementById('dep-preview-db-yearly').textContent = fmtMoney(Math.round(dbYearly));
  document.getElementById('dep-preview-db-accum').textContent = fmtMoney(Math.round(dbLive.accumulated));
  document.getElementById('dep-preview-db-book').textContent = fmtMoney(Math.round(dbLive.bookValue));
}

function accumulatedDepreciationAtMonths(a, monthsElapsed) {
  monthsElapsed = Math.max(0, Math.min(monthsElapsed, a.usefulLife||0));
  if(a.depMethod === 'declining_balance') {
    const annualRate = (a.decliningRate||20) / 100;
    const monthlyRate = annualRate / 12;
    let bookValue = a.cost;
    let accumulated = 0;
    for(let m=0; m<monthsElapsed; m++) {
      const dep = Math.min(bookValue - a.salvage, bookValue * monthlyRate);
      if(dep <= 0) break;
      bookValue -= dep;
      accumulated += dep;
    }
    return accumulated;
  } else {
    const monthlyDep = (a.cost - a.salvage) / (a.usefulLife||1);
    return Math.min(monthlyDep * monthsElapsed, a.cost - a.salvage);
  }
}

function computeDepreciation(a) {
  if(!a.purchaseDate || !a.usefulLife) {
    return {accumulated:0, bookValue:a.cost};
  }
  const endDateStr = (a.status==='disposed' && a.disposalDate) ? a.disposalDate : new Date().toISOString().slice(0,10);
  const monthsElapsed = monthsBetweenDates(a.purchaseDate, endDateStr);
  const accumulated = accumulatedDepreciationAtMonths(a, monthsElapsed);
  return {accumulated, bookValue: Math.max(a.cost - accumulated, a.salvage)};
}

async function syncAssetDepreciationSnapshots() {
  const stale = [];
  assets.forEach(a=>{
    if(!a.dbId || a.status==='disposed') return;
    const {accumulated, bookValue} = computeDepreciation(a);
    const drift = Math.abs((a.accumulatedDepreciation||0) - accumulated);
    if(drift >= 1) {
      a.accumulatedDepreciation = accumulated;
      a.netBookValue = bookValue;
      stale.push({dbId:a.dbId, accumulated, bookValue});
    }
  });
  if(!stale.length) return;
  // .update() ашиглана — .upsert() ашиглавал NOT NULL баганатай (name гм) мөргөлдөх эрсдэлтэй
  await Promise.all(stale.map(s =>
    sb.from('fixed_assets').update({
      accumulated_depreciation: s.accumulated, net_book_value: s.bookValue,
      depreciation_updated_at: new Date().toISOString()
    }).eq('id', s.dbId)
  )).catch(e => console.error('depreciation snapshot sync error:', e.message));
}

// ⚠️ ӨНӨӨДРИЙН ЗАСВАР: Өмнө нь "энэ сард аль хэдийн бичигдсэн үү" гэдгийг
// зөвхөн `transactions` массиваас шалгадаг байсан тул, хэрэв админ 2+ сар
// апп руу нэвтрэхгүй бол алдагдсан саруудыг хэзээ ч НӨХДӨГГҮЙ асуудалтай
// байсан. Одоо LEDGER-ийн бодит үлдэгдлийг (2015 данс, тухайн хөрөнгийн
// party-гаар) томьёотой ШУУД ХАРЬЦУУЛЖ, зөрүүг (gap) л нэг удаад нөхдөг
// болгосон — хэдэн сар алгассан ч, хэдэн удаа дараалан ажилласан ч үргэлж
// ЗӨВ дүнд (томьёогоор тооцоолсонтой яг тэнцүү) хүрдэг өөрөө засагддаг арга.
async function syncMonthlyDepreciationExpenses() {
  for (const a of assets) {
    if (!a.dbId || a.status === 'disposed' || !a.purchaseDate || !a.usefulLife) continue;
    const monthsElapsed = monthsBetweenDates(a.purchaseDate, new Date().toISOString().slice(0, 10));
    if (monthsElapsed <= 0) continue;
    const formulaAccumulated = accumulatedDepreciationAtMonths(a, Math.min(monthsElapsed, a.usefulLife));
    if (formulaAccumulated < 1) continue;

    let ledgerAccumulated = 0;
    try {
      ledgerAccumulated = (typeof db_getPartyBalance === 'function') ? await db_getPartyBalance('2015', 'asset:' + a.dbId) : 0;
    } catch (e) { console.warn('Ledger үлдэгдэл асуухад алдаа:', e); continue; }

    const gap = +(formulaAccumulated - ledgerAccumulated).toFixed(2);
    if (gap < 1) continue; // ledger аль хэдийн зөв түвшинд — хийх зүйлгүй

    const row = {
      apt: null, description: `${esc(a.name)} — элэгдэл нөхөх`, subcat: 'Үндсэн хөрөнгийн элэгдэл',
      type: 'expense', amount: Math.round(gap), method: 'бэлэн бус', ref: '', month: CUR_MONTH, year: CUR_YEAR,
      date: todayStr(), status: 'completed', category: 'expense', asset_id: a.dbId
    };
    const { data, error } = await sb.from('transactions').insert(row).select().single();
    if (error) { console.error('depreciation expense insert error:', error.message); continue; }
    transactions.push({
      id: data.id, apt: null, aptId: null, desc: row.description, subcat: row.subcat,
      type: 'expense', amount: Math.round(gap), method: row.method, ref: '', month: CUR_MONTH, year: CUR_YEAR,
      date: row.date, status: 'completed', category: 'expense', clienteleId: null, assetId: a.id
    });
    if (typeof accountingRecordDepreciation === 'function') {
      const res = await accountingRecordDepreciation(a.dbId, a.name, Math.round(gap), row.date);
      if (!res.success) console.warn('Journal entry үүсгэхэд алдаа:', res.error);
    }
  }
  renderIncomeTable(); // Зарлагын хүснэгт идэвхтэй хуудсан дээр байвал шинэчлэгдэнэ (fin-expenses tab-той хамт)
  renderExpenseTable();
}

function _assetActionIcons(a, canEditA, canDelA) {
  return _rowActionIcons(a.id, canEditA, canDelA, 'editAsset', 'deleteAsset');
}

// Жагсаалт табын header доорх тогтмол "НИЙТ" мөрийг шинэчилнэ (Худалдан авсан үнэ, Хуримтлагдсан элэгдэл, Дансны үлдэгдэл үнэ)
function _updateAssetListTotals(list) {
  const elCost = document.getElementById('asset-total-cost');
  const elAccum = document.getElementById('asset-total-accum');
  const elNbv = document.getElementById('asset-total-nbv');
  if(!elCost || !elAccum || !elNbv) return;
  let totalCost = 0, totalAccum = 0, totalNbv = 0;
  list.forEach(a=>{
    totalCost += a.cost||0;
    const {accumulated, bookValue} = computeDepreciation(a);
    totalAccum += accumulated;
    totalNbv += bookValue;
  });
  elCost.textContent = fmtMoney(totalCost);
  elAccum.textContent = fmtMoney(totalAccum);
  elNbv.textContent = fmtMoney(totalNbv);
}

function renderAssets(view, filter='', responsibleFilter='', locationFilter='') {
  const body = document.getElementById('asset-'+view+'-table-body');
  if(!body) return;
  const canEditA = canWrite('assets'), canDelA = canDelete('assets');
  let list = assets.filter(a=>{
    if(responsibleFilter && (a.responsible||'') !== responsibleFilter) return false;
    if(locationFilter && (a.location||'') !== locationFilter) return false;
    if(!filter) return true;
    const q = filter.toLowerCase();
    return (a.name||'').toLowerCase().includes(q) || (a.code||'').toLowerCase().includes(q)
      || (a.subcategory||'').toLowerCase().includes(q) || (a.location||'').toLowerCase().includes(q)
      || (a.responsible||'').toLowerCase().includes(q);
  });
  // НЭР, БРЕНД баганаар байнга A-Z (Монгол цагаан толгойн дараалал) харуулна
  list = list.slice().sort((a,b)=>(a.name||'').localeCompare((b.name||''), 'mn'));
  const colspan = view==='list' ? 14 : 11;
  if(!list.length){
    body.innerHTML=`<tr><td colspan="${colspan}" style="text-align:center;padding:24px;color:var(--text-muted)">Хөрөнгө олдсонгүй</td></tr>`;
    if(view==='list') _updateAssetListTotals([]);
    return;
  }

  if(view==='list') {
    body.innerHTML = list.map((a,idx)=>{
      const {accumulated, bookValue} = computeDepreciation(a);
      const statusColor = a.status==='active'?'var(--success)':a.status==='repair'?'var(--warning)':'var(--text-muted)';
      return `<tr style="cursor:pointer" onclick="openAssetDetail(${a.id})">
        <td><div class="avatar" style="width:24px;height:24px;font-size:10px;font-weight:700;background:rgba(59,130,246,0.18);color:#60A5FA">${idx+1}</div></td>
        <td><span class="dt-title">${esc(a.name)}</span></td>
        <td class="dt-text dt-mono">${esc(a.code)||'—'}</td>
        <td class="dt-muted">${esc(a.subcategory)||'—'}</td>
        <td class="dt-text dt-mono">${a.quantity} ${a.unit}</td>
        <td class="dt-text">${_fmtDateSlash(a.purchaseDate)||'—'}</td>
        <td class="dt-text dt-mono" style="text-align:right">${a.cost?fmtMoney(a.cost):'—'}</td>
        <td class="dt-text dt-mono" style="text-align:right">${fmtMoney(accumulated)}</td>
        <td class="dt-text dt-mono" style="text-align:right">${fmtMoney(bookValue)}</td>
        <td class="dt-muted">${esc(a.location)||'—'}</td>
        <td class="dt-muted">${esc(_responsibleDisplayName(a.responsible))||'—'}</td>
        <td><span class="dt-muted" style="color:${statusColor};font-weight:600">${ASSET_STATUS_LABELS[a.status]}</span></td>
        <td>${assetLifeProgressBarHTML(a)}</td>
        <td>${_assetActionIcons(a,canEditA,canDelA)}</td>
      </tr>`;
    }).join('');
    const stat = document.getElementById('asset-list-stat');
    if(stat) {
      const totalCost = list.reduce((s,a)=>s+a.cost,0);
      const disposedCount = list.filter(a=>a.status==='disposed').length;
      stat.textContent = `Нийт: ${list.length} зүйл · Худалдан авсан үнэ: ${fmtMoney(totalCost)} · Актлагдсан: ${disposedCount}`;
    }
    _updateAssetListTotals(list);
  } else {
    body.innerHTML = list.map((a,idx)=>{
      const {accumulated, bookValue} = computeDepreciation(a);
      const endOfLife = a.purchaseDate ? _fmtDateSlash(addMonths(a.purchaseDate, a.usefulLife)) : '—';
      const statusColor = a.status==='active'?'var(--success)':a.status==='repair'?'var(--warning)':'var(--text-muted)';
      return `<tr style="cursor:pointer" onclick="openAssetDetail(${a.id})">
        <td><div class="avatar" style="width:24px;height:24px;font-size:10px;font-weight:700;background:rgba(59,130,246,0.18);color:#60A5FA">${idx+1}</div></td>
        <td><span class="dt-title">${esc(a.name)}</span></td>
        <td class="dt-text dt-mono">${esc(a.code)||'—'}</td>
        <td class="dt-text">${a.usefulLife} сар</td>
        <td class="dt-muted">${endOfLife}</td>
        <td class="dt-text">${a.depMethod==='declining_balance'?'Хурдасгасан элэгдэл':'Шугаман элэгдэл'}</td>
        <td class="dt-text dt-mono" style="text-align:right">${fmtMoney(accumulated)}</td>
        <td class="dt-text dt-mono" style="text-align:right">${fmtMoney(bookValue)}</td>
        <td><span class="dt-muted" style="color:${statusColor};font-weight:600">${ASSET_STATUS_LABELS[a.status]}</span></td>
        <td>${assetLifeProgressBarHTML(a)}</td>
        <td>${_assetActionIcons(a,canEditA,canDelA)}</td>
      </tr>`;
    }).join('');
    const stat = document.getElementById('asset-depreciation-stat');
    if(stat) {
      const totalBook = list.reduce((s,a)=>s+computeDepreciation(a).bookValue,0);
      stat.textContent = `Нийт: ${list.length} зүйл · Нийт дансны үлдэгдэл: ${fmtMoney(totalBook)}`;
    }
  }
}

function filterAssets(tab) {
  const q = document.getElementById('asset-'+tab+'-search')?.value || '';
  if(tab==='maintenance') { renderMaintenance(q); return; }
  const responsibleFilter = document.getElementById('asset-'+tab+'-responsible-filter')?.value || '';
  const locationFilter = document.getElementById('asset-'+tab+'-location-filter')?.value || '';
  renderAssets(tab, q, responsibleFilter, locationFilter);
}

let editingAssetId = null;

function populateAssetCategorySelect(keepValue) {
  const sel = document.getElementById('asset-category');
  if(!sel) return;
  sel.innerHTML = ASSET_CATEGORIES.map(c=>`<option value="${esc(c.code)}">${esc(c.label)}</option>`).join('');
  if(keepValue && ASSET_CATEGORIES.some(c=>c.code===keepValue)) sel.value = keepValue;
}
function populateAssetLocationSelect(keepValue) {
  const sel = document.getElementById('asset-location');
  if(!sel) return;
  sel.innerHTML = '<option value="">— Байршил сонгох —</option>' + ASSET_LOCATIONS.map(l=>`<option value="${esc(l.label)}">${esc(l.label)}</option>`).join('');
  if(keepValue) sel.value = keepValue;
}
function populateAssetResponsibleSelect(keepValue) {
  const sel = document.getElementById('asset-responsible');
  if(!sel) return;
  sel.innerHTML = '<option value="">— Хариуцагч сонгох —</option>' + employees.map(e=>`<option value="${esc(e.fullName)}">${esc(_employeeDisplayName(e))}</option>`).join('');
  if(keepValue) sel.value = keepValue;
}

function openAddAsset() {
  if(!canWrite('assets')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  editingAssetId = null;
  document.getElementById('modal-asset-title').textContent = 'Хөрөнгийн бүртгэл нэмэх';
  ['asset-name','asset-code','asset-note','asset-vendor'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  populateAssetCategorySelect();
  populateAssetLocationSelect();
  populateAssetResponsibleSelect();
  updateAssetTypeOptions();
  document.getElementById('asset-quantity').value = 1;
  document.getElementById('asset-unit').value = 'ширхэг';
  document.getElementById('asset-purchase-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('asset-cost').value = 0;
  document.getElementById('asset-salvage').value = 0;
  document.getElementById('asset-declining-rate').value = 20;
  document.getElementById('asset-group').value = 'hoa';
  applyAssetDefaultsForCategory();
  openModal('modal-asset');
}

function editAsset(id) {
  if(!canWrite('assets')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  const a = assets.find(x=>x.id===id); if(!a) return;
  editingAssetId = id;
  document.getElementById('modal-asset-title').textContent = 'Хөрөнгийн бүртгэл засах';
  document.getElementById('asset-name').value = a.name||'';
  document.getElementById('asset-code').value = a.code||'';
  populateAssetCategorySelect(a.category||'office_equipment');
  updateAssetTypeOptions(a.subcategory);
  document.getElementById('asset-quantity').value = a.quantity||1;
  document.getElementById('asset-unit').value = a.unit||'ширхэг';
  document.getElementById('asset-purchase-date').value = a.purchaseDate||'';
  document.getElementById('asset-cost').value = a.cost||0;
  document.getElementById('asset-vendor').value = a.vendor||'';
  populateAssetLocationSelect(a.location||'');
  populateAssetResponsibleSelect(a.responsible||'');
  document.getElementById('asset-note').value = a.note||'';
  document.getElementById('asset-useful-life').value = a.usefulLife||60;
  document.getElementById('asset-dep-method').value = a.depMethod||'straight_line';
  document.getElementById('asset-salvage').value = a.salvage||0;
  document.getElementById('asset-declining-rate').value = a.decliningRate||20;
  document.getElementById('asset-declining-rate-group').style.display = (a.depMethod==='declining_balance') ? 'block' : 'none';
  document.getElementById('asset-group').value = a.assetGroup;
  updateAssetEndOfLifeDate();
  updateDepreciationPreview();
  openModal('modal-asset');
}

function _renderBothAssetViews() {
  renderAssets('list', document.getElementById('asset-list-search')?.value||'', document.getElementById('asset-list-responsible-filter')?.value||'', document.getElementById('asset-list-location-filter')?.value||'');
  renderAssets('depreciation', document.getElementById('asset-depreciation-search')?.value||'', document.getElementById('asset-depreciation-responsible-filter')?.value||'', document.getElementById('asset-depreciation-location-filter')?.value||'');
}

async function saveAsset() {
  const name = document.getElementById('asset-name').value.trim();
  if(!name){toast('Хөрөнгийн нэрийг оруулна уу','error');return;}
  // ⚠️ 2026-07-19: ЧУХАЛ ХАМГААЛАЛТ — Засах горимд байхад (editingAssetId
  // тохируулагдсан) тухайн хөрөнгө local assets массивт олдохгүй бол (жиш нь
  // өгөгдөл дахин ачаалагдсаны улмаас ID зөрчилдсөн үед), ӨМНӨ нь ЧИМЭЭГҮЙГЭЭР
  // шинэ хуулбар үүсгэдэг байсан (INSERT db_saveAsset-ийн editingAssetId=null-тэй
  // адил замаар орсноос) — энэ нь "нэг лифт 3 удаа засварлаад, DB дээр 3
  // ХУУЛБАР болсон" гэсэн ноцтой алдааны шалтгаан байсан. Одоо тодорхой алдаа
  // өгч, хадгалахыг ЗОГСООНО.
  if(editingAssetId && !assets.find(a=>a.id===editingAssetId)) {
    toast('Засварлах гэж буй хөрөнгө олдсонгүй — хуудсаа дахин ачаалаад дахин оролдоно уу', 'error');
    return;
  }
  const _editing = editingAssetId ? assets.find(a=>a.id===editingAssetId) : null;
  const data = {
    id: _editing?.id || null,
    dbId: _editing?.dbId || null,
    name,
    code: document.getElementById('asset-code').value.trim(),
    assetGroup: document.getElementById('asset-group').value,
    category: document.getElementById('asset-category').value,
    subcategory: document.getElementById('asset-subcategory').value,
    quantity: +document.getElementById('asset-quantity').value || 1,
    unit: document.getElementById('asset-unit').value,
    purchaseDate: document.getElementById('asset-purchase-date').value,
    cost: +document.getElementById('asset-cost').value || 0,
    vendor: document.getElementById('asset-vendor').value.trim(),
    location: document.getElementById('asset-location').value.trim(),
    responsible: document.getElementById('asset-responsible').value.trim(),
    note: document.getElementById('asset-note').value.trim(),
    usefulLife: +document.getElementById('asset-useful-life').value || 60,
    depMethod: document.getElementById('asset-dep-method').value,
    decliningRate: +document.getElementById('asset-declining-rate').value || 20,
    salvage: +document.getElementById('asset-salvage').value || 0,
    status: _editing?.status || 'active',
    disposalDate: _editing?.disposalDate || '', disposalReason: _editing?.disposalReason || '', disposalValue: _editing?.disposalValue || null
  };
  // Хадгалах агшны элэгдлийн snapshot тооцоолол (тайлан/экспортод шууд ашиглах зорилготой)
  const {accumulated, bookValue} = computeDepreciation(data);
  data.accumulatedDepreciation = accumulated;
  data.netBookValue = bookValue;
  const ok = await db_saveAsset(data);
  if(!ok) { toast('Хадгалахад алдаа гарлаа — таны рольд энэ үйлдэл хийх эрх байхгүй байж болзошгүй','error'); return; }
  const isNewAsset = !editingAssetId;
  const oldCost = _editing?.cost;
  if(editingAssetId) {
    const idx = assets.findIndex(a=>a.id===editingAssetId);
    if(idx>=0) assets[idx] = {...assets[idx], ...data};
    toast('Мэдээлэл шинэчлэгдлээ','success');
  } else {
    assets.push({id:nextId++, ...data});
    toast(name+' нэмэгдлээ','success');
  }
  // Нягтлан бодох бүртгэлийн журнал бичилт (нэмэлт)
  if (isNewAsset && typeof accountingRecordAssetPurchase === 'function') {
    accountingRecordAssetPurchase(data.dbId, name, data.cost, data.purchaseDate || todayStr())
      .then(res => { if (!res.success) console.warn('Journal entry үүсгэхэд алдаа:', res.error); })
      .catch(e => console.warn('Journal entry үүсгэхэд алдаа:', e));
  } else if (!isNewAsset && typeof accountingRecordAssetCostCorrection === 'function' && oldCost !== undefined && Math.abs((data.cost||0) - oldCost) >= 1) {
    // Хөрөнгийн өртгийг ЗАСВАРЛАСАН бол (шинэ бус) — 2010 дансыг мөн тохируулна
    accountingRecordAssetCostCorrection(data.dbId, name, oldCost, data.cost, todayStr())
      .then(res => { if (!res.success) console.warn('Журналын засварт алдаа:', res.error); })
      .catch(e => console.warn('Журналын засварт алдаа:', e));
  }
  closeModal('modal-asset');
  _renderBothAssetViews();
}

async function deleteAsset(id) {
  if(!confirm('Устгах уу? Энэ үйлдлийг буцаах боломжгүй.\n\nАнхаар: Энэ хөрөнгөтэй холбоотой Засвар үйлчилгээний бүртгэл мөн устгагдана. Санхүүгийн гүйлгээний түүх (жишээ элэгдлийн зарлага) хадгалагдана.')) return;
  try {
    await db_deleteAsset(id);
  } catch(e) {
    toast('Устгахад эрхгүй байна эсвэл алдаа гарлаа: ' + e.message, 'error');
    return;
  }
  assets = assets.filter(x=>x.id!==id);
  _renderBothAssetViews();
  toast('Устгагдлаа','success');
}

let disposingAssetId = null;

let selectedAssetForDetail = null;

function openAssetDetail(id) {
  const a = assets.find(x=>x.id===id); if(!a) return;
  selectedAssetForDetail = a;
  document.getElementById('asset-detail-title').textContent = a.name;
  const {accumulated, bookValue} = computeDepreciation(a);
  const endOfLife = a.purchaseDate ? _fmtDateSlash(addMonths(a.purchaseDate, a.usefulLife)) : '—';
  const pct = assetLifeProgressPct(a);
  const statusColor = a.status==='active'?'var(--success)':a.status==='repair'?'var(--warning)':'var(--text-muted)';
  document.getElementById('asset-detail-body').innerHTML = `
    <div class="summary-row"><span class="summary-key">Марк, сериал, баркод</span><span class="summary-val">${esc(a.code)||'—'}</span></div>
    <div class="summary-row"><span class="summary-key">Ангилал</span><span class="summary-val">${getAssetCategoryLabel(a.category)}</span></div>
    <div class="summary-row"><span class="summary-key">Төрөл</span><span class="summary-val">${esc(a.subcategory)||'—'}</span></div>
    <div class="summary-row"><span class="summary-key">Тоо хэмжээ</span><span class="summary-val">${a.quantity} ${a.unit}</span></div>
    <div class="summary-row"><span class="summary-key">Худалдан авсан огноо</span><span class="summary-val">${_fmtDateSlash(a.purchaseDate)||'—'}</span></div>
    <div class="summary-row"><span class="summary-key">Худалдан авсан үнэ</span><span class="summary-val">${fmtMoney(a.cost)}</span></div>
    <div class="summary-row"><span class="summary-key">Борлуулагч байгууллага</span><span class="summary-val">${esc(a.vendor)||'—'}</span></div>
    <div class="summary-row"><span class="summary-key">Байршил</span><span class="summary-val">${esc(a.location)||'—'}</span></div>
    <div class="summary-row"><span class="summary-key">Хариуцагч</span><span class="summary-val">${esc(_responsibleDisplayName(a.responsible))||'—'}</span></div>
    <div class="summary-row"><span class="summary-key">Төлөв</span><span class="summary-val" style="color:${statusColor};font-weight:600">${ASSET_STATUS_LABELS[a.status]}</span></div>
    ${a.note?`<div class="summary-row"><span class="summary-key">Тэмдэглэл</span><span class="summary-val" style="text-align:right;max-width:280px">${esc(a.note)}</span></div>`:''}
    <hr class="divider">
    <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Элэгдлийн мэдээлэл</div>
    <div class="summary-row"><span class="summary-key">Ашиглах хугацаа</span><span class="summary-val">${a.usefulLife} сар</span></div>
    <div class="summary-row"><span class="summary-key">Аргачлал</span><span class="summary-val">${a.depMethod==='declining_balance'?'Хурдасгасан элэгдэл':'Шугаман элэгдэл'}</span></div>
    <div class="summary-row"><span class="summary-key">Ашиглалтаас гарах огноо</span><span class="summary-val">${endOfLife}</span></div>
    <div class="summary-row"><span class="summary-key">Хуримтлагдсан элэгдэл</span><span class="summary-val">${fmtMoney(accumulated)}</span></div>
    <div class="summary-row"><span class="summary-key">Дансны үлдэгдэл үнэ</span><span class="summary-val" style="font-weight:700;color:var(--accent)">${fmtMoney(bookValue)}</span></div>
    <div style="margin-top:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:4px">
        <span>Хугацааны явц</span><span>${pct}%</span>
      </div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%;background:${assetLifeProgressColor(pct)}"></div></div>
    </div>
  `;
  document.getElementById('asset-detail-dispose-btn').style.display = a.status==='disposed' ? 'none' : '';
  openModal('modal-asset-detail');
}

function assetDetailEdit() {
  closeModal('modal-asset-detail');
  if(selectedAssetForDetail) editAsset(selectedAssetForDetail.id);
}

function assetDetailDispose() {
  closeModal('modal-asset-detail');
  if(selectedAssetForDetail) openDisposeAsset(selectedAssetForDetail.id);
}

let selectedMaintenanceForDetail = null;

function openMaintenanceDetail(id) {
  const m = assetMaintenance.find(x=>x.id===id); if(!m) return;
  selectedMaintenanceForDetail = m;
  const a = assets.find(x=>x.id===m.assetId);
  document.getElementById('maintenance-detail-body').innerHTML = `
    <div class="summary-row"><span class="summary-key">Хөрөнгө</span><span class="summary-val">${a?esc(a.name):'—'}</span></div>
    <div class="summary-row"><span class="summary-key">Огноо</span><span class="summary-val">${m.date||'—'}</span></div>
    <div class="summary-row"><span class="summary-key">Үнэ</span><span class="summary-val">${fmtMoney(m.cost)}</span></div>
    <div class="summary-row"><span class="summary-key">Үйлчилгээ үзүүлэгч байгууллага</span><span class="summary-val">${esc(m.vendor)||'—'}</span></div>
    ${m.description?`<div class="summary-row"><span class="summary-key">Тайлбар</span><span class="summary-val" style="text-align:right;max-width:280px">${esc(m.description)}</span></div>`:''}
  `;
  openModal('modal-maintenance-detail');
}

function maintenanceDetailEdit() {
  closeModal('modal-maintenance-detail');
  if(selectedMaintenanceForDetail) editMaintenance(selectedMaintenanceForDetail.id);
}

function openDisposeAsset(id) {
  if(!canWrite('assets')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  disposingAssetId = id;
  document.getElementById('asset-disposal-id').value = id;
  document.getElementById('asset-disposal-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('asset-disposal-reason').value = 'Эвдэрсэн';
  document.getElementById('asset-disposal-value').value = 0;
  openModal('modal-asset-disposal');
}

async function confirmDisposeAsset() {
  const id = +document.getElementById('asset-disposal-id').value;
  const a = assets.find(x=>x.id===id); if(!a) return;
  const updated = {
    ...a,
    status: 'disposed',
    disposalDate: document.getElementById('asset-disposal-date').value,
    disposalReason: document.getElementById('asset-disposal-reason').value,
    disposalValue: +document.getElementById('asset-disposal-value').value || 0
  };
  const {error} = await sb.from('fixed_assets').update({
    status:'disposed', disposal_date:updated.disposalDate, disposal_reason:updated.disposalReason, disposal_value:updated.disposalValue
  }).eq('id', a.dbId);
  if(error) { toast('Актлахад алдаа гарлаа: '+error.message, 'error'); return; }
  const idx = assets.findIndex(x=>x.id===id);
  if(idx>=0) assets[idx] = updated;
  // Нягтлан бодох бүртгэлийн журнал бичилт (нэмэлт) — эхлээд ledger-ийг сүүлийн
  // мөчийн байдалд (өнөөдөр хүртэл) НӨХӨЖ, дараа нь БОДИТ ledger үлдэгдлээр актална
  // (томьёогоор дахин тооцоолсноор биш — учир нь ledger-т цоорхой байж болзошгүй).
  if (typeof accountingRecordAssetDisposal === 'function') {
    (async () => {
      const {accumulated: formulaAccumulated} = computeDepreciation({...a, status:'disposed', disposalDate: updated.disposalDate});
      const ledgerAccumulated = await db_getPartyBalance('2015', 'asset:' + a.dbId);
      const gap = +(formulaAccumulated - ledgerAccumulated).toFixed(2);
      if (gap >= 1) {
        await accountingRecordDepreciation(a.dbId, a.name, gap, updated.disposalDate || todayStr());
      }
      const finalAccumulated = gap >= 1 ? formulaAccumulated : ledgerAccumulated;
      const res = await accountingRecordAssetDisposal(a.dbId, a.name, a.cost, finalAccumulated, updated.disposalValue, updated.disposalDate || todayStr());
      if (!res.success) console.warn('Journal entry үүсгэхэд алдаа:', res.error);
    })().catch(e => console.warn('Journal entry үүсгэхэд алдаа:', e));
  }
  closeModal('modal-asset-disposal');
  renderAssets(a.assetGroup);
  toast(a.name+' актлагдлаа','success');
}

function renderMaintenance(filter='') {
  const body = document.getElementById('asset-maintenance-table-body');
  if(!body) return;
  const canEditA = canWrite('assets'), canDelA = canDelete('assets');
  const list = assetMaintenance.filter(m=>{
    if(!filter) return true;
    const q = filter.toLowerCase();
    const a = assets.find(x=>x.id===m.assetId);
    return (a?.name||'').toLowerCase().includes(q) || (m.description||'').toLowerCase().includes(q);
  }).sort((a,b)=>b.id-a.id);
  if(!list.length){body.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">Засвар үйлчилгээ олдсонгүй</td></tr>`;return;}
  body.innerHTML = list.map((m,idx)=>{
    const a = assets.find(x=>x.id===m.assetId);
    return `<tr style="cursor:pointer" onclick="openMaintenanceDetail(${m.id})">
      <td><div class="avatar" style="width:24px;height:24px;font-size:10px;font-weight:700;background:rgba(59,130,246,0.18);color:#60A5FA">${idx+1}</div></td>
      <td><span class="dt-title">${a?esc(a.name):'—'}</span></td>
      <td class="dt-muted">${m.date||'—'}</td>
      <td class="dt-text">${esc(m.description)||'—'}</td>
      <td class="dt-text dt-mono" style="text-align:right">${m.cost?fmtMoney(m.cost):'—'}</td>
      <td class="dt-muted">${esc(m.vendor)||'—'}</td>
      <td>${_rowActionIcons(m.id,canEditA,canDelA,'editMaintenance','deleteMaintenance')}</td>
    </tr>`;
  }).join('');
  const stat = document.getElementById('asset-maintenance-stat');
  if(stat) {
    const totalCost = list.reduce((s,m)=>s+m.cost,0);
    stat.textContent = `Нийт: ${list.length} бүртгэл · Нийт зардал: ${fmtMoney(totalCost)}`;
  }
}

function populateMaintenanceAssetSelect() {
  const sel = document.getElementById('maintenance-asset');
  if(!sel) return;
  sel.innerHTML = '<option value="">— Сонгох —</option>' +
    assets.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
}

function openAddMaintenance() {
  if(!canWrite('assets')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  editingMaintenanceId = null;
  document.getElementById('modal-maintenance-title').textContent = 'Засвар бүртгэх';
  populateMaintenanceAssetSelect();
  document.getElementById('maintenance-asset').value = '';
  document.getElementById('maintenance-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('maintenance-cost').value = 0;
  document.getElementById('maintenance-description').value = '';
  document.getElementById('maintenance-vendor').value = '';
  openModal('modal-maintenance');
}

function editMaintenance(id) {
  if(!canWrite('assets')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  const m = assetMaintenance.find(x=>x.id===id); if(!m) return;
  editingMaintenanceId = id;
  document.getElementById('modal-maintenance-title').textContent = 'Засвар засах';
  populateMaintenanceAssetSelect();
  document.getElementById('maintenance-asset').value = m.assetId||'';
  document.getElementById('maintenance-date').value = m.date||'';
  document.getElementById('maintenance-cost').value = m.cost||0;
  document.getElementById('maintenance-description').value = m.description||'';
  document.getElementById('maintenance-vendor').value = m.vendor||'';
  openModal('modal-maintenance');
}

async function saveMaintenance() {
  const assetIdRaw = document.getElementById('maintenance-asset').value;
  if(!assetIdRaw){toast('Хөрөнгө сонгоно уу','error');return;}
  const _editing = editingMaintenanceId ? assetMaintenance.find(m=>m.id===editingMaintenanceId) : null;
  const data = {
    id: _editing?.id || null,
    dbId: _editing?.dbId || null,
    assetId: +assetIdRaw,
    date: document.getElementById('maintenance-date').value,
    cost: +document.getElementById('maintenance-cost').value || 0,
    description: document.getElementById('maintenance-description').value.trim(),
    vendor: document.getElementById('maintenance-vendor').value.trim()
  };
  const ok = await db_saveMaintenance(data);
  if(!ok) { toast('Хадгалахад алдаа гарлаа — таны рольд энэ үйлдэл хийх эрх байхгүй байж болзошгүй','error'); return; }
  if(editingMaintenanceId) {
    const idx = assetMaintenance.findIndex(m=>m.id===editingMaintenanceId);
    if(idx>=0) assetMaintenance[idx] = {...assetMaintenance[idx], ...data};
    toast('Мэдээлэл шинэчлэгдлээ','success');
  } else {
    assetMaintenance.push({id:nextId++, ...data});
    toast('Засвар бүртгэгдлээ','success');
  }
  closeModal('modal-maintenance');
  renderMaintenance(document.getElementById('asset-maintenance-search')?.value||'');
}

async function deleteMaintenance(id) {
  if(!confirm('Устгах уу?')) return;
  try {
    await db_deleteMaintenance(id);
  } catch(e) {
    toast('Устгахад эрхгүй байна эсвэл алдаа гарлаа: ' + e.message, 'error');
    return;
  }
  assetMaintenance = assetMaintenance.filter(x=>x.id!==id);
  renderMaintenance(document.getElementById('asset-maintenance-search')?.value||'');
  toast('Устгагдлаа','success');
}

// ============================================================
// "ҮНДСЭН ХӨРӨНГӨ ТОХИРГОО" — Ангилал/Төрөл/Байршил CRUD (Admin хуудас)
// ============================================================
function switchAssetSettingsTab(name, el) {
  ['category','type','location'].forEach(id=>{
    const e = document.getElementById('asset-settings-'+id);
    if(e) e.style.display = (id===name) ? 'block' : 'none';
  });
  document.querySelectorAll('#asset-settings-tabs .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  if(name==='category') renderAssetCategorySettingsList();
  else if(name==='type') { populateAssetTypeFilterCategorySelect(); renderAssetTypeSettingsList(); }
  else if(name==='location') renderAssetLocationSettingsList();
}

// ---------- АНГИЛАЛ ----------
function renderAssetCategorySettingsList() {
  const el = document.getElementById('asset-category-settings-list');
  if(!el) return;
  if(!ASSET_CATEGORIES.length) { el.innerHTML = '<div class="empty-state">Ангилал бүртгэгдээгүй байна</div>'; return; }
  el.innerHTML = ASSET_CATEGORIES.map(c => {
    const typeCount = ASSET_TYPES.filter(t=>t.category_code===c.code).length;
    return `
    <div class="card mb-16" style="padding:18px">
      <div class="flex-between">
        <div>
          <div style="font-weight:700">${esc(c.label)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Код: ${esc(c.code)} · ${typeCount} төрөл · Анхдагч: ${c.default_life_months} сар, ${c.default_dep_method==='declining_balance'?'Хурдасгасан':'Шугаман'} элэгдэл</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost btn-sm" onclick='openEditAssetCategory(${JSON.stringify(c).replace(/'/g,"&apos;")})' style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Засах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteAssetCategory('${esc(c.code)}')" style="padding:4px;display:inline-flex;align-items:center;color:var(--danger)" title="Устгах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </div>
      </div>
    </div>`;
  }).join('');
}
function openAddAssetCategory() {
  document.getElementById('modal-asset-category-title').textContent = 'Шинэ ангилал нэмэх';
  document.getElementById('asset-category-code-original').value = '';
  document.getElementById('asset-category-code').value = '';
  document.getElementById('asset-category-code').disabled = false;
  document.getElementById('asset-category-label').value = '';
  document.getElementById('asset-category-life').value = 60;
  document.getElementById('asset-category-method').value = 'straight_line';
  openModal('modal-asset-category');
}
function openEditAssetCategory(c) {
  document.getElementById('modal-asset-category-title').textContent = 'Ангилал засах';
  document.getElementById('asset-category-code-original').value = c.code;
  document.getElementById('asset-category-code').value = c.code;
  document.getElementById('asset-category-code').disabled = true; // код — бусад хүснэгэлтэй холбогдсон тул засварлахгүй
  document.getElementById('asset-category-label').value = c.label;
  document.getElementById('asset-category-life').value = c.default_life_months;
  document.getElementById('asset-category-method').value = c.default_dep_method;
  openModal('modal-asset-category');
}
async function saveAssetCategory() {
  const code = document.getElementById('asset-category-code').value.trim();
  const label = document.getElementById('asset-category-label').value.trim();
  if(!code || !label) { toast('Код болон нэрийг бөглөнө үү', 'error'); return; }
  const row = {
    code, label,
    default_life_months: +document.getElementById('asset-category-life').value || 60,
    default_dep_method: document.getElementById('asset-category-method').value,
  };
  const { error } = await sb.from('asset_categories').upsert(row, { onConflict: 'code' });
  if(error) { toast('Хадгалахад алдаа гарлаа: ' + error.message, 'error'); return; }
  closeModal('modal-asset-category');
  toast('Хадгалагдлаа', 'success');
  await db_loadAssetSettings();
  renderAssetCategorySettingsList();
}
async function deleteAssetCategory(code) {
  const typeCount = ASSET_TYPES.filter(t=>t.category_code===code).length;
  const msg = typeCount>0
    ? `Энэ ангилалыг устгах уу? Дотор нь бүртгэлтэй ${typeCount} төрөл ч мөн хамт устгагдана.`
    : 'Энэ ангилалыг устгах уу?';
  if(!confirm(msg)) return;
  const { error } = await sb.from('asset_categories').delete().eq('code', code);
  if(error) { toast('Устгахад алдаа гарлаа: ' + error.message, 'error'); return; }
  toast('Устгагдлаа', 'success');
  await db_loadAssetSettings();
  renderAssetCategorySettingsList();
}

// ---------- ТӨРӨЛ ----------
function populateAssetTypeFilterCategorySelect() {
  const sel = document.getElementById('asset-type-filter-category');
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = ASSET_CATEGORIES.map(c=>`<option value="${esc(c.code)}">${esc(c.label)}</option>`).join('');
  if(cur && ASSET_CATEGORIES.some(c=>c.code===cur)) sel.value = cur;
}
function renderAssetTypeSettingsList() {
  const el = document.getElementById('asset-type-settings-list');
  if(!el) return;
  const catCode = document.getElementById('asset-type-filter-category')?.value;
  const list = ASSET_TYPES.filter(t=>t.category_code===catCode);
  if(!list.length) { el.innerHTML = '<div class="empty-state">Энэ ангилалд төрөл бүртгэгдээгүй байна</div>'; return; }
  el.innerHTML = list.map(t => `
    <div class="card mb-16" style="padding:14px 18px">
      <div class="flex-between">
        <div style="font-weight:600">${esc(t.label)}</div>
        <button class="btn btn-ghost btn-sm" onclick="deleteAssetType(${t.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--danger)" title="Устгах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
      </div>
    </div>`).join('');
}
function openAddAssetType() {
  const sel = document.getElementById('asset-type-category');
  sel.innerHTML = ASSET_CATEGORIES.map(c=>`<option value="${esc(c.code)}">${esc(c.label)}</option>`).join('');
  const filterCat = document.getElementById('asset-type-filter-category')?.value;
  if(filterCat) sel.value = filterCat;
  document.getElementById('asset-type-label').value = '';
  openModal('modal-asset-type');
}
async function saveAssetType() {
  const categoryCode = document.getElementById('asset-type-category').value;
  const label = document.getElementById('asset-type-label').value.trim();
  if(!label) { toast('Төрлийн нэрийг бөглөнө үү', 'error'); return; }
  const { error } = await sb.from('asset_types').insert({ category_code: categoryCode, label });
  if(error) { toast('Хадгалахад алдаа гарлаа: ' + (error.code==='23505' ? 'Энэ нэртэй төрөл аль хэдийн байна' : error.message), 'error'); return; }
  closeModal('modal-asset-type');
  toast('Хадгалагдлаа', 'success');
  await db_loadAssetSettings();
  document.getElementById('asset-type-filter-category').value = categoryCode;
  renderAssetTypeSettingsList();
}
async function deleteAssetType(id) {
  if(!confirm('Энэ төрлийг устгах уу?')) return;
  const { error } = await sb.from('asset_types').delete().eq('id', id);
  if(error) { toast('Устгахад алдаа гарлаа: ' + error.message, 'error'); return; }
  toast('Устгагдлаа', 'success');
  await db_loadAssetSettings();
  renderAssetTypeSettingsList();
}

// ---------- БАЙРШИЛ ----------
function renderAssetLocationSettingsList() {
  const el = document.getElementById('asset-location-settings-list');
  if(!el) return;
  if(!ASSET_LOCATIONS.length) { el.innerHTML = '<div class="empty-state">Байршил бүртгэгдээгүй байна</div>'; return; }
  el.innerHTML = ASSET_LOCATIONS.map(l => `
    <div class="card mb-16" style="padding:14px 18px">
      <div class="flex-between">
        <div style="font-weight:600">${esc(l.label)}</div>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" onclick="editAssetLocation(${l.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Засах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteAssetLocation(${l.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--danger)" title="Устгах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </div>
      </div>
    </div>`).join('');
}
let editingAssetLocationId = null;
function openAddAssetLocation() {
  editingAssetLocationId = null;
  document.getElementById('modal-asset-location-title').textContent = 'Шинэ байршил нэмэх';
  document.getElementById('asset-location-label').value = '';
  openModal('modal-asset-location');
}
function editAssetLocation(id) {
  const l = ASSET_LOCATIONS.find(x=>x.id===id); if(!l) return;
  editingAssetLocationId = id;
  document.getElementById('modal-asset-location-title').textContent = 'Байршил засах';
  document.getElementById('asset-location-label').value = l.label;
  openModal('modal-asset-location');
}
async function saveAssetLocation() {
  const label = document.getElementById('asset-location-label').value.trim();
  if(!label) { toast('Байршлын нэрийг бөглөнө үү', 'error'); return; }
  const { error } = editingAssetLocationId
    ? await sb.from('asset_locations').update({ label }).eq('id', editingAssetLocationId)
    : await sb.from('asset_locations').insert({ label });
  if(error) { toast('Хадгалахад алдаа гарлаа: ' + (error.code==='23505' ? 'Энэ нэртэй байршил аль хэдийн байна' : error.message), 'error'); return; }
  closeModal('modal-asset-location');
  toast('Хадгалагдлаа', 'success');
  await db_loadAssetSettings();
  renderAssetLocationSettingsList();
}
async function deleteAssetLocation(id) {
  if(!confirm('Энэ байршлыг устгах уу?')) return;
  const { error } = await sb.from('asset_locations').delete().eq('id', id);
  if(error) { toast('Устгахад алдаа гарлаа: ' + error.message, 'error'); return; }
  toast('Устгагдлаа', 'success');
  await db_loadAssetSettings();
  renderAssetLocationSettingsList();
}
