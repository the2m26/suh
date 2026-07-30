import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';

export default function EmergencyContacts() {
  const [contacts, setContacts] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from('emergency_contacts').select('*').order('order_num');
      setContacts(data || []);
    })();
  }, []);

  if (contacts === null) return <div className="pool-empty">Ачаалж байна...</div>;
  if (!contacts.length) return <div className="pool-empty">Мэдээлэл одоогоор бөглөгдөөгүй</div>;

  return (
    <div className="mobile-list-item">
      {contacts.map((c, i) => (
        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          <div className="mobile-list-title">{c.name}</div>
          <a href={`tel:${c.phone}`} className="profile-value-link">{c.phone}</a>
        </div>
      ))}
    </div>
  );
}
