// businesses.js — Аж ахуйн нэгж ба Харилцагчийн бүртгэлийн модуль
// (suh.html-ээс тусгаарлав)
// Хамаарал: sb (db.js), BUILDINGS (buildings.js), спот сонгогч (parking-storage.js).

async function db_loadBusinesses() {
  const {data,error} = await sb.from('businesses').select('*').order('id');
  if(error){console.error('businesses load error:', JSON.stringify(error), error.message);return;}
  if(!data){console.error('businesses: data null');return;}
  businesses = data.map(b=>({
    id:b.id, dbId:b.id, name:b.name, regno:b.reg_no||'', type:b.type||'tenant',
    ceo:b.ceo||'', mobile:b.mobile||'', phone:b.phone||'', email:b.email||'',
    contract:b.contract_no||'', start:b.contract_start||'', end:b.contract_end||'',
    note:b.note||'', vehicles:b.vehicles||[], parkings:b.parkings||[], storages:b.storages||[], monthlyFee:+b.monthly_fee||0
  }));
}
async function db_saveBusiness(b) {
  const row = {
    name:b.name, reg_no:b.regno, type:b.type, ceo:b.ceo,
    mobile:b.mobile, phone:b.phone, email:b.email, contract_no:b.contract,
    contract_start:b.start, contract_end:b.end, note:b.note, vehicles:b.vehicles, parkings:b.parkings||[], storages:b.storages||[], monthly_fee:b.monthlyFee||0
  };
  if(b.id && b.dbId) {
    // DB-д байгаа бол update — .select() ашиглаж RLS-ээс болж 0 мөр өөрчлөгдсөнийг илрүүлнэ
    const {data, error} = await sb.from('businesses').update(row).eq('id',b.dbId).select();
    if(error) { console.error('business update error:',error.message); return false; }
    if(!data || data.length === 0) { console.warn('business update: 0 мөр — эрхгүй байж болзошгүй'); return false; }
    return true;
  } else {
    const {data,error} = await sb.from('businesses').insert(row).select().single();
    if(error){console.error('business insert error:',error.message); return false;}
    if(data) b.dbId = data.id;
    return true;
  }
}
// --- CLIENTELE (Харилцагчийн бүртгэл) ---
async function db_loadClientele() {
  const {data,error} = await sb.from('clientele').select('*').order('id');
  if(error){console.error('clientele load error:', JSON.stringify(error), error.message);return;}
  if(!data){console.error('clientele: data null');return;}
  clientele = data.map(c=>({
    id:c.id, dbId:c.id, legalName:c.legal_name||'', regNo:c.reg_no||'',
    ceo:c.ceo||'', mobile:c.mobile||'', phone:c.phone||'', email:c.email||'',
    contractNo:c.contract_no||'', contractStart:c.contract_start||'', contractEnd:c.contract_end||'',
    note:c.note||''
  }));
}
async function db_saveClientele(c) {
  const row = {
    legal_name:c.legalName, reg_no:c.regNo, ceo:c.ceo,
    mobile:c.mobile, phone:c.phone, email:c.email,
    contract_no:c.contractNo, contract_start:c.contractStart||null, contract_end:c.contractEnd||null,
    note:c.note||null
  };
  if(c.id && c.dbId) {
    const {data, error} = await sb.from('clientele').update(row).eq('id',c.dbId).select();
    if(error) { console.error('clientele update error:',error.message); return false; }
    if(!data || data.length === 0) { console.warn('clientele update: 0 мөр — эрхгүй байж болзошгүй'); return false; }
    return true;
  } else {
    const {data,error} = await sb.from('clientele').insert(row).select().single();
    if(error){console.error('clientele insert error:',error.message); return false;}
    if(data) c.dbId = data.id;
    return true;
  }
}
async function db_deleteBusiness(id) {
  const {data, error} = await sb.from('businesses').delete().eq('id',id).select();
  if(error) { console.error('business delete error:',error); throw error; }
  if(!data || data.length === 0) { throw new Error('Устгах эрхгүй байна — таны рольд энэ үйлдэл хориотой'); }
}
async function db_deleteClientele(id) {
  const {data, error} = await sb.from('clientele').delete().eq('id',id).select();
  if(error) { console.error('clientele delete error:',error); throw error; }
  if(!data || data.length === 0) { throw new Error('Устгах эрхгүй байна — таны рольд энэ үйлдэл хориотой'); }
}
let editingBusinessId = null;
let businesses = [];
let clientele = []; // Харилцагчийн бүртгэл — зөвхөн DB-ээс ачаална, demo fallback хэрэггүй
// ============================================================
// АЖ АХУЙН НЭГЖ
// ============================================================
function renderBusinesses(filter='') {
  const body = document.getElementById('business-table-body');
  if(!body) return;
  const canEditBiz = canWrite('businesses'), canDelBiz = canDelete('businesses');
  let list = filter ? businesses.filter(b=>{
    const q=filter;
    return b.name.toLowerCase().includes(q)
      ||(b.regno||'').includes(q)
      ||(b.mobile||'').includes(q)
      ||(b.phone||'').includes(q)
      ||(b.contract||'').toLowerCase().includes(q)
      ||(b.vehicles||[]).join(' ').toLowerCase().includes(q);
  }) : businesses;
  // Хуулийн этгээдийн нэрээр байнга A-Z (Монгол цагаан толгойн дараалал) харуулна
  list = list.slice().sort((a,b)=>(a.name||'').localeCompare((b.name||''), 'mn'));
  if(!list.length){body.innerHTML='<tr><td colspan="15" style="text-align:center;padding:24px;color:var(--text-muted)">Аж ахуйн нэгж олдсонгүй</td></tr>';return;}
  const now = new Date();
  const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12];
  body.innerHTML = list.map((b,i)=>{
    const endDate = new Date(b.end.replace(/\//g,'-'));
    const expired = b.end && endDate < now;
    const expiring = !expired && b.end && (endDate - now) < 30*24*60*60*1000;
    const typeLabel = b.type==='owner'?'Өмчлөгч':'Түрээслэгч';
    const typeColor = b.type==='owner'?'var(--accent)':'var(--success)';
    // Гэрээний төлбөрийн 1-12 сарын badge
    const monthBadges = MONTHS.map(m=>{
      const wasPaid = transactions.some(t=>t&&t.type==='income'&&t.category==='business'&&t.businessId===b.id&&t.month===m&&t.year===CUR_YEAR);
      const isFuture = m > CUR_MONTH;
      const cls = isFuture ? 'future' : (wasPaid ? 'paid' : 'unpaid');
      return `<span class="mbadge ${cls}" title="${m}-р сар">${m}</span>`;
    }).join('');
    const paidThisMonthBiz = transactions.some(t=>t&&t.type==='income'&&t.category==='business'&&t.businessId===b.id&&t.month===CUR_MONTH&&t.year===CUR_YEAR);
    return `<tr style="cursor:pointer" onclick="openBusinessDetail(${b.id})">
      <td><div class="avatar" style="width:24px;height:24px;font-size:10px;background:${paidThisMonthBiz?'rgba(59,130,246,0.18)':'rgba(239,68,68,0.15)'};color:${paidThisMonthBiz?'#3B82F6':'#EF4444'}">${i+1}</div></td>
      <td><span class="dt-title">${esc(b.name)}</span></td>
      <td class="dt-text dt-mono">${esc(b.regno)||'—'}</td>
      <td><span class="dt-muted" style="color:${typeColor};font-weight:600">${typeLabel}</span></td>
      <td><span class="dt-title">${esc(b.ceo)||'—'}</span></td>
      <td class="dt-text dt-mono">${esc(b.mobile)||'—'}</td>
      <td class="dt-text dt-mono">${esc(b.phone)||'—'}</td>
      <td class="dt-text">${esc(b.email)||'—'}</td>
      <td class="dt-text">${esc(b.contract)||'—'}</td>
      <td class="dt-text" style="color:var(--text-muted)">${_fmtDateSlash(b.start)}</td>
      <td class="dt-text" style="color:${expired?'var(--danger)':expiring?'var(--warning)':'var(--text-muted)'}">${_fmtDateSlash(b.end)}</td>
      <td class="dt-muted">${(b.vehicles||[]).length?b.vehicles.map(esc).join(", "):"—"}</td>
      <td><div class="month-badges">${monthBadges}</div></td>
      <td><div class="flex gap-8">
        ${canCopy('businesses')?`<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();copyBusiness(${b.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Хуулбарлах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>`:''}
        ${canEditBiz?`<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();editBusiness(${b.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Засах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`:''}
        ${canDelBiz?`<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteBusiness(${b.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--danger)" title="Устгах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>`:''}
        ${!canEditBiz&&!canDelBiz&&!canCopy('businesses')?'<span style="color:var(--text-muted);font-size:11px">—</span>':''}
      </div></td>
    </tr>`;
  }).join('');
  const paidBiz = list.filter(b=>transactions.some(t=>t&&t.type==='income'&&t.category==='business'&&t.businessId===b.id&&t.month===CUR_MONTH&&t.year===CUR_YEAR)).length;
  const stat = document.getElementById('business-stat');
  if(stat) stat.textContent = `Нийт: ${list.length} байгууллага · Өмчлөгч: ${list.filter(b=>b.type==='owner').length} · Түрээслэгч: ${list.filter(b=>b.type==='tenant').length}`;
  const statPaid = document.getElementById('business-stat-paid');
  if(statPaid) statPaid.innerHTML = '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--success);margin-right:5px;vertical-align:middle"></span>Төлбөрийн үлдэгдэлгүй: '+paidBiz;
  const statUnpaid = document.getElementById('business-stat-unpaid');
  if(statUnpaid) statUnpaid.innerHTML = '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--danger);margin-right:5px;vertical-align:middle"></span>Төлбөрийн үлдэгдэлтэй: '+(list.length-paidBiz);
}
function filterBusinesses(){const q=(document.getElementById('business-search')?.value||'').toLowerCase();renderBusinesses(q);}
function openAddBusiness() {
  if(!canWrite('businesses')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  editingBusinessId = null;
  document.getElementById('modal-business-title').textContent = 'Аж ахуйн нэгж нэмэх';
  ['biz-name','biz-regno','biz-ceo','biz-mobile','biz-phone','biz-email','biz-contract','biz-monthly-fee','biz-note'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('biz-vehicle-rows').innerHTML='';
  const hbv=document.getElementById('biz-has-vehicle');
  if(hbv){hbv.checked=false;document.getElementById('biz-vehicle-section').style.display='none';}
  document.getElementById('biz-parking-rows').innerHTML='';
  const hbp=document.getElementById('biz-has-parking');
  if(hbp){hbp.checked=false;document.getElementById('biz-parking-section').style.display='none';}
  document.getElementById('biz-storage-rows').innerHTML='';
  const hbs=document.getElementById('biz-has-storage');
  if(hbs){hbs.checked=false;document.getElementById('biz-storage-section').style.display='none';}
  document.getElementById('biz-type').value='tenant';
  document.getElementById('biz-start').value=todayStr();
  document.getElementById('biz-end').value='';
  openModal('modal-business');
}
// ============================================================
// BUSINESS DETAIL MODAL
// ============================================================
let selectedBusinessForDetail = null;
function openBusinessDetail(id) {
  const b = businesses.find(x=>x.id===id); if(!b) return;
  selectedBusinessForDetail = b;
  document.getElementById('biz-detail-title').textContent = b.name;
  const typeLabel = b.type==='owner'?'Өмчлөгч':'Түрээслэгч';
  const typeColor = b.type==='owner'?'var(--accent)':'var(--success)';
  const now = new Date();
  const endDate = b.end ? new Date(b.end.replace(/\//g,'-')) : null;
  const expired = endDate && endDate < now;
  const expiring = !expired && endDate && (endDate - now) < 30*24*60*60*1000;
  const contractStatus = expired
    ? '<span style="color:var(--danger);font-weight:600">Дууссан</span>'
    : expiring
      ? '<span style="color:var(--warning);font-weight:600">Дуусахад ойрхон</span>'
      : '<span style="color:var(--success);font-weight:600">Хүчинтэй</span>';

  document.getElementById('biz-detail-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div class="avatar" style="width:44px;height:44px;font-size:18px;font-weight:700;background:rgba(59,130,246,0.2);color:#60A5FA;flex-shrink:0">${(b.name||'?')[0]}</div>
      <div>
        <div style="font-size:16px;font-weight:700">${esc(b.name)}</div>
        <div style="font-size:12px;margin-top:2px"><span style="color:${typeColor};font-weight:600">${typeLabel}</span></div>
      </div>
    </div>
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin:12px 0 8px">Байгууллагын мэдээлэл</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:5px 0;color:var(--text-muted);width:45%">УБД/Регистр</td><td style="padding:5px 0;text-align:right;font-weight:500">${esc(b.regno)||'—'}</td></tr>
      <tr><td style="padding:5px 0;color:var(--text-muted)">Захирал</td><td style="padding:5px 0;text-align:right;font-weight:500">${esc(b.ceo)||'—'}</td></tr>
      <tr><td style="padding:5px 0;color:var(--text-muted)">Гар утас</td><td style="padding:5px 0;text-align:right">${esc(b.mobile)||'—'}</td></tr>
      <tr><td style="padding:5px 0;color:var(--text-muted)">Утас</td><td style="padding:5px 0;text-align:right">${esc(b.phone)||'—'}</td></tr>
      <tr><td style="padding:5px 0;color:var(--text-muted)">И-мэйл</td><td style="padding:5px 0;text-align:right">${esc(b.email)||'—'}</td></tr>
    </table>
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin:12px 0 8px">Гэрээний мэдээлэл</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:5px 0;color:var(--text-muted);width:45%">Гэрээний дугаар</td><td style="padding:5px 0;text-align:right;font-weight:500">${esc(b.contract)||'—'}</td></tr>
      <tr><td style="padding:5px 0;color:var(--text-muted)">Эхлэх огноо</td><td style="padding:5px 0;text-align:right">${_fmtDateSlash(b.start)}</td></tr>
      <tr><td style="padding:5px 0;color:var(--text-muted)">Дуусах огноо</td><td style="padding:5px 0;text-align:right">${_fmtDateSlash(b.end)} ${contractStatus}</td></tr>
      ${(b.vehicles||[]).length?`<tr><td style="padding:5px 0;color:var(--text-muted)">Машин</td><td style="padding:5px 0;text-align:right">${b.vehicles.map(esc).join(', ')}</td></tr>`:''}
      ${b.note?`<tr><td style="padding:5px 0;color:var(--text-muted)">Тэмдэглэл</td><td style="padding:5px 0;text-align:right;color:var(--text-dim)">${esc(b.note)}</td></tr>`:''}
    </table>`;
  openModal('modal-biz-detail');
}
function bizDetailEdit() {
  closeModal('modal-biz-detail');
  if(selectedBusinessForDetail) editBusiness(selectedBusinessForDetail.id);
}
function bizDetailPay() {
  closeModal('modal-biz-detail');
  if(selectedBusinessForDetail) openBizPayModal(selectedBusinessForDetail);
}
function openBizPayModal(b) {
  selectedBusinessForDetail = b;
  document.getElementById('biz-pay-name').textContent = b.name;
  document.getElementById('biz-pay-month').value = CUR_MONTH;
  document.getElementById('biz-pay-amount').value = '';
  document.getElementById('biz-pay-ref').value = '';
  document.getElementById('biz-pay-method').value = 'qpay';
  document.querySelectorAll('#modal-biz-payment .pay-method-card').forEach(c=>c.classList.remove('selected'));
  document.querySelector('#modal-biz-payment .pay-method-card').classList.add('selected');
  openModal('modal-biz-payment');
}
function selectBizPayMethod(el, method) {
  document.querySelectorAll('#modal-biz-payment .pay-method-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('biz-pay-method').value = method;
}
async function saveBizPayment() {
  const b = selectedBusinessForDetail; if(!b) return;
  const amount = +document.getElementById('biz-pay-amount').value;
  if(!amount){toast('Дүн оруулна уу','error');return;}
  const month = +document.getElementById('biz-pay-month').value;
  const method = document.getElementById('biz-pay-method').value;
  const ref = document.getElementById('biz-pay-ref').value.trim();
  const data = {
    apt: null, type:'income', amount, method, ref,
    month, year: CUR_YEAR, date: todayStr(),
    desc: b.name + ' гэрээний төлбөр', status:'completed', category:'business', businessId: b.id
  };
  const ok = await db_saveTransaction(data);
  if(!ok) { toast('Бүртгэхэд алдаа гарлаа — таны рольд энэ үйлдэл хийх эрх байхгүй байж болзошгүй','error'); return; }
  transactions.push({id:nextId++,dbId:data.id,...data});
  // Нягтлан бодох бүртгэлийн журнал бичилт (нэмэлт — гол гүйлгээг зогсоохгүй)
  if (typeof accountingRecordBusinessPayment === 'function') {
    accountingRecordBusinessPayment(b.id, amount, todayStr(), `${b.name} — ${month}-р сарын түрээс`)
      .then(res => { if (!res.success) console.warn('Journal entry үүсгэхэд алдаа:', res.error); })
      .catch(e => console.warn('Journal entry үүсгэхэд алдаа:', e));
  }
  closeModal('modal-biz-payment');
  toast(b.name+' '+month+'-р сарын төлбөр бүртгэгдлээ ✓','success');
}
function editBusiness(id) {
  if(!canWrite('businesses')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  editingBusinessId = id;
  const b = businesses.find(x=>x.id===id); if(!b) return;
  document.getElementById('modal-business-title').textContent = 'Аж ахуйн нэгж засах';
  document.getElementById('biz-name').value=b.name;
  document.getElementById('biz-regno').value=b.regno;
  document.getElementById('biz-type').value=b.type;
  document.getElementById('biz-ceo').value=b.ceo;
  document.getElementById('biz-mobile').value=b.mobile;
  document.getElementById('biz-phone').value=b.phone;
  document.getElementById('biz-email').value=b.email;
  document.getElementById('biz-contract').value=b.contract;
  document.getElementById('biz-start').value=b.start;
  document.getElementById('biz-end').value=b.end;
  document.getElementById('biz-note').value=b.note;
  const bmf=document.getElementById('biz-monthly-fee'); if(bmf) bmf.value=b.monthlyFee||'';
  // Машин
  // Машин
  document.getElementById('biz-vehicle-rows').innerHTML='';
  const hbv2=document.getElementById('biz-has-vehicle');
  if(b.vehicles&&b.vehicles.length){if(hbv2){hbv2.checked=true;document.getElementById('biz-vehicle-section').style.display='block';}b.vehicles.forEach(v=>addVehicleRow('biz-vehicle-rows',v));}else{if(hbv2){hbv2.checked=false;document.getElementById('biz-vehicle-section').style.display='none';}}
  // Зогсоол
  document.getElementById('biz-parking-rows').innerHTML='';
  const hbp2=document.getElementById('biz-has-parking');
  if(b.parkings&&b.parkings.length){if(hbp2){hbp2.checked=true;document.getElementById('biz-parking-section').style.display='block';}b.parkings.forEach(p=>renderSpotPickerRow('parking', 'biz-parking-rows', p, 'business', id));}else{if(hbp2){hbp2.checked=false;document.getElementById('biz-parking-section').style.display='none';}}
  // Агуулах
  document.getElementById('biz-storage-rows').innerHTML='';
  const hbs2=document.getElementById('biz-has-storage');
  if(b.storages&&b.storages.length){if(hbs2){hbs2.checked=true;document.getElementById('biz-storage-section').style.display='block';}b.storages.forEach(s=>renderSpotPickerRow('storage', 'biz-storage-rows', s, 'business', id));}else{if(hbs2){hbs2.checked=false;document.getElementById('biz-storage-section').style.display='none';}}
  openModal('modal-business');
}

// Хуулбарлах — editBusiness()-ийн бүх талбарыг pre-fill хийгээд, editingBusinessId-г
// null болгосноор saveBusiness() UPDATE биш шинэ INSERT хийнэ. Регистр/Гэрээний дугаар
// өвөрмөц байх ёстой тул хоослож, хэрэглэгчээр шинээр оруулуулна.
function copyBusiness(id) {
  if(!canCopy('businesses')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  editBusiness(id);
  editingBusinessId = null;
  document.getElementById('modal-business-title').textContent = 'Аж ахуйн нэгж хуулбарлах (Регистр/Гэрээний дугаараа шинэчилнэ үү)';
  document.getElementById('biz-regno').value = '';
  document.getElementById('biz-contract').value = '';
}
async function saveBusiness() {
  const name = document.getElementById('biz-name').value.trim();
  if(!name){toast('Байгууллагын нэр оруулна уу','error');return;}
  const _editingBiz = editingBusinessId ? businesses.find(b=>b.id===editingBusinessId) : null;
  const parkings = document.getElementById('biz-has-parking').checked
    ? collectSpotValues('biz-parking-rows')
    : [];
  if(parkings.length) {
    const pErr = validateSpotAssignment('parking', parkings, 'business', editingBusinessId);
    if(pErr) { toast(pErr, 'error'); return; }
  }
  const storages = document.getElementById('biz-has-storage').checked
    ? collectSpotValues('biz-storage-rows')
    : [];
  if(storages.length) {
    const sErr = validateSpotAssignment('storage', storages, 'business', editingBusinessId);
    if(sErr) { toast(sErr, 'error'); return; }
  }
  const data = {
    id: _editingBiz?.id || null,
    dbId: _editingBiz?.dbId || null,
    name, regno:document.getElementById('biz-regno').value.trim(),
    type:document.getElementById('biz-type').value,
    ceo:document.getElementById('biz-ceo').value.trim(),
    mobile:document.getElementById('biz-mobile').value.trim(),
    phone:document.getElementById('biz-phone').value.trim(),
    email:document.getElementById('biz-email').value.trim(),
    contract:document.getElementById('biz-contract').value.trim(),
    start:document.getElementById('biz-start').value.trim(),
    end:document.getElementById('biz-end').value.trim(),
    note:document.getElementById('biz-note').value.trim(),
    monthlyFee:+(document.getElementById('biz-monthly-fee')?.value||0),
    vehicles: getVehicles('biz-vehicle-rows'),
    parkings, storages
  };
  const ok = await db_saveBusiness(data);
  if(!ok) { toast('Хадгалахад алдаа гарлаа — таны рольд энэ үйлдэл хийх эрх байхгүй байж болзошгүй','error'); return; }
  if(editingBusinessId) {
    const idx=businesses.findIndex(b=>b.id===editingBusinessId);
    if(idx>=0) businesses[idx]={...businesses[idx],...data};
    toast('Мэдээлэл шинэчлэгдлээ','success');
  } else {
    businesses.push({id:nextId++,...data});
    toast(name+' нэмэгдлээ','success');
  }
  closeModal('modal-business');
  renderBusinesses();
}
async function deleteBusiness(id) {
  if(!confirm('Устгах уу?')) return;
  try {
    await db_deleteBusiness(id);
  } catch(e) {
    toast('Устгахад эрхгүй байна эсвэл алдаа гарлаа: ' + e.message, 'error');
    return;
  }
  businesses = businesses.filter(b=>b.id!==id);
  renderBusinesses();
  toast('Устгагдлаа','success');
}
// ============================================================
// ХАРИЛЦАГЧИЙН БҮРТГЭЛ
// ============================================================
function renderClientele(filter='') {
  const body = document.getElementById('clientele-table-body');
  if(!body) return;
  const canEditC = canWrite('clientele'), canDelC = canDelete('clientele');
  let list = filter ? clientele.filter(c=>{
    const q=filter;
    return (c.legalName||'').toLowerCase().includes(q)
      ||(c.regNo||'').includes(q)
      ||(c.ceo||'').toLowerCase().includes(q)
      ||(c.mobile||'').includes(q)
      ||(c.phone||'').includes(q)
      ||(c.email||'').toLowerCase().includes(q)
      ||(c.contractNo||'').toLowerCase().includes(q)
      ||(c.note||'').toLowerCase().includes(q);
  }) : clientele;
  // Хуулийн этгээдийн нэрээр байнга A-Z (Монгол цагаан толгойн дараалал) харуулна
  list = list.slice().sort((a,b)=>(a.legalName||'').localeCompare((b.legalName||''), 'mn'));
  if(!list.length){body.innerHTML='<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--text-muted)">Харилцагч олдсонгүй</td></tr>';return;}
  body.innerHTML = list.map((c,i) => `
    <tr style="cursor:pointer" onclick="openClienteleDetail(${c.id})">
      <td><div class="avatar" style="width:24px;height:24px;font-size:10px;font-weight:700;background:rgba(59,130,246,0.18);color:#60A5FA">${i+1}</div></td>
      <td><span class="dt-title">${esc(c.legalName)}</span></td>
      <td class="dt-text dt-mono">${esc(c.regNo)||'—'}</td>
      <td><span class="dt-title">${esc(c.ceo)||'—'}</span></td>
      <td class="dt-text dt-mono">${esc(c.mobile)||'—'}</td>
      <td class="dt-text dt-mono">${esc(c.phone)||'—'}</td>
      <td class="dt-text">${esc(c.email)||'—'}</td>
      <td class="dt-text">${esc(c.contractNo)||'—'}</td>
      <td class="dt-text" style="color:var(--text-muted)">${_fmtDateSlash(c.contractStart)}</td>
      <td class="dt-text" style="color:var(--text-muted)">${_fmtDateSlash(c.contractEnd)}</td>
      <td class="dt-muted" style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(c.note||'')}">${esc(c.note)||'—'}</td>
      <td onclick="event.stopPropagation()"><div class="flex gap-8">
        ${canEditC?`<button class="btn btn-ghost btn-sm" onclick="editClientele(${c.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Засах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`:''}
        ${canDelC?`<button class="btn btn-ghost btn-sm" onclick="deleteClientele(${c.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--danger)" title="Устгах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>`:''}
        ${!canEditC&&!canDelC?'<span style="color:var(--text-muted);font-size:11px">—</span>':''}
      </div></td>
    </tr>`).join('');
  const stat = document.getElementById('clientele-stat');
  if(stat) stat.textContent = `Нийт: ${list.length} харилцагч`;
}
let selectedClienteleForDetail = null;
function openClienteleDetail(id) {
  const c = clientele.find(x=>x.id===id); if(!c) return;
  selectedClienteleForDetail = c;
  document.getElementById('clientele-detail-title').textContent = c.legalName;
  document.getElementById('clientele-detail-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div class="avatar" style="width:44px;height:44px;font-size:18px;font-weight:700;background:rgba(59,130,246,0.18);color:#60A5FA;flex-shrink:0">${(c.legalName||'?')[0]}</div>
      <div style="font-size:16px;font-weight:700">${esc(c.legalName)}</div>
    </div>
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin:12px 0 8px">Байгууллагын мэдээлэл</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:5px 0;color:var(--text-muted);width:45%">УБД/Регистр</td><td style="padding:5px 0;text-align:right;font-weight:500">${esc(c.regNo)||'—'}</td></tr>
      <tr><td style="padding:5px 0;color:var(--text-muted)">Захирал</td><td style="padding:5px 0;text-align:right;font-weight:500">${esc(c.ceo)||'—'}</td></tr>
      <tr><td style="padding:5px 0;color:var(--text-muted)">Гар утас</td><td style="padding:5px 0;text-align:right">${esc(c.mobile)||'—'}</td></tr>
      <tr><td style="padding:5px 0;color:var(--text-muted)">Утас</td><td style="padding:5px 0;text-align:right">${esc(c.phone)||'—'}</td></tr>
      <tr><td style="padding:5px 0;color:var(--text-muted)">И-мэйл</td><td style="padding:5px 0;text-align:right">${esc(c.email)||'—'}</td></tr>
    </table>
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin:12px 0 8px">Гэрээний мэдээлэл</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:5px 0;color:var(--text-muted);width:45%">Гэрээний дугаар</td><td style="padding:5px 0;text-align:right;font-weight:500">${esc(c.contractNo)||'—'}</td></tr>
      <tr><td style="padding:5px 0;color:var(--text-muted)">Эхлэх огноо</td><td style="padding:5px 0;text-align:right">${_fmtDateSlash(c.contractStart)}</td></tr>
      <tr><td style="padding:5px 0;color:var(--text-muted)">Дуусах огноо</td><td style="padding:5px 0;text-align:right">${_fmtDateSlash(c.contractEnd)}</td></tr>
      ${c.note?`<tr><td style="padding:5px 0;color:var(--text-muted)">Тэмдэглэл</td><td style="padding:5px 0;text-align:right;color:var(--text-dim)">${esc(c.note)}</td></tr>`:''}
    </table>`;
  openModal('modal-clientele-detail');
}
function clienteleDetailEdit() {
  closeModal('modal-clientele-detail');
  if(selectedClienteleForDetail) editClientele(selectedClienteleForDetail.id);
}
function filterClientele(){const q=(document.getElementById('clientele-search')?.value||'').toLowerCase();renderClientele(q);}
let editingClienteleId = null;
function openAddClientele() {
  if(!canWrite('clientele')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  editingClienteleId = null;
  document.getElementById('modal-clientele-title').textContent = 'Харилцагч нэмэх';
  ['clientele-legal-name','clientele-reg-no','clientele-ceo','clientele-mobile','clientele-phone','clientele-email','clientele-contract-no','clientele-contract-start','clientele-contract-end','clientele-note'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openModal('modal-clientele');
}
function editClientele(id) {
  if(!canWrite('clientele')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  const c = clientele.find(x=>x.id===id); if(!c) return;
  editingClienteleId = id;
  document.getElementById('modal-clientele-title').textContent = 'Харилцагч засах';
  document.getElementById('clientele-legal-name').value = c.legalName||'';
  document.getElementById('clientele-reg-no').value = c.regNo||'';
  document.getElementById('clientele-ceo').value = c.ceo||'';
  document.getElementById('clientele-mobile').value = c.mobile||'';
  document.getElementById('clientele-phone').value = c.phone||'';
  document.getElementById('clientele-email').value = c.email||'';
  document.getElementById('clientele-contract-no').value = c.contractNo||'';
  document.getElementById('clientele-contract-start').value = c.contractStart||'';
  document.getElementById('clientele-contract-end').value = c.contractEnd||'';
  document.getElementById('clientele-note').value = c.note||'';
  openModal('modal-clientele');
}
async function saveClientele() {
  const legalName = document.getElementById('clientele-legal-name').value.trim();
  if(!legalName){toast('Хуулийн этгээдийн нэрийг оруулна уу','error');return;}
  const _editing = editingClienteleId ? clientele.find(c=>c.id===editingClienteleId) : null;
  const data = {
    id: _editing?.id || null,
    dbId: _editing?.dbId || null,
    legalName,
    regNo: document.getElementById('clientele-reg-no').value.trim(),
    ceo: document.getElementById('clientele-ceo').value.trim(),
    mobile: document.getElementById('clientele-mobile').value.trim(),
    phone: document.getElementById('clientele-phone').value.trim(),
    email: document.getElementById('clientele-email').value.trim(),
    contractNo: document.getElementById('clientele-contract-no').value.trim(),
    contractStart: document.getElementById('clientele-contract-start').value,
    contractEnd: document.getElementById('clientele-contract-end').value,
    note: document.getElementById('clientele-note').value.trim()
  };
  const ok = await db_saveClientele(data);
  if(!ok) { toast('Хадгалахад алдаа гарлаа — таны рольд энэ үйлдэл хийх эрх байхгүй байж болзошгүй','error'); return; }
  if(editingClienteleId) {
    const idx = clientele.findIndex(c=>c.id===editingClienteleId);
    if(idx>=0) clientele[idx] = {...clientele[idx], ...data};
    toast('Мэдээлэл шинэчлэгдлээ','success');
  } else {
    clientele.push({id:nextId++, ...data});
    toast(legalName+' нэмэгдлээ','success');
  }
  closeModal('modal-clientele');
  renderClientele();
}
async function deleteClientele(id) {
  if(!confirm('Устгах уу?')) return;
  try {
    await db_deleteClientele(id);
  } catch(e) {
    toast('Устгахад эрхгүй байна эсвэл алдаа гарлаа: ' + e.message, 'error');
    return;
  }
  clientele = clientele.filter(c=>c.id!==id);
  renderClientele();
  toast('Устгагдлаа','success');
}
