import { useCallback, useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { logActivity, printCurrentPage, exportTableToXlsx } from '../lib/dbUtils';
import { makeAptId } from '../lib/buildingHelpers';
import { residentSqm, filterResidentsList, residentMonthBadges } from '../lib/residentHelpers';
import { validateSpotAssignment, spotFullLabel } from '../lib/parkingStorageHelpers';
import SpotPickerRow from '../components/SpotPickerRow';

function mapResidentRow(r) {
  return {
    id: r.id, dbId: r.id, building: r.building, floor: r.floor, door: r.door, entrance: r.entrance, apt: r.apt,
    isVirtual: r.is_virtual || false,
    firstname: r.firstname || '', lastname: r.lastname || '', reg: r.reg || '', oeubd: r.oeubd || '', ownDate: r.own_date || '',
    phones: r.phones || [], emails: r.emails || [],
    people: r.is_virtual ? 0 : (r.people || 1), child1: r.child1 || 0, child2: r.child2 || 0,
    parkings: r.parkings || [], storages: r.storages || [], vehicles: r.vehicles || [],
  };
}

export default function Residents() {
  const { currentUser, currentProfile } = useAuth();
  const { canAdd, canWrite, canDelete } = usePermissions();
  const [residents, setResidents] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [aptTypes, setAptTypes] = useState([]);
  const [parkingTypes, setParkingTypes] = useState([]);
  const [storageTypes, setStorageTypes] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [entranceFilter, setEntranceFilter] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | resident object

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: r, error: rErr }, { data: b }, { data: at }, { data: pt }, { data: st }, { data: biz }, { data: tx }] = await Promise.all([
      sb.from('residents').select('*').order('apt'),
      sb.from('buildings').select('*').order('id'),
      sb.from('apt_types').select('*'),
      sb.from('parking_types').select('*'),
      sb.from('storage_types').select('*'),
      sb.from('businesses').select('id, name, parkings, storages'),
      sb.from('transactions').select('apt, type, category, month, year').eq('type', 'income').eq('category', 'resident'),
    ]);
    if (rErr) { console.error('residents ачаалах алдаа:', rErr.message); setLoading(false); return; }
    setResidents((r || []).map(mapResidentRow));
    setBuildings((b || []).map((row) => ({ id: row.id, label: row.label, entrances: row.entrances || 1, floors: row.floors })));
    setAptTypes(at || []);
    setParkingTypes(pt || []);
    setStorageTypes(st || []);
    setBusinesses(biz || []);
    setTransactions(tx || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const curMonth = now.getMonth() + 1, curYear = now.getFullYear();
  const paidThisMonthApts = useMemo(
    () => new Set(transactions.filter((t) => t.month === curMonth && t.year === curYear).map((t) => String(t.apt))),
    [transactions, curMonth, curYear]
  );

  const list = useMemo(
    () => filterResidentsList(residents, { query, buildingFilter, entranceFilter }),
    [residents, query, buildingFilter, entranceFilter]
  );

  const perm = { canAdd: canAdd('residents'), canWrite: canWrite('residents'), canDelete: canDelete('residents') };

  async function handleDelete(r) {
    if (!perm.canDelete) return;
    if (!confirm('Устгах уу?')) return;
    const { data, error } = await sb.from('residents').delete().eq('id', r.dbId).select();
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    if (!data || !data.length) { alert('Устгах эрхгүй байна — таны рольд энэ үйлдэл хориотой'); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'residents', r.dbId, `${r.apt} — ${r.firstname} ${r.lastname}`);
    load();
  }

  if (editing) {
    return (
      <ResidentForm
        resident={editing === 'new' ? null : editing}
        residents={residents}
        buildings={buildings}
        aptTypes={aptTypes}
        parkingTypes={parkingTypes}
        storageTypes={storageTypes}
        businesses={businesses}
        currentUser={currentUser}
        currentProfile={currentProfile}
        onClose={() => { setEditing(null); load(); }}
      />
    );
  }

  const selectedBld = buildings.find((b) => String(b.id) === String(buildingFilter));
  const maxEntrances = selectedBld ? selectedBld.entrances : buildings.reduce((m, b) => Math.max(m, b.entrances || 1), 1);

  return (
    <div className="page page-wide">
      <div className="flex-between mb-16">
        <div className="gate-filters" style={{ marginBottom: 0 }}>
          <select value={buildingFilter} onChange={(e) => { setBuildingFilter(e.target.value); setEntranceFilter(''); }}>
            <option value="">Бүх байр</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          <select value={entranceFilter} onChange={(e) => setEntranceFilter(e.target.value)}>
            <option value="">Бүх орц</option>
            {Array.from({ length: maxEntrances || 1 }, (_, i) => i + 1).map((e) => <option key={e} value={e}>{e}-р орц</option>)}
          </select>
          <input placeholder="Хайх..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" onClick={printCurrentPage}>Хэвлэх</button>
          <button className="btn-outline" onClick={() => exportTableToXlsx('residents-main-table', 'Сууц_өмчлөгчид.xlsx')}>Экспорт</button>
          {perm.canAdd && <button className="btn-primary" onClick={() => setEditing('new')}>+ Сууц өмчлөгч нэмэх</button>}
        </div>
      </div>

      {loading && <div className="empty-state">Ачаалж байна...</div>}
      {!loading && !list.length && <div className="empty-state">Сууц өмчлөгч олдсонгүй</div>}
      {!loading && list.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-scroll table-scroll-sticky">
            <table className="data-table" id="residents-main-table">
              <thead>
                <tr>
                  <th>№</th><th>Байр</th><th>Тоот</th><th>Талбай</th><th>Нэр</th><th>Овог</th>
                  <th>Утас</th><th>И-мэйл</th><th>Өмчлөх огноо</th><th>Ам бүл</th>
                  <th>0-6 нас</th><th>6-18 нас</th><th>Зогсоол</th><th>Агуулах</th><th>Машин</th>
                  <th>Төлбөрийн түүх (1-12 сар)</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r, idx) => {
                  const sqm = residentSqm(r, aptTypes);
                  const paid = paidThisMonthApts.has(String(r.apt));
                  const badges = residentMonthBadges(r.apt, transactions, curMonth, curYear);
                  return (
                    <tr key={r.id} onClick={() => setEditing(r)}>
                      <td>
                        <div className="res-row-avatar" style={{ background: paid ? 'rgba(59,130,246,0.18)' : 'rgba(239,68,68,0.15)', color: paid ? '#3B82F6' : '#EF4444' }}>{idx + 1}</div>
                      </td>
                      <td className="dt-title dt-mono">{r.building}</td>
                      <td className="dt-title dt-mono">{r.apt}</td>
                      <td className="dt-text" style={{ whiteSpace: 'nowrap' }}>{sqm}<span className="dt-muted"> м²</span></td>
                      <td className="dt-title">{r.firstname || '—'}</td>
                      <td className="dt-text">{r.lastname || '—'}</td>
                      <td className="dt-text dt-mono">
                        {r.phones[0] || '—'}
                        {r.phones.length > 1 && <><br /><span className="dt-muted">+{r.phones.length - 1}</span></>}
                      </td>
                      <td className="dt-text">{r.emails.filter(Boolean)[0] || '—'}</td>
                      <td className="dt-text">{r.ownDate || '—'}</td>
                      <td className="dt-text ta-center">{r.people}</td>
                      <td className="dt-text ta-center">{r.child1 || 0}</td>
                      <td className="dt-text ta-center">{r.child2 || 0}</td>
                      <td className="dt-muted">{r.parkings.length ? r.parkings.join(', ') : '—'}</td>
                      <td className="dt-muted">{r.storages.length ? r.storages.join(', ') : '—'}</td>
                      <td className="dt-muted">{r.vehicles.length ? r.vehicles.join(', ') : '—'}</td>
                      <td>
                        <div className="month-badges">
                          {badges.map((b) => <span key={b.month} className={'mbadge ' + b.status} title={`${b.month}-р сар`}>{b.month}</span>)}
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {perm.canWrite && <button className="btn-ghost-sm" onClick={() => setEditing(r)}>✎</button>}
                        {perm.canDelete && <button className="btn-ghost-sm danger" onClick={() => handleDelete(r)}>✕</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="table-summary-bar">
            <span>Нийт: {list.length} өмчлөгч</span>
            <span style={{ color: 'var(--success)' }}>Төлбөрийн үлдэгдэлгүй: {list.filter((r) => paidThisMonthApts.has(String(r.apt))).length}</span>
            <span style={{ color: 'var(--danger)' }}>Төлбөрийн үлдэгдэлтэй: {list.filter((r) => !paidThisMonthApts.has(String(r.apt))).length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ResidentForm({ resident, residents, buildings, aptTypes, parkingTypes, storageTypes, businesses, currentUser, currentProfile, onClose }) {
  const isEdit = !!resident;
  const [building, setBuilding] = useState(resident?.building || buildings[0]?.id || '');
  const [entrance, setEntrance] = useState(resident?.entrance || '');
  const [floor, setFloor] = useState(resident?.floor || '');
  const [door, setDoor] = useState(resident?.door || '');
  const [firstname, setFirstname] = useState(resident?.firstname || '');
  const [lastname, setLastname] = useState(resident?.lastname || '');
  const [reg, setReg] = useState(resident?.reg || '');
  const [oeubd, setOeubd] = useState(resident?.oeubd || '');
  const [ownDate, setOwnDate] = useState(resident?.ownDate || '');
  const [phones, setPhones] = useState(resident?.phones?.length ? resident.phones : ['']);
  const [emails, setEmails] = useState(resident?.emails?.length ? resident.emails : ['']);
  const [people, setPeople] = useState(resident?.people ?? 2);
  const [child1, setChild1] = useState(resident?.child1 || 0);
  const [child2, setChild2] = useState(resident?.child2 || 0);
  const [vehicles, setVehicles] = useState(resident?.vehicles?.length ? resident.vehicles : []);
  const [hasParking, setHasParking] = useState(!!resident?.parkings?.length);
  const [parkingRows, setParkingRows] = useState((resident?.parkings || []).map((full) => parseSpotFull(full, parkingTypes)));
  const [hasStorage, setHasStorage] = useState(!!resident?.storages?.length);
  const [storageRows, setStorageRows] = useState((resident?.storages || []).map((full) => parseSpotFull(full, storageTypes)));
  const [saving, setSaving] = useState(false);

  const selectedBld = buildings.find((b) => String(b.id) === String(building));
  const entrances = selectedBld?.entrances || 1;
  const floors = selectedBld?.floors || 0;
  const doors = [...new Set(aptTypes.filter((t) => t.building_id === +building).flatMap((t) => t.door_numbers || []))].sort((a, b) => a - b);

  function spotRowsToLabels(rows) {
    return rows.map((v) => spotFullLabel(v.floor, v.zone, v.num)).filter((l) => l);
  }

  async function handleSave() {
    const bId = +building, f = +floor, d = +door, ent = entrance ? +entrance : null;
    if (!bId || !f || !d || !firstname.trim()) { alert('Байр, давхар, хаалга, өмчлөгчийн нэрийг оруулна уу'); return; }
    const aptId = makeAptId(bId, f, d, ent);
    if (!isEdit && residents.some((r) => r.apt === aptId)) { alert('Тоот аль хэдийн бүртгэлтэй байна'); return; }

    const parkingLabels = hasParking ? spotRowsToLabels(parkingRows) : [];
    const storageLabels = hasStorage ? spotRowsToLabels(storageRows) : [];
    const excludeId = resident?.id;
    if (parkingLabels.length) {
      const err = validateSpotAssignment('parking', parkingLabels, parkingTypes, storageTypes, residents, businesses, 'resident', excludeId);
      if (err) { alert(err); return; }
    }
    if (storageLabels.length) {
      const err = validateSpotAssignment('storage', storageLabels, parkingTypes, storageTypes, residents, businesses, 'resident', excludeId);
      if (err) { alert(err); return; }
    }

    setSaving(true);
    const row = {
      building: bId, floor: f, door: d, entrance: ent, apt: aptId,
      firstname: firstname.trim(), lastname: lastname.trim(), reg: reg.trim(), oeubd: oeubd.trim(),
      own_date: ownDate || null,
      phones: phones.map((p) => p.trim()).filter(Boolean),
      emails: emails.map((e) => e.trim()).filter(Boolean),
      people: +people, child1: +child1 || 0, child2: +child2 || 0,
      vehicles, parkings: parkingLabels, storages: storageLabels,
    };

    let error, newId;
    if (isEdit) {
      ({ error } = await sb.from('residents').update(row).eq('id', resident.dbId));
    } else {
      const res = await sb.from('residents').insert(row).select().single();
      error = res.error; newId = res.data?.id;
    }
    if (error) { setSaving(false); alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }

    await logActivity(currentUser, currentProfile, isEdit ? 'edit' : 'add', 'residents', resident?.dbId || newId, `${aptId} — ${row.firstname} ${row.lastname}`);
    setSaving(false);
    onClose();
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row">
        <h2>{isEdit ? 'Сууц өмчлөгч засах' : 'Сууц өмчлөгч нэмэх'}</h2>
        <button className="btn-ghost" onClick={onClose}>← Буцах</button>
      </div>

      <div className="field-row">
        <label className="field"><span>Байр</span>
          <select value={building} onChange={(e) => { setBuilding(e.target.value); setFloor(''); setDoor(''); }}>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
        {entrances > 1 && (
          <label className="field"><span>Орц</span>
            <select value={entrance} onChange={(e) => setEntrance(e.target.value)}>
              <option value="">—</option>
              {Array.from({ length: entrances }, (_, i) => i + 1).map((e) => <option key={e} value={e}>{e}-р орц</option>)}
            </select>
          </label>
        )}
        <label className="field"><span>Давхар</span>
          <select value={floor} onChange={(e) => setFloor(e.target.value)}>
            <option value="">—</option>
            {Array.from({ length: floors }, (_, i) => i + 1).map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label className="field"><span>Хаалга</span>
          <select value={door} onChange={(e) => setDoor(e.target.value)}>
            <option value="">—</option>
            {doors.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>

      <div className="field-row">
        <label className="field"><span>Нэр</span><input value={firstname} onChange={(e) => setFirstname(e.target.value)} /></label>
        <label className="field"><span>Овог</span><input value={lastname} onChange={(e) => setLastname(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Регистр</span><input value={reg} onChange={(e) => setReg(e.target.value)} /></label>
        <label className="field"><span>ӨЭУБД</span><input value={oeubd} onChange={(e) => setOeubd(e.target.value)} /></label>
        <label className="field"><span>Өмчлөх огноо</span><input type="date" value={ownDate} onChange={(e) => setOwnDate(e.target.value)} /></label>
      </div>

      <div className="field">
        <span>Утас</span>
        {phones.map((p, i) => (
          <div key={i} className="wizard-row">
            <input value={p} onChange={(e) => setPhones(phones.map((x, idx) => idx === i ? e.target.value : x))} placeholder="99001234" />
            <button type="button" className="btn-ghost-sm danger" onClick={() => setPhones(phones.filter((_, idx) => idx !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn-outline" onClick={() => setPhones([...phones, ''])}>+ Утас нэмэх</button>
      </div>

      <div className="field">
        <span>И-мэйл</span>
        {emails.map((em, i) => (
          <div key={i} className="wizard-row">
            <input value={em} onChange={(e) => setEmails(emails.map((x, idx) => idx === i ? e.target.value : x))} placeholder="email@example.mn" />
            <button type="button" className="btn-ghost-sm danger" onClick={() => setEmails(emails.filter((_, idx) => idx !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn-outline" onClick={() => setEmails([...emails, ''])}>+ И-мэйл нэмэх</button>
      </div>

      <div className="field-row">
        <label className="field"><span>Ам бүл</span><input type="number" value={people} onChange={(e) => setPeople(e.target.value)} /></label>
        <label className="field"><span>Хүүхэд 0-6</span><input type="number" value={child1} onChange={(e) => setChild1(e.target.value)} /></label>
        <label className="field"><span>Хүүхэд 6-18</span><input type="number" value={child2} onChange={(e) => setChild2(e.target.value)} /></label>
      </div>

      <div className="field">
        <span>Машин (улсын дугаар)</span>
        {vehicles.map((v, i) => (
          <div key={i} className="wizard-row">
            <input value={v} onChange={(e) => setVehicles(vehicles.map((x, idx) => idx === i ? e.target.value : x))} placeholder="1234 УНН" />
            <button type="button" className="btn-ghost-sm danger" onClick={() => setVehicles(vehicles.filter((_, idx) => idx !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn-outline" onClick={() => setVehicles([...vehicles, ''])}>+ Машин нэмэх</button>
      </div>

      <div className="field">
        <label><input type="checkbox" checked={hasParking} onChange={(e) => { setHasParking(e.target.checked); if (e.target.checked && !parkingRows.length) setParkingRows([{ floor: '', zone: '', num: '' }]); }} /> Зогсоолтой</label>
        {hasParking && (
          <>
            {parkingRows.map((row, i) => (
              <SpotPickerRow
                key={i} kind="parking" value={row}
                onChange={(next) => setParkingRows(parkingRows.map((r, idx) => idx === i ? next : r))}
                onRemove={() => setParkingRows(parkingRows.filter((_, idx) => idx !== i))}
                parkingTypes={parkingTypes} storageTypes={storageTypes} residents={residents} businesses={businesses}
                excludeType="resident" excludeId={resident?.id}
                siblingLabels={spotRowsToLabels(parkingRows.filter((_, idx) => idx !== i))}
              />
            ))}
            <button type="button" className="btn-outline" onClick={() => setParkingRows([...parkingRows, { floor: '', zone: '', num: '' }])}>+ Зогсоол нэмэх</button>
          </>
        )}
      </div>

      <div className="field">
        <label><input type="checkbox" checked={hasStorage} onChange={(e) => { setHasStorage(e.target.checked); if (e.target.checked && !storageRows.length) setStorageRows([{ floor: '', zone: '', num: '' }]); }} /> Агуулахтай</label>
        {hasStorage && (
          <>
            {storageRows.map((row, i) => (
              <SpotPickerRow
                key={i} kind="storage" value={row}
                onChange={(next) => setStorageRows(storageRows.map((r, idx) => idx === i ? next : r))}
                onRemove={() => setStorageRows(storageRows.filter((_, idx) => idx !== i))}
                parkingTypes={parkingTypes} storageTypes={storageTypes} residents={residents} businesses={businesses}
                excludeType="resident" excludeId={resident?.id}
                siblingLabels={spotRowsToLabels(storageRows.filter((_, idx) => idx !== i))}
              />
            ))}
            <button type="button" className="btn-outline" onClick={() => setStorageRows([...storageRows, { floor: '', zone: '', num: '' }])}>+ Агуулах нэмэх</button>
          </>
        )}
      </div>

      <div className="form-actions">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button>
      </div>
    </div>
  );
}

// resident.parkings/storages-д хадгалагдсан бүтэн label ("B1-A-005")-ыг
// spot picker-ийн {floor, zone, num} state рүү задална (parking-storage.js-ийн
// renderSpotPickerRow() дахь ижил задлах логик).
function parseSpotFull(fullLabel, typesArr) {
  const numField = 'spot_numbers' in (typesArr[0] || {}) ? 'spot_numbers' : 'unit_numbers';
  for (const t of typesArr) {
    for (const n of (t[numField] || [])) {
      if (spotFullLabel(t.floor_label, t.zone_label, n) === fullLabel || String(n) === String(fullLabel).split('-').pop()) {
        return { floor: t.floor_label || '', zone: t.zone_label || '', num: n };
      }
    }
  }
  return { floor: '', zone: '', num: fullLabel };
}
