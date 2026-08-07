import { useEffect } from 'react';

// news.js-ийн лайтбоксын (мөр ~236-289) React дэлгэц — swipe/drag-to-dismiss
// (гар утасны хуруугаар чирэх) ЗОРИУДААР ортоогүй, гэхдээ товч/гарын
// сумаар навигаци, гадна дараад хаах бүгд ажиллана.
export default function Lightbox({ items, index, onClose, onNav }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onNav(-1);
      if (e.key === 'ArrowRight') onNav(1);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, onNav]);

  const item = items[index];
  if (!item) return null;
  const showNav = items.length > 1;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>&times;</button>
        {showNav && <button className="lightbox-nav lightbox-prev" onClick={() => onNav(-1)}>‹</button>}
        {showNav && <button className="lightbox-nav lightbox-next" onClick={() => onNav(1)}>›</button>}
        <div className="lightbox-content">
          <img src={item.url} alt="" />
        </div>
        {item.caption && <div className="lightbox-caption">{item.caption}</div>}
      </div>
    </div>
  );
}
