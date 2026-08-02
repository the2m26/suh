// cc-center-2.js — "CC center 2" санал болгосон chat/messenger маягийн загвар
// (2026-07-30 нэмэв). Одоо байгаа "CC center" (notifications.js/fintax.js)-ийг
// огт ХӨНДӨӨГүй, бүрэн ЗЭРЭГЦЭЭ ажиллана. Ажиллаж дуусаад тохирвол "CC center"-ийг
// үүнээр орлуулах (эсвэл унтраах) шийдвэрийг хэрэглэгч дараа гаргана.
//
// Үзэл баримтлал: feedback_requests (resident-ийн бичсэн) + notifications
// (recipient_kind='resident', recipient_filter='specific', тухайн resident-д
// чиглэсэн)-ийг НЭГ thread болгож апт тус бүрээр нэгтгэж үзүүлнэ.

let _cc2Threads = [];      // [{apt, residentName, lastText, lastAt, unread}]
let _cc2ActiveApt = null;
let _cc2ActiveMessages = []; // нэгтгэсэн (incoming+outgoing) зурвасууд, цагийн дарааллаар
let _cc2RealtimeReady = false;

async function renderCCCenter2Page() {
  await loadCC2ThreadList();
  document.getElementById('cc2-thread-view').innerHTML =
    `<div class="empty-state" style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">Зүүн талаас харилцагч сонгоно уу</div>`;
  _cc2ActiveApt = null;
  _cc2SetupRealtime();
}

// ⚠️ 2026-07-30 нэмэв: refresh хийхгүйгээр шинэ зурвас шууд (real-time) орж
// ирдэг болгох Supabase Realtime сонголт. Зөвхөн НЭГ УДАА бүртгэгдэнэ
// (хуудас руу дахин орох бүрт дахин subscribe хийхгүй байх guard-тай).
function _cc2SetupRealtime() {
  if (_cc2RealtimeReady) return;
  _cc2RealtimeReady = true;
  sb.channel('cc2-feedback-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedback_requests' }, async (payload) => {
      const row = payload.new;
      await loadCC2ThreadList(); // жагсаалт (сүүлийн зурвас/эрэмбэ/badge) шинэчлэгдэнэ
      if (String(_cc2ActiveApt) === String(row.apt)) {
        // Одоо нээлттэй байгаа thread-д зохирвол — дахин бүтэн ачаалахгүйгээр нэмнэ
        _cc2ActiveMessages.push({ dir: 'in', text: row.content, at: row.created_at });
        const resident = residents.find(x => String(x.apt) === String(row.apt));
        renderCC2ThreadView(row.apt, resident);
        // Нээлттэй байхад ирсэн тул шууд "хянасан" гэж тэмдэглэнэ
        await sb.from('feedback_requests').update({ status: 'reviewed' }).eq('id', row.id);
        await loadCC2ThreadList();
      }
    })
    .subscribe();
}

async function loadCC2ThreadList() {
  const { data: feedback, error } = await sb.from('feedback_requests').select('*').order('created_at', { ascending: false });
  if (error) { console.error('feedback_requests ачаалахад алдаа:', error.message); return; }

  const byApt = {};
  (feedback || []).forEach(f => {
    const key = String(f.apt);
    if (!byApt[key]) byApt[key] = { apt: f.apt, lastText: f.content, lastAt: f.created_at, unread: 0 };
    if (new Date(f.created_at) > new Date(byApt[key].lastAt)) { byApt[key].lastText = f.content; byApt[key].lastAt = f.created_at; }
    if (f.status === 'new') byApt[key].unread++;
  });

  _cc2Threads = Object.values(byApt).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
  renderCC2ThreadList();
  updateCC2Badge();
}

function _cc2ResidentLabel(apt) {
  const r = residents.find(x => String(x.apt) === String(apt));
  return r ? `${r.firstname || ''} ${r.lastname || ''}`.trim() || String(apt) : String(apt);
}
function _cc2Initials(apt) {
  const r = residents.find(x => String(x.apt) === String(apt));
  const name = r ? `${r.firstname || ''} ${r.lastname || ''}`.trim() : '';
  const parts = name.split(' ').filter(Boolean);
  return parts.length ? parts.map(p => p[0]).slice(0, 2).join('').toUpperCase() : '??';
}
function _cc2FmtTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 1) return 'Өчигдөр';
  if (diffDays < 7) return `${diffDays} өдөр`;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function renderCC2ThreadList() {
  const container = document.getElementById('cc2-thread-list');
  if (!container) return;
  const q = (document.getElementById('cc2-search')?.value || '').trim().toLowerCase();
  const list = _cc2Threads.filter(t => {
    if (!q) return true;
    const hay = `${t.apt} ${_cc2ResidentLabel(t.apt)}`.toLowerCase();
    return hay.includes(q);
  });
  if (!list.length) { container.innerHTML = '<div class="empty-state" style="padding:20px 14px;color:var(--text-muted);font-size:12.5px">Санал, хүсэлт алга</div>'; return; }

  container.innerHTML = list.map(t => `
    <div class="cc2-thread-item" data-apt="${t.apt}" onclick="selectCC2Thread('${t.apt}')"
      style="display:flex;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;position:relative;${String(_cc2ActiveApt) === String(t.apt) ? 'background:var(--accent-glow);border-left:3px solid var(--accent);padding-left:11px' : ''}">
      <div style="width:38px;height:38px;border-radius:50%;background:var(--bg-card);border:1px solid var(--border-light);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--accent);flex-shrink:0">${esc(_cc2Initials(t.apt))}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;gap:6px">
          <span style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(_cc2ResidentLabel(t.apt))} (${esc(String(t.apt))})</span>
          <span style="font-size:10.5px;color:var(--text-muted);flex-shrink:0">${esc(_cc2FmtTime(t.lastAt))}</span>
        </div>
        <div style="font-size:12px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${esc(t.lastText || '')}</div>
      </div>
      ${t.unread > 0 ? `<span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);width:9px;height:9px;border-radius:50%;background:var(--accent)"></span>` : ''}
    </div>
  `).join('');
}

async function selectCC2Thread(apt) {
  _cc2ActiveApt = apt;
  renderCC2ThreadList();

  const resident = residents.find(x => String(x.apt) === String(apt));

  const [{ data: incoming }, { data: outgoing }] = await Promise.all([
    sb.from('feedback_requests').select('*').eq('apt', apt).order('created_at', { ascending: true }),
    resident
      ? sb.from('notifications').select('*').eq('recipient_kind', 'resident').eq('recipient_filter', 'specific').eq('recipient_specific_id', resident.id).order('sent_at', { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  _cc2ActiveMessages = [
    ...(incoming || []).map(m => ({ dir: 'in', text: m.content, at: m.created_at })),
    ...(outgoing || []).map(m => ({ dir: 'out', text: m.content, at: m.sent_at, sender: m.sender_name })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  // Нээж үзсэн бүх "шинэ" feedback-ийг "хянасан" болгоно
  const newIds = (incoming || []).filter(m => m.status === 'new').map(m => m.id);
  if (newIds.length) {
    await sb.from('feedback_requests').update({ status: 'reviewed' }).in('id', newIds);
    await loadCC2ThreadList();
    _cc2ActiveApt = apt;
    renderCC2ThreadList();
  }

  renderCC2ThreadView(apt, resident);
}

function renderCC2ThreadView(apt, resident) {
  const view = document.getElementById('cc2-thread-view');
  if (!view) return;
  const canReply = canWrite('cc-center-2');

  let lastDay = '';
  const bubbles = _cc2ActiveMessages.map(m => {
    const d = new Date(m.at);
    const dayStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    let dayDivider = '';
    if (dayStr !== lastDay) { dayDivider = `<div style="align-self:center;font-size:10.5px;color:var(--text-muted);background:var(--bg-card);padding:3px 12px;border-radius:20px;margin:6px 0">${dayStr}</div>`; lastDay = dayStr; }
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const isOut = m.dir === 'out';
    // ⚠️ 2026-07-30: илгээсэн (out) bubble-ийн дэвсгэрийг --accent-dark болгов —
    // --accent (ижил өнгө) нь "Илгээх" товчны өнгөтэй яг давхцаж байсныг
    // ялгаатай болгох хүсэлтээр.
    return `${dayDivider}
      <div style="display:flex;flex-direction:column;max-width:62%;align-self:${isOut ? 'flex-end' : 'flex-start'}">
        <div style="padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;${isOut ? 'background:var(--accent-dark);color:#fff;border-top-right-radius:4px' : 'background:var(--bg-card);border:1px solid var(--border);border-top-left-radius:4px'}">${esc(m.text || '')}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:4px;padding:0 4px">${timeStr}${isOut && m.sender ? ' · ' + esc(m.sender) : ''}</div>
      </div>`;
  }).join('');

  const residentClick = resident ? `onclick="openResidentDetail(${resident.id})" style="cursor:pointer"` : '';

  view.innerHTML = `
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;background:var(--bg-surface)">
      <div style="width:34px;height:34px;border-radius:50%;background:var(--bg-card);border:1px solid var(--border-light);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--accent)">${esc(_cc2Initials(apt))}</div>
      <div ${residentClick}>
        <div style="font-size:14px;font-weight:700">${esc(_cc2ResidentLabel(apt))}</div>
        <div style="font-size:11.5px;color:var(--text-muted)">${esc(String(apt))} тоот</div>
      </div>
    </div>
    <div id="cc2-messages" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px">${bubbles || '<div class="empty-state" style="color:var(--text-muted)">Зурвас алга</div>'}</div>
    ${canReply ? `
    <div style="border-top:1px solid var(--border);padding:14px 20px;background:var(--bg-surface);display:flex;gap:10px;align-items:flex-end">
      <textarea id="cc2-reply-text" placeholder="Хариу бичих..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendCC2Reply('${apt}');}" style="flex:1;background:var(--bg-card);border:1px solid var(--border);border-radius:4px;padding:10px 14px;color:var(--text);font-size:13px;font-family:inherit;resize:none;height:29px"></textarea>
      <button class="btn btn-primary" style="height:44px" onclick="sendCC2Reply('${apt}')">Илгээх</button>
    </div>` : ''}
  `;
  const msgBox = document.getElementById('cc2-messages');
  if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
}

async function sendCC2Reply(apt) {
  const textEl = document.getElementById('cc2-reply-text');
  const text = (textEl?.value || '').trim();
  if (!text) { toast('Хариултаа бичнэ vv', 'error'); return; }

  const resident = residents.find(x => String(x.apt) === String(apt));
  if (!resident) { toast('Тухайн тоотод бүртгэлтэй сууц өмчлөгч олдсонгүй', 'error'); return; }
  await loadMySenderInfo();

  const label = `${apt} — ${resident.firstname || ''} ${resident.lastname || ''}`.trim();
  const row = {
    type: 'notice', title: 'Таны илгээсэн санал, хүсэлтэд хариу', content: text,
    recipient: label, date: todayStr(), sent: 1,
    recipient_kind: 'resident', recipient_filter: 'specific', recipient_specific_id: resident.id,
    category: 'notice', channels: ['inapp'],
    recipients_snapshot: [{ name: resident.firstname + ' ' + resident.lastname, apt, ref_type: 'resident', ref_id: resident.id, title: 'Таны илгээсэн санал, хүсэлтэд хариу', content: text }],
    sender_id: currentUser?.id || null,
    sender_name: _mySenderInfo?.name || null,
    sender_position: _mySenderInfo?.position || null,
    sent_at: new Date().toISOString(),
  };
  const ok = await db_saveNotificationNew(row);
  if (!ok) { toast('Илгээхэд алдаа гарлаа', 'error'); return; }

  logActivity('notify', 'cc-center-2', notifications[0]?.id || null, `${label} — Хариу`);
  await triggerPushForRecipients([{ apt, content: text }], 'Таны илгээсэн санал, хүсэлтэд хариу');

  textEl.value = '';
  toast('Хариу илгээгдлээ ✓', 'success');
  await selectCC2Thread(apt);
}

async function updateCC2Badge() {
  const { count, error } = await sb.from('feedback_requests').select('id', { count: 'exact', head: true }).eq('status', 'new');
  const badge = document.getElementById('cc-center-2-badge');
  if (!badge || error) return;
  if (count > 0) { badge.textContent = count; badge.style.display = ''; }
  else badge.style.display = 'none';
}
