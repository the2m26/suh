import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/dbUtils';
import { AUTH_ROLES, AUTH_MODULES, AUTH_ACTIONS, AUTH_ACTION_LABELS } from '../lib/permissions';

const LEVEL_COLORS = { 1: 'rgba(16,185,129,0.15)', 2: 'rgba(239,68,68,0.12)', 3: 'rgba(234,179,8,0.15)' };
const LEVEL_TEXT = { 1: '#10B981', 2: '#EF4444', 3: '#EAB308' };
const LEVEL_LABELS = { 1: 'Тийм', 2: 'Үгүй', 3: 'Өөрийнхийг харах' };

// suh.html-ийн "Хандах эрхийн тохиргоо" (auth_levels) — role_permissions
// хүснэгэлийг шууд засах эрхийн матрикс. Хэрэглэгч 2026-08-09-д эрс шаардсан
// (продукт танилцуулга маргааш) 4 бүрэн байхгүй хуудасны нэг.
export default function AuthLevels() {
  const { currentUser, currentProfile, reloadPermissions } = useAuth();
  const [rolePermissions, setRolePermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState('residents');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    sb.from('role_permissions').select('role, resource, action, level').then(({ data, error }) => {
      if (error) { console.error('role_permissions ачаалах алдаа:', error.message); setLoading(false); return; }
      const rp = {};
      (data || []).forEach((r) => {
        rp[r.resource] = rp[r.resource] || {};
        rp[r.resource][r.role] = rp[r.resource][r.role] || {};
        rp[r.resource][r.role][r.action] = r.level;
      });
      setRolePermissions(rp);
      setLoading(false);
    });
  }, []);

  function setLevel(roleKey, actionKey, val) {
    setRolePermissions((prev) => {
      const next = { ...prev, [activeModule]: { ...(prev[activeModule] || {}) } };
      next[activeModule][roleKey] = { ...(next[activeModule][roleKey] || {}), [actionKey]: val };
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const moduleData = rolePermissions[activeModule] || {};
    const rows = [];
    AUTH_ROLES.forEach((role) => {
      const isResident = role.key === 'ot';
      AUTH_ACTIONS.forEach((actionKey) => {
        const lockedToNo = isResident && actionKey !== 'view';
        const level = lockedToNo ? 2 : (moduleData[role.key]?.[actionKey] || 2);
        rows.push({ role: role.key, resource: activeModule, action: actionKey, level, updated_at: new Date().toISOString() });
      });
    });
    const { error } = await sb.from('role_permissions').upsert(rows, { onConflict: 'role,resource,action' });
    setSaving(false);
    if (error) { alert('Хадгалахад алдаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'edit', 'auth_levels', null, `${AUTH_MODULES.find((m) => m.key === activeModule)?.label || activeModule} модулийн эрх өөрчлөгдөв`);
    if (reloadPermissions) await reloadPermissions();
    alert('Эрхийн тохиргоо хадгалагдлаа ✓ (шууд хэрэгжинэ)');
  }

  const moduleDef = AUTH_MODULES.find((m) => m.key === activeModule);
  const moduleData = rolePermissions[activeModule] || {};
  const relevantActions = moduleDef?.actions || [];

  if (loading) return <div className="page"><div className="empty-state">Ачаалж байна...</div></div>;

  return (
    <div className="page page-wide">
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div className="dt-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Эрхийн түвшний тайлбар</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 4, fontWeight: 700, fontSize: 12, background: LEVEL_COLORS[n], color: LEVEL_TEXT[n] }}>{n}</span>
              <span style={{ fontSize: 12 }}>{LEVEL_LABELS[n]}{n === 3 && <span className="dt-muted"> (зөвхөн Сууц өмчлөгчийн "Харах"-д)</span>}</span>
            </div>
          ))}
        </div>
        <div className="dt-muted" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
          Сууц өмчлөгч, Зочин ролийн "Харах"-аас бусад бүх үйлдэл үргэлж <strong>2 (Үгүй)</strong> дээр түгжигдмэл — эдгээр ролид эдитлэх/устгах/тусгай үйлдэл огт олгогдохгүй.
        </div>
      </div>

      <div className="card" style={{ padding: 8, marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {AUTH_MODULES.map((m) => (
          <button key={m.key} className={m.key === activeModule ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setActiveModule(m.key)}>{m.label}</button>
        ))}
      </div>
      <div className="dt-muted" style={{ fontSize: 11, margin: '-4px 0 14px 2px' }}>Роль олгох болон нүүц үг тохируулах эрх үргэлж зөвхөн Админ-д хамаарна — серверийн Edge Function дээр хатуу шалгагддаг тул энд тохируулах боломжгүй.</div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-scroll table-scroll-sticky">
        <table className="data-table" style={{ minWidth: 0, width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 170 }}>Үйлдэл</th>
              {AUTH_ROLES.map((r) => <th key={r.key} style={{ textAlign: 'center', minWidth: 110 }}>{r.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {AUTH_ACTIONS.map((actionKey) => {
              const isRelevant = relevantActions.includes(actionKey);
              return (
                <tr key={actionKey} style={{ opacity: isRelevant ? 1 : 0.35 }}>
                  <td className="dt-title">{AUTH_ACTION_LABELS[actionKey]}{!isRelevant && <span className="dt-muted" style={{ fontSize: 10, fontWeight: 400 }}> (хамаарахгүй)</span>}</td>
                  {AUTH_ROLES.map((role) => {
                    const isResident = role.key === 'ot';
                    const lockedToNo = isResident && actionKey !== 'view';
                    if (lockedToNo || !isRelevant) {
                      const val = lockedToNo ? 2 : (moduleData[role.key]?.[actionKey] || 2);
                      return (
                        <td key={role.key} style={{ textAlign: 'center' }}>
                          <span title={lockedToNo ? 'Энэ роль зөвхөн Харах үйлдэлд эрхтэй байж болно' : 'Энэ модульд хамаарахгүй үйлдэл'}
                            style={{ display: 'inline-block', width: 78, padding: '4px 2px', fontWeight: 700, fontSize: 12, borderRadius: 5, border: '1.5px solid var(--border)', background: LEVEL_COLORS[val], color: LEVEL_TEXT[val], opacity: 0.7 }}>
                            {val} · {LEVEL_LABELS[val]}
                          </span>
                        </td>
                      );
                    }
                    const maxLevel = isResident ? 3 : 2;
                    const val = moduleData[role.key]?.[actionKey] || 2;
                    return (
                      <td key={role.key} style={{ textAlign: 'center' }}>
                        <select value={val} onChange={(e) => setLevel(role.key, actionKey, +e.target.value)}
                          style={{ width: 96, padding: '4px 2px', textAlign: 'center', fontWeight: 700, fontSize: 12, borderRadius: 5, border: '1.5px solid var(--border)', background: LEVEL_COLORS[val], color: LEVEL_TEXT[val], cursor: 'pointer' }}>
                          {Array.from({ length: maxLevel }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} · {LEVEL_LABELS[n]}</option>)}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn-primary" disabled={saving} onClick={handleSave}>💾 Хадгалах</button>
      </div>
    </div>
  );
}
