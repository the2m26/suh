import { useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabase';
import { calcFee, calcBusinessFee, daysUnpaidForResident, daysUnpaidForBusiness } from '../lib/financeEngine';
import { getSpotSqm } from '../lib/parkingStorageHelpers';
import { getTrialBalance } from '../lib/accountingReports';
import { ACCOUNT_CATEGORIES } from '../lib/chartOfAccounts';
import { accumulatedDepreciationAtMonths } from '../lib/accountingBridge';
import { monthsBetweenDates } from '../lib/assetHelpers';
import { employeeDisplayName } from '../lib/employeeHelpers';

const EXPENSE_CAT_NAMES = { utility: 'Ашиглалтын зардал', maintenance: 'Засвар', cleaning: 'Цэвэрлэгээ', security: 'Хамгаалалт', other: 'Бусад' };

export default function Reports() {
  const [tab, setTab] = useState('income');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [residents, setResidents] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [feeCatalog, setFeeCatalog] = useState([]);
  const [parkingTypes, setParkingTypes] = useState([]);
  const [storageTypes, setStorageTypes] = useState([]);
  const [feeSettings, setFeeSettings] = useState({ penalty: 2 });
  const [rentSettings, setRentSettings] = useState({ penalty: 2 });
  const [journalEntries, setJournalEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: res }, { data: biz }, { data: tx }, { data: fc }, { data: pt }, { data: st }, { data: settingsRows }, { data: je }, { data: emp }, { data: fa }] = await Promise.all([
        sb.from('residents').select('*'),
        sb.from('businesses').select('*'),
        sb.from('transactions').select('*'),
        sb.from('fee_catalog').select('*'),
        sb.from('parking_types').select('*'),
        sb.from('storage_types').select('*'),
        sb.from('settings').select('*'),
        sb.from('journal_entries').select('id, entry_date, description, reference, journal_lines(account_code, debit, credit, party)').order('entry_date', { ascending: true }).order('id', { ascending: true }),
        sb.from('employees').select('id, full_name, first_name, parent_name, position'),
        sb.from('fixed_assets').select('*'),
      ]);
      setResidents((res || []).map((r) => ({ id: r.id, apt: r.apt, isVirtual: r.is_virtual || false, firstname: r.firstname, lastname: r.lastname, phones: r.phones || [], parkings: r.parkings || [], storages: r.storages || [] })));
      setBusinesses((biz || []).map((b) => ({ id: b.id, name: b.name, type: b.type, area: +b.area || 0, mobile: b.mobile, phone: b.phone, parkings: b.parkings || [], storages: b.storages || [] })));
      setTransactions(tx || []);
      setFeeCatalog(fc || []);
      setParkingTypes(pt || []);
      setStorageTypes(st || []);
      (settingsRows || []).forEach((s) => {
        if (s.key === 'fee') setFeeSettings((f) => ({ ...f, ...s.value }));
        if (s.key === 'rent') setRentSettings((r) => ({ ...r, ...s.value }));
      });
      setJournalEntries((je || []).map((e) => ({
        id: e.id, date: e.entry_date, description: e.description, reference: e.reference,
        lines: (e.journal_lines || []).map((l) => ({ account: l.account_code, debit: +l.debit, credit: +l.credit, party: l.party })),
      })));
      setEmployees((emp || []).map((e) => ({ id: e.id, dbId: e.id, fullName: e.full_name, firstName: e.first_name, parentName: e.parent_name, position: e.position })));
      setAssets((fa || []).map((a) => ({
        id: a.id, name: a.name, cost: +a.original_cost || 0, purchaseDate: a.purchase_date, usefulLife: a.useful_life_months,
        depMethod: a.depreciation_method || 'straight_line', decliningRate: a.declining_rate, salvage: +a.salvage_value || 0,
        status: a.status, disposalDate: a.disposal_date,
      })));
      setLoading(false);
    })();
  }, []);

  const feeCtx = { getSpotSqm: (kind, label) => getSpotSqm(kind, label, parkingTypes, storageTypes) };
  const years = [...new Set(transactions.filter((t) => t.year).map((t) => t.year))].sort((a, b) => b - a);
  if (!years.includes(new Date().getFullYear())) years.unshift(new Date().getFullYear());

  return (
    <div className="page page-wide">
      <h2>СӨХ дотоод тайлан</h2>
      <div className="gate-tabs">
        <button className={'gate-tab' + (tab === 'income' ? ' active' : '')} onClick={() => setTab('income')}>Орлогын тайлан</button>
        <button className={'gate-tab' + (tab === 'expense' ? ' active' : '')} onClick={() => setTab('expense')}>Зарлагын тайлан</button>
        <button className={'gate-tab' + (tab === 'debt' ? ' active' : '')} onClick={() => setTab('debt')}>Өр авлагын тайлан</button>
        <button className={'gate-tab' + (tab === 'balance' ? ' active' : '')} onClick={() => setTab('balance')}>Дансны үлдэгдэл</button>
        <button className={'gate-tab' + (tab === 'trend' ? ' active' : '')} onClick={() => setTab('trend')}>Сар, жилийн хандлага</button>
        <button className={'gate-tab' + (tab === 'aging' ? ' active' : '')} onClick={() => setTab('aging')}>Насжилтын дэлгэрэнгүй</button>
        <button className={'gate-tab' + (tab === 'tx_detail' ? ' active' : '')} onClick={() => setTab('tx_detail')}>Гүйлгээний дэлгэрэнгүй</button>
        <button className={'gate-tab' + (tab === 'statement' ? ' active' : '')} onClick={() => setTab('statement')}>Тоот/ААН хуулга</button>
        <button className={'gate-tab' + (tab === 'payroll_summary' ? ' active' : '')} onClick={() => setTab('payroll_summary')}>Цалингийн нэгтгэл</button>
        <button className={'gate-tab' + (tab === 'depreciation_summary' ? ' active' : '')} onClick={() => setTab('depreciation_summary')}>Элэгдлийн хураангуй</button>
      </div>
      <div className="gate-filters">
        <select value={year} onChange={(e) => setYear(+e.target.value)}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(+e.target.value)}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}-р сар</option>)}
        </select>
      </div>

      {loading ? <div className="empty-state">Ачаалж байна...</div> : tab === 'income' ? (
        <IncomeReport residents={residents} businesses={businesses} transactions={transactions} feeCatalog={feeCatalog} feeCtx={feeCtx} year={year} month={month} />
      ) : tab === 'expense' ? (
        <ExpenseReport transactions={transactions} year={year} month={month} />
      ) : tab === 'debt' ? (
        <DebtReport residents={residents} businesses={businesses} transactions={transactions} feeCatalog={feeCatalog} feeCtx={feeCtx} feeSettings={feeSettings} rentSettings={rentSettings} year={year} month={month} />
      ) : tab === 'balance' ? (
        <BalanceReport journalEntries={journalEntries} year={year} month={month} />
      ) : tab === 'trend' ? (
        <TrendReport transactions={transactions} year={year} />
      ) : tab === 'aging' ? (
        <AgingReport residents={residents} businesses={businesses} transactions={transactions} feeCatalog={feeCatalog} feeCtx={feeCtx} />
      ) : tab === 'tx_detail' ? (
        <TxDetailReport residents={residents} businesses={businesses} transactions={transactions} year={year} month={month} />
      ) : tab === 'statement' ? (
        <StatementReport residents={residents} businesses={businesses} transactions={transactions} />
      ) : tab === 'payroll_summary' ? (
        <PayrollSummaryReport employees={employees} journalEntries={journalEntries} year={year} month={month} />
      ) : (
        <DepreciationSummaryReport assets={assets} year={year} month={month} />
      )}
    </div>
  );
}

function IncomeReport({ residents, businesses, transactions, feeCatalog, feeCtx, year, month }) {
  const monthTx = useMemo(() => transactions.filter((t) => t && t.type === 'income' && t.month === month && t.year === year), [transactions, month, year]);
  const total = monthTx.reduce((s, t) => s + t.amount, 0);
  const expected = useMemo(() => {
    const resExpected = residents.filter((r) => !r.isVirtual).reduce((s, r) => s + calcFee(r, feeCatalog, feeCtx), 0);
    const bizExpected = businesses.reduce((s, b) => s + calcBusinessFee(b, feeCatalog, feeCtx), 0);
    return resExpected + bizExpected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residents, businesses, feeCatalog]);
  const totalUnits = residents.filter((r) => !r.isVirtual).length + businesses.length;

  return (
    <>
      <div className="dt-muted" style={{ marginBottom: 10 }}>
        Нийт орлого: {total.toLocaleString()}₮ · Хүлээгдэж буй: {expected.toLocaleString()}₮ · Цуглуулалт: {expected ? Math.round((total / expected) * 100) : 0}% · Бичлэг: {monthTx.length}/{totalUnits}
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Тоот/ААН</th><th>Төрөл</th><th>Нэр</th><th className="ta-right">Дүн</th><th>Хэлбэр</th><th>Огноо</th></tr></thead>
          <tbody>
            {monthTx.map((t, i) => {
              let label, kindLabel, name;
              if (t.category === 'business' && t.businessId) {
                const b = businesses.find((x) => x.id === t.businessId);
                label = b ? b.name : '—'; kindLabel = 'ААН'; name = b ? b.name : '—';
              } else {
                const r = residents.find((x) => String(x.apt) === String(t.apt));
                label = t.apt != null ? String(t.apt) : '—'; kindLabel = 'Сууц'; name = r ? `${r.firstname || ''} ${r.lastname || ''}`.trim() : '—';
              }
              return (
                <tr key={i}>
                  <td className="dt-title">{label}</td><td className="dt-muted">{kindLabel}</td><td className="dt-text">{name}</td>
                  <td className="dt-mono ta-right" style={{ color: 'var(--success)' }}>{t.amount.toLocaleString()}</td>
                  <td className="dt-muted">{t.method}</td><td className="dt-mono">{t.date}</td>
                </tr>
              );
            })}
            {!monthTx.length && <tr><td colSpan={6} className="empty-state">Энэ сард орлого бүртгэгдээгүй</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ExpenseReport({ transactions, year, month }) {
  const exps = useMemo(() => transactions.filter((t) => t && t.type === 'expense' && t.month === month && t.year === year), [transactions, month, year]);
  const total = exps.reduce((s, t) => s + t.amount, 0);
  const byCat = {};
  exps.forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });

  return (
    <>
      <div className="dt-muted" style={{ marginBottom: 6 }}>Ангилалаар:</div>
      {Object.entries(byCat).map(([c, v]) => (
        <div key={c} className="page-header-row" style={{ marginBottom: 4 }}>
          <span className="dt-text">{EXPENSE_CAT_NAMES[c] || c}</span>
          <span className="dt-mono" style={{ color: 'var(--danger)' }}>{v.toLocaleString()}₮</span>
        </div>
      ))}
      {!Object.keys(byCat).length && <div className="empty-state">Энэ сард зарлага бүртгэгдээгүй</div>}
      <div className="page-header-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8, marginBottom: 18 }}>
        <span style={{ fontWeight: 700 }}>Нийт зарлага</span>
        <span className="dt-mono" style={{ color: 'var(--danger)', fontSize: 18, fontWeight: 700 }}>{total.toLocaleString()}₮</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Огноо</th><th>Ангилал</th><th>Тайлбар</th><th className="ta-right">Дүн</th></tr></thead>
          <tbody>
            {exps.map((t, i) => (
              <tr key={i}>
                <td className="dt-mono">{t.date}</td><td className="dt-muted">{EXPENSE_CAT_NAMES[t.category] || 'Бусад'}</td>
                <td className="dt-text">{t.desc}</td>
                <td className="dt-mono ta-right" style={{ color: 'var(--danger)' }}>{t.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DebtReport({ residents, businesses, transactions, feeCatalog, feeCtx, feeSettings, rentSettings, year, month }) {
  const paidApts = transactions.filter((t) => t && t.type === 'income' && t.category === 'resident' && t.month === month && t.year === year).map((t) => String(t.apt));
  const paidBizIds = transactions.filter((t) => t && t.type === 'income' && t.category === 'business' && t.month === month && t.year === year).map((t) => t.businessId);
  const overdueRes = residents.filter((r) => r && !r.isVirtual && !paidApts.includes(String(r.apt)));
  const overdueBiz = businesses.filter((b) => b && !paidBizIds.includes(b.id));
  const totalRes = overdueRes.reduce((s, r) => s + calcFee(r, feeCatalog, feeCtx), 0);
  const totalBiz = overdueBiz.reduce((s, b) => s + calcBusinessFee(b, feeCatalog, feeCtx), 0);
  const total = totalRes + totalBiz;

  return (
    <>
      <div className="dt-muted" style={{ marginBottom: 14 }}>Нийт хугацаа хэтэрсэн: {(overdueRes.length + overdueBiz.length)} · Нийт өр: {total.toLocaleString()}₮</div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Тоот/ААН</th><th>Төрөл</th><th>Нэр</th><th>Утас</th><th className="ta-right">Хураамж</th><th className="ta-right">Торгууль</th><th className="ta-right">Нийт</th></tr></thead>
          <tbody>
            {overdueRes.map((r) => {
              const fee = calcFee(r, feeCatalog, feeCtx);
              const penalty = Math.round(fee * (feeSettings.penalty || 0) / 100);
              return (
                <tr key={'r' + r.id}>
                  <td className="dt-title">{r.apt}</td><td className="dt-muted">Сууц</td><td className="dt-text">{`${r.firstname || ''} ${r.lastname || ''}`.trim()}</td>
                  <td className="dt-mono">{r.phones?.[0] || '—'}</td>
                  <td className="dt-mono ta-right">{fee.toLocaleString()}</td>
                  <td className="dt-mono ta-right" style={{ color: 'var(--warning)' }}>{penalty.toLocaleString()}</td>
                  <td className="dt-mono ta-right" style={{ color: 'var(--danger)', fontWeight: 700 }}>{(fee + penalty).toLocaleString()}</td>
                </tr>
              );
            })}
            {overdueBiz.map((b) => {
              const fee = calcBusinessFee(b, feeCatalog, feeCtx);
              const penalty = Math.round(fee * (rentSettings.penalty || 0) / 100);
              return (
                <tr key={'b' + b.id}>
                  <td className="dt-title">{b.name}</td><td className="dt-muted">ААН</td><td className="dt-text">{b.name}</td>
                  <td className="dt-mono">{b.mobile || b.phone || '—'}</td>
                  <td className="dt-mono ta-right">{fee.toLocaleString()}</td>
                  <td className="dt-mono ta-right" style={{ color: 'var(--warning)' }}>{penalty.toLocaleString()}</td>
                  <td className="dt-mono ta-right" style={{ color: 'var(--danger)', fontWeight: 700 }}>{(fee + penalty).toLocaleString()}</td>
                </tr>
              );
            })}
            {!overdueRes.length && !overdueBiz.length && <tr><td colSpan={7} className="empty-state">Өр авлагагүй — бүгд төлсөн байна ✓</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// suh.html-ийн generateReport('balance') (мөр ~5710) — тухайн сарын эцэст
// Дансны үлдэгдлийн тайлан (getTrialBalance-г toDate-тэй дуудна).
function BalanceReport({ journalEntries, year, month }) {
  const end = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const tb = useMemo(() => getTrialBalance(journalEntries, { toDate: end }), [journalEntries, end]);

  return (
    <>
      <div className="dt-muted" style={{ marginBottom: 10 }}>{tb.balanced ? <span className="status-ok">✓ Дт = Кт тохирч байна</span> : <span style={{ color: 'var(--danger)' }}>✗ Зөрүүтэй байна</span>}</div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Код</th><th>Дансны нэр</th><th>Ангилал</th><th className="ta-right">Дт</th><th className="ta-right">Кт</th></tr></thead>
          <tbody>
            {tb.rows.map((r) => (
              <tr key={r.code}>
                <td className="dt-mono">{r.code}</td><td className="dt-title">{r.name}</td>
                <td className="dt-muted">{ACCOUNT_CATEGORIES[r.category]?.label || r.category}</td>
                <td className="dt-mono ta-right">{r.debit ? r.debit.toLocaleString() : '—'}</td>
                <td className="dt-mono ta-right">{r.credit ? r.credit.toLocaleString() : '—'}</td>
              </tr>
            ))}
            {!tb.rows.length && <tr><td colSpan={5} className="empty-state">Мэдээлэл алга</td></tr>}
            <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
              <td colSpan={3}>НИЙТ</td><td className="dt-mono ta-right">{tb.totalDebit.toLocaleString()}</td><td className="dt-mono ta-right">{tb.totalCredit.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// suh.html-ийн generateReport('trend') (мөр ~5721) — жилийн 12 сарын харьцуулалт.
function TrendReport({ transactions, year }) {
  const rows = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const inc = transactions.filter((t) => t && t.type === 'income' && t.month === m && t.year === year).reduce((s, t) => s + t.amount, 0);
    const exp = transactions.filter((t) => t && t.type === 'expense' && t.month === m && t.year === year).reduce((s, t) => s + t.amount, 0);
    return { m, inc, exp };
  });
  const totalInc = rows.reduce((s, r) => s + r.inc, 0);
  const totalExp = rows.reduce((s, r) => s + r.exp, 0);

  return (
    <>
      <div className="dt-muted" style={{ marginBottom: 10 }}>
        Жилийн нийт орлого: {totalInc.toLocaleString()}₮ · Зарлага: {totalExp.toLocaleString()}₮ · Цэвэр: {(totalInc - totalExp).toLocaleString()}₮
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Сар</th><th className="ta-right">Орлого</th><th className="ta-right">Зарлага</th><th className="ta-right">Цэвэр</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.m}>
                <td className="dt-title">{r.m}-р сар</td>
                <td className="dt-mono ta-right" style={{ color: 'var(--success)' }}>{r.inc.toLocaleString()}</td>
                <td className="dt-mono ta-right" style={{ color: 'var(--danger)' }}>{r.exp.toLocaleString()}</td>
                <td className="dt-mono ta-right" style={{ color: r.inc - r.exp >= 0 ? 'var(--success)' : 'var(--danger)' }}>{(r.inc - r.exp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// suh.html-ийн generateReport('aging') (мөр ~5738) — 1-29/30-89/90+ хоногийн
// насжилтын саваа (он/сар шүүлтүүргүй, одоогийн өдрөөр).
function AgingReport({ residents, businesses, transactions, feeCatalog, feeCtx }) {
  const buckets = useMemo(() => {
    const b = { b1: [], b23: [], b3plus: [] };
    residents.filter((r) => !r.isVirtual).forEach((r) => {
      const mu = daysUnpaidForResident(r, transactions);
      if (mu >= 1 && mu < 30) b.b1.push({ x: r, mu, kind: 'resident' });
      else if (mu >= 30 && mu < 90) b.b23.push({ x: r, mu, kind: 'resident' });
      else if (mu >= 90) b.b3plus.push({ x: r, mu, kind: 'resident' });
    });
    businesses.forEach((biz) => {
      const mu = daysUnpaidForBusiness(biz, transactions);
      if (mu >= 1 && mu < 30) b.b1.push({ x: biz, mu, kind: 'business' });
      else if (mu >= 30 && mu < 90) b.b23.push({ x: biz, mu, kind: 'business' });
      else if (mu >= 90) b.b3plus.push({ x: biz, mu, kind: 'business' });
    });
    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residents, businesses, transactions]);

  function feeOf(item) { return item.kind === 'resident' ? calcFee(item.x, feeCatalog, feeCtx) : calcBusinessFee(item.x, feeCatalog, feeCtx); }
  function totalDebt(list) { return list.reduce((s, item) => s + feeOf(item), 0); }
  function rowsFor(list) {
    return list.map((item, i) => {
      const label = item.kind === 'resident' ? String(item.x.apt) : item.x.name;
      const name = item.kind === 'resident' ? `${item.x.firstname || ''} ${item.x.lastname || ''}`.trim() : '—';
      return (
        <tr key={item.kind + i}>
          <td className="dt-title">{label}</td><td className="dt-text">{name}</td>
          <td className="dt-muted">{item.kind === 'resident' ? 'Сууц өмчлөгч' : 'ААН'}</td>
          <td className="dt-text">{item.mu} хоног</td>
          <td className="dt-mono ta-right">{feeOf(item).toLocaleString()}</td>
        </tr>
      );
    });
  }

  return (
    <>
      <div className="dt-muted" style={{ marginBottom: 10 }}>
        1-29 хоног ({buckets.b1.length}): {totalDebt(buckets.b1).toLocaleString()}₮ · 30-89 хоног ({buckets.b23.length}): {totalDebt(buckets.b23).toLocaleString()}₮ · 90+ хоног ({buckets.b3plus.length}): {totalDebt(buckets.b3plus).toLocaleString()}₮
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Тоот/ААН</th><th>Нэр</th><th>Төрөл</th><th>Хугацаа</th><th className="ta-right">Хураамж</th></tr></thead>
          <tbody>
            {rowsFor(buckets.b1)}{rowsFor(buckets.b23)}{rowsFor(buckets.b3plus)}
            {!buckets.b1.length && !buckets.b23.length && !buckets.b3plus.length && <tr><td colSpan={5} className="empty-state">Өр авлагагүй</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// suh.html-ийн generateReport('tx_detail') (мөр ~5657) — тухайн сарын БҮХ
// (орлого+зарлага) гүйлгээний дэлгэрэнгүй.
function TxDetailReport({ residents, businesses, transactions, year, month }) {
  const monthTx = useMemo(
    () => transactions.filter((t) => t && t.month === month && t.year === year)
      .sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0)),
    [transactions, month, year]
  );
  const totalIncome = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <div className="dt-muted" style={{ marginBottom: 10 }}>
        Нийт орлого: {totalIncome.toLocaleString()}₮ · Нийт зарлага: {totalExpense.toLocaleString()}₮ · Цэвэр урсгал: {(totalIncome - totalExpense).toLocaleString()}₮
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Хугацаа</th><th>Төрөл</th><th>Тоот/Нэр</th><th>Тайлбар</th><th className="ta-right">Дүн</th><th>Хэлбэр</th></tr></thead>
          <tbody>
            {monthTx.map((t, i) => {
              let lbl;
              if (t.category === 'business' && t.businessId) {
                const b = businesses.find((x) => x.id === t.businessId);
                lbl = b ? b.name : '—';
              } else {
                const r = residents.find((x) => String(x.apt) === String(t.apt));
                lbl = r ? String(r.apt) : String(t.apt || '—');
              }
              const desc = t.type === 'expense' ? (EXPENSE_CAT_NAMES[t.category] || 'Бусад') : (t.desc || '');
              return (
                <tr key={i}>
                  <td className="dt-mono">{t.date}</td>
                  <td>{t.type === 'income' ? <span className="status-ok">Орлого</span> : <span style={{ color: 'var(--danger)' }}>Зарлага</span>}</td>
                  <td className="dt-title">{lbl}</td><td className="dt-text">{desc}</td>
                  <td className="dt-mono ta-right" style={{ color: t.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>{t.amount.toLocaleString()}</td>
                  <td className="dt-muted">{t.method}</td>
                </tr>
              );
            })}
            {!monthTx.length && <tr><td colSpan={6} className="empty-state">Энэ сард гүйлгээ бүртгэгдээгүй</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// suh.html-ийн generateReport('statement') (мөр ~5772) — тоот/ААН хайж,
// түүний бүх төлбөрийн түүхийг харуулна.
function StatementReport({ residents, businesses, transactions }) {
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState(null); // {type:'resident'|'business', id}

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const resMatches = residents.filter((r) => !r.isVirtual && (String(r.apt).includes(q) || `${r.firstname} ${r.lastname}`.toLowerCase().includes(q)))
      .slice(0, 5).map((r) => ({ type: 'resident', id: r.id, label: `${r.apt} — ${r.firstname} ${r.lastname}` }));
    const bizMatches = businesses.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 5).map((b) => ({ type: 'business', id: b.id, label: b.name }));
    return [...resMatches, ...bizMatches];
  }, [query, residents, businesses]);

  let targetLabel = '', tx = [];
  if (target) {
    if (target.type === 'resident') {
      const r = residents.find((x) => x.id === target.id);
      targetLabel = r ? `${r.apt} — ${r.firstname || ''} ${r.lastname || ''}`.trim() : '—';
      tx = transactions.filter((t) => t && r && String(t.apt) === String(r.apt) && t.category === 'resident');
    } else {
      const b = businesses.find((x) => x.id === target.id);
      targetLabel = b ? b.name : '—';
      tx = transactions.filter((t) => t && t.businessId === target.id);
    }
    tx = tx.slice().sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
  }
  const total = tx.reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <div style={{ position: 'relative', marginBottom: 18, maxWidth: 320 }}>
        <input placeholder="Тоот эсвэл нэрээр хайх..." value={query} onChange={(e) => { setQuery(e.target.value); setTarget(null); }}
          style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '7px 10px', color: 'var(--text)', fontSize: 13 }} />
        {suggestions.length > 0 && !target && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
            {suggestions.map((s) => (
              <div key={s.type + s.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => { setTarget(s); setQuery(s.label); }}>{s.label}</div>
            ))}
          </div>
        )}
      </div>
      {!target ? (
        <div className="empty-state">Дээрх хайлтын нүднээс тоот эсвэл ААН сонгоно уу</div>
      ) : (
        <>
          <div className="dt-muted" style={{ marginBottom: 14 }}>{targetLabel} — Нийт төлсөн дүн: <strong style={{ color: 'var(--success)' }}>{total.toLocaleString()}₮</strong></div>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Огноо</th><th className="ta-right">Дүн</th><th>Хэлбэр</th></tr></thead>
              <tbody>
                {tx.map((t, i) => (
                  <tr key={i}><td className="dt-mono">{t.date}</td><td className="dt-mono ta-right" style={{ color: 'var(--success)' }}>{t.amount.toLocaleString()}</td><td className="dt-muted">{t.method}</td></tr>
                ))}
                {!tx.length && <tr><td colSpan={3} className="empty-state">Гүйлгээ алга</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

// suh.html-ийн generateReport('payroll_summary') (мөр ~5794) — journal_entries
// дэх payroll:employee:%:{yearMonth} reference-ийг шүүж, ажилтан тус бүрийн
// нийт зардлыг (Дт нийлбэр) нэгтгэнэ.
function PayrollSummaryReport({ employees, journalEntries, year, month }) {
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const rows = useMemo(() => {
    const byEmployee = {};
    journalEntries
      .filter((e) => e.reference && e.reference.startsWith('payroll:employee:') && e.reference.endsWith(':' + yearMonth))
      .forEach((entry) => {
        entry.lines.forEach((l) => {
          const m = /^employee:(\d+)$/.exec(l.party || '');
          if (!m) return;
          const dbId = +m[1];
          byEmployee[dbId] = (byEmployee[dbId] || 0) + (l.debit || 0);
        });
      });
    return employees.filter((e) => byEmployee[e.dbId] != null).map((e) => ({ name: employeeDisplayName(e), position: e.position, total: byEmployee[e.dbId] }));
  }, [employees, journalEntries, yearMonth]);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return (
    <>
      <div className="dt-muted" style={{ marginBottom: 14 }}>Нийт цалингийн зардал: <strong>{grandTotal.toLocaleString()}₮</strong></div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Ажилтан</th><th>Албан тушаал</th><th className="ta-right">Нийт зардал</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}><td className="dt-title">{r.name}</td><td className="dt-muted">{r.position || '—'}</td><td className="dt-mono ta-right">{r.total.toLocaleString()}</td></tr>
            ))}
            {!rows.length && <tr><td colSpan={3} className="empty-state">Энэ сарын цалин батлагдаагүй</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// suh.html-ийн generateReport('depreciation_summary') (мөр ~5808) — accumulatedDepreciationAtMonths()
// (2026-08-06 зөвшөөрлөөр портлогдсон) ашиглан тухайн сарын эцсийн элэгдлийг тооцно.
function DepreciationSummaryReport({ assets, year, month }) {
  const end = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const rows = useMemo(() => assets.filter((a) => a.purchaseDate && a.usefulLife).map((a) => {
    const monthsElapsed = monthsBetweenDates(a.purchaseDate, end);
    const accumulated = accumulatedDepreciationAtMonths(a, monthsElapsed);
    const bookValue = Math.max(a.cost - accumulated, a.salvage || 0);
    return { name: a.name, cost: a.cost, accumulated, bookValue };
  }), [assets, end]);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalAcc = rows.reduce((s, r) => s + r.accumulated, 0);
  const totalBook = rows.reduce((s, r) => s + r.bookValue, 0);

  return (
    <>
      <div className="dt-muted" style={{ marginBottom: 14 }}>
        Худалдан авсан үнэ: {totalCost.toLocaleString()}₮ · Хуримтлагдсан элэгдэл: {totalAcc.toLocaleString()}₮ · Үлдэгдэл өртөг: {totalBook.toLocaleString()}₮
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Хөрөнгө</th><th className="ta-right">Худалдан авсан үнэ</th><th className="ta-right">Хуримтлагдсан элэгдэл</th><th className="ta-right">Үлдэгдэл өртөг</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="dt-title">{r.name}</td>
                <td className="dt-mono ta-right">{r.cost.toLocaleString()}</td>
                <td className="dt-mono ta-right" style={{ color: 'var(--warning)' }}>{Math.round(r.accumulated).toLocaleString()}</td>
                <td className="dt-mono ta-right" style={{ color: 'var(--success)' }}>{Math.round(r.bookValue).toLocaleString()}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="empty-state">Элэгдэл тооцох хөрөнгө алга</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
