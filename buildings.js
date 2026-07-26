// buildings.js — Байр, Тоотын төрөл, Дугаарлалтын тохиргооны модуль
// (suh.html болон residents.js-ээс тусгаарлав)
// Хамаарал: sb (db.js) шаардлагатай. Энэ файлыг residents.js, businesses.js,
// finance.js, parking-storage.js-ээс ӨМНӨ ачаалах ёстой — учир нь тэд бүгд
// BUILDINGS/APT_TYPES массив болон getAptLabel()/makeAptId()-г ашигладаг.

let BUILDINGS = [];  // Supabase-аас ачаална
let APT_TYPES = [];  // Supabase-аас ачаална
const GROUP_COLORS = {
  A: {bg:'rgba(245,158,11,0.12)', border:'#F59E0B', text:'#F59E0B'},
  B: {bg:'rgba(59,130,246,0.12)', border:'#3B82F6', text:'#3B82F6'},
  C: {bg:'rgba(100,116,139,0.12)', border:'#64748B', text:'#94A3B8'},
  D: {bg:'rgba(239,68,68,0.12)', border:'#EF4444', text:'#EF4444'},
  E: {bg:'rgba(168,85,247,0.12)', border:'#A855F7', text:'#A855F7'},
  F: {bg:'rgba(20,184,166,0.12)', border:'#14B8A6', text:'#14B8A6'},
};
async function db_loadBuildings() {
  const {data, error} = await sb.from('buildings').select('*').order('id');
  if(error){console.error('buildings load error:', error.message); return;}
  if(!data || data.length === 0){console.warn('buildings: хоосон'); return;}
  BUILDINGS = data.map(b=>({
    id: b.id,
    floors: b.floors,
    aptsPerFloor: b.apts_per_floor,
    group: b.group_name || 'A',
    label: b.label,
    entrances: b.entrances || 1,
    numbering_scheme: b.numbering_scheme || 'floor_door',
    seq_start: b.seq_start || 101
  }));
  // buildings ачаалагдсаны дараа select-уудыг шинэчлэх
  populateBuildingSelects();
}
async function db_loadAptTypes() {
  const {data, error} = await sb.from('apt_types').select('*');
  if(error){console.error('apt_types load error:', error.message); return;}
  APT_TYPES = data || [];
}
let editingBuildingId = null;
let editingAptTypeId = null;
function getAptLabel(scheme, entrance, floor, door, aptsPerEntrance, seqStart, floors) {
  seqStart = seqStart || 101;
  floors = floors || floor;
  switch(scheme) {
    case 'floor_door':
      // давхар + хаалга (1-р давхар 2-р хаалга → 102)
      return String(floor) + String(door).padStart(2,'0');
    case 'sequential':
      // доороос дээш, ОРЦ ДАМЖИН үргэлжлүүлж дараалуулна (хуучин соц барилгын загвар):
      // 1-р орцны 1-р давхрын 1-р хаалганаас эхэлж, сүүлийн орцны хамгийн дээд давхрын сүүлийн хаалгаар төгсгөнө
      return String(seqStart + (entrance-1)*floors*aptsPerEntrance + (floor-1)*aptsPerEntrance + (door-1));
    case 'entrance_floor':
      // орц + давхар + хаалга (1-р орц 3-р давхар 2-р хаалга → 1302)
      return String(entrance) + String(floor) + String(door).padStart(2,'0');
    case 'floor_only':
      // давхар + хаалга (2 оронтой) → 12, 103
      return String(floor) + String(door);
    default:
      return String(floor) + String(door).padStart(2,'0');
  }
}
function renderAdminBuildingsTable() {
  const body = document.getElementById('admin-buildings-body');
  if(!body) return;
  if(!BUILDINGS.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-state">Байр байхгүй</td></tr>';
    return;
  }
  const schemeNames = {floor_door:'Давхар+Хаалга', sequential:'Дараалсан', entrance_floor:'Орц+Давхар+Хаалга', floor_only:'Зөвхөн давхар'};
  body.innerHTML = BUILDINGS.map(b => {
    const gc = GROUP_COLORS[b.group] || GROUP_COLORS['A'];
    const entrances = b.entrances || 1;
    const scheme = schemeNames[b.numbering_scheme] || 'Давхар+Хаалга';
    return `<tr>
      <td><span class="dt-title dt-mono">${b.id}</span></td>
      <td class="dt-text">${esc(b.label)}</td>
      <td class="dt-text" style="text-align:center">${b.floors}</td>
      <td class="dt-text" style="text-align:center">${entrances > 1 ? entrances+'орц · ' : ''}${b.aptsPerFloor}/давхар</td>
      <td class="dt-muted">${scheme}</td>
      <td><span class="tag" style="background:${gc.bg};color:${gc.text};border:1px solid ${gc.border}">${b.group}</span></td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" onclick="openEditBuilding(${b.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Засах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteBuilding(${b.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--danger)" title="Устгах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}
function openAddBuilding() {
  // ⚠️ 2026-07-19 аудит: "Тоот, зогсоол, агуулах" (apartments) модулийн Нэмэх/Засах/Устгах
  // эрхийн шалгалт client-side-д огт байгаагүй байсныг олж нэмэв.
  if(!canAdd('apartments')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  editingBuildingId = null;
  document.getElementById('admin-bld-id').value = '';
  document.getElementById('admin-bld-id').disabled = false;
  document.getElementById('admin-bld-label').value = '';
  document.getElementById('admin-bld-floors').value = '';
  document.getElementById('admin-bld-apts').value = '';
  document.getElementById('admin-bld-entrances').value = '1';
  document.getElementById('admin-bld-group').value = 'A';
  document.getElementById('admin-entrance-config').style.display = 'none';
  document.getElementById('admin-entrance-rows').innerHTML = '';
  // Default scheme
  const radio = document.querySelector('input[name="bld-scheme"][value="floor_door"]');
  if(radio) { radio.checked = true; onSchemeChange(); }
  document.getElementById('modal-admin-building-title').textContent = 'Байр нэмэх';
  openModal('modal-admin-building');
  updateBldPreview();
}
function openEditBuilding(id) {
  const b = BUILDINGS.find(x=>x.id===id);
  if(!b) return;
  editingBuildingId = id;
  document.getElementById('admin-bld-id').value = b.id;
  document.getElementById('admin-bld-id').disabled = true;
  document.getElementById('admin-bld-label').value = b.label;
  document.getElementById('admin-bld-floors').value = b.floors;
  document.getElementById('admin-bld-apts').value = b.aptsPerFloor;
  document.getElementById('admin-bld-entrances').value = b.entrances || 1;
  document.getElementById('admin-bld-group').value = b.group;
  onEntranceCountChange();
  // Scheme сонгох
  const scheme = b.numbering_scheme || 'floor_door';
  const radio = document.querySelector(`input[name="bld-scheme"][value="${scheme}"]`);
  if(radio) { radio.checked = true; onSchemeChange(); }
  if(scheme==='sequential' && b.seq_start) {
    const si = document.getElementById('seq-start');
    if(si) si.value = b.seq_start;
  }
  document.getElementById('modal-admin-building-title').textContent = 'Байрны бүтэц засах';
  openModal('modal-admin-building');
  updateBldPreview();
}
async function saveBuilding() {
  if(!(editingBuildingId ? canWrite('apartments') : canAdd('apartments'))) {
    toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return;
  }
  const id = +document.getElementById('admin-bld-id').value;
  const label = document.getElementById('admin-bld-label').value.trim();
  const floors = +document.getElementById('admin-bld-floors').value;
  const apts = +document.getElementById('admin-bld-apts').value;
  const entrances = +document.getElementById('admin-bld-entrances').value || 1;
  const group = document.getElementById('admin-bld-group').value;
  const scheme = document.querySelector('input[name="bld-scheme"]:checked')?.value || 'floor_door';
  const seqStart = +document.getElementById('seq-start')?.value || 101;

  if(!id || !label || !floors || !apts) { toast('Бүх талбарыг бөглөнө үү','error'); return; }

  const totalApts = floors * apts * entrances;
  const row = {
    id, label, floors,
    apts_per_floor: apts * entrances,  // нийт хаалга/давхар
    group_name: group,
    entrances,
    numbering_scheme: scheme,
    seq_start: scheme==='sequential' ? seqStart : null
  };

  const localRow = {
    id, label, floors,
    aptsPerFloor: apts * entrances,
    group, entrances,
    numbering_scheme: scheme,
    seq_start: seqStart
  };

  if(editingBuildingId) {
    if(id !== editingBuildingId) {
      // ID өөрчлөгдсөн — хуучин мөрийг устгаж шинэ ID-тайгаар оруулна
      const {error: delErr} = await sb.from('buildings').delete().eq('id', editingBuildingId);
      if(delErr){toast('Алдаа: '+delErr.message,'error');return;}
      const {error: insErr} = await sb.from('buildings').insert(row);
      if(insErr){toast('Алдаа: '+insErr.message,'error');return;}
    } else {
      const {error} = await sb.from('buildings').update({
        label, floors, apts_per_floor: apts*entrances,
        group_name: group, entrances, numbering_scheme: scheme,
        seq_start: scheme==='sequential' ? seqStart : null
      }).eq('id', editingBuildingId);
      if(error){toast('Алдаа: '+error.message,'error');return;}
    }
    const idx = BUILDINGS.findIndex(b=>b.id===editingBuildingId);
    if(idx>=0) BUILDINGS[idx] = localRow;
    toast('Байр шинэчлэгдлээ ✓','success');
    logActivity('edit', 'apartments', id, `${id}-р байр (${label})`);
  } else {
    const {error} = await sb.from('buildings').insert(row);
    if(error){toast('Алдаа: '+error.message,'error');return;}
    BUILDINGS.push(localRow);
    BUILDINGS.sort((a,b)=>a.id-b.id);
    toast(`Байр нэмэгдлээ ✓ (нийт ${totalApts} тоот)`,'success');
    logActivity('add', 'apartments', id, `${id}-р байр (${label})`);
  }

  // Тухайн байранд "Тоот" (apt_types) тохиргоо огт байхгүй бол, Хаалганы дугаарыг (1..Тоотын тоо)
  // автоматаар үүсгэж өгнө — админ гараар "Тоот" таб руу орох шаардлагагүй болно
  const hasAptType = APT_TYPES.some(t=>t.building_id===id);
  if(!hasAptType) {
    const doorNumbers = Array.from({length: apts}, (_,i)=>i+1);
    const {data: newType, error: atErr} = await sb.from('apt_types')
      .insert({building_id: id, door_numbers: doorNumbers}).select().single();
    if(!atErr && newType) APT_TYPES.push(newType);
  }

  closeModal('modal-admin-building');
  populateBuildingSelects();
  renderAdminBuildingsTable();
  renderAdminPage();
  updateSidebarCount();
}
async function deleteBuilding(id) {
  if(!canDelete('apartments')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  if(!confirm(id+'-р байрыг устгах уу? Холбоотой өгөгдлүүд хэвээр үлдэнэ.')) return;
  const {error} = await sb.from('buildings').delete().eq('id', id);
  if(error){toast('Устгахад алдаа: '+error.message,'error');return;}
  BUILDINGS = BUILDINGS.filter(b=>b.id!==id);
  populateBuildingSelects();
  renderAdminBuildingsTable();
  renderAdminPage();
  updateSidebarCount();
  toast('Байр устгагдлаа','success');
  logActivity('delete', 'apartments', id, `${id}-р байр`);
}
function renderAptTypesTable() {
  const body = document.getElementById('admin-apttypes-body');
  if(!body) return;
  const filterBld = +document.getElementById('admin-apttype-building-filter').value || 0;
  let list = [...APT_TYPES];
  if(filterBld) list = list.filter(t=>t.building_id===filterBld);
  list.sort((a,b)=>a.building_id-b.building_id||(a.id-b.id));
  if(!list.length){
    body.innerHTML='<tr><td colspan="4" class="empty-state">Өгөгдөл байхгүй</td></tr>';
    return;
  }
  body.innerHTML = list.map(t=>{
    const bld = BUILDINGS.find(b=>b.id===t.building_id);
    const doors = Array.isArray(t.door_numbers) ? t.door_numbers.join(', ') : t.door_numbers;
    return `<tr>
      <td class="dt-text">${bld?esc(bld.label):t.building_id}</td>
      <td class="dt-text">Хаалга: <span class="dt-title">${doors}</span></td>
      <td class="dt-title dt-mono">${t.sqm} м²</td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" onclick="openEditAptType(${t.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Засах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteAptType(${t.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--danger)" title="Устгах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}
function openAddAptType() {
  if(!canAdd('apartments')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  editingAptTypeId = null;
  document.getElementById('admin-at-building').value = BUILDINGS[0]?.id || '';
  document.getElementById('admin-at-doors').value = '';
  document.getElementById('admin-at-sqm').value = '';
  document.getElementById('modal-admin-apttype-title').textContent = 'Талбайн төрөл нэмэх';
  openModal('modal-admin-apttype');
}
function openEditAptType(id) {
  const t = APT_TYPES.find(x=>x.id===id);
  if(!t) return;
  editingAptTypeId = id;
  document.getElementById('admin-at-building').value = t.building_id;
  const doors = Array.isArray(t.door_numbers) ? t.door_numbers.join(',') : t.door_numbers;
  document.getElementById('admin-at-doors').value = doors;
  document.getElementById('admin-at-sqm').value = t.sqm;
  document.getElementById('modal-admin-apttype-title').textContent = 'Талбайн төрөл засах';
  openModal('modal-admin-apttype');
}
async function saveAptType() {
  if(!(editingAptTypeId ? canWrite('apartments') : canAdd('apartments'))) {
    toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return;
  }
  const bldId = +document.getElementById('admin-at-building').value;
  const doorsRaw = document.getElementById('admin-at-doors').value.trim();
  const sqm = parseFloat(document.getElementById('admin-at-sqm').value);
  if(!bldId || !doorsRaw || !sqm) { toast('Бүх талбарыг бөглөнө үү','error'); return; }
  const doors = doorsRaw.split(/[,\s]+/).map(Number).filter(Boolean);
  if(!doors.length){ toast('Хаалга дугаарыг зөв оруулна уу (ж: 1,2,3)','error'); return; }

  const row = {building_id: bldId, door_numbers: doors, sqm};

  if(editingAptTypeId) {
    const {error} = await sb.from('apt_types').update(row).eq('id', editingAptTypeId);
    if(error){toast('Алдаа: '+error.message,'error');return;}
    const idx = APT_TYPES.findIndex(t=>t.id===editingAptTypeId);
    if(idx>=0) APT_TYPES[idx] = {...APT_TYPES[idx], ...row};
    toast('Талбайн төрөл шинэчлэгдлээ ✓','success');
    logActivity('edit', 'apartments', editingAptTypeId, `${bldId}-р байрны талбайн төрөл`);
  } else {
    const {data, error} = await sb.from('apt_types').insert(row).select().single();
    if(error){toast('Алдаа: '+error.message,'error');return;}
    APT_TYPES.push({id:data.id, ...row});
    toast('Талбайн төрөл нэмэгдлээ ✓','success');
    logActivity('add', 'apartments', data.id, `${bldId}-р байрны талбайн төрөл`);
  }
  closeModal('modal-admin-apttype');
  renderAptTypesTable();
}
async function deleteAptType(id) {
  if(!canDelete('apartments')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  if(!confirm('Энэ талбайн төрлийг устгах уу?')) return;
  const {error} = await sb.from('apt_types').delete().eq('id', id);
  if(error){toast('Устгахад алдаа: '+error.message,'error');return;}
  APT_TYPES = APT_TYPES.filter(t=>t.id!==id);
  renderAptTypesTable();
  toast('Устгагдлаа','success');
  logActivity('delete', 'apartments', id, 'Талбайн төрөл');
}


// Бүтэн тоотын дугаар: байр+давхар+хаалга
// жиш: 105-р байр, 3-р давхар, 2-р хаалга → "305-р байрны 302"
// residents дотор apt талбарт бичигдэх формат: buildingId*10000 + floor*100 + door
// Жишээ: 105-р байр 3-р давхар 2-р хаалга → 1050302
function makeAptId(buildingId, floor, door, entrance) {
  if(entrance) return buildingId * 100000 + entrance * 10000 + floor * 100 + door;
  return buildingId * 10000 + floor * 100 + door;
}
// ============================================================
// ADMIN — БАЙРНЫ ТОХИРГОО
// ============================================================


// ============================================================
// ДУГААРЛАЛТЫН ХЭЛБЭР — тоотын label үүсгэх
// ============================================================
// scheme: 'floor_door' | 'sequential' | 'entrance_floor' | 'floor_only'
// entrances: орцны тоо
// aptsPerEntrance: орц тус бүрт давхарт хэдэн айл
// floors: давхарын тоо

function switchAdminTab(tab, el) {
  document.getElementById('admin-buildings').style.display = tab==='buildings' ? 'block' : 'none';
  document.getElementById('admin-apttypes').style.display = tab==='apttypes' ? 'block' : 'none';
  document.getElementById('admin-parking').style.display = tab==='parking' ? 'block' : 'none';
  document.getElementById('admin-storage').style.display = tab==='storage' ? 'block' : 'none';
  document.querySelectorAll('#admin-tabs .tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  if(tab==='buildings') renderAdminBuildingsTable();
  if(tab==='apttypes') renderAptTypesTable();
  if(tab==='parking') renderParkingTypesTable();
  if(tab==='storage') renderStorageTypesTable();
}
function renderAdminPage() {
  renderAdminBuildingsTable();
  const sel = document.getElementById('admin-apttype-building-filter');
  if(sel) {
    sel.innerHTML = '<option value="">Бүх байр</option>' +
      BUILDINGS.map(b=>`<option value="${b.id}">${esc(b.label)}</option>`).join('');
  }
  const pSel = document.getElementById('admin-parking-building-filter');
  if(pSel) {
    pSel.innerHTML = '<option value="">Бүх байр</option>' +
      BUILDINGS.map(b=>`<option value="${b.id}">${esc(b.label)}</option>`).join('');
  }
  const sSel = document.getElementById('admin-storage-building-filter');
  if(sSel) {
    sSel.innerHTML = '<option value="">Бүх байр</option>' +
      BUILDINGS.map(b=>`<option value="${b.id}">${esc(b.label)}</option>`).join('');
  }
}
// --- BUILDINGS TABLE ---

// Орцны тоо өөрчлөгдөхөд
function onEntranceCountChange() {
  const count = +document.getElementById('admin-bld-entrances').value || 1;
  const wrap = document.getElementById('admin-entrance-rows');
  const cfg = document.getElementById('admin-entrance-config');
  cfg.style.display = count > 1 ? 'block' : 'none';
  wrap.innerHTML = '';
  if(count > 1) {
    for(let i=1; i<=count; i++) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;align-items:center';
      row.innerHTML = `<span style="font-size:12px;color:var(--text-dim);width:50px;flex-shrink:0">${i}-р орц</span>
        <input type="text" id="entrance-name-${i}" placeholder="ж: А орц" style="flex:1">`;
      wrap.appendChild(row);
    }
  }
  updateBldPreview();
}
// Дугаарлалтын хэлбэр сонгоход
function onSchemeChange() {
  const scheme = document.querySelector('input[name="bld-scheme"]:checked')?.value || 'floor_door';
  // Sequential-ийн нэмэлт тохиргоо харуулах
  const seqOpts = document.getElementById('scheme-sequential-opts');
  if(seqOpts) seqOpts.style.display = scheme==='sequential' ? 'flex' : 'none';
  // Radio label-уудыг highlight хийх
  document.querySelectorAll('[id^="scheme-opt-"]').forEach(el=>{
    el.style.borderColor = 'var(--border)';
    el.style.background = 'transparent';
  });
  const active = document.getElementById('scheme-opt-'+scheme);
  if(active) {
    active.style.borderColor = 'var(--accent)';
    active.style.background = 'var(--accent-glow)';
  }
  updateBldPreview();
}
// Жишээ тоот харуулах preview
function updateBldPreview() {
  const floors = +document.getElementById('admin-bld-floors').value || 0;
  const apts = +document.getElementById('admin-bld-apts').value || 0;
  const entrances = +document.getElementById('admin-bld-entrances').value || 1;
  const scheme = document.querySelector('input[name="bld-scheme"]:checked')?.value || 'floor_door';
  const seqStart = +document.getElementById('seq-start')?.value || 101;
  if(!floors || !apts) { document.getElementById('bld-preview-sample').textContent = '—'; return; }

  const samples = [];
  // 1-р давхар, 1-р хаалга
  samples.push('1F-1хаалга: ' + getAptLabel(scheme, 1, 1, 1, apts, seqStart, floors));
  // 1-р давхар, сүүлийн хаалга
  if(apts > 1) samples.push('1F-'+apts+'хаалга: ' + getAptLabel(scheme, 1, 1, apts, apts, seqStart, floors));
  // Дунд давхар
  const midF = Math.ceil(floors/2);
  samples.push(midF+'F-1хаалга: ' + getAptLabel(scheme, 1, midF, 1, apts, seqStart, floors));
  // Дээд давхар, сүүлийн хаалга
  samples.push(floors+'F-'+apts+'хаалга: ' + getAptLabel(scheme, entrances, floors, apts, apts, seqStart, floors));
  // Олон орцтой бол 2-р орц
  if(entrances > 1 && (scheme==='entrance_floor' || scheme==='sequential')) {
    samples.push('2-р орц 1F-1хаалга: ' + getAptLabel(scheme, 2, 1, 1, apts, seqStart, floors));
  }
  document.getElementById('bld-preview-sample').innerHTML = samples.map(s=>`<span style="margin-right:14px;font-variant-numeric:tabular-nums">${s}</span>`).join('');
}
