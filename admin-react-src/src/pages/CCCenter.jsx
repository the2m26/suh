import { useCallback, useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { logActivity, triggerPushForRecipients } from '../lib/dbUtils';
import { ccResidentLabel, ccInitials, ccFmtTime, buildCCThreads, filterCCThreads, mergeCCMessages } from '../lib/ccCenterHelpers';

export default function CCCenter() {
  const { currentUser, currentProfile } = useAuth();
  const { canWrite } = usePermissions();
  const canReply = canWrite('cc-center');
  const [residents, setResidents] = useState([]);
  const [threads, setThreads] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [activeApt, setActiveApt] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [typingLabel, setTypingLabel] = useState('');

  // cccenter.js-ийн realtime callback-үүд (postgres_changes INSERT) хамгийн
  // сүүлийн activeApt/residents утгыг унших ёстой тул ref-ээр дамжуулна
  // (useEffect дотор нэг удаа subscribe хийгддэг тул closure хуучирдаг).
  const activeAptRef = useRef(activeApt);
  const residentsRef = useRef(residents);
  const messagesRef = useRef(messages);
  useEffect(() => { activeAptRef.current = activeApt; }, [activeApt]);
  useEffect(() => { residentsRef.current = residents; }, [residents]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    sb.from('residents').select('id, apt, firstname, lastname').then(({ data, error }) => {
      if (error) { console.error('residents ачаалах алдаа:', error.message); return; }
      setResidents(data || []);
    });
  }, []);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    const [{ data: feedback, error }, { data: outgoing }, { data: statusRows }] = await Promise.all([
      sb.from('feedback_requests').select('*').order('created_at', { ascending: false }),
      sb.from('notifications').select('*').eq('source', 'cc-center').eq('recipient_kind', 'resident').eq('recipient_filter', 'specific').order('sent_at', { ascending: false }),
      sb.from('cc_thread_status').select('*'),
    ]);
    if (error) { console.error('feedback_requests ачаалах алдаа:', error.message); setLoading(false); return; }
    const statusMap = {};
    (statusRows || []).forEach((s) => { statusMap[String(s.apt)] = { muted: s.muted, urgent: s.urgent, pinned: s.pinned }; });
    setStatuses(statusMap);
    setThreads(buildCCThreads(feedback, outgoing, residentsRef.current));
    setLoading(false);
  }, []);
  const loadThreadsRef = useRef(loadThreads);
  useEffect(() => { loadThreadsRef.current = loadThreads; }, [loadThreads]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  useEffect(() => {
    const openApt = sessionStorage.getItem('cc-center-open-apt');
    if (openApt && residents.length && !loading) {
      sessionStorage.removeItem('cc-center-open-apt');
      selectThread(openApt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residents.length, loading]);

  const selectThread = useCallback(async (apt) => {
    setActiveApt(apt);
    const resident = residentsRef.current.find((x) => String(x.apt) === String(apt));
    const [{ data: incoming }, { data: outgoing }] = await Promise.all([
      sb.from('feedback_requests').select('*').eq('apt', apt).order('created_at', { ascending: true }),
      resident
        ? sb.from('notifications').select('*').eq('recipient_kind', 'resident').eq('recipient_filter', 'specific').eq('recipient_specific_id', resident.id).order('sent_at', { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);
    setMessages(mergeCCMessages(incoming, outgoing));

    const newIds = (incoming || []).filter((m) => m.status === 'new').map((m) => m.id);
    if (newIds.length) {
      await sb.from('feedback_requests').update({ status: 'reviewed' }).in('id', newIds);
      loadThreads();
    }
  }, [loadThreads]);

  // cccenter.js-ийн _ccSetupRealtime()/_ccSetupTypingChannel() (мөр ~74-147)
  // — хэрэглэгчийн 2026-08-06 зөвшөөрлөөр React рүү портлогдов. Резидентээс
  // шинэ feedback ирэхэд, эсвэл өөр ажилтан ЯГ ЭНЭ resident-д хариу
  // илгээхэд, миний дэлгэц дээр шууд (дахин ачаалахгүй) харагдана.
  useEffect(() => {
    const feedbackChannel = sb.channel('cc-feedback-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedback_requests' }, async (payload) => {
        const row = payload.new;
        await loadThreadsRef.current();
        if (String(activeAptRef.current) === String(row.apt)) {
          setMessages((prev) => [...prev, { dir: 'in', text: row.content, at: row.created_at, id: row.id, attachmentPath: row.attachment_path }]);
          await sb.from('feedback_requests').update({ status: 'reviewed' }).eq('id', row.id);
          await loadThreadsRef.current();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async (payload) => {
        const row = payload.new;
        if (row.source !== 'cc-center' || row.recipient_kind !== 'resident' || row.recipient_filter !== 'specific') return;
        const resident = residentsRef.current.find((x) => x.id === row.recipient_specific_id);
        if (!resident) return;
        await loadThreadsRef.current();
        if (String(activeAptRef.current) !== String(resident.apt)) return;
        if (messagesRef.current.some((m) => m.dir === 'out' && m.at === row.sent_at && m.text === row.content)) return;
        setMessages((prev) => [...prev, { dir: 'out', text: row.content, at: row.sent_at, sender: row.sender_name, id: row.id, attachmentPath: row.attachment_path }]);
      })
      .subscribe();

    let typingHideTimer = null;
    const typingChannel = sb.channel('cc-typing-broadcast');
    typingChannel.on('broadcast', { event: 'typing' }, (msg) => {
      const { apt, senderName } = msg.payload || {};
      if (String(apt) !== String(activeAptRef.current)) return;
      setTypingLabel(`${senderName || 'Ажилтан'} бичиж байна...`);
      clearTimeout(typingHideTimer);
      typingHideTimer = setTimeout(() => setTypingLabel(''), 3000);
    }).subscribe();

    return () => {
      clearTimeout(typingHideTimer);
      sb.removeChannel(feedbackChannel);
      sb.removeChannel(typingChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typingSendGateRef = useRef(0);
  function notifyTyping() {
    if (!activeApt) return;
    const now = Date.now();
    if (now - typingSendGateRef.current < 1500) return; // throttle 1.5s
    typingSendGateRef.current = now;
    sb.channel('cc-typing-broadcast').send({
      type: 'broadcast', event: 'typing',
      payload: { apt: activeApt, senderName: currentProfile?.full_name || 'Ажилтан' },
    });
  }

  async function handleSend() {
    if (!activeApt || !reply.trim() || !canReply) return;
    const resident = residents.find((x) => String(x.apt) === String(activeApt));
    if (!resident) { alert('Тухайн тоотод бүртгэлтэй сууц өмчлөгч олдсонгүй'); return; }
    setSending(true);
    const text = reply.trim();
    const label = `${activeApt} — ${resident.firstname || ''} ${resident.lastname || ''}`.trim();
    const row = {
      type: 'notice', title: '', content: text,
      recipient: label, date: new Date().toISOString().slice(0, 10), sent: 1,
      recipient_kind: 'resident', recipient_filter: 'specific', recipient_specific_id: resident.id,
      category: 'notice', channels: ['inapp'], source: 'cc-center',
      recipients_snapshot: [{ name: `${resident.firstname} ${resident.lastname}`, apt: activeApt, ref_type: 'resident', ref_id: resident.id, title: '', content: text }],
      sender_id: currentUser?.id || null,
      sender_name: currentProfile?.full_name || null,
      sent_at: new Date().toISOString(),
    };
    const { error } = await sb.from('notifications').insert(row);
    if (error) { setSending(false); alert('Илгээхэд алдаа гарлаа: ' + error.message); return; }

    await logActivity(currentUser, currentProfile, 'notify', 'cc-center', null, `${label} — Хариу`);
    await triggerPushForRecipients([{ apt: activeApt, content: text }], currentProfile?.full_name || 'СөХ');

    setReply('');
    setSending(false);
    selectThread(activeApt);
  }

  async function toggleStatus(apt, field) {
    const current = statuses[String(apt)] || { muted: false, urgent: false, pinned: false };
    const next = { ...current, [field]: !current[field] };
    const { error } = await sb.from('cc_thread_status').upsert(
      { apt, muted: next.muted, urgent: next.urgent, pinned: next.pinned, updated_at: new Date().toISOString() },
      { onConflict: 'apt' }
    );
    if (error) { alert('Тэмдэглэхэд алдаа гарлаа: ' + error.message); return; }
    setStatuses((s) => ({ ...s, [String(apt)]: next }));
  }

  const filtered = filterCCThreads(threads, statuses, { query, statusFilter }, residents);
  const pinnedList = filtered.filter((t) => (statuses[String(t.apt)] || {}).pinned);
  const unpinnedList = filtered.filter((t) => !(statuses[String(t.apt)] || {}).pinned);
  const activeStatus = activeApt ? (statuses[String(activeApt)] || { muted: false, urgent: false, pinned: false }) : null;
  const activeResident = activeApt ? residents.find((x) => String(x.apt) === String(activeApt)) : null;

  return (
    <div className="page page-wide">
      <h2>CC center</h2>
      <div className="cc-layout">
        <div className="cc-sidebar">
          <div className="cc-filters">
            <input placeholder="Хайх..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Бүгд</option>
              <option value="unread">Уншаагүй</option>
              <option value="urgent">Яаралтай</option>
              <option value="muted">Дуугүй</option>
            </select>
          </div>
          {loading && <div className="empty-state">Ачаалж байна...</div>}
          {!loading && !filtered.length && <div className="empty-state">Санал, хүсэлт алга</div>}
          <div className="cc-thread-list">
            {[...pinnedList, ...unpinnedList].map((t) => {
              const st = statuses[String(t.apt)] || {};
              return (
                <div key={t.apt} className={'cc-thread-item' + (String(activeApt) === String(t.apt) ? ' active' : '')} onClick={() => selectThread(t.apt)}>
                  <div className={'cc-avatar' + (st.urgent ? ' urgent' : '')}>{ccInitials(t.apt, residents)}{st.muted && <span className="cc-mute-dot" />}</div>
                  <div className="cc-thread-info">
                    <div className="cc-thread-top">
                      <span className="cc-thread-name">{ccResidentLabel(t.apt, residents)} ({t.apt})</span>
                      <span className="cc-thread-time">{ccFmtTime(t.lastAt)}</span>
                    </div>
                    <div className="cc-thread-preview">{t.lastText}</div>
                  </div>
                  {t.unread > 0 && <span className="cc-unread-dot" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="cc-thread-view">
          {!activeApt ? (
            <div className="empty-state" style={{ marginTop: 60 }}>Зүүн талаас харилцагч сонгоно уу</div>
          ) : (
            <>
              <div className="cc-thread-header">
                <div>
                  <div className="dt-title">{ccResidentLabel(activeApt, residents)} ({activeApt})</div>
                  <div className="dt-muted" style={{ fontSize: 11 }}>{activeResident?.phones?.[0] || ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className={'btn-outline btn-sm' + (activeStatus.pinned ? ' active-toggle' : '')} onClick={() => toggleStatus(activeApt, 'pinned')}>📌</button>
                  <button className={'btn-outline btn-sm' + (activeStatus.urgent ? ' active-toggle' : '')} onClick={() => toggleStatus(activeApt, 'urgent')}>⚠</button>
                  <button className={'btn-outline btn-sm' + (activeStatus.muted ? ' active-toggle' : '')} onClick={() => toggleStatus(activeApt, 'muted')}>🔇</button>
                </div>
              </div>
              <div className="cc-messages">
                {messages.map((m) => (
                  <div key={m.dir + m.id} className={'cc-bubble ' + (m.dir === 'in' ? 'cc-bubble-in' : 'cc-bubble-out')}>
                    <div>{m.text}</div>
                    <div className="cc-bubble-time">{ccFmtTime(m.at)}</div>
                  </div>
                ))}
              </div>
              {typingLabel && <div className="cc-typing-indicator">{typingLabel}</div>}
              {canReply && (
                <div className="cc-reply-row">
                  <textarea value={reply} onChange={(e) => { setReply(e.target.value); notifyTyping(); }} placeholder="Хариу бичих..." rows={2} />
                  <button className="btn-primary" disabled={sending || !reply.trim()} onClick={handleSend}>Илгээх</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="dt-muted" style={{ marginTop: 14 }}>
        ⚠️ Зураг/файл хавсаргах хараахан React-д ортоогүй (realtime, бичиж байгааг харуулах индикатор — хоёул хэрэгжсэн).
      </div>
    </div>
  );
}
