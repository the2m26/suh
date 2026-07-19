// notifications.js — Мэдэгдэл модулийн логик (2026-07-17 бүрэн шинэчлэлт)
// Хамаарал: sb (db.js), residents (residents.js), businesses (businesses.js),
// employees (employees.js), monthsUnpaidForResident/monthsUnpaidForBusiness/
// _bizThresholds (finance.js), esc/fmtMoney/toast/openModal (suh.html core).

const NOTIF_CATEGORY_LABELS = {
  notice:'Мэдэгдэл', warning:'Анхааруулга', reminder:'Сануулга',
  announcement:'Зар мэдээлэл', invoice:'Нэхэмжлэл', ereceipt:'И-баримт', payslip:'Цалингийн хуудас'
};
const NOTIF_FILTER_LABELS = {
  all:'Бүгд', specific:'Төлбөр төлөгч (тухайлсан)', pending:'Төлбөрийн хүлээлттэй',
  overdue:'Төлбөрийн хугацаа хэтэрсэн', risk:'Төлбөрийн эрсдэлтэй',
  employees:'Ажилтнууд', specific_employee:'Ажилтан (тухайлсан)'
};

// Хуудас руу шилжих бүрд дуудагдана — Илгээх tab-ийн dropdown-уудыг эхлүүлж,
// Илгээгдсэн tab идэвхтэй байвал жагсаалтыг шинэчилнэ.
function renderNotificationsPage() {
  onNotifRecipientKindChange();
  updateNotifPreview();
  if(document.getElementById('notif-tab-sent')?.style.display !== 'none') renderNotifications();
}

function switchNotifTab(name, el) {
  document.getElementById('notif-tab-send').style.display = name === 'send' ? 'block' : 'none';
  document.getElementById('notif-tab-sent').style.display = name === 'sent' ? 'block' : 'none';
  document.querySelectorAll('#notif-tabs .tab').forEach(t => t.classList.remove('active'));
  if(el) el.classList.add('active');
  if(name === 'sent') renderNotifications();
}

// "Хүлээн авагч" сонголт өөрчлөгдөхөд "Нөхцөл" dropdown-ийг тухайн төрөлд
// зохих сонголтуудаар дахин бөглөнө.
function onNotifRecipientKindChange() {
  const kind = document.getElementById('notif-recipient-kind').value;
  const filterSel = document.getElementById('notif-recipient-filter');
  let opts;
  if(kind === 'staff') {
    opts = ['employees','specific_employee'];
  } else {
    opts = ['all','specific','pending','overdue','risk'];
  }
  filterSel.innerHTML = opts.map(k=>`<option value="${k}">${NOTIF_FILTER_LABELS[k]}</option>`).join('');
  onNotifRecipientFilterChange();
}

function onNotifRecipientFilterChange() {
  const filter = document.getElementById('notif-recipient-filter').value;
  const isSpecific = filter === 'specific' || filter === 'specific_employee';
  const wrap = document.getElementById('notif-specific-wrap');
  wrap.style.display = isSpecific ? 'block' : 'none';
  document.getElementById('notif-specific-search').value = '';
  document.getElementById('notif-specific-id').value = '';
  document.getElementById('notif-specific-label').textContent =
    filter === 'specific_employee' ? 'Тухайлсан ажилтан' : 'Тухайлсан төлбөр төлөгч';
  updateNotifRecipientCount();
}

function hideNotifSpecificSuggestions() {
  const box = document.getElementById('notif-specific-suggestions');
  if(box) box.style.display = 'none';
}

function onNotifSpecificSearch() {
  const kind = document.getElementById('notif-recipient-kind').value;
  const filter = document.getElementById('notif-recipient-filter').value;
  const q = document.getElementById('notif-specific-search').value.trim().toLowerCase();
  const box = document.getElementById('notif-specific-suggestions');
  if(!q) { box.style.display = 'none'; return; }

  let matches = [];
  if(filter === 'specific_employee') {
    matches = employees.filter(e => e && (e.fullName||'').toLowerCase().includes(q)).slice(0,8)
      .map(e => ({id:e.id, label:(e.fullName||'—') + (e.position?' — '+e.position:'')}));
  } else if(kind === 'resident') {
    matches = residents.filter(r => r && (String(r.apt).includes(q) || (r.firstname||'').toLowerCase().includes(q) || (r.lastname||'').toLowerCase().includes(q))).slice(0,8)
      .map(r => ({id:r.id, label:String(r.apt) + ' — ' + (r.firstname||'') + ' ' + (r.lastname||'')}));
  } else if(kind === 'business') {
    matches = businesses.filter(b => b && (b.name||'').toLowerCase().includes(q)).slice(0,8)
      .map(b => ({id:b.id, label:b.name}));
  }

  if(!matches.length) { box.innerHTML = '<div style="padding:8px 12px;color:var(--text-muted);font-size:12px">Олдсонгүй</div>'; box.style.display = 'block'; return; }
  box.innerHTML = matches.map(m => `<div style="padding:8px 12px;cursor:pointer;font-size:13px" onmousedown="selectNotifSpecific(${m.id},'${esc(m.label).replace(/'/g,"\\'")}')" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">${esc(m.label)}</div>`).join('');
  box.style.display = 'block';
}
function selectNotifSpecific(id, label) {
  document.getElementById('notif-specific-id').value = id;
  document.getElementById('notif-specific-search').value = label;
  hideNotifSpecificSuggestions();
  updateNotifRecipientCount();
}

// ⚠️ Хүлээн авагчдыг бодитоор тодорхойлдог НЭГДСЭН функц — Мэдэгдэл болон
// (ирээдүйд) Нэхэмжлэх илгээх хоёулаа үүнийг дахин ашиглана. Төлбөрийн
// хүлээлттэй/хугацаа хэтэрсэн/эрсдэлтэй ангилалыг "Төлбөрийн явц" хуудсанд
// аль хэдийн байгаа monthsUnpaidForResident/Business, _bizThresholds
// функцүүдээр яг адилхан тооцоолно (шинэ логик давхардуулаагүй).
function resolveNotificationRecipients() {
  const kind = document.getElementById('notif-recipient-kind').value;
  const filter = document.getElementById('notif-recipient-filter').value;
  const specificId = +document.getElementById('notif-specific-id').value || null;
  const pendingThreshold = feeSettings.pendingMonths || 1;
  const overdueThreshold = feeSettings.overdueMonths || 2;
  const riskThreshold = feeSettings.riskMonths || 12;

  if(kind === 'staff') {
    if(filter === 'specific_employee') {
      const e = employees.find(x=>x.id===specificId);
      return e ? [{name:e.fullName||'—', email:e.email||'', phone:e.phone||'', ref_type:'employee', ref_id:e.id}] : [];
    }
    return employees.filter(e=>e && e.status==='active').map(e=>({name:e.fullName||'—', email:e.email||'', phone:e.phone||'', ref_type:'employee', ref_id:e.id}));
  }

  if(kind === 'resident') {
    if(filter === 'specific') {
      const r = residents.find(x=>x.id===specificId);
      return r ? [{name:(r.firstname||'')+' '+(r.lastname||''), email:r.email||'', phone:r.phone||'', ref_type:'resident', ref_id:r.id}] : [];
    }
    return residents.filter(r=>{
      if(!r) return false;
      if(filter==='all') return true;
      const mu = monthsUnpaidForResident(r);
      if(filter==='pending') return mu>=pendingThreshold && mu<overdueThreshold;
      if(filter==='overdue') return mu>=overdueThreshold && mu<riskThreshold;
      if(filter==='risk') return mu>=riskThreshold;
      return false;
    }).map(r=>({name:(r.firstname||'')+' '+(r.lastname||''), email:r.email||'', phone:r.phone||'', ref_type:'resident', ref_id:r.id, apt:r.apt}));
  }

  if(kind === 'business') {
    if(filter === 'specific') {
      const b = businesses.find(x=>x.id===specificId);
      return b ? [{name:b.name, email:b.email||'', phone:b.mobile||b.phone||'', ref_type:'business', ref_id:b.id}] : [];
    }
    return businesses.filter(b=>{
      if(!b) return false;
      if(filter==='all') return true;
      const mu = monthsUnpaidForBusiness(b);
      const th = _bizThresholds(b);
      if(filter==='pending') return mu>=th.pending && mu<th.overdue;
      if(filter==='overdue') return mu>=th.overdue && mu<th.risk;
      if(filter==='risk') return mu>=th.risk;
      return false;
    }).map(b=>({name:b.name, email:b.email||'', phone:b.mobile||b.phone||'', ref_type:'business', ref_id:b.id}));
  }
  return [];
}

function updateNotifRecipientCount() {
  const el = document.getElementById('notif-recipient-count');
  if(!el) return;
  const list = resolveNotificationRecipients();
  el.textContent = list.length ? `${list.length} хүлээн авагч олдлоо` : 'Хүлээн авагч олдсонгүй';
}

// ⚠️ Дундын "суваг бүрээр илгээх" функц — In-app одоогоор зөвхөн DB-д хадгалдаг
// (userapp.html Supabase холболтгүй тул бодит хүргэлт хараахан алга). Мэйл/СМС
// одоогоор "тохируулагдаагүй" гэсэн тодорхой мессежтэй буцна (алдаа биш).
async function sendViaChannels(recipients, channels) {
  const results = {inapp: recipients.length, email: 0, sms: 0, emailSkipped:false, smsSkipped:false};
  if(channels.includes('email')) results.emailSkipped = true;  // Edge Function хараахан холбогдоогүй
  if(channels.includes('sms')) results.smsSkipped = true;      // Edge Function хараахан холбогдоогүй
  return results;
}

async function sendNotification() {
  const category = document.getElementById('notif-category').value;
  const title = document.getElementById('notif-title-input').value.trim();
  const content = document.getElementById('notif-content').value.trim();
  if(!title || !content) { toast('Гарчиг болон агуулгыг бөглөнө үү', 'error'); return; }

  const channels = [];
  if(document.getElementById('notif-ch-email').checked) channels.push('email');
  if(document.getElementById('notif-ch-sms').checked) channels.push('sms');
  if(document.getElementById('notif-ch-inapp').checked) channels.push('inapp');
  if(!channels.length) { toast('Дор хаяж нэг суваг сонгоно уу', 'error'); return; }

  const recipients = resolveNotificationRecipients();
  if(!recipients.length) { toast('Хүлээн авагч олдсонгүй', 'error'); return; }

  const kind = document.getElementById('notif-recipient-kind').value;
  const filter = document.getElementById('notif-recipient-filter').value;
  const specificId = +document.getElementById('notif-specific-id').value || null;

  const sendResult = await sendViaChannels(recipients, channels);

  const row = {
    type: category, title, content,
    recipient: `${NOTIF_FILTER_LABELS[filter]} (${kind==='resident'?'Сууц өмчлөгч':kind==='business'?'ААН':'СӨХ'})`,
    date: todayStr(), sent: true,
    recipient_kind: kind, recipient_filter: filter, recipient_specific_id: specificId,
    category, channels, recipients_snapshot: recipients,
    sent_at: new Date().toISOString()
  };
  const ok = await db_saveNotificationNew(row);
  if(!ok) { toast('Илгээхэд алдаа гарлаа', 'error'); return; }

  let msg = `${recipients.length} хүлээн авагчид In-app мэдэгдэл хадгалагдлаа ✓`;
  if(sendResult.emailSkipped || sendResult.smsSkipped) {
    msg += ' (Мэйл/СМС: гадаад үйлчилгээ хараахан тохируулагдаагүй тул алгассан)';
  }
  toast(msg, 'success');

  document.getElementById('notif-title-input').value = '';
  document.getElementById('notif-content').value = '';
  updateNotifPreview();
}

async function db_saveNotificationNew(n) {
  const { data, error } = await sb.from('notifications').insert(n).select().single();
  if(error) { console.error('notification insert error:', error.message); return false; }
  notifications.unshift(data);
  return true;
}

function updateNotifPreview() {
  const el = document.getElementById('notif-preview');
  if(!el) return;
  const title = document.getElementById('notif-title-input')?.value.trim();
  const content = document.getElementById('notif-content')?.value.trim();
  const category = document.getElementById('notif-category')?.value;
  if(!title && !content) { el.innerHTML = '<div class="empty-state">Гарчиг, агуулга бөглөхөд эндээс харагдана</div>'; return; }
  el.innerHTML = `
    <div style="padding:14px 16px">
      <span class="tag" style="font-size:10.5px">${NOTIF_CATEGORY_LABELS[category]||''}</span>
      <div style="font-weight:700;font-size:14px;margin-top:8px">${esc(title)||'(гарчиггүй)'}</div>
      <div style="font-size:12.5px;color:var(--text-dim);margin-top:6px;white-space:pre-wrap">${esc(content)||''}</div>
    </div>`;
}

// ============================================================
// ИЛГЭЭГДСЭН — түүхийн жагсаалт
// ============================================================
function renderNotifications() {
  const el = document.getElementById('notifications-list');
  if(!el) return;
  if(!notifications.length) { el.innerHTML = '<div class="empty-state">Илгээсэн мэдэгдэл байхгүй байна</div>'; return; }
  el.innerHTML = `<table class="data-table">
    <thead><tr><th>Огноо</th><th>Төрөл</th><th>Гарчиг</th><th>Хүлээн авагч</th><th>Тоо</th><th>Суваг</th></tr></thead>
    <tbody>${notifications.map(n => `
      <tr>
        <td class="dt-mono">${esc(n.date)||(n.sent_at?n.sent_at.slice(0,10):'—')}</td>
        <td class="dt-text">${NOTIF_CATEGORY_LABELS[n.category||n.type]||esc(n.type)||'—'}</td>
        <td class="dt-text">${esc(n.title)}</td>
        <td class="dt-muted">${esc(n.recipient)||'—'}</td>
        <td class="dt-mono">${(n.recipients_snapshot||[]).length || '—'}</td>
        <td class="dt-muted">${(n.channels||[]).map(c=>c==='inapp'?'In-app':c==='email'?'Мэйл':'СМС').join(', ')||'—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

// Гарчиг/Агуулга/Төрөл өөрчлөгдөх бүрд урьдчилан харах шинэчлэгдэнэ
document.addEventListener('DOMContentLoaded', () => {
  ['notif-title-input','notif-content','notif-category'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', updateNotifPreview);
  });
  ['notif-recipient-filter'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', updateNotifRecipientCount);
  });
});
