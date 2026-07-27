import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { buildFeeBreakdown } from '../lib/feeEngine';
import QpayModal from './QpayModal';

// ⚠️ userapp.html-ийн openMobileMyPaymentPage()-той ЯГ ИЖИЛ логик —
// зөвхөн ӨӨРИЙН тоотын задаргаа, түүх, QPay товч.
export default function Payment({ profile }) {
  const [loading, setLoading] = useState(true);
  const [resident, setResident] = useState(null);
  const [breakdown, setBreakdown] = useState({ rows: [], total: 0 });
  const [history, setHistory] = useState([]);
  const [showQpay, setShowQpay] = useState(false);

  useEffect(() => {
    (async () => {
      const [resRes, catRes, aptRes, parkRes, storRes] = await Promise.all([
        sb.from('residents').select('*').eq('apt', profile.apt).maybeSingle(),
        sb.from('fee_catalog').select('*').eq('applies_to', 'resident'),
        sb.from('apt_types').select('*'),
        sb.from('parking_types').select('*'),
        sb.from('storage_types').select('*'),
      ]);
      const r = resRes.data;
      setResident(r);
      if (r) {
        const ctx = { aptTypes: aptRes.data || [], parkingTypes: parkRes.data || [], storageTypes: storRes.data || [] };
        setBreakdown(buildFeeBreakdown(r, 'resident', catRes.data || [], ctx));
        const { data: hist } = await sb.from('transactions').select('*').eq('apt', r.apt).eq('type', 'income').order('id', { ascending: false }).limit(12);
        setHistory(hist || []);
      }
      setLoading(false);
    })();
  }, [profile.apt]);

  if (loading) return <div className="pool-empty">Ачаалж байна...</div>;
  if (!resident) return <div className="pool-empty">Мэдээлэл олдсонгүй</div>;

  return (
    <div>
      <div className="section-title">Төлбөрийн задаргаа (сар бүр)</div>
      <div className="mobile-list-item">
        {breakdown.rows.map((x, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{x.name}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{x.amt.toLocaleString()}₮</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 2px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Нийт сарын төлбөр</span>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{breakdown.total.toLocaleString()}₮</span>
        </div>
      </div>

      <button className="login-btn" style={{ marginTop: 10 }} onClick={() => setShowQpay(true)}>
        💳 QPay-аар төлөх
      </button>

      <div className="section-title">Төлбөр төлөлтийн түүх</div>
      {history.length ? history.map((t, i) => (
        <div className="mobile-list-item" key={i}>
          <div style={{ fontWeight: 700 }}>{(+t.amount || 0).toLocaleString()}₮</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.month}-р сар, {t.year} · {t.method || t.description || '—'}</div>
        </div>
      )) : <div className="pool-empty">Төлбөрийн түүх алга</div>}

      {showQpay && (
        <QpayModal amount={breakdown.total} apt={resident.apt} residentId={resident.id} onClose={() => setShowQpay(false)} />
      )}
    </div>
  );
}
