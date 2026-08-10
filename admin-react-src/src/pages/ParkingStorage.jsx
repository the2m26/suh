import { useCallback, useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { logActivity } from '../lib/dbUtils';
import {
  spotFullLabel, getSpotOwner, parseAffixRange, parseZoneRange, parseNumberRange,
} from '../lib/parkingStorageHelpers';

const KIND_CONFIG = {
  parking: { table: 'parking_types', numField: 'spot_numbers', label: 'Зогсоол', emptyLabel: 'Зогсоол бүртгэгдээгүй байна' },
  storage: { table: 'storage_types', numField: 'unit_numbers', label: 'Агуулах', emptyLabel: 'Агуулах бүртгэгдээгүй байна' },
};

export function ParkingStorageTabs({ kind, setKind, buildings, parkingTypes, storageTypes, residents, businesses, loading, perm, currentUser, currentProfile, onReload }) {
  const [view, setView] = useState('list');
  const types = kind === 'parking' ? parkingTypes : storageTypes;
  const cfg = KIND_CONFIG[kind];

  if (view !== 'list') {
    return (
      <SpotTypeForm
        kind={kind}
        spotType={view === 'new' ? null : view}
        buildings={buildings}
        currentUser={currentUser}
        currentProfile={currentProfile}
        onClose={() => { setView('list'); onReload(); }}
      />
    );
  }

  return (
    <>
      <SpotOwnershipList kind={kind} types={types} buildings={buildings} residents={residents} businesses={businesses} loading={loading} />
      <div className="page-header-row" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 14 }}>{cfg.label}ын төрөл (тохиргоо)</h3>
        {perm.canAdd && <button className="btn-primary" onClick={() => setView('new')}>+ {cfg.label} нэмэх</button>}
      </div>
      <SpotTypeTable kind={kind} types={types} buildings={buildings} perm={perm} currentUser={currentUser} currentProfile={currentProfile} onEdit={setView} onReload={onReload} />
    </>
  );
}

export default function ParkingStorage() {
  const { currentUser, currentProfile } = useAuth();
  const { canAdd, canWrite, canDelete } = usePermissions();
  const [kind, setKind] = useState('parking');
  const [buildings, setBuildings] = useState([]);
  const [parkingTypes, setParkingTypes] = useState([]);
  const [storageTypes, setStorageTypes] = useState([]);
  const [residents, setResidents] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'new' | type object

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: b }, { data: pt }, { data: st }, { data: res }, { data: biz }] = await Promise.all([
      sb.from('buildings').select('id, label'),
      sb.from('parking_types').select('*'),
      sb.from('storage_types').select('*'),
      sb.from('residents').select('id, firstname, lastname, parkings, storages'),
      sb.from('businesses').select('id, name, parkings, storages'),
    ]);
    setBuildings(b || []);
    setParkingTypes(pt || []);
    setStorageTypes(st || []);
    setResidents(res || []);
    setBusinesses(biz || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const perm = { canAdd: canAdd('apartments'), canWrite: canWrite('apartments'), canDelete: canDelete('apartments') };
  const types = kind === 'parking' ? parkingTypes : storageTypes;
  const cfg = KIND_CONFIG[kind];

  if (view !== 'list') {
    return (
      <SpotTypeForm
        kind={kind}
        spotType={view === 'new' ? null : view}
        buildings={buildings}
        currentUser={currentUser}
        currentProfile={currentProfile}
        onClose={() => { setView('list'); load(); }}
      />
    );
  }

  return (
    <div className="page page-wide">
      <div className="gate-tabs">
        <button className={'gate-tab' + (kind === 'parking' ? ' active' : '')} onClick={() => setKind('parking')}>Зогсоол</button>
        <button className={'gate-tab' + (kind === 'storage' ? ' active' : '')} onClick={() => setKind('storage')}>Агуулах</button>
      </div>

      <SpotOwnershipList kind={kind} types={types} buildings={buildings} residents={residents} businesses={businesses} loading={loading} />

      <div className="page-header-row" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 14 }}>{cfg.label}ын төрөл (тохиргоо)</h3>
        {perm.canAdd && <button className="btn-primary" onClick={() => setView('new')}>+ {cfg.label} нэмэх</button>}
      </div>
      <SpotTypeTable kind={kind} types={types} buildings={buildings} perm={perm} currentUser={currentUser} currentProfile={currentProfile} onEdit={setView} onReload={load} />
    </div>
  );
}

function SpotOwnershipList({ kind, types, buildings, residents, businesses, loading }) {
  const cfg = KIND_CONFIG[kind];
  const rows = useMemo(() => {
    const out = [];
    types.forEach((t) => {
      const bld = buildings.find((b) => b.id === t.building_id);
      const nums = Array.isArray(t[cfg.numField]) ? t[cfg.numField] : [];
      nums.forEach((num) => {
        const full = spotFullLabel(t.floor_label, t.zone_label, num);
        const owner = getSpotOwner(kind, full, residents, businesses);
        out.push({ building: bld ? bld.label : 'Тодорхойгүй', floor: t.floor_label, zone: t.zone_label, num, sqm: t.sqm, owner });
      });
    });
    return out;
  }, [types, buildings, residents, businesses, kind, cfg.numField]);

  if (loading) return <div className="empty-state">Ачаалж байна...</div>;
  if (!rows.length) return <div className="empty-state">{cfg.emptyLabel}</div>;

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr><th>Байр</th><th>Давхар</th><th>Бүс</th><th>Дугаар</th><th>м²</th><th>Эзэмшигч</th><th>Төлөв</th></tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td className="dt-text">{row.building}</td>
              <td className="dt-muted">{row.floor || '—'}</td>
              <td className="dt-muted">{row.zone || '—'}</td>
              <td className="dt-title dt-mono">{row.num}</td>
              <td className="dt-text dt-mono">{row.sqm || '—'}</td>
              <td className="dt-text">{row.owner ? (row.owner.obj.firstname ? `${row.owner.obj.firstname} ${row.owner.obj.lastname}` : row.owner.obj.name) + (row.owner.type === 'business' ? ' (ААН)' : '') : <span className="dt-muted">—</span>}</td>
              <td>{row.owner ? <span className="status-ok">Эзэмшигчтэй</span> : <span className="status-muted">Хоосон</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpotTypeTable({ kind, types, buildings, perm, currentUser, currentProfile, onEdit, onReload }) {
  const cfg = KIND_CONFIG[kind];
  async function handleDelete(id) {
    if (!perm.canDelete) return;
    if (!confirm(`Энэ ${cfg.label.toLowerCase()}ыг устгах уу?`)) return;
    const { error } = await sb.from(cfg.table).delete().eq('id', id);
    if (error) { alert('Устгахад алдаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'apartments', id, cfg.label);
    onReload();
  }
  if (!types.length) return <div className="empty-state">Өгөгдөл байхгүй</div>;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr><th>Байр</th><th>Давхар</th><th>Бүс</th><th>Дугаарууд</th><th>м²</th><th></th></tr></thead>
        <tbody>
          {types.map((t) => {
            const bld = buildings.find((b) => b.id === t.building_id);
            const nums = Array.isArray(t[cfg.numField]) ? t[cfg.numField] : [];
            const preview = nums.length > 6 ? nums.slice(0, 6).join(', ') + `... (${nums.length})` : nums.join(', ');
            return (
              <tr key={t.id}>
                <td className="dt-text">{bld ? bld.label : (t.building_id || '—')}</td>
                <td className="dt-text">{t.floor_label || '—'}</td>
                <td className="dt-text">{t.zone_label || '—'}</td>
                <td className="dt-title" style={{ fontSize: 12 }}>{preview || '—'}</td>
                <td className="dt-title dt-mono">{t.sqm || '—'}</td>
                <td>
                  {perm.canWrite && <button className="btn-ghost-sm" onClick={() => onEdit(t)}>✎</button>}
                  {perm.canDelete && <button className="btn-ghost-sm danger" onClick={() => handleDelete(t.id)}>✕</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SpotTypeForm({ kind, spotType, buildings, currentUser, currentProfile, onClose }) {
  const cfg = KIND_CONFIG[kind];
  const isEdit = !!spotType;
  const [hasBuilding, setHasBuilding] = useState(!!spotType?.building_id);
  const [buildingId, setBuildingId] = useState(spotType?.building_id || buildings[0]?.id || '');
  const [hasFloor, setHasFloor] = useState(!!spotType?.floor_label);
  const [floorRange, setFloorRange] = useState(spotType?.floor_label || '');
  const [hasZone, setHasZone] = useState(!!spotType?.zone_label);
  const [zoneRange, setZoneRange] = useState(spotType?.zone_label || '');
  const [numRange, setNumRange] = useState(spotType ? (Array.isArray(spotType[cfg.numField]) ? spotType[cfg.numField].join(',') : spotType[cfg.numField]) : '');
  const [sqm, setSqm] = useState(spotType?.sqm || '');
  const [saving, setSaving] = useState(false);

  const numbers = parseNumberRange(numRange);
  const floors = hasFloor ? parseAffixRange(floorRange) : [null];
  const zones = hasZone ? parseZoneRange(zoneRange) : [null];
  const combos = floors.length * zones.length;
  const preview = numbers.length ? `${combos} бүлэг үүснэ, нийт ${combos * numbers.length} ${cfg.label.toLowerCase()}` : '';

  async function handleSave() {
    if (!numRange.trim()) { alert('Дугаарлалтын муж оруулна уу'); return; }
    setSaving(true);
    const bldId = hasBuilding ? +buildingId : null;

    if (isEdit) {
      const row = {
        building_id: bldId,
        floor_label: hasFloor ? floorRange.trim() : null,
        zone_label: hasZone ? zoneRange.trim() : null,
        [cfg.numField]: numbers, sqm: parseFloat(sqm) || null,
      };
      const { error } = await sb.from(cfg.table).update(row).eq('id', spotType.id);
      if (error) { setSaving(false); alert('Алдаа: ' + error.message); return; }
      await logActivity(currentUser, currentProfile, 'edit', 'apartments', spotType.id, cfg.label);
    } else {
      if (hasFloor && !floorRange.trim()) { setSaving(false); alert('Давхрын муж оруулна уу'); return; }
      if (hasZone && !zoneRange.trim()) { setSaving(false); alert('Бүсчлэлийн муж оруулна уу'); return; }
      const rows = [];
      for (const floor of floors) {
        for (const zone of zones) {
          rows.push({ building_id: bldId, floor_label: floor, zone_label: zone, [cfg.numField]: numbers, sqm: parseFloat(sqm) || null });
        }
      }
      const { error } = await sb.from(cfg.table).insert(rows);
      if (error) { setSaving(false); alert('Алдаа: ' + error.message); return; }
      await logActivity(currentUser, currentProfile, 'add', 'apartments', null, `${rows.length * numbers.length} ${cfg.label.toLowerCase()} нэмэв`);
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row">
        <h2>{isEdit ? `${cfg.label} засах` : `${cfg.label} нэмэх`}</h2>
        <button className="btn-ghost" onClick={onClose}>← Буцах</button>
      </div>

      <label><input type="checkbox" checked={hasBuilding} onChange={(e) => setHasBuilding(e.target.checked)} /> Тодорхой байртай холбох</label>
      {hasBuilding && (
        <label className="field"><span>Байр</span>
          <select value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
      )}

      <label style={{ display: 'block', marginTop: 10 }}><input type="checkbox" checked={hasFloor} onChange={(e) => setHasFloor(e.target.checked)} disabled={isEdit} /> Давхар/блок ялгаатай</label>
      {hasFloor && (
        <label className="field"><span>Давхрын муж (ж: B1-B6 эсвэл B1)</span><input value={floorRange} onChange={(e) => setFloorRange(e.target.value)} disabled={isEdit} /></label>
      )}

      <label style={{ display: 'block', marginTop: 10 }}><input type="checkbox" checked={hasZone} onChange={(e) => setHasZone(e.target.checked)} disabled={isEdit} /> Бүсчлэлтэй</label>
      {hasZone && (
        <label className="field"><span>Бүсийн муж (ж: A-G)</span><input value={zoneRange} onChange={(e) => setZoneRange(e.target.value)} disabled={isEdit} /></label>
      )}

      <label className="field"><span>Дугаарлалтын муж (ж: 001-121)</span><input value={numRange} onChange={(e) => setNumRange(e.target.value)} /></label>
      <label className="field"><span>Талбай (м²)</span><input type="number" step="0.1" value={sqm} onChange={(e) => setSqm(e.target.value)} /></label>

      {preview && <div className="dt-muted" style={{ marginBottom: 14 }}>{preview}</div>}
      {isEdit && <div className="dt-muted" style={{ marginBottom: 14 }}>⚠️ Засах горимд Давхар/Бүс өөрчлөгдөхгүй, зөвхөн энэ 1 бүлгийн дугаар/талбай шинэчлэгдэнэ.</div>}

      <div className="form-actions">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button>
      </div>
    </div>
  );
}
