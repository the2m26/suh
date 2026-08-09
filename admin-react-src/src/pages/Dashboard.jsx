import { useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabase';
import {
  calcFee, calcBusinessFee, daysUnpaidForResident, daysUnpaidForBusiness,
  getUnpaidMonths,
} from '../lib/financeEngine';
import { getSpotSqm } from '../lib/parkingStorageHelpers';
import { assetLifeProgressPct, assetLifeProgressColor } from '../lib/assetHelpers';
import { MV_COLORS, mvLastValue } from '../lib/marketValuationHelpers';
import Sparkline from '../components/Sparkline';

export default function Dashboard() {
  const now = new Date();
  const curMonth = now.getMonth() + 1, curYear = now.getFullYear();

  const [residents, setResidents] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [feeCatalog, setFeeCatalog] = useState([]);
  const [parkingTypes, setParkingTypes] = useState([]);
  const [storageTypes, setStorageTypes] = useState([]);
  const [feeSettings, setFeeSettings] = useState({ overdueDays: 35, riskDays: 365 });
  const [rentSettings, setRentSettings] = useState({ overdueDays: 35, riskDays: 365 });
  const [assets, setAssets] = useState([]);
  const [mvRows, setMvRows] = useState([]);
  const [progressMode, setProgressMode] = useState('month');
  const [overdueSort, setOverdueSort] = useState('amount');
  const [chartYear, setChartYear] = useState(curYear);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: res }, { data: biz }, { data: tx }, { data: fc }, { data: pt }, { data: st }, { data: settingsRows }, { data: fa }, { data: mv }] = await Promise.all([
        sb.from('residents').select('*'),
        sb.from('businesses').select('*'),
        sb.from('transactions').select('*'),
        sb.from('fee_catalog').select('*'),
        sb.from('parking_types').select('*'),
        sb.from('storage_types').select('*'),
        sb.from('settings').select('*'),
        sb.from('fixed_assets').select('*'),
        sb.from('market_valuations').select('*').order('year').order('month'),
      ]);
      setResidents((res || []).map((r) => ({
        id: r.id, apt: r.apt, isVirtual: r.is_virtual || false, firstname: r.firstname, lastname: r.lastname,
        ownDate: r.own_date, phones: r.phones || [], people: r.is_virtual ? 0 : (r.people || 0),
        child1: r.child1 || 0, child2: r.child2 || 0, parkings: r.parkings || [], storages: r.storages || [],
      })));
      setBusinesses((biz || []).map((b) => ({
        id: b.id, name: b.name, type: b.type, area: +b.area || 0, start: b.contract_start,
        monthlyFee: +b.monthly_fee || 0, mobile: b.mobile, phone: b.phone, parkings: b.parkings || [], storages: b.storages || [],
      })));
      setTransactions(tx || []);
      setFeeCatalog(fc || []);
      setParkingTypes(pt || []);
      setStorageTypes(st || []);
      (settingsRows || []).forEach((s) => {
        if (s.key === 'fee') setFeeSettings((f) => ({ ...f, ...s.value }));
        if (s.key === 'rent') setRentSettings((r) => ({ ...r, ...s.value }));
      });
      setAssets((fa || []).map((a) => ({
        id: a.id, name: a.name, cost: +a.original_cost || 0, purchaseDate: a.purchase_date, usefulLife: a.useful_life_months,
        status: a.status,
      })));
      setMvRows(mv || []);
      setLoading(false);
    })();
  }, []);

  const feeCtx = { getSpotSqm: (kind, label) => getSpotSqm(kind, label, parkingTypes, storageTypes) };

  const monthTx = useMemo(() => transactions.filter((t) => t && t.type === 'income' && t.month === curMonth && t.year === curYear), [transactions, curMonth, curYear]);

  const resBilled = useMemo(() => residents.filter((r) => !r.isVirtual).reduce((s, r) => s + calcFee(r, feeCatalog, feeCtx), 0), [residents, feeCatalog]);
  const bizBilled = useMemo(() => businesses.reduce((s, b) => s + b.monthlyFee, 0), [businesses]);
  const totalBilled = resBilled + bizBilled;

  const paidResApts = new Set(monthTx.filter((t) => t.category === 'resident' && t.apt != null).map((t) => String(t.apt)));
  const paidBizIds = new Set(monthTx.filter((t) => t.category === 'business' && t.businessId).map((t) => t.businessId));
  const resIncome = monthTx.filter((t) => t.category === 'resident').reduce((s, t) => s + t.amount, 0);
  const bizIncome = monthTx.filter((t) => t.category === 'business').reduce((s, t) => s + t.amount, 0);
  const totalIncome = resIncome + bizIncome;
  const totalRes = residents.filter((r) => !r.isVirtual).length;
  const totalBiz = businesses.length;

  const resDebtInfo = useMemo(() => residents.filter((r) => !r.isVirtual).map((r) => {
    const missing = getUnpaidMonths(r, 'resident', 'ownDate', transactions, curMonth, curYear);
    const fee = calcFee(r, feeCatalog, feeCtx);
    return { type: 'resident', label: String(r.apt), name: `${r.firstname || ''} ${r.lastname || ''}`.trim(), monthsUnpaid: missing.length, debtAmount: missing.length * fee };
  }).filter((x) => x.monthsUnpaid > 0), [residents, transactions, feeCatalog, curMonth, curYear]);

  const bizDebtInfo = useMemo(() => businesses.filter((b) => b.monthlyFee > 0).map((b) => {
    const missing = getUnpaidMonths(b, 'business', 'start', transactions, curMonth, curYear);
    return { type: 'business', label: b.name, name: b.name, monthsUnpaid: missing.length, debtAmount: missing.length * b.monthlyFee };
  }).filter((x) => x.monthsUnpaid > 0), [businesses, transactions, curMonth, curYear]);

  const totalDebtAmt = resDebtInfo.reduce((s, x) => s + x.debtAmount, 0) + bizDebtInfo.reduce((s, x) => s + x.debtAmount, 0);
  const billableBizCount = businesses.filter((b) => b.monthlyFee > 0).length;

  const totalPeople = residents.reduce((s, r) => s + r.people, 0);
  const totalChild1 = residents.reduce((s, r) => s + r.child1, 0);
  const totalChild2 = residents.reduce((s, r) => s + r.child2, 0);

  const breakdown = useMemo(() => {
    let pending = 0, overdue = 0, risk = 0;
    residents.forEach((r) => {
      if (r.isVirtual) return;
      if (progressMode === 'month' && paidResApts.has(String(r.apt))) return;
      const mu = daysUnpaidForResident(r, transactions);
      if (mu >= (feeSettings.riskDays || 365)) risk++;
      else if (mu >= (feeSettings.overdueDays || 35)) overdue++;
      else if (mu >= 1) pending++;
    });
    businesses.filter((b) => b.monthlyFee > 0).forEach((b) => {
      if (progressMode === 'month' && paidBizIds.has(b.id)) return;
      const mu = daysUnpaidForBusiness(b, transactions);
      if (mu >= (rentSettings.riskDays || 365)) risk++;
      else if (mu >= (rentSettings.overdueDays || 35)) overdue++;
      else if (mu >= 1) pending++;
    });
    return { pending, overdue, risk };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residents, businesses, transactions, progressMode, feeSettings, rentSettings]);

  const totalEntities = totalRes + totalBiz;
  const unpaidTotal = breakdown.pending + breakdown.overdue + breakdown.risk;
  const paidCount = totalEntities - unpaidTotal;
  const progressPct = totalEntities > 0 ? Math.round((paidCount / totalEntities) * 100) : 0;

  let progressLabel, ratioLabel, ratioPct;
  if (progressMode === 'total') {
    progressLabel = 'Нийт төлбөрийн явц';
    const cumulativeBilled = resBilled * curMonth + businesses.filter((b) => b.monthlyFee > 0).reduce((s, b) => s + b.monthlyFee, 0) * curMonth;
    const cumulativeCollected = transactions.filter((t) => t && t.type === 'income' && (t.category === 'resident' || t.category === 'business')).reduce((s, t) => s + t.amount, 0);
    ratioLabel = 'Нийт өр авлагын харьцаа';
    ratioPct = cumulativeBilled > 0 ? Math.round((cumulativeCollected / cumulativeBilled) * 100) : 0;
  } else {
    progressLabel = 'Энэ сарын төлбөрийн явц';
    ratioLabel = 'Энэ сарын өр авлагын харьцаа';
    ratioPct = totalBilled > 0 ? Math.round((totalIncome / totalBilled) * 100) : 0;
  }

  const recentTx = useMemo(() => transactions.filter((t) => t.type === 'income')
    .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6), [transactions]);

  const overdueCombined = useMemo(() => {
    const combined = [...resDebtInfo, ...bizDebtInfo];
    combined.sort((a, b) => overdueSort === 'months' ? (b.monthsUnpaid - a.monthsUnpaid) : (b.debtAmount - a.debtAmount));
    return combined.slice(0, 6);
  }, [resDebtInfo, bizDebtInfo, overdueSort]);

  const chartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const incomes = months.map((m) => transactions.filter((t) => t && t.type === 'income' && t.month === m && t.year === chartYear).reduce((s, t) => s + t.amount, 0));
    const expenses = months.map((m) => transactions.filter((t) => t && t.type === 'expense' && t.month === m && t.year === chartYear).reduce((s, t) => s + t.amount, 0));
    const maxVal = Math.max(...incomes, ...expenses, 1);
    return { months, incomes, expenses, maxVal };
  }, [transactions, chartYear]);

  const riskyAssets = useMemo(() => assets.filter((a) => a.status !== 'disposed')
    .map((a) => ({ ...a, pct: assetLifeProgressPct(a) }))
    .sort((a, b) => b.pct - a.pct).slice(0, 5), [assets]);

  const chartYears = [...new Set(transactions.filter((t) => t.year).map((t) => t.year))].sort((a, b) => b - a);
  if (!chartYears.includes(curYear)) chartYears.unshift(curYear);

  function methodName(m) {
    return { cash: 'Бэлэн', bank: 'Шилжүүлэг', qpay: 'QPay' }[m] || m || '—';
  }
  function fmtDateSlash(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
  }

  const recentMv = mvRows.slice(-12);

  if (loading) return <div className="page"><div className="empty-state">Ачаалж байна...</div></div>;

  return (
    <div className="page page-wide">
      <div className="dash-stats-grid">
        <div className="dash-stat-card">
          <div className="dash-stat-label">Энэ сард нэхэмжилсэн</div>
          <div className="dash-stat-value" style={{ color: 'var(--accent)' }}>{Math.round(totalBilled).toLocaleString()}₮</div>
          <div className="dash-stat-detail">Сууц өмчлөгч · {Math.round(resBilled).toLocaleString()}₮<br />Аж ахуйн нэгж · {Math.round(bizBilled).toLocaleString()}₮</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">Энэ сарын орлого</div>
          <div className="dash-stat-value" style={{ color: 'var(--success)' }}>{Math.round(totalIncome).toLocaleString()}₮</div>
          <div className="dash-stat-detail" style={{ color: 'var(--success)' }}>Сууц өмчлөгч · {paidResApts.size}/{totalRes}<br />Аж ахуйн нэгж · {paidBizIds.size}/{totalBiz}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">Нийт өр авлага</div>
          <div className="dash-stat-value" style={{ color: 'var(--danger)' }}>{Math.round(totalDebtAmt).toLocaleString()}₮</div>
          <div className="dash-stat-detail">Сууц өмчлөгч · {resDebtInfo.length}/{totalRes}<br />Аж ахуйн нэгж · {bizDebtInfo.length}/{billableBizCount}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">Нийт оршин суугчид</div>
          <div className="dash-stat-value">{totalPeople.toLocaleString()}</div>
          <div className="dash-stat-detail">0-6 насны хүүхэд · {totalChild1}<br />6-18 насны хүүхэд · {totalChild2}</div>
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="card dash-card">
          <div className="dash-card-header">
            <span className="dash-card-title">Сарын орлого / зарлага</span>
            <select value={chartYear} onChange={(e) => setChartYear(+e.target.value)}>
              {chartYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 11 }}>
            <span style={{ color: 'var(--success)' }}>■ Орлого</span>
            <span style={{ color: 'var(--accent)' }}>■ Зарлага</span>
          </div>
          <div className="dash-chart-bars">
            {chartData.months.map((m, i) => (
              <div key={m} className="dash-chart-bar-wrap">
                <div className="dash-chart-bar-row">
                  <div className="dash-chart-bar income" style={{ height: `${(chartData.incomes[i] / chartData.maxVal) * 100}%` }} title={chartData.incomes[i].toLocaleString()} />
                  <div className="dash-chart-bar expense" style={{ height: `${(chartData.expenses[i] / chartData.maxVal) * 100}%` }} title={chartData.expenses[i].toLocaleString()} />
                </div>
                <div className="dash-chart-label">{m}-р</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card dash-card">
          <div className="dash-card-header">
            <span className="dash-card-title">Төлбөрийн явц</span>
            <select value={progressMode} onChange={(e) => setProgressMode(e.target.value)}>
              <option value="month">Энэ сар</option>
              <option value="total">Нийт</option>
            </select>
          </div>
          <div className="summary-row-list">
            <div className="page-header-row"><span className="dt-muted">Нийт төлбөр төлөгч тоо</span><span>{totalEntities}</span></div>
            <div className="page-header-row"><span className="dt-muted">Төлбөрөө төлсөн</span><span style={{ color: 'var(--success)' }}>{paidCount}</span></div>
            <div className="page-header-row"><span className="dt-muted">Хүлээлттэй</span><span style={{ color: 'var(--warning)' }}>{breakdown.pending}</span></div>
            <div className="page-header-row"><span className="dt-muted">Хугацаа хэтэрсэн</span><span style={{ color: 'var(--danger)' }}>{breakdown.overdue}</span></div>
            <div className="page-header-row"><span className="dt-muted">Эрсдэлтэй</span><span style={{ color: 'var(--danger)' }}>{breakdown.risk}</span></div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="dash-progress-label"><span>{progressLabel}</span><span>{progressPct}%</span></div>
            <div className="progress-wrap"><div className="progress-bar" style={{ width: `${progressPct}%`, background: 'var(--success)' }} /></div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="dash-progress-label"><span>{ratioLabel}</span><span>{ratioPct}%</span></div>
            <div className="progress-wrap"><div className="progress-bar" style={{ width: `${ratioPct}%`, background: 'var(--danger)' }} /></div>
          </div>
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="card dash-card">
          <div className="dash-card-header"><span className="dash-card-title">Сүүлийн гүйлгээ</span></div>
          <table className="data-table">
            <thead><tr><th>ТООТ/НЭР</th><th>Дүн</th><th>Хэлбэр</th><th>Огноо</th></tr></thead>
            <tbody>
              {recentTx.map((t, i) => {
                let lbl;
                if (t.category === 'business' && t.businessId) {
                  const b = businesses.find((x) => x.id === t.businessId);
                  lbl = b ? b.name : '—';
                } else {
                  lbl = t.apt != null ? String(t.apt) : '—';
                }
                return (
                  <tr key={i}>
                    <td className="dt-title">{lbl}</td>
                    <td className="dt-mono" style={{ color: 'var(--success)' }}>{t.amount.toLocaleString()}</td>
                    <td className="dt-muted">{methodName(t.method)}</td>
                    <td className="dt-muted">{fmtDateSlash(t.date)}</td>
                  </tr>
                );
              })}
              {!recentTx.length && <tr><td colSpan={4} className="empty-state">Гүйлгээ алга</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card dash-card">
          <div className="dash-card-header">
            <span className="dash-card-title">Төлбөрийн өртэй</span>
            <select value={overdueSort} onChange={(e) => setOverdueSort(e.target.value)}>
              <option value="amount">Дүнгээр</option>
              <option value="months">Сараар</option>
            </select>
          </div>
          <table className="data-table">
            <thead><tr><th>Тоот/Нэр</th><th>Төрөл</th><th>Хугацаа</th><th>Дүн</th></tr></thead>
            <tbody>
              {overdueCombined.map((x, i) => (
                <tr key={i}>
                  <td className="dt-title">{x.label} {x.type === 'resident' && <span className="dt-muted" style={{ fontWeight: 400 }}>{x.name}</span>}</td>
                  <td className="dt-text">{x.type === 'resident' ? 'Сууц өмчлөгч' : 'Аж ахуйн нэгж'}</td>
                  <td style={{ color: 'var(--danger)' }}>{x.monthsUnpaid} сар</td>
                  <td className="dt-mono" style={{ color: 'var(--danger)' }}>{x.debtAmount.toLocaleString()}</td>
                </tr>
              ))}
              {!overdueCombined.length && <tr><td colSpan={4} className="empty-state">Өр авлагатай тоот, аж ахуйн нэгж байхгүй ✓</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card dash-card" style={{ marginTop: 16 }}>
        <div className="dash-card-header"><span className="dash-card-title">Ашиглалтын хугацаа дуусч буй Үндсэн хөрөнгө</span></div>
        {!riskyAssets.length && <div className="dt-muted" style={{ fontSize: 12 }}>Үндсэн хөрөнгө бүртгэгдээгүй байна</div>}
        {riskyAssets.map((a) => (
          <div key={a.id} style={{ marginBottom: 10 }}>
            <div className="dash-progress-label" style={{ fontSize: 11 }}><span>{a.name}</span><span>{a.pct}%</span></div>
            <div className="progress-wrap"><div className="progress-bar" style={{ width: `${a.pct}%`, background: assetLifeProgressColor(a.pct) }} /></div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="dash-section-title">Хотхоны зах зээлийн бодит үнэлгээ (Сүүлийн 12 сар)</div>
        <div className="dash-grid-2" style={{ gap: 16 }}>
          <MvMiniCard title="Орон сууцны борлуулалтын үнэ (₮/м²)" rows={recentMv} fields={['apartment_sale']} single />
          <MvMiniCard title="Орон сууцны түрээсийн үнэ (1-6 өрөө, ₮/сар)" rows={recentMv} fields={['rent_1room', 'rent_2room', 'rent_3room', 'rent_4room', 'rent_5room', 'rent_6room']} />
          <MvMiniCard title="Агуулах, Зогсоолын борлуулалтын үнэ" rows={recentMv} fields={['storage_sale', 'parking_sale']} />
          <MvMiniCard title="Агуулах, Зогсоолын түрээслэх үнэ" rows={recentMv} fields={['storage_rent', 'parking_rent']} />
        </div>
      </div>
    </div>
  );
}

function MvMiniCard({ title, rows, fields, single }) {
  const seriesArr = fields.map((f, i) => ({ values: rows.map((r) => r[f]), color: MV_COLORS[i] }));
  return (
    <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
      <div className="dt-muted" style={{ fontSize: 12, marginBottom: 6 }}>{title}</div>
      {single ? (
        <div style={{ marginBottom: 8 }}>
          {mvLastValue(rows, fields[0]) != null ? (
            <span style={{ fontSize: 18, fontWeight: 700 }}>{Math.round(mvLastValue(rows, fields[0])).toLocaleString()}₮</span>
          ) : <span className="dt-muted" style={{ fontSize: 12 }}>Дата алга</span>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginBottom: 8 }}>
          {fields.map((f, i) => {
            const v = mvLastValue(rows, f);
            if (v == null) return null;
            return <span key={f} style={{ fontSize: 11 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: MV_COLORS[i], marginRight: 4 }} />{Math.round(v).toLocaleString()}₮</span>;
          })}
        </div>
      )}
      <div style={{ marginTop: 'auto' }}><Sparkline seriesArr={seriesArr} rows={rows} /></div>
    </div>
  );
}
