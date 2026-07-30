import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';

const MV_COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899'];
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

// ⚠️ 2026-07-30: suh.html-ийн market-valuation.js-ийн mvComputeCoords/
// mvSmoothPathFromCoords/mvSparklineSVG-той ЯГ ИЖИЛ Catmull-Rom smooth path
// томъёог React руу шилжүүлэв (v8-д зөвхөн шулуун polyline байсан, зөөлөн
// муруй/tooltip/сарын тэнхлэг бүгд дутуу байсан).
function computeCoords(values, w, h, pad = 4, padTop = 10, padBottom = 4) {
  const pts = [];
  const n = values.length;
  values.forEach((v, i) => { if (v != null && !isNaN(v)) pts.push({ i, v }); });
  if (!pts.length) return [];
  const valid = pts.map(p => p.v);
  const min = Math.min(...valid), max = Math.max(...valid);
  const range = (max - min) || 1;
  return pts.map(p => ({
    i: p.i, v: p.v,
    x: pad + (p.i / Math.max(n - 1, 1)) * (w - 2 * pad),
    y: h - padBottom - ((p.v - min) / range) * (h - padTop - padBottom),
  }));
}
function smoothPath(coords) {
  if (!coords.length) return '';
  if (coords.length === 1) return `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  if (coords.length === 2) return `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)} L${coords[1].x.toFixed(1)},${coords[1].y.toFixed(1)}`;
  let d = `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] || coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

// Зөөлөн муруй + маркер бүрт tooltip + сарын (Jan/Feb/...) тэнхлэг
function MultiSparkline({ series, rows, width = 350, height = 150 }) {
  const [tip, setTip] = useState(null); // { x, y, text }
  const allVals = series.flatMap(s => s.values);
  if (!allVals.length) return null;
  const axisH = 16;
  const chartH = height - axisH;

  function showTip(e, text) {
    const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, text });
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
        <line x1="4" y1={chartH - 2} x2={width - 4} y2={chartH - 2} stroke="var(--border-card)" strokeWidth="1" />
        {series.map((s, si) => {
          const coords = computeCoords(s.values, width, chartH, 4, 10, 4);
          const d = smoothPath(coords);
          return (
            <g key={si}>
              {d && <path d={d} fill="none" stroke={s.color} strokeWidth={0.5} strokeLinecap="round" strokeLinejoin="round" />}
              {coords.map(c => {
                const monthLabel = rows?.[c.i] ? MONTH_ABBR[(rows[c.i].month || 1) - 1] : '';
                const text = `${monthLabel}: ${c.v.toLocaleString()}₮`;
                return (
                  <g key={c.i}>
                    <circle cx={c.x} cy={c.y} r={1.5} fill={s.color} style={{ pointerEvents: 'none' }} />
                    <circle cx={c.x} cy={c.y} r={7} fill="transparent" style={{ cursor: 'pointer' }}
                      onMouseEnter={e => showTip(e, text)} onMouseMove={e => showTip(e, text)} onMouseLeave={() => setTip(null)}
                      onTouchStart={e => showTip(e.touches[0], text)} />
                  </g>
                );
              })}
            </g>
          );
        })}
        {rows && rows.length > 0 && rows.map((r, i) => {
          const n = rows.length;
          const x = 4 + (i / Math.max(n - 1, 1)) * (width - 8);
          return <text key={i} x={x} y={height - 3} fontSize="7" fill="var(--text-secondary)" textAnchor="middle">{MONTH_ABBR[(r.month || 1) - 1]}</text>;
        })}
      </svg>
      {tip && (
        <div style={{
          position: 'absolute', left: Math.min(tip.x + 10, width - 90), top: Math.max(tip.y - 24, 0),
          background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 6,
          padding: '3px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
          pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,.35)', zIndex: 10,
        }}>{tip.text}</div>
      )}
    </div>
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
  const mvLast12 = mvRows.slice(-12);

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
          <div className="section-title">Хотхоны зах зээлийн үнэлгээ (Сүүлийн 12 сараар)</div>
          {mvCards.map((c, ci) => {
            const series = c.fields.map((f, i) => ({ values: mvLast12.map(r => +r[f] || 0), color: MV_COLORS[i] }));
            return (
              <div className="mobile-list-item" key={ci} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{c.title}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {c.fields.map((f, i) => {
                    const lastVal = series[i].values[series[i].values.length - 1] || 0;
                    return (
                      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-secondary)' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: MV_COLORS[i], display: 'inline-block' }} />
                        {c.labels[i]}: <b style={{ color: 'var(--text-primary)' }}>{lastVal.toLocaleString()}₮</b>
                      </span>
                    );
                  })}
                </div>
                <MultiSparkline series={series} rows={mvLast12} />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
