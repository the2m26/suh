import { describe, it, expect } from 'vitest';
import { calculateProgressiveTax, calculatePayrollGeneric, buildPayrollLinesGeneric } from '../payrollEngine';

describe('calculateProgressiveTax()', () => {
  const brackets = [
    { tax_code: 'hhoat', bracket_order: 1, threshold_from: 0, threshold_to: 1000000, base_amount: 0, rate_percent: 10 },
    { tax_code: 'hhoat', bracket_order: 2, threshold_from: 1000000, threshold_to: null, base_amount: 100000, rate_percent: 15 },
  ];
  it('эхний shatanд 10%', () => {
    expect(calculateProgressiveTax(500000, brackets)).toBe(50000);
  });
  it('дээд шатанд base_amount + давсан хэсгийн 15%', () => {
    expect(calculateProgressiveTax(1500000, brackets)).toBe(100000 + 500000 * 0.15);
  });
  it('0 эсвэл сөрөг үед 0', () => {
    expect(calculateProgressiveTax(0, brackets)).toBe(0);
    expect(calculateProgressiveTax(-100, brackets)).toBe(0);
  });
});

describe('calculatePayrollGeneric()', () => {
  const taxTypes = [
    { code: 'ndsh', name: 'НДШ', calculation_type: 'split', employee_rate_percent: 11.5, employer_rate_percent: 14, payroll_liability_account: '3030' },
    { code: 'hhoat', name: 'ХХОАТ', calculation_type: 'progressive', payroll_liability_account: '3020' },
  ];
  const brackets = [
    { tax_code: 'hhoat', bracket_order: 1, threshold_from: 0, threshold_to: null, base_amount: 0, rate_percent: 10 },
  ];

  it('base salary-аас split (НДШ) + progressive (ХХОАТ) зөв тооцоолно', () => {
    const r = calculatePayrollGeneric(1000000, taxTypes, brackets, [], []);
    expect(r.grossSalary).toBe(1000000);
    const ndsh = r.breakdown.find((b) => b.code === 'ndsh');
    expect(ndsh.employeeAmount).toBe(115000); // 11.5%
    expect(ndsh.employerAmount).toBe(140000); // 14%
    expect(r.totalEmployerCost).toBe(1000000 + 140000);
  });

  it('override.enabled=false үед татвар 0, exempt=true', () => {
    const overrides = [{ tax_code: 'ndsh', enabled: false, exemption_reason: 'Тэтгэвэрт' }];
    const r = calculatePayrollGeneric(1000000, taxTypes, brackets, overrides, []);
    const ndsh = r.breakdown.find((b) => b.code === 'ndsh');
    expect(ndsh.exempt).toBe(true);
    expect(ndsh.employeeAmount).toBe(0);
  });

  it('цалингийн нэмэгдэл (components) НИЙТ ЦАЛИНД нэмэгддэг', () => {
    const r = calculatePayrollGeneric(1000000, [], [], [], [{ code: 'meal', amount: 50000, expense_account: '7011' }]);
    expect(r.grossSalary).toBe(1050000);
  });
});

describe('buildPayrollLinesGeneric() — Дт/Кт мөрүүд', () => {
  it('үндсэн цалин 7010, гарт олгох дүн 1020 credit', () => {
    const result = { baseSalary: 1000000, components: [], grossSalary: 1000000, breakdown: [], netPay: 900000, totalEmployerCost: 1000000 };
    const lines = buildPayrollLinesGeneric('employee:1', result);
    expect(lines.find((l) => l.account === '7010').debit).toBe(1000000);
    expect(lines.find((l) => l.account === '1020').credit).toBe(900000);
  });

  it('татварын liability данс бүрд НИЙЛБЭР (ажилтан+ажил олгогч) кредитлэнэ', () => {
    const result = {
      baseSalary: 1000000, components: [], grossSalary: 1000000,
      breakdown: [{ code: 'ndsh', employeeAmount: 115000, employerAmount: 140000, liabilityAccount: '3030' }],
      netPay: 885000, totalEmployerCost: 1140000,
    };
    const lines = buildPayrollLinesGeneric('employee:1', result);
    const liability = lines.find((l) => l.account === '3030');
    expect(liability.credit).toBe(255000); // 115000+140000
  });
});
