// parking-storage.js-ийн цэвэр туслах функцүүдийн React талын эх сурвалж.

export function spotFullLabel(floor, zone, num) {
  return [floor, zone, num].filter(Boolean).join('-');
}

// Хоёр спот-лэйблийг (жиш нь "B2-012" ба "B2-12") зөвхөн эцсийн тоон
// хэсгийн ПАДДИНГ (тэг) ялгаатай бол ижил гэж үзнэ.
export function labelsMatch(a, b) {
  if (a === b) return true;
  const aParts = String(a).split('-'), bParts = String(b).split('-');
  if (aParts.length !== bParts.length) return false;
  return aParts.slice(0, -1).join('-').toLowerCase() === bParts.slice(0, -1).join('-').toLowerCase()
    && String(+aParts[aParts.length - 1]) === String(+bParts[bParts.length - 1]);
}

// Мужийн (давхар/үсэг+тоо) хэлбэрийг задлана: "B1-B6" -> ['B1',...,'B6']
export function parseAffixRange(str) {
  str = (str || '').trim();
  if (!str) return [];
  if (!str.includes('-')) return [str];
  const parts = str.split('-').map((s) => s.trim());
  if (parts.length !== 2) return [str];
  const m1 = parts[0].match(/^([A-Za-z]*)(\d+)$/);
  const m2 = parts[1].match(/^([A-Za-z]*)(\d+)$/);
  if (!m1 || !m2) return [str];
  const prefix = m1[1] || m2[1] || '';
  const start = parseInt(m1[2], 10), end = parseInt(m2[2], 10);
  const hasLeadingZero = m1[2].length > 1 && m1[2][0] === '0';
  const pad = m1[2].length;
  const result = [];
  for (let i = start; i <= end; i++) {
    result.push(prefix + (hasLeadingZero ? String(i).padStart(pad, '0') : String(i)));
  }
  return result;
}

// Цэвэр үсгийн муж: "A-G" -> ['A','B',...,'G']
export function parseZoneRange(str) {
  str = (str || '').trim();
  if (!str) return [];
  if (!str.includes('-')) return [str.toUpperCase()];
  const parts = str.split('-').map((s) => s.trim());
  if (parts.length !== 2 || parts[0].length !== 1 || parts[1].length !== 1) return [str.toUpperCase()];
  const startCode = parts[0].toUpperCase().charCodeAt(0), endCode = parts[1].toUpperCase().charCodeAt(0);
  const result = [];
  for (let c = startCode; c <= endCode; c++) result.push(String.fromCharCode(c));
  return result;
}

// Цэвэр тооны муж (тэг-угтвар мэдэрдэг): "001-121" -> ['001',...,'121']
export function parseNumberRange(str) {
  str = (str || '').trim();
  if (!str) return [];
  if (!str.includes('-')) return [str];
  const parts = str.split('-').map((s) => s.trim());
  if (parts.length !== 2) return [str];
  const start = parseInt(parts[0], 10), end = parseInt(parts[1], 10);
  if (isNaN(start) || isNaN(end)) return [str];
  const hasLeadingZero = parts[0].length > 1 && parts[0][0] === '0';
  const pad = parts[0].length;
  const result = [];
  for (let i = start; i <= end; i++) {
    result.push(hasLeadingZero ? String(i).padStart(pad, '0') : String(i));
  }
  return result;
}

function spotTypesArr(kind, parkingTypes, storageTypes) { return kind === 'storage' ? storageTypes : parkingTypes; }
function spotNumField(kind) { return kind === 'storage' ? 'unit_numbers' : 'spot_numbers'; }
function spotOwnerField(kind) { return kind === 'storage' ? 'storages' : 'parkings'; }

// getSpotOwner() — residents/businesses массивуудаас тухайн spot-ийн эзэмшигчийг олно.
export function getSpotOwner(kind, fullLabel, residents, businesses, excludeType, excludeId) {
  const ownerField = spotOwnerField(kind);
  for (const r of residents || []) {
    if (!r) continue;
    if (excludeType === 'resident' && r.id === excludeId) continue;
    if ((r[ownerField] || []).some((x) => labelsMatch(x, fullLabel))) return { type: 'resident', obj: r };
  }
  for (const b of businesses || []) {
    if (!b) continue;
    if (excludeType === 'business' && b.id === excludeId) continue;
    if ((b[ownerField] || []).some((x) => labelsMatch(x, fullLabel))) return { type: 'business', obj: b };
  }
  return null;
}

export function getSpotSqm(kind, fullLabel, parkingTypes, storageTypes) {
  const typesArr = spotTypesArr(kind, parkingTypes, storageTypes);
  const numField = spotNumField(kind);
  for (const t of typesArr) {
    for (const n of (t[numField] || [])) {
      if (labelsMatch(spotFullLabel(t.floor_label, t.zone_label, n), fullLabel)) return +t.sqm || 0;
    }
  }
  return 0;
}

// validateSpotAssignment() — сонгосон values массивт (1) дотоод давхардал,
// (2) бүртгэлд байхгүй утга, (3) бусад эзэмшигчтэй давхцал байгаа эсэхийг шалгана.
export function validateSpotAssignment(kind, values, parkingTypes, storageTypes, residents, businesses, excludeType, excludeId) {
  const typesArr = spotTypesArr(kind, parkingTypes, storageTypes);
  const numField = spotNumField(kind);
  const label = kind === 'storage' ? 'агуулах' : 'зогсоол';
  const allValid = [];
  typesArr.forEach((t) => (t[numField] || []).forEach((n) => allValid.push(spotFullLabel(t.floor_label, t.zone_label, n))));

  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (labelsMatch(values[i], values[j])) return `"${values[i]}" гэсэн ${label}-ыг олон удаа сонгосон байна — нэг мөрийг устгана уу`;
    }
  }
  for (const full of values) {
    if (!allValid.some((v) => labelsMatch(v, full))) return `"${full}" гэсэн ${label} бүртгэлд олдсонгүй`;
    const owner = getSpotOwner(kind, full, residents, businesses, excludeType, excludeId);
    if (owner) return `"${full}" ${label} аль хэдийн эзэнтэй байна`;
  }
  return null;
}
