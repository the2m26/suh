import { useCallback, useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { logActivity } from '../lib/dbUtils';
import { calcEntityFee, allocatePaymentToMonths } from '../lib/financeEngine';
import { getSpotSqm, validateSpotAssignment, spotFullLabel } from '../lib/parkingStorageHelpers';
import { filterBusinessesList, contractStatus, businessMonthBadges } from '../lib/businessHelpers';
import { accountingRecordBusinessPayment } from '../lib/accountingBridge';
import SpotPickerRow from '../components/SpotPickerRow';

function mapBusinessRow(b) {
  return {
    id: b.id, dbId: b.id, name: b.name, regno: b.reg_no || '', type: b.type || 'tenant',
    ceo: b.ceo || '', mobile: b.mobile || '', phone: b.phone || '', email: b.email || '',
    contract: b.contract_no || '', start: b.contract_start || '', end: b.contract_end || '',
    note: b.note || '', vehicles: b.vehicles || [], parkings: b.parkings || [], storages: b.storages || [],
    area: +b.area || 0, monthlyFee: +b.monthly_fee || 0,
  };
}

export default function Businesses() {
  const { currentUser, currentProfile } = useAuth();
  const { canAdd, canWrite, canDelete } = usePermissions();
  const [businesses, setBusinesses] = useState([]);
  const [parkingTypes, setParkingTypes] = useState([]);
  const [storageTypes, setStorageTypes] = useState([]);
  const [residents, setResidents] = useState([]);
  const [feeCatalog, setFeeCatalog] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [payingBusiness, setPayingBusiness] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: b, error: bErr }, { data: pt }, { data: st }, { data: res }, { data: fc }, { data: tx }] = await Promise.all([
      sb.from('businesses').select('*').order('id'),
      sb.from('parking_types').select('*'),
      sb.from('storage_types').select('*'),
      sb.from('residents').select('id, firstname, lastname, parkings, storages'),
      sb.from('fee_catalog').select('*'),
      sb.from('transactions').select('businessId, type, category, month, year').eq('type', 'income').eq('category', 'business'),
    ]);
    if (bErr) { console.error('businesses ачаалах алдаа:', bErr.message); setLoading(false); return; }
    setBusinesses((b || []).map(mapBusinessRow));
    setParkingTypes(pt || []);
    setStorageTypes(st || []);
    setResidents(res || []);
    setFeeCatalog(fc || []);
    setTransactions(tx || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const curMonth = now.getMonth() + 1, curYear = now.getFullYear();
  const paidThisMonthIds = useMemo(
    () => new Set(transactions.filter((t) => t.month === curMonth && t.year === curYear).map((t) => t.businessId)),
    [transactions, curMonth, curYear]
  );

  const list = useMemo(() => filterBusinessesList(businesses, query), [businesses, query]);
  const perm = { canAdd: canAdd('businesses'), canWrite: canWrite('businesses'), canDelete: canDelete('businesses') };

  async function handleDelete(b) {
    if (!perm.canDelete) return;
    if (!confirm('Устгах уу?')) return;
    const { data, error } = await sb.from('businesses').delete().eq('id', b.dbId).select();
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    if (!data || !data.length) { alert('Устгах эрхгүй байна'); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'businesses', b.dbId, b.name);
    load();
  }

  if (editing) {
    return (
      <BusinessForm
        business={editing === 'new' ? null : editing}
        businesses={businesses}
        parkingTypes={parkingTypes}
        storageTypes={storageTypes}
        residents={residents}
        feeCatalog={feeCatalog}
        currentUser={currentUser}
        currentProfile={currentProfile}
        onClose={() => { setEditing(null); load(); }}
      />
    );
  }

  return (
    <div className="page page-wide">
      <div className="page-header-row">
        <h2>Аж ахуйн нэгж</h2>
        {perm.canAdd && <button className="btn-primary" onClick={() => setEditing('new')}>+ ААН нэмэх</button>}
      </div>
      <div className="gate-filters">
        <input placeholder="Хайх (нэр, регистр, утас)..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {loading && <div className="empty-state">Ачаалж байна...</div>}
      {!loading && !list.length && <div className="empty-state">Аж ахуйн нэгж олдсонгүй</div>}
      {!loading && list.length > 0 && (
        <>
          <div className="dt-muted" style={{ marginBottom: 10 }}>
            Нийт: {list.length} байгууллага · Өмчлөгч: {list.filter((b) => b.type === 'owner').length} · Түрээслэгч: {list.filter((b) => b.type === 'tenant').length}
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>№</th><th>Нэр</th><th>Регистр</th><th>Төрөл</th><th>Захирал</th>
                  <th>Гар утас</th><th>Утас</th><th>И-мэйл</th><th>Гэрээний дугаар</th>
                  <th>Эхэлсэн</th><th>Дуусах</th><th>Зогсоол</th><th>Агуулах</th><th>Машин</th>
                  <th>Төлбөрийн түүх (1-12 сар)</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((b, idx) => {
                  const status = contractStatus(b.end);
                  const paid = paidThisMonthIds.has(b.id);
                  const badges = businessMonthBadges(b.id, transactions, curMonth, curYear);
                  return (
                    <tr key={b.id} onClick={() => setEditing(b)}>
                      <td>
                        <div className="res-row-avatar" style={{ background: paid ? 'rgba(59,130,246,0.18)' : 'rgba(239,68,68,0.15)', color: paid ? '#3B82F6' : '#EF4444' }}>{idx + 1}</div>
                      </td>
                      <td className="dt-title">{b.name}</td>
                      <td className="dt-text dt-mono">{b.regno || '—'}</td>
                      <td><span className="dt-muted" style={{ color: b.type === 'owner' ? 'var(--accent)' : 'var(--success)', fontWeight: 600 }}>{b.type === 'owner' ? 'Өмчлөгч' : 'Түрээслэгч'}</span></td>
                      <td className="dt-title">{b.ceo || '—'}</td>
                      <td className="dt-text dt-mono">{b.mobile || '—'}</td>
                      <td className="dt-text dt-mono">{b.phone || '—'}</td>
                      <td className="dt-text">{b.email || '—'}</td>
                      <td className="dt-text">{b.contract || '—'}</td>
                      <td className="dt-text dt-muted">{b.start || '—'}</td>
                      <td className="dt-text" style={{ color: status === 'expired' ? 'var(--danger)' : status === 'expiring' ? 'var(--warning)' : 'var(--text-muted)' }}>{b.end || '—'}</td>
                      <td className="dt-muted">{b.parkings.length ? b.parkings.join(', ') : '—'}</td>
                      <td className="dt-muted">{b.storages.length ? b.storages.join(', ') : '—'}</td>
                      <td className="dt-muted">{b.vehicles.length ? b.vehicles.join(', ') : '—'}</td>
                      <td>
                        <div className="month-badges">
                          {badges.map((bd) => <span key={bd.month} className={'mbadge ' + bd.status} title={`${bd.month}-р сар`}>{bd.month}</span>)}
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {perm.canWrite && <button className="btn-ghost-sm" onClick={() => setPayingBusiness(b)} title="Төлбөр авах">₮</button>}
                        {perm.canWrite && <button className="btn-ghost-sm" onClick={() => setEditing(b)}>✎</button>}
                        {perm.canDelete && <button className="btn-ghost-sm danger" onClick={() => handleDelete(b)}>✕</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {payingBusiness && (
        <BizPaymentModal
          business={payingBusiness}
          feeCatalog={feeCatalog}
          parkingTypes={parkingTypes}
          storageTypes={storageTypes}
          transactions={transactions}
          currentUser={currentUser}
          currentProfile={currentProfile}
          onClose={() => { setPayingBusiness(null); load(); }}
        />
      )}
    </div>
  );
}

function BusinessForm({ business, businesses, parkingTypes, storageTypes, residents, feeCatalog, currentUser, currentProfile, onClose }) {
  const isEdit = !!business;
  const [name, setName] = useState(business?.name || '');
  const [regno, setRegno] = useState(business?.regno || '');
  const [type, setType] = useState(business?.type || 'tenant');
  const [ceo, setCeo] = useState(business?.ceo || '');
  const [mobile, setMobile] = useState(business?.mobile || '');
  const [phone, setPhone] = useState(business?.phone || '');
  const [email, setEmail] = useState(business?.email || '');
  const [contract, setContract] = useState(business?.contract || '');
  const [start, setStart] = useState(business?.start || new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(business?.end || '');
  const [note, setNote] = useState(business?.note || '');
  const [area, setArea] = useState(business?.area || '');
  const [vehicles, setVehicles] = useState(business?.vehicles?.length ? business.vehicles : []);
  const [hasParking, setHasParking] = useState(!!business?.parkings?.length);
  const [parkingRows, setParkingRows] = useState((business?.parkings || []).map((full) => parseSpotFull(full, parkingTypes)));
  const [hasStorage, setHasStorage] = useState(!!business?.storages?.length);
  const [storageRows, setStorageRows] = useState((business?.storages || []).map((full) => parseSpotFull(full, storageTypes)));
  const [saving, setSaving] = useState(false);

  function spotRowsToLabels(rows) { return rows.map((v) => spotFullLabel(v.floor, v.zone, v.num)).filter(Boolean); }

  const feeCtx = { getSpotSqm: (kind, label) => getSpotSqm(kind, label, parkingTypes, storageTypes) };
  const previewFee = calcEntityFee(
    { area: +area || 0, type, parkings: hasParking ? spotRowsToLabels(parkingRows) : [], storages: hasStorage ? spotRowsToLabels(storageRows) : [] },
    'business', feeCatalog, feeCtx
  );

  async function handleSave() {
    if (!name.trim()) { alert('Байгууллагын нэр оруулна уу'); return; }
    const parkingLabels = hasParking ? spotRowsToLabels(parkingRows) : [];
    const storageLabels = hasStorage ? spotRowsToLabels(storageRows) : [];
    const excludeId = business?.id;
    if (parkingLabels.length) {
      const err = validateSpotAssignment('parking', parkingLabels, parkingTypes, storageTypes, residents, businesses, 'business', excludeId);
      if (err) { alert(err); return; }
    }
    if (storageLabels.length) {
      const err = validateSpotAssignment('storage', storageLabels, parkingTypes, storageTypes, residents, businesses, 'business', excludeId);
      if (err) { alert(err); return; }
    }

    setSaving(true);
    const row = {
      name: name.trim(), reg_no: regno.trim(), type, ceo: ceo.trim(),
      mobile: mobile.trim(), phone: phone.trim(), email: email.trim(), contract_no: contract.trim(),
      contract_start: start || null, contract_end: end || null, note: note.trim(),
      vehicles, parkings: parkingLabels, storages: storageLabels,
      area: +area || 0, monthly_fee: previewFee,
    };
    let error, newId;
    if (isEdit) {
      ({ error } = await sb.from('businesses').update(row).eq('id', business.dbId));
    } else {
      const res = await sb.from('businesses').insert(row).select().single();
      error = res.error; newId = res.data?.id;
    }
    if (error) { setSaving(false); alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, isEdit ? 'edit' : 'add', 'businesses', business?.dbId || newId, name.trim());
    setSaving(false);
    onClose();
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row">
        <h2>{isEdit ? 'ААН засах' : 'ААН нэмэх'}</h2>
        <button className="btn-ghost" onClick={onClose}>← Буцах</button>
      </div>

      <div className="field-row">
        <label className="field"><span>Нэр</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>Төрөл</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="tenant">Түрээслэгч</option>
            <option value="owner">Өмчлөгч</option>
          </select>
        </label>
      </div>
      <div className="field-row">
        <label className="field"><span>УБД/Регистр</span><input value={regno} onChange={(e) => setRegno(e.target.value)} /></label>
        <label className="field"><span>Захирал</span><input value={ceo} onChange={(e) => setCeo(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Гар утас</span><input value={mobile} onChange={(e) => setMobile(e.target.value)} /></label>
        <label className="field"><span>Утас</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="field"><span>И-мэйл</span><input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Гэрээний дугаар</span><input value={contract} onChange={(e) => setContract(e.target.value)} /></label>
        <label className="field"><span>Эхлэх огноо</span><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="field"><span>Дуусах огноо</span><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      <label className="field"><span>Талбай (м²)</span><input type="number" value={area} onChange={(e) => setArea(e.target.value)} /></label>
      <label className="field"><span>Тэмдэглэл</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>

      <div className="field">
        <span>Машин (улсын дугаар)</span>
        {vehicles.map((v, i) => (
          <div key={i} className="wizard-row">
            <input value={v} onChange={(e) => setVehicles(vehicles.map((x, idx) => idx === i ? e.target.value : x))} />
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
              <SpotPickerRow key={i} kind="parking" value={row}
                onChange={(next) => setParkingRows(parkingRows.map((r, idx) => idx === i ? next : r))}
                onRemove={() => setParkingRows(parkingRows.filter((_, idx) => idx !== i))}
                parkingTypes={parkingTypes} storageTypes={storageTypes} residents={residents} businesses={businesses}
                excludeType="business" excludeId={business?.id}
                siblingLabels={spotRowsToLabels(parkingRows.filter((_, idx) => idx !== i))} />
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
              <SpotPickerRow key={i} kind="storage" value={row}
                onChange={(next) => setStorageRows(storageRows.map((r, idx) => idx === i ? next : r))}
                onRemove={() => setStorageRows(storageRows.filter((_, idx) => idx !== i))}
                parkingTypes={parkingTypes} storageTypes={storageTypes} residents={residents} businesses={businesses}
                excludeType="business" excludeId={business?.id}
                siblingLabels={spotRowsToLabels(storageRows.filter((_, idx) => idx !== i))} />
            ))}
            <button type="button" className="btn-outline" onClick={() => setStorageRows([...storageRows, { floor: '', zone: '', num: '' }])}>+ Агуулах нэмэх</button>
          </>
        )}
      </div>

      <div className="dt-muted" style={{ marginBottom: 14 }}>
        ≈ {previewFee.toLocaleString()}₮ / сар (тариф тохиргооны дагуу{type === 'owner' ? ' — талбайн төлбөрөөс чөлөөлөгдсөн' : ''})
      </div>

      <div className="dt-muted" style={{ marginBottom: 14 }}>
        Төлбөр авахдаа жагсаалт дахь ₮ товчийг ашиглана уу (олон сарын өрийг хөөж, сар бүрд тусдаа бүртгэнэ).
      </div>

      <div className="form-actions">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button>
      </div>
    </div>
  );
}

function parseSpotFull(fullLabel, typesArr) {
  const numField = 'spot_numbers' in (typesArr[0] || {}) ? 'spot_numbers' : 'unit_numbers';
  for (const t of typesArr) {
    for (const n of (t[numField] || [])) {
      if (spotFullLabel(t.floor_label, t.zone_label, n) === fullLabel) {
        return { floor: t.floor_label || '', zone: t.zone_label || '', num: n };
      }
    }
  }
  return { floor: '', zone: '', num: fullLabel };
}

// businesses.js-ийн openBizPayModal()/saveBizPayment() (мөр ~370-460) —
// хэрэглэгчийн 2026-08-06 зөвшөөрлөөр React рүү портлогдов. Аль сараа
// төлөхөө ӨӨРӨӨ СОНГОДОГГҮЙ — эртний төлөгдөөгүй сараас "хөөж" дараалан
// төлдөг (allocatePaymentToMonths — finance.js/financeEngine.js-тэй НЭГ эх
// сурвалж), сар бүрд ТУСДАА transaction + journal entry.
function BizPaymentModal({ business, feeCatalog, parkingTypes, storageTypes, transactions, currentUser, currentProfile, onClose }) {
  const now = new Date();
  const feeCtx = { getSpotSqm: (kind, label) => getSpotSqm(kind, label, parkingTypes, storageTypes) };
  const allocations = allocatePaymentToMonths(business, 'business', Infinity, feeCatalog, transactions, now.getMonth() + 1, now.getFullYear(), feeCtx);
  // Infinity-ээр дуудаад бодит "1 сарын дүн"-г monthsToApply тооцоход ашигладаг
  // тул эндхийг зөв дүнгээр дахин тооцоолъё — 1 сарын нийт дүнг feeCatalog-аас,
  // үлдсэн сарын тоог missingMonths-ээс.
  const monthlyTotal = calcEntityFee(business, 'business', feeCatalog, feeCtx);
  const missingMonthsCount = allocations.length; // Infinity үед бүх дутуу сар нэг дор орно
  const totalDue = monthlyTotal * missingMonthsCount;

  const [method, setMethod] = useState('qpay');
  const [ref, setRef] = useState('');
  const [amount, setAmount] = useState(totalDue);
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!amount || +amount <= 0) { alert('Дүн оруулна уу'); return; }
    setSaving(true);
    const realAllocations = allocatePaymentToMonths(business, 'business', +amount, feeCatalog, transactions, now.getMonth() + 1, now.getFullYear(), feeCtx);
    if (!realAllocations.length) { setSaving(false); alert('Төлөх өр байхгүй байна'); return; }

    const today = now.toISOString().slice(0, 10);
    for (const a of realAllocations) {
      const row = {
        apt: null, type: 'income', amount: a.amount, method, ref,
        month: a.month, year: now.getFullYear(), date: today,
        desc: business.name + ' гэрээний төлбөр', status: 'completed', category: 'business', businessId: business.id,
      };
      const { error } = await sb.from('transactions').insert(row);
      if (error) { console.error('Гүйлгээ бүртгэхэд алдаа:', error.message); continue; }
      const res = await accountingRecordBusinessPayment(business.id, a.amount, today, `${business.name} — ${a.month}-р сарын түрээс`, String(a.month));
      if (!res.success) console.warn('Journal entry үүсгэхэд алдаа:', res.error);
    }
    await logActivity(currentUser, currentProfile, 'payment', 'transactions', business.id, `${business.name} — ${(+amount).toLocaleString()}₮ (${realAllocations.length} сар)`);
    setSaving(false);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="page-header-row"><h2>{business.name} — төлбөр авах</h2><button className="btn-ghost" onClick={onClose}>✕</button></div>
        {missingMonthsCount === 0 ? (
          <div className="dt-muted">✓ {business.name} — энэ сар хүртэлх бүх төлбөр төлөгдсөн байна</div>
        ) : (
          <>
            <div className="dt-muted" style={{ marginBottom: 10 }}>
              {missingMonthsCount} сарын өртэй · Нийт: {totalDue.toLocaleString()}₮
            </div>
            <label className="field"><span>Төлбөрийн хэлбэр</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="qpay">QPay</option>
                <option value="cash">Бэлэн</option>
                <option value="bank">Шилжүүлэг</option>
              </select>
            </label>
            <label className="field"><span>Гүйлгээний утга (сонголттой)</span><input value={ref} onChange={(e) => setRef(e.target.value)} /></label>
            <label className="field"><span>Дүн</span><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <div className="form-actions">
              <button className="btn-primary" disabled={saving} onClick={handleConfirm}>Баталгаажуулах</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
