import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/dbUtils';

// suh.html-ийн "Үндсэн хөрөнгө тохиргоо" (asset-settings) — 3 таб
// (Ангилал/Төрөл/Байршил), assets.js-ийн мөр ~954-1030.
export default function AssetSettings() {
  const { currentUser, currentProfile } = useAuth();
  const [tab, setTab] = useState('category');
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      sb.from('asset_categories').select('*').order('label'),
      sb.from('asset_types').select('*').order('label'),
      sb.from('asset_locations').select('*').order('label'),
    ]).then(([c, t, l]) => {
      setCategories(c.data || []); setTypes(t.data || []); setLocations(l.data || []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  return (
    <div className="page">
      <h2>Үндсэн хөрөнгө тохиргоо</h2>
      <div className="gate-tabs">
        <button className={'gate-tab' + (tab === 'category' ? ' active' : '')} onClick={() => setTab('category')}>Ангилал</button>
        <button className={'gate-tab' + (tab === 'type' ? ' active' : '')} onClick={() => setTab('type')}>Төрөл</button>
        <button className={'gate-tab' + (tab === 'location' ? ' active' : '')} onClick={() => setTab('location')}>Байршил</button>
      </div>
      {loading ? <div className="empty-state">Ачаалж байна...</div> : tab === 'category' ? (
        <CategoryTab categories={categories} currentUser={currentUser} currentProfile={currentProfile} onReload={load} />
      ) : tab === 'type' ? (
        <TypeTab categories={categories} types={types} currentUser={currentUser} currentProfile={currentProfile} onReload={load} />
      ) : (
        <LocationTab locations={locations} currentUser={currentUser} currentProfile={currentProfile} onReload={load} />
      )}
    </div>
  );
}

const METHOD_LABELS = { straight_line: 'Шугаман элэгдэл', declining_balance: 'Хурдасгасан элэгдэл' };

function CategoryTab({ categories, currentUser, currentProfile, onReload }) {
  const [editing, setEditing] = useState(null);

  return (
    <>
      <div className="dt-muted" style={{ marginBottom: 14, fontSize: 12 }}>Эндээс тохируулсан ангилал "Үндсэн хөрөнгө бүртгэл" хуудасны "Хөрөнгө нэмэх/засах" modal-ын dropdown-д харагдана.</div>
      <div className="page-header-row"><div /><button className="btn-primary" onClick={() => setEditing('new')}>+ Шинэ ангилал нэмэх</button></div>
      {editing && <CategoryForm cat={editing === 'new' ? null : editing} currentUser={currentUser} currentProfile={currentProfile} onClose={() => { setEditing(null); onReload(); }} />}
      {categories.map((c) => (
        <div key={c.code} className="card" style={{ padding: 14, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700 }}>{c.label}</div>
            <div className="dt-muted" style={{ fontSize: 11 }}>Код: {c.code} · Анхдагч ашиглах хугацаа: {c.default_life_months} сар · {METHOD_LABELS[c.default_method] || c.default_method}</div>
          </div>
          <div><button className="btn-ghost-sm" onClick={() => setEditing(c)}>✎</button></div>
        </div>
      ))}
      {!categories.length && <div className="empty-state">Ангилал бүртгэгдээгүй</div>}
    </>
  );
}

function CategoryForm({ cat, currentUser, currentProfile, onClose }) {
  const isEdit = !!cat;
  const [code, setCode] = useState(cat?.code || '');
  const [label, setLabel] = useState(cat?.label || '');
  const [life, setLife] = useState(cat?.default_life_months || 60);
  const [method, setMethod] = useState(cat?.default_method || 'straight_line');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!code.trim() || !label.trim()) { alert('Код болон нэрийг бөглөнө γγ'); return; }
    setSaving(true);
    const row = { code: code.trim(), label: label.trim(), default_life_months: +life || 60, default_method: method };
    const { error } = await sb.from('asset_categories').upsert(row, { onConflict: 'code' });
    setSaving(false);
    if (error) { alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, isEdit ? 'edit' : 'add', 'asset-settings', code.trim(), label.trim());
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="page-header-row"><h2>{isEdit ? 'Ангилал засах' : 'Шинэ ангилал нэмэх'}</h2><button className="btn-ghost" onClick={onClose}>✕</button></div>
        <label className="field"><span>Код (латин үсгээр, давтагдашгүй)</span><input value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} placeholder="жиш: vehicle" /></label>
        <label className="field"><span>Нэр</span><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="жиш: Тээврийн хэрэгсэл" /></label>
        <label className="field"><span>Анхдагч ашиглах хугацаа (сар)</span><input type="number" value={life} onChange={(e) => setLife(e.target.value)} /></label>
        <label className="field"><span>Анхдагч элэгдлийн арга</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="straight_line">Шугаман элэгдэл</option>
            <option value="declining_balance">Хурдасгасан элэгдэл</option>
          </select>
        </label>
        <div className="form-actions"><button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button></div>
      </div>
    </div>
  );
}

function TypeTab({ categories, types, currentUser, currentProfile, onReload }) {
  const [filterCat, setFilterCat] = useState('');
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCat, setNewCat] = useState(categories[0]?.code || '');
  const [saving, setSaving] = useState(false);

  const list = filterCat ? types.filter((t) => t.category_code === filterCat) : types;

  async function handleAdd() {
    if (!newLabel.trim() || !newCat) { alert('Ангилал, нэрийг бөглөнө γγ'); return; }
    setSaving(true);
    const { error } = await sb.from('asset_types').insert({ category_code: newCat, label: newLabel.trim() });
    setSaving(false);
    if (error) { alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'add', 'asset-settings', null, newLabel.trim());
    setAdding(false); setNewLabel('');
    onReload();
  }
  async function handleDelete(t) {
    if (!confirm('Устгах уу?')) return;
    const { error } = await sb.from('asset_types').delete().eq('id', t.id);
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'asset-settings', t.id, t.label);
    onReload();
  }

  return (
    <>
      <div className="page-header-row">
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">Бүх ангилал</option>
          {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setAdding(true)}>+ Шинэ төрөл нэмэх</button>
      </div>
      {adding && (
        <div className="wizard-row" style={{ marginBottom: 12 }}>
          <select value={newCat} onChange={(e) => setNewCat(e.target.value)}>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <input placeholder="Төрлийн нэр" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <button className="btn-primary btn-sm" disabled={saving} onClick={handleAdd}>Хадгалах</button>
          <button className="btn-ghost-sm" onClick={() => setAdding(false)}>Болих</button>
        </div>
      )}
      {list.map((t) => {
        const cat = categories.find((c) => c.code === t.category_code);
        return (
          <div key={t.id} className="card" style={{ padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <div><span style={{ fontWeight: 600 }}>{t.label}</span> <span className="dt-muted" style={{ fontSize: 11 }}>({cat?.label || t.category_code})</span></div>
            <button className="btn-ghost-sm danger" onClick={() => handleDelete(t)}>✕</button>
          </div>
        );
      })}
      {!list.length && <div className="empty-state">Төрөл бүртгэгдээгүй</div>}
    </>
  );
}

function LocationTab({ locations, currentUser, currentProfile, onReload }) {
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!code.trim() || !label.trim()) { alert('Код болон нэрийг бөглөнө γγ'); return; }
    setSaving(true);
    const { error } = await sb.from('asset_locations').upsert({ code: code.trim(), label: label.trim() }, { onConflict: 'code' });
    setSaving(false);
    if (error) { alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'add', 'asset-settings', code.trim(), label.trim());
    setAdding(false); setCode(''); setLabel('');
    onReload();
  }
  async function handleDelete(l) {
    if (!confirm('Устгах уу?')) return;
    const { error } = await sb.from('asset_locations').delete().eq('code', l.code);
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'asset-settings', l.code, l.label);
    onReload();
  }

  return (
    <>
      <div className="dt-muted" style={{ marginBottom: 14, fontSize: 12 }}>Эндээс тохируулсан байршил "Үндсэн хөрөнгө бүртгэл" хуудасны dropdown-д харагдана.</div>
      <div className="page-header-row"><div /><button className="btn-primary" onClick={() => setAdding(true)}>+ Шинэ байршил нэмэх</button></div>
      {adding && (
        <div className="wizard-row" style={{ marginBottom: 12 }}>
          <input placeholder="Код" value={code} onChange={(e) => setCode(e.target.value)} />
          <input placeholder="Нэр" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn-primary btn-sm" disabled={saving} onClick={handleAdd}>Хадгалах</button>
          <button className="btn-ghost-sm" onClick={() => setAdding(false)}>Болих</button>
        </div>
      )}
      {locations.map((l) => (
        <div key={l.code} className="card" style={{ padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600 }}>{l.label} <span className="dt-muted" style={{ fontSize: 11 }}>({l.code})</span></div>
          <button className="btn-ghost-sm danger" onClick={() => handleDelete(l)}>✕</button>
        </div>
      ))}
      {!locations.length && <div className="empty-state">Байршил бүртгэгдээгүй</div>}
    </>
  );
}
