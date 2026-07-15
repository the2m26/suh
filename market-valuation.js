// market-valuation.js — Зах зээлийн үнэлгээний модуль (sparkline chart-той)
// (suh.html-ээс тусгаарлав)
// Хамаарал: sb (db.js). Бие даасан, бусад модулиас цөөн хамааралтай.

// ============================================================
// SUPABASE CRUD ФУНКЦҮҮД
// ============================================================



// --- BUSINESSES ---
async function db_loadMarketValuations() {
  const {data, error} = await sb.from('market_valuations').select('*').order('year').order('month');
  if(error){console.error('market_valuations load error:', error.message); return;}
  marketValuations = data || [];
}
let marketValuations = [];
// ============================================================
// ЗАХЗЭЭЛИЙН үНЭЛГЭЭ
// ============================================================
const MV_COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899'];
function mvLastValue(field) {
  for(let i=marketValuations.length-1; i>=0; i--) {
    if(marketValuations[i][field]!=null) return marketValuations[i][field];
  }
  return null;
}
function mvPrevValue(field) {
  let found = 0;
  for(let i=marketValuations.length-1; i>=0; i--) {
    if(marketValuations[i][field]!=null) { found++; if(found===2) return marketValuations[i][field]; }
  }
  return null;
}
function mvChangeHTML(field) {
  const last = mvLastValue(field), prev = mvPrevValue(field);
  if(last==null || prev==null || prev===0) return '';
  const pct = ((last-prev)/prev*100);
  const up = pct >= 0;
  return `<span style="color:${up?'var(--success)':'var(--danger)'};font-size:11px;font-weight:600">${up?'▲':'▼'} ${Math.abs(pct).toFixed(1)}%</span>`;
}
function mvComputeCoords(values, w, h, pad, padTop, padBottom) {
  pad = pad || 4;
  padTop = padTop!=null ? padTop : 4;
  padBottom = padBottom!=null ? padBottom : padTop;
  const pts = [];
  const n = values.length;
  values.forEach((v,i)=>{ if(v!=null && !isNaN(v)) pts.push({i, v}); });
  if(!pts.length) return [];
  const valid = pts.map(p=>p.v);
  const min = Math.min(...valid), max = Math.max(...valid);
  const range = (max - min) || 1;
  return pts.map(p=>({
    i: p.i, v: p.v,
    x: pad + (p.i/(Math.max(n-1,1)))*(w-2*pad),
    y: h - padBottom - ((p.v-min)/range)*(h-padTop-padBottom)
  }));
}
function mvSmoothPathFromCoords(coords) {
  if(!coords.length) return '';
  if(coords.length === 1) return `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  if(coords.length === 2) return `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)} L${coords[1].x.toFixed(1)},${coords[1].y.toFixed(1)}`;
  // Цэвэр Catmull-Rom → Cubic Bezier: бүрэн зөөлөн, дугуй муруй. Орой дээрх бага зэргийн "overshoot"-ыг
  // муруйн математик биш, харин mvComputeCoords дахь нэмэгдүүлсэн зай (padding) шийддэг
  let d = `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for(let i=0; i<coords.length-1; i++) {
    const p0 = coords[i-1] || coords[i];
    const p1 = coords[i];
    const p2 = coords[i+1];
    const p3 = coords[i+2] || p2;
    const cp1x = p1.x + (p2.x-p0.x)/6, cp1y = p1.y + (p2.y-p0.y)/6;
    const cp2x = p2.x - (p3.x-p1.x)/6, cp2y = p2.y - (p3.y-p1.y)/6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}
// Дундын жижиг tooltip — бүх chart-үүдэд дахин ашиглана (гүйцэтгэлийн үүднээс нэг л элемент)
function mvShowTooltip(evt, text) {
  let tip = document.getElementById('mv-tooltip');
  if(!tip) {
    tip = document.createElement('div');
    tip.id = 'mv-tooltip';
    tip.style.cssText = 'position:fixed;z-index:9999;background:var(--bg-card);border:1px solid var(--border-light);border-radius:6px;padding:4px 9px;font-size:11px;font-weight:600;color:var(--text);pointer-events:none;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.35)';
    document.body.appendChild(tip);
  }
  tip.textContent = text;
  tip.style.display = 'block';
  tip.style.left = (evt.clientX+12)+'px';
  tip.style.top = (evt.clientY-26)+'px';
}
function mvHideTooltip() {
  const tip = document.getElementById('mv-tooltip');
  if(tip) tip.style.display = 'none';
}
// seriesArr: [{values:[...], color:'#...'}], rows: харгалзах мөрүүд (сарын тэнхлэг + tooltip-д ашиглана)
function mvSparklineSVG(seriesArr, w, h, rows) {
  const axisH = 14;
  const chartH = h - axisH;
  let svg = `<line x1="4" y1="${chartH-2}" x2="${w-4}" y2="${chartH-2}" stroke="var(--border)" stroke-width="1"/>`;
  seriesArr.forEach(s=>{
    const coords = mvComputeCoords(s.values, w, chartH, 4, 10, 4);
    const d = mvSmoothPathFromCoords(coords);
    if(d) svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    coords.forEach(c=>{
      const monthLabel = (rows && rows[c.i]) ? rows[c.i].month+'-р сар' : '';
      const tipText = `${monthLabel}: ${fmtMoney(c.v)}`;
      svg += `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="2" fill="${s.color}" style="pointer-events:none"/>`;
      svg += `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="7" fill="transparent" style="cursor:pointer" onmouseenter="mvShowTooltip(event, '${tipText.replace(/'/g,"\\'")}')" onmousemove="mvShowTooltip(event, '${tipText.replace(/'/g,"\\'")}')" onmouseleave="mvHideTooltip()"></circle>`;
    });
  });
  if(rows && rows.length) {
    const n = rows.length;
    rows.forEach((r,i)=>{
      const x = 4 + (i/(Math.max(n-1,1)))*(w-8);
      svg += `<text x="${x.toFixed(1)}" y="${h-2}" font-size="7" fill="var(--text-muted)" text-anchor="middle">${r.month}</text>`;
    });
  }
  return svg;
}
const MV_FIELD_LABELS = {
  apartment_sale:'Орон сууц', rent_1room:'1 өрөө', rent_2room:'2 өрөө', rent_3room:'3 өрөө',
  rent_4room:'4 өрөө', rent_5room:'5 өрөө', rent_6room:'6 өрөө',
  storage_sale:'Агуулах', storage_rent:'Агуулах', parking_sale:'Зогсоол', parking_rent:'Зогсоол'
};
// SVG-ийн бодит рендерлэгдсэн өргөнийг хэмжиж, viewBox-ийг үүнтэй тэнцүү болгоно —
// үүгээр фонт/зураас/дугуйн хэмжээ (px нэгжээр заасан) дэлгэц өргөн болоход хэт томрохгүй
function mvRenderChartInto(elId, seriesArr, rows, aspectH, aspectW) {
  aspectW = aspectW || 300; aspectH = aspectH || 70;
  const el = document.getElementById(elId);
  if(!el) return;
  const w = el.clientWidth || aspectW;
  const h = Math.round(w * aspectH/aspectW);
  el.setAttribute('viewBox', `0 0 ${w} ${h}`);
  el.innerHTML = mvSparklineSVG(seriesArr, w, h, rows);
}
function renderMarketValuationCardsFor(prefix) {
  const rows = marketValuations.slice(-12); // сүүлийн 12 сар — 1-12 тэнхлэгт зориулав

  // Карт 1 — Орон сууцны борлуулалт (ганц муруй)
  const apLast = mvLastValue('apartment_sale');
  document.getElementById(prefix+'-summary-apartment').innerHTML = apLast!=null
    ? `<span style="font-size:20px;font-weight:700">${fmtMoney(apLast)}</span> ${mvChangeHTML('apartment_sale')}`
    : `<span style="color:var(--text-muted);font-size:12px">Дата алга</span>`;
  mvRenderChartInto(prefix+'-chart-apartment', [{values: rows.map(r=>r.apartment_sale), color: MV_COLORS[0]}], rows);

  // Карт 2 — Түрээс 1-6 өрөө (6 муруй)
  const rentFields = ['rent_1room','rent_2room','rent_3room','rent_4room','rent_5room','rent_6room'];
  document.getElementById(prefix+'-summary-rent').innerHTML = rentFields.map((f,i)=>{
    const v = mvLastValue(f);
    if(v==null) return '';
    return `<span style="font-size:11px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${MV_COLORS[i]};margin-right:4px"></span>${MV_FIELD_LABELS[f]}: <strong>${fmtMoney(v)}</strong></span>`;
  }).join('');
  mvRenderChartInto(prefix+'-chart-rent', rentFields.map((f,i)=>({values: rows.map(r=>r[f]), color: MV_COLORS[i]})), rows);

  // Карт 3 — Агуулах+Зогсоол борлуулалт (2 муруй)
  const sale2Fields = ['storage_sale','parking_sale'];
  document.getElementById(prefix+'-summary-sale2').innerHTML = sale2Fields.map((f,i)=>{
    const v = mvLastValue(f);
    if(v==null) return '';
    const label = f==='storage_sale' ? 'Агуулах' : 'Зогсоол';
    return `<span style="font-size:11px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${MV_COLORS[i]};margin-right:4px"></span>${label}: <strong>${fmtMoney(v)}</strong></span>`;
  }).join('');
  mvRenderChartInto(prefix+'-chart-sale2', sale2Fields.map((f,i)=>({values: rows.map(r=>r[f]), color: MV_COLORS[i]})), rows);

  // Карт 4 — Агуулах+Зогсоол түрээс (2 муруй)
  const rent2Fields = ['storage_rent','parking_rent'];
  document.getElementById(prefix+'-summary-rent2').innerHTML = rent2Fields.map((f,i)=>{
    const v = mvLastValue(f);
    if(v==null) return '';
    const label = f==='storage_rent' ? 'Агуулах' : 'Зогсоол';
    return `<span style="font-size:11px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${MV_COLORS[i]};margin-right:4px"></span>${label}: <strong>${fmtMoney(v)}</strong></span>`;
  }).join('');
  mvRenderChartInto(prefix+'-chart-rent2', rent2Fields.map((f,i)=>({values: rows.map(r=>r[f]), color: MV_COLORS[i]})), rows);
}
// Admin хуудас + Хянах самбар хоёуланд нь дуудагдана (Хянах самбарын карт зөвхөн ХАРАХ, засах боломжгүй)
function renderMarketValuationCards() {
  renderMarketValuationCardsFor('mv');
  if(document.getElementById('mv-dash-summary-apartment')) renderMarketValuationCardsFor('mv-dash');
}
// Цонхны хэмжээ амьдаар өөрчлөгдөхөд chart-г зөв хэмжээгээр дахин зурна (debounce-той)
let _mvResizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(_mvResizeTimeout);
  _mvResizeTimeout = setTimeout(() => {
    if(document.getElementById('page-dashboard')?.classList.contains('active')) renderMarketValuationCardsFor('mv-dash');
    if(document.getElementById('page-market-valuation')?.classList.contains('active')) renderMarketValuationCardsFor('mv');
  }, 200);
});
const MV_DETAIL_CONFIG = {
  apartment: {title:'Орон сууцны борлуулалтын үнэ', fields:['apartment_sale'], labels:['Орон сууц (₮/м²)']},
  rent: {title:'Орон сууцны түрээсийн үнэ (1-6 өрөө)', fields:['rent_1room','rent_2room','rent_3room','rent_4room','rent_5room','rent_6room'], labels:['1 өрөө','2 өрөө','3 өрөө','4 өрөө','5 өрөө','6 өрөө']},
  sale2: {title:'Агуулах, Зогсоолын борлуулалтын үнэ', fields:['storage_sale','parking_sale'], labels:['Агуулах (₮)','Зогсоол (₮)']},
  rent2: {title:'Агуулах, Зогсоолын түрээслэх үнэ', fields:['storage_rent','parking_rent'], labels:['Агуулах (₮/сар)','Зогсоол (₮/сар)']},
};
function openMarketValuationDetail(key) {
  const cfg = MV_DETAIL_CONFIG[key];
  document.getElementById('mv-detail-title').textContent = cfg.title;
  document.getElementById('mv-detail-wrap').style.display = 'block';
  document.getElementById('mv-detail-wrap').scrollIntoView({behavior:'smooth', block:'nearest'});

  mvRenderChartInto('mv-detail-chart', cfg.fields.map((f,i)=>({values: marketValuations.map(r=>r[f]), color: MV_COLORS[i]})), marketValuations, 200, 700);

  document.getElementById('mv-detail-legend').innerHTML = cfg.fields.map((f,i)=>
    `<span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${MV_COLORS[i]};margin-right:5px"></span>${cfg.labels[i]}</span>`
  ).join('');

  document.getElementById('mv-detail-thead').innerHTML = `<tr><th>САР</th>${cfg.labels.map(l=>`<th style="text-align:right">${l}</th>`).join('')}<th style="width:60px">ҮЙЛДЭЛ</th></tr>`;
  const rows = [...marketValuations].reverse();
  document.getElementById('mv-detail-tbody').innerHTML = rows.map(r=>`
    <tr>
      <td class="dt-text">${r.year}/${String(r.month).padStart(2,'0')}</td>
      ${cfg.fields.map(f=>`<td class="dt-text dt-mono" style="text-align:right">${r[f]!=null?fmtMoney(r[f]):'—'}</td>`).join('')}
      <td><button class="btn btn-ghost btn-sm" onclick="openMarketValuationEdit(${r.year},${r.month})" style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Засах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></td>
    </tr>`).join('') || `<tr><td colspan="${cfg.fields.length+2}" style="text-align:center;padding:20px;color:var(--text-muted)">Дата алга</td></tr>`;
}
function closeMarketValuationDetail() {
  document.getElementById('mv-detail-wrap').style.display = 'none';
}
function openMarketValuationEdit(year, month) {
  const yearSel = document.getElementById('mv-year');
  const curYear = new Date().getFullYear();
  yearSel.innerHTML = '';
  for(let y=curYear-2; y<=curYear+1; y++) yearSel.innerHTML += `<option value="${y}">${y}</option>`;

  const useYear = year || curYear;
  const useMonth = month || (new Date().getMonth()+1);
  yearSel.value = useYear;
  document.getElementById('mv-month').value = useMonth;

  const fields = ['apartment_sale','rent_1room','rent_2room','rent_3room','rent_4room','rent_5room','rent_6room','storage_sale','storage_rent','parking_sale','parking_rent'];
  const existing = marketValuations.find(r=>r.year===useYear && r.month===useMonth);
  fields.forEach(f=>{
    document.getElementById('mv-'+f.replace(/_/g,'-')).value = existing ? (existing[f]??'') : '';
  });
  // Гарчиг үргэлж статик — "Сарын үнэ оруулах"
  openModal('modal-market-valuation');
}
async function saveMarketValuation() {
  const year = +document.getElementById('mv-year').value;
  const month = +document.getElementById('mv-month').value;
  const fields = ['apartment_sale','rent_1room','rent_2room','rent_3room','rent_4room','rent_5room','rent_6room','storage_sale','storage_rent','parking_sale','parking_rent'];
  const row = {year, month};
  fields.forEach(f=>{
    const val = document.getElementById('mv-'+f.replace(/_/g,'-')).value;
    row[f] = val ? +val : null;
  });
  const {data, error} = await sb.from('market_valuations').upsert(row, {onConflict:'year,month'}).select().single();
  if(error) { toast('Хадгалахад алдаа: '+error.message, 'error'); return; }
  const idx = marketValuations.findIndex(r=>r.year===year && r.month===month);
  if(idx>=0) marketValuations[idx] = data; else marketValuations.push(data);
  marketValuations.sort((a,b)=> a.year-b.year || a.month-b.month);
  closeModal('modal-market-valuation');
  renderMarketValuationCards();
  toast('Хадгалагдлаа ✓','success');
}
