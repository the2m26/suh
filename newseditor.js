// ============================================================
// МЭДЭЭ, МЭДЭЭЛЭЛ ЭДИТОР (newseditor.js) — Менежер/захирал (news.edit=1
// эрхтэй ажилтан) мэдээ бичих, засах, зурган/PDF байршуулах, паблиш хийх
// dashboard. RLS (Supabase) талд get_permission_level('news','edit')=1
// шаардсан тул, эрхгүй хүн API-аар шууд дуудсан ч бичих боломжгүй.
// Медиа файл: Supabase Storage bucket "news-media" руу шууд upload хийнэ
// (камерын зураг оруулах, десктоп/гар утас хоёуланд ажиллана).
// ============================================================

let _newsEditorPhotos = []; // {url, caption} — засварлаж буй нийтлэлийн зургууд (session-only)
let _newsEditorPdfPath = null;
let _newsEditorEditingId = null; // null = шинэ нийтлэл үүсгэж байна

async function renderNewsEditorPage() {
  const el = document.getElementById('newseditor-list');
  if (!el) return;
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';
  const { data, error } = await sb.from('news_posts').select('*').order('created_at', { ascending: false });
  if (sbErr(error, 'Мэдээ ачаалах')) { el.innerHTML = '<div class="empty-state">Алдаа гарлаа (эрхээ шалгана уу)</div>'; return; }
  if (!data || !data.length) { el.innerHTML = '<div class="empty-state">Одоогоор мэдээ үүсгээгүй байна</div>'; return; }
  el.innerHTML = `<table class="data-table">
    <thead><tr><th>Гарчиг</th><th>Төлөв</th><th>Паблик</th><th>Огноо</th><th></th></tr></thead>
    <tbody>${data.map(p => `
      <tr>
        <td class="dt-title">${esc(p.title)}</td>
        <td>${p.status === 'published' ? '<span style="color:var(--success)">✓ Нийтлэгдсэн</span>' : '<span style="color:var(--text-muted)">Ноорог</span>'}</td>
        <td class="dt-text">${p.is_public ? 'Тийм' : 'Үгүй'}</td>
        <td class="dt-mono">${esc(new Date(p.created_at).toLocaleDateString('mn-MN'))}</td>
        <td class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="openNewsEditorForm(${p.id})">Засах</button>
          <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="deleteNewsPost(${p.id})">Устгах</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function openNewsEditorForm(id) {
  _newsEditorEditingId = id || null;
  _newsEditorPhotos = [];
  _newsEditorPdfPath = null;
  document.getElementById('newseditor-list-view').style.display = 'none';
  document.getElementById('newseditor-form-view').style.display = '';

  if (id) {
    sb.from('news_posts').select('*').eq('id', id).single().then(({ data, error }) => {
      if (sbErr(error, 'Нийтлэл ачаалах')) return;
      document.getElementById('newseditor-title').value = data.title || '';
      document.getElementById('newseditor-body').value = data.body || '';
      document.getElementById('newseditor-video').value = data.video_url || '';
      document.getElementById('newseditor-public').checked = !!data.is_public;
      _newsEditorPhotos = Array.isArray(data.photos) ? [...data.photos] : [];
      _newsEditorPdfPath = data.pdf_path || null;
      _renderNewsEditorPhotoList();
      _renderNewsEditorPdfStatus();
    });
  } else {
    document.getElementById('newseditor-title').value = '';
    document.getElementById('newseditor-body').value = '';
    document.getElementById('newseditor-video').value = '';
    document.getElementById('newseditor-public').checked = false;
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
  const body = document.getElementById('newseditor-body').value.trim();
  const videoUrl = document.getElementById('newseditor-video').value.trim();
  const isPublic = document.getElementById('newseditor-public').checked;
  const notify = document.getElementById('newseditor-notify').checked;
  if (!title || !body) { toast('Гарчиг болон агуулгыг бөглөнө vv', 'error'); return; }

  const row = {
    title, body,
    video_url: videoUrl || null,
    pdf_path: _newsEditorPdfPath,
    photos: _newsEditorPhotos,
    is_public: isPublic,
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
      if (contentEl) contentEl.value = body.length > 200 ? body.slice(0, 200) + '...' : body;
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
