import { describe, it, expect } from 'vitest';
import { getTrialBalance, getLedger, getAccountBalance, generateCashFlowStatement } from '../accountingReports';

const sampleEntries = [
  { id: 1, date: '2026-01-01', description: 'Төлбөр', reference: 'income:5600:2026-01-01',
    lines: [{ account: '1020', debit: 100000, credit: 0 }, { account: '5600', debit: 0, credit: 100000 }] },
  { id: 2, date: '2026-01-15', description: 'Зардал', reference: 'expense:1',
    lines: [{ account: '7030', debit: 50000, credit: 0 }, { account: '1020', debit: 0, credit: 50000 }] },
];

describe('getTrialBalance() — Дт нийт = Кт нийт байх ёстой', () => {
  it('balanced=true бүх зөв бичсэн journal-д', () => {
    const tb = getTrialBalance(sampleEntries);
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(tb.totalCredit);
  });
  it('хөдөлгөөнгүй дансыг жагсаалтад оруулахгүй', () => {
    const tb = getTrialBalance(sampleEntries);
    expect(tb.rows.find((r) => r.code === '9200')).toBeUndefined();
  });
  it('1020 (Харилцах) дүн зөв: 100000 - 50000 = 50000 Дт', () => {
    const tb = getTrialBalance(sampleEntries);
    const row = tb.rows.find((r) => r.code === '1020');
    expect(row.debit).toBe(50000);
    expect(row.credit).toBe(0);
  });
});

describe('getAccountBalance()', () => {
  it('5600 (Орлого) — Кт нөлөөлдөг тул эерэг үлдэгдэл', () => {
    const bal = getAccountBalance(sampleEntries, '5600');
    expect(bal.balance).toBe(100000);
    expect(bal.normal_balance).toBe('credit');
  });
});

describe('getLedger() — running balance зөв тооцоологдоно', () => {
  it('1020 дансны 2 мөрийн running balance дараалж 100000 → 50000', () => {
    const ledger = getLedger(sampleEntries, '1020');
    expect(ledger.rows).toHaveLength(2);
    expect(ledger.rows[0].runningBalance).toBe(100000);
    expect(ledger.rows[1].runningBalance).toBe(50000);
    expect(ledger.endingBalance).toBe(50000);
  });
});

describe('generateCashFlowStatement() — эхний+цэвэр урсгал=эцсийн үлдэгдэл', () => {
  it('төлбөр орж ирэхэд operating урсгалд орж, reconciles=true', () => {
    const cf = generateCashFlowStatement(sampleEntries);
    expect(cf.reconciles).toBe(true);
    expect(cf.operating.total).toBe(50000); // 100000 орлого - 50000 зардал
  });
});
