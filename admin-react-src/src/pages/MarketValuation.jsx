import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/dbUtils';
import { MV_COLORS, MV_FIELD_LABELS, MV_DETAIL_CONFIG, mvLastValue, mvChangePct } from '../lib/marketValuationHelpers';
import Sparkline from '../components/Sparkline';

const MV_FIELDS = ['apartment_sale', 'rent_1room', 'rent_2room', 'rent_3room', 'rent_4room', 'rent_5room', 'rent_6room', 'storage_sale', 'storage_rent', 'parking_sale', 'parking_rent'];

export default function MarketValuation() {
  const { currentUser, currentProfile } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailKey, setDetailKey] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = () => {
    setLoading(true);
    sb.from('market_valuations').select('*').order('year').order('month').then(({ data, error }) => {
      if (error) { console.error('market_valuations ачаалах алдаа:', error.message); setLoading(false); return; }
      setRows(data || []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const recentRows = rows.slice(-12);
  const isAdmin = currentProfile?.role === 'admin';

  function ChangeBadge({ field }) {
    const pct = mvChangePct(rows, field);
    if (pct == null) return null;
    const up = pct >= 0;
    return <span style={{ color: up ? 'var(--success)' : 'var(--danger)', fontSize: 11, fontWeight: 600 }}>{up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>;
  }

  function SummaryCard({ cardKey, title, fields, singleValue }) {
    const seriesArr = fields.map((f, i) => ({ values: recentRows.map((r) => r[f]), color: MV_COLORS[i] }));
    return (
      <div className="card mv-card" onClick={() => setDetailKey(cardKey)}>
        <div className="dt-muted" style={{ fontSize: 12, marginBottom: 6 }}>{title}</div>
        {singleValue ? (
          <div style={{ marginBottom: 8 }}>
            {mvLastValue(rows, fields[0]) != null ? (
              <>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{Math.round(mvLastValue(rows, fields[0])).toLocaleString()}₮</span>{' '}
                <ChangeBadge field={fields[0]} />
              </>
            ) : <span className="dt-muted" style={{ fontSize: 12 }}>Дата алга</span>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
            {fields.map((f, i) => {
              const v = mvLastValue(rows, f);
              if (v == null) return null;
              return (
                <span key={f} style={{ fontSize: 11 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: MV_COLORS[i], marginRight: 4 }} />
                  {MV_FIELD_LABELS[f]}: <strong>{Math.round(v).toLocaleString()}₮</strong>
                </span>
              );
            })}
          </div>
        )}
        <Sparkline seriesArr={seriesArr} rows={recentRows} />
      </div>
    );
  }

  if (loading) return <div className="page"><div className="empty-state">Ачаалж байна...</div></div>;

  return (
    <div className="page page-wide">
      <div className="page-header-row">
        {isAdmin && <button className="btn-primary" onClick={() => setEditing(true)}>+ Сарын үнэ оруулах</button>}
      </div>

      <div className="mv-grid">
        <SummaryCard cardKey="apartment" title="Орон сууцны борлуулалт" fields={['apartment_sale']} singleValue />
        <SummaryCard cardKey="rent" title="Түрээс 1-6 өрөө" fields={['rent_1room', 'rent_2room', 'rent_3room', 'rent_4room', 'rent_5room', 'rent_6room']} />
        <SummaryCard cardKey="sale2" title="Агуулах, Зогсоол — борлуулалт" fields={['storage_sale', 'parking_sale']} />
        <SummaryCard cardKey="rent2" title="Агуулах, Зогсоол — түрээс" fields={['storage_rent', 'parking_rent']} />
      </div>

      {detailKey && (
        <DetailPanel detailKey={detailKey} rows={rows} onClose={() => setDetailKey(null)} onEdit={(y, m) => { setEditing({ year: y, month: m }); }} />
      )}

      {editing && (
        <MarketValuationForm
          initial={typeof editing === 'object' ? editing : null}
          rows={rows}
          currentUser={currentUser} currentProfile={currentProfile}
          onClose={() => { setEditing(false); load(); }}
        />
      )}
    </div>
  );
}

function DetailPanel({ detailKey, rows, onClose, onEdit }) {
  const cfg = MV_DETAIL_CONFIG[detailKey];
  const seriesArr = cfg.fields.map((f, i) => ({ values: rows.map((r) => r[f]), color: MV_COLORS[i] }));
  const reversedRows = rows.slice().reverse();

  return (
    <div className="card" style={{ padding: 18, marginTop: 18 }}>
      <div className="page-header-row" style={{ marginBottom: 10 }}>
        <h3 style={{ fontSize: 15 }}>{cfg.title}</h3>
        <button className="btn-ghost" onClick={onClose}>✕</button>
      </div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
        {cfg.fields.map((f, i) => (
          <span key={f} style={{ fontSize: 11 }}>
            <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: MV_COLORS[i], marginRight: 5 }} />
            {cfg.labels[i]}
          </span>
        ))}
      </div>
      <Sparkline seriesArr={seriesArr} rows={rows} aspectW={700} aspectH={200} />
      <div className="table-scroll table-scroll-sticky" style={{ marginTop: 14, maxHeight: 'calc(100vh - 500px)' }}>
        <table className="data-table">
          <thead><tr><th>САР</th>{cfg.labels.map((l) => <th key={l} className="ta-right">{l}</th>)}<th></th></tr></thead>
          <tbody>
            {reversedRows.map((r) => (
              <tr key={r.year + '-' + r.month}>
                <td className="dt-text">{r.year}/{String(r.month).padStart(2, '0')}</td>
                {cfg.fields.map((f) => <td key={f} className="dt-text dt-mono ta-right">{r[f] != null ? Math.round(r[f]).toLocaleString() : '—'}</td>)}
                <td><button className="btn-ghost-sm" onClick={() => onEdit(r.year, r.month)}>✎</button></td>
              </tr>
            ))}
            {!reversedRows.length && <tr><td colSpan={cfg.fields.length + 2} className="empty-state">Дата алга</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MarketValuationForm({ initial, rows, currentUser, currentProfile, onClose }) {
  const now = new Date();
  const [year, setYear] = useState(initial?.year || now.getFullYear());
  const [month, setMonth] = useState(initial?.month || now.getMonth() + 1);
  const existing = rows.find((r) => r.year === year && r.month === month);
  const [values, setValues] = useState(() => {
    const v = {};
    MV_FIELDS.forEach((f) => { v[f] = existing ? (existing[f] ?? '') : ''; });
    return v;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ex = rows.find((r) => r.year === year && r.month === month);
    const v = {};
    MV_FIELDS.forEach((f) => { v[f] = ex ? (ex[f] ?? '') : ''; });
    setValues(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function handleSave() {
    setSaving(true);
    const row = { year, month };
    MV_FIELDS.forEach((f) => { row[f] = values[f] !== '' ? +values[f] : null; });
    const { data, error } = await sb.from('market_valuations').upsert(row, { onConflict: 'year,month' }).select().single();
    if (error) { setSaving(false); alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'edit', 'market-valuation', data?.id || null, `${year}/${month}`);
    setSaving(false);
    onClose();
  }

  const curYear = now.getFullYear();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
        <div className="page-header-row"><h2>Сарын үнэ оруулах</h2><button className="btn-ghost" onClick={onClose}>✕</button></div>
        <div className="field-row">
          <label className="field"><span>Он</span>
            <select value={year} onChange={(e) => setYear(+e.target.value)}>
              {Array.from({ length: 4 }, (_, i) => curYear - 2 + i).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="field"><span>Сар</span>
            <select value={month} onChange={(e) => setMonth(+e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>
        {MV_FIELDS.map((f) => (
          <label key={f} className="field"><span>{MV_FIELD_LABELS[f]}{f.includes('rent') ? ' (₮/сар)' : ' (₮)'}</span>
            <input type="number" value={values[f]} onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))} />
          </label>
        ))}
        <div className="form-actions">
          <button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button>
        </div>
      </div>
    </div>
  );
}
