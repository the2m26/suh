import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';

const MV_COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899'];

function BarChart({ incomeArr, expenseArr, width = 340, height = 70 }) {
  const max = Math.max(...incomeArr, ...expenseArr, 1);
  const n = incomeArr.length, gap = 3, groupW = width / n, barW = (groupW - gap * 3) / 2;
  const bars = [];
  for (let i = 0; i < n; i++) {
    const x0 = i * groupW + gap;
    const hI = (incomeArr[i] / max) * (height - 14), hE = (expenseArr[i] / max) * (height - 14);
    bars.push(<rect key={`i${i}`} x={x0} y={height - hI} width={barW} height={hI} rx={1.5} fill="var(--success)" />);
    bars.push(<rect key={`e${i}`} x={x0 + barW + gap} y={height - hE} width={barW} height={hE} rx={1.5} fill="var(--danger)" />);
  }
  return <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>{bars}</svg>;
}

function MultiSparkline({ series, width = 350, height = 140 }) {
  const allVals = series.flatMap(s => s.values);
  if (!allVals.length) return null;
  const max = Math.max(...allVals, 1), min = Math.min(...allVals, 0);
  const range = (max - min) || 1;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {series.map((s, si) => {
        const step = width / Math.max(s.values.length - 1, 1);
        const pts = s.values.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`).join(' ');
        return <polyline key={si} points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </svg>
  );
}

// ⚠️ userapp.html-ийн renderMobileDashboard()-той ЯГ ИЖИЛ RPC дуудлага —
// backend талд ЯМАР Ч өөрчлөлт хийгээгүй, зөвхөн frontend React болов.
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [mvRows, setMvRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const curYear = now.getFullYear(), curMonth = now.getMonth() + 1;
    Promise.all([
      sb.rpc('get_dashboard_data', { p_year: curYear, p_month: curMonth }),
      sb.from('market_valuations').select('*').order('year', { ascending: true }).order('month', { ascending: true }).limit(24),
    ]).then(([dashRes, mvRes]) => {
      setData(dashRes.data || {});
      setMvRows(mvRes.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="pool-empty">Ачаалж байна...</div>;

  const billed = +(data.billed?.total) || 0;
  const income = +(data.income?.total) || 0;
  const debt = +(data.debt?.total) || 0;
  const residents = +(data.demographics?.total_people) || 0;
  const incomeByMonth = (data.income_by_month || Array(12).fill(0)).map(Number);
  const expenseByMonth = (data.expense_by_month || Array(12).fill(0)).map(Number);
  const curYear = new Date().getFullYear();

  const mvCards = [
    { title: 'Орон сууц (₮/м²)', fields: ['apartment_sale'], labels: ['Орон сууц'] },
    { title: 'Түрээс, 1-6 өрөө (₮/сар)', fields: ['rent_1room','rent_2room','rent_3room','rent_4room','rent_5room','rent_6room'], labels: ['1 өрөө','2 өрөө','3 өрөө','4 өрөө','5 өрөө','6 өрөө'] },
    { title: 'Агуулах, Зогсоол — Борлуулалт (₮)', fields: ['storage_sale','parking_sale'], labels: ['Агуулах','Зогсоол'] },
    { title: 'Агуулах, Зогсоол — Түрээс (₮/сар)', fields: ['storage_rent','parking_rent'], labels: ['Агуулах','Зогсоол'] },
  ];

  return (
    <div className="dashboard">
      <div className="mobile-stat-grid">
        <div className="mobile-stat-card"><div className="mobile-stat-value" style={{ color: 'var(--accent)' }}>{billed.toLocaleString()}₮</div><div className="mobile-stat-label">Энэ сард нэхэмжилсэн</div></div>
        <div className="mobile-stat-card"><div className="mobile-stat-value" style={{ color: 'var(--success)' }}>{income.toLocaleString()}₮</div><div className="mobile-stat-label">Энэ сарын орлого</div></div>
        <div className="mobile-stat-card"><div className="mobile-stat-value" style={{ color: debt > 0 ? 'var(--danger)' : 'var(--ink)' }}>{debt.toLocaleString()}₮</div><div className="mobile-stat-label">Нийт өр авлага</div></div>
        <div className="mobile-stat-card"><div className="mobile-stat-value">{residents.toLocaleString()}</div><div className="mobile-stat-label">Нийт оршин суугчид</div></div>
      </div>

      <div className="mobile-list-item" style={{ marginTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{curYear} оны орлого / зарлага</div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--success)', display: 'inline-block' }} />Орлого</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--danger)', display: 'inline-block' }} />Зарлага</span>
        </div>
        <BarChart incomeArr={incomeByMonth} expenseArr={expenseByMonth} />
      </div>

      {mvRows.length > 0 && (
        <>
          <div className="section-title">Хотхоны зах зээлийн чиг хандлага (Сүүлийн 12 сар)</div>
          {mvCards.map((c, ci) => {
            const series = c.fields.map((f, i) => ({ values: mvRows.map(r => +r[f] || 0), color: MV_COLORS[i] }));
            return (
              <div className="mobile-list-item" key={ci} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{c.title}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {c.fields.map((f, i) => {
                    const lastVal = series[i].values[series[i].values.length - 1] || 0;
                    return (
                      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-secondary)' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: MV_COLORS[i], display: 'inline-block' }} />
                        {c.labels[i]}: <b style={{ color: '#fff' }}>{lastVal.toLocaleString()}₮</b>
                      </span>
                    );
                  })}
                </div>
                <MultiSparkline series={series} />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
