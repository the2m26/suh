import { getAccountByCode, getNormalBalance, CHART_OF_ACCOUNTS } from './chartOfAccounts';

// accounting-reports.js-ийн тайлангийн ЦЭВЭР функцүүдийн React талын эх
// сурвалж (Node.js орчинд 83 тестээр батлагдсан "accounting.js" прототипоос
// шилжүүлсэн, дахин бичээгүй). ЗӨВХӨН УНШИХ — шинэ journal бичих зам биш.

export function getEntriesForAccount(journalEntries, code, { fromDate, toDate } = {}) {
  return journalEntries.filter((e) => {
    if (fromDate && e.date < fromDate) return false;
    if (toDate && e.date > toDate) return false;
    return e.lines.some((l) => l.account === code);
  });
}

export function getAccountBalance(journalEntries, code, opts = {}) {
  const acc = getAccountByCode(code);
  if (!acc) return null;
  const normalSide = getNormalBalance(code);
  let debitSum = 0, creditSum = 0;
  for (const entry of getEntriesForAccount(journalEntries, code, opts)) {
    for (const line of entry.lines) {
      if (line.account === code) { debitSum += line.debit; creditSum += line.credit; }
    }
  }
  const balance = normalSide === 'debit' ? (debitSum - creditSum) : (creditSum - debitSum);
  return { code, name: acc.name, category: acc.category, normal_balance: normalSide, debitSum, creditSum, balance };
}

export function getTrialBalance(journalEntries, opts = {}) {
  const rows = [];
  let totalDebit = 0, totalCredit = 0;
  for (const acc of CHART_OF_ACCOUNTS) {
    const bal = getAccountBalance(journalEntries, acc.code, opts);
    if (bal.debitSum === 0 && bal.creditSum === 0) continue;
    const debitCol = bal.normal_balance === 'debit' ? Math.max(bal.balance, 0) : Math.max(-bal.balance, 0);
    const creditCol = bal.normal_balance === 'credit' ? Math.max(bal.balance, 0) : Math.max(-bal.balance, 0);
    rows.push({ code: acc.code, name: acc.name, category: acc.category, debit: debitCol, credit: creditCol });
    totalDebit += debitCol;
    totalCredit += creditCol;
  }
  return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}

export function getPartyBalance(journalEntries, code, party, opts = {}) {
  const acc = getAccountByCode(code);
  if (!acc) return null;
  const normalSide = getNormalBalance(code);
  let debitSum = 0, creditSum = 0;
  for (const entry of getEntriesForAccount(journalEntries, code, opts)) {
    for (const line of entry.lines) {
      if (line.account === code && line.party === party) { debitSum += line.debit; creditSum += line.credit; }
    }
  }
  const balance = normalSide === 'debit' ? (debitSum - creditSum) : (creditSum - debitSum);
  return { code, party, debitSum, creditSum, balance };
}

export function dayBefore(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// accounting-reports.js-ийн _cashFlowClassify()/generateCashFlowStatement()
// (мөр ~511-599) — Мөнгөн гүйлгээний урсгалын тайлан.
export function cashFlowClassify(account, party) {
  const isBusinessParty = party && party.startsWith('business:');
  const map = {
    '5100': { activity: 'operating', line: '1.1.a', label: 'Гишүүдийн татвараас орсон мөнгө' },
    '1110': { activity: 'operating', line: '1.1.a', label: 'Гишүүдийн татвараас орсон мөнгө' },
    '5200': { activity: 'operating', line: '1.1.b', label: 'Төсөл, хөтөлбөрөөс орсон мөнгө' },
    '5300': { activity: 'operating', line: '1.1.c', label: 'Бэлэг, хандив, тусламж' },
    '5400': { activity: 'operating', line: '1.1.d', label: 'Түрээсийн орлогод хүлээн авсан мөнгө' },
    '1120': { activity: 'operating', line: '1.1.d', label: 'Түрээсийн орлогод хүлээн авсан мөнгө' },
    '5500': { activity: 'operating', line: '1.1.e', label: 'Бусад' },
    '5600': { activity: 'operating', line: '1.1.e', label: 'Бусад' },
    '7010': { activity: 'operating', line: '1.2.a', label: 'Ажиллагчдад төлсөн' },
    '7011': { activity: 'operating', line: '1.2.a', label: 'Ажиллагчдад төлсөн' },
    '7012': { activity: 'operating', line: '1.2.a', label: 'Ажиллагчдад төлсөн' },
    '7013': { activity: 'operating', line: '1.2.a', label: 'Ажиллагчдад төлсөн' },
    '7020': { activity: 'operating', line: '1.2.b', label: 'Нийгмийн даатгалын байгууллагад төлсөн' },
    '1210': { activity: 'operating', line: '1.2.c', label: 'Бараа материал худалдан авахад төлсөн' },
    '1220': { activity: 'operating', line: '1.2.c', label: 'Бараа материал худалдан авахад төлсөн' },
    '1230': { activity: 'operating', line: '1.2.c', label: 'Бараа материал худалдан авахад төлсөн' },
    '7040': { activity: 'operating', line: '1.2.d', label: 'Ашиглалтын зардалд төлсөн' },
    '7050': { activity: 'operating', line: '1.2.d', label: 'Ашиглалтын зардалд төлсөн' },
    '7070': { activity: 'operating', line: '1.2.e', label: 'Түлш шатахуун, тээврийн хөлс, сэлбэг хэрэгсэлд төлсөн' },
    '3010': { activity: 'operating', line: '1.2.f', label: 'Бэлтгэн нийлүүлэгчдэд төлсөн бусад мөнгө' },
    '7030': { activity: 'operating', line: '1.2.f', label: 'Бэлтгэн нийлүүлэгчдэд төлсөн бусад мөнгө' },
    '7080': { activity: 'operating', line: '1.2.f', label: 'Бэлтгэн нийлүүлэгчдэд төлсөн бусад мөнгө' },
    '7090': { activity: 'operating', line: '1.2.f', label: 'Бэлтгэн нийлүүлэгчдэд төлсөн бусад мөнгө' },
    '3020': { activity: 'operating', line: '1.2.h', label: 'Татварын байгууллагад төлсөн' },
    '2010': { activity: 'investing', line: '2.buy', label: 'Худалдаж авсан урт хугацаат хөрөнгө' },
    '2200': { activity: 'investing', line: '2.invest_buy', label: 'Худалдаж авсан хөрөнгө оруулалт' },
    '3900': { activity: 'financing', line: '3.loan', label: 'Банкнаас авсан зээл / Зээлийн төлөлт' },
    '3050': isBusinessParty
      ? { activity: 'operating', line: '1.1.d', label: 'Түрээсийн орлогод хүлээн авсан мөнгө (урьдчилгаа)' }
      : { activity: 'operating', line: '1.1.a', label: 'Гишүүдийн татвараас орсон мөнгө (урьдчилгаа)' },
  };
  return map[account] || { activity: 'operating', line: '1.1.e', label: 'Бусад (ангилаагүй)' };
}

export function generateCashFlowStatement(journalEntries, opts = {}) {
  const cashAccounts = ['1010', '1020'];
  const buckets = {};
  function addToBucket(cls, amount) {
    if (!buckets[cls.line]) buckets[cls.line] = { line: cls.line, label: cls.label, activity: cls.activity, amount: 0 };
    buckets[cls.line].amount += amount;
  }
  for (const cashCode of cashAccounts) {
    for (const entry of getEntriesForAccount(journalEntries, cashCode, opts)) {
      const cashLines = entry.lines.filter((l) => cashAccounts.includes(l.account));
      const otherLines = entry.lines.filter((l) => !cashAccounts.includes(l.account));
      const cashNet = cashLines.reduce((s, l) => s + (l.debit - l.credit), 0);
      if (cashNet === 0 || otherLines.length === 0) continue;
      const classified = otherLines.map((l) => cashFlowClassify(l.account, l.party));
      addToBucket(classified[0], cashNet);
    }
  }
  const opRows = Object.values(buckets).filter((b) => b.activity === 'operating');
  const invRows = Object.values(buckets).filter((b) => b.activity === 'investing');
  const finRows = Object.values(buckets).filter((b) => b.activity === 'financing');
  const opTotal = opRows.reduce((s, r) => s + r.amount, 0);
  const invTotal = invRows.reduce((s, r) => s + r.amount, 0);
  const finTotal = finRows.reduce((s, r) => s + r.amount, 0);
  const netChange = opTotal + invTotal + finTotal;
  const beginningBalance = opts.fromDate
    ? cashAccounts.reduce((s, c) => s + getAccountBalance(journalEntries, c, { toDate: dayBefore(opts.fromDate) }).balance, 0)
    : 0;
  const endingBalance = cashAccounts.reduce((s, c) => s + getAccountBalance(journalEntries, c, { toDate: opts.toDate }).balance, 0);
  return {
    operating: { rows: opRows, total: opTotal },
    investing: { rows: invRows, total: invTotal },
    financing: { rows: finRows, total: finTotal },
    netChange, beginningBalance, endingBalance,
    reconciles: Math.abs((beginningBalance + netChange) - endingBalance) < 0.01,
  };
}
export function getLedger(journalEntries, code, opts = {}) {
  const acc = getAccountByCode(code);
  if (!acc) return null;
  const normalSide = getNormalBalance(code);
  const entries = getEntriesForAccount(journalEntries, code, opts)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));

  let running = 0;
  const rows = [];
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.account !== code) continue;
      const delta = normalSide === 'debit' ? (line.debit - line.credit) : (line.credit - line.debit);
      running += delta;
      rows.push({
        date: entry.date, description: entry.description, reference: entry.reference,
        party: line.party || null, debit: line.debit, credit: line.credit,
        runningBalance: running,
      });
    }
  }
  return { code, name: acc.name, category: acc.category, normal_balance: normalSide, rows, endingBalance: running };
}
