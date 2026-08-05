import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';

// ⚠️ 2026-07-30: "СӨХ-Д САНАЛ ХүСЭЛТ ИЛГЭЭХ" -> "СӨХ-тэй харилцах" -> "CC messenger"
// (эцсийн нэр) — CC center-той шууд chat/messenger. Inbox-оос ЗОРИУДААР
// тусгаарлагдсан (notifications.source='cc-center' Inbox-д ОРОХГүй).
// ⚠️ Дэлгэцийн бүтэн өндрийг (хуудасны scroll-гүйгээр) эзлэхийн тулд, header
// (.content-page-header)-ийн доод хүрээ, tab-bar (.tab-bar-wrap)-ийн дээд
// хүрээг БОДИТООР хэмжиж (ResizeObserver/getBoundingClientRect), position:fixed-ээр
// тэдгээрийн ХООРОНД яг таарч байрлуулна — ХАТУУ тоо ТААМАГЛАХГүй.
// ⚠️ 2026-08-05 нэмэв: Зурган attachment (compress 800×600 JPG, private
// Supabase bucket "cc-attachments", 1 сарын дараа сервер талд автомат устгагдана).

function fmtTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fmtDay(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

// ⚠️ 2026-08-05 нэмэв: сонгосон зургийг 800×600-аас ХЭТРүүЛЭХГүйгээр (харьцаагаа
// хадгалж) JPEG болгож шахна — Storage зай хэмнэх (1 сарын автомат устгалттай
// хамт ажиллана). Хэмжээ Хязгаарлалт (байтаар) ЗОРИУДААР тавиагүй, зөвхөн
// хэмжээгээр (800×600) хязгаарлана гэдгээр хэрэглэгч тодорхойлсон.
async function compressImage(file, maxW = 800, maxH = 600, quality = 0.8) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });
  const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

// ⚠️ private bucket тул зурган URL үргэлж createSignedUrl()-ээр л үүсдэг
// (getPublicUrl() ажиллахгүй) — 10 жилийн хугацаатай (бараг байнгын, гэхдээ
// эрх шалгагдсаны дараа л олгогддог тул URL мэдэхгүй хүн шууд таашгүй).
async function resolveAttachmentUrl(path) {
  if (!path) return null;
  const { data, error } = await sb.storage.from('cc-attachments').createSignedUrl(path, 315360000);
  if (error) return null;
  return data.signedUrl;
}

// ⚠️ 2026-08-02 засав: channel-ийг ганц удаа .on()+.subscribe() хийж, тухайн
// мөчид идэвхтэй компонентын callback-ыг сольж ("swap") ажиллуулдаг болгов —
// үүнгүйгээр компонент дахин mount болох бүрд ("cannot add callback after
// subscribe" алдаа өгдөг байсан.
let _typingChannel = null;
let _typingListener = null;
function _ensureTypingChannel() {
  if (!_typingChannel) {
    _typingChannel = sb.channel('cc-typing-broadcast');
    _typingChannel.on('broadcast', { event: 'typing' }, (msg) => {
      if (_typingListener) _typingListener(msg);
    });
    _typingChannel.subscribe();
  }
  return _typingChannel;
}

function useFixedBounds() {
  const [bounds, setBounds] = useState(null);
  useEffect(() => {
    function measure() {
      const header = document.querySelector('.content-page-header');
      const tabBar = document.querySelector('.tab-bar-wrap');
      const root = document.getElementById('root');
      if (!header || !tabBar || !root) return;
      const headerRect = header.getBoundingClientRect();
      const tabBarRect = tabBar.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      setBounds({
        top: headerRect.bottom,
        bottom: window.innerHeight - tabBarRect.top,
        left: rootRect.left,
        right: window.innerWidth - rootRect.right,
      });
    }
    measure();
    window.addEventListener('resize', measure);
    const id = setInterval(measure, 500); // эхний render үед tab-bar/header хэмжээ өөрчлөгдсөн ч барагдана
    setTimeout(() => clearInterval(id), 3000);
    return () => { window.removeEventListener('resize', measure); clearInterval(id); };
  }, []);
  return bounds;
}

export default function CallLog({ profile }) {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [staffTyping, setStaffTyping] = useState(false);
  const typingGateRef = useRef(0);
  const typingHideRef = useRef(null);
  const msgBoxRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const bounds = useFixedBounds();

  // ⚠️ 2026-08-04: textarea-г бичсэн текстийн дагуу динамикаар дээшээ сунадаг болгов
  // (24px мин, 120px хүртэл, дараа нь дотроо scroll)
  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }
  useEffect(() => { autoGrow(); }, [content]);

  async function loadThread(rId) {
    const [{ data: incoming }, { data: outgoing }] = await Promise.all([
      sb.from('feedback_requests').select('*').eq('apt', profile.apt).order('created_at', { ascending: true }),
      rId
        ? sb.from('notifications').select('*').eq('source', 'cc-center').eq('recipient_kind', 'resident')
            .eq('recipient_filter', 'specific').eq('recipient_specific_id', rId).order('sent_at', { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);
    const rows = [
      ...(incoming || []).map(m => ({ dir: 'out', text: m.content, at: m.created_at, attachmentPath: m.attachment_path })),
      ...(outgoing || []).map(m => ({ dir: 'in', text: m.content, at: m.sent_at, sender: m.sender_name, attachmentPath: m.attachment_path })),
    ].sort((a, b) => new Date(a.at) - new Date(b.at));
    // ⚠️ attachment-той мсж бүрт signed URL зэрэгцүүлж (Promise.all) тайлна —
    // приваат bucket тул URL-ыг урьдчилан хадгалах боломжгүй, үргэлж татаж авна.
    const withUrls = await Promise.all(rows.map(async r => ({
      ...r,
      attachmentUrl: r.attachmentPath ? await resolveAttachmentUrl(r.attachmentPath) : null,
    })));
    setMessages(withUrls);
  }

  useEffect(() => {
    let ch = null;
    let cancelled = false;

    (async () => {
      const { data: resident } = await sb.from('residents').select('id').eq('apt', profile.apt).maybeSingle();
      const rId = resident?.id || null;
      await loadThread(rId);
      if (cancelled) return; // компонент unmount/apt солигдсон бол үлдэх ажлыг зогсооно

      // ⚠️ 2026-08-02 засав: cleanup функц ӨМНӨ нь async IIFE-ийн ДОТОР
      // "return" хийгдэж байсан тул React үүнийг хэзээ ч бүртгэдэггүй байсан
      // (useEffect зөвхөн ГАДНА талын функцээс шууд буцаасан утгыг л cleanup
      // гэж үздэг). үүнээс болж channel хэзээ ч цэвэрлэгдэхгүй, effect дахин
      // ажиллах бүрд ижил нэртэй ("my-cc-thread-live") шинэ channel үүсгэхийг
      // оролдоод "cannot add callbacks after subscribe()" алдаа өгдөг байсан.
      ch = sb.channel('my-cc-thread-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async (payload) => {
          const row = payload.new;
          if (row.source !== 'cc-center' || row.recipient_specific_id !== rId) return;
          const attachmentUrl = row.attachment_path ? await resolveAttachmentUrl(row.attachment_path) : null;
          setMessages(prev => [...prev, { dir: 'in', text: row.content, at: row.sent_at, sender: row.sender_name, attachmentPath: row.attachment_path, attachmentUrl }]);
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (ch) sb.removeChannel(ch);
    };
  }, [profile.apt]);

  // Typing channel модулийн singleton тул зөвхөн "идэвхтэй сонсогч"-оо
  // солино — .on()/.subscribe() дахин хэзээ ч дуудахгүй.
  useEffect(() => {
    _ensureTypingChannel();
    _typingListener = (msg) => {
      if (String(msg.payload?.apt) !== String(profile.apt)) return;
      setStaffTyping(true);
      clearTimeout(typingHideRef.current);
      typingHideRef.current = setTimeout(() => setStaffTyping(false), 3000);
    };
    return () => { _typingListener = null; };
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
    if (!text) { setError('Бичнэ үү'); return; }
    setError('');
    setSending(true);
    const { error: insErr } = await sb.from('feedback_requests').insert({ apt: profile.apt, sender_name: profile.full_name, content: text });
    setSending(false);
    if (insErr) { setError('Алдаа гарлаа — дахин оролдоно уу'); return; }
    setContent('');
    setMessages(prev => [...prev, { dir: 'out', text, at: new Date().toISOString() }]);
  }

  // ⚠️ 2026-08-05 нэмэв: Viber маягийн — зураг сонгомогц шууд compress+upload+
  // илгээгдэнэ (нэмэлт "баталгаажуулах" алхамгүй, хамгийн энгийн урсгал).
  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // ижил файлыг дахин сонгож болохоор reset хийнэ
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const path = `${profile.apt}/${Date.now()}.jpg`;
      const { error: upErr } = await sb.storage.from('cc-attachments').upload(path, blob, { contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { error: insErr } = await sb.from('feedback_requests').insert({ apt: profile.apt, sender_name: profile.full_name, content: '', attachment_path: path });
      if (insErr) throw insErr;
      const attachmentUrl = await resolveAttachmentUrl(path);
      setMessages(prev => [...prev, { dir: 'out', text: '', at: new Date().toISOString(), attachmentPath: path, attachmentUrl }]);
    } catch (err) {
      setError('Зураг илгээхэд алдаа гарлаа');
    } finally {
      setUploading(false);
    }
  }

  let lastDay = '';
  const style = bounds
    ? { position: 'fixed', top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right, zIndex: 5 }
    : { position: 'relative', height: '60vh' }; // хэмжигдэхээс өмнөх τүр байдал

  return (
    <div style={{ ...style, display: 'flex', flexDirection: 'column', padding: '4px 14px' }}>
      <div className="mobile-list-item" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 0, marginBottom: 10 }}>
        <div ref={msgBoxRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 16px' }}>
          {!messages.length && <div className="pool-empty">Зурвас алга — доор эхлүүлээрэй</div>}
          {messages.map((m, i) => {
            const day = fmtDay(m.at);
            const showDay = day !== lastDay;
            lastDay = day;
            const isOut = m.dir === 'out';
            return (
              <div key={i}>
                {showDay && (
                  <div style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--text-secondary)', padding: '3px 12px', margin: '6px auto', width: 'fit-content' }}>{day}</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '78%', marginLeft: isOut ? 'auto' : 0 }}>
                  {/* ⚠️ 2026-08-04: бабл арилгасан — зүүн(ирсэн)/баруун(илгээсэн) эгнүүлэлт,
                      хоёулаа программын default цагаан текст өнгөтэй (цэнхэр биш) */}
                  {m.attachmentUrl && (
                    <img src={m.attachmentUrl} alt="Хавсаргасан зураг" style={{ maxWidth: '100%', borderRadius: 10, display: 'block', marginBottom: m.text ? 4 : 0 }} />
                  )}
                  {m.text && (
                    <div style={{
                      padding: '0 4px', fontSize: 13, lineHeight: 1.5,
                      textAlign: isOut ? 'right' : 'left',
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                    }}>{m.text}</div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, padding: '0 4px', textAlign: isOut ? 'right' : 'left' }}>
                    {fmtTime(m.at)}{!isOut && m.sender ? ' · ' + m.sender : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {staffTyping && <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', padding: '2px 16px 8px' }}>СөХ бичиж байна...</div>}
      </div>
      {/* ⚠️ 2026-08-04: зөвхөн зурвас БИЧИХ талбар (textarea) нь мсж урсах карттай
          адил дизайнтай (.mobile-list-item). "Илгээх" товч тусдаа элемент —
          картны дотор БИШ, картны гадна зэрэгцүүлсэн байрлалтай. */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
        <div className="mobile-list-item" style={{ flex: 1, padding: '10px 14px', marginBottom: 0, position: 'relative' }}>
          <textarea ref={textareaRef} value={content}
            onChange={e => { setContent(e.target.value); notifyTyping(); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Зурвас бичих..." rows={1}
            style={{
              width: '100%', display: 'block', background: 'transparent', border: 'none', outline: 'none', padding: 0,
              paddingRight: 30,
              color: 'var(--text-primary)', fontSize: 16, lineHeight: 1.4, fontFamily: 'inherit',
              resize: 'none', boxSizing: 'border-box', overflowY: 'auto', maxHeight: 120,
              // ⚠️ fontSize 16px-ээс бага байвал iOS Safari дэлгэцийг АВТОМАТААР
              // zoom хийдэг — яг "CC messenger дэлгэц томроод бгаа" гэсэн алдааны
              // үндсэн шалтгаан нь энэ байсан (13px байсныг 16px болгож засав)
              // ⚠️ 2026-08-04: WebKit-ийн стандарт :focus үеийн цэнхэр outline (border-той
              // хамааралгүй тусад нь ажилладаг) арилгав — картны хүрээ хангалттай тул давхардал.
            }} />
          {/* ⚠️ 2026-08-05 нэмэв: Viber маягийн зурган attachment товч — талбарын
              ДОТОР баруун талд, тунгалаг фонтой, текст бичиж эхлэнгүүт (content
              хоосон бус болмогц) алга болно. */}
          {!content && (
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="Зураг хавсаргах"
              style={{
                position: 'absolute', right: 10, bottom: 10, background: 'transparent', border: 'none', padding: 0,
                cursor: uploading ? 'default' : 'pointer', color: 'var(--text-secondary)', display: 'flex', opacity: uploading ? 0.5 : 1,
              }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.8" /><path d="M21 15l-5.2-5.2a2 2 0 0 0-2.8 0L5 18" />
              </svg>
            </button>
          )}
        </div>
        {/* Viber маягийн 2D дугуй товч — хүрээ/сүүдэргүй, дэвсгэр цэнхэр (accent),
            дотор SVG сум цагаан өнгөтэй */}
        <button onClick={send} disabled={sending} aria-label="Илгээх" style={{
          width: 44, height: 44, flexShrink: 0, borderRadius: '50%', border: 'none', outline: 'none',
          background: 'var(--accent)', boxShadow: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
        }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.4 20.6L21.2 12.6C21.9 12.3 21.9 11.7 21.2 11.4L3.4 3.4C2.7 3.1 2.3 3.5 2.5 4.2L4.9 11.1C5 11.4 5.3 11.7 5.6 11.7L14.5 12L5.6 12.3C5.3 12.3 5 12.6 4.9 12.9L2.5 19.8C2.3 20.5 2.7 20.9 3.4 20.6Z" fill="#fff"/>
          </svg>
        </button>
      </div>
      {uploading && <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '4px 4px 0' }}>Зураг илгээж байна...</div>}
      {error && <div className="login-error">{error}</div>}

      {/* ⚠️ 2026-08-05 засав: custom popup (Photo Library/Take Photo сонголт) бүрэн
          арилгав — browser-ийн НАТИВ file picker өөрөө мөн адил сонголтуудыг
          өгдөг тул 2 давхар (redundant) поп-ап үүсгэж байсныг олж, userapp
          Profile-той адил ГАНЦ шууд native input болгож хялбарчлав. */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelected} />
    </div>
  );
}
