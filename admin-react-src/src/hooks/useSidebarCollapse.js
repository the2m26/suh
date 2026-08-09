import { useEffect, useRef } from 'react';

// suh.html-ийн toggleSidebar()/_autoSidebarByWidth() (мөр ~6809-6830) — sidebar
// хураах/нээх логикийг ЯГ адилхан (document.body.classList, localStorage,
// 1000px auto-collapse) React-д портлов.
export function useSidebarAutoCollapse() {
  const manualOverride = useRef(false);

  useEffect(() => {
    function autoSidebarByWidth() {
      if (window.innerWidth <= 1000) { document.body.classList.add('sidebar-collapsed'); return; }
      if (manualOverride.current) return;
      document.body.classList.remove('sidebar-collapsed');
    }
    try {
      const saved = localStorage.getItem('suh_sidebar_collapsed');
      if (saved !== null) {
        manualOverride.current = true;
        if (saved === '1') document.body.classList.add('sidebar-collapsed');
      }
    } catch (e) { /* localStorage байхгүй орчинд алгасна */ }
    autoSidebarByWidth();
    window.addEventListener('resize', autoSidebarByWidth);
    return () => window.removeEventListener('resize', autoSidebarByWidth);
  }, []);

  function toggleSidebar() {
    manualOverride.current = true;
    document.body.classList.toggle('sidebar-collapsed');
    try {
      localStorage.setItem('suh_sidebar_collapsed', document.body.classList.contains('sidebar-collapsed') ? '1' : '0');
    } catch (e) { /* нoop */ }
  }

  return { toggleSidebar };
}
