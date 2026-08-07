import { useCallback, useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/dbUtils';
import { accountingRecordIncome } from '../lib/accountingBridge';
import {
  fmtGateDateTime, fmtPlate, GATE_STATUS_LABELS, residentLabelForApt,
  filterGuestLog, filterTempParkingLog,
} from '../lib/gateLogHelpers';

export default function GateControl() {
  const { canWrite } = usePermissions();
  const { currentUser, currentProfile } = useAuth();
  const canEdit = canWrite('gate-log');
  const [tab, setTab] = useState('guests');
  const [residents, setResidents] = useState([]);
  const [guestRows, setGuestRows] = useState([]);
  const [tempRows, setTempRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.from('residents').select('id, apt, firstname, lastname').then(({ data, error }) => {
      if (error) { console.error('residents ачаалах алдаа:', error.message); return; }
      setResidents(data || []);
    });
  }, []);

  const loadGuests = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb.from('guest_invites').select('*').order('created_at', { ascending: false });
    if (error) { console.error('guest_invites ачаалах алдаа:', error.message); setLoading(false); return; }
    setGuestRows(data || []);
    setLoading(false);
  }, []);

  const loadTemp = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb.from('temp_parking_log').select('*').order('entered_at', { ascending: false });
    if (error) { console.error('temp_parking_log ачаалах алдаа:', error.message); setLoading(false); return; }
    setTempRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'guests') loadGuests();
    else loadTemp();
  }, [tab, loadGuests, loadTemp]);

  // gate-control.js-ийн confirmGatePayment() — хэрэглэгчийн 2026-08-06
  // зөвшөөрлөөр React рүү портлогдов. QPay мерчант эрх хараахан алга үед
  // ГАРААР баталгаажуулах fallback зам.
  async function confirmGatePayment(kind, row) {
    if (!canEdit) return;
    if (!row.payment_intent_id) { alert('Төлбөрийн мэдээлэл олдсонгүй'); return; }
    if (!confirm(`${row.charge_amount.toLocaleString()}₮ төлбөрийг баталгаажуулах уу?`)) return;

    const nowIso = new Date().toISOString();
    const { error: piErr } = await sb.from('payment_intents').update({ status: 'paid', paid_at: nowIso }).eq('id', row.payment_intent_id);
    if (piErr) { alert('Хадгалахад алдаа гарлаа: ' + piErr.message); return; }

    if (kind === 'temp') {
      await sb.from('temp_parking_log').update({ exited_at: row.exited_at || nowIso }).eq('id', row.id);
    }

    const plateLabel = fmtPlate(row.plate_digits, row.plate_letters);
    const desc = kind === 'guest'
      ? `Зочны хэтэрсэн хугацааны төлбөр — ${plateLabel} (${row.overage_minutes} мин)`
      : `Түр зогсолтын хэтэрсэн хугацааны төлбөр — ${plateLabel} (${row.overage_minutes} мин)`;
    await accountingRecordIncome('Хаалтны хэтэрсэн хугацаа, түр зогсолтын төлбөр', row.charge_amount, nowIso.slice(0, 10), desc);
    await logActivity(currentUser, currentProfile, 'payment', 'gate-log', row.id, desc);

    if (kind === 'guest') loadGuests(); else loadTemp();
  }

  return (
    <div className="page page-wide">
      <h2>Хаалтны удирдлага</h2>
      <div className="gate-tabs">
        <button className={'gate-tab' + (tab === 'guests' ? ' active' : '')} onClick={() => setTab('guests')}>Зочид</button>
        <button className={'gate-tab' + (tab === 'temp' ? ' active' : '')} onClick={() => setTab('temp')}>Түр зогссон машид</button>
      </div>

      {tab === 'guests' ? (
        <GuestLogTab rows={guestRows} residents={residents} loading={loading} canEdit={canEdit} onConfirmPayment={(row) => confirmGatePayment('guest', row)} />
      ) : (
        <TempParkingTab rows={tempRows} loading={loading} canEdit={canEdit} onConfirmPayment={(row) => confirmGatePayment('temp', row)} />
      )}
    </div>
  );
}

function useLogFilters(rows, dateField) {
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [query, setQuery] = useState('');
  const years = [...new Set(rows.filter((r) => r[dateField]).map((r) => new Date(r[dateField]).getFullYear()))].sort((a, b) => b - a);
  return { year, setYear, month, setMonth, day, setDay, query, setQuery, years };
}

function GuestLogTab({ rows, residents, loading, canEdit, onConfirmPayment }) {
  const f = useLogFilters(rows, 'created_at');
  const [status, setStatus] = useState('');
  const list = filterGuestLog(rows, { year: f.year, month: f.month, day: f.day, status, query: f.query }, residents);

  return (
    <>
      <div className="gate-filters">
        <input placeholder="Хайх (тоот, дугаар, нэр)..." value={f.query} onChange={(e) => f.setQuery(e.target.value)} />
        <select value={f.year} onChange={(e) => f.setYear(e.target.value)}>
          <option value="">Бүх он</option>
          {f.years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={f.month} onChange={(e) => f.setMonth(e.target.value)}>
          <option value="">Бүх сар</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={f.day} onChange={(e) => f.setDay(e.target.value)}>
          <option value="">Бүх өдөр</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Бүх төлөв</option>
          {Object.entries(GATE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading && <div className="empty-state">Ачаалж байна...</div>}
      {!loading && !list.length && <div className="empty-state">Бичлэг олдсонгүй</div>}
      {!loading && list.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Хүсэлт бүртгэгдсэн</th><th>Урьсан Сууц өмчлөгч</th><th>Машины дугаар</th>
                <th>Нэвтэрсэн огноо</th><th>Хэтэрсэн мин</th><th>Төлөх дүн</th><th>Төлөв</th><th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const needsPayment = r.charge_amount > 0 && r.payment_intent_id && r.status !== 'completed';
                return (
                  <tr key={r.id}>
                    <td className="dt-mono">{fmtGateDateTime(r.created_at)}</td>
                    <td className="dt-text">{residentLabelForApt(r.apt, residents)}</td>
                    <td className="dt-mono">{fmtPlate(r.plate_digits, r.plate_letters)}</td>
                    <td className="dt-mono">{fmtGateDateTime(r.entered_at)}</td>
                    <td className="dt-text">{r.overage_minutes || '—'}</td>
                    <td className="dt-text">{r.charge_amount ? r.charge_amount.toLocaleString() + '₮' : '—'}</td>
                    <td><span className="tag">{GATE_STATUS_LABELS[r.status] || r.status}</span></td>
                    <td>
                      {needsPayment && canEdit && (
                        <button className="btn-primary btn-sm" onClick={() => onConfirmPayment(r)}>
                          Баталгаажуулах
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function TempParkingTab({ rows, loading, canEdit, onConfirmPayment }) {
  const f = useLogFilters(rows, 'entered_at');
  const list = filterTempParkingLog(rows, { year: f.year, month: f.month, day: f.day, query: f.query });

  return (
    <>
      <div className="gate-filters">
        <input placeholder="Хайх (дугаар)..." value={f.query} onChange={(e) => f.setQuery(e.target.value)} />
        <select value={f.year} onChange={(e) => f.setYear(e.target.value)}>
          <option value="">Бүх он</option>
          {f.years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={f.month} onChange={(e) => f.setMonth(e.target.value)}>
          <option value="">Бүх сар</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={f.day} onChange={(e) => f.setDay(e.target.value)}>
          <option value="">Бүх өдөр</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {loading && <div className="empty-state">Ачаалж байна...</div>}
      {!loading && !list.length && <div className="empty-state">Бичлэг олдсонгүй</div>}
      {!loading && list.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Машины дугаар</th><th>Орсон цаг</th><th>Гарсан цаг</th>
                <th>Хэтэрсэн мин</th><th>Төлсөн дүн</th><th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const needsPayment = r.charge_amount > 0 && r.payment_intent_id && !r.exited_at;
                return (
                  <tr key={r.id}>
                    <td className="dt-mono">{fmtPlate(r.plate_digits, r.plate_letters)}</td>
                    <td className="dt-mono">{fmtGateDateTime(r.entered_at)}</td>
                    <td className="dt-mono">{fmtGateDateTime(r.exited_at)}</td>
                    <td className="dt-text">{r.overage_minutes || '—'}</td>
                    <td className="dt-text">{r.charge_amount ? r.charge_amount.toLocaleString() + '₮' : '—'}</td>
                    <td>
                      {needsPayment && canEdit && (
                        <button className="btn-primary btn-sm" onClick={() => onConfirmPayment(r)}>
                          Баталгаажуулах
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
