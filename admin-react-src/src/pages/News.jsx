import { useEffect, useState, useCallback } from 'react';
import { sb } from '../lib/supabase';
import { NEWS_TOPICS, getNewsViewedIds, saveNewsViewedIds } from '../lib/newsHelpers';
import NewsCard from '../components/NewsCard';

export default function News() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [viewCounts, setViewCounts] = useState({}); // {postId: count} — RPC-ийн дараах шинэчилсэн утга

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await sb
      .from('news_posts')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    if (err) {
      console.error('Мэдээ ачаалах алдаа:', err.message);
      setError('Алдаа гарлаа');
      setLoading(false);
      return;
    }
    setPosts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // news.js-ийн _trackNewsViews()-тэй адил зарчим — браузер бүрд НЭГ УДАА л
  // increment_news_view() RPC дуудна.
  useEffect(() => {
    if (!posts.length) return;
    let cancelled = false;
    (async () => {
      const viewed = getNewsViewedIds();
      const newCounts = {};
      for (const p of posts) {
        if (viewed.has(p.id)) continue;
        viewed.add(p.id);
        const { error: err } = await sb.rpc('increment_news_view', { p_id: p.id });
        if (err) { console.error('үзсэн тоолуур алдаа:', err.message); continue; }
        newCounts[p.id] = (p.view_count || 0) + 1;
      }
      if (!cancelled) {
        saveNewsViewedIds(viewed);
        if (Object.keys(newCounts).length) setViewCounts((v) => ({ ...v, ...newCounts }));
      }
    })();
    return () => { cancelled = true; };
  }, [posts]);

  const filtered = topicFilter ? posts.filter((p) => p.topic === topicFilter) : posts;

  return (
    <div className="page">
      <select
        className="news-topic-filter"
        value={topicFilter}
        onChange={(e) => setTopicFilter(e.target.value)}
      >
        <option value="">Бүгдийг харах</option>
        {NEWS_TOPICS.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {loading && <div className="empty-state">Ачаалж байна...</div>}
      {error && <div className="empty-state">{error}</div>}
      {!loading && !error && !filtered.length && <div className="empty-state">Одоогоор мэдээ алга</div>}
      {!loading && !error && filtered.map((p) => (
        <NewsCard key={p.id} post={p} viewCount={viewCounts[p.id]} />
      ))}
    </div>
  );
}
