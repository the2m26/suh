import { NavLink } from 'react-router-dom';
import { AUTH_MODULES, ADMIN_ONLY_PAGES, ROLE_LABELS } from '../lib/permissions';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../context/AuthContext';

// suh.html-ийн applyNavByRole() (мөр ~6290) логикийг React болгов: AUTH_MODULES-д
// "page" холбогдсон бүх цэсийг эрхээр шүүнэ, admin үргэлж бүгдийг харна.
// ⚠️ Шинэ модуль/page нэмэхэд AUTH_MODULES (lib/permissions.js) дотор нэмэхэд
// л энд автоматаар шинэ цэс гарч ирнэ — энд гараар засах шаардлагагүй
// (suh.html-ийн renderAuthModuleTabs()-той адил зарчим).
export default function Sidebar() {
  const { role, currentProfile, currentUser, logout } = useAuth();
  const { canView } = usePermissions();
  const isAdmin = role === 'admin';

  const visibleModules = AUTH_MODULES.filter((m) => {
    if (!m.page) return false; // page байхгүй бол (жиш нь call-log) sidebar-д тусад нь харагдахгүй
    if (isAdmin) return true;
    return canView(m.key);
  });

  return (
    <aside className="sidebar">
      <div className="logo">suh<span className="accent">.</span></div>
      <nav>
        {visibleModules.map((m) => (
          <NavLink
            key={m.page}
            to={`/${m.page}`}
            className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
          >
            {m.label}
          </NavLink>
        ))}
        {isAdmin && (
          <>
            <div className="nav-divider" />
            {ADMIN_ONLY_PAGES.map((p) => (
              <NavLink
                key={p}
                to={`/${p}`}
                className={({ isActive }) => 'nav-item admin-only' + (isActive ? ' active' : '')}
              >
                {p}
              </NavLink>
            ))}
          </>
        )}
      </nav>
      <div className="current-user-info">
        <div className="current-user-name">{currentProfile?.full_name || currentUser?.email}</div>
        <div className="current-user-role">{ROLE_LABELS[role] || role}</div>
        <button onClick={logout}>Гарах</button>
      </div>
      {/* ⚠️ 2026-08-06 нэмэв: Strangler Fig-ийн эсрэг чиглэл — suh.html руу
          буцах холбоос (Архитектурын шийдвэр #1: хоёр apps зэрэгцэн ажиллах
          үед хоёр талын сэлгэн шилжилт байх ёстой). Relative зам ("../suh.html")
          — admin-react/ нь suh.html-тэй ижил "/suh/" дэд хавтсанд sibling
          хавтас тул нэг түвшин дээш гарч суh.html руу орно. */}
      <a href="../suh.html" className="back-to-suh">← suh.html руу буцах</a>
    </aside>
  );
}
