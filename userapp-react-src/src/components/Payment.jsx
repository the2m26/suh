import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { buildFeeBreakdown, getUnpaidMonths } from '../lib/feeEngine';
import QpayModal from './QpayModal';

// ⚠️ userapp.html-ийн openMobileMyPaymentPage()-той ЯГ ИЖИЛ логик —
// зөвхөн ӨӨРИЙН тоотын задаргаа, түүх, QPay товч.
// ⚠️ 2026-08-05 засав: ӨМНӨ зөвхөн ОДООГИЙН сарын задаргааг харуулж, өмнөх
// төлөгдөөгүй сарууд (хуримтлагдсан өр) огт тооцоогүй байсан — резидент
// "хөөж" (эртнээс дараалан) төлдөг ёстой тул, getUnpaidMonths()-оор БҮХ
// төлөгдөөгүй сарыг тус бүр мөрөөр, нийт нийлбэр дүнтэйгээр харуулна.
export default function Payment({ profile }) {
  const [loading, setLoading] = useState(true);
  const [resident, setResident] = useState(null);
  const [breakdown, setBreakdown] = useState({ rows: [], total: 0 });
  const [missingMonths, setMissingMonths] = useState([]);
  const [history, setHistory] = useState([]);
  const [showQpay, setShowQpay] = useState(false);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const [resRes, catRes, aptRes, parkRes, storRes, yearTxRes] = await Promise.all([
        sb.from('residents').select('*').eq('apt', profile.apt).maybeSingle(),
        sb.from('fee_catalog').select('*').eq('applies_to', 'resident'),
        sb.from('apt_types').select('*'),
        sb.from('parking_types').select('*'),
        sb.from('storage_types').select('*'),
        sb.from('transactions').select('*').eq('apt', profile.apt).eq('type', 'income').eq('category', 'resident').eq('year', now.getFullYear()),
      ]);
      const r = resRes.data;
      setResident(r);
      if (r) {
        const ctx = { aptTypes: aptRes.data || [], parkingTypes: parkRes.data || [], storageTypes: storRes.data || [] };
        setBreakdown(buildFeeBreakdown(r, 'resident', catRes.data || [], ctx));
        setMissingMonths(getUnpaidMonths(r.apt, r.own_date, yearTxRes.data || [], now.getMonth() + 1, now.getFullYear()));
        const { data: hist } = await sb.from('transactions').select('*').eq('apt', r.apt).eq('type', 'income').order('id', { ascending: false }).limit(12);
        setHistory(hist || []);
      }
      setLoading(false);
    })();
  }, [profile.apt]);

  if (loading) return <div className="pool-empty">Ачаалж байна...</div>;
  if (!resident) return <div className="pool-empty">Мэдээлэл олдсонгүй</div>;

  const curMonth = new Date().getMonth() + 1;
  const prevMonths = missingMonths.filter(m => m !== curMonth);
  const totalDue = missingMonths.length ? breakdown.total * missingMonths.length : 0;

  return (
    <div>
      <div className="section-title">Төлбөрийн задаргаа (сар бүр)</div>
      <div className="mobile-list-item">
        {prevMonths.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger, #f66)', padding: '4px 0' }}>⚠️ Өмнөх төлөгдөөгүй сарууд</div>
            {prevMonths.map(m => (
              <div key={m} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m}-р сарын хураамж</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{breakdown.total.toLocaleString()}₮</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '8px 0' }} />
          </>
        )}
        {breakdown.rows.map((x, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{x.name}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{x.amt.toLocaleString()}₮</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 2px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{missingMonths.length > 1 ? `Нийт төлөх дүн (${missingMonths.length} сар)` : 'Нийт сарын төлбөр'}</span>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{totalDue.toLocaleString()}₮</span>
        </div>
      </div>

      <button className="login-btn" style={{ marginTop: 10 }} onClick={() => setShowQpay(true)}>
        QPay-аар төлөх
      </button>

      <div className="section-title">Төлбөр төлөлтийн түүх</div>
      {history.length ? history.map((t, i) => (
        <div className="mobile-list-item" key={i}>
          <div style={{ fontWeight: 700 }}>{(+t.amount || 0).toLocaleString()}₮</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.month}-р сар, {t.year} · {t.method || t.description || '—'}</div>
        </div>
      )) : <div className="pool-empty">Төлбөрийн түүх алга</div>}

      {showQpay && (
        <QpayModal amount={totalDue || breakdown.total} apt={resident.apt} residentId={resident.id} onClose={() => setShowQpay(false)} />
      )}
    </div>
  );
}
