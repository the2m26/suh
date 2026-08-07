import { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { logActivity } from '../lib/dbUtils';
import { POLL_STATUS_LABELS, pollTypeLabel, residentOptions, getMyResidentId } from '../lib/pollHelpers';

export default function Polls() {
  const { currentUser, currentProfile } = useAuth();
  const { canWrite, canAdd, canDelete } = usePermissions();
  const [pollsList, setPollsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit-<id>' | 'detail-<id>'
  const [residents, setResidents] = useState([]);

  const loadPolls = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb.from('polls').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Санал хураалт ачаалахад алдаа:', error.message); setLoading(false); return; }
    setPollsList(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadPolls(); }, [loadPolls]);
  // Election төрлийн нэр дэвшигч сонгоход residents жагсаалт хэрэгтэй (хөнгөн fetch —
  // бүрэн "Сууц өмчлөгчийн бүртгэл" модуль 2-р түвшинд хараахан ортоогүй).
  useEffect(() => {
    sb.from('residents').select('id, apt, firstname, lastname').then(({ data, error }) => {
      if (error) { console.error('residents ачаалах алдаа:', error.message); return; }
      setResidents(data || []);
    });
  }, []);

  const canManage = canWrite('polls');

  if (view === 'list') {
    return (
      <div className="page">
        <div className="page-header-row">
          <h2>Сонгууль, санал асуулга</h2>
          {canManage && <button className="btn-primary" onClick={() => setView('create')}>+ Санал хураалт үүсгэх</button>}
        </div>
        {loading && <div className="empty-state">Ачаалж байна...</div>}
        {!loading && !pollsList.length && <div className="empty-state">Санал хураалт байхгүй байна</div>}
        {!loading && pollsList.map((p) => (
          <div key={p.id} className="card poll-card" onClick={() => setView('detail-' + p.id)}>
            <div className="poll-card-row">
              <div>
                <div className="poll-card-title">{p.title}</div>
                <div className="poll-card-meta">
                  {pollTypeLabel(p.poll_type)}
                  {p.starts_at && p.ends_at ? ` · ${p.starts_at.slice(0, 10)} — ${p.ends_at.slice(0, 10)}` : ''}
                </div>
              </div>
              <span className={'tag tag-' + p.status}>{POLL_STATUS_LABELS[p.status] || ''}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (view === 'create' || view.startsWith('edit-')) {
    const editingId = view.startsWith('edit-') ? Number(view.slice(5)) : null;
    return (
      <PollWizard
        editingId={editingId}
        pollsList={pollsList}
        residents={residents}
        canWrite={canWrite('polls')}
        canAdd={canAdd('polls')}
        currentUser={currentUser}
        currentProfile={currentProfile}
        onClose={() => { setView('list'); loadPolls(); }}
      />
    );
  }

  if (view.startsWith('detail-')) {
    const pollId = Number(view.slice(7));
    return (
      <PollDetail
        pollId={pollId}
        pollsList={pollsList}
        residents={residents}
        currentProfile={currentProfile}
        canManage={canManage}
        canDelete={canDelete('polls')}
        onEdit={() => setView('edit-' + pollId)}
        onClose={() => { setView('list'); loadPolls(); }}
        onChanged={loadPolls}
      />
    );
  }

  return null;
}

// ------------------------------------------------------------------
// ЖАГСААЛТ үүсгэх/засах WIZARD
// ------------------------------------------------------------------
function PollWizard({ editingId, pollsList, residents, canWrite, canAdd, currentUser, currentProfile, onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pollType, setPollType] = useState('issue');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [showLive, setShowLive] = useState(true);
  const [questions, setQuestions] = useState([]); // {id, text}
  const [candidatesUZ, setCandidatesUZ] = useState([]); // {id, name, residentId}
  const [candidatesHZ, setCandidatesHZ] = useState([]);
  const [electionTitleUZ, setElectionTitleUZ] = useState('');
  const [electionTitleHZ, setElectionTitleHZ] = useState('');
  const [electionMaxUZ, setElectionMaxUZ] = useState(1);
  const [electionMaxHZ, setElectionMaxHZ] = useState(1);
  const [saving, setSaving] = useState(false);

  const allowed = editingId ? canWrite : canAdd;

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      const poll = pollsList.find((p) => p.id === editingId);
      if (!poll) return;
      setTitle(poll.title || '');
      setDescription(poll.description || '');
      setPollType(poll.poll_type);
      setStartsAt(poll.starts_at ? poll.starts_at.slice(0, 16) : '');
      setEndsAt(poll.ends_at ? poll.ends_at.slice(0, 16) : '');
      setAnonymous(!!poll.anonymous);
      setShowLive(!!poll.show_results_live);

      const { data: qs } = await sb.from('poll_questions').select('*').eq('poll_id', editingId).order('order_num');
      if (poll.poll_type === 'issue' || poll.poll_type === 'rating') {
        setQuestions((qs || []).map((q) => ({ id: q.id, text: q.question_text })));
      } else {
        for (let i = 0; i < (qs || []).length; i++) {
          const q = qs[i];
          const col = i === 0 ? 'uz' : 'hz';
          const { data: opts } = await sb.from('poll_options').select('*').eq('question_id', q.id).order('order_num');
          const candidates = (opts || []).filter((o) => !o.is_abstain).map((o) => ({
            id: Date.now() + Math.random(), name: o.option_text, residentId: o.resident_id || '',
          }));
          if (col === 'uz') { setElectionTitleUZ(q.question_text); setElectionMaxUZ(q.max_selections); setCandidatesUZ(candidates); }
          else { setElectionTitleHZ(q.question_text); setElectionMaxHZ(q.max_selections); setCandidatesHZ(candidates); }
        }
      }
    })();
  }, [editingId, pollsList]);

  function addQuestion() { setQuestions([...questions, { id: Date.now(), text: '' }]); }
  function removeQuestion(id) { setQuestions(questions.filter((q) => q.id !== id)); }
  function updateQuestionText(id, text) { setQuestions(questions.map((q) => q.id === id ? { ...q, text } : q)); }

  function getCandidates(col) { return col === 'uz' ? candidatesUZ : candidatesHZ; }
  function setCandidates(col, arr) { col === 'uz' ? setCandidatesUZ(arr) : setCandidatesHZ(arr); }
  function addCandidate(col) { setCandidates(col, [...getCandidates(col), { id: Date.now() + Math.random(), name: '', residentId: '' }]); }
  function removeCandidate(col, id) { setCandidates(col, getCandidates(col).filter((c) => String(c.id) !== String(id))); }
  function updateCandidateResident(col, id, residentId) {
    const r = residents.find((x) => String(x.id) === String(residentId));
    const name = r ? `${r.lastname || ''} ${r.firstname || ''}`.trim() : '';
    setCandidates(col, getCandidates(col).map((c) => String(c.id) === String(id) ? { ...c, residentId, name } : c));
  }

  async function handleSave() {
    if (!allowed) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { alert('Гарчиг оруулна уу'); return; }
    if ((pollType === 'issue' || pollType === 'rating') && questions.filter((q) => q.text.trim()).length === 0) {
      alert('Дор хаяж нэг асуулт нэмнэ vv'); return;
    }
    if (pollType === 'election') {
      const hasUZ = candidatesUZ.filter((c) => c.name.trim()).length > 0;
      const hasHZ = candidatesHZ.filter((c) => c.name.trim()).length > 0;
      if (!hasUZ && !hasHZ) { alert('Дор хаяж нэг баганад нэр дэвшигч нэмнэ vv'); return; }
    }

    setSaving(true);
    let poll;
    if (editingId) {
      const { data, error } = await sb.from('polls').update({
        title: trimmedTitle, description: description.trim(), poll_type: pollType,
        starts_at: startsAt || null, ends_at: endsAt || null, anonymous, show_results_live: showLive,
      }).eq('id', editingId).select().single();
      if (error) { setSaving(false); alert('Алдаа: ' + error.message); return; }
      poll = data;
      await sb.from('poll_questions').delete().eq('poll_id', poll.id);
    } else {
      const { data, error } = await sb.from('polls').insert({
        title: trimmedTitle, description: description.trim(), poll_type: pollType, status: 'draft',
        starts_at: startsAt || null, ends_at: endsAt || null, anonymous, show_results_live: showLive,
      }).select().single();
      if (error) { setSaving(false); alert('Алдаа: ' + error.message); return; }
      poll = data;
    }

    if (pollType === 'issue' || pollType === 'rating') {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.text.trim()) continue;
        const { data: question, error: qErr } = await sb.from('poll_questions').insert({
          poll_id: poll.id, question_text: q.text, order_num: i, max_selections: 1,
        }).select().single();
        if (qErr) { console.error('Асуулт хадгалахад алдаа:', qErr.message); continue; }
        if (pollType === 'rating') {
          await sb.from('poll_options').insert([1, 2, 3, 4, 5].map((n) => ({ question_id: question.id, option_text: String(n), order_num: n - 1 })));
        } else {
          await sb.from('poll_options').insert([
            { question_id: question.id, option_text: 'Зөвшөөрч байна', order_num: 0 },
            { question_id: question.id, option_text: 'Зөвшөөрөхгүй', order_num: 1 },
            { question_id: question.id, option_text: 'Мэдэхгүй байна', order_num: 2 },
          ]);
        }
      }
    } else {
      const configs = [
        { col: 'uz', qTitle: electionTitleUZ, max: electionMaxUZ, arr: candidatesUZ, order: 0 },
        { col: 'hz', qTitle: electionTitleHZ, max: electionMaxHZ, arr: candidatesHZ, order: 1 },
      ];
      for (const cfg of configs) {
        const candidates = cfg.arr.filter((c) => c.name.trim());
        if (!candidates.length) continue;
        const { data: question, error: qErr } = await sb.from('poll_questions').insert({
          poll_id: poll.id, question_text: cfg.qTitle.trim() || trimmedTitle, order_num: cfg.order, max_selections: +cfg.max || 1,
        }).select().single();
        if (qErr) { console.error('Алдаа:', qErr.message); continue; }
        const candidateOptions = candidates.map((c, i) => ({
          question_id: question.id, option_text: c.name, order_num: i, is_abstain: false, resident_id: c.residentId || null,
        }));
        candidateOptions.push({ question_id: question.id, option_text: 'Аль нь ч биш', order_num: 999, is_abstain: true });
        await sb.from('poll_options').insert(candidateOptions);
      }
    }

    await logActivity(currentUser, currentProfile, editingId ? 'edit' : 'add', 'polls', editingId || null, trimmedTitle);
    setSaving(false);
    onClose();
  }

  const resOptions = residentOptions(residents);

  return (
    <div className="page poll-wizard">
      <div className="page-header-row">
        <h2>{editingId ? 'Санал хураалт засах' : 'Санал хураалт үүсгэх'}</h2>
        <button className="btn-ghost" onClick={onClose}>← Буцах</button>
      </div>

      <label className="field"><span>Гарчиг</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span>Тайлбар</span><input value={description} onChange={(e) => setDescription(e.target.value)} /></label>

      <div className="field">
        <span>Төрөл</span>
        <div className="poll-type-btns">
          {[['issue', 'Санал асуулга'], ['rating', 'Үнэлгээ'], ['election', 'Сонгууль']].map(([t, label]) => (
            <button key={t} type="button" className={'poll-type-btn' + (pollType === t ? ' active' : '')} onClick={() => setPollType(t)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="field-row">
        <label className="field"><span>Эхлэх</span><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
        <label className="field"><span>Дуусах</span><input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Нэргүй</label>
        <label><input type="checkbox" checked={showLive} onChange={(e) => setShowLive(e.target.checked)} /> Үр дүнг шууд харуулах</label>
      </div>

      {(pollType === 'issue' || pollType === 'rating') && (
        <div className="field">
          <span>Асуултууд</span>
          {questions.length === 0 && <div className="dt-muted">Асуулт нэмээгүй байна</div>}
          {questions.map((q, i) => (
            <div key={q.id} className="wizard-row">
              <span className="wizard-idx">{i + 1}.</span>
              <input value={q.text} onChange={(e) => updateQuestionText(q.id, e.target.value)} placeholder="ж: Зогсоолын хураамж нэмэгдүүлэх" />
              <button type="button" className="btn-ghost-sm danger" onClick={() => removeQuestion(q.id)}>✕</button>
            </div>
          ))}
          <button type="button" className="btn-outline" onClick={addQuestion}>+ Асуулт нэмэх</button>
        </div>
      )}

      {pollType === 'election' && (
        <>
          <ElectionColumn
            label="Удирдах зөвлөл (УЗ)"
            title={electionTitleUZ} setTitle={setElectionTitleUZ}
            max={electionMaxUZ} setMax={setElectionMaxUZ}
            candidates={candidatesUZ} resOptions={resOptions}
            onAdd={() => addCandidate('uz')} onRemove={(id) => removeCandidate('uz', id)}
            onSelect={(id, rid) => updateCandidateResident('uz', id, rid)}
          />
          <ElectionColumn
            label="Хяналтын зөвлөл (ХЗ)"
            title={electionTitleHZ} setTitle={setElectionTitleHZ}
            max={electionMaxHZ} setMax={setElectionMaxHZ}
            candidates={candidatesHZ} resOptions={resOptions}
            onAdd={() => addCandidate('hz')} onRemove={(id) => removeCandidate('hz', id)}
            onSelect={(id, rid) => updateCandidateResident('hz', id, rid)}
          />
        </>
      )}

      <div className="form-actions">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>{editingId ? 'Хадгалах' : 'Ноорог хадгалах'}</button>
      </div>
    </div>
  );
}

function ElectionColumn({ label, title, setTitle, max, setMax, candidates, resOptions, onAdd, onRemove, onSelect }) {
  return (
    <div className="field election-col">
      <span>{label}</span>
      <div className="field-row">
        <input placeholder="Асуултын гарчиг (сонголттой)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="number" min="1" value={max} onChange={(e) => setMax(e.target.value)} style={{ width: 70 }} title="Хэдэн хүнийг сонгож болох" />
      </div>
      {candidates.length === 0 && <div className="dt-muted">Нэр дэвшигч нэмээгүй байна</div>}
      {candidates.map((c, i) => (
        <div key={c.id} className="wizard-row">
          <span className="wizard-idx">{i + 1}.</span>
          <select value={c.residentId} onChange={(e) => onSelect(c.id, e.target.value)}>
            <option value="">— Сууц өмчлөгч сонгох —</option>
            {resOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button type="button" className="btn-ghost-sm danger" onClick={() => onRemove(c.id)}>✕</button>
        </div>
      ))}
      <button type="button" className="btn-outline" onClick={onAdd}>+ Нэр дэвшигч нэмэх</button>
    </div>
  );
}

// ------------------------------------------------------------------
// ДЭЛГЭРЭНГүй / САНАЛ ӨГӨХ / үР Дүн
// ------------------------------------------------------------------
function PollDetail({ pollId, pollsList, residents, currentProfile, canManage, canDelete, onEdit, onClose, onChanged }) {
  const [poll, setPoll] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [optionsByQ, setOptionsByQ] = useState({});
  const [countsByQ, setCountsByQ] = useState({});
  const [myVoteIdsByQ, setMyVoteIdsByQ] = useState({});
  const [selected, setSelected] = useState({}); // {questionId: [optionId,...]}
  const [loading, setLoading] = useState(true);

  const isOwner = currentProfile?.role === 'ot';
  const myResidentId = getMyResidentId(currentProfile, residents);

  const load = useCallback(async () => {
    setLoading(true);
    const p = pollsList.find((x) => x.id === pollId);
    setPoll(p || null);
    if (!p) { setLoading(false); return; }
    const { data: qs } = await sb.from('poll_questions').select('*').eq('poll_id', pollId).order('order_num');
    setQuestions(qs || []);

    const nextOptions = {}, nextCounts = {}, nextMyVotes = {};
    for (const q of qs || []) {
      const { data: opts } = await sb.from('poll_options').select('*').eq('question_id', q.id).order('order_num');
      nextOptions[q.id] = opts || [];
      if (p.show_results_live || p.status === 'closed' || canManage) {
        const { data: results } = await sb.rpc('get_poll_results', { p_question_id: q.id });
        const counts = {};
        (results || []).forEach((r) => { counts[r.option_id] = r.vote_count; });
        nextCounts[q.id] = counts;
      }
      const { data: myVotes } = await sb.from('votes').select('option_id').eq('question_id', q.id).eq('resident_id', myResidentId || -1);
      nextMyVotes[q.id] = (myVotes || []).map((v) => v.option_id);
    }
    setOptionsByQ(nextOptions);
    setCountsByQ(nextCounts);
    setMyVoteIdsByQ(nextMyVotes);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollId, pollsList, canManage, myResidentId]);

  useEffect(() => { load(); }, [load]);

  function toggleOption(qId, optId, isMulti) {
    setSelected((s) => {
      const cur = s[qId] || [];
      if (isMulti) {
        return { ...s, [qId]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] };
      }
      return { ...s, [qId]: [optId] };
    });
  }

  async function submitVote(questionIds) {
    const residentApt = currentProfile?.apt;
    if (!residentApt || !myResidentId) { alert('Таны профайлд тоот холбогдоогүй байна'); return; }
    const rows = [];
    questionIds.forEach((qId) => {
      (selected[qId] || []).forEach((optId) => rows.push({
        poll_id: poll.id, question_id: qId, option_id: optId,
        resident_id: myResidentId, apt: residentApt, poll_type: poll.poll_type,
      }));
    });
    if (!rows.length) { alert('Сонголт хийнэ vv'); return; }
    const { error } = await sb.from('votes').insert(rows);
    if (error) {
      alert(error.code === '23505' ? 'Та аль хэдийн санал өгсөн байна' : 'Алдаа: ' + error.message);
      return;
    }
    setSelected({});
    load();
  }

  async function handleActivate() {
    if (!confirm('Санал хураалтыг идэвхжүүлэх vv?')) return;
    const { error } = await sb.from('polls').update({ status: 'active' }).eq('id', pollId);
    if (error) { alert('Алдаа: ' + error.message); return; }
    load(); onChanged();
  }
  async function handleClose() {
    if (!confirm('Санал хураалтыг хаах уу? Хаасны дараа сэргээх боломжгүй.')) return;
    const { error } = await sb.from('polls').update({ status: 'closed' }).eq('id', pollId);
    if (error) { alert('Алдаа: ' + error.message); return; }
    load(); onChanged();
  }
  async function handleDeleteDraft() {
    if (!canDelete || poll.status !== 'draft') return;
    if (!confirm('Энэ ноорог санал хураалтыг бүрмөсөн устгах уу?')) return;
    const { error } = await sb.from('polls').delete().eq('id', pollId);
    if (error) { alert('Алдаа: ' + error.message); return; }
    onClose();
  }

  // polls.js-ийн exportPollDetailToXlsx() (мөр ~652) — DOM хүснэгэл scrape
  // хийхийн оронд React state-ээс шууд workbook угсарна (илүү найдвартай).
  // Асуулт бүрт тусдаа sheet (эх зарчимтай адил).
  function handleExportXlsx() {
    if (!questions.length) { alert('Экспортлох үр дүн олдсонгүй'); return; }
    try {
      const wb = XLSX.utils.book_new();
      questions.forEach((q, i) => {
        const opts = optionsByQ[q.id] || [];
        const counts = countsByQ[q.id] || {};
        const totalVotes = Object.values(counts).reduce((s, c) => s + c, 0) || 1;
        const rows = opts.map((o) => ({
          'Сонголт': o.option_text,
          'Санал': counts[o.id] || 0,
          '%': Math.round(((counts[o.id] || 0) / totalVotes) * 100),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const sheetName = `Асуулт ${i + 1}`.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });
      const title = (poll.title || 'Санал_хураалт').replace(/[\\/*?:[\]]/g, '');
      XLSX.writeFile(wb, `${title}.xlsx`);
    } catch (e) {
      alert('Экспортод алдаа гарлаа: ' + e.message);
    }
  }

  if (loading || !poll) return <div className="empty-state">Ачаалж байна...</div>;

  const pendingQuestions = []; // issue/rating: нэг маягтад цуглуулна

  return (
    <div className="page">
      <div className="page-header-row">
        <h2>{poll.title}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {questions.length > 0 && <button className="btn-outline" onClick={handleExportXlsx}>⬇ Excel татах</button>}
          <button className="btn-ghost" onClick={onClose}>← Буцах</button>
        </div>
      </div>
      <div className="card poll-detail-meta">
        <div className="dt-muted">{poll.description}</div>
        <div className="dt-muted" style={{ marginTop: 8 }}>
          Төлөв: <strong>{POLL_STATUS_LABELS[poll.status]}</strong>
          {poll.starts_at && ` · Эхэлсэн: ${poll.starts_at.slice(0, 10)}`}
          {poll.ends_at && ` · Дуусах: ${poll.ends_at.slice(0, 10)}`}
        </div>
      </div>

      {canManage && poll.status === 'draft' && (
        <div className="form-actions">
          <button className="btn-outline" onClick={onEdit}>Засварлах</button>
          <button className="btn-ghost-sm danger" onClick={handleDeleteDraft}>Устгах</button>
          <button className="btn-primary" onClick={handleActivate}>Нийтлэх</button>
        </div>
      )}
      {canManage && poll.status === 'active' && (
        <div className="form-actions"><button className="btn-ghost-sm danger" onClick={handleClose}>⏹ Санал хураалт хаах</button></div>
      )}

      {questions.map((q) => {
        const opts = optionsByQ[q.id] || [];
        const myVoteIds = myVoteIdsByQ[q.id] || [];
        const hasVoted = myVoteIds.length > 0;
        const canVoteNow = poll.status === 'active' && isOwner && !hasVoted;
        const isMulti = q.max_selections > 1;
        const isRating = poll.poll_type === 'rating';
        const showResults = poll.show_results_live || poll.status === 'closed' || canManage;
        const counts = countsByQ[q.id] || {};
        const totalVotes = Object.values(counts).reduce((s, c) => s + c, 0) || 1;

        if (canVoteNow) {
          if (poll.poll_type === 'election') {
            return (
              <div key={q.id} className="card poll-question-card">
                <div className="poll-question-title">{q.question_text}</div>
                <VoteOptions opts={opts} qId={q.id} isMulti={isMulti} isRating={false} selected={selected[q.id] || []} onToggle={toggleOption} />
                <button className="btn-primary" onClick={() => submitVote([q.id])}>Санал өгөх</button>
              </div>
            );
          }
          pendingQuestions.push(
            <div key={q.id} className="poll-question-card">
              <div className="poll-question-title">{q.question_text}</div>
              <VoteOptions opts={opts} qId={q.id} isMulti={isMulti} isRating={isRating} selected={selected[q.id] || []} onToggle={toggleOption} />
            </div>
          );
          return null;
        }

        if (isRating && showResults) {
          let totalStars = 0, totalCount = 0;
          opts.forEach((o) => { const cnt = counts[o.id] || 0; totalStars += (+o.option_text) * cnt; totalCount += cnt; });
          const avg = totalCount ? (totalStars / totalCount).toFixed(1) : '—';
          return (
            <div key={q.id} className="card poll-rating-result">
              <div className="poll-question-title">{q.question_text}</div>
              <div className="poll-rating-score">★ {avg} <span className="dt-muted">/5 ({totalCount} хүн үнэлсэн)</span></div>
              {hasVoted && <div className="voted-note">✓ Та үнэлсэн байна</div>}
            </div>
          );
        }

        return (
          <div key={q.id} className="poll-results-block">
            <table className="data-table">
              <thead><tr><th>{q.question_text}</th><th className="ta-right">САНАЛ</th><th className="ta-right">%</th><th /></tr></thead>
              <tbody>
                {opts.map((o) => {
                  const cnt = counts[o.id] || 0;
                  const pct = showResults ? Math.round((cnt / totalVotes) * 100) : 0;
                  const isMine = myVoteIds.includes(o.id);
                  return (
                    <tr key={o.id} className={isMine ? 'my-vote-row' : ''}>
                      <td className="dt-title">{isMine && <span className="my-vote-check">✓</span>}{o.option_text}</td>
                      <td className="dt-mono ta-right">{showResults ? cnt : '—'}</td>
                      <td className="dt-mono ta-right">{showResults ? pct + '%' : ''}</td>
                      <td><div className="poll-bar-track"><div className="poll-bar-fill" style={{ width: pct + '%' }} /></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {hasVoted && <div className="voted-note">✓ Та санал өгсөн байна</div>}
          </div>
        );
      })}

      {pendingQuestions.length > 0 && (
        <div className="card poll-pending-form">
          {pendingQuestions}
          <button className="btn-primary" onClick={() => submitVote(questions.filter((q) => poll.poll_type !== 'election').map((q) => q.id))}>
            {poll.poll_type === 'rating' ? 'Илгээх' : 'Санал өгөх'}
          </button>
        </div>
      )}
    </div>
  );
}

function VoteOptions({ opts, qId, isMulti, isRating, selected, onToggle }) {
  if (isRating) {
    const sortedOpts = [...opts].sort((a, b) => (+a.option_text) - (+b.option_text));
    const maxSelected = selected.length ? Math.max(...selected.map((id) => +sortedOpts.find((o) => o.id === id)?.option_text || 0)) : 0;
    return (
      <div className="star-row">
        {sortedOpts.map((o) => {
          const val = +o.option_text;
          const active = selected.includes(o.id) || val <= maxSelected;
          return (
            <button key={o.id} type="button" className="star-btn" onClick={() => onToggle(qId, o.id, false)} style={{ color: active ? 'var(--warning)' : 'var(--text-muted)' }}>
              {active ? '★' : '☆'}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="vote-options-col">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          className={'vote-option-btn' + (selected.includes(o.id) ? ' selected' : '')}
          onClick={() => onToggle(qId, o.id, isMulti)}
        >
          {o.option_text}
        </button>
      ))}
    </div>
  );
}
