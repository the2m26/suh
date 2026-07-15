// ============================================================
// СОНГУУЛЬ, САНАЛ АСУУЛГА — тусад нь гаргасан модуль
// ============================================================
// Энэ файл suh.html-ийн үндсэн <script> блокоос тусгаарлагдсан.
// Global scope-г хуваалцдаг тул sb, residents, toast, closeModal, openModal,
// todayStr, ROLE_LABELS зэрэг үндсэн файлын функц/хувьсагчийг шууд ашиглаж болно.
// Хамаарал: зөвхөн showPage('polls') үед renderPollsPage() дуудагддаг цорын ганц гадаад холбоос.
// ============================================================

// СОНГУУЛЬ, САНАЛ АСУУЛГА
// ============================================================

let pollsList = [];
let currentPollQuestions = [];  // wizard-д ашиглах түр массив (issue)
let currentPollCandidatesUZ = [];  // election: УЗ
let currentPollCandidatesHZ = [];  // election: ХЗ
let viewingPollId = null;
let editingPollId = null;  // != null үед засварлах горим

// Сууц өмчлөгчдийн нэрсийн жагсаалт (нэр дэвшигч сонгох dropdown-д ашиглана)
function getResidentOptionsHTML(selectedId) {
  const opts = residents
    .filter(r=>r && (r.firstname || r.lastname))
    .map(r=>{
      const name = `${esc(r.lastname)||''} ${esc(r.firstname)||''}`.trim();
      const sel = (selectedId && String(selectedId)===String(r.id)) ? 'selected' : '';
      return `<option value="${r.id}" ${sel}>${name} — ${r.apt}</option>`;
    }).join('');
  return `<option value="">— Сууц өмчлөгч сонгох —</option>` + opts;
}

// --- ЖАГСААЛТ ---
async function renderPollsPage() {
  document.getElementById('poll-create-view').style.display = 'none';
  document.getElementById('poll-detail-view').style.display = 'none';
  document.getElementById('polls-list-view').style.display = 'block';

  const canManage = canWrite('polls');
  document.getElementById('btn-create-poll').style.display = canManage ? 'inline-flex' : 'none';

  const {data: polls, error} = await sb.from('polls').select('*').order('created_at', {ascending:false});
  if(error) { toast('Санал хураалт ачаалахад алдаа: '+error.message, 'error'); return; }
  pollsList = polls || [];

  const wrap = document.getElementById('polls-cards-wrap');
  if(!pollsList.length) {
    wrap.innerHTML = '<div class="empty-state">Санал хураалт байхгүй байна</div>';
    return;
  }

  wrap.innerHTML = pollsList.map(p => {
    const statusTag = {
      draft: '<span class="tag" style="background:var(--text-muted);color:#fff">Ноорог</span>',
      active: '<span class="tag" style="background:rgba(16,185,129,0.15);color:#10B981;border:1px solid #10B981">Идэвхтэй</span>',
      closed: '<span class="tag" style="background:var(--danger-bg);color:var(--danger)">Хаагдсан</span>'
    }[p.status] || '';
    const typeLabel = p.poll_type === 'issue' ? 'Санал асуулга' : p.poll_type === 'rating' ? 'Үнэлгээ өгөх' : 'Ээлжит сонгууль';
    const dates = (p.starts_at && p.ends_at) ? `${p.starts_at.slice(0,10)} — ${p.ends_at.slice(0,10)}` : '';
    return `<div class="card" style="padding:16px 18px;cursor:pointer" onclick="openPollDetail(${p.id})">
      <div class="flex-between">
        <div>
          <div style="font-weight:600;font-size:14px">${esc(p.title)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${typeLabel} ${dates?'· '+dates:''}</div>
        </div>
        <div>${statusTag}</div>
      </div>
    </div>`;
  }).join('');
}

// --- ҮҮСГЭХ WIZARD ---
function openCreatePoll() {
  editingPollId = null;
  document.getElementById('polls-list-view').style.display = 'none';
  document.getElementById('poll-create-view').style.display = 'block';
  document.getElementById('poll-title').value = '';
  document.getElementById('poll-description').value = '';
  document.getElementById('poll-starts-at').value = '';
  document.getElementById('poll-ends-at').value = '';
  document.getElementById('poll-anonymous').checked = true;
  document.getElementById('poll-show-live').checked = true;
  setPollType('issue');
  document.getElementById('poll-election-max-uz').value = 1;
  document.getElementById('poll-election-max-hz').value = 1;
  currentPollQuestions = [];
  currentPollCandidatesUZ = [];
  currentPollCandidatesHZ = [];
  onPollTypeChange();
  renderIssuesList();
  renderCandidatesList('uz');
  renderCandidatesList('hz');
}

// Засварлах горимд ноорог ачаалах
async function openEditPoll(pollId) {
  const poll = pollsList.find(p=>p.id===pollId);
  if(!poll) return;
  editingPollId = pollId;

  document.getElementById('poll-detail-view').style.display = 'none';
  document.getElementById('poll-create-view').style.display = 'block';

  document.getElementById('poll-title').value = poll.title || '';
  document.getElementById('poll-description').value = poll.description || '';
  document.getElementById('poll-starts-at').value = poll.starts_at ? poll.starts_at.slice(0,16) : '';
  document.getElementById('poll-ends-at').value = poll.ends_at ? poll.ends_at.slice(0,16) : '';
  document.getElementById('poll-anonymous').checked = !!poll.anonymous;
  document.getElementById('poll-show-live').checked = !!poll.show_results_live;
  setPollType(poll.poll_type);

  const {data: questions} = await sb.from('poll_questions').select('*').eq('poll_id', pollId).order('order_num');

  if(poll.poll_type === 'issue' || poll.poll_type === 'rating') {
    currentPollQuestions = (questions||[]).map(q=>({id: q.id, text: q.question_text, dbId: q.id}));
    renderIssuesList();
  } else {
    // Election: questions[0] = УЗ, questions[1] = ХЗ (order_num-аар)
    currentPollCandidatesUZ = [];
    currentPollCandidatesHZ = [];
    for(let i=0; i<(questions||[]).length; i++) {
      const q = questions[i];
      const col = i===0 ? 'uz' : 'hz';
      const {data: options} = await sb.from('poll_options').select('*').eq('question_id', q.id).order('order_num');
      const candidates = (options||[]).filter(o=>!o.is_abstain).map(o=>({id: Date.now()+Math.random(), name: o.option_text, residentId: o.resident_id || ''}));
      if(col==='uz') {
        document.getElementById('poll-election-title-uz').value = q.question_text;
        document.getElementById('poll-election-max-uz').value = q.max_selections;
        currentPollCandidatesUZ = candidates;
      } else {
        document.getElementById('poll-election-title-hz').value = q.question_text;
        document.getElementById('poll-election-max-hz').value = q.max_selections;
        currentPollCandidatesHZ = candidates;
      }
    }
    renderCandidatesList('uz');
    renderCandidatesList('hz');
  }
}

// Хуулбарлах — openEditPoll()-оор бүх асуулт/сонголтыг pre-fill хийгээд,
// editingPollId-г null болгосноор savePoll() UPDATE биш шинэ ноорог INSERT хийнэ.
// Санал/үр дүн шилжихгүй (шинэ асуулт мөрүүд шинэ id-тайгаар үүснэ), огноог
// хоослож хэрэглэгчээр шинээр сонгуулна.
async function copyPoll(pollId) {
  if(!canCopy('polls')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  await openEditPoll(pollId);
  editingPollId = null;
  document.getElementById('poll-title').value = (document.getElementById('poll-title').value || '') + ' (хуулбар)';
  document.getElementById('poll-starts-at').value = '';
  document.getElementById('poll-ends-at').value = '';
  toast('Асуулт/сонголтууд хуулагдлаа — огноог шинэчлээд хадгална уу', 'success');
}

function closePollCreate() {
  document.getElementById('poll-create-view').style.display = 'none';
  document.getElementById('polls-list-view').style.display = 'block';
}

function setPollType(type) {
  document.getElementById('poll-type-hidden').value = type;
  const btns = {issue: document.getElementById('poll-type-btn-issue'), rating: document.getElementById('poll-type-btn-rating'), election: document.getElementById('poll-type-btn-election')};
  Object.entries(btns).forEach(([t,btn])=>{
    if(!btn) return;
    btn.style.border = type===t ? '2px solid var(--accent)' : '1px solid var(--border)';
    btn.style.background = type===t ? 'var(--accent-glow)' : 'transparent';
  });
  document.getElementById('poll-issues-wrap').style.display = (type==='issue'||type==='rating') ? 'block' : 'none';
  document.getElementById('poll-election-wrap').style.display = type==='election' ? 'block' : 'none';
}

function onPollTypeChange() {}

function addIssueQuestion() {
  currentPollQuestions.push({id: Date.now(), text: ''});
  renderIssuesList();
}

function removeIssueQuestion(id) {
  currentPollQuestions = currentPollQuestions.filter(q=>q.id!==id);
  renderIssuesList();
}

function renderIssuesList() {
  const wrap = document.getElementById('poll-issues-list');
  if(!currentPollQuestions.length) {
    wrap.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Асуулт нэмээгүй байна</div>';
    return;
  }
  wrap.innerHTML = currentPollQuestions.map((q,i)=>`
    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
      <span style="font-size:12px;color:var(--text-muted);width:24px">${i+1}.</span>
      <input type="text" value="${esc(q.text)}" placeholder="ж: Зогсоолын хураамж нэмэгдүүлэх"
        oninput="updateIssueText(${q.id}, this.value)" style="flex:1">
      <button class="btn btn-ghost btn-sm" onclick="removeIssueQuestion(${q.id})" style="color:var(--danger);display:flex;align-items:center;justify-content:center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      </button>
    </div>`).join('');
}

function updateIssueText(id, val) {
  const q = currentPollQuestions.find(x=>x.id===id);
  if(q) q.text = val;
}

function getCandidatesArr(col) {
  return col === 'uz' ? currentPollCandidatesUZ : currentPollCandidatesHZ;
}
function setCandidatesArr(col, arr) {
  if(col === 'uz') currentPollCandidatesUZ = arr;
  else currentPollCandidatesHZ = arr;
}

function addCandidate(col) {
  const arr = getCandidatesArr(col);
  arr.push({id: Date.now()+Math.random(), name: '', residentId: ''});
  renderCandidatesList(col);
}

function removeCandidate(col, id) {
  setCandidatesArr(col, getCandidatesArr(col).filter(c=>String(c.id)!==String(id)));
  renderCandidatesList(col);
}

function renderCandidatesList(col) {
  const wrap = document.getElementById('poll-candidates-list-'+col);
  const arr = getCandidatesArr(col);
  if(!arr.length) {
    wrap.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Нэр дэвшигч нэмээгүй байна</div>';
    return;
  }
  wrap.innerHTML = arr.map((c,i)=>`
    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
      <span style="font-size:12px;color:var(--text-muted);width:20px">${i+1}.</span>
      <select onchange="updateCandidateResident('${col}', '${c.id}', this.value)" style="flex:1">
        ${getResidentOptionsHTML(c.residentId)}
      </select>
      <button class="btn btn-ghost btn-sm" onclick="removeCandidate('${col}', '${c.id}')" style="color:var(--danger);display:flex;align-items:center;justify-content:center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      </button>
    </div>`).join('');
}

function updateCandidateResident(col, id, residentId) {
  const arr = getCandidatesArr(col);
  const c = arr.find(x=>String(x.id)===String(id));
  if(!c) return;
  c.residentId = residentId;
  const r = residents.find(x=>String(x.id)===String(residentId));
  c.name = r ? `${esc(r.lastname)||''} ${esc(r.firstname)||''}`.trim() : '';
}

async function savePoll() {
  const title = document.getElementById('poll-title').value.trim();
  const description = document.getElementById('poll-description').value.trim();
  const pollType = document.getElementById('poll-type-hidden').value || 'issue';
  const startsAt = document.getElementById('poll-starts-at').value;
  const endsAt = document.getElementById('poll-ends-at').value;
  const anonymous = document.getElementById('poll-anonymous').checked;
  const showLive = document.getElementById('poll-show-live').checked;

  if(!title) { toast('Гарчиг оруулна уу', 'error'); return; }

  if((pollType === 'issue' || pollType === 'rating') && currentPollQuestions.filter(q=>q.text.trim()).length === 0) {
    toast('Дор хаяж нэг асуулт нэмнэ үү', 'error'); return;
  }
  if(pollType === 'election') {
    const hasUZ = currentPollCandidatesUZ.filter(c=>c.name.trim()).length > 0;
    const hasHZ = currentPollCandidatesHZ.filter(c=>c.name.trim()).length > 0;
    if(!hasUZ && !hasHZ) {
      toast('Дор хаяж нэг баганад нэр дэвшигч нэмнэ үү', 'error'); return;
    }
  }

  let poll;
  if(editingPollId) {
    // Засварлах горим — хуучин poll-ийг шинэчлэх, асуултуудыг дахин үүсгэх
    const {data, error: updErr} = await sb.from('polls').update({
      title, description, poll_type: pollType,
      starts_at: startsAt || null, ends_at: endsAt || null,
      anonymous, show_results_live: showLive
    }).eq('id', editingPollId).select().single();
    if(updErr) { toast('Алдаа: '+updErr.message, 'error'); return; }
    poll = data;
    // Хуучин асуултуудыг устгаад дахин үүсгэнэ (cascade-р options/votes мөн устана)
    await sb.from('poll_questions').delete().eq('poll_id', poll.id);
  } else {
    const {data, error: pollErr} = await sb.from('polls').insert({
      title, description, poll_type: pollType, status: 'draft',
      starts_at: startsAt || null, ends_at: endsAt || null,
      anonymous, show_results_live: showLive
    }).select().single();
    if(pollErr) { toast('Алдаа: '+pollErr.message, 'error'); return; }
    poll = data;
  }

  if(pollType === 'issue' || pollType === 'rating') {
    for(let i=0; i<currentPollQuestions.length; i++) {
      const q = currentPollQuestions[i];
      if(!q.text.trim()) continue;
      const {data: question, error: qErr} = await sb.from('poll_questions').insert({
        poll_id: poll.id, question_text: q.text, order_num: i, max_selections: 1
      }).select().single();
      if(qErr) { toast('Асуулт хадгалахад алдаа: '+qErr.message,'error'); continue; }

      if(pollType === 'rating') {
        await sb.from('poll_options').insert(
          [1,2,3,4,5].map(n=>({question_id: question.id, option_text: String(n), order_num: n-1}))
        );
      } else {
        await sb.from('poll_options').insert([
          {question_id: question.id, option_text: 'Зөвшөөрч байна', order_num: 0},
          {question_id: question.id, option_text: 'Зөвшөөрөхгүй', order_num: 1},
          {question_id: question.id, option_text: 'Мэдэхгүй байна', order_num: 2}
        ]);
      }
    }
  } else {
    // Election: УЗ болон ХЗ — тус бүрт тусдаа question (order_num 0, 1)
    const configs = [
      {col:'uz', titleId:'poll-election-title-uz', maxId:'poll-election-max-uz', arr: currentPollCandidatesUZ, order:0},
      {col:'hz', titleId:'poll-election-title-hz', maxId:'poll-election-max-hz', arr: currentPollCandidatesHZ, order:1},
    ];
    for(const cfg of configs) {
      const candidates = cfg.arr.filter(c=>c.name.trim());
      if(!candidates.length) continue;
      const qTitle = document.getElementById(cfg.titleId).value.trim() || title;
      const maxSel = +document.getElementById(cfg.maxId).value || 1;
      const {data: question, error: qErr} = await sb.from('poll_questions').insert({
        poll_id: poll.id, question_text: qTitle, order_num: cfg.order, max_selections: maxSel
      }).select().single();
      if(qErr) { toast('Алдаа: '+qErr.message,'error'); continue; }

      const candidateOptions = candidates.map((c,i)=>({
        question_id: question.id, option_text: c.name, order_num: i, is_abstain: false,
        resident_id: c.residentId || null
      }));
      candidateOptions.push({question_id: question.id, option_text: 'Аль нь ч биш', order_num: 999, is_abstain: true});

      await sb.from('poll_options').insert(candidateOptions);
    }
  }

  toast(editingPollId ? 'Санал хураалт шинэчлэгдлээ ✓' : 'Санал хураалт ноорог хэлбэрээр хадгалагдлаа ✓', 'success');
  editingPollId = null;
  closePollCreate();
  renderPollsPage();
}

// --- ДЭЛГЭРЭНГҮЙ / САНАЛ ӨГӨХ / ҮР ДҮН ---
// Нэвтэрсэн 'ot' хэрэглэгчийн residents.id-г олох (votes.resident_id FK-д зөв утга хэрэгтэй тул apt дугаар биш)
function getMyResidentId() {
  const apt = currentProfile?.apt;
  if(!apt) return null;
  const r = residents.find(x => x && String(x.apt) === String(apt));
  return r ? r.id : null;
}

async function openPollDetail(pollId) {
  viewingPollId = pollId;
  document.getElementById('polls-list-view').style.display = 'none';
  document.getElementById('poll-detail-view').style.display = 'block';

  const poll = pollsList.find(p=>p.id===pollId);
  if(!poll) return;
  document.getElementById('poll-detail-title').textContent = poll.title;

  const {data: questions} = await sb.from('poll_questions').select('*').eq('poll_id', pollId).order('order_num');
  const body = document.getElementById('poll-detail-body');

  const canManage = canWrite('polls');
  const isOwner = currentProfile?.role === 'ot';

  let html = `<div class="card" style="padding:16px 18px;margin-bottom:16px">
    <div style="font-size:13px;color:var(--text-dim)">${esc(poll.description) || ''}</div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:8px">
      Төлөв: <strong>${poll.status === 'draft'?'Ноорог':poll.status==='active'?'Идэвхтэй':'Хаагсан'}</strong>
      ${poll.starts_at?` · Эхэлсэн: ${poll.starts_at.slice(0,10)}`:''}
      ${poll.ends_at?` · Дуусах: ${poll.ends_at.slice(0,10)}`:''}
    </div>
  </div>`;

  if(typeof canCopy === 'function' && canCopy('polls')) {
    html += `<div style="margin-bottom:16px"><button class="btn btn-outline btn-sm" onclick="copyPoll(${pollId})" title="Асуулт/сонголтуудыг хуулж, шинэ ноорог үүсгэнэ"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Хуулбарлах</button></div>`;
  }

  if(canManage && poll.status === 'draft') {
    html += `<div style="margin-bottom:16px;display:flex;gap:8px">
      <button class="btn btn-outline btn-sm" onclick="closePollDetail()">Болих</button>
      <button class="btn btn-outline btn-sm" onclick="openEditPoll(${pollId})">Засварлах</button>
      <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="deleteDraftPoll(${pollId})">Устгах</button>
      <button class="btn btn-primary btn-sm" onclick="activatePoll(${pollId})">Нийтлэх</button>
    </div>`;
  }
  if(canManage && poll.status === 'active') {
    html += `<div style="margin-bottom:16px"><button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="closePoll(${pollId})">⏹ Санал хураалт хаах</button></div>`;
  }

  const pendingQuestionsHTML = [];
  const pendingQuestionIds = [];

  for(const q of (questions||[])) {
    const {data: options} = await sb.from('poll_options').select('*').eq('question_id', q.id).order('order_num');
    const myResidentId = getMyResidentId();
    const {data: myVotes} = await sb.from('votes').select('option_id').eq('question_id', q.id).eq('resident_id', myResidentId || -1);
    const myVoteIds = (myVotes||[]).map(v=>v.option_id);
    const hasVoted = myVoteIds.length > 0;

    // Санал/үнэлгээ өгөх UI (active + owner + өгөөгүй)
    if(poll.status === 'active' && isOwner && !hasVoted) {
      const isMulti = q.max_selections > 1 ? 1 : 0;
      const isRating = poll.poll_type === 'rating';
      let optionsHTML;
      if(isRating) {
        optionsHTML = `<div style="display:flex;gap:6px" id="vote-options-${q.id}">`
          + (options||[]).sort((a,b)=>(+a.option_text)-(+b.option_text)).map(o=>`
            <button type="button" class="vote-star-btn vote-option-btn" data-question="${q.id}" data-option="${o.id}" data-value="${esc(o.option_text)}" data-multi="0"
              onclick="toggleStarRating(this)"
              style="font-size:28px;line-height:1;background:none;border:none;cursor:pointer;color:var(--text-muted);padding:0 2px">☆</button>`).join('')
          + `</div>`;
      } else {
        optionsHTML = `<div style="display:flex;flex-direction:column;gap:8px" id="vote-options-${q.id}">`
          + (options||[]).map(o=>`
            <button type="button" class="vote-option-btn" data-question="${q.id}" data-option="${o.id}" data-multi="${isMulti}"
              onclick="toggleVoteOption(this)"
              style="padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:transparent;cursor:pointer;text-align:left;font-size:13px;color:var(--text);width:100%">
              ${esc(o.option_text)}
            </button>`).join('')
          + `</div>`;
      }
      const questionBlock = `<div style="padding:16px 18px;${poll.poll_type!=='election'?'border-bottom:1px solid var(--border)':''}">
        <div style="font-weight:600;font-size:13px;margin-bottom:10px">${esc(q.question_text)}</div>
        ${optionsHTML}
      </div>`;

      if(poll.poll_type === 'election') {
        // Ээлжит сонгууль: зэрэгцээ явагдаж буй тус бүр (жишээ нь УЗ, ХЗ) бол ТУСДАА санал хураалт тул тусдаа "Санал өгөх" товчтой
        html += `<div class="card" style="padding:0;margin-bottom:12px;overflow:hidden">
          ${questionBlock}
          <div style="padding:0 18px 16px"><button class="btn btn-primary btn-sm" onclick="submitVote([${q.id}], ${poll.id}, '${poll.poll_type}')">Санал өгөх</button></div>
        </div>`;
      } else {
        // Санал асуулга/үнэлгээ: бүх асуултыг НЭГ маягтад цуглуулж, ганцхан товчоор нэг дор илгээнэ
        pendingQuestionsHTML.push(questionBlock);
        pendingQuestionIds.push(q.id);
      }
      continue;
    }

    // Үр дүн — aggregate RPC ашиглана (хэн ямар сонголт хийснийг задруулахгүй, зөвхөн нийт тоог)
    let counts = {}, totalVotes = 1, realTotalVotes = 0;
    if(poll.show_results_live || poll.status === 'closed' || canManage) {
      const {data: results} = await sb.rpc('get_poll_results', {p_question_id: q.id});
      (results||[]).forEach(r => counts[r.option_id] = r.vote_count);
      realTotalVotes = (results||[]).reduce((s,r)=>s+r.vote_count,0);
      totalVotes = realTotalVotes || 1;
    }

    if(poll.poll_type === 'rating' && (poll.show_results_live || poll.status === 'closed' || canManage)) {
      let totalStars = 0, totalCount = 0;
      (options||[]).forEach(o => { const val=+o.option_text; const cnt=counts[o.id]||0; totalStars+=val*cnt; totalCount+=cnt; });
      const avg = totalCount ? (totalStars/totalCount).toFixed(1) : '—';
      html += `<div class="card" style="padding:14px 18px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
        <div style="font-weight:600;font-size:13px">${esc(q.question_text)}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:22px;font-weight:700;color:var(--warning)">★ ${avg}</span>
          <span style="font-size:11px;color:var(--text-muted)">/5 (${totalCount} хүн үнэлсэн)</span>
        </div>
      </div>`;
      if(hasVoted) {
        html += `<div style="font-size:11px;color:var(--success);padding:0 4px 12px">✓ Та үнэлсэн байна</div>`;
      }
      continue;
    }

    html += `<div style="overflow:hidden;margin-bottom:16px">
      <table class="data-table" style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="text-align:left">${esc(q.question_text)}</th>
            <th style="text-align:right;width:80px">САНАЛ</th>
            <th style="text-align:right;width:60px">%</th>
            <th style="width:180px"></th>
          </tr>
        </thead>
        <tbody>`;

    (options||[]).forEach(o => {
      const cnt = counts[o.id] || 0;
      const pct = Math.round(cnt/totalVotes*100);
      const isMyVote = myVoteIds.includes(o.id);
      const rowBg = isMyVote ? 'background:rgba(59,130,246,0.08)' : '';
      html += `<tr>
        <td class="dt-title" style="${rowBg}">
          ${isMyVote ? '<span style="color:var(--accent);font-size:10px;margin-right:4px">✓</span>' : ''}${esc(o.option_text)}
        </td>
        <td class="dt-text dt-mono" style="text-align:right;${rowBg}">${cnt}</td>
        <td class="dt-muted dt-mono" style="text-align:right;${rowBg}">${pct}%</td>
        <td style="${rowBg}">
          <div style="height:6px;background:var(--bg-surface);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:3px"></div>
          </div>
        </td>
      </tr>`;
    });

    html += `</tbody>
        <tfoot>
          <tr style="border-top:2px solid var(--border-light);font-weight:700">
            <td class="dt-title">Өгсөн саналын нийт тоо</td>
            <td class="dt-mono" style="text-align:right">${realTotalVotes}</td>
            <td></td>
            <td></td>
          </tr>
        </tfoot>
      </table>`;
    if(hasVoted) {
      html += `<div style="font-size:11px;color:var(--success);padding:6px 10px">✓ Та санал өгсөн байна</div>`;
    }
    html += `</div>`;
  }

  // Санал асуулга/үнэлгээ төрлийн бүх хариулаагүй асуултыг НЭГ маягтад, ганцхан товчоор нэгтгэж харуулна
  if(pendingQuestionIds.length) {
    const isRatingPoll = poll.poll_type === 'rating';
    const submitLabel = isRatingPoll ? 'Илгээх' : 'Санал өгөх';
    const progressHTML = isRatingPoll ? `<div id="poll-rating-progress" data-total="${pendingQuestionIds.length}" style="font-size:11px;color:var(--text-muted);padding:12px 18px 0">0 асуултаас 0-ыг үнэлсэн</div>` : '';
    html += `<div class="card" style="padding:0;margin-bottom:16px;overflow:hidden">
      ${progressHTML}
      ${pendingQuestionsHTML.join('')}
      <div style="padding:16px 18px">
        <button class="btn btn-primary btn-sm" onclick="submitVote([${pendingQuestionIds.join(',')}], ${poll.id}, '${poll.poll_type}')">${submitLabel}</button>
      </div>
    </div>`;
  }

  body.innerHTML = html;
}

// Од сонгохтойг дарахад — тухайнаас тухайн төгсгөл хүртэлж, зөвхөн тух сонгосны одыг selected тэмдэглэнэ
function toggleStarRating(btn) {
  const qId = btn.dataset.question;
  const value = +btn.dataset.value;
  document.querySelectorAll(`.vote-star-btn[data-question="${qId}"]`).forEach(b=>{
    const bVal = +b.dataset.value;
    const active = bVal <= value;
    b.classList.toggle('selected', bVal === value);
    b.textContent = active ? '★' : '☆';
    b.style.color = active ? 'var(--warning)' : 'var(--text-muted)';
  });
  updateRatingProgress();
}
function updateRatingProgress() {
  const el = document.getElementById('poll-rating-progress');
  if(!el) return;
  const total = +el.dataset.total;
  const answered = new Set([...document.querySelectorAll('.vote-star-btn.selected')].map(b=>b.dataset.question)).size;
  el.textContent = `${total} асуултаас ${answered}-ыг үнэлсэн`;
}

function closePollDetail() {
  document.getElementById('poll-detail-view').style.display = 'none';
  document.getElementById('polls-list-view').style.display = 'block';
}

// Санал өгөх сонголтын товч дарахад — radio/checkbox биш, button-style сонголт (poll-type-btn-той адил загвар)
function toggleVoteOption(btn) {
  const qId = btn.dataset.question;
  const isMulti = btn.dataset.multi === '1';
  const group = document.querySelectorAll(`.vote-option-btn[data-question="${qId}"]`);
  if(!isMulti) {
    group.forEach(b => {
      b.classList.remove('selected');
      b.style.border = '1px solid var(--border)';
      b.style.background = 'transparent';
    });
    btn.classList.add('selected');
  } else {
    btn.classList.toggle('selected');
  }
  btn.style.border = btn.classList.contains('selected') ? '2px solid var(--accent)' : '1px solid var(--border)';
  btn.style.background = btn.classList.contains('selected') ? 'var(--accent-glow)' : 'transparent';
}

async function submitVote(questionIds, pollId, pollType) {
  const residentApt = currentProfile?.apt;
  if(!residentApt) { toast('Таны профайлд тоот холбогдоогүй байна', 'error'); return; }
  const myResidentId = getMyResidentId();
  if(!myResidentId) { toast('Таны тоотод харгалзах сууц өмчлөгчийн бүртгэл олдсонгүй', 'error'); return; }

  const rows = [];
  questionIds.forEach(qId => {
    const selected = [...document.querySelectorAll(`.vote-option-btn[data-question="${qId}"].selected`)].map(el=>+el.dataset.option);
    selected.forEach(optionId => rows.push({
      poll_id: pollId, question_id: qId, option_id: optionId,
      resident_id: myResidentId, apt: residentApt, poll_type: pollType
    }));
  });

  if(!rows.length) { toast('Сонголт хийнэ үү', 'error'); return; }

  const {error} = await sb.from('votes').insert(rows);
  if(error) {
    if(error.code === '23505') toast('Та аль хэдийн санал өгсөн байна', 'error');
    else toast('Алдаа: '+error.message, 'error');
    return;
  }
  toast('Санал амжилттай бүртгэгдлээ ✓ Баярлалаа!', 'success');
  openPollDetail(pollId);
}

async function activatePoll(pollId) {
  if(!confirm('Санал хураалтыг идэвхжүүлэх үү? Идэвхжсэний дараа Сууц өмчлөгчид санал өгөх боломжтой болно.')) return;
  const {error} = await sb.from('polls').update({status:'active'}).eq('id', pollId);
  if(error) { toast('Алдаа: '+error.message, 'error'); return; }
  toast('Санал хураалт идэвхжлээ ✓', 'success');
  openPollDetail(pollId);
  renderPollsPage();
}

async function closePoll(pollId) {
  if(!confirm('Санал хураалтыг хаах уу? Хаасны дараа сэргээх боломжгүй.')) return;
  const {error} = await sb.from('polls').update({status:'closed'}).eq('id', pollId);
  if(error) { toast('Алдаа: '+error.message, 'error'); return; }
  toast('Санал хураалт хаагдлаа','success');
  openPollDetail(pollId);
  renderPollsPage();
}

// Зөвхөн ноорог (draft) санал хураалтыг бүрэн устгана.
// Нийтлэгдсэн (active/closed) санал хураалтыг устгах боломжгүй — архивлагдсан хэвээр үлдэнэ.
async function deleteDraftPoll(pollId) {
  const poll = pollsList.find(p=>p.id===pollId);
  if(!poll || poll.status !== 'draft') {
    toast('Зөвхөн ноорог санал хураалтыг устгах боломжтой', 'error');
    return;
  }
  if(!confirm('Энэ ноорог санал хураалтыг бүрмөсөн устгах уу?')) return;
  const {error} = await sb.from('polls').delete().eq('id', pollId);
  if(error) { toast('Алдаа: '+error.message, 'error'); return; }
  toast('Ноорог устгагдлаа', 'success');
  closePollDetail();
  renderPollsPage();
}

// Санал хураалт/Үнэлгээний дэлгэрэнгүй хуудсанд асуулт бүр өөрийн
// тусдаа <table> үр дүнтэй тул (ганц exportTableToXlsx()-ээр
// хамрагдахгүй) — бүх хүснэгэтийг тус тусын sheet болгож нэг Excel
// файлд нэгтгэнэ.
function exportPollDetailToXlsx() {
  const container = document.getElementById('poll-detail-body');
  if(!container) return;
  const tables = container.querySelectorAll('table');
  if(!tables.length) { toast('Экспортлох үр дүн олдсонгүй', 'error'); return; }
  try {
    const wb = XLSX.utils.book_new();
    tables.forEach((t, i) => {
      const ws = XLSX.utils.table_to_sheet(t, {raw:true});
      XLSX.utils.book_append_sheet(wb, ws, `Асуулт ${i+1}`);
    });
    const title = (document.getElementById('poll-detail-title')?.textContent || 'Санал_хураалт').replace(/[\\/*?:[\]]/g,'');
    XLSX.writeFile(wb, `${title}.xlsx`);
    toast('Экспорт хийгдлээ ✓', 'success');
  } catch(e) {
    toast('Экспортод алдаа гарлаа: '+e.message, 'error');
  }
}
