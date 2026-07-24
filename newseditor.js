// ============================================================
// МЭДЭЭ, МЭДЭЭЛЭЛ ЭДИТОР (newseditor.js) — Менежер/захирал (news.edit=1
// эрхтэй ажилтан) мэдээ бичих, засах, зурган/PDF байршуулах, паблиш хийх
// dashboard. RLS (Supabase) талд get_permission_level('news','edit')=1
// шаардсан тул, эрхгүй хүн API-аар шууд дуудсан ч бичих боломжгүй.
// Медиа файл: Supabase Storage bucket "news-media" руу шууд upload хийнэ
// (камерын зураг оруулах, десктоп/гар утас хоёуланд ажиллана).
// ============================================================

// ⚠️ 2026-07-24 нэмэв: Жагсаалтын огнооны баганыг "YYYY/MM/DD HH:MM:SS" форматтай болгов.
function _fmtNewsEditorDate(dateObj) {
  const p2 = n => String(n).padStart(2, '0');
  return `${dateObj.getFullYear()}/${p2(dateObj.getMonth() + 1)}/${p2(dateObj.getDate())} ${p2(dateObj.getHours())}:${p2(dateObj.getMinutes())}:${p2(dateObj.getSeconds())}`;
}

let _newsEditorPhotos = []; // {url, caption} — засварлаж буй нийтлэлийн зургууд (session-only)
let _newsEditorSavedRange = null;

// ⚠️ 2026-07-24 нэмэв: Текстийн өнгийг ЗӨВХӨН Хянах самбарын диаграмд (MV_COLORS,
// market-valuation.js) ашигладаг 6 өнгөөр хязгаарлав — чөлөөт өнгө сонголт үгүй.
const NEWS_EDITOR_COLORS = ['#E2E8F0', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
function _renderNewsEditorColorSwatches() {
  const el = document.getElementById('newseditor-color-swatches');
  if (!el || el.dataset.built) return;
  el.dataset.built = '1';
  el.innerHTML = NEWS_EDITOR_COLORS.map(c => `
    <button type="button" onmousedown="_saveNewsEditorSelection()" onclick="_restoreNewsEditorSelection(); document.execCommand('foreColor', false, '${c}')"
      style="width:22px;height:22px;border-radius:50%;background:${c};border:2px solid rgba(255,255,255,0.3);cursor:pointer;padding:0" title="${c}"></button>`).join('');
}

// ⚠️ 2026-07-24 нэмэв: <input type="color"> дээр дарахад contenteditable-ийн
// сонголт (selection) алга болдог (native picker нээгдэхэд focus шилждэг) тул,
// сонголтыг ТүүНИЙГ нээхийн ӨМНӨ хадгалж, өнгө сонгосны дараа сэргээж байж л
// execCommand('foreColor') зөв ажиллана.
function _saveNewsEditorSelection() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0) _newsEditorSavedRange = sel.getRangeAt(0).cloneRange();
}
function _restoreNewsEditorSelection() {
  if (!_newsEditorSavedRange) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(_newsEditorSavedRange);
}
function _newsEditorInsertLink() {
  const url = prompt('Холбоосын хаяг (URL):');
  if (!url) return;
  document.execCommand('createLink', false, url);
}
let _newsEditorPdfPath = null;
let _newsEditorEditingId = null; // null = шинэ нийтлэл үүсгэж байна

async function renderNewsEditorPage() {
  const el = document.getElementById('newseditor-list');
  if (!el) return;
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';
  const { data, error } = await sb.from('news_posts').select('*').order('created_at', { ascending: false });
  if (sbErr(error, 'Мэдээ ачаалах')) { el.innerHTML = '<div class="empty-state">Алдаа гарлаа (эрхээ шалгана уу)</div>'; return; }
  if (!data || !data.length) { el.innerHTML = '<div class="empty-state">Одоогоор мэдээ үүсгээгүй байна</div>'; return; }
  // ⚠️ 2026-07-24 засав: Хүснэгэлийн бүрэн дизайныг "Сууц өмчлөгчийн бүртгэл"
  // хуудастай ЯГ ижил болгов — overflow-x wrapper, thead-ийн background,
  // ТОМ үсэгтэй гарчиг, "үйлдэл" баганы нэр бүгд тэдгээртэй нийцүүлэв.
  el.innerHTML = `<div style="overflow-x:auto">
  <table class="data-table" style="min-width:900px">
    <thead>
      <tr style="background:rgba(11,26,46,0.8)">
        <th style="width:150px">ОГНОО</th>
        <th style="min-width:220px">ГАРЧИГ</th>
        <th style="width:110px">ТӨЛӨВ</th>
        <th style="width:90px">ОНЦЛОХ</th>
        <th style="width:90px">ШУУРХАЙ</th>
        <th style="width:80px">ПАБЛИК</th>
        <th style="width:70px">ҮЙЛДЭЛ</th>
      </tr>
    </thead>
    <tbody>${data.map(p => `
      <tr style="cursor:pointer" onclick="openNewsEditorForm(${p.id})">
        <td class="dt-mono">${esc(_fmtNewsEditorDate(new Date(p.created_at)))}</td>
        <td class="dt-title">${esc(p.title)}</td>
        <td>${p.status === 'published' ? '<span style="color:var(--success)">✓ Нийтлэгдсэн</span>' : '<span style="color:var(--text-muted)">Ноорог</span>'}</td>
        <td class="dt-text">${p.is_featured ? 'Тийм' : '—'}</td>
        <td class="dt-text">${p.is_breaking ? 'Тийм' : '—'}</td>
        <td class="dt-text">${p.is_public ? 'Тийм' : 'Үгүй'}</td>
        <td onclick="event.stopPropagation()"><div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" onclick="openNewsEditorForm(${p.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Засах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteNewsPost(${p.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--danger)" title="Устгах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </div></td>
      </tr>`).join('')}
    </tbody>
  </table>
  </div>`;
}

// ⚠️ 2026-07-24 нэмэв: NEWS_TOPICS нь news.js-д тодорхойлогдсон (script tag
// дараалал: news.js эхэлж, дараа нь newseditor.js ачаалагддаг тул давхардуулж
// бичихгүй, шууд дахин ашиглана).
function _populateNewsEditorTopicSelect() {
  const el = document.getElementById('newseditor-topic');
  if (!el || el.dataset.built) return;
  el.dataset.built = '1';
  el.innerHTML = NEWS_TOPICS.map(t => `<option value="${t.value}">${esc(t.label)}</option>`).join('');
}

function openNewsEditorForm(id) {
  _newsEditorEditingId = id || null;
  _newsEditorPhotos = [];
  _newsEditorPdfPath = null;
  document.getElementById('newseditor-list-view').style.display = 'none';
  document.getElementById('newseditor-form-view').style.display = '';
  // ⚠️ 2026-07-24 засав: Үүнийг тохируулаагүй бол Enter дарахад browser
  // үндсэндээ <p> биш <div> үүсгэдэг тул, ".news-body p" гэсэн CSS дүрэм
  // (justify/indent/зай) hэзээ ч хэрэгждэггүй байсан — яг үүнээс параграфын
  // формат бүхэлдээ орхигдож байв.
  document.execCommand('defaultParagraphSeparator', false, 'p');
  _renderNewsEditorColorSwatches();
  _populateNewsEditorTopicSelect();

  if (id) {
    sb.from('news_posts').select('*').eq('id', id).single().then(({ data, error }) => {
      if (sbErr(error, 'Нийтлэл ачаалах')) return;
      document.getElementById('newseditor-title').value = data.title || '';
      document.getElementById('newseditor-topic').value = data.topic || 'news';
      document.getElementById('newseditor-body').innerHTML = data.body || '';
      document.getElementById('newseditor-video').value = data.video_url || '';
      document.getElementById('newseditor-public').checked = !!data.is_public;
      document.getElementById('newseditor-featured').checked = !!data.is_featured;
      document.getElementById('newseditor-breaking').checked = !!data.is_breaking;
      _newsEditorPhotos = Array.isArray(data.photos) ? [...data.photos] : [];
      _newsEditorPdfPath = data.pdf_path || null;
      _renderNewsEditorPhotoList();
      _renderNewsEditorPdfStatus();
    });
  } else {
    document.getElementById('newseditor-title').value = '';
    document.getElementById('newseditor-topic').value = 'news';
    document.getElementById('newseditor-body').innerHTML = '';
    document.getElementById('newseditor-video').value = '';
    document.getElementById('newseditor-public').checked = false;
    document.getElementById('newseditor-featured').checked = false;
    document.getElementById('newseditor-breaking').checked = false;
    document.getElementById('newseditor-notify').checked = false;
    _renderNewsEditorPhotoList();
    _renderNewsEditorPdfStatus();
  }
}

function closeNewsEditorForm() {
  document.getElementById('newseditor-form-view').style.display = 'none';
  document.getElementById('newseditor-list-view').style.display = '';
  renderNewsEditorPage();
}

// ------------------------------------------------------------
// ЗУРАГ БАЙРШУУЛАХ — Камер эсвэл файл сангаас (десктоп/гар утас хоёуланд
// адилхан ажиллана, "capture" attribute нь мобайл дээр камер шууд нээнэ)
// ------------------------------------------------------------
async function onNewsPhotoFilesSelected(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  toast(`${files.length} зураг байршуулж байна...`, 'success');
  for (const file of files) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await sb.storage.from('news-media').upload(path, file, { upsert: false });
    if (upErr) { toast('Зураг байршуулахад алдаа: ' + upErr.message, 'error'); continue; }
    const { data: pub } = sb.storage.from('news-media').getPublicUrl(path);
    _newsEditorPhotos.push({ url: pub.publicUrl, caption: '' });
  }
  _renderNewsEditorPhotoList();
  input.value = '';
}

function _renderNewsEditorPhotoList() {
  const el = document.getElementById('newseditor-photo-list');
  if (!el) return;
  if (!_newsEditorPhotos.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">Зураг алга</div>'; return; }
  el.innerHTML = _newsEditorPhotos.map((p, i) => `
    <div class="flex gap-8" style="align-items:center;margin-bottom:6px">
      <img src="${esc(p.url)}" style="width:56px;height:42px;object-fit:cover;border-radius:4px;border:1px solid var(--border)">
      <input type="text" placeholder="Тайлбар..." value="${esc(p.caption)}" oninput="_newsEditorPhotos[${i}].caption=this.value" style="flex:1">
      <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="_removeNewsPhoto(${i})">✕</button>
    </div>`).join('');
}
function _removeNewsPhoto(i) { _newsEditorPhotos.splice(i, 1); _renderNewsEditorPhotoList(); }

// ------------------------------------------------------------
// PDF БАЙРШУУЛАХ
// ------------------------------------------------------------
async function onNewsPdfFileSelected(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  toast('PDF байршуулж байна...', 'success');
  const path = `pdf/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const { error: upErr } = await sb.storage.from('news-media').upload(path, file, { upsert: false });
  if (upErr) { toast('PDF байршуулахад алдаа: ' + upErr.message, 'error'); return; }
  const { data: pub } = sb.storage.from('news-media').getPublicUrl(path);
  _newsEditorPdfPath = pub.publicUrl;
  _renderNewsEditorPdfStatus();
  input.value = '';
}
function _renderNewsEditorPdfStatus() {
  const el = document.getElementById('newseditor-pdf-status');
  if (!el) return;
  el.innerHTML = _newsEditorPdfPath
    ? `<a href="${esc(_newsEditorPdfPath)}" target="_blank" rel="noopener">📄 PDF харах</a> <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="_newsEditorPdfPath=null;_renderNewsEditorPdfStatus()">✕</button>`
    : '<span style="font-size:12px;color:var(--text-muted)">PDF алга</span>';
}

// ------------------------------------------------------------
// ХАДГАЛАХ (ноорог / паблиш)
// ------------------------------------------------------------
async function saveNewsPost(publish) {
  const title = document.getElementById('newseditor-title').value.trim();
  const topic = document.getElementById('newseditor-topic').value;
  const body = document.getElementById('newseditor-body').innerHTML.trim();
  const videoUrl = document.getElementById('newseditor-video').value.trim();
  const isPublic = document.getElementById('newseditor-public').checked;
  const isFeatured = document.getElementById('newseditor-featured').checked;
  const isBreaking = document.getElementById('newseditor-breaking').checked;
  const notify = document.getElementById('newseditor-notify').checked;
  if (!title || !body) { toast('Гарчиг болон агуулгыг бөглөнө vv', 'error'); return; }

  const row = {
    title, topic, body,
    video_url: videoUrl || null,
    pdf_path: _newsEditorPdfPath,
    photos: _newsEditorPhotos,
    is_public: isPublic,
    is_featured: isFeatured,
    is_breaking: isBreaking,
    status: publish ? 'published' : 'draft',
  };
  if (publish) row.published_at = new Date().toISOString();

  let res;
  if (_newsEditorEditingId) {
    res = await sb.from('news_posts').update(row).eq('id', _newsEditorEditingId);
  } else {
    row.created_by = currentUser?.id || null;
    res = await sb.from('news_posts').insert(row);
  }
  if (sbErr(res.error, 'Мэдээ хадгалах')) return;

  toast(publish ? 'Мэдээ нийтлэгдлээ ✓' : 'Ноорог хадгалагдлаа ✓', 'success');
  logActivity(_newsEditorEditingId ? 'edit' : 'add', 'news', _newsEditorEditingId || null, title);

  if (publish && notify) {
    // ⚠️ Автоматаар илгээхгүй — "Зар мэдэгдэл илгээх" хуудсанд гарчиг/агуулгыг
    // урьдчилан бөглөөд шилжүүлнэ, ажилтан өөрөө хүлээн авагч/сувгаа сонгоод,
    // эцсийн шатанд өөрөө "Илгээх" дарна (бусад мэдэгдэлтэй адил зарчим).
    showPage('communications');
    setTimeout(() => {
      const catEl = document.getElementById('notif-category');
      const titleEl = document.getElementById('notif-title-input');
      const contentEl = document.getElementById('notif-content');
      if (catEl) catEl.value = 'announcement';
      if (titleEl) titleEl.value = title;
      if (contentEl) {
        const plainText = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        contentEl.value = plainText.length > 200 ? plainText.slice(0, 200) + '...' : plainText;
      }
      toast('Мэдэгдлийн гарчиг/агуулга автоматаар бөглөгдлөө — хүлээн авагч, сувгаа сонгоод илгээнэ vv', 'success');
    }, 100);
  } else {
    closeNewsEditorForm();
  }
}

async function deleteNewsPost(id) {
  if (!confirm('Энэ мэдээг бүрмөсөн устгах уу?')) return;
  const { error } = await sb.from('news_posts').delete().eq('id', id);
  if (sbErr(error, 'Мэдээ устгах')) return;
  toast('Устгагдлаа ✓', 'success');
  logActivity('delete', 'news', id, null);
  renderNewsEditorPage();
}
