// buildings.js-ийн цэвэр туслах функцүүдийн React талын эх сурвалж.
// ⚠️ Архитектурын шийдвэр 2: buildings.js-ийн GROUP_COLORS/getAptLabel()/
// makeAptId() өөрчлөгдвөл ЭНД ч мөн зэрэг тааруулах ёстой.

export const GROUP_COLORS = {
  A: { bg: 'rgba(245,158,11,0.12)', border: '#F59E0B', text: '#F59E0B' },
  B: { bg: 'rgba(59,130,246,0.12)', border: '#3B82F6', text: '#3B82F6' },
  C: { bg: 'rgba(100,116,139,0.12)', border: '#64748B', text: '#94A3B8' },
  D: { bg: 'rgba(239,68,68,0.12)', border: '#EF4444', text: '#EF4444' },
  E: { bg: 'rgba(168,85,247,0.12)', border: '#A855F7', text: '#A855F7' },
  F: { bg: 'rgba(20,184,166,0.12)', border: '#14B8A6', text: '#14B8A6' },
};

export const NUMBERING_SCHEME_LABELS = {
  floor_door: 'Давхар+Хаалга',
  sequential: 'Дараалсан',
  entrance_floor: 'Орц+Давхар+Хаалга',
  floor_only: 'Зөвхөн давхар',
};

// buildings.js-ийн getAptLabel() — тоотын дугаар үүсгэх 4 схем.
export function getAptLabel(scheme, entrance, floor, door, aptsPerEntrance, seqStart, floors) {
  seqStart = seqStart || 101;
  floors = floors || floor;
  switch (scheme) {
    case 'floor_door':
      return String(floor) + String(door).padStart(2, '0');
    case 'sequential':
      return String(seqStart + (entrance - 1) * floors * aptsPerEntrance + (floor - 1) * aptsPerEntrance + (door - 1));
    case 'entrance_floor':
      return String(entrance) + String(floor) + String(door).padStart(2, '0');
    case 'floor_only':
      return String(floor) + String(door);
    default:
      return String(floor) + String(door).padStart(2, '0');
  }
}

// buildings.js-ийн makeAptId() — резидентийн apt утга (buildingId*10000 + floor*100 + door).
export function makeAptId(buildingId, floor, door, entrance) {
  if (entrance) return buildingId * 100000 + entrance * 10000 + floor * 100 + door;
  return buildingId * 10000 + floor * 100 + door;
}
