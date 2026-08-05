// cccenter.js — "CC center" (санал болгосон chat/messenger маягийн загвараас
// 2026-07-30-нд ЖИНХЭНЭ болсон). Хуучин "CC center" нэрийг "Зар, мэдэгдэл
// илгээх" болгож сольсон (notifications.js/fintax.js — үндсэн зар/мэдэгдэл
// илгээх үйлдэл хэвээрээ үлдсэн, зөвхөн "Ирсэн" таб нь ЭНЭ хуудсаар орлогдож
// устгагдсан).
//
// Үзэл баримтлал: feedback_requests (resident-ийн бичсэн) + notifications
// (recipient_kind='resident', recipient_filter='specific', тухайн resident-д
// чиглэсэн)-ийг НЭГ thread болгож апт тус бүрээр нэгтгэж үзүүлнэ.

let _ccThreads = [];      // [{apt, residentName, lastText, lastAt, unread}]
let _ccActiveApt = null;
let _ccActiveMessages = []; // нэгтгэсэн (incoming+outgoing) зурвасууд, цагийн дарааллаар
let _ccRealtimeReady = false;
let _ccEditingId = null; // ⚠️ 2026-08-05 нэмэв: аль зурвасыг зурвас бичих талбарт засварлаж буй эсэх (null = шинэ зурвас)

// ⚠️ 2026-08-05 нэмэв: userapp-ийн CallLog.jsx-тэй ижил зурган attachment
// (compress 800×600 JPG, private "cc-attachments" bucket, 1 сарын дараа
// сервер талд автомат устгагдана). Private bucket тул URL үргэлж
// createSignedUrl()-ээр л үүсдэг.
async function _ccResolveAttachmentUrl(path) {
  if (!path) return null;
  const { data, error } = await sb.storage.from('cc-attachments').createSignedUrl(path, 315360000);
  if (error) return null;
  return data.signedUrl;
}

async function _ccCompressImage(file, maxW = 800, maxH = 600, quality = 0.8) {
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
let _ccStatuses = {}; // {apt: {muted, solved, urgent}} — Mute/Solved/Urgent тэмдэглэгээ
let _ccPendingOpen = null; // {kind:'resident', apt} — Резидентийн дэлгэрэнгүй modal-аас "CC center" товч дарж шилжихэд ашиглана

// Резидентийн дэлгэрэнгүй modal-аас "CC center" товч
// дарахад дуудагдана — CC center хуудас руу шилжиж, шууд тухайн харилцагчийн
// thread-ыг нээнэ (race condition үүсэхгүйгээр _ccPendingOpen-ээр дамжуулна).
function openCCForResident(apt) { _ccPendingOpen = { kind: 'resident', apt }; showPage('cc-center'); }

async function renderCCCenterPage() {
  await loadCCThreadList();
  const pending = _ccPendingOpen; _ccPendingOpen = null;
  if (pending?.kind === 'resident') {
    await selectCCThread(pending.apt);
  } else {
    document.getElementById('cc-thread-view').innerHTML =
      `<div class="empty-state" style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">Зүүн талаас харилцагч сонгоно уу</div>`;
    _ccActiveApt = null;
  }
  _ccSetupRealtime();
}

// ⚠️ 2026-07-30 нэмэв: refresh хийхгүйгээр шинэ зурвас шууд (real-time) орж
// ирдэг болгох Supabase Realtime сонголт. Зөвхөн НЭГ УДАА бүртгэгдэнэ
// (хуудас руу дахин орох бүрт дахин subscribe хийхгүй байх guard-тай).
function _ccSetupRealtime() {
  if (_ccRealtimeReady) return;
  _ccRealtimeReady = true;
  sb.channel('cc-feedback-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedback_requests' }, async (payload) => {
      const row = payload.new;
      await loadCCThreadList(); // жагсаалт (сүүлийн зурвас/эрэмбэ/badge) шинэчлэгдэнэ
      if (String(_ccActiveApt) === String(row.apt)) {
        // Одоо нээлттэй байгаа thread-д зохирвол — дахин бүтэн ачаалахгүйгээр нэмнэ
        const attachmentUrl = row.attachment_path ? await _ccResolveAttachmentUrl(row.attachment_path) : null;
        _ccActiveMessages.push({ dir: 'in', text: row.content, at: row.created_at, id: row.id, attachmentPath: row.attachment_path, attachmentUrl });
        const resident = residents.find(x => String(x.apt) === String(row.apt));
        renderCCThreadView(row.apt, resident);
        // Нээлттэй байхад ирсэн тул шууд "хянасан" гэж тэмдэглэнэ
        await sb.from('feedback_requests').update({ status: 'reviewed' }).eq('id', row.id);
        await loadCCThreadList();
      }
    })
    // ⚠️ 2026-07-30 нэмэв: ӨӨР ажилтан (өөр browser/session-оос) ЯГ ЭНЭ resident-д
    // хариу илгээхэд, миний дэлгэц дээр ч шууд харагдана — ингэснээр 2 ажилтан
    // зэрэг харилцаж, давхардсан/зөрчилтэй хариу илгээх эрсдэлээс сэргийлнэ.
    // ⚠️ 2026-08-04 засав: source!=='cc-center' шүүлтүүр нэмэв (өөр төрлийн
    // single-recipient мэдэгдэл — жишээ нь төлбөрийн сануулга — CC жагсаалтад
    // орохоос сэргийлнэ), мөн loadCCThreadList() дуудаж ШИНЭ (feedback_requests-гүй)
    // харилцааг ч зүүн жагсаалтад шууд (realtime) гаргадаг болгов.
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async (payload) => {
      const row = payload.new;
      if (row.source !== 'cc-center' || row.recipient_kind !== 'resident' || row.recipient_filter !== 'specific') return;
      const resident = residents.find(x => x.id === row.recipient_specific_id);
      if (!resident) return;
      await loadCCThreadList();
      if (String(_ccActiveApt) !== String(resident.apt)) return;
      // Миний ӨӨРИЙН sendCCReply()-ээс аль хэдийн нэмэгдсэн зурвасыг давхар нэмэхгүй
      if (_ccActiveMessages.some(m => m.dir === 'out' && m.at === row.sent_at && m.text === row.content)) return;
      const attachmentUrl = row.attachment_path ? await _ccResolveAttachmentUrl(row.attachment_path) : null;
      _ccActiveMessages.push({ dir: 'out', text: row.content, at: row.sent_at, sender: row.sender_name, id: row.id, attachmentPath: row.attachment_path, attachmentUrl });
      renderCCThreadView(resident.apt, resident);
    })
    .subscribe();

  _ccSetupTypingChannel();
}

// ⚠️ 2026-07-30 нэмэв: "Typing..." animation — Supabase Realtime Broadcast
// (өгөгдлийн сан бичихгүй, зүгээр л шууд дохио дамжуулдаг сувгаар) ашиглав.
let _ccTypingChannel = null;
let _ccTypingSendGate = 0;   // throttle — 1.5с-д 1 удаа л дохио явуулна
let _ccTypingHideTimer = null;

function _ccSetupTypingChannel() {
  if (_ccTypingChannel) return;
  _ccTypingChannel = sb.channel('cc-typing-broadcast');
  _ccTypingChannel.on('broadcast', { event: 'typing' }, (msg) => {
    const { apt, senderName } = msg.payload || {};
    if (String(apt) !== String(_ccActiveApt)) return;
    const indicator = document.getElementById('cc-typing-indicator');
    if (!indicator) return;
    indicator.textContent = `${senderName || 'Ажилтан'} бичиж байна...`;
    indicator.style.display = '';
    clearTimeout(_ccTypingHideTimer);
    _ccTypingHideTimer = setTimeout(() => { indicator.style.display = 'none'; }, 3000);
  }).subscribe();
}

function notifyCCTyping(apt) {
  if (!_ccTypingChannel) return;
  const now = Date.now();
  if (now - _ccTypingSendGate < 1500) return; // throttle
  _ccTypingSendGate = now;
  _ccTypingChannel.send({
    type: 'broadcast', event: 'typing',
    payload: { apt, senderName: _mySenderInfo?.name || currentProfile?.full_name || 'Ажилтан' },
  });
}

async function loadCCThreadList() {
  const [{ data: feedback, error }, { data: outgoing, error: outErr }, { data: statuses }] = await Promise.all([
    sb.from('feedback_requests').select('*').order('created_at', { ascending: false }),
    // ⚠️ 2026-08-04 нэмэв: Admin-аас ЭХЭЛСЭН (резидентээс ирсэн зурвасгүй) харилцааг
    // мөн жагсаалтад оруулахын тулд — өмнө зөвхөн feedback_requests-ээс төлөв
    // үүсгэдэг байсан тул ийм харилцагч зүүн жагсаалтад ОГТ ХАРАГДДАГГүй байсан.
    sb.from('notifications').select('*').eq('source', 'cc-center').eq('recipient_kind', 'resident').eq('recipient_filter', 'specific').order('sent_at', { ascending: false }),
    sb.from('cc_thread_status').select('*'),
  ]);
  if (error) { console.error('feedback_requests ачаалахад алдаа:', error.message); return; }
  if (outErr) { console.error('notifications (cc-center) ачаалахад алдаа:', outErr.message); }

  _ccStatuses = {};
  (statuses || []).forEach(s => { _ccStatuses[String(s.apt)] = { muted: s.muted, urgent: s.urgent, pinned: s.pinned }; });

  const byApt = {};
  (feedback || []).forEach(f => {
    const key = String(f.apt);
    if (!byApt[key]) byApt[key] = { apt: f.apt, lastText: f.content, lastAt: f.created_at, unread: 0 };
    if (new Date(f.created_at) > new Date(byApt[key].lastAt)) { byApt[key].lastText = f.content; byApt[key].lastAt = f.created_at; }
    if (f.status === 'new') byApt[key].unread++;
  });

  (outgoing || []).forEach(n => {
    const resident = residents.find(x => x.id === n.recipient_specific_id);
    if (!resident) return;
    const key = String(resident.apt);
    if (!byApt[key]) byApt[key] = { apt: resident.apt, lastText: n.content, lastAt: n.sent_at, unread: 0 };
    else if (new Date(n.sent_at) > new Date(byApt[key].lastAt)) { byApt[key].lastText = n.content; byApt[key].lastAt = n.sent_at; }
  });

  _ccThreads = Object.values(byApt).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
  renderCCThreadList();
  updateCCBadge();
}

function _ccGetStatus(apt) {
  return _ccStatuses[String(apt)] || { muted: false, urgent: false, pinned: false };
}

function _ccResidentLabel(apt) {
  const r = residents.find(x => String(x.apt) === String(apt));
  return r ? `${r.firstname || ''} ${r.lastname || ''}`.trim() || String(apt) : String(apt);
}
function _ccInitials(apt) {
  const r = residents.find(x => String(x.apt) === String(apt));
  const name = r ? `${r.firstname || ''} ${r.lastname || ''}`.trim() : '';
  const parts = name.split(' ').filter(Boolean);
  return parts.length ? parts.map(p => p[0]).slice(0, 2).join('').toUpperCase() : '??';
}
function _ccFmtTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 1) return 'Өчигдөр';
  if (diffDays < 7) return `${diffDays} өдөр`;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function renderCCThreadList() {
  const container = document.getElementById('cc-thread-list');
  if (!container) return;
  const q = (document.getElementById('cc-search')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('cc-status-filter')?.value || 'all';
  const list = _ccThreads.filter(t => {
    if (q) {
      const hay = `${t.apt} ${_ccResidentLabel(t.apt)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const st = _ccGetStatus(t.apt);
    if (statusFilter === 'muted' && !st.muted) return false;
    if (statusFilter === 'urgent' && !st.urgent) return false;
    if (statusFilter === 'unread' && !(t.unread > 0)) return false;
    return true;
  });
  if (!list.length) { container.innerHTML = '<div class="empty-state" style="padding:20px 14px;color:var(--text-muted);font-size:12.5px">Санал, хүсэлт алга</div>'; return; }

  // ⚠️ 2026-08-05 нэмэв: Pin хийсэн thread-үүд жагсаалтын дээд талд, доор нь
  // үлдсэн бүх thread хэвийн (сүүлийн мсж-ээр, аль хэдийн эрэмбэлэгдсэн) дараалалтай.
  // Аль аль ажилтанд ижил (глобал) харагдана — cc_thread_status.pinned хуваалцсан багана.
  const pinnedList = list.filter(t => _ccGetStatus(t.apt).pinned);
  const unpinnedList = list.filter(t => !_ccGetStatus(t.apt).pinned);

  container.innerHTML = pinnedList.map(t => _ccRenderThreadItem(t)).join('')
    + (pinnedList.length && unpinnedList.length ? '<div style="height:2px;background:var(--accent);margin:0"></div>' : '')
    + unpinnedList.map(t => _ccRenderThreadItem(t)).join('');
}

function _ccRenderThreadItem(t) {
    const st = _ccGetStatus(t.apt);
    // ⚠️ 2026-08-04 засав: Solved/Unsolved тэмдэглэгээ бүрмөсөн устгав (CC center
    // бол зөвхөн харилцах суваг — "шийдвэрлэлт" тэмдэглэх дамий гэж үзсэн).
    // Muted/Urgent хоёрхон төлөв үлдэв, дараах байдлаар илэрхийлнэ:
    //   Urgent → avatar-ийн дугуй хүрээ УЛААН
    //   Muted  → avatar дотор, инициаль үсгийн УРД ТАЛД диаметрийн 70% хэмжээтэй
    //             тунгалаг фонтой цагаан SVG mic-mute icon (badge/overlay-г БүХ
    //             хүлээж үзсэний дараа үүнийг сонгосон — хүрээнд хүрдэггүй,
    //             бүдгэрүүлдэггүй, тод харагдана). 2026-08-05: анхны mic дүрсээ буцаав.
    const avatarBorder = st.urgent ? 'border:1px solid var(--danger)' : 'border:1px solid var(--border-light)';
    const muteIcon = st.muted ? `<div title="Muted" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
    </div>` : '';
    return `
    <div class="cc-thread-item" data-apt="${t.apt}" onclick="selectCCThread('${t.apt}')"
      style="display:flex;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;position:relative;${String(_ccActiveApt) === String(t.apt) ? 'background:var(--accent-glow);border-left:3px solid var(--accent);padding-left:11px' : ''}">
      <div style="position:relative;width:38px;height:38px;flex-shrink:0">
        <div style="width:38px;height:38px;border-radius:50%;background:var(--bg-card);${avatarBorder};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--accent)">${esc(_ccInitials(t.apt))}</div>
        ${muteIcon}
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;gap:6px;align-items:center">
          <span style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(_ccResidentLabel(t.apt))} (${esc(String(t.apt))})</span>
          <span style="font-size:10.5px;color:var(--text-muted);flex-shrink:0">${esc(_ccFmtTime(t.lastAt))}</span>
        </div>
        <div style="font-size:12px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${esc(t.lastText || '')}</div>
      </div>
      ${t.unread > 0 ? `<span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);width:9px;height:9px;border-radius:50%;background:var(--accent)"></span>` : ''}
    </div>
  `;
}

async function selectCCThread(apt) {
  // ⚠️ 2026-08-05 нэмэв: thread солиход өмнөх thread дээрх засварлалтын
  // (хэрэв дуусаагүй орхисон бол) төлөв дараагийн thread рүү "алдагдалгүй"
  // дамжихаас сэргийлнэ.
  if (String(_ccActiveApt) !== String(apt)) _ccEditingId = null;
  _ccActiveApt = apt;
  renderCCThreadList();

  const resident = residents.find(x => String(x.apt) === String(apt));

  const [{ data: incoming }, { data: outgoing }] = await Promise.all([
    sb.from('feedback_requests').select('*').eq('apt', apt).order('created_at', { ascending: true }),
    resident
      ? sb.from('notifications').select('*').eq('recipient_kind', 'resident').eq('recipient_filter', 'specific').eq('recipient_specific_id', resident.id).order('sent_at', { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  _ccActiveMessages = [
    ...(incoming || []).map(m => ({ dir: 'in', text: m.content, at: m.created_at, id: m.id, attachmentPath: m.attachment_path })),
    ...(outgoing || []).map(m => ({ dir: 'out', text: m.content, at: m.sent_at, sender: m.sender_name, id: m.id, readAt: m.read_at, attachmentPath: m.attachment_path })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
  // ⚠️ private bucket тул attachment бүхий мсж бүрт signed URL зэрэгцүүлж (Promise.all) тайлна
  _ccActiveMessages = await Promise.all(_ccActiveMessages.map(async m => ({
    ...m,
    attachmentUrl: m.attachmentPath ? await _ccResolveAttachmentUrl(m.attachmentPath) : null,
  })));

  // Нээж үзсэн бүх "шинэ" feedback-ийг "хянасан" болгоно
  const newIds = (incoming || []).filter(m => m.status === 'new').map(m => m.id);
  if (newIds.length) {
    await sb.from('feedback_requests').update({ status: 'reviewed' }).in('id', newIds);
    await loadCCThreadList();
    _ccActiveApt = apt;
    renderCCThreadList();
  }

  renderCCThreadView(apt, resident);
}

function renderCCThreadView(apt, resident) {
  const view = document.getElementById('cc-thread-view');
  if (!view) return;
  const canReply = canWrite('cc-center');

  let lastDay = '';
  const bubbles = _ccActiveMessages.map(m => {
    const d = new Date(m.at);
    const dayStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    let dayDivider = '';
    if (dayStr !== lastDay) { dayDivider = `<div style="align-self:center;font-size:10.5px;color:var(--text-muted);background:var(--bg-card);padding:3px 12px;border-radius:20px;margin:6px 0">${dayStr}</div>`; lastDay = dayStr; }
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const isOut = m.dir === 'out';
    // ⚠️ 2026-07-30: илгээсэн (out) bubble-ийн дэвсгэрийг --accent-dark болгов —
    // --accent (ижил өнгө) нь "Илгээх" товчны өнгөтэй яг давхцаж байсныг
    // ялгаатай болгох хүсэлтээр.
    // ⚠️ 2026-08-05 нэмэв: Read receipt (✓ илгээсэн / ✓✓ уншсан) болон өөрийн
    // (out) илгээсэн мсж-д Edit/Delete жижиг текст товч. ⚠️ readAt зөвхөн
    // резидент талын (userapp/CallLog.jsx) кодоор бичигдэх ёстой — энэ удаад
    // зөвхөн АДМИН талыг бэлдсэн тул, резидент тал холбогдох хүртэл ✓✓
    // ХЭЗЭЭ Ч гарахгүй (readAt үргэлж null үлдэнэ) — дараагийн алхамд CallLog.jsx-д
    // түүнийг бичих кодыг нэмэх шаардлагатай.
    const readReceipt = isOut ? `<span style="margin-left:4px;color:${m.readAt ? 'var(--accent)' : 'var(--text-muted)'}">${m.readAt ? '✓✓' : '✓'}</span>` : '';
    const editDelete = isOut && m.id ? `<span style="margin-left:8px;cursor:pointer" onclick="_ccEditMessage(${m.id})">Edit</span><span style="margin-left:6px;cursor:pointer;color:var(--danger)" onclick="_ccDeleteMessage(${m.id},'${apt}')">Delete</span>` : '';
    // ⚠️ 2026-08-05 засав: bubble (background/padding/border-radius) бүрэн
    // арилгав — userapp/CallLog.jsx-тэй ижил зарчим (зөвхөн текст+эгнүүлэлт).
    // Үүнийг сая нэмсэн зурган attachment-ыг "зузаан хүрээтэй хачин эффект"-гүйгээр
    // харуулах шаардлагаас үүдэлтэйгээр хийв.
    const attachmentImg = m.attachmentUrl ? `<img src="${m.attachmentUrl}" alt="Хавсаргасан зураг" style="max-width:100%;border-radius:8px;display:block;${m.text ? 'margin-bottom:4px' : ''}">` : '';
    return `${dayDivider}
      <div style="display:flex;flex-direction:column;max-width:62%;align-self:${isOut ? 'flex-end' : 'flex-start'}">
        ${attachmentImg}
        ${m.text ? `<div style="padding:0 4px;font-size:13px;line-height:1.5;color:var(--text);text-align:${isOut ? 'right' : 'left'};white-space:pre-wrap">${esc(m.text)}</div>` : ''}
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px;padding:0 4px;text-align:${isOut ? 'right' : 'left'}">${timeStr}${isOut && m.sender ? ' · ' + esc(m.sender) : ''}${readReceipt}${editDelete}</div>
      </div>`;
  }).join('');

  // ⚠️ 2026-08-05 засав: residentClick доторх "style=cursor:pointer" болон гадна
  // талын "style=flex:1;min-width:0" ХОЁУЛАА ижил div дээр давхарлагдаж (HTML
  // duplicate attribute) байсан тул browser эхний style-ыг л хүлээн авч, flex:1
  // үл ажилладаг байв — үүнээс болж товчнуудын байрлал нэрний уртаас хамааран
  // "хөдөлдөг" харагдаж байсан. Нэг style attribute-д нэгтгэв.
  const residentOnclick = resident ? `onclick="openResidentDetail(${resident.id})"` : '';
  const residentCursor = resident ? 'cursor:pointer;' : '';
  const st = _ccGetStatus(apt);
  const pillBase = 'border:1px solid var(--border);border-radius:20px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;background:transparent;color:var(--text-dim)';
  // ⚠️ 2026-08-05 засав: "Muted" идэвхтэй үедээ хүрээний өнгө текстийн (var(--text),
  // цагаан) өнгөтэй адил болгов — өмнө нь border-light (саарал) байсныг тодотгов.
  const muteBtn = `<button onclick="toggleCCStatus('${apt}','muted')" style="${pillBase}${st.muted ? ';background:var(--bg-card);color:var(--text);border-color:var(--text)' : ''}">${st.muted ? 'Muted' : 'Mute'}</button>`;
  const urgentBtn = `<button onclick="toggleCCStatus('${apt}','urgent')" style="${pillBase}${st.urgent ? ';background:var(--danger-bg);color:var(--danger);border-color:var(--danger)' : ''}">${st.urgent ? 'Urgent' : 'Normal'}</button>`;
  // ⚠️ 2026-08-05 нэмэв: Pin товч — icon/emoji-гүй, зөвхөн "Pin"/"Unpin" текст.
  // Пин хийх/арилгах эрх бүх ажилтанд адилхан (глобал багана, тусгайлсан эрх/
  // хэрэглэгч тус бүрийн pin ЗОРИУДААР хийгээгүй — олон ажилтан ярианадаа
  // ижил зурвасыг "хамгийн дээрх" гэж нэрлэж ойлголцоход төөрөгдөл гарахаас сэргийлэв).
  const pinBtn = `<button onclick="toggleCCStatus('${apt}','pinned')" style="${pillBase}${st.pinned ? ';background:var(--bg-card);color:var(--text);border-color:var(--text)' : ''}">${st.pinned ? 'Unpin' : 'Pin'}</button>`;
  // ⚠️ 2026-08-04 засав: Solved/Unsolved төлөв бүрмөсөн арилгав (CC center
  // бол зөвхөн харилцах суваг, "шийдвэрлэсэн эсэх" тэмдэглэл үүрэгт нь
  // таарахгүй гэж үзсэн). Urgent-ийг avatar-ийн улаан хүрээгээр, Muted-ийг
  // avatar дотор жижиг mute icon-оор дүрсэлдэг болов.
  const avatarBorder = st.urgent ? 'border:1px solid var(--danger)' : 'border:1px solid var(--border-light)';
  const muteIcon = st.muted ? `<div title="Muted" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
  </div>` : '';

  view.innerHTML = `
    <!-- ⚠️ 2026-08-05 засав: зүүн шүүлтүүрийн бар (suh.html, padding:12px) болон
         энэ thread header (padding:14px 20px) padding өөр байснаас доод хүрээ
         2 самбарт өөр өндэрт тулж, "зөрсөн" мэт харагдаж байсныг ХОЁУЛАНД нь
         адил height:65px;box-sizing:border-box өгч нэг шугам дээр тэнцүүлэв. -->
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;background:var(--bg-surface);height:65px;box-sizing:border-box">
      <div style="position:relative;flex-shrink:0">
        <div style="width:34px;height:34px;border-radius:50%;background:var(--bg-card);${avatarBorder};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--accent)">${esc(_ccInitials(apt))}</div>
        ${muteIcon}
      </div>
      <div ${residentOnclick} style="${residentCursor}flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700">${esc(_ccResidentLabel(apt))}</div>
        <div style="font-size:11.5px;color:var(--text-muted)">${esc(String(apt))} тоот</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">${pinBtn}${muteBtn}${urgentBtn}</div>
    </div>
    <div id="cc-messages" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px">${bubbles || '<div class="empty-state" style="color:var(--text-muted)">Зурвас алга</div>'}</div>
    <div id="cc-typing-indicator" style="display:none;padding:2px 20px;font-size:11px;color:var(--text-muted);font-style:italic"></div>
    ${canReply ? `
    <style>
      /* ⚠️ 2026-08-05 нэмэв: userapp-ийн CallLog.jsx-тэй ижил засвар — глобал
         "input:focus,textarea:focus{box-shadow:...}" дүрмийг зөвхөн энэ
         textarea-д ID-ийн өндөр specificity-ээр дарж, цэнхэр хүрээг арилгав.
         ⚠️ 2026-08-05 нэмэв (2): suh.html-ийн глобал "textarea{min-height:80px}"
         дүрэм inline height-ийг "дарж" байсан ҮНДСЭН ШАЛТГААН нь энэ байсан —
         min-height ба height ХОЁР ӨӨР property тул inline "height" min-height-ийг
         дарж чадахгүй. ID-ийн давуу эрхээр min-height-ийг ч мөн дарав.
         ⚠️ 2026-08-05 нэмэв (3): 34px = Send товчны диаметртэй яг тэнцүү болгов
         (border-box: 6px+6px padding + 20px line-height + 2px border = 34px) —
         өмнө нь энэ тооцоо биелээгүй тул богино текст дээр ч scrollbar гарч байв. */
      #cc-reply-text { min-height: 34px; }
      #cc-reply-text:focus { outline: none; box-shadow: none; border-color: var(--border); }
    </style>
    <div id="cc-editing-banner" style="display:${_ccEditingId ? 'flex' : 'none'};align-items:center;gap:10px;padding:6px 20px;background:var(--bg-card);border-top:1px solid var(--border);font-size:11.5px;color:var(--text-muted)">
      Зурвас засварлаж байна <span style="cursor:pointer;color:var(--accent)" onclick="_ccCancelEdit()">Цуцлах</span>
    </div>
    <div style="border-top:1px solid var(--border);padding:10px 20px;background:var(--bg-surface);display:flex;gap:10px;align-items:flex-end">
      <div style="position:relative;flex:1">
        <textarea id="cc-reply-text" placeholder="Хариу бичих..." rows="1"
          oninput="notifyCCTyping('${apt}');_ccAutoGrowReply()"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendCCReply('${apt}');}"
          style="width:100%;background:var(--bg-card);border:1px solid var(--border);border-radius:4px;padding:6px 30px 6px 14px;color:var(--text);font-size:13px;line-height:20px;font-family:inherit;resize:none;height:34px;max-height:120px;box-sizing:border-box;overflow-y:auto">${_ccEditingId ? esc((_ccActiveMessages.find(m => m.id === _ccEditingId) || {}).text || '') : ''}</textarea>
        <button onclick="_ccPickFile('${apt}')" id="cc-attach-btn" style="position:absolute;right:8px;bottom:8px;background:transparent;border:none;padding:0;cursor:pointer;color:var(--text-muted);display:flex">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="M21 15l-5.2-5.2a2 2 0 0 0-2.8 0L5 18"/></svg>
        </button>
      </div>
      <button aria-label="Илгээх" onclick="sendCCReply('${apt}')" style="width:34px;height:34px;flex-shrink:0;border-radius:50%;border:none;outline:none;background:var(--accent);box-shadow:none;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.4 20.6L21.2 12.6C21.9 12.3 21.9 11.7 21.2 11.4L3.4 3.4C2.7 3.1 2.3 3.5 2.5 4.2L4.9 11.1C5 11.4 5.3 11.7 5.6 11.7L14.5 12L5.6 12.3C5.3 12.3 5 12.6 4.9 12.9L2.5 19.8C2.3 20.5 2.7 20.9 3.4 20.6Z" fill="#fff"/></svg>
      </button>
    </div>
    <div id="cc-upload-status" style="display:none;padding:0 20px 6px;font-size:11px;color:var(--text-muted)">Зураг илгээж байна...</div>
    <input id="cc-file-input" type="file" accept="image/*" style="display:none" onchange="_ccHandleFileSelected(event)">` : ''}
  `;
  const msgBox = document.getElementById('cc-messages');
  if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
  // ⚠️ 2026-08-05 нэмэв: render болмогц JS-ээр бодит scrollHeight-аар нь
  // өндрийг тооцоолуулна — inline height:28px тооцоолсноос илүү нарийвчлалтай,
  // хуучин утга "үлдэх" зөрчлөөс сэргийлнэ.
  _ccAutoGrowReply();
}

// ⚠️ 2026-08-05 засав: userapp-ийн CallLog.jsx-тэй ижил автомат өндөр сунгах логик —
// 28px (яг нэг мөр текстийн өндөр)-ээс эхэлж, бичсэн текстийн дагуу 120px хүртэл
// өсөж, түүнээс цааш дотроо scroll. renderCCThreadView()-ийн эцэст ч дуудагдаж,
// хуучин утга "үлдэх" зөрчлөөс сэргийлнэ.
function _ccAutoGrowReply() {
  const el = document.getElementById('cc-reply-text');
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(34, Math.min(el.scrollHeight, 120)) + 'px';
}

async function sendCCReply(apt) {
  const textEl = document.getElementById('cc-reply-text');
  const text = (textEl?.value || '').trim();
  if (!text) { toast('Хариултаа бичнэ үү', 'error'); return; }

  // ⚠️ 2026-08-05 нэмэв: _ccEditingId тавигдсан бол шинэ мсж INSERT хийхийн
  // оронд ХУУЧИН мсж-г UPDATE хийнэ (зурвас бичих талбарт хийсэн засвар).
  if (_ccEditingId) {
    const { error } = await sb.from('notifications').update({ content: text }).eq('id', _ccEditingId);
    if (error) { toast('Засварлахад алдаа гарлаа', 'error'); return; }
    _ccCancelEdit();
    toast('Засварлагдлаа ✓', 'success');
    await selectCCThread(apt);
    return;
  }

  const resident = residents.find(x => String(x.apt) === String(apt));
  if (!resident) { toast('Тухайн тоотод бүртгэлтэй сууц өмчлөгч олдсонгүй', 'error'); return; }
  await loadMySenderInfo();

  const label = `${apt} — ${resident.firstname || ''} ${resident.lastname || ''}`.trim();
  const row = {
    type: 'notice', title: 'Таны илгээсэн санал, хүсэлтэд хариу', content: text,
    recipient: label, date: todayStr(), sent: 1,
    recipient_kind: 'resident', recipient_filter: 'specific', recipient_specific_id: resident.id,
    category: 'notice', channels: ['inapp'], source: 'cc-center',
    recipients_snapshot: [{ name: resident.firstname + ' ' + resident.lastname, apt, ref_type: 'resident', ref_id: resident.id, title: 'Таны илгээсэн санал, хүсэлтэд хариу', content: text }],
    sender_id: currentUser?.id || null,
    sender_name: _mySenderInfo?.name || null,
    sender_position: _mySenderInfo?.position || null,
    sent_at: new Date().toISOString(),
  };
  const ok = await db_saveNotificationNew(row);
  if (!ok) { toast('Илгээхэд алдаа гарлаа', 'error'); return; }

  logActivity('notify', 'cc-center', notifications[0]?.id || null, `${label} — Хариу`);
  await triggerPushForRecipients([{ apt, content: text }], 'Таны илгээсэн санал, хүсэлтэд хариу');

  textEl.value = '';
  toast('Хариу илгээгдлээ ✓', 'success');
  await selectCCThread(apt);
}

async function updateCCBadge() {
  const [{ data: rows, error }, { data: statuses }] = await Promise.all([
    sb.from('feedback_requests').select('apt').eq('status', 'new'),
    sb.from('cc_thread_status').select('apt').eq('muted', true),
  ]);
  const badge = document.getElementById('cc-center-badge');
  if (!badge || error) return;
  const mutedApts = new Set((statuses || []).map(s => String(s.apt)));
  const count = (rows || []).filter(r => !mutedApts.has(String(r.apt))).length;
  if (count > 0) { badge.textContent = count; badge.style.display = ''; }
  else badge.style.display = 'none';
}

async function toggleCCStatus(apt, field) {
  const current = _ccGetStatus(apt);
  const next = { muted: current.muted, solved: current.solved, urgent: current.urgent, pinned: current.pinned };
  next[field] = !next[field];

  const { error } = await sb.from('cc_thread_status').upsert(
    { apt, muted: next.muted, solved: next.solved, urgent: next.urgent, pinned: next.pinned, updated_at: new Date().toISOString() },
    { onConflict: 'apt' }
  );
  if (error) { toast('Тэмдэглэхэд алдаа гарлаа', 'error'); return; }

  _ccStatuses[String(apt)] = next;
  renderCCThreadList();
  if (String(_ccActiveApt) === String(apt)) {
    const resident = residents.find(x => String(x.apt) === String(apt));
    renderCCThreadView(apt, resident);
  }
}

// ⚠️ 2026-08-05 засав: Pop-Up (prompt()) цонхонд БИШ, зурвас бичих талбарт
// (#cc-reply-text) л засвар хийдэг болов — _ccEditingId тавьж, "Илгээх" товч
// дараа нь sendCCReply()-д UPDATE (INSERT-ийн оронд) хийхийг мэдэгдэнэ.
function _ccEditMessage(id) {
  const msg = _ccActiveMessages.find(m => m.id === id && m.dir === 'out');
  if (!msg) return;
  _ccEditingId = id;
  const el = document.getElementById('cc-reply-text');
  if (!el) return;
  el.value = msg.text;
  el.focus();
  _ccAutoGrowReply();
  const banner = document.getElementById('cc-editing-banner');
  if (banner) banner.style.display = 'flex';
}

function _ccCancelEdit() {
  _ccEditingId = null;
  const el = document.getElementById('cc-reply-text');
  if (el) { el.value = ''; _ccAutoGrowReply(); }
  const banner = document.getElementById('cc-editing-banner');
  if (banner) banner.style.display = 'none';
}

async function _ccDeleteMessage(id, apt) {
  if (!confirm('Энэ зурвасыг устгах уу?')) return;
  const { error } = await sb.from('notifications').delete().eq('id', id);
  if (error) { toast('Устгахад алдаа гарлаа', 'error'); return; }
  if (_ccEditingId === id) _ccCancelEdit();
  await loadCCThreadList();
  await selectCCThread(apt);
}

// ⚠️ 2026-08-05 засав: custom modal (Photo Library/Take Photo сонголт) арилгав —
// browser-ийн НАТИВ file picker өөрөө мөн адил сонголтуудыг (Photo Library/
// Take Photo/Choose File) өгдөг тул 2 давхар (redundant) поп-ап үүсгэж
// байсан. Одоо userapp Profile-ийн загвартай яг адил, шууд ганц native
// input л дуудна.
let _ccAttachTargetApt = null;
function _ccPickFile(apt) {
  _ccAttachTargetApt = apt;
  document.getElementById('cc-file-input')?.click();
}
async function _ccHandleFileSelected(event) {
  const file = event.target.files?.[0];
  event.target.value = ''; // ижил файлыг дахин сонгож болохоор reset хийнэ
  const apt = _ccAttachTargetApt;
  if (!file || !apt) return;
  const statusEl = document.getElementById('cc-upload-status');
  if (statusEl) statusEl.style.display = 'block';
  try {
    const blob = await _ccCompressImage(file);
    const path = `${apt}/${Date.now()}.jpg`;
    const { error: upErr } = await sb.storage.from('cc-attachments').upload(path, blob, { contentType: 'image/jpeg' });
    if (upErr) throw upErr;
    await loadMySenderInfo();
    const resident = residents.find(x => String(x.apt) === String(apt));
    if (!resident) throw new Error('resident олдсонгүй');
    const label = `${apt} — ${resident.firstname || ''} ${resident.lastname || ''}`.trim();
    const row = {
      type: 'notice', title: 'Таны илгээсэн санал, хүсэлтэд хариу', content: '',
      recipient: label, date: todayStr(), sent: 1,
      recipient_kind: 'resident', recipient_filter: 'specific', recipient_specific_id: resident.id,
      category: 'notice', channels: ['inapp'], source: 'cc-center', attachment_path: path,
      recipients_snapshot: [{ name: resident.firstname + ' ' + resident.lastname, apt, ref_type: 'resident', ref_id: resident.id, title: 'Таны илгээсэн санал, хүсэлтэд хариу', content: '' }],
      sender_id: currentUser?.id || null,
      sender_name: _mySenderInfo?.name || null,
      sender_position: _mySenderInfo?.position || null,
      sent_at: new Date().toISOString(),
    };
    const ok = await db_saveNotificationNew(row);
    if (!ok) throw new Error('insert алдаа');
    logActivity('notify', 'cc-center', notifications[0]?.id || null, `${label} — Зураг`);
    await selectCCThread(apt);
  } catch (e) {
    toast('Зураг илгээхэд алдаа гарлаа', 'error');
  } finally {
    if (statusEl) statusEl.style.display = 'none';
  }
}

