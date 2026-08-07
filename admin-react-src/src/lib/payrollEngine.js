// employees.js-ийн Цалингийн тооцооллын (Phase 2 -> ЕРӨНХИЙЛСӨН v2) цэвэр
// функцүүдийн React талын эх сурвалж. ⚠️ Архитектурын шийдвэр 3: эдгээр
// suh.html-тэй ЯГ таарч байх ёстой (Node.js-д 21 тестээр баталгаажсан
// payroll-calc-v2.js-тэй адил алгоритм).

export function calculateProgressiveTax(taxableAmount, brackets) {
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

export function calculatePayrollGeneric(baseSalary, taxTypes, taxBrackets, employeeOverrides = [], components = []) {
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
    const override = employeeOverrides.find((o) => o.tax_code === tt.code);
    const enabled = override ? override.enabled : true;
    if (!enabled) {
      breakdown.push({ code: tt.code, name: tt.name, employeeAmount: 0, employerAmount: 0, exempt: true, reason: override?.exemption_reason || '', liabilityAccount: tt.payroll_liability_account });
      continue;
    }
    const taxableComponentsSum = components
      .filter((c) => c[tt.code + '_taxable'] !== false)
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
      const brackets = taxBrackets.filter((b) => b.tax_code === tt.code);
      const amt = calculateProgressiveTax(base, brackets);
      breakdown.push({ code: tt.code, name: tt.name, employeeAmount: amt, employerAmount: 0, taxableBase: base, liabilityAccount: tt.payroll_liability_account });
    }
  }

  const totalEmployeeDeductions = +breakdown.reduce((s, b) => s + b.employeeAmount, 0).toFixed(2);
  const netPay = +(totalGross - totalEmployeeDeductions).toFixed(2);
  return { baseSalary, components, grossSalary: totalGross, breakdown, netPay, totalEmployerCost: +totalEmployerCost.toFixed(2) };
}

export function buildPayrollLinesGeneric(party, result) {
  const lines = [];
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
