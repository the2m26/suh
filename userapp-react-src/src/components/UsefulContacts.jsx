import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';

export default function UsefulContacts() {
  const [org, setOrg] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from('settings').select('value').eq('key', 'org_profile').maybeSingle();
      setOrg(data?.value || {});
    })();
  }, []);

  if (org === null) return <div className="pool-empty">Ачаалж байна...</div>;

  const address = [org.province, org.district, org.khoroo, org.street,
    org.building ? org.building + '-р байр' : '', org.gate_number ? org.gate_number + ' орц' : '']
    .filter(Boolean).join(', ');
  const rows = [
    { label: 'Байгууллагын нэр', value: org.org_name },
    { label: 'Ажлын утас', value: org.landline, type: 'tel' },
    { label: 'Гар утас', value: org.mobile, type: 'tel' },
    { label: 'И-мэйл', value: org.email, type: 'email' },
    { label: 'Веб хуудас', value: org.website, type: 'url' },
    { label: 'Хаяг', value: address },
  ].filter(r => r.value);
  const bankAccounts = (Array.isArray(org.bank_accounts) ? org.bank_accounts : []).filter(b => b.bank_name || b.account_number);

  if (!rows.length && !bankAccounts.length) return <div className="pool-empty">Мэдээлэл одоогоор бөглөгдөөгүй</div>;

  return (
    <div className="mobile-list-item">
      {rows.map((r, i) => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.label}</span>
          {r.type === 'tel' ? <a href={`tel:${r.value}`} className="profile-value-link">{r.value}</a>
            : r.type === 'email' ? <a href={`mailto:${r.value}`} className="profile-value-link">{r.value}</a>
            : r.type === 'url' ? <a href={r.value.startsWith('http') ? r.value : `https://${r.value}`} target="_blank" rel="noopener noreferrer" className="profile-value-link">{r.value}</a>
            : <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'right' }}>{r.value}</span>}
        </div>
      ))}
      {bankAccounts.map((b, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{b.bank_name}</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{b.account_number}</span>
        </div>
      ))}
    </div>
  );
}
