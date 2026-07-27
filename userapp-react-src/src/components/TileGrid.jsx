import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';

// ⚠️ userapp.html-ийн REAL_MODULES-той ЯГ ИЖИЛ дараалал/түлхүүр.
const REAL_MODULES = [
  { key: 'dashboard', label: 'ХЯНАХ САМБАР' },
  { key: 'news', label: 'МЭДЭЭ, МЭДЭЭЛЭЛ' },
  { key: 'guest-invite', label: 'ЗОЧИН УРИХ' },
  { key: 'elevator', label: 'ЛИФТ ДУУДАХ' },
  { key: 'polls', label: 'СОНГУУЛЬ, САНАЛ АСУУЛГА' },
  { key: 'camera', label: 'КАМЕР ХАРАХ' },
  { key: 'call-log', label: 'САНАЛ, ХүСЭЛТ, ДУУДЛАГА' },
  { key: 'fintax', label: 'САНХүү, ТАТВАРЫН ТАЙЛАН' },
  { key: 'residents', label: 'СУУЦ ӨМЧЛӨГЧИЙН БүРТГЭЛ' },
  { key: 'apartments', label: 'ТООТ, ЗОГСООЛ, АГУУЛАХ' },
  { key: 'payments', label: 'ТӨЛБӨР ТӨЛӨЛТ' },
  { key: 'reports', label: 'СӨХ ДОТООД ТАЙЛАН' },
  { key: 'notifications', label: 'ЗАР МЭДЭГДЭЛ ИЛГЭЭХ' },
];

// ⚠️ userapp.html-ийн buildModuleTiles()-той ЯГ ИЖИЛ эрхийн шалгалт —
// зөвхөн 'ot' роль тул isAdmin шалгалт байхгүй (шаардлагагүй).
export default function TileGrid({ onOpenTile }) {
  const [tiles, setTiles] = useState(null);

  useEffect(() => {
    (async () => {
      const [permRes, modRes] = await Promise.all([
        sb.rpc('get_my_permissions'),
        sb.from('settings').select('*').eq('key', 'mobile_modules').maybeSingle(),
      ]);
      const permMap = {};
      (permRes.data || []).forEach(r => {
        if (!permMap[r.resource]) permMap[r.resource] = {};
        permMap[r.resource][r.action] = r.level;
      });
      const enabledKeys = (modRes.data?.value?.keys) || null;
      const visible = REAL_MODULES.filter(m => {
        if (enabledKeys && !enabledKeys.includes(m.key)) return false;
        const lvl = permMap[m.key]?.view;
        return lvl === 1 || lvl === 3;
      });
      setTiles(visible);
    })();
  }, []);

  if (!tiles) return <div className="pool-empty">Ачаалж байна...</div>;

  return (
    <div className="tile-grid">
      {tiles.map(t => (
        <div key={t.key} className="tile" onClick={() => onOpenTile(t.key, t.label)}>
          <div className="tile-label">{t.label}</div>
          <div className="tile-status">Нээлттэй</div>
        </div>
      ))}
    </div>
  );
}
