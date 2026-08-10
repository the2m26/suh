import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/dbUtils';
import { CHART_OF_ACCOUNTS, ACCOUNT_CATEGORIES } from '../lib/chartOfAccounts';

function buildAccountGroups() {
  const groups = {};
  CHART_OF_ACCOUNTS.forEach((a) => {
    const label = ACCOUNT_CATEGORIES[a.category]?.label || a.category;
    (groups[label] = groups[label] || []).push(a);
  });
  return groups;
}

const CALC_TYPE_LABELS = { simple: 'Энгийн (нэг хувь)', split: 'Хуваагдсан (ажилтан/ажил олгогч)', progressive: 'Шаталсан (шатлалт)' };
const FREQ_LABELS = { monthly: 'Сар бүр', quarterly: 'Улирал бүр', yearly: 'Жилд нэг удаа' };

export default function NbbSettings() {
  const { currentUser, currentProfile } = useAuth();
  const [tab, setTab] = useState('tax');
  const [taxTypes, setTaxTypes] = useState([]);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: tt }, { data: sc }] = await Promise.all([
      sb.from('tax_types').select('*').order('code'),
      sb.from('salary_components').select('*').order('code'),
    ]);
    setTaxTypes(tt || []);
    setComponents(sc || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="page page-wide">
      <div className="gate-tabs">
        <button className={'gate-tab' + (tab === 'tax' ? ' active' : '')} onClick={() => setTab('tax')}>Татварын төрлүүд</button>
        <button className={'gate-tab' + (tab === 'components' ? ' active' : '')} onClick={() => setTab('components')}>Цалингийн нэмэгдэл</button>
      </div>
      {loading ? <div className="empty-state">Ачаалж байна...</div> : tab === 'tax' ? (
        <TaxTypesTab taxTypes={taxTypes} currentUser={currentUser} currentProfile={currentProfile} onReload={load} />
      ) : (
        <SalaryComponentsTab components={components} currentUser={currentUser} currentProfile={currentProfile} onReload={load} />
      )}
    </div>
  );
}

function TaxTypesTab({ taxTypes, currentUser, currentProfile, onReload }) {
  const [editing, setEditing] = useState(null);

  async function handleToggle(t) {
    const { error } = await sb.from('tax_types').update({ enabled: !t.enabled }).eq('code', t.code);
    if (error) { alert('Шинэчлэхэд алдаа гарлаа: ' + error.message); return; }
    onReload();
  }
  async function handleDelete(t) {
    if (!confirm('Энэ татвар/шимтгэлийг устгах уу?')) return;
    const { error } = await sb.from('tax_types').delete().eq('code', t.code);
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'nbb-settings', t.code, t.code);
    onReload();
  }

  if (editing) {
    return <TaxTypeForm taxType={editing === 'new' ? null : editing} currentUser={currentUser} currentProfile={currentProfile} onClose={() => { setEditing(null); onReload(); }} />;
  }

  return (
    <>
      <div className="page-header-row"><div /><button className="btn-primary" onClick={() => setEditing('new')}>+ Шинэ татвар нэмэх</button></div>
      {!taxTypes.length && <div className="empty-state">Татвар/шимтгэл бүртгэгдээгүй байна</div>}
      {taxTypes.map((t) => (
        <div key={t.code} className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div className="page-header-row" style={{ marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{t.name}</div>
              <div className="dt-muted" style={{ fontSize: 11, marginTop: 2 }}>Код: {t.code} · {CALC_TYPE_LABELS[t.calculation_type]} · Суурь данс: {t.base_account || '—'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={'tag' + (t.enabled ? ' tag-success' : '')} style={{ cursor: 'pointer' }} onClick={() => handleToggle(t)}>{t.enabled ? 'Идэвхтэй' : 'Идэвхгүй'}</span>
              <button className="btn-ghost-sm" onClick={() => setEditing(t)}>✎</button>
              <button className="btn-ghost-sm danger" onClick={() => handleDelete(t)}>✕</button>
            </div>
          </div>
          {t.calculation_type === 'split' ? (
            <>
              <div className="page-header-row"><span className="dt-muted">Ажилтны хувь хэмжээ</span><span>{t.employee_rate_percent}%</span></div>
              <div className="page-header-row"><span className="dt-muted">Ажил олгогчийн хувь хэмжээ</span><span>{t.employer_rate_percent}%</span></div>
            </>
          ) : t.calculation_type === 'simple' ? (
            <div className="page-header-row"><span className="dt-muted">Хувь хэмжээ</span><span>{t.rate_percent}%</span></div>
          ) : null}
          {t.note && <div className="dt-muted" style={{ fontSize: 11, marginTop: 8 }}>⚠️ {t.note}</div>}
        </div>
      ))}
    </>
  );
}

function TaxTypeForm({ taxType, currentUser, currentProfile, onClose }) {
  const isEdit = !!taxType;
  const accountGroups = buildAccountGroups();
  const [code, setCode] = useState(taxType?.code || '');
  const [name, setName] = useState(taxType?.name || '');
  const [calcType, setCalcType] = useState(taxType?.calculation_type || 'simple');
  const [rate, setRate] = useState(taxType?.rate_percent || '');
  const [empRate, setEmpRate] = useState(taxType?.employee_rate_percent || '');
  const [erRate, setErRate] = useState(taxType?.employer_rate_percent || '');
  const [baseAccount, setBaseAccount] = useState(taxType?.base_account || '');
  const [enabled, setEnabled] = useState(taxType ? !!taxType.enabled : false);
  const [note, setNote] = useState(taxType?.note || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!code.trim() || !name.trim()) { alert('Код болон нэрийг бөглөнө үү'); return; }
    if (calcType === 'simple' && !rate) { alert('Хувь хэмжээг оруулна уу'); return; }
    if (calcType === 'split' && (!empRate || !erRate)) { alert('Хоёр талын хувь хэмжээг оруулна уу'); return; }
    setSaving(true);
    const row = {
      code: code.trim(), name: name.trim(), calculation_type: calcType,
      rate_percent: calcType === 'simple' ? (+rate || null) : null,
      employee_rate_percent: calcType === 'split' ? (+empRate || null) : null,
      employer_rate_percent: calcType === 'split' ? (+erRate || null) : null,
      base_account: baseAccount || null, enabled, note: note.trim() || null,
    };
    const { error } = await sb.from('tax_types').upsert(row, { onConflict: 'code' });
    if (error) { setSaving(false); alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'edit', 'nbb-settings', code.trim(), `${name.trim()} (${code.trim()})`);
    setSaving(false);
    onClose();
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row"><h2>{isEdit ? 'Татвар засах' : 'Шинэ татвар нэмэх'}</h2><button className="btn-ghost" onClick={onClose}>← Буцах</button></div>
      <div className="field-row">
        <label className="field"><span>Код</span><input value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} /></label>
        <label className="field"><span>Нэр</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      </div>
      <label className="field"><span>Тооцооллын төрөл</span>
        <select value={calcType} onChange={(e) => setCalcType(e.target.value)}>
          <option value="simple">Энгийн (нэг хувь)</option>
          <option value="split">Хуваагдсан (ажилтан/ажил олгогч)</option>
          <option value="progressive">Шаталсан (шатлалт)</option>
        </select>
      </label>
      {calcType === 'simple' && <label className="field"><span>Хувь хэмжээ (%)</span><input type="number" step="0.001" value={rate} onChange={(e) => setRate(e.target.value)} /></label>}
      {calcType === 'split' && (
        <div className="field-row">
          <label className="field"><span>Ажилтны хувь (%)</span><input type="number" step="0.001" value={empRate} onChange={(e) => setEmpRate(e.target.value)} /></label>
          <label className="field"><span>Ажил олгогчийн хувь (%)</span><input type="number" step="0.001" value={erRate} onChange={(e) => setErRate(e.target.value)} /></label>
        </div>
      )}
      {calcType === 'progressive' && <div className="dt-muted" style={{ marginBottom: 14 }}>Шаталсан тооцоолол tax_brackets хүснэгэлээр удирдагдана (энд хувь хэмжээ хамаарахгүй).</div>}
      <label className="field"><span>Суурь данс</span>
        <select value={baseAccount} onChange={(e) => setBaseAccount(e.target.value)}>
          <option value="">— Сонгох —</option>
          {Object.entries(accountGroups).map(([group, accs]) => (
            <optgroup key={group} label={group}>
              {accs.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Идэвхтэй
      </label>
      <label className="field"><span>Тэмдэглэл</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="form-actions"><button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button></div>
    </div>
  );
}

function SalaryComponentsTab({ components, currentUser, currentProfile, onReload }) {
  const [editing, setEditing] = useState(null);

  async function handleToggle(c) {
    const { error } = await sb.from('salary_components').update({ enabled: !c.enabled }).eq('code', c.code);
    if (error) { alert('Шинэчлэхэд алдаа гарлаа: ' + error.message); return; }
    onReload();
  }
  async function handleDelete(c) {
    if (!confirm('Энэ нэмэгдлийг устгах уу? Ажилтнуудын одоо байгаа хэрэглээ ч мөн устгагдана.')) return;
    const { error } = await sb.from('salary_components').delete().eq('code', c.code);
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'nbb-settings', c.code, c.code);
    onReload();
  }

  if (editing) {
    return <SalaryComponentForm component={editing === 'new' ? null : editing} currentUser={currentUser} currentProfile={currentProfile} onClose={() => { setEditing(null); onReload(); }} />;
  }

  return (
    <>
      <div className="page-header-row"><div /><button className="btn-primary" onClick={() => setEditing('new')}>+ Шинэ нэмэгдэл нэмэх</button></div>
      {!components.length && <div className="empty-state">Нэмэгдэл бүртгэгдээгүй байна</div>}
      {components.map((c) => (
        <div key={c.code} className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div className="page-header-row" style={{ marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{c.name}</div>
              <div className="dt-muted" style={{ fontSize: 11, marginTop: 2 }}>Код: {c.code} · Дт данс: {c.expense_account || '—'} · {FREQ_LABELS[c.frequency] || 'Сар бүр'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={'tag' + (c.enabled ? ' tag-success' : '')} style={{ cursor: 'pointer' }} onClick={() => handleToggle(c)}>{c.enabled ? 'Идэвхтэй' : 'Идэвхгүй'}</span>
              <button className="btn-ghost-sm" onClick={() => setEditing(c)}>✎</button>
              <button className="btn-ghost-sm danger" onClick={() => handleDelete(c)}>✕</button>
            </div>
          </div>
          <div className="page-header-row"><span className="dt-muted">Дүн ({(FREQ_LABELS[c.frequency] || 'Сар бүр').toLowerCase()})</span><span>{Math.round(c.amount).toLocaleString()}₮</span></div>
          <div className="page-header-row"><span className="dt-muted">ХХОАТ-д тооцох</span><span>{c.hhoat_taxable ? 'Тийм' : 'Үгүй'}</span></div>
          <div className="page-header-row"><span className="dt-muted">НДШ-д тооцох</span><span>{c.ndsh_taxable ? 'Тийм' : 'Үгүй'}</span></div>
          {c.note && <div className="dt-muted" style={{ fontSize: 11, marginTop: 8 }}>⚠️ {c.note}</div>}
        </div>
      ))}
    </>
  );
}

function SalaryComponentForm({ component, currentUser, currentProfile, onClose }) {
  const isEdit = !!component;
  const accountGroups = buildAccountGroups();
  const [code, setCode] = useState(component?.code || '');
  const [name, setName] = useState(component?.name || '');
  const [frequency, setFrequency] = useState(component?.frequency || 'monthly');
  const [amount, setAmount] = useState(component?.amount || '');
  const [expenseAccount, setExpenseAccount] = useState(component?.expense_account || '');
  const [hhoatTaxable, setHhoatTaxable] = useState(component ? !!component.hhoat_taxable : true);
  const [ndshTaxable, setNdshTaxable] = useState(component ? !!component.ndsh_taxable : true);
  const [enabled, setEnabled] = useState(component ? !!component.enabled : true);
  const [note, setNote] = useState(component?.note || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!code.trim() || !name.trim()) { alert('Код болон нэрийг бөглөнө үү'); return; }
    setSaving(true);
    const row = {
      code: code.trim(), name: name.trim(), frequency, amount: +amount || 0,
      expense_account: expenseAccount || null, hhoat_taxable: hhoatTaxable, ndsh_taxable: ndshTaxable,
      enabled, note: note.trim() || null,
    };
    const { error } = await sb.from('salary_components').upsert(row, { onConflict: 'code' });
    if (error) { setSaving(false); alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'edit', 'nbb-settings', code.trim(), `${name.trim()} (${code.trim()})`);
    setSaving(false);
    onClose();
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row"><h2>{isEdit ? 'Нэмэгдэл засах' : 'Шинэ нэмэгдэл нэмэх'}</h2><button className="btn-ghost" onClick={onClose}>← Буцах</button></div>
      <div className="field-row">
        <label className="field"><span>Код</span><input value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} /></label>
        <label className="field"><span>Нэр</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Давтамж</span>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="monthly">Сар бүр</option>
            <option value="quarterly">Улирал бүр</option>
            <option value="yearly">Жилд нэг удаа</option>
          </select>
        </label>
        <label className="field"><span>Дүн (₮)</span><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      </div>
      <label className="field"><span>Зардлын данс</span>
        <select value={expenseAccount} onChange={(e) => setExpenseAccount(e.target.value)}>
          <option value="">— Сонгох —</option>
          {Object.entries(accountGroups).map(([group, accs]) => (
            <optgroup key={group} label={group}>
              {accs.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label><input type="checkbox" checked={hhoatTaxable} onChange={(e) => setHhoatTaxable(e.target.checked)} /> ХХОАТ-д тооцох</label>
        <label><input type="checkbox" checked={ndshTaxable} onChange={(e) => setNdshTaxable(e.target.checked)} /> НДШ-д тооцох</label>
        <label><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Идэвхтэй</label>
      </div>
      <label className="field"><span>Тэмдэглэл</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="form-actions"><button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button></div>
    </div>
  );
}
