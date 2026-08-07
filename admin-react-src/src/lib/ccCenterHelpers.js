// cccenter.js-ийн цэвэр туслах функцүүдийн React талын эх сурвалж.

export function ccResidentLabel(apt, residents) {
  const r = residents.find((x) => String(x.apt) === String(apt));
  return r ? `${r.firstname || ''} ${r.lastname || ''}`.trim() || String(apt) : String(apt);
}

export function ccInitials(apt, residents) {
  const r = residents.find((x) => String(x.apt) === String(apt));
  const name = r ? `${r.firstname || ''} ${r.lastname || ''}`.trim() : '';
  const parts = name.split(' ').filter(Boolean);
  return parts.length ? parts.map((p) => p[0]).slice(0, 2).join('').toUpperCase() : '??';
}

export function ccFmtTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 1) return 'Өчигдөр';
  if (diffDays < 7) return `${diffDays} өдөр`;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

// loadCCThreadList() — feedback_requests (резидентээс ирсэн) + notifications
// (admin-аас эхэлсэн, source='cc-center') хоёуланг НЭГТГЭЖ thread жагсаалт
// үүсгэнэ (2026-08-04 засвар: admin-аас эхэлсэн харилцаа ч харагдах ёстой).
export function buildCCThreads(feedback, outgoing, residents) {
  const byApt = {};
  (feedback || []).forEach((f) => {
    const key = String(f.apt);
    if (!byApt[key]) byApt[key] = { apt: f.apt, lastText: f.content, lastAt: f.created_at, unread: 0 };
    if (new Date(f.created_at) > new Date(byApt[key].lastAt)) { byApt[key].lastText = f.content; byApt[key].lastAt = f.created_at; }
    if (f.status === 'new') byApt[key].unread++;
  });
  (outgoing || []).forEach((n) => {
    const resident = residents.find((x) => x.id === n.recipient_specific_id);
    if (!resident) return;
    const key = String(resident.apt);
    if (!byApt[key]) byApt[key] = { apt: resident.apt, lastText: n.content, lastAt: n.sent_at, unread: 0 };
    else if (new Date(n.sent_at) > new Date(byApt[key].lastAt)) { byApt[key].lastText = n.content; byApt[key].lastAt = n.sent_at; }
  });
  return Object.values(byApt).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
}

export function filterCCThreads(threads, statuses, { query, statusFilter }, residents) {
  const q = (query || '').trim().toLowerCase();
  const getStatus = (apt) => statuses[String(apt)] || { muted: false, urgent: false, pinned: false };
  return threads.filter((t) => {
    if (q) {
      const hay = `${t.apt} ${ccResidentLabel(t.apt, residents)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const st = getStatus(t.apt);
    if (statusFilter === 'muted' && !st.muted) return false;
    if (statusFilter === 'urgent' && !st.urgent) return false;
    if (statusFilter === 'unread' && !(t.unread > 0)) return false;
    return true;
  });
}

export function mergeCCMessages(incoming, outgoing) {
  return [
    ...(incoming || []).map((m) => ({ dir: 'in', text: m.content, at: m.created_at, id: m.id, attachmentPath: m.attachment_path })),
    ...(outgoing || []).map((m) => ({ dir: 'out', text: m.content, at: m.sent_at, sender: m.sender_name, id: m.id, attachmentPath: m.attachment_path })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
}
