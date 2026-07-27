// ⚠️ userapp.html-ийн _feeQuantityU()-тэй ЯГ ИЖИЛ логик — тарифын каталогийн
// мöр бүрийг тухайн эзэмшигчийн (сууц/ААН) бодит өгөгдлөөс тооцоолно.
export function apartmentSqm(residentRow, aptTypes) {
  const t = aptTypes.find(at => at.building_id === residentRow.building && (at.door_numbers || []).includes(residentRow.door));
  return t ? +t.sqm || 0 : 0;
}

function spotFullLabel(floorLabel, zoneLabel, num) {
  return [floorLabel, zoneLabel, num].filter(Boolean).join('-');
}
function labelsMatch(a, b) {
  if (a === b) return true;
  const ap = String(a).split('-'), bp = String(b).split('-');
  if (ap.length !== bp.length) return false;
  return ap.slice(0, -1).join('-').toLowerCase() === bp.slice(0, -1).join('-').toLowerCase()
    && String(+ap[ap.length - 1]) === String(+bp[bp.length - 1]);
}
export function spotSqm(kind, fullLabel, parkingTypes, storageTypes) {
  const arr = kind === 'storage' ? storageTypes : parkingTypes;
  const numField = kind === 'storage' ? 'unit_numbers' : 'spot_numbers';
  for (const t of arr) {
    for (const n of (t[numField] || [])) {
      if (labelsMatch(spotFullLabel(t.floor_label, t.zone_label, n), fullLabel)) return +t.sqm || 0;
    }
  }
  return 0;
}

export function feeQuantity(entity, entityType, unitType, ctx) {
  if (unitType === 'flat' || unitType === 'main_count') return 1;
  if (unitType === 'main_sqm') {
    return entityType === 'resident' ? apartmentSqm(entity, ctx.aptTypes) : (+entity.area || 0);
  }
  if (unitType === 'storage_sqm') {
    return (entity.storages || []).reduce((s, l) => s + spotSqm('storage', l, ctx.parkingTypes, ctx.storageTypes), 0);
  }
  if (unitType === 'storage_count') return (entity.storages || []).length;
  if (unitType === 'parking_sqm') {
    return (entity.parkings || []).reduce((s, l) => s + spotSqm('parking', l, ctx.parkingTypes, ctx.storageTypes), 0);
  }
  if (unitType === 'parking_count') return (entity.parkings || []).length;
  return 0;
}

// Идэвхтэй тарифын мөр бүрээр задаргаа үүсгэнэ: [{name, amt}], нийт дүнгийн хамт.
export function buildFeeBreakdown(entity, entityType, feeCatalog, ctx) {
  const rows = feeCatalog
    .filter(f => f.active && f.applies_to === entityType)
    .map(f => ({ name: f.name, amt: Math.round(feeQuantity(entity, entityType, f.unit_type, ctx) * (+f.rate || 0)) }))
    .filter(x => x.amt);
  const total = rows.reduce((s, x) => s + x.amt, 0);
  return { rows, total };
}
