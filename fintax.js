// fintax.js — "СӨХ тохиргоо" + "Санхүү, татварын тайлан" (НД-7, НД-8) модуль.
// ⚠️ ЭНЭ ФАЙЛ ШИНЭ (2026-07-13) — цаашид ХХОАТ, ААНОАТ, НӨАТ, Санхүүгийн тайлан
// нэмэгдэхэд ЭНЭ ФАЙЛД нэмнэ. Ажлын хуваарь:
//   - СӨХ тохиргоо (org_profile): settings хүснэгэлд key='org_profile' jsonb-аар хадгална
//   - НД-7/НД-8: аль хэдийн ПОСТ хийгдсэн (recordMonthlyInvoice/цалингийн) journal_entries-ээс
//     уншиж угсарна — ЛАВ ДАХИН ТООЦООЛОХГҮЙ, зөвхөн батлагдсан журналын дүнг харуулна.
// ⚠️ Энэ бол анхны хувилбар — албан ёсны PDF/Excel маягттай ПИКСЕЛИЙН нарийвчлалтай
// тулгаагүй, зөвхөн МЭДЭЭЛЛИЙН БҮТЭЦ (баганууд, ангилал) нь зөв байхаар зохион бүтээв.
// Бодит бөглөсөн жишээтэй тулгаад, байрлалыг нарийвчлан тохируулах шаардлагатай.

// ============================================================
// СӨХ ТОХИРГОО (org_profile)
// ============================================================
let _sokhOrgProfile = null;

// ⚠️ 2026-07-20 нэмэв: renderSokhSettingsPage() зөвхөн "СӨХ тохиргоо" хуудсыг
// ЗОРИУДААР нээх үед л _sokhOrgProfile-г ачаалдаг байсан — Нэхэмжлэлийн
// мэдэгдэлд (accounting-bridge.js) банкны дансыг ашиглахын тулд тэр хуудсыг
// заавал нээлгүйгээр ч ачаалж болдог, дахин ашиглах туслах функц.
async function _ensureSokhOrgProfile() {
  if (_sokhOrgProfile) return _sokhOrgProfile;
  const { data, error } = await sb.from('settings').select('value').eq('key', 'org_profile').maybeSingle();
  if (error) { console.error('org_profile load error:', error.message); }
  _sokhOrgProfile = (data && data.value) || { bank_accounts: [] };
  return _sokhOrgProfile;
}

async function renderSokhSettingsPage() {
  const { data, error } = await sb.from('settings').select('value').eq('key', 'org_profile').maybeSingle();
  if (error) { console.error('org_profile load error:', error.message); }
  _sokhOrgProfile = (data && data.value) || { bank_accounts: [] };

  const p = _sokhOrgProfile;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  setVal('sokh-org-name', p.org_name);
  setVal('sokh-reg-number', p.reg_number);
  setVal('sokh-tax-number', p.tax_number);
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
  if (!canWrite('fintax') && currentProfile?.role !== 'admin') {
    toast('Танд энэ тохиргоог хадгалах эрх байхгүй байна', 'error'); return;
  }
  const getVal = id => document.getElementById(id)?.value.trim() || '';
  const wrap = document.getElementById('sokh-bank-accounts-list');
  const value = {
    org_name: getVal('sokh-org-name'), reg_number: getVal('sokh-reg-number'), tax_number: getVal('sokh-tax-number'),
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

// ⚠️ 2026-07-22 нэмэв: Ажилтны бүртгэлд "НДШ" татварыг ганцаарчлан идэвхгүй
// (чөлөөлөгдсөн — тэтгэврийн нас, НДШ дүүргэсэн гэх мэт шалтгаанаар) болгосон
// бол, тэр ажилтан НД-7/НД-8 тайланд "НДШ төлөгч" тоонд ОРОХГүй ёстой. Өмнө нь
// _computeND7Data()/_computeND8Data() үүнийг шалгадаггүй байсан тул чөлөөлөгдсөн
// ажилтныг ч мөн НДШ төлөгч гэж буруу тоолж байсан (НББ-той хамааралгүй,
// зөвхөн fintax.js-ийн филтрийн цоорхой байсан).
async function _fetchNdshExemptEmployeeIds() {
  const { data, error } = await sb.from('employee_tax_overrides').select('employee_id').eq('tax_code', 'ndsh').eq('enabled', false);
  sbErr(error, 'НДШ чөлөөлөлт ачаалах', {silent:true});
  return new Set((data || []).map(r => r.employee_id));
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

const GOV_REPORT_TABS = ['nd7', 'nd8', 'tt02', 'tt03a', 'tt06', 'tt11', 'forma', 'formb'];

function switchGovReportTab(name, el) {
  document.querySelectorAll('#fintax-tabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  GOV_REPORT_TABS.forEach(k => {
    const container = document.getElementById('gov-report-' + k);
    if (container) container.style.display = (name === k) ? '' : 'none';
  });
  checkGovReportTemplateStatus();
}

const GOV_REPORT_PLACEHOLDER_LABELS = {
  tt02: 'ААНОАТТайлан',
  tt03a: 'НӨАТТайлан',
  tt06: 'ХХОАТТайлан',
  tt11: 'ЦХХШУБТАХЭОТайлан',
  forma: 'Санхүүгийн тайлангийн А маягт',
  formb: 'Санхүүгийн тайлангийн Б маягт',
};
// 2026-07-22 нэмэв: шинээр үүсгэсэн 6 таб — зөвхөн бүтэц, дата холболт дараа.
function _renderGovReportPlaceholders() {
  Object.entries(GOV_REPORT_PLACEHOLDER_LABELS).forEach(([key, label]) => {
    const el = document.getElementById('gov-report-' + key);
    if (!el) return;
    el.innerHTML = `<div class="card" style="padding:40px;text-align:center">
      <div style="font-weight:700;margin-bottom:6px">${label}</div>
      <div style="font-size:12px;color:var(--text-muted)">Тайлангийн загвар, дата холболт удахгүй нэмэгдэнэ.</div>
    </div>`;
  });
}

async function renderGovReportsPage() {
  const yearEl = document.getElementById('gov-report-year');
  const monthEl = document.getElementById('gov-report-month');
  if (!yearEl.value) yearEl.value = new Date().getFullYear();
  if (!monthEl.options.length) {
    monthEl.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}-р сар</option>`).join('');
    monthEl.value = new Date().getMonth() + 1;
  }
  _renderGovReportPlaceholders();
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

// НД-7/НД-8 маягтын "Он/Сар/Өдөр" гарын үсгийн огноог таб нээх/хэвлэх бүрд
// өнөөдрийн огноогоор ДИНАМИКААР бөглөнө — "[YYYY]/[MM]/[DD]" форматтай.
function _govReportTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

async function _computeND7Data(yearMonth) {
  const [year, month] = yearMonth.split('-');
  const [catMap, journalByEmp, ndshExemptIds] = await Promise.all([_ensureNd7CategoryMap(), _fetchPayrollJournalForMonth(yearMonth), _fetchNdshExemptEmployeeIds()]);
  const p = _sokhOrgProfile || {};

  const rowKeys = ['base', 'bonus', 'other_addition', 'annual_leave', 'meal_transport', 'fuel_coal'];
  const rowMD = { base: 3, bonus: 4, other_addition: 5, annual_leave: 6, meal_transport: 7, fuel_coal: 8 };
  const grid = {}; rowKeys.forEach(k => { grid[k] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; });
  const insuredCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let mongolCount = 0, foreignCount = 0;
  let ndshEmployeeTotal = 0, ndshEmployerTotal = 0;

  const activeEmployees = employees.filter(e => (e.status === 'active' || journalByEmp[e.dbId]) && !ndshExemptIds.has(e.dbId));
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
  const [catMap, journalByEmp, ndshExemptIds] = await Promise.all([_ensureNd7CategoryMap(), _fetchPayrollJournalForMonth(yearMonth), _fetchNdshExemptEmployeeIds()]);
  const p = _sokhOrgProfile || {};
  const activeEmployees = employees.filter(e => (e.status === 'active' || journalByEmp[e.dbId]) && !ndshExemptIds.has(e.dbId));

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
      register_number: e.registerNumber || '',
      // ⚠️ 2026-07-22 засав: "НД дэвтрийн дугаар" багана өнөөдөр ИБД=ТТД=НДД
      // (e.ttd) дугаараар бөглөгддөг — e.registerNumber (Регистрийн дугаар) БИШ,
      // энэ хоёр Ажилтны бүртгэлд бүрэн ТУСДАА талбар.
      nd_book_number: e.ttd || '',
      is_mongol: e.nationality !== 'foreign', is_foreign: e.nationality === 'foreign',
      nationality_label: e.nationality === 'foreign' ? 'Гадаад' : 'Монгол', insured_type: e.insuredType || 1,
      base: fmtMoney(byCat.base), bonus: fmtMoney(byCat.bonus), other_addition: fmtMoney(byCat.other_addition),
      annual_leave: fmtMoney(byCat.annual_leave), meal_transport: fmtMoney(byCat.meal_transport), fuel_coal: fmtMoney(byCat.fuel_coal),
      gross: fmtMoney(grossIncome), employer_ndsh: fmtMoney(employerNdsh), employee_ndsh: fmtMoney(employeeNdsh),
      occupation_code: e.occupationCode || '', phone: e.phone || '', email: e.email || '',
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
// ⚠️ 2026-07-22 шинэчлэв: v6-ийн хуучин "хураангуй" харагдацыг арилгаж, ЯГ
// хэвлэгдэх маягтын форматаар (_renderND7PrintForm-той ижил) дэлгэцэнд
// харуулдаг болгов — дэлгэцэн дээр харж байгаа нь хэвлэхэд гарах зүйлтэй
// үргэлж тохирно. Апп өөрөө харанхуй дэвсгэртэй тул цагаан хайрцагт багтаав.
async function _renderND7() {
  const el = document.getElementById('gov-report-nd7');
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';
  const yearMonth = _govReportYearMonth();
  const d = await _computeND7Data(yearMonth);
  el.innerHTML = `<div class="nd-report-root nd-a4-portrait">${_renderND7PrintForm(d)}</div>`;
}

async function _renderND8() {
  const el = document.getElementById('gov-report-nd8');
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';
  const yearMonth = _govReportYearMonth();
  const d = await _computeND8Data(yearMonth);
  el.innerHTML = `<div class="nd-report-root nd-a4-landscape">${_renderND8PrintForm(d)}</div>`;
}


// ============================================================
// 2026-07-22 нэмэв: НД-7/НД-8-ын АЛБАН ЁСНЫ ХЭВЛЭХ ФОРМАТ — docx-ийн XML-аас
// программаар (баганы өргөн/нэгтгэл/hүрээ/align бүгд) яг тэр хэмжээгээр
// гаргаж авсан HTML загвар. window.print()-ээр л хэвлэгдэнэ, тусдаа
// файл/сан татах шаардлагагүй (доорхи DOCX-загварын хуучин хандлагыг орлоно).
// ------------------------------------------------------------
// "Тохирохыг дугуйлна" (А.3/А.4) сонголтын checkbox тэмдэг
function _mark(cond) { return cond ? '●' : ''; }

function _renderND7PrintForm(data) {
  return `

<div class="section-a">
<table class="dtbl0 avoidbreak">
<colgroup><col style="width:50.0000%"><col style="width:50.0000%"></colgroup>
<tr>
<td style="text-align:left;vertical-align:middle; font-size: 7pt;" class="">Үндэсний статистикийн хорооны зөвшөөрсөнөөр<br>Сангийн сайд, Хүн амын хөгжил, нийгмийн хамгааллын сайдын<br>2014 оны 2-р сарын 10-ны өдрийн 24/А/20 тоот тушаалаар батлав.</td>
<td style="text-align:right;vertical-align:middle; font-size: 7pt;" class="bold">Хавсралт<br><br>Маягт НД-7</td>
</tr>
<tr>
<td colspan="2" style="text-align:center;vertical-align:middle; font-size: 7pt;" class="bold">Монгол Улсын Статистикийн тухай хуулийн 22 дугаар зүйлийн 3 дугаар заалт, Байгууллагын нууцын тухай хуулийн 5 дугаар<br>зүйлийн 2 дугаар заалтын дагуу мэдээллийн нууцыг чандлан хадгална.<br><br><br><h3 class="sec">“${data.org_name}” СУУЦ ӨМЧЛӨГЧДИЙН ХОЛБООНЫ НИЙГМИЙН ДААТГАЛЫН ШИМТГЭЛ ТӨЛӨЛТИЙН<br>${data.year} ОНЫ ${data.month}-Р САРЫН ТАЙЛАН</h3></td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle; font-size: 7pt;" class="bold">1. Ажил олгогч нь А хэсгийн мэдээллийг жил бүрийн 2-р сарын 5-ны дотор онлайн програмд шивэх ба маягтаар баталгаажуулж жил бүрийн 2-р сарын 20-ны дотор харьяа аймаг, дүүрэг/сум/-ийн нийгмийн даатгалын байгууллагад ирүүлнэ.<br><br>2. Ажил олгогч нь Б хэсгийн мэдээллийг сар бүрийн 5-ны дотор онлайн програмд шивэх ба цаасаар баталгаажуулж сар бүрийн 5-ны дотор харьяа аймаг, дүүрэг/сум/-ийн нийгмийн даатгалын байгууллагад ирүүлнэ.</td>
</tr>
</table>

<h3 class="sec">А. АЖИЛ ОЛГОГЧИЙН МЭДЭЭЛЭЛ</h3>
<h4 class="sub">А.1 Нэрийн хэсэг</h4>
<table class="dtbl avoidbreak">
<colgroup><col style="width:32.6149%"><col style="width:24.5037%"><col style="width:6.1259%"><col style="width:6.1259%"><col style="width:6.1259%"><col style="width:6.1259%"><col style="width:6.1259%"><col style="width:6.1259%"><col style="width:6.1259%"></colgroup>
<tr>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td colspan="4" style="text-align:center;vertical-align:middle;" class="bold">Нэр</td>
<td colspan="4" style="text-align:center;vertical-align:middle;" class="bold">Код</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Ажил олгогчийн нэр</td>
<td colspan="8" style="text-align:left;vertical-align:middle;" class="">${data.org_name}</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Байгууллагын регистрийн дугаар</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.reg_number}</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Үйл ажиллагааны чиглэл</td>
<td colspan="4" style="text-align:left;vertical-align:middle;" class="">${data.activity_type}</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
</tr>
</table>

<h4 class="sub">А.2 Ажил олгогчийн хаягийн хэсэг</h4>
<table class="dtbl avoidbreak">
<colgroup><col style="width:26.8566%"><col style="width:6.7258%"><col style="width:4.2036%"><col style="width:4.2036%"><col style="width:5.0444%"><col style="width:5.0444%"><col style="width:5.0444%"><col style="width:15.1331%"><col style="width:27.7440%"></colgroup>
<tr>
<td style="text-align:center;vertical-align:middle;" class="bold">Байршил</td>
<td colspan="3" style="text-align:center;vertical-align:middle;" class="bold">Нэр</td>
<td colspan="2" style="text-align:center;vertical-align:middle;border-right:1px solid #000;" class="bold">Код</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:hidden;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:hidden;border-bottom:1px solid #000;border-right:hidden;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:hidden;border-bottom:1px solid #000;border-right:hidden;" class=""></td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Аймаг, нийслэлийн нэр, код</td>
<td colspan="3" style="text-align:left;vertical-align:middle;" class="">${data.province}</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-right:1px solid #000;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-top:1px solid #000;border-left:1px solid #000;" class="">Суурин утас</td>
<td style="text-align:left;vertical-align:middle;border-top:1px solid #000;" class="">${data.landline}</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Сум, дүүргийн нэр, код</td>
<td colspan="3" style="text-align:left;vertical-align:middle;" class="">${data.district}</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-right:1px solid #000;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-left:1px solid #000;" class="">Гар утас (Зах.)</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.director_phone}</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Баг, хорооны нэр, код</td>
<td colspan="3" style="text-align:left;vertical-align:middle;" class="">${data.khoroo}</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-right:1px solid #000;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-left:1px solid #000;" class="">Гар утас (Ня-бо)</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.accountant_phone}</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Гудамж, хороолол</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.street}</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-right:1px solid #000;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-left:1px solid #000;" class="">Факс</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.fax}</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Байшин, байр</td>
<td colspan="5" style="text-align:left;vertical-align:middle;border-right:1px solid #000;" class="">${data.building}</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-left:1px solid #000;" class="">Цахим шуудан</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.email}</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Хашаа, хаалганы дугаар</td>
<td colspan="5" style="text-align:left;vertical-align:middle;border-right:1px solid #000;" class="">${data.gate_number}</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-left:1px solid #000;" class="">Цахим хуудас</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.website}</td>
</tr>
</table>

<div class="side-by-side"><span>А.3 Хариуцлагын хэлбэр /тохирохыг дугуйлна/</span><span>А.4 Өмчийн хэлбэр /тохирохыг дугуйлна/</span></div>
<table class="dtbl avoidbreak">
<colgroup><col style="width:33.5981%"><col style="width:8.4112%"><col style="width:10.0935%"><col style="width:15.1402%"><col style="width:25.2336%"><col style="width:7.5234%"></colgroup>
<tr>
<td style="text-align:center;vertical-align:middle;" class="bold">Нэр</td>
<td style="text-align:center;vertical-align:middle;border-right:1px solid #000;" class="bold">Код</td>
<td style="text-align:center;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class=""></td>
<td colspan="2" style="text-align:center;vertical-align:middle;border-left:1px solid #000;" class="bold">Нэр</td>
<td style="text-align:center;vertical-align:middle;" class="bold">Код</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Хувьцаат компани</td>
<td style="text-align:center;vertical-align:middle;border-right:1px solid #000;" class="">10</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class="">${_mark(data.liability_10)}</td>
<td rowspan="3" style="text-align:center;vertical-align:middle;border-left:1px solid #000;" class="">Төрийн</td>
<td style="text-align:left;vertical-align:middle;" class="">өмчийн</td>
<td style="text-align:center;vertical-align:middle;" class="">${_mark(data.ownership_11)}11</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Хязгаарлагдмал хариуцлагатай компани</td>
<td style="text-align:center;vertical-align:middle;border-right:1px solid #000;" class="">11</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class="">${_mark(data.liability_11)}</td>
<td style="text-align:left;vertical-align:middle;" class="">өмчийн оролцоотой</td>
<td style="text-align:center;vertical-align:middle;" class="">${_mark(data.ownership_12)}12</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Бүх гишүүд нь хариуцлагатай нөхөрлөл</td>
<td style="text-align:center;vertical-align:middle;border-right:1px solid #000;" class="">20</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class="">${_mark(data.liability_20)}</td>
<td style="text-align:left;vertical-align:middle;" class="">хамтарсан</td>
<td style="text-align:center;vertical-align:middle;" class="">${_mark(data.ownership_13)}13</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Зарим гишүүд нь хариуцлагатай нөхөрлөл</td>
<td style="text-align:center;vertical-align:middle;border-right:1px solid #000;" class="">21</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class="">${_mark(data.liability_21)}</td>
<td rowspan="3" style="text-align:center;vertical-align:middle;border-left:1px solid #000;" class="">Орон нутгийн</td>
<td style="text-align:left;vertical-align:middle;" class="">өмчийн</td>
<td style="text-align:center;vertical-align:middle;" class="">${_mark(data.ownership_31)}31</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Хоршоо</td>
<td style="text-align:center;vertical-align:middle;border-right:1px solid #000;" class="">30</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class="">${_mark(data.liability_30)}</td>
<td style="text-align:left;vertical-align:middle;" class="">өмчийн оролцоотой</td>
<td style="text-align:center;vertical-align:middle;" class="">${_mark(data.ownership_32)}32</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Төрийн өмчит үйлдвэрийн газар</td>
<td style="text-align:center;vertical-align:middle;border-right:1px solid #000;" class="">40</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class="">${_mark(data.liability_40)}</td>
<td style="text-align:left;vertical-align:middle;" class="">хамтарсан</td>
<td style="text-align:center;vertical-align:middle;" class="">${_mark(data.ownership_33)}33</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Орон нутгийн өмчит үйлдвэрийн газар</td>
<td style="text-align:center;vertical-align:middle;border-right:1px solid #000;" class="">41</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class="">${_mark(data.liability_41)}</td>
<td rowspan="3" style="text-align:center;vertical-align:middle;border-left:1px solid #000;border-bottom:1px solid #000;" class="">Хувийн</td>
<td style="text-align:left;vertical-align:middle;" class="">Монгол Улсын иргэний</td>
<td style="text-align:center;vertical-align:middle;" class="">${_mark(data.ownership_21)}21</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Төсөвт байгууллага</td>
<td style="text-align:center;vertical-align:middle;border-right:1px solid #000;" class="">60</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class="">${_mark(data.liability_60)}</td>
<td style="text-align:left;vertical-align:middle;" class="">хамтарсан</td>
<td style="text-align:center;vertical-align:middle;" class="">${_mark(data.ownership_22)}22</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Үүнээс: Цэрэг цагдаагийн</td>
<td style="text-align:center;vertical-align:middle;border-right:1px solid #000;" class="">61</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:1px solid #000;" class="">${_mark(data.liability_61)}</td>
<td style="text-align:left;vertical-align:middle;border-bottom:1px solid #000;" class="">гадаад улсын</td>
<td style="text-align:center;vertical-align:middle;border-bottom:1px solid #000;" class="">${_mark(data.ownership_23)}23</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Төрийн бус байгууллага</td>
<td style="text-align:center;vertical-align:middle;border-right:1px solid #000;" class="">70</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:hidden;" class="">${_mark(data.liability_70)}</td>
<td style="text-align:left;vertical-align:middle;border-top:1px solid #000;border-left:hidden;border-bottom:hidden;border-right:hidden;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-top:1px solid #000;border-left:hidden;border-bottom:hidden;border-right:hidden;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-top:1px solid #000;border-left:hidden;border-bottom:hidden;border-right:hidden;" class=""></td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Бусад</td>
<td style="text-align:center;vertical-align:middle;border-right:1px solid #000;" class="">80</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:1px solid #000;border-bottom:hidden;border-right:hidden;" class="">${_mark(data.liability_80)}</td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:hidden;border-bottom:hidden;border-right:hidden;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:hidden;border-bottom:hidden;border-right:hidden;" class=""></td>
<td style="text-align:left;vertical-align:middle;border-top:hidden;border-left:hidden;border-bottom:hidden;border-right:hidden;" class=""></td>
</tr>
</table>

<h4 class="sub">А.5 Харилцах дансны мэдээлэл</h4>
<table class="dtbl avoidbreak">
<colgroup><col style="width:5.4972%"><col style="width:33.3539%"><col style="width:5.5590%"><col style="width:5.5590%"><col style="width:5.5590%"><col style="width:5.5590%"><col style="width:5.5590%"><col style="width:5.5590%"><col style="width:5.5590%"><col style="width:5.5590%"><col style="width:5.5590%"><col style="width:5.5590%"><col style="width:5.5590%"></colgroup>
<tr>
<td style="text-align:center;vertical-align:middle;" class="bold">№</td>
<td style="text-align:center;vertical-align:middle;" class="bold">Банкны нэр</td>
<td colspan="11" style="text-align:center;vertical-align:middle;" class="bold">Дансны дугаар</td>
</tr>
${[1,2,3,4,5].map(i => { const a = (data.bank_accounts||[])[i-1]; return `<tr>\n<td style="text-align:center;vertical-align:middle;" class="">${i}</td>\n<td colspan="2" style="text-align:left;vertical-align:middle;" class="">${a?a.bank_name:''}</td>\n<td colspan="10" style="text-align:left;vertical-align:middle;" class="">${a?a.account_number:''}</td>\n</tr>`; }).join('')}
</table>
</div>

<div class="section-b">
<h3 class="sec">Б. НИЙГМИЙН ДААТГАЛЫН ШИМТГЭЛ ТӨЛӨЛТ</h3>
<table class="dtbl0 avoidbreak">
<colgroup><col style="width:54.7590%"><col style="width:45.2410%"></colgroup>
<tr>
<td style="text-align:left;vertical-align:middle;" class="bold"><b>Ажил олгогчийн нийгмийн даатгалын бүртгэлийн дугаар:</b></td>
<td id="nd7-b-reg-number" style="text-align:left;vertical-align:middle;padding-left:6px;" class="">${data.nd_reg_number}</td>
</tr>
</table>
<table class="dtbl avoidbreak">
<colgroup><col style="width:12.9505%"><col style="width:15.6303%"><col style="width:3.8375%"><col style="width:12.2876%"><col style="width:12.7264%"><col style="width:14.5752%"><col style="width:11.9701%"><col style="width:8.2073%"><col style="width:7.8151%"></colgroup>
<tr>
<td colspan="3" style="text-align:left;vertical-align:middle;border-top:hidden;border-left:hidden;border-bottom:1px solid #000;border-right:hidden;" class="bold">1. Шимтгэл төлөлт</td>
<td colspan="6" style="text-align:right;vertical-align:middle;border-top:hidden;border-left:hidden;border-bottom:1px solid #000;border-right:hidden;" class="bold">/төгрөгөөр/</td>
</tr>
<tr>
<td colspan="2" rowspan="2" style="text-align:center;vertical-align:middle;border-top:1px solid #000;" class="bold">Үзүүлэлт</td>
<td rowspan="2" style="text-align:center;vertical-align:middle;border-top:1px solid #000;" class="bold">Мөр</td>
<td colspan="6" style="text-align:center;vertical-align:middle;border-top:1px solid #000;" class="bold">Шимтгэл төлөлт</td>
</tr>
<tr>
<td style="text-align:center;vertical-align:middle;" class="bold">Нийгмийн болон эрүүл мэндийн даатгалд хамрагдагчид</td>
<td style="text-align:center;vertical-align:middle;" class="bold">Зөвхөн эрүүл мэндийн даатгалд хамрагдагчид</td>
<td style="text-align:center;vertical-align:middle;" class="bold">Хүүхдээ өсөрч буй чөлөөтэй эх, дайчлагчид, гэрээгээр суралцагчид, цэргийн албан хаагчид</td>
<td style="text-align:center;vertical-align:middle;" class="bold">Тэтгэвэр тогтоолгосон ажиллагчид</td>
<td style="text-align:center;vertical-align:middle;" class="bold">Бусад</td>
<td style="text-align:center;vertical-align:middle;" class="bold">Бүгд</td>
</tr>
<tr>
<td colspan="2" style="text-align:center;vertical-align:middle;" class="bold">А</td>
<td style="text-align:center;vertical-align:middle;" class="bold">Б</td>
<td style="text-align:center;vertical-align:middle;" class="bold">1</td>
<td style="text-align:center;vertical-align:middle;" class="bold">2</td>
<td style="text-align:center;vertical-align:middle;" class="bold">3</td>
<td style="text-align:center;vertical-align:middle;" class="bold">4</td>
<td style="text-align:center;vertical-align:middle;" class="bold">5</td>
<td style="text-align:center;vertical-align:middle;" class="bold">6=(1:5)</td>
</tr>
<tr>
<td rowspan="2" style="text-align:center;vertical-align:middle;" class="">Даатгуулагчийн тоо</td>
<td style="text-align:left;vertical-align:middle;" class="">Монгол</td>
<td style="text-align:center;vertical-align:middle;" class="">1</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.insured_count_1}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.insured_count_2}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.insured_count_3}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.insured_count_4}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.insured_count_5}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.total_employees}</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Гадаад</td>
<td style="text-align:center;vertical-align:middle;" class="">2</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class="">${data.foreign_count}</td>
</tr>
<tr>
<td rowspan="6" style="text-align:center;vertical-align:middle;" class="">Даатгуулагчийн хөдөлмөрийн хөлс, түүнтэй адилтгах орлого</td>
<td style="text-align:left;vertical-align:middle;" class="">Үндсэн ба нэмэгдэл цалин</td>
<td style="text-align:center;vertical-align:middle;" class="">3</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b3_1}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b3_2}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b3_3}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b3_4}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b3_5}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b3_6}</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Шагналт цалин</td>
<td style="text-align:center;vertical-align:middle;" class="">4</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b4_1}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b4_2}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b4_3}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b4_4}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b4_5}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b4_6}</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Бусал нэмэгдэл цалин</td>
<td style="text-align:center;vertical-align:middle;" class="">5</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b5_1}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b5_2}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b5_3}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b5_4}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b5_5}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b5_6}</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Хоол, унааны хөлс</td>
<td style="text-align:center;vertical-align:middle;" class="">6</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b6_1}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b6_2}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b6_3}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b6_4}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b6_5}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b6_6}</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Түлээ, нүүрсний үнийн хөнгөлөлт</td>
<td style="text-align:center;vertical-align:middle;" class="">7</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b7_1}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b7_2}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b7_3}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b7_4}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b7_5}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b7_6}</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Дүн 8=(3+4+5+6+7)</td>
<td style="text-align:center;vertical-align:middle;" class="">8</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b8_1}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b8_2}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b8_3}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b8_4}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b8_5}</td>
<td style="text-align:left;vertical-align:middle;" class="">${data.b8_6}</td>
</tr>
<tr>
<td colspan="2" style="text-align:left;vertical-align:middle;" class="">Шимтгэл ногдуулах хувь</td>
<td style="text-align:center;vertical-align:middle;" class="">9</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class="">${data.ndsh_rate}%</td>
</tr>
<tr>
<td rowspan="2" style="text-align:center;vertical-align:middle;" class="">Нийгмийн даатгалын санд</td>
<td style="text-align:left;vertical-align:middle;" class="">Төлбөл зохих НДШ дүн 10=(8*9)/100</td>
<td style="text-align:center;vertical-align:middle;" class="">10</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class="">${data.ndsh_total}</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="">Төлсөн НДШ-ийн дүн</td>
<td style="text-align:center;vertical-align:middle;" class="">11</td>
<td style="text-align:center;vertical-align:middle;" class="">х</td>
<td style="text-align:center;vertical-align:middle;" class="">х</td>
<td style="text-align:center;vertical-align:middle;" class="">х</td>
<td style="text-align:center;vertical-align:middle;" class="">х</td>
<td style="text-align:center;vertical-align:middle;" class="">х</td>
<td style="text-align:center;vertical-align:middle;font-size:6.5pt;" class="">АО:${data.ndsh_employer_total} Д:${data.ndsh_employee_total}</td>
</tr>
<tr>
<td colspan="2" style="text-align:left;vertical-align:middle;" class="">Нийгмийн даатгалын байгууллагаас буцаан олгосон шимтгэлийн дүн</td>
<td style="text-align:center;vertical-align:middle;" class="">12</td>
<td style="text-align:center;vertical-align:middle;" class="">х</td>
<td style="text-align:center;vertical-align:middle;" class="">х</td>
<td style="text-align:center;vertical-align:middle;" class="">х</td>
<td style="text-align:center;vertical-align:middle;" class="">х</td>
<td style="text-align:center;vertical-align:middle;" class="">х</td>
<td style="text-align:center;vertical-align:middle;" class=""></td>
</tr>
</table>

<h4 class="sub">2. Шимтгэлийн үлдэгдэл</h4>
<table class="dtbl avoidbreak">
<colgroup><col style="width:5.7531%"><col style="width:38.3969%"><col style="width:34.9063%"><col style="width:20.9438%"></colgroup>
<tr>
<td style="text-align:center;vertical-align:middle;" class="bold">№</td>
<td style="text-align:center;vertical-align:middle;" class="bold">Үзүүлэлт</td>
<td style="text-align:center;vertical-align:middle;" class="bold">Илүү</td>
<td style="text-align:center;vertical-align:middle;" class="bold">Дутуу</td>
</tr>
<tr>
<td style="text-align:center;vertical-align:middle;" class="">1</td>
<td style="text-align:left;vertical-align:middle;" class="">.... оны .... сарын 01-ний үлдэгдэл</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
</tr>
<tr>
<td style="text-align:center;vertical-align:middle;" class="">2</td>
<td style="text-align:left;vertical-align:middle;" class="">... оны .... сарын ....-ний үлдэгдэл</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
</tr>
</table>

<h4 class="sub">3. Тухайн сард дансанд шилжүүлсэн шимтгэл</h4>
<table class="dtbl avoidbreak">
<colgroup><col style="width:7.2772%"><col style="width:14.7179%"><col style="width:14.7179%"><col style="width:13.2461%"><col style="width:50.0409%"></colgroup>
<tr>
<td style="text-align:center;vertical-align:middle;" class="">№</td>
<td style="text-align:center;vertical-align:middle;" class="">Он</td>
<td style="text-align:center;vertical-align:middle;" class="">Сар</td>
<td style="text-align:center;vertical-align:middle;" class="">Өдөр</td>
<td style="text-align:center;vertical-align:middle;" class="">Дүн</td>
</tr>
<tr>
<td style="text-align:center;vertical-align:middle;" class="">1</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
</tr>
<tr>
<td style="text-align:center;vertical-align:middle;" class="">2</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
</tr>
<tr>
<td style="text-align:center;vertical-align:middle;" class="">3</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
</tr>
<tr>
<td style="text-align:center;vertical-align:middle;" class="">4</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
</tr>
<tr>
<td style="text-align:center;vertical-align:middle;" class="">5</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
</tr>
<tr>
<td colspan="4" style="text-align:center;vertical-align:middle;" class="bold">Нийт дүн</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
</tr>
</table><br>
<table class="dtbl0 avoidbreak">
<colgroup><col style="width:8.3645%"><col style="width:41.6355%"><col style="width:7.9907%"><col style="width:42.0093%"></colgroup>
<tr>
<td colspan="2" style="text-align:center;vertical-align:middle;" class="bold"><b>Тайлан гаргасан:</b></td>
<td colspan="2" style="text-align:center;vertical-align:middle;" class="bold"><b>Шалгаж, хүлээж авсан:</b></td>
</tr>
<tr>
<td style="text-align:center;vertical-align:middle;" class="">Тамга, тэмдэг</td>
<td style="text-align:left;vertical-align:middle;" class="">Дарга/захирал: ………………… /${data.director_name}/<br><br>Нягтлан бодогч: ………………… /${data.accountant_name}/</td>
<td style="text-align:center;vertical-align:middle;" class="">Тэмдэг</td>
<td style="text-align:left;vertical-align:middle;" class="">Нийгмийн даатгалын<br>байцаагч /ажилтан/: ........................... /…………………/<br>	 	 (гарын үсэг) 	 (нэр)</td>
</tr>
<tr>
<td style="text-align:center;vertical-align:middle;" class=""></td>
<td style="text-align:center;vertical-align:middle;" class="">${_govReportTodayStr()}</td>
<td style="text-align:center;vertical-align:middle;" class=""></td>
<td style="text-align:center;vertical-align:middle;" class="">_______ / ___ / ___ (Он/Сар/Өдөр)</td>
</tr>
</table>
</div>

`;
}

function _renderND8PrintForm(data) {
  return `
<table class="dtbl0 avoidbreak">
<colgroup><col style="width:50.0000%"><col style="width:50.0000%"></colgroup>
<tr>
<td style="text-align:left;vertical-align:middle; font-size: 7pt;" class="">Үндэсний статистикийн хорооны зөвшөөрсөнөөр<br>Сангийн сайд, Хүн амын хөгжил, нийгмийн хамгааллын сайдын<br>2014 оны 2-р сарын 10-ны өдрийн 24/А/20 тоот тушаалаар батлав.</td>
<td style="text-align:right;vertical-align:middle; font-size: 7pt;" class="bold">Хавсралт<br><br>Маягт НД-8</td>
</tr>
<tr>
<td colspan="2" style="text-align:center;vertical-align:middle; font-size: 7pt;" class="bold">Монгол Улсын Статистикийн тухай хуулийн 22 дугаар зүйлийн 3 дугаар заалт, Байгууллагын нууцын тухай хуулийн 5 дугаар зүйлийн 2<br>дугаар заалтын дагуу мэдээллийн нууцыг чандлан хадгална.<br><br><br><b><h3 class="sec">“${data.org_name}” СУУЦ ӨМЧЛӨГЧДИЙН ХОЛБООНД АЖИЛЛАЖ БУЙ ДААТГУУЛАГЧИЙН ${data.year} ОНЫ ${data.month}-Р САРЫН<br>НИЙГМИЙН ДААТГАЛЫН ШИМТГЭЛ НОГДУУЛАЛТ</h3></b></td>
</tr>
</table>
<table class="dtbl0 avoidbreak">
<colgroup><col style="width:17.9968%"><col style="width:2.3263%"><col style="width:2.3263%"><col style="width:2.3263%"><col style="width:2.3263%"><col style="width:2.3263%"><col style="width:2.3263%"><col style="width:2.3263%"><col style="width:2.3263%"><col style="width:2.3263%"><col style="width:2.3263%"><col style="width:8.7237%"><col style="width:50.0162%"></colgroup>
<tr>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td rowspan="3" style="text-align:left;vertical-align:middle; font-size: 7pt;" class="">1. Ажил олгогч нь 1-9 баганын мэдээллийг сар бүрийн 5-ны дотор онлайн програмд шивж, цаасаар баталгаажуулж харьяа аймаг, дүүрэг/сум/-ийн нийгмийн даатгалын байгууллагад ирүүлнэ.<br><br>2. Ажил олгогч нь тод хараар хүрээлсэн 10-р баганын мэдээллийг улирлын дараа сарын 5-ны дотор онлайн програмд шивж, цаасаар баталгаажуулж харьяа аймаг, дүүрэг/сум/-ийн нийгмийн даатгалын байгууллагад ирүүлнэ.<br><br>3. Ажил олгогч нь тод хараар хүрээлсэн 11, 12-р баганын мэдээллийг жил бүрийн 2-р сарын 5-ны дотор эсвэл өөрчлөлт орсон тохиолдолд улирлын дараа сарын 5-ны дотор онлайн программд шивэх ба цаасаар баталгаажуулж жил бүрийн 2-р сарын 20-ны дотор харьяа аймаг, дүүрэг/сум/-ийн нийгмийн даатгалын байгууллагад ирүүлнэ.</td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class="bold">Ажил олгогчийн нийгмийн даатгалын бүртгэлийн дугаар:</td>
<td id="nd8-b-reg-number" colspan="10" style="text-align:left;vertical-align:middle;padding-left:6px;" class="">${data.nd_reg_number}</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
</tr>
<tr>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
</tr>
</table><br>
<table class="dtbl avoidbreak">
<colgroup><col style="width:2.2689%"><col style="width:7.7182%"><col style="width:7.2851%"><col style="width:9.6833%"><col style="width:12.5533%"><col style="width:7.0653%"><col style="width:7.5566%"><col style="width:6.8778%"><col style="width:6.8972%"><col style="width:6.9489%"><col style="width:5.7078%"><col style="width:7.8345%"><col style="width:11.6031%"></colgroup>
<tr>
<td rowspan="3" style="text-align:center;vertical-align:middle;" class="">№</td>
<td colspan="6" style="text-align:center;vertical-align:middle;" class="">Даатгуулагчийн</td>
<td colspan="3" style="text-align:center;vertical-align:middle;" class="">Ногдуулсан шимтгэл /төгрөг/</td>
<td colspan="3" style="text-align:center;vertical-align:middle;" class="">Даатгуулагчийн</td>
</tr>
<tr>
<td rowspan="2" style="text-align:center;vertical-align:middle;" class="">Эцэг/эхийн нэр</td>
<td rowspan="2" style="text-align:center;vertical-align:middle;" class="">Нэр</td>
<td rowspan="2" style="text-align:center;vertical-align:middle;" class="">Регистрийн дугаар</td>
<td rowspan="2" style="text-align:center;vertical-align:middle;" class="">Нийгмийн даатгалын дэвтрийн дугаар</td>
<td rowspan="2" style="text-align:center;vertical-align:middle;" class="">Даатгуулагчийн төрөл</td>
<td rowspan="2" style="text-align:center;vertical-align:middle;" class="">Хөдөлмөрийн хөлс, түүнтэй адилтгах орлого /төгрөг/</td>
<td rowspan="2" style="text-align:center;vertical-align:middle;" class="">Нийт дүн</td>
<td colspan="2" style="text-align:center;vertical-align:middle;" class="">Үүнээс</td>
<td rowspan="2" style="text-align:center;vertical-align:middle;" class="">Ажил мэргэжлийн ангилал</td>
<td rowspan="2" style="text-align:center;vertical-align:middle;" class="">Харилцах утас</td>
<td rowspan="2" style="text-align:center;vertical-align:middle;" class="">И-мэйл хаяг</td>
</tr>
<tr>
<td style="text-align:center;vertical-align:middle;" class="">Ажил олгогч</td>
<td style="text-align:center;vertical-align:middle;" class="">Даатгуулагч</td>
</tr>
<tr>
<td style="text-align:center;vertical-align:middle;" class="">А</td>
<td style="text-align:center;vertical-align:middle;" class="">1</td>
<td style="text-align:center;vertical-align:middle;" class="">2</td>
<td style="text-align:center;vertical-align:middle;" class="">3</td>
<td style="text-align:center;vertical-align:middle;" class="">4</td>
<td style="text-align:center;vertical-align:middle;" class="">5</td>
<td style="text-align:center;vertical-align:middle;" class="">6</td>
<td style="text-align:center;vertical-align:middle;" class="">7</td>
<td style="text-align:center;vertical-align:middle;" class="">8</td>
<td style="text-align:center;vertical-align:middle;" class="">9</td>
<td style="text-align:center;vertical-align:middle;" class="">10</td>
<td style="text-align:center;vertical-align:middle;" class="">11</td>
<td style="text-align:center;vertical-align:middle;" class="">12</td>
</tr>
${(data.employees||[]).map(e => `<tr>
<td style="text-align:center;vertical-align:middle;" class="">${e.no}</td>
<td style="text-align:left;vertical-align:middle;" class="">${e.parent_name}</td>
<td style="text-align:left;vertical-align:middle;" class="">${e.first_name}</td>
<td style="text-align:left;vertical-align:middle;" class="">${e.register_number}</td>
<td style="text-align:left;vertical-align:middle;" class="">${e.nd_book_number}</td>
<td style="text-align:center;vertical-align:middle;" class="">${e.insured_type}</td>
<td style="text-align:right;vertical-align:middle;" class="">${e.gross}</td>
<td style="text-align:right;vertical-align:middle;" class="">${e.gross}</td>
<td style="text-align:right;vertical-align:middle;" class="">${e.employer_ndsh}</td>
<td style="text-align:right;vertical-align:middle;" class="">${e.employee_ndsh}</td>
<td style="text-align:center;vertical-align:middle;" class="">${e.occupation_code}</td>
<td style="text-align:center;vertical-align:middle;" class="">${e.phone}</td>
<td style="text-align:left;vertical-align:middle;" class="">${e.email}</td>
</tr>`).join('')}
<tr>
<td colspan="3" style="text-align:left;vertical-align:middle;" class="">Дүн</td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class=""></td>
</tr>
</table><br>
<table class="dtbl0 avoidbreak">
<colgroup><col style="width:8.3592%"><col style="width:41.6408%"><col style="width:7.9974%"><col style="width:42.0026%"></colgroup>
<tr>
<td style="text-align:center;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class="bold"><b>Тайлан гаргасан:</b></td>
<td style="text-align:center;vertical-align:middle;" class=""></td>
<td style="text-align:left;vertical-align:middle;" class="bold"><b>Шалгаж, хүлээж авсан:</b></td>
</tr>
<tr>
<td style="text-align:center;vertical-align:middle;" class="">Тамга, тэмдэг</td>
<td style="text-align:left;vertical-align:middle;" class="">Дарга/захирал: ………………… /${data.director_name}/<br><br>Нягтлан бодогч: ………………… /${data.accountant_name}/</td>
<td style="text-align:center;vertical-align:middle;" class="">Тэмдэг</td>
<td style="text-align:left;vertical-align:middle;" class="">Нийгмийн даатгалын<br>байцаагч /ажилтан/: ............................................ /…..............………………/<br>	 	 (гарын үсэг) 	 (нэр)</td>
</tr>
<tr>
<td style="text-align:center;vertical-align:middle;" class=""></td>
<td style="text-align:center;vertical-align:middle;" class="">${_govReportTodayStr()}</td>
<td style="text-align:center;vertical-align:middle;" class=""></td>
<td style="text-align:center;vertical-align:middle;" class="">_______ / ___ / ___ (Он/Сар/Өдөр)</td>
</tr>
</table>
`;
}

// Тухайн тайлангийн @page хэмжээг (А4 portrait/landscape, margin) хэвлэхийн
// өмнө тусад нь бичиж өгнө — Playwright/browser prefer_css_page_size үе шиг,
// browser бүр @page-г адилхан дагадаггүй тул JS-ээр тодорхой удирдана.
function _setNdPrintPageSize(sizeCss) {
  let el = document.getElementById('nd-print-page-size');
  if (!el) { el = document.createElement('style'); el.id = 'nd-print-page-size'; document.head.appendChild(el); }
  el.textContent = `@media print { @page { ${sizeCss} } }`;
}

// Хэвлэхээс өмнө browser бодитоор шинэ HTML-г layout хийж дуусахыг хүлээнэ —
// зүгээр нэг setTimeout нь заримдаа хангалттай биш (хүснэгэл олон, том агуулга
// үед) тул давхар requestAnimationFrame ашиглаж, "дараагийн 2 frame" хүртэл
// хүлээснээр browser-ийн layout/paint бодитоор дуусахыг баталгаажуулна.
function _afterNextPaint(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

async function printND7() {
  const yearMonth = _govReportYearMonth();
  let d;
  try { d = await _computeND7Data(yearMonth); }
  catch (e) { console.error('НД-7 дата тооцоолоход алдаа:', e); toast('НД-7 өгөгдөл бэлдэхэд алдаа гарлаа', 'error'); return; }
  const root = document.getElementById('nd7-print-root');
  root.innerHTML = _renderND7PrintForm(d);
  if (!root.innerHTML.trim()) { toast('НД-7 хэвлэх агуулга хоосон гарлаа — өгөгдөл шалгана уу', 'error'); return; }
  _setNdPrintPageSize('size: 210mm 297mm; margin: 19.05mm 9.98mm 11.11mm 11.11mm;');
  document.body.classList.add('printing-nd7');
  logActivity('print', 'fintax', null, `НД-7 — ${yearMonth}`);
  _afterNextPaint(() => {
    window.print();
    document.body.classList.remove('printing-nd7');
  });
}

async function printND8() {
  const yearMonth = _govReportYearMonth();
  let d;
  try { d = await _computeND8Data(yearMonth); }
  catch (e) { console.error('НД-8 дата тооцоолоход алдаа:', e); toast('НД-8 өгөгдөл бэлдэхэд алдаа гарлаа', 'error'); return; }
  const root = document.getElementById('nd8-print-root');
  root.innerHTML = _renderND8PrintForm(d);
  if (!root.innerHTML.trim()) { toast('НД-8 хэвлэх агуулга хоосон гарлаа — өгөгдөл шалгана уу', 'error'); return; }
  _setNdPrintPageSize('size: 297mm 210mm; margin: 11.11mm 12.84mm 4.76mm 11.11mm;');
  document.body.classList.add('printing-nd8');
  logActivity('print', 'fintax', null, `НД-8 — ${yearMonth}`);
  _afterNextPaint(() => {
    window.print();
    document.body.classList.remove('printing-nd8');
  });
}

// НД-7/НД-8 табын идэвхтэйгээр нь зөв тайланг хэвлэнэ
function printActiveGovReport() {
  const t = _activeGovReportTab();
  if (t === 'nd8') printND8();
  else if (t === 'nd7') printND7();
  else toast('Энэ тайлангийн загвар удахгүй нэмэгдэнэ', 'success');
}

// ============================================================
// DOCX ЗАГВАР: upload, шалгах, бөглөж татах (docxtemplater + pizzip)
// ============================================================
const GOV_REPORT_TAB_LABELS = { 'НД-7': 'nd7', 'НД-8': 'nd8', 'ТТ-02': 'tt02', 'ТТ-03А': 'tt03a', 'ТТ-06': 'tt06', 'ТТ-11': 'tt11', 'А маягт': 'forma', 'Б маягт': 'formb' };
function _activeGovReportTab() {
  const t = document.querySelector('#fintax-tabs .tab.active');
  return (t && GOV_REPORT_TAB_LABELS[t.textContent.trim()]) || 'nd7';
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
  {key:'payments',      label:'Төлбөр төлөлт'},
  {key:'apartments',    label:'Тоот, зогсоол, агуулах'},
  {key:'reports',       label:'СӨХ дотоод тайлан'},
  {key:'fintax',        label:'Санхүү, татварын тайлан'},
  {key:'notifications', label:'Зар мэдэгдэл илгээх'},
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
