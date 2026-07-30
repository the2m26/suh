import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';

export default function CallService() {
  const [services, setServices] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from('local_services').select('*').order('order_num');
      setServices(data || []);
    })();
  }, []);

  if (services === null) return <div className="pool-empty">Ачаалж байна...</div>;

  return (
    <div>
      <div className="mobile-list-item">
        <div className="guest-invite-note">Хотхонд ойр байрлах хүргэлттэй, захиалгатай, дуудлагын худалдаа үйлчилгээнүүд</div>
      </div>
      <div className="mobile-list-item">
        {services.map((s, i) => {
          const hasContact = s.phone || s.telegram || s.viber;
          return (
            <div key={s.id} style={{ padding: '10px 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div className="mobile-list-title">{s.category}</div>
              {hasContact ? (
                <div className="service-contact-row">
                  {s.phone && <a href={`tel:${s.phone}`} className="service-contact-btn">{s.phone}</a>}
                  {s.telegram && <a href={`https://t.me/${s.telegram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="service-contact-btn">{s.telegram}</a>}
                  {s.viber && <a href={`viber://chat?number=%2B${s.viber.replace(/\D/g, '')}`} className="service-contact-btn">{s.viber}</a>}
                </div>
              ) : <div className="mobile-list-sub">Мэдээлэл удахгүй нэмэгдэнэ</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
