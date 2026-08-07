import { useCallback, useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/dbUtils';
import { FEE_UNIT_LABELS, FEE_OBJECT_UNIT_OPTIONS } from '../lib/tariffHelpers';

export default function Tariffs() {
  const { currentUser, currentProfile } = useAuth();
  const [tab, setTab] = useState('resident');
  const [feeCatalog, setFeeCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb.from('fee_catalog').select('*').order('sort_order').order('id');
    if (error) { console.error('Тарифын каталог ачаалах алдаа:', error.message); setLoading(false); return; }
    setFeeCatalog(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = feeCatalog.filter((f) => f.applies_to === tab).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  async function handleDelete(f) {
    if (f.locked) { alert('Энэ мөрийг устгах боломжгүй — Хаягжилт тохиргооны бодит тоот/зогсоол/агуулахтай шууд уяатай'); return; }
    if (!confirm('Энэ төлбөрийг устгах уу? Тооцоолол шууд өөрчлөгдөнө.')) return;
    const { error } = await sb.from('fee_catalog').delete().eq('id', f.id);
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'tariff-settings', f.id, `${f.name} (${f.applies_to === 'resident' ? 'Сууц' : 'ААН'})`);
    load();
  }

  if (editing) {
    return (
      <TariffForm
        row={editing === 'new' ? null : editing}
        defaultTab={tab}
        feeCatalog={feeCatalog}
        currentUser={currentUser}
        currentProfile={currentProfile}
        onClose={() => { setEditing(null); load(); }}
      />
    );
  }

  return (
    <div className="page page-wide">
      <h2>Тариф тохиргоо</h2>
      <div className="gate-tabs">
        <button className={'gate-tab' + (tab === 'resident' ? ' active' : '')} onClick={() => setTab('resident')}>Сууц өмчлөгч</button>
        <button className={'gate-tab' + (tab === 'business' ? ' active' : '')} onClick={() => setTab('business')}>Аж ахуйн нэгж</button>
      </div>

      <div className="page-header-row">
        <div className="dt-muted">{rows.length} төлбөрийн мөр</div>
        <button className="btn-primary" onClick={() => setEditing('new')}>+ Шинэ төлбөр нэмэх</button>
      </div>

      {loading && <div className="empty-state">Ачаалж байна...</div>}
      {!loading && !rows.length && <div className="empty-state">Төлбөрийн мөр алга</div>}
      {!loading && rows.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Нэр</th><th>Төрөл</th><th>Дүн</th><th>Төлөв</th><th></th></tr></thead>
            <tbody>
              {rows.map((f) => {
                const u = FEE_UNIT_LABELS[f.unit_type] || FEE_UNIT_LABELS.flat;
                return (
                  <tr key={f.id} onClick={() => setEditing(f)}>
                    <td className="dt-title">{f.locked && <span title="Хаягжилт тохиргооны бодит тоот/зогсоол/агуулахтай шууд уяатай тул нэрийг нь засах боломжгүй">🔒 </span>}{f.name}</td>
                    <td><span className="tag">{u.badge}</span></td>
                    <td className="dt-mono">{Math.round(f.rate).toLocaleString()}₮</td>
                    <td>{f.active ? <span className="status-ok">Идэвхтэй</span> : <span className="status-muted">Идэвхгүй</span>}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn-ghost-sm" onClick={() => setEditing(f)}>✎</button>
                      {!f.locked && <button className="btn-ghost-sm danger" onClick={() => handleDelete(f)}>✕</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TariffForm({ row, defaultTab, feeCatalog, currentUser, currentProfile, onClose }) {
  const isEdit = !!row;
  const appliesTo = row ? row.applies_to : defaultTab;
  const objectType = row ? (row.object_type || 'custom') : 'custom';
  const options = FEE_OBJECT_UNIT_OPTIONS[objectType] || FEE_OBJECT_UNIT_OPTIONS.custom;

  const [name, setName] = useState(row?.name || '');
  const [unitType, setUnitType] = useState(row?.unit_type || options[0][0]);
  const [rate, setRate] = useState(row?.rate ?? '');
  const [active, setActive] = useState(row ? row.active : true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const finalName = row?.locked ? row.name : name.trim();
    if (!finalName) { alert('Нэрийг оруулна уу'); return; }
    setSaving(true);
    const dbRow = {
      name: finalName, unit_type: unitType, rate: +rate || 0,
      applies_to: appliesTo, active, updated_at: new Date().toISOString(),
    };
    let error;
    if (isEdit) {
      ({ error } = await sb.from('fee_catalog').update(dbRow).eq('id', row.id));
    } else {
      dbRow.sort_order = feeCatalog.reduce((m, f) => Math.max(m, f.sort_order || 0), 0) + 10;
      ({ error } = await sb.from('fee_catalog').insert(dbRow));
    }
    if (error) { setSaving(false); alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, isEdit ? 'edit' : 'add', 'tariff-settings', row?.id || null, `${finalName} (${appliesTo === 'resident' ? 'Сууц' : 'ААН'}) — ${Math.round(dbRow.rate).toLocaleString()}₮`);
    setSaving(false);
    onClose();
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row">
        <h2>{isEdit ? 'Төлбөр засах' : 'Шинэ төлбөр нэмэх'}</h2>
        <button className="btn-ghost" onClick={onClose}>← Буцах</button>
      </div>

      {row?.locked && (
        <div className="dt-muted" style={{ marginBottom: 14 }}>
          🔒 Энэ мөрийн нэрийг Хаягжилт тохиргооны бодит тоот/зогсоол/агуулахтай шууд уяатай тул засах боломжгүй — зөвхөн тооцооллын арга/хэмжээг өөрчилнө.
        </div>
      )}

      <label className="field"><span>Нэр</span><input value={row?.locked ? row.name : name} onChange={(e) => setName(e.target.value)} disabled={row?.locked} /></label>

      <label className="field"><span>Тооцооллын арга</span>
        <select value={unitType} onChange={(e) => setUnitType(e.target.value)}>
          {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </label>

      <label className="field"><span>{(FEE_UNIT_LABELS[unitType] || FEE_UNIT_LABELS.flat).rateLabel}</span><input type="number" value={rate} onChange={(e) => setRate(e.target.value)} /></label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Идэвхтэй
      </label>

      <div className="form-actions">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button>
      </div>
    </div>
  );
}
