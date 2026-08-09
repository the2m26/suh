import { Link } from 'react-router-dom';

// suh.html-ийн "fintax" page (Санхүү, татварын тайлан) — org profile хэсэг
// SokhSettings.jsx-д бүрэн шилжсэн, НД-7/НД-8 цахим тайлан (Сангийн яам/ТЕГ
// API) эрх зөвшөөрөл аваагүй тул ОРООГүй.
export default function Fintax() {
  return (
    <div className="page">
      <h2>Санхүү, татварын тайлан</h2>
      <div className="dt-muted" style={{ marginBottom: 14 }}>
        СөХ-ийн байгууллагын профайл (регистр, банкны данс г.м) одоо{' '}
        <Link to="/sokh-settings" style={{ color: 'var(--accent)' }}>СөХ тохиргоо</Link> хуудсанд байрлана.
      </div>
      <div className="dt-muted">
        ⚠️ НД-7/НД-8 болон бусад цахим тайлангийн API (Сангийн яам/ТЕГ) хараахан эрх зөвшөөрөл аваагүй тул энэ хувилбарт ортоогүй.
      </div>
    </div>
  );
}
