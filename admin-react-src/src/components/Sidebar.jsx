import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { sb } from '../lib/supabase';
import { AUTH_MODULES, ADMIN_ONLY_PAGES, ROLE_LABELS, PAGE_LABELS } from '../lib/permissions';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../context/AuthContext';
import { useSidebarAutoCollapse } from '../hooks/useSidebarCollapse';

// suh.html-ийн sidebar HTML (мөр ~510-610) — 3 тогтмол бүлэг (Үндсэн/Тайлан,
// санхүү/Админ) яг адилхан дараалалтай React болгов.
const SECTION_MAIN = ['dashboard', 'residents', 'business', 'clientele', 'assets', 'employees', 'polls', 'payments', 'apartments', 'communications', 'cc-center', 'gate-log', 'news', 'newseditor'];
const SECTION_REPORTS = ['accounting', 'reports', 'fintax', 'finance'];
const SECTION_ADMIN = ['sokh-settings', 'admin', 'tariff-settings', 'nbb-settings', 'asset-settings', 'market-valuation', 'auth_levels', 'users', 'app-settings', 'ai-integration-plan', 'cosmo-settings', 'activity-log'];
const NAV_LABEL_OVERRIDES = { 'activity-log': 'Протокол' };

export default function Sidebar() {
  const { role, currentProfile, currentUser, logout } = useAuth();
  const { canView } = usePermissions();
  const { toggleSidebar } = useSidebarAutoCollapse();
  const isAdmin = role === 'admin';
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      sb.from('residents').select('id, is_virtual, people, child1, child2, storages, parkings, vehicles'),
      sb.from('businesses').select('id, storages, parkings, vehicles'),
      sb.from('clientele').select('id'),
      sb.from('buildings').select('id'),
    ]).then(([resRes, bizRes, clRes, bldRes]) => {
      const residents = (resRes.data || []);
      const businesses = (bizRes.data || []);
      const realResidents = residents.filter((r) => !r.is_virtual);
      setStats({
        buildings: (bldRes.data || []).length,
        apts: realResidents.length,
        people: residents.reduce((s, r) => s + (+r.people || 0), 0),
        child1: residents.reduce((s, r) => s + (+r.child1 || 0), 0),
        child2: residents.reduce((s, r) => s + (+r.child2 || 0), 0),
        storage: residents.reduce((s, r) => s + ((r.storages || []).length), 0) + businesses.reduce((s, b) => s + ((b.storages || []).length), 0),
        parking: residents.reduce((s, r) => s + ((r.parkings || []).length), 0) + businesses.reduce((s, b) => s + ((b.parkings || []).length), 0),
        vehicles: residents.reduce((s, r) => s + ((r.vehicles || []).length), 0) + businesses.reduce((s, b) => s + ((b.vehicles || []).length), 0),
        tenants: businesses.length,
        partners: (clRes.data || []).length,
      });
    });
  }, []);

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
            <span>{NAV_LABEL_OVERRIDES[pageKey] || moduleByPage[pageKey]?.label || PAGE_LABELS[pageKey] || pageKey}</span>
          </NavLink>
        ))}
      </>
    );
  }

  return (
    <>
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-top">suh</div>
          <div className="logo-top">Сууц өмчлөгчдийн Холбоо</div>
        </div>
        <nav>
          {renderSection('Үндсэн', SECTION_MAIN)}
          {renderSection('Тайлан, санхүү', SECTION_REPORTS)}
          {isAdmin && renderSection('Админ', SECTION_ADMIN)}
        </nav>
        <div className="sidebar-bottom">
          <div className="current-user-info" style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="current-user-name">{currentProfile?.full_name || currentUser?.email}</div>
                <div className="current-user-role">{ROLE_LABELS[role] || role}</div>
              </div>
              <button onClick={logout} title="Гарах" style={{ width: 'auto', border: 'none', padding: 4 }}>⏻</button>
            </div>
          </div>
          <div className="building-info">
            <strong>suh</strong>
            <span>{stats ? `${stats.buildings} байр · ${stats.apts.toLocaleString()} өрх` : '0 байр · 0 өрх'}</span>
            <span>Оршин суугч · {(stats?.people || 0).toLocaleString()}</span>
            <span>Хүүхэд 0-6 нас · {(stats?.child1 || 0).toLocaleString()}</span>
            <span>Хүүхэд 6-18 нас · {(stats?.child2 || 0).toLocaleString()}</span>
            <span>Агуулах · {(stats?.storage || 0).toLocaleString()}</span>
            <span>Зогсоол · {(stats?.parking || 0).toLocaleString()}</span>
            <span>Бүртгэлтэй машин · {(stats?.vehicles || 0).toLocaleString()}</span>
            <span>Аж ахуйн нэгж · {(stats?.tenants || 0).toLocaleString()}</span>
            <span>Харилцагч байгууллага · {(stats?.partners || 0).toLocaleString()}</span>
          </div>
          <div className="sidebar-version">Management system v4.260712</div>
        </div>
      </aside>
      <div className="sidebar-toggle" onClick={toggleSidebar} title="Сайдбар хураах/нээх">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </div>
    </>
  );
}
