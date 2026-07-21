// ============================================================
// employees.js — Ажилтны бүртгэлийн модуль (Цалингийн модуль Phase 1)
// ============================================================
// Хамаарал: sb (db.js), canWrite/canDelete/canView (suh.html), esc/fmt/fmtMoney/
// todayStr/toast/openModal/closeModal (suh.html).
// Энэ бол зөвхөн бүртгэл — цалин ТООЦООЛОХ логик (ХХОАТ/НДШ) Phase 2-т орно.
// ============================================================

let employees = [];
// "Нэр" баганад ("Ажилтны жагсаалт", "Цалингийн тооцоолол (урьдчилсан)") зориулсан
// харуулах нэр — "Өөрийн нэр"-ийг ТОМ ҮСГЭЭР, ард нь зай, "Эцэг/эхийн нэр".
// Хуучин өгөгдөл (last_name/first_name/parent_name бөглөгдөөгүй) руу буцаад
// нийцтэй байхын тулд эдгээр талбар хоосон бол e.fullName-руу буцаана.
function _employeeDisplayName(e) {
  const first = (e.firstName || '').trim();
  const parent = (e.parentName || '').trim();
  if (first) return (first.toUpperCase() + (parent ? ' ' + parent : '')).trim();
  return e.fullName || '—';
}

// ------------------------------------------------------------
// ЦАЛИНГИЙН ХУУДАС (Pay slip) — Phase 4. Дахин ТООЦООЛОХГҮЙ, харин
// journal_lines-д АЛЬ ХЭДИЙН БИЧИГДСЭН бодит дүнг л уншиж харуулна
// (жинхэнэ ном/дэвтэртэй яг таарсан, найдвартай эх сурвалж).
// ------------------------------------------------------------
function printPaySlip() {
  document.body.classList.add('printing-payslip');
  window.print();
  // Хэвлэх цонх хаагдсаны дараа class-г арилгана (afterprint эвент бүх browser дээр
  // тогтвортой ажилладаггүй тул жижиг timeout-той хосолж найдвартай болгов)
  const cleanup = () => document.body.classList.remove('printing-payslip');
  window.onafterprint = cleanup;
  setTimeout(cleanup, 2000);
}

function populatePaySlipMonthSelect() {
  const sel = document.getElementById('payslip-month-select');
  if (!sel) return;
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    options.push(`<option value="${ym}">${ym}</option>`);
  }
  sel.innerHTML = options.join('');
}

async function openPaySlip(employeeId) {
  const e = employees.find(x => x.id === employeeId); if (!e) return;
  document.getElementById('payslip-employee-id').value = employeeId;
  document.getElementById('payslip-employee-name').textContent = _employeeDisplayName(e);
  populatePaySlipMonthSelect();
  openModal('modal-payslip');
  await renderPaySlipContent();
}

async function renderPaySlipContent() {
  const employeeId = +document.getElementById('payslip-employee-id').value;
  const yearMonth = document.getElementById('payslip-month-select').value;
  const e = employees.find(x => x.id === employeeId); if (!e) return;
  const el = document.getElementById('payslip-body');
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';

  const party = 'employee:' + e.dbId;
  const { data, error } = await sb
    .from('journal_entries')
    .select('id, entry_date, description, journal_lines(account_code, debit, credit, party)')
    .eq('reference', `payroll:employee:${e.dbId}:${yearMonth}`)
    .limit(1);

  if (error) { el.innerHTML = '<div class="empty-state">Ачаалахад алдаа гарлаа</div>'; return; }
  if (!data || !data.length) { el.innerHTML = `<div class="empty-state">${yearMonth} сард цалин тооцоологдоогүй байна</div>`; return; }

  const lines = data[0].journal_lines.filter(l => l.party === party);
  const byAccount = {};
  lines.forEach(l => { byAccount[l.account_code] = { debit: +l.debit, credit: +l.credit }; });

  const baseSalary = byAccount['7010']?.debit || 0;
  const meal = byAccount['7011']?.debit || 0;
  const transport = byAccount['7012']?.debit || 0;
  const phone = byAccount['7013']?.debit || 0;
  const gross = +(baseSalary + meal + transport + phone).toFixed(2);
  const ndshEmployer = byAccount['7020']?.debit || 0;
  const netPay = byAccount['1020']?.credit || 0;
  const ndshTotal = byAccount['3030']?.credit || 0;
  const ndshEmployee = +(ndshTotal - ndshEmployer).toFixed(2);
  const hhoat = byAccount['3020']?.credit || 0;

  const allowanceRows = [
    meal ? `<div class="summary-row"><span class="summary-key" style="padding-left:16px">Хоол мөнгө</span><span class="summary-val">${fmtMoney(meal)}</span></div>` : '',
    transport ? `<div class="summary-row"><span class="summary-key" style="padding-left:16px">Унаа мөнгө</span><span class="summary-val">${fmtMoney(transport)}</span></div>` : '',
    phone ? `<div class="summary-row"><span class="summary-key" style="padding-left:16px">Утасны мөнгө</span><span class="summary-val">${fmtMoney(phone)}</span></div>` : '',
  ].filter(Boolean).join('');

  el.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-weight:700;font-size:15px">${esc(_employeeDisplayName(e))}</div>
      <div style="font-size:12px;color:var(--text-muted)">${esc(e.position) || '—'} · ${yearMonth}</div>
    </div>
    <div class="summary-row"><span class="summary-key">Үндсэн цалин</span><span class="summary-val">${fmtMoney(baseSalary)}</span></div>
    ${allowanceRows}
    <div class="summary-row" style="font-weight:600"><span class="summary-key">Нийт цалин</span><span class="summary-val">${fmtMoney(gross)}</span></div>
    <div class="summary-row"><span class="summary-key">НДШ (ажилтны хэсэг)</span><span class="summary-val" style="color:var(--danger)">-${fmtMoney(ndshEmployee)}</span></div>
    <div class="summary-row"><span class="summary-key">ХХОАТ</span><span class="summary-val" style="color:var(--danger)">-${fmtMoney(hhoat)}</span></div>
    <div style="border-top:1px solid var(--border);margin:10px 0"></div>
    <div class="summary-row" style="font-weight:700"><span class="summary-key">ГАРТ ОЛГОХ ДүН</span><span class="summary-val">${fmtMoney(netPay)}</span></div>
    <div style="border-top:1px solid var(--border);margin:10px 0"></div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">Ажил олгогчийн нэмэлт зардал:</div>
    <div class="summary-row"><span class="summary-key">НДШ (ажил олгогчийн хэсэг)</span><span class="summary-val">${fmtMoney(ndshEmployer)}</span></div>
    <div class="summary-row" style="font-weight:700"><span class="summary-key">Ажил олгогчид нийт өртөх зардал</span><span class="summary-val">${fmtMoney(gross + ndshEmployer)}</span></div>`;
}

// ============================================================
// ЦАЛИНГИЙН ТООЦООЛОЛ (Phase 2 -> ЕРӨНХИЙЛСӨН ү2) -- цэвэр функцүүд,
// Node.js-д 21 тестээр баталгаажсан (payroll-calc-v2.js). Ямар ч тооны
// tax_types (applies_to_payroll=true) дэмждэг, ажилтан тус бүрийн
// employee_tax_overrides-ийг харгалзана. Шинэ татвар нэмэгдэхэд ЭНЭ
// КОД дахин бичигдэх шаардлагагүй.
// ⚠️ ЗӨВХӨН ТООЦООЛОЛ ХАРУУЛНА -- journal entry автоматаар үүсгэдэггүй.
// ============================================================

function calculateProgressiveTax(taxableAmount, brackets) {
  if (!taxableAmount || taxableAmount <= 0) return 0;
  const sorted = brackets.slice().sort((a, b) => a.bracket_order - b.bracket_order);
  for (const b of sorted) {
    const to = (b.threshold_to === null || b.threshold_to === undefined) ? Infinity : b.threshold_to;
    if (taxableAmount > b.threshold_from && taxableAmount <= to) {
      return +(b.base_amount + (taxableAmount - b.threshold_from) * b.rate_percent / 100).toFixed(2);
    }
  }
  const last = sorted[sorted.length - 1];
  return +(last.base_amount + (taxableAmount - last.threshold_from) * last.rate_percent / 100).toFixed(2);
}

// components: [{code, amount, hhoat_taxable, ndsh_taxable, ...}] — ажилтны идэвхтэй
// цалингийн нэмэгдлүүд (Хоол/Унаа/Утас гэх мэт). Татвар бүр өөрийн
// "{tax.code}_taxable" талбараар аль нэмэгдэл суурьт орохыг шийднэ.
function calculatePayrollGeneric(baseSalary, taxTypes, taxBrackets, employeeOverrides = [], components = []) {
  const totalGross = +(baseSalary + components.reduce((s, c) => s + (+c.amount || 0), 0)).toFixed(2);
  const breakdown = [];
  let nonProgressiveEmployeeDeductions = 0;
  let totalEmployerCost = totalGross;

  const ordered = [...taxTypes].sort((a, b) => {
    if (a.calculation_type === 'progressive' && b.calculation_type !== 'progressive') return 1;
    if (a.calculation_type !== 'progressive' && b.calculation_type === 'progressive') return -1;
    return 0;
  });

  for (const tt of ordered) {
    const override = employeeOverrides.find(o => o.tax_code === tt.code);
    const enabled = override ? override.enabled : true;
    if (!enabled) {
      breakdown.push({ code: tt.code, name: tt.name, employeeAmount: 0, employerAmount: 0, exempt: true, reason: override?.exemption_reason || '', liabilityAccount: tt.payroll_liability_account });
      continue;
    }
    // Тухайн татварт "taxable=false" гэж тэмдэглээгүй бүх нэмэгдлийг суурьт оруулна
    // (анхдагч — талбар байхгүй бол taxable гэж үзнэ, хуулийн дагуу)
    const taxableComponentsSum = components
      .filter(c => c[tt.code + '_taxable'] !== false)
      .reduce((s, c) => s + (+c.amount || 0), 0);
    const taxBase = baseSalary + taxableComponentsSum;

    if (tt.calculation_type === 'simple') {
      const rate = (override?.rate_override != null) ? +override.rate_override : +tt.rate_percent;
      const amt = +(taxBase * rate / 100).toFixed(2);
      breakdown.push({ code: tt.code, name: tt.name, employeeAmount: amt, employerAmount: 0, liabilityAccount: tt.payroll_liability_account });
      nonProgressiveEmployeeDeductions += amt;
    } else if (tt.calculation_type === 'split') {
      const empRate = (override?.employee_rate_override != null) ? +override.employee_rate_override : +tt.employee_rate_percent;
      const erRate = (override?.employer_rate_override != null) ? +override.employer_rate_override : +tt.employer_rate_percent;
      const empAmt = +(taxBase * empRate / 100).toFixed(2);
      const erAmt = +(taxBase * erRate / 100).toFixed(2);
      breakdown.push({ code: tt.code, name: tt.name, employeeAmount: empAmt, employerAmount: erAmt, liabilityAccount: tt.payroll_liability_account });
      nonProgressiveEmployeeDeductions += empAmt;
      totalEmployerCost += erAmt;
    } else if (tt.calculation_type === 'progressive') {
      const base = Math.max(taxBase - nonProgressiveEmployeeDeductions, 0);
      const brackets = taxBrackets.filter(b => b.tax_code === tt.code);
      const amt = calculateProgressiveTax(base, brackets);
      breakdown.push({ code: tt.code, name: tt.name, employeeAmount: amt, employerAmount: 0, taxableBase: base, liabilityAccount: tt.payroll_liability_account });
    }
  }

  const totalEmployeeDeductions = +breakdown.reduce((s, b) => s + b.employeeAmount, 0).toFixed(2);
  const netPay = +(totalGross - totalEmployeeDeductions).toFixed(2);
  return { baseSalary, components, grossSalary: totalGross, breakdown, netPay, totalEmployerCost: +totalEmployerCost.toFixed(2) };
}

function buildPayrollLinesGeneric(party, result) {
  const lines = [];
  // Үндсэн цалин ТУСДАА (нэмэгдлүүдийг доор тус тусад нь бичнэ — Цалингийн
  // хуудсанд задалж харуулах боломжтой байхын тулд НЭГ 7010 руу нийлүүлдэггүй)
  lines.push({ account: '7010', debit: result.baseSalary, credit: 0, party });
  for (const c of result.components) {
    const amt = +c.amount || 0;
    if (amt > 0 && c.expense_account) lines.push({ account: c.expense_account, debit: amt, credit: 0, party });
  }
  const employerExtra = +(result.totalEmployerCost - result.grossSalary).toFixed(2);
  if (employerExtra > 0) lines.push({ account: '7020', debit: employerExtra, credit: 0, party });
  lines.push({ account: '1020', debit: 0, credit: result.netPay, party });

  const byAccount = {};
  for (const b of result.breakdown) {
    if (b.exempt) continue;
    const total = +(b.employeeAmount + b.employerAmount).toFixed(2);
    if (total <= 0 || !b.liabilityAccount) continue;
    byAccount[b.liabilityAccount] = +((byAccount[b.liabilityAccount] || 0) + total).toFixed(2);
  }
  for (const [account, amount] of Object.entries(byAccount)) {
    lines.push({ account, debit: 0, credit: amount, party });
  }
  return lines;
}

async function loadPayrollTaxConfig() {
  const { data: taxTypes, error: e1 } = await sb.from('tax_types').select('*').eq('applies_to_payroll', true).eq('enabled', true);
  const { data: brackets, error: e2 } = await sb.from('tax_brackets').select('*');
  if (e1 || e2) { console.error(e1 || e2); return null; }
  return { taxTypes: taxTypes || [], brackets: brackets || [] };
}

async function loadEmployeeTaxOverrides(employeeId) {
  const { data, error } = await sb.from('employee_tax_overrides').select('*').eq('employee_id', employeeId);
  if (error) { console.error(error); return []; }
  return data || [];
}

// ------------------------------------------------------------
// ЦАЛИНГИЙН НЭМЭГДЭЛ (Хоол/Унаа/Утас) — глобаль каталог (дүн, данс)
// + ажилтны хэрэглээ (зөвхөн идэвхтэй эсэх — дүн бүгдэд ижил тул
// ажилтан тус бүрт давхардуулж хадгалахгүй).
// ------------------------------------------------------------
let _salaryComponentsCache = null;

async function ensureSalaryComponentsCache() {
  if (_salaryComponentsCache) return _salaryComponentsCache;
  const { data, error } = await sb.from('salary_components').select('*').eq('enabled', true);
  sbErr(error, 'Цалингийн нэмэгдэл ачаалах', {silent:true});
  _salaryComponentsCache = data || [];
  return _salaryComponentsCache;
}

// Ажилтны идэвхтэй нэмэгдлүүдийг calculatePayrollGeneric()-д шууд дамжуулах
// хэлбэрээр буцаана — дүн, ХХОАТ/НДШ тооцох эсэх, Дт данс бүгд ГЛОБАЛЬ
// каталогоос ирнэ (ажилтан бүрт ижил).
async function loadEmployeeSalaryComponents(employeeId) {
  const catalog = await ensureSalaryComponentsCache();
  const { data, error } = await sb.from('employee_salary_components').select('*').eq('employee_id', employeeId);
  if (error) { console.error(error); return []; }
  return (data || []).map(row => {
    const cat = catalog.find(c => c.code === row.component_code) || {};
    return { code: row.component_code, name: cat.name || row.component_code, amount: +cat.amount || 0,
      hhoat_taxable: cat.hhoat_taxable !== false, ndsh_taxable: cat.ndsh_taxable !== false,
      expense_account: cat.expense_account || null };
  });
}

// ------------------------------------------------------------
// САР БүРИЙН ЦАЛИНГИЙН ЯВЦ (Phase 3) -- journal entry бодитоор үүсгэнэ
// ------------------------------------------------------------

async function payrollCheckAlreadyRun(yearMonth) {
  const { data, error } = await sb.from('journal_entries').select('id').ilike('reference', `payroll:%:${yearMonth}`).limit(1);
  if (error) { console.error(error); return false; }
  return data && data.length > 0;
}

async function runMonthlyPayroll() {
  if (!canWrite('employees')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  const yearMonth = `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}`;
  if (await payrollCheckAlreadyRun(yearMonth)) {
    toast(`${yearMonth} сарын цалин аль хэдийн тооцоологдсон байна -- дахин хийхгүй`, 'error');
    return;
  }
  const activeEmployees = employees.filter(e => e.status === 'active');
  if (!activeEmployees.length) { toast('Ажиллаж байгаа ажилтан алга', 'error'); return; }
  if (!confirm(`${yearMonth} сарын цалинг ${activeEmployees.length} ажилтанд тооцох уу?\n(Энэ үйлдлийг буцаах боломжгүй тул анхаарна уу.)`)) return;

  const config = await loadPayrollTaxConfig();
  if (!config) { toast('Татварын тохиргоо ачаалахад алдаа гарлаа', 'error'); return; }

  const entryDate = new Date(CUR_YEAR, CUR_MONTH, 0).toISOString().slice(0, 10);

  let succeeded = 0, failed = 0;
  for (const e of activeEmployees) {
    const overrides = await loadEmployeeTaxOverrides(e.dbId);
    const comps = await loadEmployeeSalaryComponents(e.dbId);
    const r = calculatePayrollGeneric(e.baseSalary, config.taxTypes, config.brackets, overrides, comps);
    const party = 'employee:' + e.dbId;
    const lines = buildPayrollLinesGeneric(party, r);
    const res = await db_createJournalEntry(
      entryDate, `${e.fullName} -- ${yearMonth} сарын цалин`,
      `payroll:employee:${e.dbId}:${yearMonth}`, lines
    );
    res.success ? succeeded++ : failed++;
  }
  toast(`${yearMonth} сарын цалин: ${succeeded} амжилттай${failed ? ', ' + failed + ' алдаатай' : ''}`, failed ? 'error' : 'success');
  if (document.getElementById('page-employees')?.classList.contains('active')) renderPayrollPreview();
}

async function renderPayrollPreview() {
  const el = document.getElementById('payroll-preview-body');
  const headEl = document.getElementById('payroll-preview-head');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="10" class="empty-state">Ачаалж байна...</td></tr>';

  const config = await loadPayrollTaxConfig();
  if (!config) { el.innerHTML = '<tr><td colspan="10" class="empty-state">Татварын тохиргоо ачаалахад алдаа гарлаа</td></tr>'; return; }
  const { taxTypes, brackets } = config;

  const activeEmployees = employees.filter(e => e.status === 'active');
  if (!activeEmployees.length) { el.innerHTML = '<tr><td colspan="10" class="empty-state">Ажиллаж байгаа ажилтан алга</td></tr>'; return; }

  if (headEl) {
    headEl.innerHTML = `<th style="width:36px">№</th><th>НЭР</th><th style="text-align:right">НИЙТ ЦАЛИН</th>` +
      taxTypes.map(t => `<th style="text-align:right">${esc(t.name)}</th>`).join('') +
      `<th style="text-align:right">ГАРТ ОЛГОХ</th><th style="text-align:right">АЖ.ОЛГОГЧИЙН НИЙТ ЗАРДАЛ</th>`;
  }

  let totalGross = 0, totalNet = 0, totalEmployerCost = 0;
  const perTaxTotals = {};
  const rowsHtml = [];
  let rowIdx = 0;

  for (const e of activeEmployees) {
    rowIdx++;
    const overrides = await loadEmployeeTaxOverrides(e.dbId);
    const comps = await loadEmployeeSalaryComponents(e.dbId);
    const r = calculatePayrollGeneric(e.baseSalary, taxTypes, brackets, overrides, comps);
    totalGross += r.grossSalary; totalNet += r.netPay; totalEmployerCost += r.totalEmployerCost;
    const compsTitle = comps.length ? comps.map(c => `${esc(c.name)}: ${fmtMoney(c.amount)}`).join(', ') : '';
    const taxCells = taxTypes.map(t => {
      const b = r.breakdown.find(x => x.code === t.code);
      const amt = b ? b.employeeAmount : 0;
      perTaxTotals[t.code] = (perTaxTotals[t.code] || 0) + amt;
      return `<td class="dt-mono" style="text-align:right">${b?.exempt ? '<span style="color:var(--text-muted)" title="' + esc(b.reason || '') + '">чөлөөт</span>' : fmtMoney(amt)}</td>`;
    }).join('');
    rowsHtml.push(`<tr>
      <td><div class="avatar" style="width:24px;height:24px;font-size:10px;font-weight:700;background:rgba(59,130,246,0.18);color:#60A5FA">${rowIdx}</div></td>
      <td class="dt-title">${esc(_employeeDisplayName(e))}</td>
      <td class="dt-mono" style="text-align:right" title="${esc(compsTitle)}">${fmtMoney(r.grossSalary)}</td>
      ${taxCells}
      <td class="dt-mono" style="text-align:right;font-weight:700">${fmtMoney(r.netPay)}</td>
      <td class="dt-mono" style="text-align:right;color:var(--text-muted)">${fmtMoney(r.totalEmployerCost)}</td>
    </tr>`);
  }

  const totalTaxCells = taxTypes.map(t => `<td class="dt-mono" style="text-align:right;font-weight:700">${fmtMoney(perTaxTotals[t.code] || 0)}</td>`).join('');
  rowsHtml.push(`<tr style="background:rgba(59,130,246,0.1);border-top:2px solid var(--border-light)">
    <td></td>
    <td style="font-weight:700">НИЙТ</td>
    <td class="dt-mono" style="text-align:right;font-weight:700">${fmtMoney(totalGross)}</td>
    ${totalTaxCells}
    <td class="dt-mono" style="text-align:right;font-weight:700">${fmtMoney(totalNet)}</td>
    <td class="dt-mono" style="text-align:right;font-weight:700">${fmtMoney(totalEmployerCost)}</td>
  </tr>`);
  el.innerHTML = rowsHtml.join('');

  const warnEl = document.getElementById('payroll-preview-warning');
  if (warnEl) {
    const ndshType = taxTypes.find(t => t.code === 'ndsh');
    warnEl.style.display = !ndshType ? 'block' : 'none';
  }
}

function switchEmployeeTab(name, el) {
  document.getElementById('employees-list-view').style.display = name === 'list' ? 'block' : 'none';
  document.getElementById('employees-payroll-view').style.display = name === 'payroll' ? 'block' : 'none';
  document.querySelectorAll('#employee-tabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  if (name === 'payroll') renderPayrollPreview();
}


async function db_loadEmployees() {
  const { data, error } = await sb.from('employees').select('*').order('full_name');
  if (error) { console.error('employees load error:', error.message); return; }
  employees = (data || []).map(e => ({
    id: e.id, dbId: e.id, fullName: e.full_name, registerNumber: e.register_number || '',
    ttd: e.ttd || '', homeAddress: e.home_address || '',
    position: e.position || '', baseSalary: +e.base_salary || 0, hireDate: e.hire_date || '',
    status: e.status, terminationDate: e.termination_date || '', phone: e.phone || '', email: e.email || '',
    bankName: e.bank_name || '', ibanSuffix: e.iban_suffix || '', bankAccount: e.bank_account || '', note: e.note || '',
    lastName: e.last_name || '', parentName: e.parent_name || '', firstName: e.first_name || '',
    insuredType: e.insured_type || 1, nationality: e.nationality || 'mongol', occupationCode: e.occupation_code || '',
  }));
}

async function db_saveEmployee(emp) {
  const row = {
    full_name: emp.fullName, register_number: emp.registerNumber || null, position: emp.position || null,
    ttd: emp.ttd || null, home_address: emp.homeAddress || null,
    base_salary: emp.baseSalary || 0, hire_date: emp.hireDate || null, status: emp.status,
    termination_date: emp.terminationDate || null, phone: emp.phone || null, email: emp.email || null,
    bank_name: emp.bankName || null, iban_suffix: emp.ibanSuffix || null, bank_account: emp.bankAccount || null, note: emp.note || null,
    last_name: emp.lastName || null, parent_name: emp.parentName || null, first_name: emp.firstName || null,
    insured_type: emp.insuredType || 1, nationality: emp.nationality || 'mongol', occupation_code: emp.occupationCode || null,
  };
  if (emp.dbId) {
    const { error } = await sb.from('employees').update(row).eq('id', emp.dbId);
    if (error) { console.error(error.message); return false; }
    return true;
  }
  const { data, error } = await sb.from('employees').insert(row).select().single();
  if (error) { console.error(error.message); return false; }
  emp.dbId = data.id;
  return true;
}

async function db_deleteEmployee(dbId) {
  const { error } = await sb.from('employees').delete().eq('id', dbId);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------
// RENDER
// ------------------------------------------------------------
function renderEmployeesTable(filter = '') {
  const body = document.getElementById('employees-table-body');
  if (!body) return;
  const canEdit = canWrite('employees'), canDel = canDelete('employees');
  const q = filter.toLowerCase();
  const list = employees.filter(e => {
    if (!q) return true;
    return (e.fullName || '').toLowerCase().includes(q) || (e.firstName || '').toLowerCase().includes(q) || (e.lastName || '').toLowerCase().includes(q) || (e.position || '').toLowerCase().includes(q);
  }).sort((a, b) => _employeeDisplayName(a).localeCompare(_employeeDisplayName(b)));

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="13" class="empty-state">Ажилтан олдсонгүй</td></tr>`;
  } else {
    body.innerHTML = list.map((e, idx) => {
      // Дансны дугаар: MN + IBAN 8 орон + банкны дансны дугаар (нэг мөрт нийлүүлж харуулна)
      const ibanFull = (e.ibanSuffix || e.bankAccount) ? `MN${esc(e.ibanSuffix || '')}${esc(e.bankAccount || '')}` : '—';
      return `
      <tr style="cursor:pointer" onclick="openEmployeeDetail(${e.id})">
        <td><div class="avatar" style="width:24px;height:24px;font-size:10px;font-weight:700;background:rgba(59,130,246,0.18);color:#60A5FA">${idx + 1}</div></td>
        <td class="dt-title">${esc(_employeeDisplayName(e))}</td>
        <td class="dt-text dt-mono">${esc(e.registerNumber) || '—'}</td>
        <td class="dt-text dt-mono">${esc(e.ttd) || '—'}</td>
        <td class="dt-text">${esc(e.position) || '—'}</td>
        <td class="dt-text dt-mono" style="text-align:right">${fmtMoney(e.baseSalary)}</td>
        <td class="dt-text dt-mono" title="${esc(e.bankName || '')}">${ibanFull}</td>
        <td class="dt-text">${_fmtDateSlash(e.hireDate)}</td>
        <td class="dt-muted" style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(e.homeAddress||'')}">${esc(e.homeAddress) || '—'}</td>
        <td class="dt-text dt-mono">${esc(e.phone) || '—'}</td>
        <td class="dt-text" style="max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(e.email||'')}">${esc(e.email) || '—'}</td>
        <td>${e.status === 'active'
          ? '<span class="tag tag-success">Ажиллаж байгаа</span>'
          : '<span class="tag" style="background:var(--danger-bg);color:var(--danger);border:1px solid var(--danger)">Чөлөөлөгдсөн</span>'}</td>
        <td onclick="event.stopPropagation()">${_rowActionIcons(e.id, canEdit, canDel, 'editEmployee', 'deleteEmployee')}</td>
      </tr>`;
    }).join('');
  }

  const stat = document.getElementById('employees-stat');
  if (stat) {
    const activeCount = employees.filter(e => e.status === 'active').length;
    const totalSalary = employees.filter(e => e.status === 'active').reduce((s, e) => s + e.baseSalary, 0);
    stat.textContent = `Нийт: ${employees.length} ажилтан · Ажиллаж байгаа: ${activeCount} · Сарын нийт үндсэн цалин: ${fmtMoney(totalSalary)}`;
  }
}

function filterEmployees() {
  renderEmployeesTable(document.getElementById('employee-search')?.value || '');
}

// ------------------------------------------------------------
// ADD / EDIT MODAL
// ------------------------------------------------------------
let editingEmployeeId = null;

// ------------------------------------------------------------
// АЖИЛТАН ТУС БүРИЙН ТАТВАРЫН OҮERRIDE UI (Ажилтан нэмэх/засах modal)
// -- tax_types (applies_to_payroll=true)-г ДИНАМИКААР жагсааж,
// шинэ татвар нэмэгдэхэд ЭНЭ UI автоматаар өргөтгөнө.
// ------------------------------------------------------------
let _employeeTaxTypesCache = null;

async function ensureTaxTypesCache() {
  if (_employeeTaxTypesCache) return _employeeTaxTypesCache;
  const { data, error } = await sb.from('tax_types').select('*').eq('applies_to_payroll', true).eq('enabled', true);
  sbErr(error, 'Татварын төрөл ачаалах', {silent:true});
  _employeeTaxTypesCache = data || [];
  return _employeeTaxTypesCache;
}

async function renderEmployeeTaxOverridesUI(existingOverrides = []) {
  const taxTypes = await ensureTaxTypesCache();
  const container = document.getElementById('employee-tax-overrides-list');
  if (!container) return;
  if (!taxTypes.length) { container.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">Идэвхтэй, цалинд хамаарах татвар алга</div>'; return; }

  container.innerHTML = taxTypes.map(t => {
    const ov = existingOverrides.find(o => o.tax_code === t.code);
    const enabled = ov ? ov.enabled : true;
    const hasRateOverride = !!(ov && (ov.rate_override != null || ov.employee_rate_override != null || ov.employer_rate_override != null));
    const rateFieldsHtml = t.calculation_type === 'simple'
      ? `<div style="display:flex;align-items:center;gap:6px"><input type="number" step="0.001" id="tax-override-rate-${t.code}" placeholder="${t.rate_percent}" value="${ov?.rate_override ?? ''}" style="width:100px"><span style="font-size:12px;color:var(--text-muted)">% (анхдагч: ${t.rate_percent}%)</span></div>`
      : t.calculation_type === 'split'
      ? `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
           <span style="display:flex;align-items:center;gap:6px"><input type="number" step="0.001" id="tax-override-emprate-${t.code}" placeholder="${t.employee_rate_percent}" value="${ov?.employee_rate_override ?? ''}" style="width:85px"><span style="font-size:11px;color:var(--text-muted)">% ажилтан</span></span>
           <span style="display:flex;align-items:center;gap:6px"><input type="number" step="0.001" id="tax-override-errate-${t.code}" placeholder="${t.employer_rate_percent}" value="${ov?.employer_rate_override ?? ''}" style="width:85px"><span style="font-size:11px;color:var(--text-muted)">% ажил олгогч</span></span>
         </div>`
      : '';
    return `
    <div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px" data-tax-code="${esc(t.code)}">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;font-size:13px">
        <input type="checkbox" id="tax-override-enabled-${t.code}" ${enabled ? 'checked' : ''} onchange="onTaxOverrideToggle('${t.code}')" style="width:auto">
        ${esc(t.name)} суутгах
      </label>
      <div id="tax-override-body-${t.code}" style="margin-top:8px;${enabled ? '' : 'display:none'}">
        ${t.calculation_type !== 'progressive' ? `
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-dim);cursor:pointer">
          <input type="checkbox" id="tax-override-userate-${t.code}" ${hasRateOverride ? 'checked' : ''} onchange="onTaxOverrideRateToggle('${t.code}')" style="width:auto">
          Тусгай хувь хэмжээ ашиглах
        </label>
        <div id="tax-override-ratefields-${t.code}" style="margin-top:6px;${hasRateOverride ? '' : 'display:none'}">${rateFieldsHtml}</div>
        ` : `<div style="font-size:11px;color:var(--text-muted)">Шаталсан тооцоолол хэвээр ажиллана — зөвхөн идэвхтэй/идэвхгүй сонголт боломжтой</div>`}
      </div>
      <div id="tax-override-reason-wrap-${t.code}" style="margin-top:8px;${enabled ? 'display:none' : ''}">
        <input type="text" id="tax-override-reason-${t.code}" placeholder="Шалтгаан (жиш: Тэтгэврийн насны, НДШ дүүргэсэн)" value="${esc(ov?.exemption_reason || '')}" style="width:100%">
      </div>
    </div>`;
  }).join('');
}

function onTaxOverrideToggle(code) {
  const checked = document.getElementById(`tax-override-enabled-${code}`).checked;
  const bodyEl = document.getElementById(`tax-override-body-${code}`);
  const reasonEl = document.getElementById(`tax-override-reason-wrap-${code}`);
  if (bodyEl) bodyEl.style.display = checked ? '' : 'none';
  if (reasonEl) reasonEl.style.display = checked ? 'none' : '';
}
function onTaxOverrideRateToggle(code) {
  const checked = document.getElementById(`tax-override-userate-${code}`).checked;
  const el = document.getElementById(`tax-override-ratefields-${code}`);
  if (el) el.style.display = checked ? '' : 'none';
}

// Modal доторх бүх татварын checkbox/талбарыг уншиж, Supabase руу upsert хийнэ.
// Шалтгаан дутуу бол алдаа шидэж, дуудагч талд (saveEmployee) зогсоно.
async function readAndSaveEmployeeTaxOverrides(employeeDbId) {
  const taxTypes = await ensureTaxTypesCache();
  for (const t of taxTypes) {
    const enabledEl = document.getElementById(`tax-override-enabled-${t.code}`);
    if (!enabledEl) continue;
    const enabled = enabledEl.checked;
    let rate_override = null, employee_rate_override = null, employer_rate_override = null, exemption_reason = null;
    if (!enabled) {
      exemption_reason = document.getElementById(`tax-override-reason-${t.code}`)?.value.trim() || '';
      if (!exemption_reason) { toast(`"${t.name}"-г идэвхгүй болгоход шалтгаан заавал бичнэ үү`, 'error'); throw new Error('missing_reason'); }
    } else {
      const useRateEl = document.getElementById(`tax-override-userate-${t.code}`);
      if (useRateEl?.checked) {
        if (t.calculation_type === 'simple') {
          rate_override = +document.getElementById(`tax-override-rate-${t.code}`).value || null;
        } else if (t.calculation_type === 'split') {
          employee_rate_override = +document.getElementById(`tax-override-emprate-${t.code}`).value || null;
          employer_rate_override = +document.getElementById(`tax-override-errate-${t.code}`).value || null;
        }
      }
    }
    const row = { employee_id: employeeDbId, tax_code: t.code, enabled, rate_override, employee_rate_override, employer_rate_override, exemption_reason };
    const { error } = await sb.from('employee_tax_overrides').upsert(row, { onConflict: 'employee_id,tax_code' });
    if (error) console.error('tax override save error:', error.message);
  }
}

// ------------------------------------------------------------
// ЦАЛИНГИЙН НЭМЭГДЭЛ UI (Хоол/Унаа/Утас) — "Ажилтан нэмэх/засах" modal-д
// "Үндсэн цалин"-ы доор. Каталогийг динамикаар уншиж жагсаана.
// ------------------------------------------------------------
async function renderEmployeeSalaryComponentsUI(existingComponents = []) {
  const catalog = await ensureSalaryComponentsCache();
  const container = document.getElementById('employee-salary-components-list');
  if (!container) return;
  if (!catalog.length) { container.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">Идэвхтэй цалингийн нэмэгдэл алга</div>'; return; }

  const FREQ_LABELS = {monthly:'сар бүр', quarterly:'улирал бүр', yearly:'жилд нэг удаа'};
  container.innerHTML = catalog.map(c => {
    const existing = existingComponents.find(x => x.component_code === c.code || x.code === c.code);
    const checked = !!existing;
    return `
    <div style="display:flex;align-items:center;gap:10px" data-comp-code="${esc(c.code)}">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="comp-enabled-${c.code}" ${checked ? 'checked' : ''} style="width:auto">
        ${esc(c.name)}
      </label>
      <span style="font-size:11px;color:var(--text-muted)">(${fmtMoney(c.amount)}₮ / ${FREQ_LABELS[c.frequency] || 'сар бүр'} — бүх ажилтанд ижил, "НББ тохиргоо → Нэмэгдэл"-с тохируулна)</span>
    </div>`;
  }).join('');
}

async function readAndSaveEmployeeSalaryComponents(employeeDbId) {
  const catalog = await ensureSalaryComponentsCache();
  for (const c of catalog) {
    const enabledEl = document.getElementById(`comp-enabled-${c.code}`);
    if (!enabledEl) continue;
    if (!enabledEl.checked) {
      const { error: delErr } = await sb.from('employee_salary_components').delete().eq('employee_id', employeeDbId).eq('component_code', c.code);
      sbErr(delErr, 'Цалингийн нэмэгдэл хасах', {silent:true});
      continue;
    }
    const row = { employee_id: employeeDbId, component_code: c.code };
    const { error } = await sb.from('employee_salary_components').upsert(row, { onConflict: 'employee_id,component_code' });
    if (error) console.error('salary component save error:', error.message);
  }
}


async function openAddEmployee() {
  if (!canAdd('employees')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  editingEmployeeId = null;
  document.getElementById('modal-employee-title').textContent = 'Ажилтан нэмэх';
  document.getElementById('employee-register').value = '';
  document.getElementById('employee-ttd').value = '';
  document.getElementById('employee-home-address').value = '';
  populateEmployeePositionSelect('');
  document.getElementById('employee-salary').value = '';
  document.getElementById('employee-hire-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('employee-status').value = 'active';
  document.getElementById('employee-phone').value = '';
  document.getElementById('employee-email').value = '';
  document.getElementById('employee-bank-name').value = '';
  document.getElementById('employee-iban-suffix').value = '';
  document.getElementById('employee-bank-account').value = '';
  document.getElementById('employee-note').value = '';
  document.getElementById('employee-last-name').value = '';
  document.getElementById('employee-first-name').value = '';
  document.getElementById('employee-parent-name').value = '';
  document.getElementById('employee-nationality').value = 'mongol';
  document.getElementById('employee-insured-type').value = '1';
  document.getElementById('employee-occupation-code').value = '';
  await renderEmployeeTaxOverridesUI([]);
  await renderEmployeeSalaryComponentsUI([]);
  openModal('modal-employee');
}

async function editEmployee(id) {
  if (!canWrite('employees')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  const e = employees.find(x => x.id === id); if (!e) return;
  editingEmployeeId = id;
  document.getElementById('modal-employee-title').textContent = 'Ажилтны мэдээлэл засах';
  document.getElementById('employee-register').value = e.registerNumber;
  document.getElementById('employee-ttd').value = e.ttd || '';
  document.getElementById('employee-home-address').value = e.homeAddress || '';
  populateEmployeePositionSelect(e.position);
  document.getElementById('employee-salary').value = e.baseSalary;
  document.getElementById('employee-hire-date').value = e.hireDate;
  document.getElementById('employee-status').value = e.status;
  document.getElementById('employee-phone').value = e.phone;
  document.getElementById('employee-email').value = e.email || '';
  document.getElementById('employee-bank-name').value = e.bankName || '';
  document.getElementById('employee-iban-suffix').value = e.ibanSuffix || '';
  document.getElementById('employee-bank-account').value = e.bankAccount || '';
  document.getElementById('employee-note').value = e.note;
  document.getElementById('employee-last-name').value = e.lastName || '';
  // Хуучин (3-баганаас өмнөх) бүртгэлд Ургийн овог/Өөрийн нэр хоосон бол, өгөгдөл
  // алдагдахгүйн тулд хуучин fullName-г Өөрийн нэр талбарт түр pre-fill хийнэ —
  // хэрэглэгч Хадгалахдаа шаардлагатай бол цэгцлэн зассан байх боломжтой.
  document.getElementById('employee-first-name').value = e.firstName || (!e.lastName ? (e.fullName || '') : '');
  document.getElementById('employee-parent-name').value = e.parentName || '';
  document.getElementById('employee-nationality').value = e.nationality || 'mongol';
  document.getElementById('employee-insured-type').value = e.insuredType || 1;
  document.getElementById('employee-occupation-code').value = e.occupationCode || '';
  const overrides = e.dbId ? await loadEmployeeTaxOverrides(e.dbId) : [];
  await renderEmployeeTaxOverridesUI(overrides);
  const comps = e.dbId ? await loadEmployeeSalaryComponents(e.dbId) : [];
  await renderEmployeeSalaryComponentsUI(comps);
  openModal('modal-employee');
}

async function saveEmployee() {
  const lastName = document.getElementById('employee-last-name').value.trim();
  const firstName = document.getElementById('employee-first-name').value.trim();
  const parentName = document.getElementById('employee-parent-name').value.trim();
  if (!firstName) { toast('Өөрийн нэрийг оруулна уу', 'error'); return; }
  const fullName = [lastName, firstName].filter(Boolean).join(' ');
  const ttd = document.getElementById('employee-ttd').value.trim();
  if (ttd && !/^\d{12}$/.test(ttd)) { toast('Иргэний бүртгэлийн дугаар яг 12 оронтой тоо байх ёстой', 'error'); return; }
  const ibanSuffix = document.getElementById('employee-iban-suffix').value.trim();
  if (ibanSuffix && !/^\d{8}$/.test(ibanSuffix)) { toast('IBAN-ы дугаар яг 8 оронтой тоо байх ёстой', 'error'); return; }
  const baseSalary = +document.getElementById('employee-salary').value || 0;
  // ⚠️ 2026-07-19: assets.js-ийн адил ноцтой алдаанаас сэргийлэх хамгаалалт
  if(editingEmployeeId && !employees.find(e=>e.id===editingEmployeeId)) {
    toast('Засварлах гэж буй ажилтан олдсонгүй — хуудсаа дахин ачаалаад дахин оролдоно уу', 'error');
    return;
  }
  const _editing = editingEmployeeId ? employees.find(e => e.id === editingEmployeeId) : null;
  const emp = {
    dbId: _editing?.dbId || null,
    fullName,
    registerNumber: document.getElementById('employee-register').value.trim(),
    ttd,
    homeAddress: document.getElementById('employee-home-address').value.trim(),
    position: document.getElementById('employee-position').value.trim(),
    baseSalary,
    hireDate: document.getElementById('employee-hire-date').value,
    status: document.getElementById('employee-status').value,
    terminationDate: _editing?.terminationDate || '',
    phone: document.getElementById('employee-phone').value.trim(),
    email: document.getElementById('employee-email').value.trim(),
    bankName: document.getElementById('employee-bank-name').value,
    ibanSuffix,
    bankAccount: document.getElementById('employee-bank-account').value.trim(),
    note: document.getElementById('employee-note').value.trim(),
    lastName, firstName, parentName,
    nationality: document.getElementById('employee-nationality').value,
    insuredType: +document.getElementById('employee-insured-type').value || 1,
    occupationCode: document.getElementById('employee-occupation-code').value.trim(),
  };
  const ok = await db_saveEmployee(emp);
  if (!ok) { toast('Хадгалахад алдаа гарлаа — таны рольд энэ үйлдэл хийх эрх байхгүй байж болзошгүй', 'error'); return; }
  try {
    await readAndSaveEmployeeTaxOverrides(emp.dbId);
  } catch (err) {
    if (err.message === 'missing_reason') return; // toast аль хэдийн гарсан; ажилтан хадгалагдсан, дахин Edit хийж татварын тохиргоог гүйцээж болно
  }
  await readAndSaveEmployeeSalaryComponents(emp.dbId);
  if (editingEmployeeId) {
    const idx = employees.findIndex(e => e.id === editingEmployeeId);
    if (idx >= 0) employees[idx] = { ...employees[idx], ...emp };
    toast('Мэдээлэл шинэчлэгдлээ', 'success');
    logActivity('edit', 'employees', emp.dbId, fullName);
  } else {
    employees.push({ id: nextId++, ...emp });
    toast(fullName + ' нэмэгдлээ', 'success');
    logActivity('add', 'employees', emp.dbId, fullName);
  }
  closeModal('modal-employee');
  renderEmployeesTable(document.getElementById('employee-search')?.value || '');
}

async function deleteEmployee(id) {
  if (!confirm('Устгах уу? Энэ үйлдлийг буцаах боломжгүй.')) return;
  const e = employees.find(x => x.id === id); if (!e) return;
  try {
    await db_deleteEmployee(e.dbId);
  } catch (err) {
    toast('Устгахад эрхгүй байна эсвэл алдаа гарлаа: ' + err.message, 'error');
    return;
  }
  employees = employees.filter(x => x.id !== id);
  renderEmployeesTable(document.getElementById('employee-search')?.value || '');
  toast('Устгагдлаа', 'success');
  logActivity('delete', 'employees', e.dbId, e.fullName || String(id));
}

// ------------------------------------------------------------
// DETAIL VIEW (жижиг, зөвхөн харах — засах/устгах товч мөн энд байна)
// ------------------------------------------------------------
let selectedEmployeeForDetail = null;

function openEmployeeDetail(id) {
  const e = employees.find(x => x.id === id); if (!e) return;
  selectedEmployeeForDetail = e;
  document.getElementById('employee-detail-title').textContent = _employeeDisplayName(e);
  document.getElementById('employee-detail-body').innerHTML = `
    <div class="summary-row"><span class="summary-key">Албан тушаал</span><span class="summary-val">${esc(e.position) || '—'}</span></div>
    <div class="summary-row"><span class="summary-key">Регистрийн дугаар</span><span class="summary-val">${esc(e.registerNumber) || '—'}</span></div>
    <div class="summary-row"><span class="summary-key">Үндсэн цалин</span><span class="summary-val">${fmtMoney(e.baseSalary)}</span></div>
    <div class="summary-row"><span class="summary-key">Ажилд орсон огноо</span><span class="summary-val">${_fmtDateSlash(e.hireDate)}</span></div>
    <div class="summary-row"><span class="summary-key">Утас</span><span class="summary-val">${esc(e.phone) || '—'}</span></div>
    <div class="summary-row"><span class="summary-key">И-мэйл</span><span class="summary-val">${esc(e.email) || '—'}</span></div>
    <div class="summary-row"><span class="summary-key">Дансны дугаар</span><span class="summary-val">${esc(e.bankAccount) || '—'}</span></div>
    <div class="summary-row"><span class="summary-key">Төлөв</span><span class="summary-val">${e.status === 'active' ? 'Ажиллаж байгаа' : 'Чөлөөлөгдсөн'}</span></div>
    ${e.note ? `<div class="summary-row"><span class="summary-key">Тэмдэглэл</span><span class="summary-val" style="text-align:right;max-width:280px">${esc(e.note)}</span></div>` : ''}`;
  openModal('modal-employee-detail');
}

function employeeDetailEdit() {
  closeModal('modal-employee-detail');
  if (selectedEmployeeForDetail) editEmployee(selectedEmployeeForDetail.id);
}
