import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';

function fmtDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

function PollDetail({ pollId, profile }) {
  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [results, setResults] = useState({});
  const [myVotedOptions, setMyVotedOptions] = useState(new Set());
  const [selections, setSelections] = useState({});
  const [error, setError] = useState('');

  async function loadResults(qs) {
    const { data: myVotes } = await sb.from('votes').select('option_id').eq('poll_id', pollId).eq('apt', profile.apt);
    setMyVotedOptions(new Set((myVotes || []).map(v => v.option_id)));
    const next = {};
    for (const q of qs) {
      const { data: options } = await sb.from('poll_options').select('*').eq('question_id', q.id).order('order_num');
      const residentIds = (options || []).map(o => o.resident_id).filter(Boolean);
      const aptById = {};
      if (residentIds.length) {
        const { data: rs } = await sb.from('residents').select('id,apt').in('id', residentIds);
        (rs || []).forEach(r => { aptById[r.id] = r.apt; });
      }
      const { data: voteCounts } = await sb.rpc('get_poll_results', { p_question_id: q.id });
      const countByOption = {};
      (voteCounts || []).forEach(v => { countByOption[v.option_id] = v.vote_count; });
      const total = Object.values(countByOption).reduce((a, b) => a + b, 0);
      next[q.id] = { options: options || [], countByOption, total, aptById, hasResults: !!voteCounts };
    }
    setResults(next);
  }

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: qs }] = await Promise.all([
        sb.from('polls').select('*').eq('id', pollId).maybeSingle(),
        sb.from('poll_questions').select('*').eq('poll_id', pollId).order('order_num'),
      ]);
      setPoll(p);
      const questionList = qs || [];
      setQuestions(questionList);
      if (profile.role === 'ot' && profile.apt) {
        const { data: existing } = await sb.from('votes').select('id').eq('poll_id', pollId).eq('apt', profile.apt).limit(1);
        const voted = existing && existing.length > 0;
        setAlreadyVoted(voted);
        if (voted) { await loadResults(questionList); }
        else {
          const next = {};
          for (const q of questionList) {
            const { data: options } = await sb.from('poll_options').select('*').eq('question_id', q.id).order('order_num');
            next[q.id] = { options: options || [] };
          }
          setResults(next);
        }
      }
      setLoading(false);
    })();
  }, [pollId, profile.apt, profile.role]);

  async function submitVote() {
    setError('');
    const { data: resident } = await sb.from('residents').select('id').eq('apt', profile.apt).maybeSingle();
    if (!resident) { setError('Таны тоотод харгалзах бүртгэл олдсонгүй'); return; }
    const rows = questions.filter(q => selections[q.id]).map(q => ({
      poll_id: pollId, question_id: q.id, option_id: selections[q.id],
      resident_id: resident.id, apt: profile.apt, poll_type: poll?.poll_type,
    }));
    if (!rows.length) { setError('Сонголт хийнэ vv'); return; }
    const { error: insErr } = await sb.from('votes').insert(rows);
    if (insErr) {
      setError(insErr.code === '23505' ? 'Та аль хэдийн санал өгсөн байна' : 'Алдаа: ' + insErr.message);
      return;
    }
    setAlreadyVoted(true);
    setLoading(true);
    await loadResults(questions);
    setLoading(false);
  }

  if (loading) return <div className="pool-empty">Ачаалж байна...</div>;

  return (
    <div>
      <h2 className="poll-title">{poll?.title || ''}</h2>
      {profile.role !== 'ot'
        ? <div className="pool-empty">Санал өгөх боломж зөвхөн Сууц өмчлөгч ролид байна.</div>
        : alreadyVoted ? (
          <>
            <div className="poll-voted-note">Та энэ санал хураалтад аль хэдийн санал өгсөн байна ✓</div>
            {questions.map(q => {
              const r = results[q.id];
              if (!r) return null;
              return (
                <div key={q.id} className="poll-question-block">
                  <div className="poll-question-text">{q.question_text}</div>
                  {r.hasResults ? r.options.map((opt, i) => {
                    const count = r.countByOption[opt.id] || 0;
                    const pct = r.total ? Math.round(count / r.total * 100) : 0;
                    const isMine = myVotedOptions.has(opt.id);
                    const aptLabel = opt.resident_id && r.aptById[opt.resident_id] ? ` (${r.aptById[opt.resident_id]} тоот)` : '';
                    return (
                      <div key={opt.id} className="poll-result-row">
                        <div className="poll-result-label">
                          <span>
                            {i + 1}. {opt.option_text}{aptLabel}
                            {isMine && <> <span style={{ color: 'var(--success)' }}>✓</span> Миний өгсөн санал</>}
                          </span>
                          <span className="poll-result-count">{count} ({pct}%)</span>
                        </div>
                        <div className="poll-bar-track"><div className="poll-bar-fill" style={{ width: pct + '%' }} /></div>
                      </div>
                    );
                  }) : <div className="poll-hidden-note">Үр дүн нэвтэрснээр эсвэл санал хураалт хаагдсаны дараа харагдана.</div>}
                </div>
              );
            })}
          </>
        ) : (
          <>
            {questions.map(q => {
              const r = results[q.id];
              if (!r) return null;
              return (
                <div key={q.id} className="poll-question-block">
                  <div className="poll-question-text">{q.question_text}</div>
                  <div className="mobile-vote-options">
                    {r.options.map(opt => (
                      <button key={opt.id} className={`mobile-vote-btn ${selections[q.id] === opt.id ? 'selected' : ''}`}
                        onClick={() => setSelections(s => ({ ...s, [q.id]: opt.id }))}>{opt.option_text}</button>
                    ))}
                  </div>
                </div>
              );
            })}
            <button className="login-btn" onClick={submitVote}>Санал өгөх</button>
            {error && <div className="login-error">{error}</div>}
          </>
        )}
    </div>
  );
}

export default function Polls({ profile, openPollId, onOpenPoll }) {
  const [polls, setPolls] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await sb.from('polls').select('*').eq('status', 'active')
        .order('starts_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
      if (error) { setPolls([]); return; }
      const withTotals = await Promise.all((data || []).map(async p => {
        const { data: firstQ } = await sb.from('poll_questions').select('id').eq('poll_id', p.id).order('order_num').limit(1).maybeSingle();
        let total = null;
        if (firstQ) {
          const { data: votes } = await sb.rpc('get_poll_results', { p_question_id: firstQ.id });
          if (votes) total = votes.reduce((s, v) => s + (+v.vote_count || 0), 0);
        }
        return { ...p, total };
      }));
      setPolls(withTotals);
    })();
  }, []);

  if (openPollId) return <PollDetail pollId={openPollId} profile={profile} />;
  if (polls === null) return <div className="pool-empty">Ачаалж байна...</div>;
  if (!polls.length) return <div className="pool-empty">Идэвхтэй санал хураалт алга</div>;

  return (
    <div>
      {polls.map(p => (
        <div key={p.id} className="mobile-list-item" onClick={() => onOpenPoll(p.id)}>
          <div className="mobile-list-title">{fmtDate(new Date(p.starts_at || p.created_at))} {p.title}</div>
          <div className="mobile-list-sub">
            {p.total === null ? '' : p.total + ' хүн оролцсон · '}Санал өгөх, Үр дүнг харах →
          </div>
        </div>
      ))}
    </div>
  );
}
