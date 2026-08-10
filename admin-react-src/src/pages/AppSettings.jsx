import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/dbUtils';

const APP_SETTINGS_MODULES = [
  { key: 'dashboard', label: 'Хянах самбар' },
  { key: 'news', label: 'Мэдээ, мэдээлэл' },
  { key: 'guest-invite', label: 'Зочин урих' },
  { key: 'polls', label: 'Сонгууль, санал асуулга' },
  { key: 'call-log', label: 'Ирсэн санал, хүсэлт' },
  { key: 'call-service', label: 'Төлбөрт үйлчилгээ' },
  { key: 'useful-contacts', label: 'Хэрэгцээт мэдээлэл' },
  { key: 'emergency-contacts', label: 'Онцгой хэрэгцээт утас' },
  { key: 'elevator', label: 'Лифт дуудах (тун удахгүй)' },
  { key: 'camera', label: 'Камер харах (тун удахгүй)' },
];

// suh.html-ийн "UserApp тохиргоо" (app-settings) — 3 таб (Модуль/Төлбөрт
// үйлчилгээ/Хэрэгцээт утас), fintax.js-ийн мөр ~1468-1628.
export default function AppSettings() {
  const { currentUser, currentProfile } = useAuth();
  const [tab, setTab] = useState('modules');

  return (
    <div className="page">
      <div className="gate-tabs">
        <button className={'gate-tab' + (tab === 'modules' ? ' active' : '')} onClick={() => setTab('modules')}>Модуль тохиргоо</button>
        <button className={'gate-tab' + (tab === 'call-service' ? ' active' : '')} onClick={() => setTab('call-service')}>Төлбөрт үйлчилгээ</button>
        <button className={'gate-tab' + (tab === 'emergency' ? ' active' : '')} onClick={() => setTab('emergency')}>Хэрэгцээт утас, мэйл</button>
      </div>
      {tab === 'modules' && <ModulesTab currentUser={currentUser} currentProfile={currentProfile} />}
      {tab === 'call-service' && <CallServiceTab currentUser={currentUser} currentProfile={currentProfile} />}
      {tab === 'emergency' && <EmergencyTab currentUser={currentUser} currentProfile={currentProfile} />}
    </div>
  );
}

function ModulesTab({ currentUser, currentProfile }) {
  const [enabled, setEnabled] = useState(new Set(APP_SETTINGS_MODULES.map((m) => m.key)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    sb.from('settings').select('value').eq('key', 'mobile_modules').maybeSingle().then(({ data }) => {
      if (data?.value?.keys) setEnabled(new Set(data.value.keys));
      setLoading(false);
    });
  }, []);

  function toggle(key) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const keys = Array.from(enabled);
    const { error } = await sb.from('settings').upsert({ key: 'mobile_modules', value: { keys }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSaving(false);
    if (error) { alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'edit', 'app-settings', null, `${keys.length} модуль идэвхтэй`);
    alert('Апп тохиргоо хадгалагдлаа ✓');
  }

  if (loading) return <div className="empty-state">Ачаалж байна...</div>;

  return (
    <div className="card" style={{ padding: '22px 24px', maxWidth: 620 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Мобайл апп (userapp-react) модулийн тохиргоо</div>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 18px' }}>
        Гар утасны дэлгэц жижиг, агуулга их модуль тохиромжгүй харагдаж болно. Энд идэвхжүүлсэн модулиуд ЗӨВХӨН тухайн хэрэглэгчийн эрхтэй үед л Мобайл апп-д товч болж харагдана.
      </p>
      {APP_SETTINGS_MODULES.map((m) => (
        <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', cursor: 'pointer', fontSize: 13.5, borderBottom: '1px solid var(--border)' }}>
          <input type="checkbox" checked={enabled.has(m.key)} onChange={() => toggle(m.key)} />
          {m.label}
        </label>
      ))}
      <button className="btn-primary" disabled={saving} onClick={handleSave} style={{ marginTop: 16 }}>Хадгалах</button>
    </div>
  );
}

function CallServiceTab({ currentUser, currentProfile }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    sb.from('local_services').select('*').order('order_num').then(({ data }) => { setRows(data || []); setLoading(false); });
  };
  useEffect(load, []);

  function addRow() {
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.order_num || 0), 0);
    setRows((r) => [...r, { id: 'new-' + Date.now(), category: '', phone: '', telegram: '', viber: '', order_num: maxOrder + 1 }]);
  }
  function updateRow(id, field, value) {
    setRows((r) => r.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }
  async function saveRow(row) {
    if (!row.category.trim()) { alert('Категори нэрийг бөглөнө γγ'); return; }
    const payload = { category: row.category.trim(), phone: row.phone.trim(), telegram: row.telegram.trim(), viber: row.viber.trim() };
    const isNew = String(row.id).startsWith('new-');
    const { error } = isNew ? await sb.from('local_services').insert(payload) : await sb.from('local_services').update(payload).eq('id', row.id);
    if (error) { alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'edit', 'app-settings', null, `Төлбөрт үйлчилгээ: ${row.category}`);
    load();
  }
  async function deleteRow(row) {
    if (String(row.id).startsWith('new-')) { setRows((r) => r.filter((x) => x.id !== row.id)); return; }
    if (!confirm('Энэ мөрийг устгах уу?')) return;
    const { error } = await sb.from('local_services').delete().eq('id', row.id);
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'app-settings', null, 'Төлбөрт үйлчилгээний мөр устгав');
    load();
  }

  if (loading) return <div className="empty-state">Ачаалж байна...</div>;

  return (
    <div className="card" style={{ padding: '22px 24px' }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Төлбөрт үйлчилгээ — лавлах жагсаалт</div>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 18px' }}>userapp-ийн "Төлбөрт үйлчилгээ" tile-д харагдах гадны үйлчилгээний лавлах.</p>
      <table className="data-table">
        <thead><tr><th>Категори</th><th>Утас</th><th>Telegram</th><th>Viber</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><input value={r.category} onChange={(e) => updateRow(r.id, 'category', e.target.value)} style={{ width: '100%' }} /></td>
              <td><input value={r.phone} onChange={(e) => updateRow(r.id, 'phone', e.target.value)} style={{ width: '100%' }} /></td>
              <td><input value={r.telegram} onChange={(e) => updateRow(r.id, 'telegram', e.target.value)} style={{ width: '100%' }} /></td>
              <td><input value={r.viber} onChange={(e) => updateRow(r.id, 'viber', e.target.value)} style={{ width: '100%' }} /></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn-outline btn-sm" onClick={() => saveRow(r)}>Хадгалах</button>{' '}
                <button className="btn-ghost-sm danger" onClick={() => deleteRow(r)}>Устгах</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn-outline" onClick={addRow} style={{ marginTop: 14 }}>+ Мөр нэмэх</button>
    </div>
  );
}

function EmergencyTab({ currentUser, currentProfile }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    sb.from('emergency_contacts').select('*').order('order_num').then(({ data }) => { setRows(data || []); setLoading(false); });
  };
  useEffect(load, []);

  function addRow() {
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.order_num || 0), 0);
    setRows((r) => [...r, { id: 'new-' + Date.now(), name: '', phone: '', order_num: maxOrder + 1 }]);
  }
  function updateRow(id, field, value) {
    setRows((r) => r.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }
  async function saveRow(row) {
    if (!row.name.trim() || !row.phone.trim()) { alert('Нэр, утас хоёуланг нь бөглөнө γγ'); return; }
    const payload = { name: row.name.trim(), phone: row.phone.trim() };
    const isNew = String(row.id).startsWith('new-');
    const { error } = isNew ? await sb.from('emergency_contacts').insert(payload) : await sb.from('emergency_contacts').update(payload).eq('id', row.id);
    if (error) { alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'edit', 'app-settings', null, `Онцгой утас: ${row.name}`);
    load();
  }
  async function deleteRow(row) {
    if (String(row.id).startsWith('new-')) { setRows((r) => r.filter((x) => x.id !== row.id)); return; }
    if (!confirm('Энэ мөрийг устгах уу?')) return;
    const { error } = await sb.from('emergency_contacts').delete().eq('id', row.id);
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'app-settings', null, 'Онцгой утасны мөр устгав');
    load();
  }

  if (loading) return <div className="empty-state">Ачаалж байна...</div>;

  return (
    <div className="card" style={{ padding: '22px 24px' }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Онцгой хэрэгцээт утасны дугаарууд</div>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 18px' }}>userapp-ийн адил нэртэй tile-д харагдах (Лифт, Харуул, Түргэн тусламж г.м).</p>
      <table className="data-table">
        <thead><tr><th>Нэр</th><th>Утас</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><input value={r.name} onChange={(e) => updateRow(r.id, 'name', e.target.value)} style={{ width: '100%' }} /></td>
              <td><input value={r.phone} onChange={(e) => updateRow(r.id, 'phone', e.target.value)} style={{ width: '100%' }} /></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn-outline btn-sm" onClick={() => saveRow(r)}>Хадгалах</button>{' '}
                <button className="btn-ghost-sm danger" onClick={() => deleteRow(r)}>Устгах</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn-outline" onClick={addRow} style={{ marginTop: 14 }}>+ Мөр нэмэх</button>
    </div>
  );
}
