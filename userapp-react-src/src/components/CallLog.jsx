import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';

const MAX_LEN = 280;

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function CallLog({ profile }) {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState(null);
  const senderName = profile.full_name || '—';
  const remaining = MAX_LEN - content.length;

  async function loadHistory() {
    const { data } = await sb.from('feedback_requests').select('*').eq('apt', profile.apt).order('created_at', { ascending: false });
    setHistory(data || []);
  }
  useEffect(() => { loadHistory(); }, [profile.apt]);

  async function submit() {
    setError('');
    if (!content.trim()) { setError('Агуулгаа бичнэ vv'); return; }
    setStatus('sending');
    const { error: insErr } = await sb.from('feedback_requests').insert({ apt: profile.apt, sender_name: senderName, content: content.trim() });
    if (insErr) { setStatus('error'); setError('Алдаа гарлаа — дахин оролдоно уу'); return; }
    setStatus('ok');
    setContent('');
    await loadHistory();
    setTimeout(() => setStatus(''), 2500);
  }

  return (
    <div>
      <div className="mobile-list-item">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Илгээгч</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{senderName} ({profile.apt} тоот)</span>
        </div>
      </div>
      <div className="mobile-list-item">
        <div className="call-log-textarea-wrap">
          <div className="call-log-counter">{remaining}</div>
          <textarea className="call-log-textarea" value={content}
            onChange={e => setContent(e.target.value.slice(0, MAX_LEN))}
            maxLength={MAX_LEN} rows={5} placeholder="Санал, хүсэлтээ энд бичнэ vv..." />
        </div>
        <button className="login-btn" style={{ marginTop: 12 }} onClick={submit} disabled={status === 'sending'}>
          {status === 'sending' ? 'Илгээж байна...' : 'Илгээх'}
        </button>
        {status === 'ok' && <div className="guest-invite-success">✓ Амжилттай илгээгдлээ</div>}
        {error && <div className="login-error">{error}</div>}
      </div>
      {history && history.length > 0 && (
        <>
          <div className="section-title">Миний илгээсэн санал, хүсэлт</div>
          {history.map(h => (
            <div key={h.id} className="mobile-list-item call-log-history-row">
              <div className="call-log-history-date">{fmtDate(h.created_at)}</div>
              <div className="call-log-history-content">{h.content}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
