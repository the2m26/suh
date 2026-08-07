import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { fmtNewsCardDate, newsTopicLabel, NEWS_SANITIZE_CONFIG } from '../lib/newsHelpers';
import Lightbox from './Lightbox';

function sanitizeBody(dirtyHtml) {
  return DOMPurify.sanitize(dirtyHtml || '', NEWS_SANITIZE_CONFIG);
}

export default function NewsCard({ post, viewCount }) {
  const bodyRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // news.js-ийн scrollHeight > clientHeight шалгалттай адил зарчим — 4 мөрөөр
    // хумиад, бодитоор урт бол л "Дэлгэрэнгүй..." товч харуулна.
    setNeedsToggle(el.scrollHeight > el.clientHeight + 1);
  }, [post.body]);

  const dateStr = post.published_at ? fmtNewsCardDate(new Date(post.published_at)) : '';
  const topicLabel = newsTopicLabel(post.topic);
  const dateLine = topicLabel ? `${dateStr} | ${topicLabel}` : dateStr;
  const photos = Array.isArray(post.photos) ? post.photos : [];

  return (
    <div className="card news-card">
      {(post.is_breaking || post.is_featured) && (
        <div className="news-badges">
          {post.is_breaking && <span className="news-badge news-badge-breaking">ШУУРХАЙ</span>}
          {post.is_featured && <span className="news-badge news-badge-featured">ОНЦЛОХ</span>}
        </div>
      )}
      <div className="news-meta">
        {dateLine} | Үзсэн: <span>{String(viewCount ?? post.view_count ?? 0).padStart(3, '0')}</span>
      </div>
      <h3 className="news-title">{post.title}</h3>
      <div
        ref={bodyRef}
        className={expanded ? 'news-body' : 'news-body news-truncated'}
        dangerouslySetInnerHTML={{ __html: sanitizeBody(post.body) }}
      />
      {needsToggle && (
        <span className="news-toggle-btn" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Хураангуй' : 'Дэлгэрэнгүй...'}
        </span>
      )}
      {post.video_url && (
        <div className="news-video-container">
          <iframe src={post.video_url} allowFullScreen title="Видео" />
        </div>
      )}
      {photos.length > 0 && (
        <div className="news-photo-grid">
          {photos.slice(0, 4).map((p, i) => (
            <div key={i} className="news-photo-item" onClick={() => setLightboxIndex(i)}>
              <img src={p.url} alt="" />
              {photos.length > 4 && i === 3 && (
                <div className="news-photo-overlay">+{photos.length - 3}</div>
              )}
            </div>
          ))}
        </div>
      )}
      {lightboxIndex !== null && (
        <Lightbox
          items={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNav={(delta) => setLightboxIndex((i) => (i + delta + photos.length) % photos.length)}
        />
      )}
      {post.pdf_path && (
        <div className="news-pdf-link">
          <a href={post.pdf_path} target="_blank" rel="noopener noreferrer" className="btn-outline-sm">
            📄 PDF харах
          </a>
        </div>
      )}
    </div>
  );
}
