// gate-control.js-ийн цэвэр туслах функцүүдийн React талын эх сурвалж.

export function fmtGateDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, '0'), da = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0'), mi = String(d.getMinutes()).padStart(2, '0'), ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}/${mo}/${da} ${hh}:${mi}:${ss}`;
}

export function fmtPlate(digits, letters) {
  if (!digits && !letters) return '—';
  return `${digits || ''} ${letters || ''}`.trim();
}

export const GATE_STATUS_LABELS = { pending: 'Хүлээгдэж буй', entered: 'Орсон', completed: 'Дууссан' };

export function residentLabelForApt(apt, residents) {
  const r = (residents || []).find((x) => String(x.apt) === String(apt));
  return r ? `${r.firstname || ''} ${r.lastname || ''}`.trim() + ` (${apt})` : String(apt || '—');
}

// gate-control.js-ийн жагсаалтын шүүлтүүр логик (guest_invites) — цэвэр функц.
export function filterGuestLog(rows, { year, month, day, status, query }, residents) {
  const q = (query || '').trim().toLowerCase();
  return (rows || []).filter((r) => {
    const d = r.created_at ? new Date(r.created_at) : null;
    if (year && (!d || d.getFullYear() !== +year)) return false;
    if (month && (!d || d.getMonth() + 1 !== +month)) return false;
    if (day && (!d || d.getDate() !== +day)) return false;
    if (status && r.status !== status) return false;
    if (q) {
      const resident = (residents || []).find((x) => String(x.apt) === String(r.apt));
      const hay = `${r.apt} ${r.plate_digits || ''} ${r.plate_letters || ''} ${resident?.firstname || ''} ${resident?.lastname || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// temp_parking_log жагсаалтын шүүлтүүр логик.
export function filterTempParkingLog(rows, { year, month, day, query }) {
  const q = (query || '').trim().toLowerCase();
  return (rows || []).filter((r) => {
    const d = r.entered_at ? new Date(r.entered_at) : null;
    if (year && (!d || d.getFullYear() !== +year)) return false;
    if (month && (!d || d.getMonth() + 1 !== +month)) return false;
    if (day && (!d || d.getDate() !== +day)) return false;
    if (q) {
      const hay = `${r.plate_digits || ''} ${r.plate_letters || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
