import { useCallback, useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { logActivity } from '../lib/dbUtils';
import {
  calcFee, calcBusinessFee, daysUnpaidForResident, daysUnpaidForBusiness,
  classifyPaymentStatus, allocatePaymentToMonths,
} from '../lib/financeEngine';
import { getSpotSqm } from '../lib/parkingStorageHelpers';
import { accountingRecordResidentPayment, accountingRecordBusinessPayment } from '../lib/accountingBridge';

const STATUS_TAB_LABELS = { completed: 'Төлөгдсөн', pending: 'Хүлээгдэж буй', overdue: 'Хугацаа хэтэрсэн', risk: 'Эрсдэлтэй' };

export default function Payments() {
  const { currentUser, currentProfile } = useAuth();
  const { canWrite } = usePermissions();
  const canPay = canWrite('payments');
  const [tab, setTab] = useState('overdue');
  const [residents, setResidents] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [parkingTypes, setParkingTypes] = useState([]);
  const [storageTypes, setStorageTypes] = useState([]);
  const [feeCatalog, setFeeCatalog] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [thresholds, setThresholds] = useState({ resident: { overdue: 35, risk: 365 }, business: { overdue: 35, risk: 365 } });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [payingEntity, setPayingEntity] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: res }, { data: biz }, { data: pt }, { data: st }, { data: fc }, { data: tx }, { data: settingsRows }] = await Promise.all([
      sb.from('residents').select('*'),
      sb.from('businesses').select('*'),
      sb.from('parking_types').select('*'),
      sb.from('storage_types').select('*'),
      sb.from('fee_catalog').select('*'),
      sb.from('transactions').select('*').eq('type', 'income'),
      sb.from('settings').select('*'),
    ]);
    setResidents((res || []).map((r) => ({
      id: r.id, apt: r.apt, isVirtual: r.is_virtual || false, firstname: r.firstname, lastname: r.lastname,
      ownDate: r.own_date, sqm: r.sqm, parkings: r.parkings || [], storages: r.storages || [],
    })));
    setBusinesses((biz || []).map((b) => ({
      id: b.id, name: b.name, type: b.type, start: b.contract_start, area: +b.area || 0,
      parkings: b.parkings || [], storages: b.storages || [],
    })));
    setParkingTypes(pt || []);
    setStorageTypes(st || []);
    setFeeCatalog(fc || []);
    setTransactions(tx || []);
    const feeSettings = { overdueDays: 35, riskDays: 365 };
    const rentSettings = { overdueDays: 35, riskDays: 365 };
    (settingsRows || []).forEach((s) => {
      if (s.key === 'fee') Object.assign(feeSettings, s.value);
      if (s.key === 'rent') Object.assign(rentSettings, s.value);
    });
    setThresholds({
      resident: { overdue: feeSettings.overdueDays || 35, risk: feeSettings.riskDays || 365 },
      business: { overdue: rentSettings.overdueDays || 35, risk: rentSettings.riskDays || 365 },
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const feeCtx = { getSpotSqm: (kind, label) => getSpotSqm(kind, label, parkingTypes, storageTypes) };
  const sendDay = 1;

  const rows = useMemo(() => {
    const now = new Date();
    const residentRows = residents.filter((r) => !r.isVirtual).map((r) => {
      const days = daysUnpaidForResident(r, transactions, sendDay, now);
      return {
        kind: 'resident', obj: r, key: 'r' + r.id,
        label: `${r.apt} — ${r.firstname || ''} ${r.lastname || ''}`.trim(),
        fee: calcFee(r, feeCatalog, feeCtx), days,
        status: classifyPaymentStatus(days, thresholds.resident.overdue, thresholds.resident.risk),
      };
    });
    const businessRows = businesses.map((b) => {
      const days = daysUnpaidForBusiness(b, transactions, sendDay, now);
      return {
        kind: 'business', obj: b, key: 'b' + b.id,
        label: b.name, fee: calcBusinessFee(b, feeCatalog, feeCtx), days,
        status: classifyPaymentStatus(days, thresholds.business.overdue, thresholds.business.risk),
      };
    });
    return [...residentRows, ...businessRows];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residents, businesses, transactions, feeCatalog, thresholds, parkingTypes, storageTypes]);

  const q = query.toLowerCase();
  const filtered = rows.filter((r) => r.status === tab && (!q || r.label.toLowerCase().includes(q)));
  const counts = { completed: 0, pending: 0, overdue: 0, risk: 0 };
  rows.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });

  return (
    <div className="page page-wide">
      <h2>Төлбөр төлөлт</h2>
      <div className="gate-tabs">
        {Object.entries(STATUS_TAB_LABELS).map(([k, label]) => (
          <button key={k} className={'gate-tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>
            {label} ({counts[k] || 0})
          </button>
        ))}
      </div>
      <div className="gate-filters">
        <input placeholder="Хайх..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {loading && <div className="empty-state">Ачаалж байна...</div>}
      {!loading && !filtered.length && <div className="empty-state">Жагсаалт хоосон</div>}
      {!loading && filtered.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Нэр</th><th>Сарын төлбөр</th><th>Хоцорсон хоног</th><th></th></tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.key}>
                  <td className="dt-title">{r.label}</td>
                  <td className="dt-text dt-mono">{r.fee.toLocaleString()}₮</td>
                  <td className="dt-text">{r.days}</td>
                  <td>
                    {canPay && r.status !== 'completed' && (
                      <button className="btn-primary btn-sm" onClick={() => setPayingEntity(r)}>Төлбөр авах</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payingEntity && (
        <PayModal
          entity={payingEntity}
          feeCatalog={feeCatalog}
          feeCtx={feeCtx}
          transactions={transactions}
          currentUser={currentUser}
          currentProfile={currentProfile}
          onClose={() => { setPayingEntity(null); load(); }}
        />
      )}
    </div>
  );
}

function PayModal({ entity, feeCatalog, feeCtx, transactions, currentUser, currentProfile, onClose }) {
  const { kind, obj } = entity;
  const now = new Date();
  const [method, setMethod] = useState('cash');
  const [ref, setRef] = useState('');
  const [amount, setAmount] = useState(entity.fee || 0);
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!amount || +amount <= 0) { alert('Дүн оруулна уу'); return; }
    setSaving(true);
    const allocations = allocatePaymentToMonths(obj, kind, +amount, feeCatalog, transactions, now.getMonth() + 1, now.getFullYear(), feeCtx);
    if (!allocations.length) { setSaving(false); alert('Төлөх өр байхгүй байна'); return; }

    const today = now.toISOString().slice(0, 10);
    for (const a of allocations) {
      const row = kind === 'resident'
        ? { apt: obj.apt, description: 'СӨХ-ийн төлбөр', subcat: 'Сарын төлбөр', type: 'income', amount: a.amount, method, ref, month: a.month, year: now.getFullYear(), date: today, status: 'completed', category: 'resident' }
        : { apt: null, description: `${obj.name} — ${a.month}-р сарын СӨХ-ийн төлбөр`, subcat: 'Сарын төлбөр', type: 'income', amount: a.amount, method, ref, month: a.month, year: now.getFullYear(), date: today, status: 'completed', category: 'business', businessId: obj.id };
      const { error } = await sb.from('transactions').insert(row);
      if (error) { console.error('Гүйлгээ бүртгэхэд алдаа:', error.message); continue; }
      const res = kind === 'resident'
        ? await accountingRecordResidentPayment(obj.apt, a.amount, today, `${obj.apt} тоот — ${a.month}-р сарын төлбөр`, String(a.month))
        : await accountingRecordBusinessPayment(obj.id, a.amount, today, `${obj.name} — ${a.month}-р сарын түрээс`, String(a.month));
      if (!res.success) console.warn('Journal entry үүсгэхэд алдаа:', res.error);
    }
    const label = kind === 'resident' ? `${obj.apt} тоот` : obj.name;
    await logActivity(currentUser, currentProfile, 'payment', 'transactions', obj.id, `${label} — ${(+amount).toLocaleString()}₮ (${allocations.length} сар)`);
    setSaving(false);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="page-header-row"><h2>{entity.label} — төлбөр авах</h2><button className="btn-ghost" onClick={onClose}>✕</button></div>
        <label className="field"><span>Төлбөрийн хэлбэр</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Бэлэн</option>
            <option value="bank">Шилжүүлэг</option>
            <option value="qpay">QPay</option>
          </select>
        </label>
        <label className="field"><span>Гүйлгээний утга (сонголттой)</span><input value={ref} onChange={(e) => setRef(e.target.value)} /></label>
        <label className="field"><span>Дүн</span><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <div className="form-actions">
          <button className="btn-primary" disabled={saving} onClick={handleConfirm}>Баталгаажуулах</button>
        </div>
      </div>
    </div>
  );
}
