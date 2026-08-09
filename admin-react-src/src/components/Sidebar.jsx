import { NavLink } from 'react-router-dom';
import { AUTH_MODULES, ADMIN_ONLY_PAGES, ROLE_LABELS, PAGE_LABELS } from '../lib/permissions';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../context/AuthContext';

// suh.html-ийн sidebar HTML (мөр ~510-610) — 3 тогтмол бүлэг (Үндсэн/Тайлан,
// санхүү/Админ) яг адилхан дараалалтай React болгов. 2026-08-07 засав:
// өмнөх хувилбар AUTH_MODULES-ийн array дарааллаар л шүүж, бүлгийн гарчиг
// (nav-section)-гүй, admin-only мөрүүдийг raw route нэрээр (жиш нь
// "tariff-settings") харуулж байсныг олж, PAGE_LABELS-аар нэр угсарч,
// эх суh.html-тэй тохирсон 3 бүлгийн бүтэц болгож дахин зохион байгуулав.
const SECTION_MAIN = ['dashboard', 'residents', 'business', 'clientele', 'assets', 'employees', 'polls', 'payments', 'apartments', 'communications', 'cc-center', 'gate-log', 'news', 'newseditor'];
const SECTION_REPORTS = ['accounting', 'reports', 'fintax', 'finance'];
const SECTION_ADMIN = ['sokh-settings', 'admin', 'tariff-settings', 'nbb-settings', 'asset-settings', 'market-valuation', 'auth_levels', 'users', 'app-settings', 'ai-integration-plan', 'cosmo-settings'];

export default function Sidebar() {
  const { role, currentProfile, currentUser, logout } = useAuth();
  const { canView } = usePermissions();
  const isAdmin = role === 'admin';

  const moduleByPage = {};
  AUTH_MODULES.forEach((m) => { if (m.page) moduleByPage[m.page] = m; });

  function isVisible(pageKey) {
    if (isAdmin) return true;
    if (ADMIN_ONLY_PAGES.includes(pageKey)) return false;
    const m = moduleByPage[pageKey];
    return m ? canView(m.key) : false;
  }

  function renderSection(title, pageKeys) {
    const visible = pageKeys.filter(isVisible);
    if (!visible.length) return null;
    return (
      <>
        <div className="nav-section">{title}</div>
        {visible.map((pageKey) => (
          <NavLink key={pageKey} to={`/${pageKey}`} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <span>{moduleByPage[pageKey]?.label || PAGE_LABELS[pageKey] || pageKey}</span>
          </NavLink>
        ))}
      </>
    );
  }

  return (
    <aside className="sidebar">
      <div className="logo">suh<span className="accent">.</span></div>
      <nav>
        {renderSection('Үндсэн', SECTION_MAIN)}
        {renderSection('Тайлан, санхүү', SECTION_REPORTS)}
        {isAdmin && renderSection('Админ', SECTION_ADMIN)}
      </nav>
      <div className="current-user-info">
        <div className="current-user-name">{currentProfile?.full_name || currentUser?.email}</div>
        <div className="current-user-role">{ROLE_LABELS[role] || role}</div>
        <button onClick={logout}>Гарах</button>
      </div>
      <a href="../suh.html" className="back-to-suh">← suh.html руу буцах</a>
    </aside>
  );
}
