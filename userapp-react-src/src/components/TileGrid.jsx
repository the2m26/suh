import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';

// Бүх боломжит tile — АДМИН ТАЛЫН fintax.js-ийн APP_SETTINGS_MODULES-той
// key нэрсийг ЯГ ТААРУУЛНА (Модул тохиргоо checkbox → энд харагдах эсэхийг тодорхойлно)
const REAL_MODULES = [
  { key: 'dashboard', label: 'ХЯНАХ САМБАР' },
  { key: 'news', label: 'МЭДЭЭ, МЭДЭЭЛЭЛ' },
  { key: 'guest-invite', label: 'ЗОЧИН УРИХ' },
  { key: 'polls', label: 'СОНГУУЛЬ, САНАЛ АСУУЛГА' },
  { key: 'elevator', label: 'ЛИФТ ДУУДАХ' },
  { key: 'camera', label: 'КАМЕР ХАРАХ' },
  { key: 'call-log', label: 'CC MESSENGER' },
  { key: 'useful-contacts', label: 'СӨХ-НЫ ХАЯГ, УТАС, МЭЙЛ, ДАНС' },
  { key: 'emergency-contacts', label: 'ОНЦГОЙ ХЭРЭГЦЭЭТ УТАСНЫ ДУГААРУУД' },
  { key: 'call-service', label: 'ТӨЛБӨРТ ҮЙЛЧИЛГЭЭ' },
];
const HIDDEN_TILES_KEY = 'suh_hidden_tiles';
function getHiddenTiles() {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_TILES_KEY) || '[]')); }
  catch { return new Set(); }
}
function setHiddenTiles(set) { localStorage.setItem(HIDDEN_TILES_KEY, JSON.stringify([...set])); }

const LONG_PRESS_MS = 500;

// Ганц tile — удаан дарахад (500мс) "нуух" товч гарна
function Tile({ tile, showHideBtn, onOpen, onLongPress, onHide, badgeCount = 0 }) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);
  function onDown() {
    firedRef.current = false;
    timerRef.current = setTimeout(() => { firedRef.current = true; onLongPress(); }, LONG_PRESS_MS);
  }
  function onUp() { clearTimeout(timerRef.current); }
  function onClick(e) {
    if (firedRef.current) { e.preventDefault(); e.stopPropagation(); return; }
    onOpen();
  }
  return (
    <div className="tile" onClick={onClick} onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={onUp}
      onContextMenu={e => e.preventDefault()}>
      {showHideBtn && <button className="tile-hide-btn" onClick={onHide} aria-label="Нуух">✕</button>}
      {badgeCount > 0 && <span className="tile-count-badge">{badgeCount}</span>}
      <div className="tile-label">{tile.label}</div>
      <div className="tile-status">Нээлттэй</div>
    </div>
  );
}

export default function TileGrid({ onOpenTile, showAddModal, onCloseAddModal, newsUnreadCount = 0 }) {
  const [visibleTiles, setVisibleTiles] = useState(null);
  const [hidden, setHidden] = useState(getHiddenTiles());
  const [showHideBtnFor, setShowHideBtnFor] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: perms }, { data: settingsRow }] = await Promise.all([
        sb.rpc('get_my_permissions'),
        sb.from('settings').select('*').eq('key', 'mobile_modules').maybeSingle(),
      ]);
      const permMap = {};
      (perms || []).forEach(p => { permMap[p.resource] = permMap[p.resource] || {}; permMap[p.resource][p.action] = p.level; });
      const enabledKeys = settingsRow?.value?.keys || null;
      const allowed = REAL_MODULES.filter(m => {
        if (enabledKeys && !enabledKeys.includes(m.key)) return false;
        const viewLevel = permMap[m.key]?.view;
        return viewLevel === 1 || viewLevel === 3;
      });
      setVisibleTiles(allowed);
    })();
  }, []);

  function hideTile(e, key) {
    e.stopPropagation();
    const next = new Set(hidden);
    next.add(key);
    setHidden(next);
    setHiddenTiles(next);
    setShowHideBtnFor(null);
  }
  function unhideTile(key) {
    const next = new Set(hidden);
    next.delete(key);
    setHidden(next);
    setHiddenTiles(next);
  }

  if (!visibleTiles) return <div className="pool-empty">Ачаалж байна...</div>;
  const shown = visibleTiles.filter(t => !hidden.has(t.key));
  const hiddenList = visibleTiles.filter(t => hidden.has(t.key));

  return (
    <div onClick={() => showHideBtnFor && setShowHideBtnFor(null)}>
      <div className="tile-grid">
        {shown.map(t => (
          <Tile key={t.key} tile={t} showHideBtn={showHideBtnFor === t.key}
            onOpen={() => onOpenTile(t.key, t.label)} onLongPress={() => setShowHideBtnFor(t.key)}
            onHide={e => hideTile(e, t.key)} badgeCount={t.key === 'news' ? newsUnreadCount : 0} />
        ))}
      </div>
      {showAddModal && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onCloseAddModal()}>
          <div className="qpay-modal add-tile-modal">
            <div className="add-tile-title">Нуусан товчоо сэргээх</div>
            {hiddenList.length ? hiddenList.map(t => (
              <div key={t.key} className="add-tile-row" onClick={() => unhideTile(t.key)}>
                <span>{t.label}</span><span className="add-tile-plus">+</span>
              </div>
            )) : <div className="pool-empty" style={{ padding: '20px 0' }}>Нуусан товч алга</div>}
            <button className="login-btn" style={{ marginTop: 14 }} onClick={onCloseAddModal}>Хаах</button>
          </div>
        </div>
      )}
    </div>
  );
}
