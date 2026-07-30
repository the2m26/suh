import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';

const CATEGORY_LABELS = {
  notice: 'Мэдэгдэл', warning: 'Анхааруулга', reminder: 'Сануулга',
  announcement: 'Зар мэдээлэл', invoice: 'Нэхэмжлэл', ereceipt: 'И-баримт', payslip: 'Цалингийн хуудас',
};
function fmtDateTime(iso) {
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Inbox({ onClose }) {
  const [notifications, setNotifications] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await sb.rpc('get_my_notifications', { p_limit: 20 });
      if (err) { console.error('get_my_notifications алдаа:', err); setError(err.message); }
      setNotifications(data || []);
    })();
  }, []);

  function onRowClick(n) {
    setOpenId(id => id === n.id ? null : n.id);
    sb.rpc('mark_notification_read', { p_id: n.id });
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="qpay-modal add-tile-modal">
        <div className="add-tile-title">Мэдэгдэл</div>
        {error && <div className="login-error">Алдаа: {error}</div>}
        {notifications === null ? (
          <div className="pool-empty" style={{ padding: '20px 0' }}>Ачаалж байна...</div>
        ) : notifications.length ? notifications.map(n => (
          <div key={n.id} className="inbox-notif-row" onClick={() => onRowClick(n)}>
            <div className="inbox-notif-top">
              <span className="inbox-notif-category">{CATEGORY_LABELS[n.category] || n.category}</span>
              <span className="inbox-notif-date">{fmtDateTime(n.sent_at)}</span>
            </div>
            <div className="inbox-notif-title">{n.title}</div>
            {openId === n.id && n.content && <div className="inbox-notif-content">{n.content}</div>}
          </div>
        )) : <div className="pool-empty" style={{ padding: '20px 0' }}>Мэдэгдэл алга</div>}
        <button className="login-btn" style={{ marginTop: 14 }} onClick={onClose}>Хаах</button>
      </div>
    </div>
  );
}
