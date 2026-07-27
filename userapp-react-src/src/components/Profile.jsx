import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { apartmentSqm } from '../lib/feeEngine';

// ⚠️ userapp.html-ийн openMobileMyProfilePage()-той ЯГ ИЖИЛ логик —
// хэрэглэгч + түүний эзэмшдэг тоот/зогсоол/агуулах, регистр/утас/и-мэйл.
export default function Profile({ profile }) {
  const [loading, setLoading] = useState(true);
  const [resident, setResident] = useState(null);
  const [sqm, setSqm] = useState(0);

  useEffect(() => {
    (async () => {
      const [resRes, aptRes] = await Promise.all([
        sb.from('residents').select('*').eq('apt', profile.apt).maybeSingle(),
        sb.from('apt_types').select('*'),
      ]);
      if (resRes.data) {
        setResident(resRes.data);
        setSqm(apartmentSqm(resRes.data, aptRes.data || []));
      }
      setLoading(false);
    })();
  }, [profile.apt]);

  if (loading) return <div className="pool-empty">Ачаалж байна...</div>;
  if (!resident) return <div className="pool-empty">Мэдээлэл олдсонгүй</div>;

  const name = ((resident.firstname || '') + ' ' + (resident.lastname || '')).trim() || profile.full_name || '—';

  const idRows = [
    ['Регистр', resident.reg || '—'],
    ['Утас', resident.phone || '—'],
    ['И-мэйл', resident.email || '—'],
  ];
  const ownRows = [
    ['Тоот', resident.apt],
    ['Талбай', sqm ? sqm + ' м²' : '—'],
    ['Зогсоол', (resident.parkings || []).length ? resident.parkings.join(', ') : '—'],
    ['Агуулах', (resident.storages || []).length ? resident.storages.join(', ') : '—'],
  ];

  return (
    <div>
      <div className="mobile-list-item" style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{resident.apt} тоот{sqm ? ' · ' + sqm + ' м²' : ''}</div>
      </div>

      <div className="section-title">Хэрэглэгчийн мэдээлэл</div>
      <div className="mobile-list-item">
        {idRows.map(([label, val], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{String(val)}</span>
          </div>
        ))}
      </div>

      <div className="section-title">Миний эзэмшил</div>
      <div className="mobile-list-item">
        {ownRows.map(([label, val], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{String(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
