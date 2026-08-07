// residents.js-ийн цэвэр туслах функцүүдийн React талын эх сурвалж.

// getSqmByBuildingAndDoor() — apt_types-аас, олдохгүй бол хуучин (legacy)
// hardcoded fallback-аар талбай тодорхойлно.
export function getSqmByBuildingAndDoor(buildingId, doorNum, aptTypes) {
  const types = (aptTypes || []).filter((t) => t.building_id === buildingId);
  for (const t of types) {
    const doors = Array.isArray(t.door_numbers) ? t.door_numbers : [];
    if (doors.includes(doorNum)) return parseFloat(t.sqm) || 0;
  }
  if (buildingId >= 101 && buildingId <= 104) return (doorNum === 3 || doorNum === 4) ? 49.95 : 55.04;
  if (buildingId >= 105 && buildingId <= 109) return (doorNum === 1 || doorNum === 4) ? 117.67 : 117.83;
  if (buildingId >= 110 && buildingId <= 114) return (doorNum === 1 || doorNum === 4) ? 95.71 : 95.86;
  if (buildingId >= 115 && buildingId <= 118) return (doorNum === 1 || doorNum === 4) ? 69.92 : 79.98;
  return 0;
}

export function residentSqm(r, aptTypes) {
  return getSqmByBuildingAndDoor(r.building, r.door, aptTypes);
}

// renderResidents() дотоод filter логик — isVirtual (Cosmo) ЗААВАЛ хасна,
// building/entrance/чөлөөт хайлт хослуулна.
export function filterResidentsList(residents, { query, buildingFilter, entranceFilter }) {
  const q = (query || '').toLowerCase();
  return (residents || []).filter((r) => {
    if (!r) return false;
    if (r.isVirtual) return false; // Cosmo — заавал нуана
    if (buildingFilter && String(r.building) !== String(buildingFilter)) return false;
    if (entranceFilter && String(r.entrance || 1) !== String(entranceFilter)) return false;
    if (!q) return true;
    return (r.firstname || '').toLowerCase().includes(q)
      || (r.lastname || '').toLowerCase().includes(q)
      || String(r.building).includes(q)
      || String(r.apt).includes(q)
      || (r.phones || []).join(' ').includes(q)
      || (r.vehicles || []).join(' ').toLowerCase().includes(q);
  }).slice().sort((a, b) => Number(a.apt) - Number(b.apt));
}
