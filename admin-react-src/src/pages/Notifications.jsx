import { useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { logActivity, triggerPushForRecipients } from '../lib/dbUtils';
import { daysUnpaidForResident, daysUnpaidForBusiness } from '../lib/financeEngine';
import { NOTIF_FILTER_LABELS_BY_KIND, resolveNotificationRecipients, buildAutoTitle } from '../lib/notificationHelpers';

const NOTIF_CATEGORY_LABELS = { notice: 'Мэдэгдэл', reminder: 'Сануулга', urgent: 'Яаралтай' };

// notifications.js-ийн renderNotificationsPage() — "Илгээх" болон "Ирсэн санал,
// хүсэлт" (call-log, page:null тул тусдаа route биш, энэ хуудасны дотоод таб)
// хоёр табтай.
export default function Notifications() {
  const [tab, setTab] = useState('send');
  return (
    <div className="page page-wide">
      <h2>Зар, мэдэгдэл</h2>
      <div className="gate-tabs">
        <button className={'gate-tab' + (tab === 'send' ? ' active' : '')} onClick={() => setTab('send')}>Илгээх</button>
        <button className={'gate-tab' + (tab === 'inbox' ? ' active' : '')} onClick={() => setTab('inbox')}>Ирсэн санал, хүсэлт</button>
      </div>
      {tab === 'send' ? <SendTab /> : <InboxTab onReplied={() => setTab('send')} />}
    </div>
  );
}

function SendTab() {
  const { currentUser, currentProfile } = useAuth();
  const { canWrite } = usePermissions();
  const canSend = canWrite('notifications');
  const [residents, setResidents] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [thresholds, setThresholds] = useState({ fee: { overdue: 35, risk: 365 }, biz: { overdue: 35, risk: 365 } });
  const [loading, setLoading] = useState(true);

  const [kind, setKind] = useState('resident');
  const [filter, setFilter] = useState('all');
  const [specificId, setSpecificId] = useState('');
  const [category, setCategory] = useState('notice');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [chInapp, setChInapp] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: res }, { data: biz }, { data: emp }, { data: tx }, { data: settingsRows }] = await Promise.all([
        sb.from('residents').select('*'),
        sb.from('businesses').select('*'),
        sb.from('employees').select('id, full_name, status'),
        sb.from('transactions').select('*').eq('type', 'income'),
        sb.from('settings').select('*'),
      ]);
      setResidents((res || []).map((r) => ({ id: r.id, apt: r.apt, isVirtual: r.is_virtual || false, firstname: r.firstname, lastname: r.lastname, ownDate: r.own_date })));
      setBusinesses((biz || []).map((b) => ({ id: b.id, name: b.name, start: b.contract_start })));
      setEmployees((emp || []).map((e) => ({ id: e.id, fullName: e.full_name, status: e.status })));
      setTransactions(tx || []);
      const feeSettings = { overdueDays: 35, riskDays: 365 };
      const rentSettings = { overdueDays: 35, riskDays: 365 };
      (settingsRows || []).forEach((s) => {
        if (s.key === 'fee') Object.assign(feeSettings, s.value);
        if (s.key === 'rent') Object.assign(rentSettings, s.value);
      });
      setThresholds({
        fee: { overdue: feeSettings.overdueDays || 35, risk: feeSettings.riskDays || 365 },
        biz: { overdue: rentSettings.overdueDays || 35, risk: rentSettings.riskDays || 365 },
      });
      setLoading(false);
    })();
  }, []);

  const recipients = useMemo(() => resolveNotificationRecipients(kind, filter, +specificId || null, {
    residents, businesses, employees,
    daysUnpaidForResidentFn: daysUnpaidForResident, daysUnpaidForBusinessFn: daysUnpaidForBusiness,
    transactions, feeThresholds: thresholds.fee, bizThresholds: thresholds.biz,
  }), [kind, filter, specificId, residents, businesses, employees, transactions, thresholds]);

  function handleKindChange(newKind) {
    setKind(newKind);
    setFilter('all');
    setSpecificId('');
  }

  useEffect(() => {
    const autoTitle = buildAutoTitle(kind, filter, recipients);
    if (autoTitle) setTitle(autoTitle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, filter, recipients.length]);

  async function handleSend() {
    if (!canSend) return;
    if (!title.trim() || !content.trim()) { alert('Гарчиг болон агуулгыг бөглөнө үү'); return; }
    if (!chInapp) { alert('Дор хаяж нэг суваг сонгоно уу'); return; }
    if (!recipients.length) { alert('Хүлээн авагч олдсонгүй'); return; }

    setSending(true);
    const isSpecific = filter === 'specific' || filter === 'specific_employee';
    const recipientLabel = isSpecific ? (recipients[0]?.name || '—') : (NOTIF_FILTER_LABELS_BY_KIND[kind]?.[filter] || '');

    const recipientsWithTitle = recipients.map((r) => {
      let personalTitle = title;
      if (filter !== 'all') {
        if (kind === 'resident') personalTitle = `${r.name}${r.apt ? ' ' + r.apt : ''} Танаа`;
        else if (kind === 'business') personalTitle = `${r.name}-д`;
      }
      return { ...r, title: personalTitle, content };
    });

    const row = {
      type: category, title: title.trim(), content: content.trim(),
      recipient: recipientLabel, date: new Date().toISOString().slice(0, 10), sent: 1,
      recipient_kind: kind, recipient_filter: filter, recipient_specific_id: +specificId || null,
      category, channels: ['inapp'], recipients_snapshot: recipientsWithTitle,
      sender_id: currentUser?.id || null, sender_name: currentProfile?.full_name || null,
      sent_at: new Date().toISOString(),
    };
    const { data, error } = await sb.from('notifications').insert(row).select().single();
    if (error) { setSending(false); alert('Илгээхэд алдаа гарлаа: ' + error.message); return; }

    await logActivity(currentUser, currentProfile, 'notify', 'notifications', data.id, `${recipientLabel} — ${title.trim()}`);
    await triggerPushForRecipients(recipientsWithTitle, title.trim());

    setSending(false);
    setTitle(''); setContent('');
    alert(`${recipients.length} хүлээн авагчид In-app мэдэгдэл хадгалагдлаа ✓`);
  }

  if (loading) return <div className="empty-state">Ачаалж байна...</div>;

  return (
    <>
      <label className="field"><span>Хүлээн авагчийн бүлэг</span>
        <select value={kind} onChange={(e) => handleKindChange(e.target.value)}>
          <option value="resident">Сууц өмчлөгч</option>
          <option value="business">Аж ахуйн нэгж</option>
          <option value="staff">Ажилтан</option>
        </select>
      </label>

      <label className="field"><span>Шүүлтүүр</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {Object.entries(NOTIF_FILTER_LABELS_BY_KIND[kind] || {}).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>

      {(filter === 'specific' || filter === 'specific_employee') && (
        <label className="field"><span>Сонгох</span>
          <select value={specificId} onChange={(e) => setSpecificId(e.target.value)}>
            <option value="">— Сонгох —</option>
            {kind === 'resident' && residents.filter((r) => !r.isVirtual).map((r) => <option key={r.id} value={r.id}>{r.apt} — {r.firstname} {r.lastname}</option>)}
            {kind === 'business' && businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            {kind === 'staff' && employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </select>
        </label>
      )}

      <div className="dt-muted" style={{ marginBottom: 14 }}>{recipients.length} хүлээн авагч олдлоо</div>

      <label className="field"><span>Төрөл</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(NOTIF_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>

      <label className="field"><span>Гарчиг</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span>Агуулга</span>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4}
          style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', color: 'var(--text)', fontSize: 13 }} />
      </label>

      <div className="field-row">
        <label><input type="checkbox" checked={chInapp} onChange={(e) => setChInapp(e.target.checked)} /> In-app (Inbox+Push)</label>
        <label><input type="checkbox" disabled title="Гадаад үйлчилгээ хараахан тохируулагдаагүй" /> Мэйл (тохируулагдаагүй)</label>
        <label><input type="checkbox" disabled title="Гадаад үйлчилгээ хараахан тохируулагдаагүй" /> СМС (тохируулагдаагүй)</label>
      </div>

      {canSend && (
        <div className="form-actions">
          <button className="btn-primary" disabled={sending || !recipients.length} onClick={handleSend}>Илгээх</button>
        </div>
      )}
    </>
  );
}

// notifications.js-ийн loadCallLogInbox() — feedback_requests уншиж-харах
// жагсаалт, шүүлтүүр. "Хариулах" дарахад CC center рүү шилжинэ (тухайн
// тоотыг нээлттэйгээр).
function InboxTab() {
  const { canWrite } = usePermissions();
  const canReply = canWrite('call-log');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    sb.from('feedback_requests').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) { console.error('feedback_requests ачаалах алдаа:', error.message); setLoading(false); return; }
      setRows(data || []);
      setLoading(false);
    });
  }, []);

  const years = [...new Set(rows.filter((r) => r.created_at).map((r) => new Date(r.created_at).getFullYear()))].sort((a, b) => b - a);
  const q = query.trim().toLowerCase();
  const list = useMemo(() => rows.filter((r) => {
    const d = r.created_at ? new Date(r.created_at) : null;
    if (year && (!d || d.getFullYear() !== +year)) return false;
    if (month && (!d || d.getMonth() + 1 !== +month)) return false;
    if (day && (!d || d.getDate() !== +day)) return false;
    if (status && r.status !== status) return false;
    if (q) {
      const hay = `${r.apt} ${r.sender_name || ''} ${r.content || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [rows, year, month, day, status, q]);

  function fmtDT(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const p2 = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p2(d.getMonth() + 1)}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  }

  async function handleReply(r) {
    if (r.status === 'new') {
      await sb.from('feedback_requests').update({ status: 'reviewed' }).eq('id', r.id);
    }
    window.location.hash = '#/cc-center';
    sessionStorage.setItem('cc-center-open-apt', String(r.apt));
  }

  return (
    <>
      <div className="gate-filters">
        <input placeholder="Хайх (тоот, нэр, агуулга)..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">Бүх он</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Бүх сар</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={day} onChange={(e) => setDay(e.target.value)}>
          <option value="">Бүх өдөр</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Бүх төлөв</option>
          <option value="new">Шинэ</option>
          <option value="reviewed">Хянасан</option>
        </select>
      </div>

      {loading && <div className="empty-state">Ачаалж байна...</div>}
      {!loading && !list.length && <div className="empty-state">Одоогоор ирсэн санал, хүсэлт алга</div>}
      {!loading && list.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Хугацаа</th><th>Тоот</th><th>Илгээгч</th><th>Агуулга</th><th>Төлөв</th><th></th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="dt-mono">{fmtDT(r.created_at)}</td>
                  <td className="dt-text">{r.apt}</td>
                  <td className="dt-muted">{r.sender_name || ''}</td>
                  <td className="dt-muted" style={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>{r.content}</td>
                  <td><span className="tag">{r.status === 'new' ? 'Шинэ' : 'Хянасан'}</span></td>
                  <td>{canReply && <button className="btn-primary btn-sm" onClick={() => handleReply(r)}>Хариулах</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
