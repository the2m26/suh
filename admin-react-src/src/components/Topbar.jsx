import { useLocation } from 'react-router-dom';
import { AUTH_MODULES, PAGE_LABELS } from '../lib/permissions';

const NAV_LABEL_OVERRIDES = { 'activity-log': 'Протокол' };

// suh.html-ийн .topbar (мөр ~664-668) — бүх хуудасны дээд ирмэгт байх
// sticky navigation bar, тухайн хуудасны нэрийг харуулна.
export default function Topbar() {
  const location = useLocation();
  const pageKey = location.pathname.replace(/^\//, '') || 'dashboard';
  const moduleDef = AUTH_MODULES.find((m) => m.page === pageKey);
  const title = NAV_LABEL_OVERRIDES[pageKey] || moduleDef?.label || PAGE_LABELS[pageKey] || '';

  return (
    <div className="topbar">
      <div className="page-title">{title}</div>
      <div className="topbar-actions" />
    </div>
  );
}
