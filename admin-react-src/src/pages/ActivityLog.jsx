import { useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabase';
import { ROLE_LABELS, AUTH_ACTION_LABELS, PAGE_LABELS } from '../lib/permissions';

function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p2(d.getMonth() + 1)}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

// suh.html-ийн "Үйл ажиллагааны бүртгэл" (activity-log) — admin-only, бүх
// logActivity() бичлэгийг харах, огноо/роль/үйлдэл/модулиар шүүх.
export default function ActivityLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [role, setRole] = useState('');
  const [action, setAction] = useState('');
  const [module, setModule] = useState('');

  useEffect(() => {
    sb.from('activity_log').select('*').order('created_at', { ascending: false }).limit(500).then(({ data, error }) => {
      if (error) { console.error('activity_log ачаалах алдаа:', error.message); setLoading(false); return; }
      setRows(data || []);
      setLoading(false);
    });
  }, []);

  const years = [...new Set(rows.filter((r) => r.created_at).map((r) => new Date(r.created_at).getFullYear()))].sort((a, b) => b - a);
  const modules = [...new Set(rows.map((r) => r.module).filter(Boolean))].sort();

  const list = useMemo(() => rows.filter((r) => {
    const d = r.created_at ? new Date(r.created_at) : null;
    if (year && (!d || d.getFullYear() !== +year)) return false;
    if (month && (!d || d.getMonth() + 1 !== +month)) return false;
    if (day && (!d || d.getDate() !== +day)) return false;
    if (role && r.actor_role !== role) return false;
    if (action && r.action !== action) return false;
    if (module && r.module !== module) return false;
    return true;
  }), [rows, year, month, day, role, action, module]);

  return (
    <div className="page page-wide">
      <div className="gate-filters">
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">Бүх он</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Сар</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}-р сар</option>)}
        </select>
        <select value={day} onChange={(e) => setDay(e.target.value)}>
          <option value="">Өдөр</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">— Хэн (бүгд) —</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">— Үйлдэл (бүгд) —</option>
          {Object.entries(AUTH_ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="">— Модуль (бүгд) —</option>
          {modules.map((m) => <option key={m} value={m}>{PAGE_LABELS[m] || m}</option>)}
        </select>
      </div>

      {loading && <div className="empty-state">Ачаалж байна...</div>}
      {!loading && !list.length && <div className="empty-state">Бүртгэл олдсонгүй</div>}
      {!loading && list.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-scroll table-scroll-sticky">
            <table className="data-table">
              <thead><tr><th>Хугацаа</th><th>Хэн</th><th>Роль</th><th>Үйлдэл</th><th>Модуль</th><th>Тайлбар</th></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td className="dt-mono dt-muted">{fmtDateTime(r.created_at)}</td>
                    <td className="dt-title">{r.actor_name || '—'}</td>
                    <td><span className="tag">{ROLE_LABELS[r.actor_role] || r.actor_role || '—'}</span></td>
                    <td className="dt-text">{AUTH_ACTION_LABELS[r.action] || r.action}</td>
                    <td className="dt-text">{PAGE_LABELS[r.module] || r.module}</td>
                    <td className="dt-muted">{r.record_label || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-summary-bar"><span>Нийт: {list.length} бичлэг</span></div>
        </div>
      )}
    </div>
  );
}
