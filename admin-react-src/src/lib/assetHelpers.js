// assets.js-ийн цэвэр туслах функцүүдийн React талын эх сурвалж.
// ⚠️ ЗОРИУДААР ОРУУЛААГүй: accumulatedDepreciationAtMonths()/computeDepreciation()
// (мөнгөн дүнгийн элэгдэл тооцоолол) — Дүрэм 3-аар зөвшөөрөл шаардана. Эндхийг
// зөвхөн ХУГАЦААНЫ (%, мөнгөгүй) ашиглалтын явцын заагуур л агуулна.

export const ASSET_STATUS_LABELS = { active: 'Ашиглаж байгаа', repair: 'Засварт', disposed: 'Актлагдсан' };

// suh.html-ийн ерөнхий огнооны туслах (мөнгөгүй, зөвхөн хугацаа) — мөр ~5409.
export function monthsBetweenDates(d1, d2) {
  if (!d1 || !d2) return 0;
  const a = new Date(d1), b = new Date(d2);
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}
export function addMonths(dateStr, months) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + (+months || 0));
  return d.toISOString().slice(0, 10);
}

export function getAssetCategoryLabel(categories, code) {
  return categories.find((c) => c.code === code)?.label || code;
}

// fixed_assets.responsible нь ажилтны fullName-г ТЕКСТЭЭР шууд хадгалдаг —
// тохирох ажилтны бичлэгийг олж дэлгэцийн нэр (employeeDisplayName)-ээр харуулна.
export function responsibleDisplayName(name, employees, employeeDisplayNameFn) {
  if (!name) return '';
  const emp = employees.find((e) => e.fullName === name);
  return emp ? employeeDisplayNameFn(emp) : name;
}

// Ашиглалтын хугацааны (сарын тоогоор, ХУГАЦАА — мөнгө биш) явцын хувь.
export function assetLifeProgressPct(a) {
  if (!a.purchaseDate || !a.usefulLife) return 0;
  const monthsElapsed = monthsBetweenDates(a.purchaseDate, new Date().toISOString().slice(0, 10));
  return Math.min(100, Math.round((monthsElapsed / a.usefulLife) * 100));
}

export function assetLifeProgressColor(pct) {
  if (pct >= 90) return 'var(--danger)';
  if (pct >= 70) return 'var(--warning)';
  return 'var(--success)';
}

export function filterAssetsList(assets, { query, responsibleFilter, locationFilter, group, status }) {
  const q = (query || '').toLowerCase();
  return (assets || []).filter((a) => {
    if (group && a.assetGroup !== group) return false;
    if (status && a.status !== status) return false;
    if (responsibleFilter && a.responsible !== responsibleFilter) return false;
    if (locationFilter && a.location !== locationFilter) return false;
    if (!q) return true;
    return (a.name || '').toLowerCase().includes(q) || (a.code || '').toLowerCase().includes(q) || (a.assetBarcode || '').toLowerCase().includes(q);
  });
}
