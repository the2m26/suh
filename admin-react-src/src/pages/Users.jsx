import { useCallback, useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/dbUtils';
import { ROLE_LABELS, AUTH_ROLES } from '../lib/permissions';

const USER_MGT_URL = 'https://ndbhgzohmjumicziefnr.supabase.co/functions/v1/user-management';

async function callUserMgt(body) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { alert('Нэвтрээгүй байна'); return null; }
  const res = await fetch(USER_MGT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) { alert('Алдаа гарлаа: ' + (data.error || res.statusText)); return null; }
  return data;
}

// suh.html-ийн "Хэрэглэгч удирдлага" (users) хуудас — эрхтэй хэрэглэгч
// (Supabase Auth) үүсгэх/засах/идэвхжүүлэх/устгах. Бүх нэмэлт эрхийн шаардлагатай
// үйлдэл (create/update_profile/toggle_active/delete) `user-management` Edge
// Function-оор дамжина (client-side service role байхгүй).
export default function Users() {
  const { currentUser, currentProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | user object (edit)

  const load = useCallback(async () => {
    setLoading(true);
    const [data, { data: res }] = await Promise.all([
      callUserMgt({ action: 'list' }),
      sb.from('residents').select('id, apt, firstname, lastname, emails'),
    ]);
    setUsers(data?.users || []);
    setResidents(res || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function getUserAddress(u) {
    if (u.role !== 'ot' || !u.apt) return '—';
    const r = residents.find((x) => String(x.apt) === String(u.apt));
    return r ? String(r.apt) : '—';
  }

  const q = query.toLowerCase();
  const list = q ? users.filter((u) => {
    const roleLabel = (ROLE_LABELS[u.role] || u.role || '').toLowerCase();
    return (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || roleLabel.includes(q) || getUserAddress(u).toLowerCase().includes(q);
  }) : users;

  async function handleToggleActive(u) {
    const data = await callUserMgt({ action: 'toggle_active', userId: u.id, active: !u.active });
    if (!data) return;
    await logActivity(currentUser, currentProfile, 'edit', 'users', u.id, `${u.full_name || u.id} — ${!u.active ? 'идэвхжүүлэв' : 'зогсоолов'}`);
    load();
  }
  async function handleDelete(u) {
    if (!confirm(`"${u.full_name || 'энэ хэрэглэгч'}"-ийг бүрмөсөн устгах уу? Энэ үйлдлийг буцаах боломжгүй.`)) return;
    const data = await callUserMgt({ action: 'delete', userId: u.id });
    if (!data) return;
    await logActivity(currentUser, currentProfile, 'delete', 'users', u.id, u.full_name || u.id);
    load();
  }

  if (modal) {
    return <UserModal user={modal === 'add' ? null : modal} residents={residents} currentUser={currentUser} currentProfile={currentProfile} onClose={() => { setModal(null); load(); }} />;
  }

  return (
    <div className="page page-wide">
      <div className="page-header-row">
        <input placeholder="Хайх..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 240 }} />
        <button className="btn-primary" onClick={() => setModal('add')}>+ Хэрэглэгч нэмэх</button>
      </div>
      {loading && <div className="empty-state">Ачаалж байна...</div>}
      {!loading && !list.length && <div className="empty-state">Хэрэглэгч олдсонгүй</div>}
      {!loading && list.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Роль</th><th>Нэр</th><th>Мэйл</th><th>Онлайн</th><th>Хаяг</th><th>Төлөв</th><th>Үйлдэл</th></tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td><span className="tag">{ROLE_LABELS[u.role] || u.role}</span></td>
                  <td className="dt-title">{u.full_name || '—'}</td>
                  <td className="dt-text">{u.email || u.id}</td>
                  <td className="dt-muted" style={{ fontSize: 11 }}>—</td>
                  <td className="dt-text dt-mono">{getUserAddress(u)}</td>
                  <td>{u.active ? <span className="status-ok">Идэвхтэй</span> : <span className="status-muted">Идэвхгүй</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {u.role !== 'admin' && (
                        <button className="btn-ghost-sm" style={{ color: u.active ? 'var(--danger)' : 'var(--success)' }} onClick={() => handleToggleActive(u)}>
                          {u.active ? 'Зогсоох' : 'Идэвхжүүлэх'}
                        </button>
                      )}
                      <button className="btn-ghost-sm" onClick={() => setModal(u)}>✎</button>
                      {u.role !== 'admin' && <button className="btn-ghost-sm danger" onClick={() => handleDelete(u)}>✕</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="dt-muted" style={{ marginTop: 14 }}>
        ⚠️ Онлайн төлөв (Realtime presence channel) хараахан ортоогүй — үргэлж "—" харагдана.
      </div>
    </div>
  );
}

function UserModal({ user, residents, currentUser, currentProfile, onClose }) {
  const isEdit = !!user;
  const [name, setName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role || 'mn');
  const [apt, setApt] = useState(user?.apt || '');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const suggestions = role === 'ot' && query.trim()
    ? residents.filter((r) => `${r.firstname || ''} ${r.lastname || ''}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  function pickResident(r) {
    const rname = `${r.firstname || ''} ${r.lastname || ''}`.trim();
    setName(rname);
    setApt(r.apt);
    if (!isEdit) setEmail((r.emails || [])[0] || '');
    setQuery('');
  }

  async function handleSave() {
    if (!name.trim()) { alert('Нэрийг оруулна уу'); return; }
    if (!email.trim()) { alert('И-мэйлийг оруулна уу'); return; }
    if (!isEdit && !password) { alert('Нүүц үг оруулна уу'); return; }
    if (password && password.length < 6) { alert('Нүүц үг хамгийн багадаа 6 тэмдэгт байх ёстой'); return; }
    setSaving(true);
    const aptVal = (role === 'ot' && apt) ? +apt : null;
    let data;
    if (isEdit) {
      const payload = { action: 'update_profile', userId: user.id, full_name: name.trim(), email: email.trim(), role, apt: aptVal };
      if (password) payload.password = password;
      data = await callUserMgt(payload);
    } else {
      data = await callUserMgt({ action: 'create', email: email.trim(), password, role, full_name: name.trim(), apt: aptVal });
    }
    setSaving(false);
    if (!data) return;
    await logActivity(currentUser, currentProfile, isEdit ? 'edit' : 'add', 'users', isEdit ? user.id : (data.userId || null), `${name.trim()} (${email.trim()}) — ${role}`);
    onClose();
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row"><h2>{isEdit ? 'Хэрэглэгч засах' : 'Хэрэглэгч нэмэх'}</h2><button className="btn-ghost" onClick={onClose}>← Буцах</button></div>
      <label className="field"><span>Роль</span>
        <select value={role} onChange={(e) => { setRole(e.target.value); if (e.target.value !== 'ot') setApt(''); }}>
          {AUTH_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </label>
      <div style={{ position: 'relative' }}>
        <label className="field"><span>Нэр</span>
          <input value={name} onChange={(e) => { setName(e.target.value); if (role === 'ot') setQuery(e.target.value); }} />
        </label>
        {suggestions.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10 }}>
            {suggestions.map((r) => (
              <div key={r.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }} onClick={() => pickResident(r)}>
                {`${r.firstname || ''} ${r.lastname || ''}`.trim()} <span className="dt-muted">({r.apt})</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <label className="field"><span>И-мэйл</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field"><span>Нүүц үг{isEdit ? ' (солихгүй бол хоосон үлдээнэ γγ)' : ''}</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {role === 'ot' && <label className="field"><span>Холбогдох тоот</span><input value={apt} onChange={(e) => setApt(e.target.value)} placeholder="жиш: 1010505" /></label>}
      <div className="form-actions"><button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button></div>
    </div>
  );
}
