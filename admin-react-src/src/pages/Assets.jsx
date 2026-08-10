import { useCallback, useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { logActivity } from '../lib/dbUtils';
import { employeeDisplayName } from '../lib/employeeHelpers';
import BarcodeSvg from '../components/BarcodeSvg';
import {
  ASSET_STATUS_LABELS, getAssetCategoryLabel, responsibleDisplayName,
  assetLifeProgressPct, assetLifeProgressColor, filterAssetsList,
  monthsBetweenDates,
} from '../lib/assetHelpers';
import {
  accumulatedDepreciationAtMonths, computeDepreciation, dbGetPartyBalance,
  accountingRecordDepreciation, accountingRecordAssetDisposal,
} from '../lib/accountingBridge';

function mapAssetRow(a) {
  return {
    id: a.id, dbId: a.id, name: a.name || '', code: a.code || '', assetBarcode: a.asset_barcode || '', assetGroup: a.asset_group || 'hoa',
    category: a.category || 'office_equipment', subcategory: a.subcategory || '',
    quantity: +a.quantity || 1, unit: a.unit || 'ширхэг', purchaseDate: a.purchase_date || '',
    cost: +a.original_cost || 0, vendor: a.vendor || '',
    location: a.location || '', responsible: a.responsible || '', note: a.note || '',
    usefulLife: a.useful_life_months || 60,
    depMethod: a.depreciation_method || 'straight_line', decliningRate: a.declining_rate || null,
    salvage: +a.salvage_value || 0, status: a.status || 'active',
    accumulatedDepreciation: +a.accumulated_depreciation || 0, netBookValue: a.net_book_value != null ? +a.net_book_value : null,
  };
}

export default function Assets() {
  const { currentUser, currentProfile } = useAuth();
  const { canAdd, canWrite, canDelete } = usePermissions();
  const [tab, setTab] = useState('list');
  const [assets, setAssets] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingAsset, setEditingAsset] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: a }, { data: m }, { data: emp }, { data: cat }, { data: ty }, { data: loc }] = await Promise.all([
      sb.from('fixed_assets').select('*').order('id'),
      sb.from('asset_maintenance').select('*').order('id', { ascending: false }),
      sb.from('employees').select('id, full_name, first_name, parent_name'),
      sb.from('asset_categories').select('*').order('label'),
      sb.from('asset_types').select('*').order('label'),
      sb.from('asset_locations').select('*').order('label'),
    ]);
    setAssets((a || []).map(mapAssetRow));
    setMaintenance((m || []).map((row) => ({ id: row.id, dbId: row.id, assetId: row.asset_id, date: row.date || '', cost: +row.cost || 0, description: row.description || '', vendor: row.vendor || '' })));
    setEmployees((emp || []).map((e) => ({ id: e.id, fullName: e.full_name, firstName: e.first_name, parentName: e.parent_name })));
    setCategories(cat || []);
    setTypes(ty || []);
    setLocations(loc || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const perm = { canAdd: canAdd('assets'), canWrite: canWrite('assets'), canDelete: canDelete('assets') };

  // assets.js-ийн syncAssetDepreciationSnapshots()/syncMonthlyDepreciationExpenses()
  // (мөр ~324-388) — хэрэглэгчийн 2026-08-06 зөвшөөрлөөр React рүү портлогдов.
  // (1) accumulated_depreciation/net_book_value snapshot-ыг томьёогоор шинэчилнэ,
  // (2) ledger (2015 данс)-той бодит зөрүүг (gap) нэг удаад transaction+journal
  // entry-ээр нөхнэ — хэдэн сар алгассан ч үргэлж ЗӨВ дүнд хүрдэг.
  const [syncing, setSyncing] = useState(false);
  async function runDepreciationSync() {
    if (!perm.canWrite) return;
    setSyncing(true);
    const today = new Date().toISOString().slice(0, 10);
    let snapshotUpdates = 0, expenseEntries = 0;

    for (const a of assets) {
      if (!a.dbId || a.status === 'disposed' || !a.purchaseDate || !a.usefulLife) continue;
      const { accumulated, bookValue } = computeDepreciation(a, monthsBetweenDates);
      const drift = Math.abs((a.accumulatedDepreciation || 0) - accumulated);
      if (drift >= 1) {
        await sb.from('fixed_assets').update({
          accumulated_depreciation: accumulated, net_book_value: bookValue, depreciation_updated_at: new Date().toISOString(),
        }).eq('id', a.dbId);
        snapshotUpdates++;
      }

      const ledgerAccumulated = await dbGetPartyBalance('2015', 'asset:' + a.dbId);
      const gap = +(accumulated - ledgerAccumulated).toFixed(2);
      if (gap < 1) continue;
      const { error: txErr } = await sb.from('transactions').insert({
        apt: null, description: `${a.name} — элэгдэл нөхөх`, subcat: 'Үндсэн хөрөнгийн элэгдэл',
        type: 'expense', amount: Math.round(gap), method: 'бэлэн бус', ref: '',
        month: new Date().getMonth() + 1, year: new Date().getFullYear(),
        date: today, status: 'completed', category: 'expense', asset_id: a.dbId,
      });
      if (txErr) { console.error('элэгдлийн зардал бүртгэхэд алдаа:', txErr.message); continue; }
      const res = await accountingRecordDepreciation(a.dbId, a.name, Math.round(gap), today);
      if (!res.success) console.warn('Journal entry үүсгэхэд алдаа:', res.error);
      expenseEntries++;
    }
    setSyncing(false);
    alert(`Элэгдэл шинэчлэгдлээ: ${snapshotUpdates} snapshot, ${expenseEntries} journal entry`);
    load();
  }

  if (editingAsset) {
    return (
      <AssetForm
        asset={editingAsset === 'new' ? null : editingAsset}
        categories={categories} types={types} locations={locations} employees={employees}
        currentUser={currentUser} currentProfile={currentProfile}
        onClose={() => { setEditingAsset(null); load(); }}
      />
    );
  }

  return (
    <div className="page page-wide">
      <div className="gate-tabs">
        <button className={'gate-tab' + (tab === 'list' ? ' active' : '')} onClick={() => setTab('list')}>Жагсаалт</button>
        <button className={'gate-tab' + (tab === 'maintenance' ? ' active' : '')} onClick={() => setTab('maintenance')}>Засвар үйлчилгээ</button>
        <button className={'gate-tab' + (tab === 'settings' ? ' active' : '')} onClick={() => setTab('settings')}>Тохиргоо</button>
      </div>
      {loading ? <div className="empty-state">Ачаалж байна...</div> : tab === 'list' ? (
        <AssetsListTab assets={assets} categories={categories} employees={employees} locations={locations} perm={perm}
          currentUser={currentUser} currentProfile={currentProfile} onEdit={setEditingAsset} onReload={load}
          onSync={runDepreciationSync} syncing={syncing} />
      ) : tab === 'maintenance' ? (
        <MaintenanceTab maintenance={maintenance} assets={assets} perm={perm}
          currentUser={currentUser} currentProfile={currentProfile} onReload={load} />
      ) : (
        <AssetSettingsTab categories={categories} types={types} locations={locations}
          currentUser={currentUser} currentProfile={currentProfile} onReload={load} />
      )}
    </div>
  );
}

function AssetsListTab({ assets, categories, employees, locations, perm, currentUser, currentProfile, onEdit, onReload, onSync, syncing }) {
  const [query, setQuery] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [disposing, setDisposing] = useState(null);

  const list = useMemo(
    () => filterAssetsList(assets, { query, responsibleFilter, locationFilter }),
    [assets, query, responsibleFilter, locationFilter]
  );

  async function handleDelete(a) {
    if (!perm.canDelete) return;
    if (!confirm('Устгах уу?')) return;
    const { data, error } = await sb.from('fixed_assets').delete().eq('id', a.dbId).select();
    if (error) { alert('Устгахад алдаа: ' + error.message); return; }
    if (!data || !data.length) { alert('Устгах эрхгүй байна'); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'assets', a.dbId, a.name);
    onReload();
  }

  return (
    <>
      <div className="page-header-row">
        <div className="gate-filters" style={{ marginBottom: 0 }}>
          <input placeholder="Хайх (нэр, код, barcode)..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={responsibleFilter} onChange={(e) => setResponsibleFilter(e.target.value)}>
            <option value="">Бүх хариуцагч</option>
            {employees.map((e) => <option key={e.id} value={e.fullName}>{employeeDisplayName(e)}</option>)}
          </select>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="">Бүх байршил</option>
            {locations.map((l) => <option key={l.id} value={l.label}>{l.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {perm.canWrite && <button className="btn-outline" disabled={syncing} onClick={onSync}>{syncing ? 'Шинэчилж байна...' : 'Элэгдэл шинэчлэх'}</button>}
          {perm.canAdd && <button className="btn-primary" onClick={() => onEdit('new')}>+ Хөрөнгө бүртгэх</button>}
        </div>
      </div>

      {disposing && (
        <DisposeModal asset={disposing} currentUser={currentUser} currentProfile={currentProfile}
          onClose={() => { setDisposing(null); onReload(); }} />
      )}

      {!list.length && <div className="empty-state">Үндсэн хөрөнгө олдсонгүй</div>}
      {list.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-scroll table-scroll-sticky">
          <table className="data-table" id="asset-list-table">
            <thead><tr><th>Нэр</th><th>Barcode</th><th>Ангилал</th><th>Байршил</th><th>Хариуцагч</th><th>Үнэ</th><th>Ашиглалт</th><th>Төлөв</th><th></th></tr></thead>
            <tbody>
              {list.map((a) => {
                const pct = assetLifeProgressPct(a);
                return (
                  <tr key={a.id} onClick={() => onEdit(a)}>
                    <td className="dt-title">{a.name}</td>
                    <td>
                      {a.assetBarcode ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <BarcodeSvg value={a.assetBarcode} height={18} />
                          <span className="dt-mono" style={{ fontSize: 10 }}>{a.assetBarcode}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="dt-text">{getAssetCategoryLabel(categories, a.category)}</td>
                    <td className="dt-text">{a.location || '—'}</td>
                    <td className="dt-text">{responsibleDisplayName(a.responsible, employees, employeeDisplayName) || '—'}</td>
                    <td className="dt-text dt-mono">{a.cost.toLocaleString()}₮</td>
                    <td><div className="progress-wrap" style={{ width: 80, height: 5, background: 'var(--bg-surface)', borderRadius: 3 }}><div style={{ width: pct + '%', height: '100%', background: assetLifeProgressColor(pct), borderRadius: 3 }} /></div></td>
                    <td><span className={a.status === 'active' ? 'status-ok' : 'status-muted'}>{ASSET_STATUS_LABELS[a.status]}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {perm.canWrite && a.status === 'active' && <button className="btn-ghost-sm" onClick={() => setDisposing(a)} title="Актлах">📦</button>}
                      {perm.canWrite && <button className="btn-ghost-sm" onClick={() => onEdit(a)}>✎</button>}
                      {perm.canDelete && <button className="btn-ghost-sm danger" onClick={() => handleDelete(a)}>✕</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="table-summary-bar"><span>Нийт: {list.length} бүртгэл</span></div>
        </div>
      )}
    </>
  );
}

function AssetForm({ asset, categories, types, locations, employees, currentUser, currentProfile, onClose }) {
  const isEdit = !!asset;
  const [name, setName] = useState(asset?.name || '');
  const [category, setCategory] = useState(asset?.category || categories[0]?.code || '');
  const [subcategory, setSubcategory] = useState(asset?.subcategory || '');
  const [quantity, setQuantity] = useState(asset?.quantity || 1);
  const [unit, setUnit] = useState(asset?.unit || 'ширхэг');
  const [purchaseDate, setPurchaseDate] = useState(asset?.purchaseDate || new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState(asset?.cost || '');
  const [vendor, setVendor] = useState(asset?.vendor || '');
  const [location, setLocation] = useState(asset?.location || '');
  const [responsible, setResponsible] = useState(asset?.responsible || '');
  const [usefulLife, setUsefulLife] = useState(asset?.usefulLife || 60);
  const [depMethod, setDepMethod] = useState(asset?.depMethod || 'straight_line');
  const [decliningRate, setDecliningRate] = useState(asset?.decliningRate || 20);
  const [salvage, setSalvage] = useState(asset?.salvage || 0);
  const [note, setNote] = useState(asset?.note || '');
  const [saving, setSaving] = useState(false);

  const typeOptions = types.filter((t) => t.category_code === category);

  async function handleSave() {
    if (!name.trim()) { alert('Хөрөнгийн нэрийг оруулна уу'); return; }
    setSaving(true);
    const row = {
      name: name.trim(), asset_group: 'hoa', category, subcategory,
      quantity: +quantity || 1, unit, purchase_date: purchaseDate || null, original_cost: +cost || 0,
      vendor: vendor.trim() || null, location, responsible, note: note.trim(),
      is_capitalized: true, useful_life_months: +usefulLife || 60,
      depreciation_method: depMethod, declining_rate: depMethod === 'declining_balance' ? +decliningRate : null,
      salvage_value: +salvage || 0,
    };
    let error, newId;
    if (isEdit) {
      ({ error } = await sb.from('fixed_assets').update(row).eq('id', asset.dbId));
    } else {
      const res = await sb.from('fixed_assets').insert(row).select().single();
      error = res.error; newId = res.data?.id;
      if (!error && newId) {
        const assetBarcode = String(newId).padStart(6, '0');
        await sb.from('fixed_assets').update({ asset_barcode: assetBarcode }).eq('id', newId);
      }
    }
    if (error) { setSaving(false); alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, isEdit ? 'edit' : 'add', 'assets', asset?.dbId || newId, name.trim());
    setSaving(false);
    onClose();
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row">
        <h2>{isEdit ? 'Хөрөнгө засах' : 'Хөрөнгө бүртгэх'}</h2>
        <button className="btn-ghost" onClick={onClose}>← Буцах</button>
      </div>
      {isEdit && asset.assetBarcode && (
        <div style={{ marginBottom: 14, background: 'var(--bg-surface)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <BarcodeSvg value={asset.assetBarcode} />
          <div className="dt-mono" style={{ textAlign: 'center', fontSize: 12, marginTop: 4 }}>{asset.assetBarcode}</div>
        </div>
      )}

      <label className="field"><span>Нэр</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="field-row">
        <label className="field"><span>Ангилал</span>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </label>
        <label className="field"><span>Төрөл</span>
          <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
            <option value="">—</option>
            {typeOptions.map((t) => <option key={t.id} value={t.label}>{t.label}</option>)}
          </select>
        </label>
      </div>
      <div className="field-row">
        <label className="field"><span>Тоо ширхэг</span><input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
        <label className="field"><span>Нэгж</span><input value={unit} onChange={(e) => setUnit(e.target.value)} /></label>
        <label className="field"><span>Худалдан авсан огноо</span><input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Үнэ</span><input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></label>
        <label className="field"><span>Нийлүүлэгч</span><input value={vendor} onChange={(e) => setVendor(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Байршил</span>
          <select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">—</option>
            {locations.map((l) => <option key={l.id} value={l.label}>{l.label}</option>)}
          </select>
        </label>
        <label className="field"><span>Хариуцагч</span>
          <select value={responsible} onChange={(e) => setResponsible(e.target.value)}>
            <option value="">—</option>
            {employees.map((e) => <option key={e.id} value={e.fullName}>{employeeDisplayName(e)}</option>)}
          </select>
        </label>
      </div>

      <div className="field-row">
        <label className="field"><span>Ашиглалтын хугацаа (сар)</span><input type="number" value={usefulLife} onChange={(e) => setUsefulLife(e.target.value)} /></label>
        <label className="field"><span>Элэгдлийн арга</span>
          <select value={depMethod} onChange={(e) => setDepMethod(e.target.value)}>
            <option value="straight_line">Шугаман</option>
            <option value="declining_balance">Хурдасгасан</option>
          </select>
        </label>
        {depMethod === 'declining_balance' && (
          <label className="field"><span>Хувь (%)</span><input type="number" value={decliningRate} onChange={(e) => setDecliningRate(e.target.value)} /></label>
        )}
        <label className="field"><span>Үлдэгдэл үнэ</span><input type="number" value={salvage} onChange={(e) => setSalvage(e.target.value)} /></label>
      </div>

      <label className="field"><span>Тэмдэглэл</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>

      <div className="dt-muted" style={{ marginBottom: 14 }}>
        ⚠️ Элэгдлийн мөнгөн дүнгийн тооцоолол (accumulated_depreciation/net_book_value автомат шинэчлэлт), Актлах (dispose) — эдгээр НББ journal entry үүсгэдэг тул Дүрэм 3-аар зөвшөөрөл хүлээгдэж байна. Дээрх талбарууд зөвхөн ТООЦООЛОХ ГАЗАРТАА (suh.html) хэрэглэгдэх ӨГӨГДӨЛ болж хадгалагдана.
      </div>

      <div className="form-actions">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button>
      </div>
    </div>
  );
}

function MaintenanceTab({ maintenance, assets, perm, currentUser, currentProfile, onReload }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);

  const list = useMemo(() => {
    const q = query.toLowerCase();
    return maintenance.filter((m) => {
      if (!q) return true;
      const a = assets.find((x) => x.id === m.assetId);
      return (a?.name || '').toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q);
    });
  }, [maintenance, assets, query]);

  async function handleDelete(m) {
    if (!perm.canDelete) return;
    if (!confirm('Устгах уу?')) return;
    const { error } = await sb.from('asset_maintenance').delete().eq('id', m.dbId);
    if (error) { alert('Устгахад алдаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'assets', m.dbId, null);
    onReload();
  }

  if (editing) {
    return (
      <MaintenanceForm
        maintenance={editing === 'new' ? null : editing}
        assets={assets} currentUser={currentUser} currentProfile={currentProfile}
        onClose={() => { setEditing(null); onReload(); }}
      />
    );
  }

  const totalCost = list.reduce((s, m) => s + m.cost, 0);

  return (
    <>
      <div className="page-header-row">
        <input placeholder="Хайх..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 260 }} />
        {perm.canAdd && <button className="btn-primary" onClick={() => setEditing('new')}>+ Засвар бүртгэх</button>}
      </div>
      {!list.length && <div className="empty-state">Засвар үйлчилгээ олдсонгүй</div>}
      {list.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-scroll table-scroll-sticky">
            <table className="data-table" id="asset-maintenance-table">
              <thead><tr><th>Хөрөнгө</th><th>Огноо</th><th>Тайлбар</th><th>Зардал</th><th>Нийлүүлэгч</th><th></th></tr></thead>
              <tbody>
                {list.map((m) => {
                  const a = assets.find((x) => x.id === m.assetId);
                  return (
                    <tr key={m.id} onClick={() => setEditing(m)}>
                      <td className="dt-title">{a ? a.name : '—'}</td>
                      <td className="dt-muted">{m.date || '—'}</td>
                      <td className="dt-text">{m.description || '—'}</td>
                      <td className="dt-text dt-mono">{m.cost ? m.cost.toLocaleString() + '₮' : '—'}</td>
                      <td className="dt-muted">{m.vendor || '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {perm.canWrite && <button className="btn-ghost-sm" onClick={() => setEditing(m)}>✎</button>}
                        {perm.canDelete && <button className="btn-ghost-sm danger" onClick={() => handleDelete(m)}>✕</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="table-summary-bar"><span>Нийт: {list.length} бүртгэл</span><span>Нийт зардал: {totalCost.toLocaleString()}₮</span></div>
        </div>
      )}
    </>
  );
}

function MaintenanceForm({ maintenance, assets, currentUser, currentProfile, onClose }) {
  const isEdit = !!maintenance;
  const [assetId, setAssetId] = useState(maintenance?.assetId || '');
  const [date, setDate] = useState(maintenance?.date || new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState(maintenance?.cost || 0);
  const [description, setDescription] = useState(maintenance?.description || '');
  const [vendor, setVendor] = useState(maintenance?.vendor || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!assetId) { alert('Хөрөнгө сонгоно уу'); return; }
    setSaving(true);
    const row = { asset_id: +assetId, date, cost: +cost || 0, description: description.trim(), vendor: vendor.trim() };
    let error, newId;
    if (isEdit) {
      ({ error } = await sb.from('asset_maintenance').update(row).eq('id', maintenance.dbId));
    } else {
      const res = await sb.from('asset_maintenance').insert(row).select().single();
      error = res.error; newId = res.data?.id;
    }
    if (error) { setSaving(false); alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    const assetName = assets.find((a) => a.id === +assetId)?.name || '';
    await logActivity(currentUser, currentProfile, isEdit ? 'edit' : 'add', 'assets', maintenance?.dbId || newId, `${assetName} — ${description.trim()}`);
    setSaving(false);
    onClose();
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row">
        <h2>{isEdit ? 'Засвар засах' : 'Засвар бүртгэх'}</h2>
        <button className="btn-ghost" onClick={onClose}>← Буцах</button>
      </div>
      <label className="field"><span>Хөрөнгө</span>
        <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
          <option value="">— Сонгох —</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <div className="field-row">
        <label className="field"><span>Огноо</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>Зардал</span><input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></label>
      </div>
      <label className="field"><span>Тайлбар</span><input value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <label className="field"><span>Нийлүүлэгч</span><input value={vendor} onChange={(e) => setVendor(e.target.value)} /></label>
      <div className="form-actions">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button>
      </div>
    </div>
  );
}

function AssetSettingsTab({ categories, types, locations, currentUser, currentProfile, onReload }) {
  const [sub, setSub] = useState('category');
  return (
    <>
      <div className="gate-tabs">
        <button className={'gate-tab' + (sub === 'category' ? ' active' : '')} onClick={() => setSub('category')}>Ангилал</button>
        <button className={'gate-tab' + (sub === 'type' ? ' active' : '')} onClick={() => setSub('type')}>Төрөл</button>
        <button className={'gate-tab' + (sub === 'location' ? ' active' : '')} onClick={() => setSub('location')}>Байршил</button>
      </div>
      {sub === 'category' && <CategorySettings categories={categories} types={types} currentUser={currentUser} currentProfile={currentProfile} onReload={onReload} />}
      {sub === 'type' && <TypeSettings categories={categories} types={types} currentUser={currentUser} currentProfile={currentProfile} onReload={onReload} />}
      {sub === 'location' && <LocationSettings locations={locations} currentUser={currentUser} currentProfile={currentProfile} onReload={onReload} />}
    </>
  );
}

function CategorySettings({ categories, types, currentUser, currentProfile, onReload }) {
  const [editing, setEditing] = useState(null);
  async function handleDelete(code) {
    const typeCount = types.filter((t) => t.category_code === code).length;
    if (!confirm(typeCount > 0 ? `Энэ ангилалыг устгах уу? Дотор нь бүртгэлтэй ${typeCount} төрөл ч мөн хамт устгагдана.` : 'Энэ ангилалыг устгах уу?')) return;
    const { error } = await sb.from('asset_categories').delete().eq('code', code);
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'asset-settings', code, code);
    onReload();
  }
  if (editing) {
    return (
      <CategoryForm category={editing === 'new' ? null : editing} currentUser={currentUser} currentProfile={currentProfile}
        onClose={() => { setEditing(null); onReload(); }} />
    );
  }
  return (
    <>
      <div className="page-header-row"><div /><button className="btn-primary" onClick={() => setEditing('new')}>+ Ангилал нэмэх</button></div>
      {!categories.length && <div className="empty-state">Ангилал бүртгэгдээгүй байна</div>}
      {categories.map((c) => (
        <div key={c.code} className="card" style={{ padding: 14, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700 }}>{c.label}</div>
            <div className="dt-muted" style={{ fontSize: 11, marginTop: 2 }}>Код: {c.code} · {types.filter((t) => t.category_code === c.code).length} төрөл · Анхдагч: {c.default_life_months} сар, {c.default_dep_method === 'declining_balance' ? 'Хурдасгасан' : 'Шугаман'}</div>
          </div>
          <div>
            <button className="btn-ghost-sm" onClick={() => setEditing(c)}>✎</button>
            <button className="btn-ghost-sm danger" onClick={() => handleDelete(c.code)}>✕</button>
          </div>
        </div>
      ))}
    </>
  );
}

function CategoryForm({ category, currentUser, currentProfile, onClose }) {
  const isEdit = !!category;
  const [code, setCode] = useState(category?.code || '');
  const [label, setLabel] = useState(category?.label || '');
  const [lifeMonths, setLifeMonths] = useState(category?.default_life_months || 60);
  const [method, setMethod] = useState(category?.default_dep_method || 'straight_line');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!code.trim() || !label.trim()) { alert('Код болон нэрийг бөглөнө γγ'); return; }
    setSaving(true);
    const row = { code: code.trim(), label: label.trim(), default_life_months: +lifeMonths || 60, default_dep_method: method };
    const { error } = await sb.from('asset_categories').upsert(row, { onConflict: 'code' });
    if (error) { setSaving(false); alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, isEdit ? 'edit' : 'add', 'asset-settings', code.trim(), label.trim());
    setSaving(false);
    onClose();
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row"><h2>{isEdit ? 'Ангилал засах' : 'Ангилал нэмэх'}</h2><button className="btn-ghost" onClick={onClose}>← Буцах</button></div>
      <div className="field-row">
        <label className="field"><span>Код</span><input value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} /></label>
        <label className="field"><span>Нэр</span><input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Анхдагч ашиглалтын хугацаа (сар)</span><input type="number" value={lifeMonths} onChange={(e) => setLifeMonths(e.target.value)} /></label>
        <label className="field"><span>Анхдагч элэгдлийн арга</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="straight_line">Шугаман</option>
            <option value="declining_balance">Хурдасгасан</option>
          </select>
        </label>
      </div>
      <div className="form-actions"><button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button></div>
    </div>
  );
}

function TypeSettings({ categories, types, currentUser, currentProfile, onReload }) {
  const [filterCat, setFilterCat] = useState(categories[0]?.code || '');
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const list = types.filter((t) => t.category_code === filterCat);

  async function handleAdd() {
    if (!newLabel.trim()) { alert('Төрлийн нэрийг бөглөнө γγ'); return; }
    const { error } = await sb.from('asset_types').insert({ category_code: filterCat, label: newLabel.trim() });
    if (error) { alert('Хадгалахад алдаа гарлаа: ' + (error.code === '23505' ? 'Энэ нэртэй төрөл аль хэдийн байна' : error.message)); return; }
    await logActivity(currentUser, currentProfile, 'add', 'asset-settings', null, newLabel.trim());
    setNewLabel(''); setAdding(false);
    onReload();
  }
  async function handleDelete(t) {
    if (!confirm('Энэ төрлийг устгах уу?')) return;
    const { error } = await sb.from('asset_types').delete().eq('id', t.id);
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'asset-settings', t.id, t.label);
    onReload();
  }

  return (
    <>
      <div className="page-header-row">
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="news-topic-filter" style={{ marginBottom: 0 }}>
          {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setAdding(true)}>+ Төрөл нэмэх</button>
      </div>
      {adding && (
        <div className="wizard-row" style={{ marginBottom: 12 }}>
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Төрлийн нэр" />
          <button className="btn-primary btn-sm" onClick={handleAdd}>Нэмэх</button>
          <button className="btn-ghost-sm" onClick={() => setAdding(false)}>Болих</button>
        </div>
      )}
      {!list.length && <div className="empty-state">Энэ ангилалд төрөл бүртгэгдээгүй байна</div>}
      {list.map((t) => (
        <div key={t.id} className="card" style={{ padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600 }}>{t.label}</div>
          <button className="btn-ghost-sm danger" onClick={() => handleDelete(t)}>✕</button>
        </div>
      ))}
    </>
  );
}

function LocationSettings({ locations, currentUser, currentProfile, onReload }) {
  const [editing, setEditing] = useState(null);
  const [label, setLabel] = useState('');

  async function handleSave() {
    if (!label.trim()) { alert('Байршлын нэрийг бөглөнө γγ'); return; }
    const isEdit = editing !== 'new';
    const { error } = isEdit
      ? await sb.from('asset_locations').update({ label: label.trim() }).eq('id', editing.id)
      : await sb.from('asset_locations').insert({ label: label.trim() });
    if (error) { alert('Хадгалахад алдаа гарлаа: ' + (error.code === '23505' ? 'Энэ нэртэй байршил аль хэдийн байна' : error.message)); return; }
    await logActivity(currentUser, currentProfile, isEdit ? 'edit' : 'add', 'asset-settings', isEdit ? editing.id : null, label.trim());
    setEditing(null); setLabel('');
    onReload();
  }
  async function handleDelete(l) {
    if (!confirm('Энэ байршлыг устгах уу?')) return;
    const { error } = await sb.from('asset_locations').delete().eq('id', l.id);
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'asset-settings', l.id, l.label);
    onReload();
  }

  return (
    <>
      <div className="page-header-row">
        <div />
        <button className="btn-primary" onClick={() => { setEditing('new'); setLabel(''); }}>+ Байршил нэмэх</button>
      </div>
      {editing && (
        <div className="wizard-row" style={{ marginBottom: 12 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Байршлын нэр" />
          <button className="btn-primary btn-sm" onClick={handleSave}>Хадгалах</button>
          <button className="btn-ghost-sm" onClick={() => setEditing(null)}>Болих</button>
        </div>
      )}
      {!locations.length && <div className="empty-state">Байршил бүртгэгдээгүй байна</div>}
      {locations.map((l) => (
        <div key={l.id} className="card" style={{ padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600 }}>{l.label}</div>
          <div>
            <button className="btn-ghost-sm" onClick={() => { setEditing(l); setLabel(l.label); }}>✎</button>
            <button className="btn-ghost-sm danger" onClick={() => handleDelete(l)}>✕</button>
          </div>
        </div>
      ))}
    </>
  );
}

// assets.js-ийн confirmDisposeAsset() (мөр ~744) — хэрэглэгчийн 2026-08-06
// зөвшөөрлөөр React рүү портлогдов. Эхлээд ledger-ийг өнөөдрийн байдалд нөхөж
// (gap байвал элэгдэл нэмж бичээд), дараа нь БОДИТ ledger үлдэгдлээр актална.
function DisposeModal({ asset, currentUser, currentProfile, onClose }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('Эвдэрсэн');
  const [value, setValue] = useState(0);
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    const { error } = await sb.from('fixed_assets').update({
      status: 'disposed', disposal_date: date, disposal_reason: reason, disposal_value: +value || 0,
    }).eq('id', asset.dbId);
    if (error) { setSaving(false); alert('Актлахад алдаа гарлаа: ' + error.message); return; }

    const { accumulated: formulaAccumulated } = computeDepreciation({ ...asset, status: 'disposed', disposalDate: date }, monthsBetweenDates);
    const ledgerAccumulated = await dbGetPartyBalance('2015', 'asset:' + asset.dbId);
    const gap = +(formulaAccumulated - ledgerAccumulated).toFixed(2);
    if (gap >= 1) {
      await accountingRecordDepreciation(asset.dbId, asset.name, gap, date);
    }
    const finalAccumulated = gap >= 1 ? formulaAccumulated : ledgerAccumulated;
    const res = await accountingRecordAssetDisposal(asset.dbId, asset.name, asset.cost, finalAccumulated, +value || 0, date);
    if (!res.success) console.warn('Journal entry үүсгэхэд алдаа:', res.error);

    await logActivity(currentUser, currentProfile, 'dispose', 'assets', asset.dbId, asset.name);
    setSaving(false);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="page-header-row"><h2>{asset.name} — актлах</h2><button className="btn-ghost" onClick={onClose}>✕</button></div>
        <label className="field"><span>Актласан огноо</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>Шалтгаан</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="Эвдэрсэн">Эвдэрсэн</option>
            <option value="Хуучирсан">Хуучирсан</option>
            <option value="Борлуулсан">Борлуулсан</option>
            <option value="Алдагдсан">Алдагдсан</option>
            <option value="Бусад">Бусад</option>
          </select>
        </label>
        <label className="field"><span>Борлуулсан үнэ (байвал)</span><input type="number" value={value} onChange={(e) => setValue(e.target.value)} /></label>
        <div className="dt-muted" style={{ marginBottom: 14 }}>
          Энэ үйлдлийг буцаах боломжгүй — элэгдлийг ledger-тэй нийцүүлж нөхөөд, дараа нь актална.
        </div>
        <div className="form-actions">
          <button className="btn-primary" disabled={saving} onClick={handleConfirm}>Актлах</button>
        </div>
      </div>
    </div>
  );
}
