// polls.js-ийн цэвэр туслах функцүүдийн React талын эх сурвалж.

export const POLL_STATUS_LABELS = { draft: 'Ноорог', active: 'Идэвхтэй', closed: 'Хаагдсан' };

export function pollTypeLabel(type) {
  if (type === 'issue') return 'Санал асуулга';
  if (type === 'rating') return 'Үнэлгээ өгөх';
  return 'Ээлжит сонгууль';
}

// polls.js-ийн getResidentOptionsHTML() эквивалент — {value, label} массив
// буцаана (React select-д зориулав, HTML string биш).
export function residentOptions(residents) {
  return (residents || [])
    .filter((r) => r && (r.firstname || r.lastname))
    .map((r) => ({
      value: r.id,
      label: `${r.lastname || ''} ${r.firstname || ''}`.trim() + ` — ${r.apt}`,
    }));
}

// polls.js-ийн getMyResidentId() — currentProfile.apt-аар residents массиваас олно.
export function getMyResidentId(currentProfile, residents) {
  const apt = currentProfile?.apt;
  if (!apt) return null;
  const r = (residents || []).find((x) => x && String(x.apt) === String(apt));
  return r ? r.id : null;
}
