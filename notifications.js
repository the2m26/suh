// notifications.js — Мэдэгдэл модулийн логик (2026-07-17 бүрэн шинэчлэлт)
// Хамаарал: sb (db.js), residents (residents.js), businesses (businesses.js),
// employees (employees.js), monthsUnpaidForResident/monthsUnpaidForBusiness/
// _bizThresholds (finance.js), esc/fmtMoney/toast/openModal (suh.html core).

const NOTIF_CATEGORY_LABELS = {
  notice:'Мэдэгдэл', warning:'Анхааруулга', reminder:'Сануулга',
  announcement:'Зар мэдээлэл', invoice:'Нэхэмжлэл', ereceipt:'И-баримт', payslip:'Цалингийн хуудас'
};
// ⚠️ 2026-07-19: Хүлээн авагчийн нэршил бүлэг (Сууц өмчлөгч/ААН/СӨХ) тус бүрт өөр
// байх шаардлагатай болсон тул нэг л NOTIF_FILTER_LABELS-ээс 3 тусдаа map болгов.
const NOTIF_FILTER_LABELS_BY_KIND = {
  resident: {
    all: 'Бүх сууц өмчлөгч', specific: 'Сууц өмчлөгч',
    pending: 'Төлбөрийн хүлээлттэй бүх сууц өмчлөгч',
    overdue: 'Төлбөрийн хугацаа хэтэрсэн бүх сууц өмчлөгч',
    risk: 'Төлбөрийн эрсдэлтэй бүх сууц өмчлөгч'
  },
  business: {
    all: 'Бүх ААН', specific: 'Аж ахуйн нэгж',
    pending: 'Төлбөрийн хүлээлттэй бүх ААН',
    overdue: 'Төлбөрийн хугацаа хэтэрсэн бүх ААН',
    risk: 'Төлбөрийн эрсдэлтэй бүх ААН'
  },
  staff: {
    employees: 'Бүх ажилтан', specific_employee: 'Ажилтан'
  }
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

// "Бүлэг" сонголт өөрчлөгдөхөд "Хүлээн авагч" dropdown-ийг тухайн бүлэгт
// зохих сонголтуудаар дахин бөглөнө.
function onNotifRecipientKindChange() {
  const kind = document.getElementById('notif-recipient-kind').value;
  const filterSel = document.getElementById('notif-recipient-filter');
  let opts, labels;
  if(kind === 'staff') {
    opts = ['employees','specific_employee'];
    labels = NOTIF_FILTER_LABELS_BY_KIND.staff;
  } else {
    opts = ['all','specific','pending','overdue','risk'];
    labels = NOTIF_FILTER_LABELS_BY_KIND[kind];
  }
  filterSel.innerHTML = opts.map(k=>`<option value="${k}">${labels[k]}</option>`).join('');
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

  // ⚠️ 2026-07-19: Шинэ нэршил (Бүх сууц өмчлөгч, Аж ахуйн нэгж г.м) аль хэдийн бүлэгийг агуулж байгаа тул
  // "(Сууц өмчлөгч)" гэх мэт нэмэлт дагавар шаардлагагүй. Тухайлсан үед бодит хүний нэрийг харуулна.
  const isSpecific = filter === 'specific' || filter === 'specific_employee';
  const recipientLabel = isSpecific
    ? (recipients[0]?.name || '—')
    : NOTIF_FILTER_LABELS_BY_KIND[kind][filter];

  const row = {
    type: category, title, content,
    recipient: recipientLabel,
    date: todayStr(), sent: 1,
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
// ИЛГЭЭГДСЭН — түүхийн жагсаалт (2026-07-19: шүүлтүүр/хайлт/дэлгэрэнгүй нэмэв)
// ============================================================
function populateNotifLogYearOptions() {
  const sel = document.getElementById('notiflog-year-filter');
  if(!sel) return;
  const years = [...new Set(notifications.filter(n=>n&&n.sent_at).map(n=>+n.sent_at.slice(0,4)))].sort((a,b)=>b-a);
  const key = years.join(',');
  if(sel.dataset.yearsKey === key) return; // өөрчлөгдөөгүй бол дахин зурахгүй
  const curVal = sel.value;
  sel.innerHTML = '<option value="">Бүх он</option>' + years.map(y=>`<option value="${y}">${y}</option>`).join('');
  sel.value = curVal;
  sel.dataset.yearsKey = key;
}
function populateNotifLogDayOptions() {
  const el = document.getElementById('notiflog-day-filter');
  if(!el || el.dataset.init) return;
  const opts = [];
  for(let d=1; d<=31; d++) opts.push(`<option value="${d}">${d}</option>`);
  el.innerHTML = '<option value="">Бүх өдөр</option>' + opts.join('');
  el.dataset.init = '1';
}
// "Гүйлгээний бүртгэл"-ийн ХУГАЦАА баганатай ижил YYYY/MM/DD HH:MM:SS формат
function _fmtNotifDateTime(n) {
  const d = n.sent_at ? new Date(n.sent_at) : null;
  if(!d || isNaN(d.getTime())) return n.date || '—';
  const y = d.getFullYear(), mo = String(d.getMonth()+1).padStart(2,'0'), da = String(d.getDate()).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0'), mi = String(d.getMinutes()).padStart(2,'0'), ss = String(d.getSeconds()).padStart(2,'0');
  return `${y}/${mo}/${da} ${hh}:${mi}:${ss}`;
}
// Агуулгын эхний мөрөөс л товч дүрсийг татаж харуулна (бүтэн агуулга нь мөр дээр
// дарахад нээгдэх openNotifDetail() дотор л харагдана).
function _notifContentSnippet(content) {
  const firstLine = (content||'').split('\n')[0];
  return firstLine.length > 60 ? firstLine.slice(0,60) + '…' : firstLine;
}
function renderNotifications() {
  const el = document.getElementById('notifications-list');
  if(!el) return;
  populateNotifLogYearOptions();
  populateNotifLogDayOptions();

  const yf = document.getElementById('notiflog-year-filter')?.value || '';
  const mf = document.getElementById('notiflog-month-filter')?.value || '';
  const df = document.getElementById('notiflog-day-filter')?.value || '';
  const tf = document.getElementById('notiflog-type-filter')?.value || '';
  const q = (document.getElementById('notiflog-search')?.value || '').trim().toLowerCase();

  const list = notifications.filter(n => {
    if(!n) return false;
    const d = n.sent_at ? new Date(n.sent_at) : null;
    if(yf && (!d || d.getFullYear() !== +yf)) return false;
    if(mf && (!d || (d.getMonth()+1) !== +mf)) return false;
    if(df && (!d || d.getDate() !== +df)) return false;
    if(tf && (n.category||n.type) !== tf) return false;
    if(q) {
      const recipientStr = (n.recipient||'').toLowerCase();
      const titleStr = (n.title||'').toLowerCase();
      if(!recipientStr.includes(q) && !titleStr.includes(q)) return false;
    }
    return true;
  });

  if(!list.length) { el.innerHTML = '<div class="empty-state">Илгээсэн мэдэгдэл олдсонгүй</div>'; return; }
  el.innerHTML = `<table class="data-table">
    <thead><tr><th>Хугацаа</th><th>Төрөл</th><th>Хүлээн авагч</th><th>Гарчиг</th><th>Агуулга</th><th>Тоо</th><th>Суваг</th></tr></thead>
    <tbody>${list.map(n => `
      <tr class="clickable-row" style="cursor:pointer" onclick="openNotifDetail(${n.id})">
        <td class="dt-mono">${esc(_fmtNotifDateTime(n))}</td>
        <td class="dt-text">${NOTIF_CATEGORY_LABELS[n.category||n.type]||esc(n.type)||'—'}</td>
        <td class="dt-muted">${esc(n.recipient)||'—'}</td>
        <td class="dt-text">${esc(n.title)}</td>
        <td class="dt-muted" style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(_notifContentSnippet(n.content))}</td>
        <td class="dt-mono">${(n.recipients_snapshot||[]).length || '—'}</td>
        <td class="dt-muted">${(n.channels||[]).map(c=>c==='inapp'?'In-app':c==='email'?'Мэйл':'СМС').join(', ')||'—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

// Мөр дээр дарахад бодит агуулга, бүх хүлээн авагчийн жагсаалтыг харуулна
function openNotifDetail(id) {
  const n = notifications.find(x=>x&&x.id===id);
  if(!n) return;
  const recipients = n.recipients_snapshot || [];
  const body = document.getElementById('notif-detail-body');
  body.innerHTML = `
    <div style="margin-bottom:14px">
      <span class="tag" style="font-size:10.5px">${esc(NOTIF_CATEGORY_LABELS[n.category||n.type]||n.type||'')}</span>
      <div style="font-weight:700;font-size:15px;margin-top:8px">${esc(n.title)}</div>
      <div style="font-size:12.5px;color:var(--text-dim);margin-top:6px;white-space:pre-wrap">${esc(n.content)}</div>
    </div>
    <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px">
      ${esc(n.date)||(n.sent_at?n.sent_at.slice(0,10):'—')} ·
      ${(n.channels||[]).map(c=>c==='inapp'?'In-app':c==='email'?'Мэйл':'СМС').join(', ')||'—'}
    </div>
    <div style="font-weight:700;font-size:12.5px;margin:14px 0 8px;text-transform:uppercase;letter-spacing:.03em;color:var(--text-secondary)">Хүлээн авагчид (${recipients.length})</div>
    <div style="max-height:260px;overflow-y:auto">
      ${recipients.length ? recipients.map(r => `
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">
          <span>${esc(r.name||'—')}${r.apt?` <span class="dt-muted">(${esc(String(r.apt))})</span>`:''}</span>
          <span class="dt-muted" style="font-size:11.5px">${esc(r.email||r.phone||'')}</span>
        </div>`).join('') : '<div class="empty-state">Хүлээн авагчийн мэдээлэл алга</div>'}
    </div>`;
  openModal('modal-notif-detail');
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
