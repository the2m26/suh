// employees.js-ийн цэвэр туслах функцүүдийн React талын эх сурвалж.

// _employeeDisplayName() — "Өөрийн нэр" ТОМ үСГЭЭР, ард нь "Эцэг/эхийн нэр".
export function employeeDisplayName(e) {
  const first = (e.firstName || '').trim();
  const parent = (e.parentName || '').trim();
  if (first) return (first.toUpperCase() + (parent ? ' ' + parent : '')).trim();
  return e.fullName || '—';
}

export function filterEmployeesList(employees, query) {
  const q = (query || '').toLowerCase();
  const list = q ? (employees || []).filter((e) => {
    return (e.fullName || '').toLowerCase().includes(q)
      || (e.firstName || '').toLowerCase().includes(q)
      || (e.lastName || '').toLowerCase().includes(q)
      || (e.position || '').toLowerCase().includes(q);
  }) : (employees || []);
  return list.slice().sort((a, b) => employeeDisplayName(a).localeCompare(employeeDisplayName(b)));
}
