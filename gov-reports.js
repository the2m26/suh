// gov-reports.js — "СӨХ тохиргоо" + "Албан тайлан" (НД-7, НД-8) модуль.
// ⚠️ ЭНЭ ФАЙЛ ШИНЭ (2026-07-13) — цаашид ХХОАТ, ААНОАТ, НӨАТ, Санхүүгийн тайлан
// нэмэгдэхэд ЭНЭ ФАЙЛД нэмнэ. Ажлын хуваарь:
//   - СӨХ тохиргоо (org_profile): settings хүснэгэлд key='org_profile' jsonb-аар хадгална
//   - НД-7/НД-8: аль хэдийн ПОСТ хийгдсэн (sendMonthlyInvoice/цалингийн) journal_entries-ээс
//     уншиж угсарна — ЛАВ ДАХИН ТООЦООЛОХГҮЙ, зөвхөн батлагдсан журналын дүнг харуулна.
// ⚠️ Энэ бол анхны хувилбар — албан ёсны PDF/Excel маягттай ПИКСЕЛИЙН нарийвчлалтай
// тулгаагүй, зөвхөн МЭДЭЭЛЛИЙН БҮТЭЦ (баганууд, ангилал) нь зөв байхаар зохион бүтээв.
// Бодит бөглөсөн жишээтэй тулгаад, байрлалыг нарийвчлан тохируулах шаардлагатай.

// ============================================================
// СӨХ ТОХИРГОО (org_profile)
// ============================================================
let _sokhOrgProfile = null;

async function renderSokhSettingsPage() {
  const { data, error } = await sb.from('settings').select('value').eq('key', 'org_profile').maybeSingle();
  if (error) { console.error('org_profile load error:', error.message); }
  _sokhOrgProfile = (data && data.value) || { bank_accounts: [] };

  const p = _sokhOrgProfile;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  setVal('sokh-org-name', p.org_name);
  setVal('sokh-reg-number', p.reg_number);
  setVal('sokh-activity-type', p.activity_type);
  setVal('sokh-nd-reg-number', p.nd_reg_number);
  setVal('sokh-province', p.province);
  setVal('sokh-district', p.district);
  setVal('sokh-khoroo', p.khoroo);
  setVal('sokh-street', p.street);
  setVal('sokh-building', p.building);
  setVal('sokh-gate-number', p.gate_number);
  setVal('sokh-landline', p.landline);
  setVal('sokh-mobile', p.mobile);
  setVal('sokh-fax', p.fax);
  setVal('sokh-email', p.email);
  setVal('sokh-website', p.website);
  document.getElementById('sokh-director-name').value = _findEmployeeNameByPosition('Гүйцэтгэх захирал');
  document.getElementById('sokh-accountant-name').value = _findEmployeeNameByPosition('Нягтлан бодогч');
  if (p.liability_type_code) document.getElementById('sokh-liability-type').value = p.liability_type_code;
  if (p.ownership_type_code) document.getElementById('sokh-ownership-type').value = p.ownership_type_code;

  renderSokhBankAccountsList(p.bank_accounts || []);
}

function renderSokhBankAccountsList(accounts) {
  const wrap = document.getElementById('sokh-bank-accounts-list');
  if (!wrap) return;
  if (!accounts.length) accounts = [{ bank_name: '', account_number: '' }];
  wrap.innerHTML = accounts.map((a, i) => `
    <div class="flex gap-8 mb-8" data-bank-row="${i}">
      <input type="text" placeholder="Банкны нэр" value="${esc(a.bank_name || '')}" style="flex:1" onchange="_sokhBankFieldChanged(${i},'bank_name',this.value)">
      <input type="text" placeholder="Дансны дугаар" value="${esc(a.account_number || '')}" style="flex:1" onchange="_sokhBankFieldChanged(${i},'account_number',this.value)">
      <button class="btn btn-ghost btn-sm" onclick="removeSokhBankAccountRow(${i})" title="Устгах">✕</button>
    </div>`).join('');
  wrap._accounts = accounts;
}
function _sokhBankFieldChanged(idx, field, value) {
  const wrap = document.getElementById('sokh-bank-accounts-list');
  if (wrap._accounts[idx]) wrap._accounts[idx][field] = value;
}
function addSokhBankAccountRow() {
  const wrap = document.getElementById('sokh-bank-accounts-list');
  const accounts = wrap._accounts || [];
  accounts.push({ bank_name: '', account_number: '' });
  renderSokhBankAccountsList(accounts);
}
function removeSokhBankAccountRow(idx) {
  const wrap = document.getElementById('sokh-bank-accounts-list');
  const accounts = (wrap._accounts || []).filter((_, i) => i !== idx);
  renderSokhBankAccountsList(accounts);
}

async function saveSokhSettings() {
  if (!canWrite('gov_reports') && currentProfile?.role !== 'admin') {
    toast('Танд энэ тохиргоог хадгалах эрх байхгүй байна', 'error'); return;
  }
  const getVal = id => document.getElementById(id)?.value.trim() || '';
  const wrap = document.getElementById('sokh-bank-accounts-list');
  const value = {
    org_name: getVal('sokh-org-name'), reg_number: getVal('sokh-reg-number'),
    activity_type: getVal('sokh-activity-type'), nd_reg_number: getVal('sokh-nd-reg-number'),
    province: getVal('sokh-province'), district: getVal('sokh-district'), khoroo: getVal('sokh-khoroo'),
    street: getVal('sokh-street'), building: getVal('sokh-building'), gate_number: getVal('sokh-gate-number'),
    landline: getVal('sokh-landline'), mobile: getVal('sokh-mobile'), fax: getVal('sokh-fax'),
    email: getVal('sokh-email'), website: getVal('sokh-website'),
    liability_type_code: document.getElementById('sokh-liability-type').value,
    ownership_type_code: document.getElementById('sokh-ownership-type').value,
    bank_accounts: (wrap._accounts || []).filter(a => a.bank_name || a.account_number),
  };
  const { error } = await sb.from('settings').upsert({ key: 'org_profile', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) { toast('Хадгалахад алдаа гарлаа: ' + error.message, 'error'); return; }
  _sokhOrgProfile = value;
  toast('СӨХ-ийн тохиргоо хадгалагдлаа ✓', 'success');
}

// ============================================================
// АЛБАН ТАЙЛАН (НД-7 / НД-8)
// ============================================================
// 70xx (болон бусад expense) данснаас salary_components.nd7_category руу
// хөрвүүлэх — ирээдүйд шинэ нэмэгдэл нэмэгдэхэд код өөрчлөх шаардлагагүй.
let _nd7CategoryByAccount = null;
async function _ensureNd7CategoryMap() {
  if (_nd7CategoryByAccount) return _nd7CategoryByAccount;
  const { data, error } = await sb.from('salary_components').select('expense_account, nd7_category');
  sbErr(error, 'НД-7 ангилал ачаалах', {silent:true});
  _nd7CategoryByAccount = { '7010': 'base' };
  (data || []).forEach(c => { if (c.expense_account) _nd7CategoryByAccount[c.expense_account] = c.nd7_category || 'other_addition'; });
  return _nd7CategoryByAccount;
}

// Тухайн сард аль хэдийн ПОСТ хийгдсэн (батлагдсан) цалингийн журналыг уншиж,
// ажилтан тус бүрээр нь account_code-оор нь бүлэглэнэ. ЛАВ дахин тооцоолохгүй.
async function _fetchPayrollJournalForMonth(yearMonth) {
  const { data, error } = await sb
    .from('journal_entries')
    .select('id, journal_lines(account_code, debit, credit, party)')
    .ilike('reference', `payroll:employee:%:${yearMonth}`);
  if (error) { console.error('payroll journal load error:', error.message); return {}; }
  const byEmployee = {}; // dbId -> {byAccount: {code:{debit,credit}}}
  (data || []).forEach(entry => {
    (entry.journal_lines || []).forEach(l => {
      const m = /^employee:(\d+)$/.exec(l.party || '');
      if (!m) return;
      const dbId = +m[1];
      byEmployee[dbId] = byEmployee[dbId] || {};
      byEmployee[dbId][l.account_code] = { debit: +l.debit || 0, credit: +l.credit || 0 };
    });
  });
  return byEmployee;
}

function _govReportYearMonth() {
  const y = document.getElementById('gov-report-year').value;
  const m = document.getElementById('gov-report-month').value;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function switchGovReportTab(name, el) {
  document.querySelectorAll('#gov-reports-tabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('gov-report-nd7').style.display = name === 'nd7' ? '' : 'none';
  document.getElementById('gov-report-nd8').style.display = name === 'nd8' ? '' : 'none';
  checkGovReportTemplateStatus();
}

async function renderGovReportsPage() {
  const yearEl = document.getElementById('gov-report-year');
  const monthEl = document.getElementById('gov-report-month');
  if (!yearEl.value) yearEl.value = new Date().getFullYear();
  if (!monthEl.options.length) {
    monthEl.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}-р сар</option>`).join('');
    monthEl.value = new Date().getMonth() + 1;
  }
  await renderSokhSettingsPage(); // org_profile кэшийг шинэчилнэ (тайланд шаардлагатай)
  await Promise.all([_renderND7(), _renderND8(), checkGovReportTemplateStatus()]);
}

const INSURED_TYPE_LABELS = {
  1: 'Нийгмийн болон эрүүл мэндийн даатгалд хамрагдагчид',
  2: 'Зөвхөн эрүүл мэндийн даатгалд хамрагдагчид',
  3: 'Хүүхдээ асарч буй чөлөөтэй эх, дайчлагдагчид, гэрээгээр суралцагчид, цэргийн албан хаагчид',
  4: 'Тэтгэвэр тогтоолгосон ажиллагчид',
  5: 'Бусад',
};

const LIABILITY_TYPES = [
  { code: '10', label: 'Хувьцаат компани' }, { code: '11', label: 'Хязгаарлагдмал хариуцлагатай компани' },
  { code: '20', label: 'Бүх гишүүд нь хариуцлагатай нөхөрлөл' }, { code: '21', label: 'Зарим гишүүд нь хариуцлагатай нөхөрлөл' },
  { code: '30', label: 'Хоршоо' }, { code: '40', label: 'Төрийн өмчит үйлдвэрийн газар' },
  { code: '41', label: 'Орон нутгийн өмчит үйлдвэрийн газар' }, { code: '60', label: 'Төсөвт байгууллага' },
  { code: '61', label: 'Үүнээс: Цэрэг цагдаагийн' }, { code: '70', label: 'Төрийн бус байгууллага' },
  { code: '80', label: 'Бусад' },
];
// Өмчийн хэлбэр нь 3 бүлэгт хуваагдана (Төрийн/Орон нутгийн/Хувийн), бүлэг тус бүрд
// хэд хэдэн код-label — _gfCheckboxTable()-той адилгүй тул тусдаа рендерлэнэ.
const OWNERSHIP_GROUPS = [
  { group: 'Төрийн', items: [{ code: '11', label: 'өмчийн' }, { code: '12', label: 'өмчийн оролцоотой' }, { code: '13', label: 'хамтарсан (....%)' }] },
  { group: 'Орон нутгийн', items: [{ code: '30', label: 'өмчийн' }, { code: '31', label: 'өмчийн оролцоотой' }, { code: '32', label: 'хамтарсан (....%)' }] },
  { group: 'Хувийн', items: [{ code: '21', label: 'Монгол Улсын' }, { code: '22', label: 'гадаадтай хамтарсан (....%)' }, { code: '23', label: 'гадаад улсын' }] },
];

function _findEmployeePhoneByPosition(positionName) {
  const emp = employees.find(e => e.position === positionName && e.status === 'active');
  return emp ? (emp.phone || '') : '';
}

async function _computeND7Data(yearMonth) {
  const [year, month] = yearMonth.split('-');
  const [catMap, journalByEmp] = await Promise.all([_ensureNd7CategoryMap(), _fetchPayrollJournalForMonth(yearMonth)]);
  const p = _sokhOrgProfile || {};

  const rowKeys = ['base', 'bonus', 'other_addition', 'annual_leave', 'meal_transport', 'fuel_coal'];
  const rowMD = { base: 3, bonus: 4, other_addition: 5, annual_leave: 6, meal_transport: 7, fuel_coal: 8 };
  const grid = {}; rowKeys.forEach(k => { grid[k] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; });
  const insuredCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let mongolCount = 0, foreignCount = 0;
  let ndshEmployeeTotal = 0, ndshEmployerTotal = 0;

  const activeEmployees = employees.filter(e => e.status === 'active' || journalByEmp[e.dbId]);
  activeEmployees.forEach(e => {
    const col = e.insuredType || 1;
    insuredCount[col] = (insuredCount[col] || 0) + 1;
    if (e.nationality === 'foreign') foreignCount++; else mongolCount++;
    const byAccount = journalByEmp[e.dbId] || {};
    Object.entries(byAccount).forEach(([code, amt]) => {
      const cat = catMap[code];
      if (cat && rowKeys.includes(cat)) grid[cat][col] = +(grid[cat][col] + (amt.debit || 0)).toFixed(2);
    });
    const employerNdsh = byAccount['7020']?.debit || 0;
    const totalNdsh = byAccount['3030']?.credit || 0;
    ndshEmployerTotal += employerNdsh;
    ndshEmployeeTotal += Math.max(totalNdsh - employerNdsh, 0);
  });

  const rowTotal = k => [1, 2, 3, 4, 5].reduce((s, c) => s + grid[k][c], 0);
  const grandTotal = rowKeys.reduce((s, k) => s + rowTotal(k), 0);
  const ndshTotal = ndshEmployeeTotal + ndshEmployerTotal;
  const ndshRate = grandTotal > 0 ? (ndshTotal / grandTotal * 100).toFixed(2) : '';
  const bankAccounts = (p.bank_accounts || []).map(a => ({ bank_name: a.bank_name || '', account_number: a.account_number || '' }));

  const data = {
    org_name: p.org_name || '', reg_number: p.reg_number || '', activity_type: p.activity_type || '',
    nd_reg_number: p.nd_reg_number || '', year, month: +month,
    province: p.province || '', district: p.district || '', khoroo: p.khoroo || '',
    street: p.street || '', building: p.building || '', gate_number: p.gate_number || '',
    landline: p.landline || '', mobile: p.mobile || '', fax: p.fax || '', email: p.email || '', website: p.website || '',
    director_name: _findEmployeeNameByPosition('Гүйцэтгэх захирал'),
    accountant_name: _findEmployeeNameByPosition('Нягтлан бодогч'),
    director_phone: _findEmployeePhoneByPosition('Гүйцэтгэх захирал'),
    accountant_phone: _findEmployeePhoneByPosition('Нягтлан бодогч'),
    bank_accounts: bankAccounts,
    mongol_count: mongolCount, foreign_count: foreignCount, total_employees: activeEmployees.length,
    insured_count_1: insuredCount[1], insured_count_2: insuredCount[2], insured_count_3: insuredCount[3],
    insured_count_4: insuredCount[4], insured_count_5: insuredCount[5],
    ndsh_rate: ndshRate, ndsh_total: fmtMoney(ndshTotal),
    ndsh_employee_total: fmtMoney(ndshEmployeeTotal), ndsh_employer_total: fmtMoney(ndshEmployerTotal),
  };
  // Хариуцлагын/өмчийн хэлбэрийн boolean флаг ({#liability_11}✓{/liability_11} гэх мэт docx-д ашиглахад)
  LIABILITY_TYPES.forEach(it => { data['liability_' + it.code] = (p.liability_type_code === it.code); });
  OWNERSHIP_GROUPS.forEach(g => g.items.forEach(it => { data['ownership_' + it.code] = (p.ownership_type_code === it.code); }));
  data.liability_type_label = (LIABILITY_TYPES.find(it => it.code === p.liability_type_code) || {}).label || '';
  const ownFlat = OWNERSHIP_GROUPS.flatMap(g => g.items);
  data.ownership_type_label = (ownFlat.find(it => it.code === p.ownership_type_code) || {}).label || '';
  // Б хэсгийн мөр бүрийг МД дугаараар нь (b3_1..b3_6, b4_1..b4_6, гэх мэт) — 6=Бүгд багана
  rowKeys.forEach(k => {
    const md = rowMD[k];
    for (let c = 1; c <= 5; c++) data[`b${md}_${c}`] = fmtMoney(grid[k][c]);
    data[`b${md}_6`] = fmtMoney(rowTotal(k));
  });
  return data;
}

async function _computeND8Data(yearMonth) {
  const [year, month] = yearMonth.split('-');
  const [catMap, journalByEmp] = await Promise.all([_ensureNd7CategoryMap(), _fetchPayrollJournalForMonth(yearMonth)]);
  const p = _sokhOrgProfile || {};
  const activeEmployees = employees.filter(e => e.status === 'active' || journalByEmp[e.dbId]);

  const employeeRows = activeEmployees.map((e, i) => {
    const byAccount = journalByEmp[e.dbId] || {};
    const byCat = { base: 0, bonus: 0, other_addition: 0, annual_leave: 0, meal_transport: 0, fuel_coal: 0 };
    Object.entries(byAccount).forEach(([code, amt]) => {
      const cat = catMap[code];
      if (cat && byCat.hasOwnProperty(cat)) byCat[cat] += amt.debit || 0;
    });
    const grossIncome = Object.values(byCat).reduce((s, v) => s + v, 0);
    const employerNdsh = byAccount['7020']?.debit || 0;
    const totalNdsh = byAccount['3030']?.credit || 0;
    const employeeNdsh = Math.max(totalNdsh - employerNdsh, 0);
    return {
      no: i + 1, last_name: e.lastName || '', parent_name: e.parentName || '', first_name: e.firstName || e.fullName || '',
      register_number: e.registerNumber || '', is_mongol: e.nationality !== 'foreign', is_foreign: e.nationality === 'foreign',
      nationality_label: e.nationality === 'foreign' ? 'Гадаад' : 'Монгол', insured_type: e.insuredType || 1,
      base: fmtMoney(byCat.base), bonus: fmtMoney(byCat.bonus), other_addition: fmtMoney(byCat.other_addition),
      annual_leave: fmtMoney(byCat.annual_leave), meal_transport: fmtMoney(byCat.meal_transport), fuel_coal: fmtMoney(byCat.fuel_coal),
      gross: fmtMoney(grossIncome), employer_ndsh: fmtMoney(employerNdsh), employee_ndsh: fmtMoney(employeeNdsh),
      occupation_code: e.occupationCode || '', phone: e.phone || '',
    };
  });

  return {
    org_name: p.org_name || '', nd_reg_number: p.nd_reg_number || '', year, month: +month,
    director_name: _findEmployeeNameByPosition('Гүйцэтгэх захирал'),
    accountant_name: _findEmployeeNameByPosition('Нягтлан бодогч'),
    employees: employeeRows,
  };
}

// ============================================================
// ДЭЛГЭЦИЙН ХУРААНГУЙ (зөвхөн шалгах зориулалттай — хэвлэхэд ашиглагдахгүй,
// бодит албан ёсны гаралт ЗӨВХӨН DOCX загвараар л гарна)
// ============================================================
async function _renderND7() {
  const el = document.getElementById('gov-report-nd7');
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';
  const yearMonth = _govReportYearMonth();
  const d = await _computeND7Data(yearMonth);
  el.innerHTML = `
    <div class="card" style="padding:18px">
      <div style="font-weight:700;margin-bottom:10px">НД-7 — өгөгдлийн хураангуй (${yearMonth})</div>
      <div class="grid-2" style="font-size:12.5px;gap:6px 20px">
        <div class="summary-row"><span class="summary-key">Байгууллага</span><span class="summary-val">${esc(d.org_name) || '—'}</span></div>
        <div class="summary-row"><span class="summary-key">Даатгуулагчдын тоо</span><span class="summary-val">${d.total_employees} (Монгол ${d.mongol_count} · Гадаад ${d.foreign_count})</span></div>
        <div class="summary-row"><span class="summary-key">Хөдөлмөрийн хөлсний нийт дүн</span><span class="summary-val">${d.b9_6}₮</span></div>
        <div class="summary-row"><span class="summary-key">НДШ (ажилтан)</span><span class="summary-val">${d.ndsh_employee_total}₮</span></div>
        <div class="summary-row"><span class="summary-key">НДШ (ажил олгогч)</span><span class="summary-val">${d.ndsh_employer_total}₮</span></div>
        <div class="summary-row" style="font-weight:700"><span class="summary-key">Нийт НДШ</span><span class="summary-val">${d.ndsh_total}₮</span></div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:12px">Энэ бол зөвхөн шалгах зориулалттай хураангуй. Албан ёсны гаралт "Word файл татах" товчоор гарна.</div>
    </div>`;
}

async function _renderND8() {
  const el = document.getElementById('gov-report-nd8');
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';
  const yearMonth = _govReportYearMonth();
  const d = await _computeND8Data(yearMonth);
  el.innerHTML = `
    <div class="card" style="padding:18px">
      <div style="font-weight:700;margin-bottom:10px">НД-8 — өгөгдлийн хураангуй (${yearMonth}) — ${d.employees.length} ажилтан</div>
      <div class="table-wrap">
        <table class="data-table" style="font-size:11.5px">
          <thead><tr><th>№</th><th>Овог</th><th>Нэр</th><th>Регистр</th><th>Нийт орлого</th><th>НДШ(ажилтан)</th><th>НДШ(ажил олгогч)</th></tr></thead>
          <tbody>${d.employees.map(e => `<tr><td class="dt-mono">${e.no}</td><td class="dt-text">${esc(e.last_name)}</td><td class="dt-text">${esc(e.first_name)}</td><td class="dt-mono">${esc(e.register_number)}</td><td class="dt-mono">${e.gross}</td><td class="dt-mono">${e.employee_ndsh}</td><td class="dt-mono">${e.employer_ndsh}</td></tr>`).join('') || '<tr><td colspan="7" class="empty-state">Ажилтан олдсонгүй</td></tr>'}</tbody>
        </table>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:12px">Энэ бол зөвхөн шалгах зориулалттай хураангуй. Албан ёсны гаралт "Word файл татах" товчоор гарна.</div>
    </div>`;
}

// ============================================================
// DOCX ЗАГВАР: upload, шалгах, бөглөж татах (docxtemplater + pizzip)
// ============================================================
function _activeGovReportTab() {
  const t = document.querySelector('#gov-reports-tabs .tab.active');
  return (t && t.textContent.trim() === 'НД-8') ? 'nd8' : 'nd7';
}

async function checkGovReportTemplateStatus() {
  const tab = _activeGovReportTab();
  const statusEl = document.getElementById('gov-report-template-status');
  if (!statusEl) return;
  const { data, error } = await sb.storage.from('gov-report-templates').list('', { search: tab + '.docx' });
  if (error) { statusEl.textContent = ''; return; }
  const found = (data || []).some(f => f.name === tab + '.docx');
  statusEl.textContent = found ? `✓ ${tab.toUpperCase()} загвар байршуулсан` : `⚠️ ${tab.toUpperCase()} загвар оруулаагүй байна`;
  statusEl.style.color = found ? 'var(--success)' : 'var(--warning)';
}

async function uploadGovReportTemplate(inputEl) {
  if (currentProfile?.role !== 'admin') { toast('Зөвхөн Админ загвар байршуулах эрхтэй', 'error'); inputEl.value = ''; return; }
  const file = inputEl.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.docx')) { toast('.docx өргөтгөлтэй файл сонгоно уу', 'error'); inputEl.value = ''; return; }
  const tab = _activeGovReportTab();
  const { error } = await sb.storage.from('gov-report-templates').upload(tab + '.docx', file, { upsert: true, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  inputEl.value = '';
  if (error) { toast('Загвар байршуулахад алдаа гарлаа: ' + error.message, 'error'); return; }
  toast(tab.toUpperCase() + ' загвар амжилттай байршлаа ✓', 'success');
  checkGovReportTemplateStatus();
}

async function generateGovReportDocx() {
  const tab = _activeGovReportTab();
  const yearMonth = _govReportYearMonth();
  const { data: urlData, error: urlErr } = await sb.storage.from('gov-report-templates').createSignedUrl(tab + '.docx', 60);
  if (urlErr || !urlData) { toast(tab.toUpperCase() + ' загвар оруулаагүй байна — эхлээд "Загвар оруулах" товчоор .docx файлаа байршуулна уу', 'error'); return; }

  PizZipUtils.getBinaryContent(urlData.signedUrl, async (error, content) => {
    if (error) { toast('Загвар татахад алдаа гарлаа: ' + error.message, 'error'); return; }
    try {
      const data = tab === 'nd7' ? await _computeND7Data(yearMonth) : await _computeND8Data(yearMonth);
      const zip = new PizZip(content);
      const doc = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.render(data);
      const out = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      saveAs(out, `${tab.toUpperCase()}_${yearMonth}.docx`);
      toast('Word файл татагдлаа ✓', 'success');
    } catch (e) {
      console.error(e);
      const details = e.properties && e.properties.errors ? e.properties.errors.map(er => er.properties?.explanation || er.message).join('; ') : e.message;
      toast('Загвар бөглөхөд алдаа гарлаа: ' + details, 'error');
    }
  });
}



// ============================================================
// СӨХ ТОХИРГОО — ТАБ ШИЛЖИЛТ
// ============================================================
function switchSokhSettingsTab(name, el) {
  document.querySelectorAll('#sokh-settings-tabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('sokh-report-info').style.display = name === 'report-info' ? '' : 'none';
  document.getElementById('sokh-positions').style.display = name === 'positions' ? '' : 'none';
  document.getElementById('sokh-system-start').style.display = name === 'system-start' ? '' : 'none';
  if (name === 'positions') renderJobPositionsTable();
  if (name === 'system-start') renderSystemStartStatus();
}

// ============================================================
// СИСТЕМИЙН ЭХЛЭЛТ — "СӨХ тохиргоо → Системийн эхлэлт" таб
// ============================================================
async function renderSystemStartStatus() {
  const el = document.getElementById('system-start-current');
  const { data, error } = await sb.from('settings').select('*').eq('key', 'system_start').maybeSingle();
  sbErr(error, 'Системийн эхлэлт ачаалах', {silent:true});
  if (data && data.value && data.value.date) {
    el.style.display = 'block';
    el.textContent = `✓ Систем ${_fmtDateSlash(data.value.date)}-нд эхэлсэн (сүүлд идэвхжүүлсэн: ${new Date(data.updated_at).toLocaleDateString('mn-MN')})`;
    document.getElementById('system-start-date').value = data.value.date;
  } else {
    el.style.display = 'none';
  }
}

async function activateSystemStart() {
  const dateVal = document.getElementById('system-start-date').value;
  const force = document.getElementById('system-start-force').checked;
  if (!dateVal) { toast('Системийн эхлэх огноог сонгоно уу', 'error'); return; }
  const confirmMsg = force
    ? `⚠️ Системийн эхлэх огноог ${_fmtDateSlash(dateVal)} болгож идэвхжүүлэх үү?\n\nАНХААР: "Бүгдийг нэг мөр болгох" сонгосон тул ХЭДИЙ ХЭЧНЭЭН бөглөгдсөн байсан ч, БҮХ Сууц өмчлөгч/ААН/Үндсэн хөрөнгийн огноог дарж бичнэ (буцаах боломжгүй)!`
    : `Системийн эхлэх огноог ${_fmtDateSlash(dateVal)} болгож идэвхжүүлэх үү?\n\nЗӨВХӨН хоосон (Өмчилсөн/Гэрээ эхэлсэн/Худалдан авсан) огнооны талбаруудыг дүүргэнэ — бөглөгдсөн огноог дарж бичихгүй.`;
  if (!confirm(confirmMsg)) return;

  try {
    const [r1, r2, r3] = await Promise.all([
      force ? sb.from('residents').update({ own_date: dateVal }).not('id','is',null)
            : sb.from('residents').update({ own_date: dateVal }).is('own_date', null),
      force ? sb.from('businesses').update({ contract_start: dateVal }).not('id','is',null)
            : sb.from('businesses').update({ contract_start: dateVal }).is('contract_start', null),
      force ? sb.from('fixed_assets').update({ purchase_date: dateVal }).not('id','is',null)
            : sb.from('fixed_assets').update({ purchase_date: dateVal }).is('purchase_date', null),
    ]);
    if (r1.error || r2.error || r3.error) {
      toast('Идэвхжүүлэхэд алдаа гарлаа: ' + (r1.error||r2.error||r3.error).message, 'error');
      return;
    }
    const { error: settingsErr } = await sb.from('settings').upsert({ key: 'system_start', value: { date: dateVal, force }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (sbErr(settingsErr, 'Системийн эхлэлт тэмдэглэх')) return;
    systemStartDate = dateVal;

    // Локал массивуудыг DB-тэй тааруулж дахин ачаална (шинэ огноо шууд харагдана)
    await Promise.all([db_loadResidents(), db_loadBusinesses(), db_loadAssets()]);
    businesses.forEach(b => { b.monthlyFee = computeBizFee(b); });

    renderSystemStartStatus();
    refreshDashboard();
    if (typeof renderResidents === 'function') renderResidents();
    if (typeof renderBusinesses === 'function') renderBusinesses();
    toast('Системийн эхлэлт амжилттай идэвхжлээ ✓', 'success');
  } catch (e) {
    toast('Идэвхжүүлэхэд алдаа гарлаа: ' + e.message, 'error');
  }
}

// ============================================================
// АЛБАН ТУШААЛ (job_positions) — "СӨХ тохиргоо → Албан тушаал" таб.
// employees.position нь ТЕКСТЭЭР хадгалагддаг хэвээр (fixed_assets.responsible-тэй
// адил зарчим) — энэ жагсаалт зөвхөн Ажилтан modal-ийн dropdown-ий ЭХ СУРВАЛЖ.
// ============================================================
let jobPositions = [];

async function db_loadJobPositions() {
  const { data, error } = await sb.from('job_positions').select('*').order('sort_order').order('name');
  if (error) { console.error('job_positions load error:', error.message); return; }
  jobPositions = data || [];
}

function renderJobPositionsTable(filter = '') {
  const body = document.getElementById('job-positions-table-body');
  if (!body) return;
  const q = (filter || '').toLowerCase();
  const list = jobPositions.filter(p => p.name.toLowerCase().includes(q));
  if (!list.length) { body.innerHTML = '<tr><td colspan="2" class="empty-state">Албан тушаал бүртгэгдээгүй байна</td></tr>'; return; }
  const canEdit = currentProfile?.role === 'admin';
  const canDel = canEdit;
  body.innerHTML = list.map(p => `
    <tr>
      <td class="dt-text">${esc(p.name)}</td>
      <td>${_rowActionIcons(p.id, canEdit, canDel, 'editJobPosition', 'deleteJobPosition')}</td>
    </tr>`).join('');
}

let editingJobPositionId = null;
function openAddJobPosition() {
  if (currentProfile?.role !== 'admin') { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  editingJobPositionId = null;
  document.getElementById('modal-job-position-title').textContent = 'Албан тушаал нэмэх';
  document.getElementById('job-position-name').value = '';
  openModal('modal-job-position');
}
function editJobPosition(id) {
  if (currentProfile?.role !== 'admin') { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  const p = jobPositions.find(x => x.id === id); if (!p) return;
  editingJobPositionId = id;
  document.getElementById('modal-job-position-title').textContent = 'Албан тушаал засах';
  document.getElementById('job-position-name').value = p.name;
  openModal('modal-job-position');
}
async function saveJobPosition() {
  const name = document.getElementById('job-position-name').value.trim();
  if (!name) { toast('Албан тушаалын нэрийг оруулна уу', 'error'); return; }
  if (editingJobPositionId) {
    const { error } = await sb.from('job_positions').update({ name }).eq('id', editingJobPositionId);
    if (error) { toast('Хадгалахад алдаа гарлаа: ' + error.message, 'error'); return; }
  } else {
    const { error } = await sb.from('job_positions').insert({ name });
    if (error) { toast('Хадгалахад алдаа гарлаа: ' + error.message, 'error'); return; }
  }
  await db_loadJobPositions();
  renderJobPositionsTable(document.getElementById('job-position-search')?.value || '');
  closeModal('modal-job-position');
  toast('Хадгалагдлаа ✓', 'success');
}
async function deleteJobPosition(id) {
  if (currentProfile?.role !== 'admin') { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  if (!confirm('Устгах уу?')) return;
  const { error } = await sb.from('job_positions').delete().eq('id', id);
  if (error) { toast('Устгахад алдаа гарлаа: ' + error.message, 'error'); return; }
  await db_loadJobPositions();
  renderJobPositionsTable(document.getElementById('job-position-search')?.value || '');
  toast('Устгагдлаа', 'success');
}

// Ажилтан нэмэх/засах modal-ийн "Албан тушаал" dropdown-ыг job_positions-ээс угсарна.
function populateEmployeePositionSelect(keepValue) {
  const sel = document.getElementById('employee-position');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Албан тушаал сонгох —</option>' + jobPositions.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('');
  if (keepValue) sel.value = keepValue;
}

// "Гүйцэтгэх захирал"/"Нягтлан бодогч" албан тушаалтай (идэвхтэй) ажилтныг олж,
// "АЖИЛТАН Эцэг/эхийн нэр" форматаар буцаана. Олдохгүй бол хоосон.
function _findEmployeeNameByPosition(positionName) {
  const emp = employees.find(e => e.position === positionName && e.status === 'active');
  return emp ? _employeeDisplayName(emp) : '';
}

// ============================================================
// АПП ТОХИРГОО — "Мобайл апп (userapp.html)" модулийн харагдац
// ============================================================
// userapp.html-ийн REAL_MODULES-тэй яг тохирсон жагсаалт (key/label талбарууд адилхан)
const APP_SETTINGS_MODULES = [
  {key:'dashboard',     label:'Хянах самбар'},
  {key:'residents',     label:'Сууц өмчлөгчийн бүртгэл'},
  {key:'businesses',    label:'Аж ахуйн нэгж бүртгэл'},
  {key:'clientele',     label:'Харилцагчийн бүртгэл'},
  {key:'transactions',  label:'Гүйлгээний бүртгэл'},
  {key:'assets',        label:'Үндсэн хөрөнгө бүртгэл'},
  {key:'payments',      label:'Төлбөрийн явц'},
  {key:'apartments',    label:'Тоот, зогсоол, агуулах'},
  {key:'reports',       label:'Тайлан гаргах'},
  {key:'gov_reports',   label:'Албан тайлан'},
  {key:'notifications', label:'Мэдэгдэл'},
  {key:'polls',         label:'Сонгууль, санал асуулга'},
  {key:'accounting',    label:'Нягтлан бодох бүртгэл'},
  {key:'employees',     label:'Ажилтны бүртгэл'},
];
async function renderAppSettingsModulesList() {
  const el = document.getElementById('app-settings-modules-list');
  if (!el) return;
  const { data, error } = await sb.from('settings').select('*').eq('key', 'mobile_modules').maybeSingle();
  sbErr(error, 'Апп тохиргоо ачаалах', {silent:true});
  // Тохиргоо хараахан хийгдээгүй бол — анхдагчаар БҮГД идэвхтэй (одоогийн зан төлөвтэй адил)
  const enabledKeys = (data && data.value && Array.isArray(data.value.keys)) ? data.value.keys : APP_SETTINGS_MODULES.map(m => m.key);
  el.innerHTML = APP_SETTINGS_MODULES.map(m => `
    <label style="display:flex;align-items:center;gap:10px;padding:9px 4px;cursor:pointer;font-size:13.5px;border-bottom:1px solid var(--border)">
      <input type="checkbox" class="app-settings-mod-cb" value="${m.key}" ${enabledKeys.includes(m.key) ? 'checked' : ''} style="width:auto">
      ${esc(m.label)}
    </label>`).join('');
}
async function saveAppSettingsModules() {
  const keys = Array.from(document.querySelectorAll('.app-settings-mod-cb:checked')).map(cb => cb.value);
  const { error } = await sb.from('settings').upsert({ key: 'mobile_modules', value: { keys }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) { toast('Хадгалахад алдаа гарлаа: ' + error.message, 'error'); return; }
  toast('Апп тохиргоо хадгалагдлаа ✓', 'success');
}
