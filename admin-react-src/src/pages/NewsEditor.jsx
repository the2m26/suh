import { useCallback, useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { NEWS_TOPICS, newsTopicLabel, NEWS_SANITIZE_CONFIG } from '../lib/newsHelpers';
import { deleteNewsMediaByUrl, uploadNewsPhoto, uploadNewsPdf } from '../lib/newsMediaStorage';
import { triggerPushForRecipients, logActivity } from '../lib/dbUtils';
import DOMPurify from 'dompurify';

const NEWS_EDITOR_COLORS = ['#E2E8F0', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function sanitizeNewsBody(html) {
  return DOMPurify.sanitize(html || '', NEWS_SANITIZE_CONFIG);
}

function fmtNewsEditorDate(dateObj) {
  const p2 = (n) => String(n).padStart(2, '0');
  return `${dateObj.getFullYear()}/${p2(dateObj.getMonth() + 1)}/${p2(dateObj.getDate())} ${p2(dateObj.getHours())}:${p2(dateObj.getMinutes())}:${p2(dateObj.getSeconds())}`;
}

export default function NewsEditor() {
  const { currentUser, currentProfile } = useAuth();
  const { canAdd, canWrite, canDelete } = usePermissions();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topicFilter, setTopicFilter] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'form-new' | 'form-<id>'

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb.from('news_posts').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Мэдээ ачаалах алдаа:', error.message); setLoading(false); return; }
    setPosts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = topicFilter ? posts.filter((p) => p.topic === topicFilter) : posts;

  return (
    <div className="page page-wide">
      {view === 'list' ? (
        <NewsEditorList
          posts={filtered}
          topicFilter={topicFilter}
          setTopicFilter={setTopicFilter}
          loading={loading}
          canAdd={canAdd('newseditor')}
          canWrite={canWrite('newseditor')}
          canDelete={canDelete('newseditor')}
          onAdd={() => setView('form-new')}
          onEdit={(id) => setView('form-' + id)}
          onReload={load}
        />
      ) : (
        <NewsEditorForm
          postId={view === 'form-new' ? null : Number(view.slice(5))}
          currentUser={currentUser}
          currentProfile={currentProfile}
          canAdd={canAdd('newseditor')}
          canWrite={canWrite('newseditor')}
          onClose={() => { setView('list'); load(); }}
        />
      )}
    </div>
  );
}

function NewsEditorList({ posts, topicFilter, setTopicFilter, loading, canAdd, canWrite, canDelete, onAdd, onEdit, onReload }) {
  async function handleDelete(id) {
    if (!canDelete) return;
    if (!confirm('Энэ мэдээг бүрмөсөн устгах уу?')) return;
    const { data: post } = await sb.from('news_posts').select('title, photos, pdf_path').eq('id', id).single();
    const { error } = await sb.from('news_posts').delete().eq('id', id);
    if (error) { console.error('Мэдээ устгах алдаа:', error.message); return; }
    if (post) {
      const photos = Array.isArray(post.photos) ? post.photos : [];
      for (const p of photos) await deleteNewsMediaByUrl(p.url);
      if (post.pdf_path) await deleteNewsMediaByUrl(post.pdf_path);
    }
    onReload();
  }

  return (
    <>
      <div className="page-header-row">
        {canAdd && <button className="btn-primary" onClick={onAdd}>+ Шинэ мэдээ</button>}
      </div>
      <select className="news-topic-filter" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
        <option value="">Бүгдийг харах</option>
        {NEWS_TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      {loading && <div className="empty-state">Ачаалж байна...</div>}
      {!loading && !posts.length && <div className="empty-state">Одоогоор мэдээ үүсгээгүй байна</div>}
      {!loading && posts.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>ОГНОО</th><th>АНГИЛАЛ</th><th>ГАРЧИГ</th><th>ТӨЛӨВ</th>
                <th>ОНЦЛОХ</th><th>ШУУРХАЙ</th><th>ПАБЛИК</th><th>үЙЛДЭЛ</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} onClick={() => onEdit(p.id)}>
                  <td className="dt-mono">{fmtNewsEditorDate(new Date(p.created_at))}</td>
                  <td>{newsTopicLabel(p.topic) || '—'}</td>
                  <td className="dt-title">{p.title}</td>
                  <td>{p.status === 'published' ? <span className="status-ok">✓ Нийтлэгдсэн</span> : <span className="status-muted">Ноорог</span>}</td>
                  <td>{p.is_featured ? 'Тийм' : '—'}</td>
                  <td>{p.is_breaking ? 'Тийм' : '—'}</td>
                  <td>{p.is_public ? 'Тийм' : 'Үгүй'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {canWrite && <button className="btn-ghost-sm" onClick={() => onEdit(p.id)} title="Засах">✎</button>}
                    {canDelete && <button className="btn-ghost-sm danger" onClick={() => handleDelete(p.id)} title="Устгах">✕</button>}
                    {!canWrite && !canDelete && <span className="dt-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function NewsEditorForm({ postId, currentUser, currentProfile, canAdd, canWrite, onClose }) {
  const bodyRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('news');
  const [videoUrl, setVideoUrl] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isBreaking, setIsBreaking] = useState(false);
  const [photos, setPhotos] = useState([]); // {url, caption}
  const [pdfPath, setPdfPath] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const allowed = postId ? canWrite : canAdd;

  useEffect(() => {
    if (!postId) return;
    sb.from('news_posts').select('*').eq('id', postId).single().then(({ data, error }) => {
      if (error || !data) { console.error('Нийтлэл ачаалах алдаа:', error?.message); return; }
      setTitle(data.title || '');
      setTopic(data.topic || 'news');
      if (bodyRef.current) bodyRef.current.innerHTML = data.body || '';
      setVideoUrl(data.video_url || '');
      setIsPublic(!!data.is_public);
      setIsFeatured(!!data.is_featured);
      setIsBreaking(!!data.is_breaking);
      setPhotos(Array.isArray(data.photos) ? [...data.photos] : []);
      setPdfPath(data.pdf_path || null);
    });
  }, [postId]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    document.execCommand('defaultParagraphSeparator', false, 'p');
    function onPaste(e) {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (!text) return;
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const html = text.split(/\r\n|\r|\n/).map((line) => `<p>${esc(line) || '<br>'}</p>`).join('');
      document.execCommand('insertHTML', false, html);
    }
    el.addEventListener('paste', onPaste);
    return () => el.removeEventListener('paste', onPaste);
  }, []);

  function saveSelection() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  }
  function restoreSelection() {
    if (!savedRangeRef.current) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
  }
  function applyColor(c) {
    restoreSelection();
    document.execCommand('foreColor', false, c);
  }
  function insertLink() {
    const url = prompt('Холбоосын хаяг (URL):');
    if (!url) return;
    document.execCommand('createLink', false, url);
  }

  async function handlePhotoFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingPhotos(true);
    const next = [...photos];
    for (const file of files) {
      try {
        const url = await uploadNewsPhoto(file);
        next.push({ url, caption: '' });
      } catch (err) {
        console.error('Зураг байршуулахад алдаа:', err.message);
      }
    }
    setPhotos(next);
    setUploadingPhotos(false);
    e.target.value = '';
  }

  async function removePhoto(i) {
    const removed = photos[i];
    setPhotos(photos.filter((_, idx) => idx !== i));
    if (removed) await deleteNewsMediaByUrl(removed.url);
  }

  async function handlePdfFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadingPdf(true);
    const oldPath = pdfPath;
    try {
      const url = await uploadNewsPdf(file);
      setPdfPath(url);
      if (oldPath) await deleteNewsMediaByUrl(oldPath);
    } catch (err) {
      console.error('PDF байршуулахад алдаа:', err.message);
    }
    setUploadingPdf(false);
    e.target.value = '';
  }

  async function removePdf() {
    const removed = pdfPath;
    setPdfPath(null);
    if (removed) await deleteNewsMediaByUrl(removed);
  }

  async function handleSave(publish) {
    if (!allowed) return;
    const trimmedTitle = title.trim();
    const body = sanitizeNewsBody((bodyRef.current?.innerHTML || '').trim());
    if (!trimmedTitle || !body) { alert('Гарчиг болон агуулгыг бөглөнө vv'); return; }

    setSaving(true);
    const row = {
      title: trimmedTitle, topic, body,
      video_url: videoUrl.trim() || null,
      pdf_path: pdfPath,
      photos,
      is_public: isPublic,
      is_featured: isFeatured,
      is_breaking: isBreaking,
      status: publish ? 'published' : 'draft',
    };
    if (publish) row.published_at = new Date().toISOString();

    let res;
    if (postId) {
      res = await sb.from('news_posts').update(row).eq('id', postId);
    } else {
      row.created_by = currentUser?.id || null;
      res = await sb.from('news_posts').insert(row);
    }
    setSaving(false);
    if (res.error) { console.error('Мэдээ хадгалах алдаа:', res.error.message); alert('Хадгалахад алдаа гарлаа'); return; }

    await logActivity(currentUser, currentProfile, postId ? 'edit' : 'add', 'news', postId || null, trimmedTitle);

    if (publish) {
      const { data: allResidents } = await sb.from('residents').select('apt');
      const plainText = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const snippet = plainText.length > 120 ? plainText.slice(0, 120) + '...' : plainText;
      const recipients = (allResidents || []).map((r) => ({ apt: r.apt, content: snippet }));
      await triggerPushForRecipients(recipients, trimmedTitle);
    }
    onClose();
  }

  if (!allowed) {
    return <div className="empty-state">Танд энэ үйлдлийг хийх эрх байхгүй байна.</div>;
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row">
        <h2>{postId ? 'Мэдээ засах' : 'Шинэ мэдээ'}</h2>
        <button className="btn-ghost" onClick={onClose}>← Буцах</button>
      </div>

      <label className="field">
        <span>Гарчиг</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="field">
        <span>Ангилал</span>
        <select value={topic} onChange={(e) => setTopic(e.target.value)}>
          {NEWS_TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>

      <div className="field">
        <span>Агуулга</span>
        <div className="editor-toolbar">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => document.execCommand('bold')}><b>Ж</b></button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => document.execCommand('italic')}><i>Ж</i></button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => document.execCommand('underline')}><u>Ж</u></button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={insertLink}>🔗</button>
          {NEWS_EDITOR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="color-swatch"
              style={{ background: c }}
              onMouseDown={saveSelection}
              onClick={() => applyColor(c)}
              title={c}
            />
          ))}
        </div>
        <div ref={bodyRef} className="news-editor-body" contentEditable suppressContentEditableWarning />
      </div>

      <label className="field">
        <span>Видео холбоос (embed URL)</span>
        <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." />
      </label>

      <div className="field-row">
        <label><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Паблик</label>
        <label><input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> Онцлох</label>
        <label><input type="checkbox" checked={isBreaking} onChange={(e) => setIsBreaking(e.target.checked)} /> Шуурхай</label>
      </div>

      <div className="field">
        <span>Зураг</span>
        <input type="file" accept="image/*" multiple onChange={handlePhotoFiles} disabled={uploadingPhotos} />
        {photos.length === 0 && <div className="dt-muted">Зураг алга</div>}
        {photos.map((p, i) => (
          <div key={i} className="photo-row">
            <img src={p.url} alt="" />
            <input
              type="text"
              placeholder="Тайлбар..."
              value={p.caption}
              onChange={(e) => setPhotos(photos.map((ph, idx) => idx === i ? { ...ph, caption: e.target.value } : ph))}
            />
            <button type="button" className="btn-ghost-sm danger" onClick={() => removePhoto(i)}>✕</button>
          </div>
        ))}
      </div>

      <div className="field">
        <span>PDF</span>
        <input type="file" accept="application/pdf" onChange={handlePdfFile} disabled={uploadingPdf} />
        {pdfPath ? (
          <div className="pdf-row">
            <a href={pdfPath} target="_blank" rel="noopener noreferrer">📄 PDF харах</a>
            <button type="button" className="btn-ghost-sm danger" onClick={removePdf}>✕</button>
          </div>
        ) : <div className="dt-muted">PDF алга</div>}
      </div>

      <div className="form-actions">
        <button className="btn-outline" disabled={saving} onClick={() => handleSave(false)}>Ноорог хадгалах</button>
        <button className="btn-primary" disabled={saving} onClick={() => handleSave(true)}>Нийтлэх</button>
      </div>
    </div>
  );
}
