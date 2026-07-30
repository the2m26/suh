// gate-control.js — "Хаалтны удирдлага" хуудасны логик (2026-07-30 нэмэв)
// Хамаарал: sb (db.js), residents (residents.js), esc/fmtMoney/toast (suh.html
// core), canView/canWrite (suh.html), logActivity (db.js), accountingRecordIncome
// (accounting-bridge.js). "Ирсэн санал, хүсэлт" (call-log)-той ижил шүүлтүүр/
// хайлт/хүснэгэл загвар.
//
// 2 таб: "Зочид" (guest_invites, userapp-react "Зочин урих" tile-аас үүсдэг) ба
// "Түр зогссон машид" (temp_parking_log, урилгагүй — такси/хүргэлт г.м).
// Хоёулаа gate-webhook Edge Function-ээр орж/гардаг (энтэрэд орох, хэтэрсэн
// хугацааны төлбврийг тооцоолж payment_intent үүсгэдэг). Одоогоор QPay мерчант
// эрх хараахан алга (mock горим) тул төлбврийг ЭНД ажилтан ГАРААР баталгаажуулна.

let _gateGuestAll = [];
let _gateTempAll = [];

function switchGateLogTab(name, el) {
  document.getElementById('gate-log-tab-guests').style.display = name === 'guests' ? '' : 'none';
  document.getElementById('gate-log-tab-temp').style.display = name === 'temp' ? '' : 'none';
  document.querySelectorAll('#gate-log-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  if (name === 'guests') loadGateGuestLog();
  if (name === 'temp') loadTempParkingLog();
}

async function renderGateControlPage() {
  _populateGateYearOptions('gatelog-year-filter', _gateGuestAll);
  _populateGateDayOptions('gatelog-day-filter');
  _populateGateYearOptions('temppark-year-filter', _gateTempAll);
  _populateGateDayOptions('temppark-day-filter');
  await loadGateGuestLog();
}

// ============================================================
// Түгээмэл туслах функцүүд (2 таб хоёуланд адил ашиглана)
// ============================================================
function _fmtGateDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, '0'), da = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0'), mi = String(d.getMinutes()).padStart(2, '0'), ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}/${mo}/${da} ${hh}:${mi}:${ss}`;
}
function _fmtPlate(digits, letters) {
  if (!digits && !letters) return '—';
  return `${digits || ''} ${letters || ''}`.trim();
}
function _populateGateYearOptions(selId, allRows) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const years = [...new Set(allRows.filter(r => r.created_at).map(r => +r.created_at.slice(0, 4)))].sort((a, b) => b - a);
  const key = years.join(',');
  if (sel.dataset.yearsKey === key) return;
  const curVal = sel.value;
  sel.innerHTML = '<option value="">Бүх он</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
  sel.value = curVal;
  sel.dataset.yearsKey = key;
}
function _populateGateDayOptions(selId) {
  const el = document.getElementById(selId);
  if (!el || el.dataset.init) return;
  const opts = [];
  for (let d = 1; d <= 31; d++) opts.push(`<option value="${d}">${d}</option>`);
  el.innerHTML = '<option value="">Бүх өдөр</option>' + opts.join('');
  el.dataset.init = '1';
}
function _residentLabelForApt(apt) {
  const r = residents.find(x => String(x.apt) === String(apt));
  return r ? `${r.firstname || ''} ${r.lastname || ''}`.trim() + ` (${apt})` : String(apt || '—');
}
const GATE_STATUS_LABELS = { pending: 'Хүлээгдэж буй', entered: 'Орсон', completed: 'Дууссан' };

// ============================================================
// ЗОЧИД (guest_invites)
// ============================================================
async function loadGateGuestLog() {
  const body = document.getElementById('gate-guest-log-body');
  if (!body) return;
  if (!_gateGuestAll.length) {
    const { data, error } = await sb.from('guest_invites').select('*').order('created_at', { ascending: false });
    if (error) { body.innerHTML = `<div class="empty-state">Ачаалахад алдаа гарлаа: ${esc(error.message)}</div>`; return; }
    _gateGuestAll = data || [];
    _populateGateYearOptions('gatelog-year-filter', _gateGuestAll);
  }
  _populateGateDayOptions('gatelog-day-filter');

  const yf = document.getElementById('gatelog-year-filter')?.value || '';
  const mf = document.getElementById('gatelog-month-filter')?.value || '';
  const df = document.getElementById('gatelog-day-filter')?.value || '';
  const sf = document.getElementById('gatelog-status-filter')?.value || '';
  const q = (document.getElementById('gatelog-search')?.value || '').trim().toLowerCase();

  const list = _gateGuestAll.filter(r => {
    const d = r.created_at ? new Date(r.created_at) : null;
    if (yf && (!d || d.getFullYear() !== +yf)) return false;
    if (mf && (!d || (d.getMonth() + 1) !== +mf)) return false;
    if (df && (!d || d.getDate() !== +df)) return false;
    if (sf && r.status !== sf) return false;
    if (q) {
      const resident = residents.find(x => String(x.apt) === String(r.apt));
      const hay = `${r.apt} ${r.plate_digits || ''} ${r.plate_letters || ''} ${resident?.firstname || ''} ${resident?.lastname || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (!list.length) { body.innerHTML = '<div class="empty-state">Бичлэг олдсонгүй</div>'; return; }
  const canEdit = canWrite('gate-log');
  body.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>Хүсэлт бүртгэгдсэн</th><th>Урьсан Сууц өмчлөгч</th><th>Машины дугаар</th>
      <th>Нэвтэрсэн огноо</th><th>Хэтэрсэн мин</th><th>Төлөх дүн</th><th>Төлөв</th><th></th>
    </tr></thead>
    <tbody>${list.map(r => {
      const needsPayment = r.charge_amount > 0 && r.payment_intent_id;
      return `
      <tr data-id="${r.id}">
        <td class="dt-mono">${esc(_fmtGateDateTime(r.created_at))}</td>
        <td class="dt-text">${esc(_residentLabelForApt(r.apt))}</td>
        <td class="dt-mono">${esc(_fmtPlate(r.plate_digits, r.plate_letters))}</td>
        <td class="dt-mono">${esc(_fmtGateDateTime(r.entered_at))}</td>
        <td class="dt-text">${r.overage_minutes ? esc(String(r.overage_minutes)) : '—'}</td>
        <td class="dt-text">${r.charge_amount ? esc(fmtMoney(r.charge_amount)) : '—'}</td>
        <td><span class="tag">${esc(GATE_STATUS_LABELS[r.status] || r.status)}</span></td>
        <td>${needsPayment && canEdit
          ? `<button class="btn btn-sm btn-primary" onclick="confirmGatePayment('guest',${r.id})">Баталгаажуулах</button>`
          : ''}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
}

// ============================================================
// ТүР ЗОГССОН МАШИД (temp_parking_log — урилгагүй, такси/хүргэлт г.м)
// ============================================================
async function loadTempParkingLog() {
  const body = document.getElementById('temp-parking-log-body');
  if (!body) return;
  if (!_gateTempAll.length) {
    const { data, error } = await sb.from('temp_parking_log').select('*').order('entered_at', { ascending: false });
    if (error) { body.innerHTML = `<div class="empty-state">Ачаалахад алдаа гарлаа: ${esc(error.message)}</div>`; return; }
    _gateTempAll = data || [];
    _populateGateYearOptions('temppark-year-filter', _gateTempAll);
  }
  _populateGateDayOptions('temppark-day-filter');

  const yf = document.getElementById('temppark-year-filter')?.value || '';
  const mf = document.getElementById('temppark-month-filter')?.value || '';
  const df = document.getElementById('temppark-day-filter')?.value || '';
  const q = (document.getElementById('temppark-search')?.value || '').trim().toLowerCase();

  const list = _gateTempAll.filter(r => {
    const d = r.entered_at ? new Date(r.entered_at) : null;
    if (yf && (!d || d.getFullYear() !== +yf)) return false;
    if (mf && (!d || (d.getMonth() + 1) !== +mf)) return false;
    if (df && (!d || d.getDate() !== +df)) return false;
    if (q) {
      const hay = `${r.plate_digits || ''} ${r.plate_letters || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (!list.length) { body.innerHTML = '<div class="empty-state">Бичлэг олдсонгүй</div>'; return; }
  const canEdit = canWrite('gate-log');
  body.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>Машины дугаар</th><th>Орсон цаг</th><th>Гарсан цаг</th>
      <th>Хэтэрсэн мин</th><th>Төлсөн дүн</th><th></th>
    </tr></thead>
    <tbody>${list.map(r => {
      const needsPayment = r.charge_amount > 0 && r.payment_intent_id;
      return `
      <tr data-id="${r.id}">
        <td class="dt-mono">${esc(_fmtPlate(r.plate_digits, r.plate_letters))}</td>
        <td class="dt-mono">${esc(_fmtGateDateTime(r.entered_at))}</td>
        <td class="dt-mono">${esc(_fmtGateDateTime(r.exited_at))}</td>
        <td class="dt-text">${r.overage_minutes ? esc(String(r.overage_minutes)) : '—'}</td>
        <td class="dt-text">${r.charge_amount ? esc(fmtMoney(r.charge_amount)) : '—'}</td>
        <td>${needsPayment && canEdit
          ? `<button class="btn btn-sm btn-primary" onclick="confirmGatePayment('temp',${r.id})">Баталгаажуулах</button>`
          : ''}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
}

// ============================================================
// ГАРААР ТӨЛБӨР БАТАЛГААЖУУЛАХ (QPay мерчант эрх хараахан алга үед ашиглана)
// ============================================================
// ⚠️ Бодит QPay эрх орж ирвэл, энэ функцийг ЗӨВХӨН fallback (жиш нь бэлнээр
// төлсөн үед) болгож үлдээж, гол урсгал нь qpay-webhook-ийн автомат
// баталгаажуулалт руу шилжинэ.
async function confirmGatePayment(kind, id) {
  if (!canWrite('gate-log')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  const table = kind === 'guest' ? 'guest_invites' : 'temp_parking_log';
  const cache = kind === 'guest' ? _gateGuestAll : _gateTempAll;
  const row = cache.find(r => r.id === id);
  if (!row || !row.payment_intent_id) { toast('Төлбврийн мэдээлэл олдсонгүй', 'error'); return; }
  if (!confirm(`${fmtMoney(row.charge_amount)} төлбврийг баталгаажуулах уу?`)) return;

  const nowIso = new Date().toISOString();
  const { error: piErr } = await sb.from('payment_intents')
    .update({ status: 'paid', paid_at: nowIso }).eq('id', row.payment_intent_id);
  if (piErr) { toast('Хадгалахад алдаа гарлаа: ' + piErr.message, 'error'); return; }

  if (kind === 'temp') {
    await sb.from('temp_parking_log').update({ exited_at: row.exited_at || nowIso }).eq('id', id);
  }

  const plateLabel = _fmtPlate(row.plate_digits, row.plate_letters);
  const desc = kind === 'guest'
    ? `Зочны хэтэрсэн хугацааны төлбөр — ${plateLabel} (${row.overage_minutes} мин)`
    : `Түр зогсолтын хэтэрсэн хугацааны төлбөр — ${plateLabel} (${row.overage_minutes} мин)`;
  await accountingRecordIncome('Хаалтны хэтэрсэн хугацаа, түр зогсолтын төлбөр', row.charge_amount, nowIso.slice(0, 10), desc);
  logActivity('payment', 'gate-log', id, desc);

  toast('Төлбөр баталгаажлаа ✓', 'success');
  if (kind === 'guest') { _gateGuestAll = []; await loadGateGuestLog(); }
  else { _gateTempAll = []; await loadTempParkingLog(); }
  updateGateLogBadge();
}

// ============================================================
// Sidebar badge — хүлээгдэж буй (баталгаажаагүй) төлбврийн тоо
// ============================================================
async function updateGateLogBadge() {
  const { count, error } = await sb.from('payment_intents')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .or('guest_invite_id.not.is.null,temp_parking_id.not.is.null');
  const badge = document.getElementById('gate-log-badge');
  if (!badge || error) return;
  if (count > 0) { badge.textContent = count; badge.style.display = ''; }
  else badge.style.display = 'none';
}
