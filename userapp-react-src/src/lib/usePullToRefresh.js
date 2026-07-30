import { useEffect, useState } from 'react';

// ⚠️ 2026-07-30: dist bundle доторх ЭНЭ hook-ийн яг дотоод тооцооллыг
// (минифайлдсан тул) бүрэн сэргээж чадаагүй тул ижил гадаад үзүүлэлттэй
// (C>0 үед scroll индикатор, C>70 үед "суллаад дахин ачаална") стандарт
// pull-to-refresh хэрэгжилтээр орлуулав. Зөвхөн дэлгэцийн хамгийн дээд
// цэгт байхад доош чирэхэд ажиллана, дунд нь бол хэвийн scroll хэвээр.
export function usePullToRefresh(ref, onRefresh) {
  const [pull, setPull] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let startY = null;
    let dragging = false;

    function onDown(e) {
      if (el.scrollTop > 0) return;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      dragging = true;
    }
    function onMove(e) {
      if (!dragging || startY === null) return;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const delta = y - startY;
      if (delta > 0) setPull(Math.min(delta * 0.5, 100));
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      if (pull > 70 && onRefresh) onRefresh();
      setPull(0);
      startY = null;
    }

    el.addEventListener('touchstart', onDown, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onUp);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('touchstart', onDown);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onUp);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
  }, [ref, pull, onRefresh]);

  return pull;
}
