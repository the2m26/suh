import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';
import DOMPurify from 'dompurify';

// Топик (10 ангилал) — Мэдээ, мэдээлэл шүүлтүүрт ашиглана
const TOPICS = [
  { value: 'news', label: 'Мэдээ' },
  { value: 'uz', label: 'Удирдах зөвлөлийн шийдвэр' },
  { value: 'hz', label: 'Хяналтын зөвлөлийн шийдвэр' },
  { value: 'gz', label: 'Гүйцэтгэх захирлын шийдвэр' },
  { value: 'progress', label: 'Явцын тайлан' },
  { value: 'rules', label: 'Дүрэм, журам' },
  { value: 'assembly', label: 'Бүх гишүүдийн хурал' },
  { value: 'election', label: 'Сонгууль, санал асуулга' },
  { value: 'phone', label: 'Хэрэгцээт утас' },
  { value: 'jobs', label: 'Ажлын зар' },
];
const WEEKDAYS = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['p', 'div', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'font', 'span', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'target', 'color'],
  ALLOW_DATA_ATTR: false,
};

function fmtNewsDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${WEEKDAYS[d.getDay()]} гариг`;
}
function topicLabel(value) { return TOPICS.find(t => t.value === value)?.label || ''; }
function getViewedIds() {
  try { return new Set(JSON.parse(localStorage.getItem('suh_news_viewed_ids') || '[]')); }
  catch { return new Set(); }
}

// 2+ зурагтай үед grid+lightbox-той харагдана ("+N" overlay)
function NewsPhotoGrid({ photos, onOpen }) {
  const n = Math.min(photos.length, 2);
  return (
    <div className="news-photo-grid">
      {photos.slice(0, n).map((p, i) => (
        <div key={i} className="news-photo-item" onClick={() => onOpen(i)}>
          <img src={p.url} alt="" />
          {photos.length > 2 && i === 1 && <div className="news-photo-overlay">+{photos.length - 1}</div>}
        </div>
      ))}
    </div>
  );
}

// Rich HTML агуулгыг DOMPurify-аар цэвэрлэж харуулна, 4 мөрөөс урт бол хумина
function NewsBody({ html }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const clean = DOMPurify.sanitize(html || '', SANITIZE_CONFIG);
  useEffect(() => {
    if (ref.current) setNeedsToggle(ref.current.scrollHeight > ref.current.clientHeight + 1);
  }, [clean]);
  return (
    <>
      <div ref={ref} className={`news-body ${expanded ? '' : 'news-truncated'}`} dangerouslySetInnerHTML={{ __html: clean }} />
      {needsToggle && (
        <span className="news-toggle-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Хураах' : 'Үргэлжлүүлж унших...'}
        </span>
      )}
    </>
  );
}

export default function News() {
  const [posts, setPosts] = useState(null);
  const [topicFilter, setTopicFilter] = useState('');
  const [viewCounts, setViewCounts] = useState({});
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await sb.from('news_posts').select('*').eq('status', 'published').order('created_at', { ascending: false });
      if (error) { setPosts([]); return; }
      setPosts(data || []);
      const counts = {};
      (data || []).forEach(p => { counts[p.id] = p.view_count || 0; });
      setViewCounts(counts);

      // Үзсэн тоолуур — browser бүрд post тус бүрийг ЗӨВХӨН НЭГ УДАА тоолно
      const viewed = getViewedIds();
      for (const post of data || []) {
        if (viewed.has(post.id)) continue;
        viewed.add(post.id);
        const { error: incErr } = await sb.rpc('increment_news_view', { p_id: post.id });
        if (!incErr) setViewCounts(c => ({ ...c, [post.id]: (c[post.id] || 0) + 1 }));
      }
      localStorage.setItem('suh_news_viewed_ids', JSON.stringify([...viewed]));
    })();
  }, []);

  if (posts === null) return <div className="pool-empty">Ачаалж байна...</div>;
  const list = topicFilter ? posts.filter(p => p.topic === topicFilter) : posts;

  return (
    <div>
      <select className="news-filter" value={topicFilter} onChange={e => setTopicFilter(e.target.value)}>
        <option value="">Бүгдийг харах</option>
        {TOPICS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      {!list.length && <div className="pool-empty">Одоогоор мэдээ алга</div>}
      {list.map(post => {
        const dateStr = post.published_at ? fmtNewsDate(new Date(post.published_at)) : '';
        const meta = topicLabel(post.topic) ? `${dateStr} | ${topicLabel(post.topic)}` : dateStr;
        const photos = Array.isArray(post.photos) ? post.photos : [];
        return (
          <div key={post.id} className="mobile-list-item news-card">
            {(post.is_breaking || post.is_featured) && (
              <div className="news-badges">
                {post.is_breaking && <span className="news-badge news-badge-breaking">ШУУРХАЙ</span>}
                {post.is_featured && <span className="news-badge news-badge-featured">ОНЦЛОХ</span>}
              </div>
            )}
            <div className="news-meta">{meta} | Үзсэн: {String(viewCounts[post.id] || 0).padStart(3, '0')}</div>
            <h3 className="news-title">{post.title}</h3>
            <NewsBody html={post.body} />
            {post.video_url && (
              <div className="news-video-wrap">
                <iframe src={post.video_url} allowFullScreen title="Видео" />
              </div>
            )}
            {photos.length > 0 && <NewsPhotoGrid photos={photos} onOpen={i => setLightbox({ photos, index: i })} />}
            {post.pdf_path && (
              <div style={{ marginTop: 12 }}>
                <a href={post.pdf_path} target="_blank" rel="noopener noreferrer" className="login-btn news-pdf-btn">📄 PDF харах</a>
              </div>
            )}
          </div>
        );
      })}
      {lightbox && (
        <div className="news-lightbox-overlay" onClick={e => e.target === e.currentTarget && setLightbox(null)}>
          <button className="icon-btn news-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          {lightbox.photos.length > 1 && (
            <button className="icon-btn news-lightbox-nav news-lightbox-prev"
              onClick={() => setLightbox(lb => ({ ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length }))}>‹</button>
          )}
          <img src={lightbox.photos[lightbox.index].url} alt="" className="news-lightbox-img" />
          {lightbox.photos.length > 1 && (
            <button className="icon-btn news-lightbox-nav news-lightbox-next"
              onClick={() => setLightbox(lb => ({ ...lb, index: (lb.index + 1) % lb.photos.length }))}>›</button>
          )}
          {lightbox.photos[lightbox.index].caption && (
            <div className="news-lightbox-caption">{lightbox.photos[lightbox.index].caption}</div>
          )}
        </div>
      )}
    </div>
  );
}
