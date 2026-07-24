// ============================================================
// МЭДЭЭ, МЭДЭЭЛЭЛ (news.js) — Нэвтэрсэн хэрэглэгч (Админ/Ажилтан/Оршин
// суугч/ААН) бүгд хамтдаа ЗӨВХӨН PUBLISHED мэдээг үзнэ (RLS-ээр хамгаалагдсан,
// шү "editors_read_drafts" бодлоготой эрхтэй хүн draft-ыг ч үзнэ).
// Дизайн логик (текст хумих/дэлгэх, зургийн альбом+лайтбокс) нь хэрэглэгчийн
// dorjzodov.mn/news.html дээрх бодит бүтээгдэхүүнээс зөвшөөрөгдсөнөөр авав —
// зүгээр л suh.html-ийн харанхуй theme-д тааруулсан (var(--bg-card) гэх мэт),
// Lenis (гүйлгэх сан) ашиглаагүй тул тэдгээр эвент дуудлагыг хассан.
// Медиа файл (зураг/PDF): GitHub repo root-ийн "newsmedia/" фолдерт ажилтан
// гараараа байрлуулж, эдитор дотор зам+тайлбарыг тэмдэглэдэг.
// ============================================================

// ⚠️ 2026-07-24 нэмэв: Мэдээний картны огноог "YYYY.MM.DD Гариг, HH:MM:SS"
// форматаар харуулна (жиш нь "2026.07.24 Баасан гариг, 21:23:37").
const NEWS_WEEKDAY_NAMES = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];
function _fmtNewsCardDate(dateObj) {
  const p2 = n => String(n).padStart(2, '0');
  const weekday = NEWS_WEEKDAY_NAMES[dateObj.getDay()];
  return `${dateObj.getFullYear()}.${p2(dateObj.getMonth() + 1)}.${p2(dateObj.getDate())} ${weekday} гариг, ${p2(dateObj.getHours())}:${p2(dateObj.getMinutes())}:${p2(dateObj.getSeconds())}`;
}

async function renderNewsPage() {
  const el = document.getElementById('news-list');
  if (!el) return;
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';
  const { data, error } = await sb.from('news_posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  if (sbErr(error, 'Мэдээ ачаалах')) { el.innerHTML = '<div class="empty-state">Алдаа гарлаа</div>'; return; }
  if (!data || !data.length) { el.innerHTML = '<div class="empty-state">Одоогоор мэдээ алга</div>'; return; }
  el.innerHTML = data.map(p => _renderNewsCard(p)).join('');
  _initNewsInteractivity();
}

function _renderNewsCard(p) {
  const dateStr = p.published_at ? _fmtNewsCardDate(new Date(p.published_at)) : '';
  const photos = Array.isArray(p.photos) ? p.photos : [];
  const badges = `${p.is_breaking ? '<span style="background:var(--danger);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-right:6px">ШУУРХАЙ</span>' : ''}${p.is_featured ? '<span style="background:var(--accent);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">ОНЦЛОХ</span>' : ''}`;
  return `
  <div class="card news-card" style="padding:18px;margin-bottom:16px">
    ${badges ? `<div style="margin-bottom:8px">${badges}</div>` : ''}
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${esc(dateStr)}</div>
    <h3 style="font-size:16px;margin:0 0 10px;color:var(--text);text-transform:uppercase;line-height:1.3">${esc(p.title)}</h3>
    <div class="news-text-wrapper news-truncated news-body">${p.body}</div>
    <span class="news-toggle-btn" onclick="toggleNewsText(this)" style="display:none;color:var(--accent);cursor:pointer;font-size:12px;user-select:none">Дэлгэрэнгүй...</span>

    ${p.video_url ? `
    <div class="news-video-container" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin-top:12px;background:#000;border:1px solid var(--border);border-radius:6px">
      <iframe src="${esc(p.video_url)}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allowfullscreen title="Видео"></iframe>
    </div>` : ''}

    ${photos.length ? `
    <div class="news-smart-grid" data-photos='${esc(JSON.stringify(photos))}' style="display:grid;grid-template-columns:repeat(auto-fit,minmax(calc(50% - 5px),1fr));gap:4px;width:100%;margin-top:12px"></div>` : ''}

    ${p.pdf_path ? `
    <div style="margin-top:12px">
      <a href="${esc(p.pdf_path)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">📄 PDF харах</a>
    </div>` : ''}
  </div>`;
}

// ------------------------------------------------------------
// ТЕКСТ ХУМИХ/ДЭЛГЭХ (эх загвараас: 4 мөрөөр хумиад, шаардлагатай үед л
// товчийг харуулна — scrollHeight > clientHeight шалгалт)
// ------------------------------------------------------------
function _initNewsTextToggles() {
  document.querySelectorAll('.news-text-wrapper').forEach(wrapper => {
    const button = wrapper.nextElementSibling;
    if (!button || !button.classList.contains('news-toggle-btn')) return;
    // ⚠️ line-clamp CSS-г эндээс динамикаар (inline) тохируулна, тусдаа <style>
    // тодорхойлолт нэмэхгүйгээр — module-ийн бүх зүйлийг нэг файлд байлгахын тулд.
    wrapper.style.display = '-webkit-box';
    wrapper.style.webkitBoxOrient = 'vertical';
    wrapper.style.webkitLineClamp = '4';
    wrapper.style.overflow = 'hidden';
    if (wrapper.scrollHeight > wrapper.clientHeight) {
      button.style.display = 'inline-block';
    } else {
      button.style.display = 'none';
    }
  });
}
function toggleNewsText(button) {
  const wrapper = button.previousElementSibling;
  const isTruncated = wrapper.style.webkitLineClamp !== 'unset' && wrapper.style.webkitLineClamp !== '';
  if (isTruncated) {
    wrapper.style.webkitLineClamp = 'unset';
    wrapper.style.overflow = 'visible';
    button.textContent = 'Хураангуй';
  } else {
    wrapper.style.webkitLineClamp = '4';
    wrapper.style.overflow = 'hidden';
    button.textContent = 'Дэлгэрэнгүй...';
  }
}

// ------------------------------------------------------------
// ЗУРГИЙН АЛЬБОМ ГРИД + ЛАЙТБОКС (эх загвараас бүрэн зөвшөөрөгдсөн, Lenis-гүй)
// ------------------------------------------------------------
let _newsAlbumItems = [];
let _newsActiveIndex = 0;

function _initNewsSmartGrids() {
  document.querySelectorAll('.news-smart-grid').forEach(gridEl => {
    if (gridEl.dataset.built) return; // давхар барихаас сэргийлнэ
    gridEl.dataset.built = '1';
    let items;
    try { items = JSON.parse(gridEl.dataset.photos); } catch (e) { items = []; }
    const totalCount = items.length;
    const displayCount = Math.min(totalCount, 2);
    for (let i = 0; i < displayCount; i++) {
      const media = items[i];
      const itemDiv = document.createElement('div');
      itemDiv.style.cssText = 'position:relative;background:rgba(0,0,0,0.3);border-radius:4px;overflow:hidden;border:1px solid var(--border);width:100%;aspect-ratio:4/3;cursor:pointer';
      itemDiv.innerHTML = `<img src="${esc(media.url)}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:top">`;
      if (totalCount > 2 && i === 1) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:600;color:#fff;pointer-events:none';
        overlay.innerText = `+${totalCount - 1}`;
        itemDiv.appendChild(overlay);
      }
      itemDiv.addEventListener('click', () => { _newsAlbumItems = items; _openNewsLightbox(i); });
      gridEl.appendChild(itemDiv);
    }
  });
}

function _renderNewsActiveMedia(index) {
  const modalContent = document.getElementById('news-modal-content');
  const modalCaption = document.getElementById('news-modal-caption');
  const btnPrev = document.getElementById('news-modal-prev');
  const btnNext = document.getElementById('news-modal-next');
  modalContent.innerHTML = '';
  const data = _newsAlbumItems[index];
  modalCaption.textContent = data.caption || '';
  const img = document.createElement('img');
  img.src = data.url;
  img.style.cssText = 'max-width:100%;max-height:80vh;object-fit:contain;user-select:none';
  modalContent.appendChild(img);
  const showNav = _newsAlbumItems.length > 1;
  btnPrev.style.display = showNav ? 'flex' : 'none';
  btnNext.style.display = showNav ? 'flex' : 'none';
}
function _openNewsLightbox(index) {
  _newsActiveIndex = index;
  _renderNewsActiveMedia(index);
  document.getElementById('news-modal-overlay').classList.add('active');
}
function _closeNewsLightbox() {
  document.getElementById('news-modal-overlay').classList.remove('active');
  document.getElementById('news-modal-content').innerHTML = '';
}
function _newsNavPrev() {
  if (_newsAlbumItems.length <= 1) return;
  _newsActiveIndex = (_newsActiveIndex - 1 + _newsAlbumItems.length) % _newsAlbumItems.length;
  _renderNewsActiveMedia(_newsActiveIndex);
}
function _newsNavNext() {
  if (_newsAlbumItems.length <= 1) return;
  _newsActiveIndex = (_newsActiveIndex + 1) % _newsAlbumItems.length;
  _renderNewsActiveMedia(_newsActiveIndex);
}

// Модал HTML-ыг нэг удаа body-д хийж, дараа нь дахин ашиглана (лениш вэ)
function _ensureNewsLightboxModal() {
  if (document.getElementById('news-modal-overlay')) return;
  const div = document.createElement('div');
  div.id = 'news-modal-overlay';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(12px);z-index:9999;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .25s ease';
  div.innerHTML = `
    <style>#news-modal-overlay.active{opacity:1!important;pointer-events:auto!important}</style>
    <div id="news-modal-container" style="width:80%;max-width:100vw;position:relative;display:flex;flex-direction:column;align-items:center">
      <button id="news-modal-close" style="position:absolute;top:-42px;right:0;background:none;border:none;color:rgba(255,255,255,0.7);font-size:32px;cursor:pointer">&times;</button>
      <div id="news-modal-prev" style="position:absolute;left:-70px;top:50%;transform:translateY(-50%);width:50px;height:90px;display:none;align-items:center;justify-content:center;cursor:pointer">
        <div style="width:14px;height:14px;border-top:3px solid rgba(255,255,255,0.6);border-left:3px solid rgba(255,255,255,0.6);transform:rotate(-45deg)"></div>
      </div>
      <div id="news-modal-next" style="position:absolute;right:-70px;top:50%;transform:translateY(-50%);width:50px;height:90px;display:none;align-items:center;justify-content:center;cursor:pointer">
        <div style="width:14px;height:14px;border-top:3px solid rgba(255,255,255,0.6);border-left:3px solid rgba(255,255,255,0.6);transform:rotate(135deg)"></div>
      </div>
      <div id="news-modal-content" style="width:100%;display:flex;justify-content:center;align-items:center;border-radius:10px;overflow:hidden"></div>
      <div id="news-modal-caption" style="margin-top:12px;color:#fff;font-size:12.5px;text-align:center;padding:0 10px"></div>
    </div>`;
  document.body.appendChild(div);

  document.getElementById('news-modal-close').addEventListener('click', _closeNewsLightbox);
  div.addEventListener('click', (e) => { if (e.target === div || e.target.id === 'news-modal-container') _closeNewsLightbox(); });
  document.getElementById('news-modal-prev').addEventListener('click', (e) => { e.stopPropagation(); _newsNavPrev(); });
  document.getElementById('news-modal-next').addEventListener('click', (e) => { e.stopPropagation(); _newsNavNext(); });
  document.addEventListener('keydown', (e) => {
    if (!div.classList.contains('active')) return;
    if (e.key === 'Escape') _closeNewsLightbox();
    if (e.key === 'ArrowLeft') _newsNavPrev();
    if (e.key === 'ArrowRight') _newsNavNext();
  });

  // ГАР УТАС: доош чирж хаах, зүүн/баруун swipe-ээр зураг солих
  let touchStartX = 0, touchStartY = 0, touchCurX = 0, touchCurY = 0, dragging = false;
  const container = document.getElementById('news-modal-container');
  div.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
    touchCurX = touchStartX; touchCurY = touchStartY; dragging = true;
    container.style.transition = 'none';
  }, { passive: true });
  div.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    touchCurX = e.touches[0].clientX; touchCurY = e.touches[0].clientY;
    const dy = touchCurY - touchStartY, dx = touchCurX - touchStartX;
    if (dy > 0 && Math.abs(dy) > Math.abs(dx)) container.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  div.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    container.style.transition = 'transform .2s cubic-bezier(0.175,0.885,0.32,1.275)';
    const dx = touchCurX - touchStartX, dy = touchCurY - touchStartY;
    if (dy > 110 && Math.abs(dy) > Math.abs(dx)) { _closeNewsLightbox(); return; }
    container.style.transform = 'none';
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 55) { dx > 0 ? _newsNavPrev() : _newsNavNext(); }
  });
}

function _initNewsInteractivity() {
  _ensureNewsLightboxModal();
  _initNewsTextToggles();
  _initNewsSmartGrids();
}
