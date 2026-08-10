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
      <div className="gate-tabs">
        <button className={'gate-tab' + (tab === 'resident' ? ' active' : '')} onClick={() => setTab('resident')}>Сууц өмчлөгч</button>
        <button className={'gate-tab' + (tab === 'business' ? ' active' : '')} onClick={() => setTab('business')}>Аж ахуйн нэгж</button>
        <button className={'gate-tab' + (tab === 'settings' ? ' active' : '')} onClick={() => setTab('settings')}>Хугацаа, торгуулийн тохиргоо</button>
      </div>

      {tab === 'settings' ? (
        <SettingsTab currentUser={currentUser} currentProfile={currentProfile} />
      ) : (
        <>
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
        </>
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

// finance.js-ийн saveFeeSettings()/saveRentSettings()/saveGateTariffSettings()
// (мөр ~272,438,628,479) — Хугацааны хоцрогдол/торгуулийн тохиргоо React рүү
// портлогдов (хэрэглэгчийн 2026-08-07 нээлт — эдгээр тохиргоог Payments.jsx/
// Dashboard.jsx зөвхөн УНШДАГ байсан, өөрчлөх UI ЭНЭ хүртэл байгаагүй).
function SettingsTab({ currentUser, currentProfile }) {
  const [feeSettings, setFeeSettings] = useState({ penalty: 2, fundAmount: 5000000, overdueDays: 35, riskDays: 365 });
  const [rentSettings, setRentSettings] = useState({ penalty: 2, overdueDays: 35, riskDays: 365 });
  const [gateTariff, setGateTariff] = useState({ parking_rate_minutes: 60, parking_rate_amount: 0, temp_stop_free_minutes: 15, guest_free_minutes: 60 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    sb.from('settings').select('*').then(({ data, error }) => {
      if (error) { console.error('settings ачаалах алдаа:', error.message); setLoading(false); return; }
      (data || []).forEach((s) => {
        if (s.key === 'fee') setFeeSettings((f) => ({ ...f, ...s.value }));
        if (s.key === 'rent') setRentSettings((r) => ({ ...r, ...s.value }));
        if (s.key === 'gate_tariff') setGateTariff((g) => ({ ...g, ...s.value }));
      });
      setLoading(false);
    });
  }, []);

  async function saveFeeSettings() {
    setSaving('fee');
    const { error } = await sb.from('settings').upsert({ key: 'fee', value: feeSettings }, { onConflict: 'key' });
    setSaving('');
    if (error) { alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'edit', 'tariff-settings', null, 'Сууц өмчлөгчийн хугацааны тохиргоо');
    alert('Хугацааны хоцрогдлын тохиргоо хадгалагдлаа ✓');
  }
  async function saveRentSettings() {
    setSaving('rent');
    const { error } = await sb.from('settings').upsert({ key: 'rent', value: rentSettings }, { onConflict: 'key' });
    setSaving('');
    if (error) { alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'edit', 'tariff-settings', null, 'ААН-ийн хугацааны тохиргоо');
    alert('ААН-ийн хугацааны тохиргоо хадгалагдлаа ✓');
  }
  async function saveGateSettings() {
    setSaving('gate');
    const { error } = await sb.from('settings').upsert({ key: 'gate_tariff', value: gateTariff }, { onConflict: 'key' });
    setSaving('');
    if (error) { alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'edit', 'tariff-settings', null, 'Хаалтны тариф');
    alert('Хаалтны тариф хадгалагдлаа ✓');
  }

  if (loading) return <div className="empty-state">Ачаалж байна...</div>;

  return (
    <>
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Сууц өмчлөгчийн хугацаа, торгуулийн тохиргоо</h3>
        <div className="field-row">
          <label className="field"><span>Торгуулийн хувь (%)</span><input type="number" value={feeSettings.penalty} onChange={(e) => setFeeSettings((f) => ({ ...f, penalty: +e.target.value }))} /></label>
          <label className="field"><span>Хуримтлалын сангийн дүн (₮)</span><input type="number" value={feeSettings.fundAmount} onChange={(e) => setFeeSettings((f) => ({ ...f, fundAmount: +e.target.value }))} /></label>
        </div>
        <div className="field-row">
          <label className="field"><span>Хугацаа хэтэрсэн гэж үзэх (хоног)</span><input type="number" value={feeSettings.overdueDays} onChange={(e) => setFeeSettings((f) => ({ ...f, overdueDays: +e.target.value }))} /></label>
          <label className="field"><span>Эрсдэлтэй гэж үзэх (хоног)</span><input type="number" value={feeSettings.riskDays} onChange={(e) => setFeeSettings((f) => ({ ...f, riskDays: +e.target.value }))} /></label>
        </div>
        <button className="btn-primary" disabled={saving === 'fee'} onClick={saveFeeSettings}>Хадгалах</button>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Аж ахуйн нэгжийн хугацаа, торгуулийн тохиргоо</h3>
        <div className="field-row">
          <label className="field"><span>Торгуулийн хувь (%)</span><input type="number" value={rentSettings.penalty} onChange={(e) => setRentSettings((r) => ({ ...r, penalty: +e.target.value }))} /></label>
        </div>
        <div className="field-row">
          <label className="field"><span>Хугацаа хэтэрсэн гэж үзэх (хоног)</span><input type="number" value={rentSettings.overdueDays} onChange={(e) => setRentSettings((r) => ({ ...r, overdueDays: +e.target.value }))} /></label>
          <label className="field"><span>Эрсдэлтэй гэж үзэх (хоног)</span><input type="number" value={rentSettings.riskDays} onChange={(e) => setRentSettings((r) => ({ ...r, riskDays: +e.target.value }))} /></label>
        </div>
        <button className="btn-primary" disabled={saving === 'rent'} onClick={saveRentSettings}>Хадгалах</button>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Хаалтны тариф</h3>
        <div className="field-row">
          <label className="field"><span>Зогсоолын үнэгүй хугацаа (мин)</span><input type="number" value={gateTariff.parking_rate_minutes} onChange={(e) => setGateTariff((g) => ({ ...g, parking_rate_minutes: +e.target.value }))} /></label>
          <label className="field"><span>Хэтэрсэн үеийн төлбөр (₮)</span><input type="number" value={gateTariff.parking_rate_amount} onChange={(e) => setGateTariff((g) => ({ ...g, parking_rate_amount: +e.target.value }))} /></label>
        </div>
        <div className="field-row">
          <label className="field"><span>Түр зогсолтын үнэгүй хугацаа (мин)</span><input type="number" value={gateTariff.temp_stop_free_minutes} onChange={(e) => setGateTariff((g) => ({ ...g, temp_stop_free_minutes: +e.target.value }))} /></label>
          <label className="field"><span>Зочны үнэгүй хугацаа (мин)</span><input type="number" value={gateTariff.guest_free_minutes} onChange={(e) => setGateTariff((g) => ({ ...g, guest_free_minutes: +e.target.value }))} /></label>
        </div>
        <button className="btn-primary" disabled={saving === 'gate'} onClick={saveGateSettings}>Хадгалах</button>
      </div>
    </>
  );
}
