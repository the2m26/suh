import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';

// ⚠️ 2026-07-30: "СӨХ-Д САНАЛ ХүСЭЛТ ИЛГЭЭХ" (энгийн нэг чиглэлийн форм) ->
// "СӨХ-тэй харилцах" (CC center-той шууд chat/messenger) болж бүрэн дахин
// бичигдэв. Энэ суваг ЗОРИУДААР Inbox (get_my_notifications)-оос тусгаарлагдсан
// — notifications.source='cc-center' гэж тэмдэглэгдсэн мөрүүд Inbox-д ОРОХГүй,
// зөвхөн ЭНД харагдана (Suh.html-ийн "Зар, мэдэгдэл илгээх" хуудаснаас илгээсэн
// зар/мэдэгдэл/анхааруулга/санамж/нэхэмжлэх ЗӨВХӨН Inbox-т, холилдохгүй).

function fmtTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fmtDay(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

let _typingChannel = null;
function _ensureTypingChannel() {
  if (!_typingChannel) _typingChannel = sb.channel('cc-typing-broadcast');
  return _typingChannel;
}

export default function CallLog({ profile }) {
  const [residentId, setResidentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [staffTyping, setStaffTyping] = useState(false);
  const typingGateRef = useRef(0);
  const typingHideRef = useRef(null);
  const msgBoxRef = useRef(null);

  async function loadThread(rId) {
    const [{ data: incoming }, { data: outgoing }] = await Promise.all([
      sb.from('feedback_requests').select('*').eq('apt', profile.apt).order('created_at', { ascending: true }),
      rId
        ? sb.from('notifications').select('*').eq('source', 'cc-center').eq('recipient_kind', 'resident')
            .eq('recipient_filter', 'specific').eq('recipient_specific_id', rId).order('sent_at', { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);
    const merged = [
      ...(incoming || []).map(m => ({ dir: 'out', text: m.content, at: m.created_at })),
      ...(outgoing || []).map(m => ({ dir: 'in', text: m.content, at: m.sent_at, sender: m.sender_name })),
    ].sort((a, b) => new Date(a.at) - new Date(b.at));
    setMessages(merged);
  }

  useEffect(() => {
    (async () => {
      const { data: resident } = await sb.from('residents').select('id').eq('apt', profile.apt).maybeSingle();
      const rId = resident?.id || null;
      setResidentId(rId);
      await loadThread(rId);

      // Realtime: ажилтны хариулт шууд орж ирнэ
      const ch = sb.channel('my-cc-thread-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
          const row = payload.new;
          if (row.source !== 'cc-center' || row.recipient_specific_id !== rId) return;
          setMessages(prev => [...prev, { dir: 'in', text: row.content, at: row.sent_at, sender: row.sender_name }]);
        })
        .subscribe();

      _ensureTypingChannel().on('broadcast', { event: 'typing' }, (msg) => {
        if (String(msg.payload?.apt) !== String(profile.apt)) return;
        setStaffTyping(true);
        clearTimeout(typingHideRef.current);
        typingHideRef.current = setTimeout(() => setStaffTyping(false), 3000);
      }).subscribe();

      return () => { sb.removeChannel(ch); };
    })();
  }, [profile.apt]);

  useEffect(() => {
    if (msgBoxRef.current) msgBoxRef.current.scrollTop = msgBoxRef.current.scrollHeight;
  }, [messages]);

  function notifyTyping() {
    const now = Date.now();
    if (now - typingGateRef.current < 1500) return;
    typingGateRef.current = now;
    _ensureTypingChannel().send({ type: 'broadcast', event: 'typing', payload: { apt: profile.apt, senderName: profile.full_name } });
  }

  async function send() {
    const text = content.trim();
    if (!text) { setError('Бичнэ vv'); return; }
    setError('');
    setSending(true);
    const { error: insErr } = await sb.from('feedback_requests').insert({ apt: profile.apt, sender_name: profile.full_name, content: text });
    setSending(false);
    if (insErr) { setError('Алдаа гарлаа — дахин оролдоно уу'); return; }
    setContent('');
    setMessages(prev => [...prev, { dir: 'out', text, at: new Date().toISOString() }]);
  }

  let lastDay = '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)' }}>
      <div ref={msgBoxRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 2px' }}>
        {!messages.length && <div className="pool-empty">Зурвас алга — доор эхлүүлээрэй</div>}
        {messages.map((m, i) => {
          const day = fmtDay(m.at);
          const showDay = day !== lastDay;
          lastDay = day;
          const isOut = m.dir === 'out';
          return (
            <div key={i}>
              {showDay && (
                <div style={{ alignSelf: 'center', textAlign: 'center', fontSize: 10.5, color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '3px 12px', borderRadius: 20, margin: '6px auto', width: 'fit-content' }}>{day}</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '78%', marginLeft: isOut ? 'auto' : 0 }}>
                <div style={{
                  padding: '10px 14px', borderRadius: 14, fontSize: 13, lineHeight: 1.5,
                  background: isOut ? 'var(--accent-dark, var(--accent))' : 'var(--bg-card)',
                  color: isOut ? '#fff' : 'var(--text-primary)',
                  border: isOut ? 'none' : '1px solid var(--border-card)',
                  borderTopRightRadius: isOut ? 4 : 14, borderTopLeftRadius: isOut ? 14 : 4,
                }}>{m.text}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4, padding: '0 4px', textAlign: isOut ? 'right' : 'left' }}>
                  {fmtTime(m.at)}{!isOut && m.sender ? ' · ' + m.sender : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {staffTyping && <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', padding: '2px 4px' }}>СӨХ бичиж байна...</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', paddingTop: 10 }}>
        <textarea value={content}
          onChange={e => { setContent(e.target.value); notifyTyping(); }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Зурвас бичих..." rows={1}
          style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 4, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', resize: 'none', height: 29 }} />
        <button className="login-btn" style={{ height: 44, width: 'auto', padding: '0 20px' }} onClick={send} disabled={sending}>Илгээх</button>
      </div>
      {error && <div className="login-error">{error}</div>}
    </div>
  );
}
