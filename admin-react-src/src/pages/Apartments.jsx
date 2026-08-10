import { useCallback, useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { logActivity } from '../lib/dbUtils';
import { GROUP_COLORS, NUMBERING_SCHEME_LABELS, getAptLabel } from '../lib/buildingHelpers';
import { ParkingStorageTabs } from './ParkingStorage';

export default function Apartments() {
  const { currentUser, currentProfile } = useAuth();
  const { canAdd, canWrite, canDelete } = usePermissions();
  const [tab, setTab] = useState('buildings');
  const [spotKind, setSpotKind] = useState('parking');
  const [buildings, setBuildings] = useState([]);
  const [aptTypes, setAptTypes] = useState([]);
  const [parkingTypes, setParkingTypes] = useState([]);
  const [storageTypes, setStorageTypes] = useState([]);
  const [residents, setResidents] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: b, error: bErr }, { data: t, error: tErr }, { data: pt }, { data: st }, { data: res }, { data: biz }] = await Promise.all([
      sb.from('buildings').select('*').order('id'),
      sb.from('apt_types').select('*'),
      sb.from('parking_types').select('*'),
      sb.from('storage_types').select('*'),
      sb.from('residents').select('id, firstname, lastname, parkings, storages'),
      sb.from('businesses').select('id, name, parkings, storages'),
    ]);
    if (bErr) console.error('buildings ачаалах алдаа:', bErr.message);
    if (tErr) console.error('apt_types ачаалах алдаа:', tErr.message);
    setBuildings((b || []).map((row) => ({
      id: row.id, floors: row.floors, aptsPerFloor: row.apts_per_floor,
      group: row.group_name || 'A', label: row.label, entrances: row.entrances || 1,
      numbering_scheme: row.numbering_scheme || 'floor_door', seq_start: row.seq_start || 101,
    })));
    setAptTypes(t || []);
    setParkingTypes(pt || []);
    setStorageTypes(st || []);
    setResidents(res || []);
    setBusinesses(biz || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const perm = { canAdd: canAdd('apartments'), canWrite: canWrite('apartments'), canDelete: canDelete('apartments') };

  return (
    <div className="page page-wide">
      <div className="gate-tabs">
        <button className={'gate-tab' + (tab === 'buildings' ? ' active' : '')} onClick={() => setTab('buildings')}>Байрууд</button>
        <button className={'gate-tab' + (tab === 'apttypes' ? ' active' : '')} onClick={() => setTab('apttypes')}>Талбайн төрөл</button>
        <button className={'gate-tab' + (tab === 'parking' ? ' active' : '')} onClick={() => { setTab('parking'); setSpotKind('parking'); }}>Зогсоол</button>
        <button className={'gate-tab' + (tab === 'storage' ? ' active' : '')} onClick={() => { setTab('storage'); setSpotKind('storage'); }}>Агуулах</button>
      </div>
      {loading ? <div className="empty-state">Ачаалж байна...</div> : tab === 'buildings' ? (
        <BuildingsTab buildings={buildings} perm={perm} currentUser={currentUser} currentProfile={currentProfile} onReload={load} />
      ) : tab === 'apttypes' ? (
        <AptTypesTab aptTypes={aptTypes} buildings={buildings} perm={perm} currentUser={currentUser} currentProfile={currentProfile} onReload={load} />
      ) : (
        <ParkingStorageTabs
          kind={spotKind} setKind={setSpotKind}
          buildings={buildings} parkingTypes={parkingTypes} storageTypes={storageTypes}
          residents={residents} businesses={businesses} loading={loading}
          perm={perm} currentUser={currentUser} currentProfile={currentProfile} onReload={load}
        />
      )}
    </div>
  );
}

function BuildingsTab({ buildings, perm, currentUser, currentProfile, onReload }) {
  const [editing, setEditing] = useState(null); // null | 'new' | building object

  async function handleDelete(id) {
    if (!perm.canDelete) return;
    if (!confirm(id + '-р байрыг устгах уу? Холбоотой өгөгдлүүд хэвээр үлдэнэ.')) return;
    const { error } = await sb.from('buildings').delete().eq('id', id);
    if (error) { alert('Устгахад алдаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'apartments', id, `${id}-р байр`);
    onReload();
  }

  if (editing) {
    return (
      <BuildingForm
        building={editing === 'new' ? null : editing}
        currentUser={currentUser}
        currentProfile={currentProfile}
        onClose={() => { setEditing(null); onReload(); }}
      />
    );
  }

  return (
    <>
      <div className="page-header-row">
        <div />
        {perm.canAdd && <button className="btn-primary" onClick={() => setEditing('new')}>+ Байр нэмэх</button>}
      </div>
      {!buildings.length && <div className="empty-state">Байр байхгүй</div>}
      {buildings.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-scroll table-scroll-sticky">
            <table className="data-table">
              <thead>
                <tr><th>ID</th><th>Нэр</th><th>Давхар</th><th>Тоот</th><th>Дугаарлалт</th><th>Групп</th><th></th></tr>
              </thead>
              <tbody>
                {buildings.map((b) => {
                  const gc = GROUP_COLORS[b.group] || GROUP_COLORS.A;
                  return (
                    <tr key={b.id}>
                      <td className="dt-mono dt-title">{b.id}</td>
                      <td className="dt-text">{b.label}</td>
                      <td className="dt-text ta-center">{b.floors}</td>
                      <td className="dt-text ta-center">{b.entrances > 1 ? b.entrances + 'орц · ' : ''}{b.aptsPerFloor}/давхар</td>
                      <td className="dt-muted">{NUMBERING_SCHEME_LABELS[b.numbering_scheme] || 'Давхар+Хаалга'}</td>
                      <td><span className="tag" style={{ background: gc.bg, color: gc.text, border: `1px solid ${gc.border}` }}>{b.group}</span></td>
                      <td>
                        {perm.canWrite && <button className="btn-ghost-sm" onClick={() => setEditing(b)}>✎</button>}
                        {perm.canDelete && <button className="btn-ghost-sm danger" onClick={() => handleDelete(b.id)}>✕</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="table-summary-bar"><span>Нийт: {buildings.length} байр</span></div>
        </div>
      )}
    </>
  );
}

function BuildingForm({ building, currentUser, currentProfile, onClose }) {
  const isEdit = !!building;
  const [id, setId] = useState(building?.id || '');
  const [label, setLabel] = useState(building?.label || '');
  const [floors, setFloors] = useState(building?.floors || '');
  const [apts, setApts] = useState(building ? building.aptsPerFloor / (building.entrances || 1) : '');
  const [entrances, setEntrances] = useState(building?.entrances || 1);
  const [group, setGroup] = useState(building?.group || 'A');
  const [scheme, setScheme] = useState(building?.numbering_scheme || 'floor_door');
  const [seqStart, setSeqStart] = useState(building?.seq_start || 101);
  const [saving, setSaving] = useState(false);

  const sample = floors && apts
    ? getAptLabel(scheme, 1, 1, 1, +apts, +seqStart, +floors) + ' / ' + getAptLabel(scheme, entrances || 1, +floors, +apts, +apts, +seqStart, +floors)
    : '—';

  async function handleSave() {
    const nId = +id, nFloors = +floors, nApts = +apts, nEntrances = +entrances || 1;
    if (!nId || !label.trim() || !nFloors || !nApts) { alert('Бүх талбарыг бөглөнө vv'); return; }
    setSaving(true);
    const row = {
      id: nId, label: label.trim(), floors: nFloors, apts_per_floor: nApts * nEntrances,
      group_name: group, entrances: nEntrances, numbering_scheme: scheme,
      seq_start: scheme === 'sequential' ? +seqStart : null,
    };
    let error;
    if (isEdit) {
      if (nId !== building.id) {
        ({ error } = await sb.from('buildings').delete().eq('id', building.id));
        if (!error) ({ error } = await sb.from('buildings').insert(row));
      } else {
        ({ error } = await sb.from('buildings').update({
          label: row.label, floors: row.floors, apts_per_floor: row.apts_per_floor,
          group_name: row.group_name, entrances: row.entrances, numbering_scheme: row.numbering_scheme, seq_start: row.seq_start,
        }).eq('id', building.id));
      }
    } else {
      ({ error } = await sb.from('buildings').insert(row));
    }
    if (error) { setSaving(false); alert('Алдаа: ' + error.message); return; }

    const { data: existingTypes } = await sb.from('apt_types').select('id').eq('building_id', nId);
    if (!existingTypes || existingTypes.length === 0) {
      const doorNumbers = Array.from({ length: nApts }, (_, i) => i + 1);
      await sb.from('apt_types').insert({ building_id: nId, door_numbers: doorNumbers });
    }

    await logActivity(currentUser, currentProfile, isEdit ? 'edit' : 'add', 'apartments', nId, `${nId}-р байр (${label})`);
    setSaving(false);
    onClose();
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row">
        <h2>{isEdit ? 'Байрны бүтэц засах' : 'Байр нэмэх'}</h2>
        <button className="btn-ghost" onClick={onClose}>← Буцах</button>
      </div>
      <div className="field-row">
        <label className="field"><span>ID (байрны дугаар)</span><input type="number" value={id} onChange={(e) => setId(e.target.value)} /></label>
        <label className="field"><span>Групп</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {Object.keys(GROUP_COLORS).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
      </div>
      <label className="field"><span>Нэр</span><input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <div className="field-row">
        <label className="field"><span>Давхрын тоо</span><input type="number" value={floors} onChange={(e) => setFloors(e.target.value)} /></label>
        <label className="field"><span>Тоот/давхар (орц тус бүр)</span><input type="number" value={apts} onChange={(e) => setApts(e.target.value)} /></label>
        <label className="field"><span>Орцны тоо</span><input type="number" min="1" value={entrances} onChange={(e) => setEntrances(e.target.value)} /></label>
      </div>
      <div className="field">
        <span>Дугаарлалтын хэлбэр</span>
        <div className="poll-type-btns">
          {Object.entries(NUMBERING_SCHEME_LABELS).map(([k, v]) => (
            <button key={k} type="button" className={'poll-type-btn' + (scheme === k ? ' active' : '')} onClick={() => setScheme(k)}>{v}</button>
          ))}
        </div>
      </div>
      {scheme === 'sequential' && (
        <label className="field"><span>Эхлэх дугаар</span><input type="number" value={seqStart} onChange={(e) => setSeqStart(e.target.value)} /></label>
      )}
      <div className="field">
        <span>Жишээ тоот</span>
        <div className="dt-mono">{sample}</div>
      </div>
      <div className="form-actions">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button>
      </div>
    </div>
  );
}

function AptTypesTab({ aptTypes, buildings, perm, currentUser, currentProfile, onReload }) {
  const [filterBld, setFilterBld] = useState('');
  const [editing, setEditing] = useState(null);

  const list = (filterBld ? aptTypes.filter((t) => t.building_id === +filterBld) : aptTypes)
    .slice().sort((a, b) => a.building_id - b.building_id || a.id - b.id);

  async function handleDelete(id) {
    if (!perm.canDelete) return;
    if (!confirm('Энэ талбайн төрлийг устгах уу?')) return;
    const { error } = await sb.from('apt_types').delete().eq('id', id);
    if (error) { alert('Устгахад алдаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'apartments', id, 'Талбайн төрөл');
    onReload();
  }

  if (editing) {
    return (
      <AptTypeForm
        aptType={editing === 'new' ? null : editing}
        buildings={buildings}
        currentUser={currentUser}
        currentProfile={currentProfile}
        onClose={() => { setEditing(null); onReload(); }}
      />
    );
  }

  return (
    <>
      <div className="page-header-row">
        <select value={filterBld} onChange={(e) => setFilterBld(e.target.value)} className="news-topic-filter" style={{ marginBottom: 0 }}>
          <option value="">Бүх байр</option>
          {buildings.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        {perm.canAdd && <button className="btn-primary" onClick={() => setEditing('new')}>+ Талбайн төрөл нэмэх</button>}
      </div>
      {!list.length && <div className="empty-state">Өгөгдөл байхгүй</div>}
      {list.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-scroll table-scroll-sticky">
            <table className="data-table">
              <thead><tr><th>Байр</th><th>Хаалга</th><th>Талбай</th><th></th></tr></thead>
              <tbody>
                {list.map((t) => {
                  const bld = buildings.find((b) => b.id === t.building_id);
                  const doors = Array.isArray(t.door_numbers) ? t.door_numbers.join(', ') : t.door_numbers;
                  return (
                    <tr key={t.id}>
                      <td className="dt-text">{bld ? bld.label : t.building_id}</td>
                      <td className="dt-text">Хаалга: <span className="dt-title">{doors}</span></td>
                      <td className="dt-title dt-mono">{t.sqm} м²</td>
                      <td>
                        {perm.canWrite && <button className="btn-ghost-sm" onClick={() => setEditing(t)}>✎</button>}
                        {perm.canDelete && <button className="btn-ghost-sm danger" onClick={() => handleDelete(t.id)}>✕</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="table-summary-bar"><span>Нийт: {list.length} мөр</span></div>
        </div>
      )}
    </>
  );
}

function AptTypeForm({ aptType, buildings, currentUser, currentProfile, onClose }) {
  const isEdit = !!aptType;
  const [buildingId, setBuildingId] = useState(aptType?.building_id || buildings[0]?.id || '');
  const [doors, setDoors] = useState(aptType ? (Array.isArray(aptType.door_numbers) ? aptType.door_numbers.join(',') : aptType.door_numbers) : '');
  const [sqm, setSqm] = useState(aptType?.sqm || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const bldId = +buildingId;
    const parsedDoors = doors.trim().split(/[,\s]+/).map(Number).filter(Boolean);
    const parsedSqm = parseFloat(sqm);
    if (!bldId || !parsedDoors.length || !parsedSqm) { alert('Бүх талбарыг зөв бөглөнө vv (ж: 1,2,3)'); return; }
    setSaving(true);
    const row = { building_id: bldId, door_numbers: parsedDoors, sqm: parsedSqm };
    let error;
    if (isEdit) {
      ({ error } = await sb.from('apt_types').update(row).eq('id', aptType.id));
    } else {
      ({ error } = await sb.from('apt_types').insert(row));
    }
    if (error) { setSaving(false); alert('Алдаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, isEdit ? 'edit' : 'add', 'apartments', aptType?.id || null, `${bldId}-р байрны талбайн төрөл`);
    setSaving(false);
    onClose();
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row">
        <h2>{isEdit ? 'Талбайн төрөл засах' : 'Талбайн төрөл нэмэх'}</h2>
        <button className="btn-ghost" onClick={onClose}>← Буцах</button>
      </div>
      <label className="field"><span>Байр</span>
        <select value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
          {buildings.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </label>
      <label className="field"><span>Хаалганы дугаарууд (таслалаар тусгаарлаж)</span><input value={doors} onChange={(e) => setDoors(e.target.value)} placeholder="ж: 1,2,3" /></label>
      <label className="field"><span>Талбай (м²)</span><input type="number" step="0.1" value={sqm} onChange={(e) => setSqm(e.target.value)} /></label>
      <div className="form-actions">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button>
      </div>
    </div>
  );
}
