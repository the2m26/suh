// market-valuation.js-ийн цэвэр sparkline chart тооцооллын функцүүдийн React
// талын эх сурвалж (DOM/SVG string angular биш, координат тооцоолол л).

export const MV_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function mvLastValue(rows, field) {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][field] != null) return rows[i][field];
  }
  return null;
}

export function mvPrevValue(rows, field) {
  let found = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][field] != null) { found++; if (found === 2) return rows[i][field]; }
  }
  return null;
}

export function mvChangePct(rows, field) {
  const last = mvLastValue(rows, field), prev = mvPrevValue(rows, field);
  if (last == null || prev == null || prev === 0) return null;
  return ((last - prev) / prev) * 100;
}

export function mvComputeCoords(values, w, h, pad = 4, padTop = 4, padBottom = null) {
  padBottom = padBottom != null ? padBottom : padTop;
  const pts = [];
  const n = values.length;
  values.forEach((v, i) => { if (v != null && !isNaN(v)) pts.push({ i, v }); });
  if (!pts.length) return [];
  const valid = pts.map((p) => p.v);
  const min = Math.min(...valid), max = Math.max(...valid);
  const range = (max - min) || 1;
  return pts.map((p) => ({
    i: p.i, v: p.v,
    x: pad + (p.i / Math.max(n - 1, 1)) * (w - 2 * pad),
    y: h - padBottom - ((p.v - min) / range) * (h - padTop - padBottom),
  }));
}

export function mvSmoothPathFromCoords(coords) {
  if (!coords.length) return '';
  if (coords.length === 1) return `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  if (coords.length === 2) return `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)} L${coords[1].x.toFixed(1)},${coords[1].y.toFixed(1)}`;
  let d = `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] || coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export const MV_FIELD_LABELS = {
  apartment_sale: 'Орон сууц', rent_1room: '1 өрөө', rent_2room: '2 өрөө', rent_3room: '3 өрөө',
  rent_4room: '4 өрөө', rent_5room: '5 өрөө', rent_6room: '6 өрөө',
  storage_sale: 'Агуулах', storage_rent: 'Агуулах', parking_sale: 'Зогсоол', parking_rent: 'Зогсоол',
};

export const MV_DETAIL_CONFIG = {
  apartment: { title: 'Орон сууцны борлуулалтын үнэ', fields: ['apartment_sale'], labels: ['Орон сууц (₮/м²)'] },
  rent: { title: 'Орон сууцны түрээсийн үнэ (1-6 өрөө)', fields: ['rent_1room', 'rent_2room', 'rent_3room', 'rent_4room', 'rent_5room', 'rent_6room'], labels: ['1 өрөө', '2 өрөө', '3 өрөө', '4 өрөө', '5 өрөө', '6 өрөө'] },
  sale2: { title: 'Агуулах, Зогсоолын борлуулалтын үнэ', fields: ['storage_sale', 'parking_sale'], labels: ['Агуулах (₮)', 'Зогсоол (₮)'] },
  rent2: { title: 'Агуулах, Зогсоолын түрээслэх үнэ', fields: ['storage_rent', 'parking_rent'], labels: ['Агуулах (₮/сар)', 'Зогсоол (₮/сар)'] },
};
