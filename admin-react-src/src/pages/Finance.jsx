import { useCallback, useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { logActivity } from '../lib/dbUtils';
import { accountingRecordIncome, accountingRecordExpense } from '../lib/accountingBridge';
import { getAccountByCode } from '../lib/chartOfAccounts';
import { EXPENSE_CATS } from '../lib/financeCategories';

function fmtTxDateTime(t) {
  const d = new Date(t.date);
  if (isNaN(d)) return t.date || '—';
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p2(d.getMonth() + 1)}/${p2(d.getDate())}`;
}
function methodName(m) {
  return { cash: 'Бэлэн', bank: 'Шилжүүлэг', qpay: 'QPay' }[m] || m || '—';
}

export default function Finance() {
  const { currentUser, currentProfile } = useAuth();
  const { canAdd, canWrite } = usePermissions();
  const [tab, setTab] = useState('income');
  const [transactions, setTransactions] = useState([]);
  const [residents, setResidents] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [clientele, setClientele] = useState([]);
  const [incomeSubcats, setIncomeSubcats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: tx }, { data: res }, { data: biz }, { data: cl }, { data: subcats }] = await Promise.all([
      sb.from('transactions').select('*'),
      sb.from('residents').select('id, apt, firstname, lastname'),
      sb.from('businesses').select('id, name'),
      sb.from('clientele').select('id, legal_name'),
      sb.from('income_subcategories').select('*').order('sort_order'),
    ]);
    setTransactions(tx || []);
    setResidents(res || []);
    setBusinesses(biz || []);
    setClientele((cl || []).map((c) => ({ id: c.id, legalName: c.legal_name })));
    setIncomeSubcats(subcats || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const canAddTx = canAdd('transactions');
  const canManageSubcats = currentProfile?.role === 'admin' || canWrite('accounting');

  return (
    <div className="page page-wide">
      <div className="page-header-row">
        <h2>Гүйлгээний бүртгэл</h2>
        {canAddTx && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-outline" onClick={() => setAdding('income')}>+ Орлого нэмэх</button>
            <button className="btn-primary" onClick={() => setAdding('expense')}>+ Зарлага нэмэх</button>
          </div>
        )}
      </div>
      <div className="gate-tabs">
        <button className={'gate-tab' + (tab === 'income' ? ' active' : '')} onClick={() => setTab('income')}>Орлого</button>
        <button className={'gate-tab' + (tab === 'expense' ? ' active' : '')} onClick={() => setTab('expense')}>Зарлага</button>
        {canManageSubcats && <button className={'gate-tab' + (tab === 'subcats' ? ' active' : '')} onClick={() => setTab('subcats')}>Орлогын дэд ангилал</button>}
      </div>

      {loading ? <div className="empty-state">Ачаалж байна...</div> : tab === 'income' ? (
        <IncomeTab transactions={transactions} residents={residents} businesses={businesses} />
      ) : tab === 'expense' ? (
        <ExpenseTab transactions={transactions} clientele={clientele} />
      ) : (
        <IncomeSubcatsTab incomeSubcats={incomeSubcats} currentUser={currentUser} currentProfile={currentProfile} onReload={load} />
      )}

      {adding && (
        <AddTransactionModal
          type={adding}
          incomeSubcats={incomeSubcats}
          clientele={clientele}
          currentUser={currentUser}
          currentProfile={currentProfile}
          onClose={() => { setAdding(null); load(); }}
        />
      )}
    </div>
  );
}

function IncomeTab({ transactions, residents, businesses }) {
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [day, setDay] = useState('');
  const [query, setQuery] = useState('');

  const years = [...new Set(transactions.filter((t) => t && t.type === 'income' && t.year).map((t) => t.year))].sort((a, b) => b - a);
  const q = query.trim().toLowerCase();

  const list = useMemo(() => transactions.filter((t) => {
    if (!t || t.type !== 'income') return false;
    if (month && t.month != month) return false;
    if (year && t.year != year) return false;
    if (day) {
      const parts = (t.date || '').split('-');
      if (!(parts.length === 3 && +parts[2] === +day)) return false;
    }
    if (q) {
      const r = residents.find((x) => String(x.apt) === String(t.apt));
      const hay = `${t.apt || ''} ${r ? `${r.firstname || ''}${r.lastname || ''}` : ''} ${t.desc || ''} ${t.subcat || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b.id - a.id), [transactions, month, year, day, q, residents]);

  return (
    <>
      <div className="gate-filters">
        <input placeholder="Хайх (тоот, нэр, тайлбар)..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Бүх сар</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}-р сар</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">Бүх он</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={day} onChange={(e) => setDay(e.target.value)}>
          <option value="">Бүх өдөр</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Огноо</th><th>Тоот/Нэр</th><th>Тайлбар</th><th>Данс</th><th className="ta-right">Дүн</th><th>Хэлбэр</th></tr></thead>
          <tbody>
            {list.map((t) => {
              let lbl;
              if (t.category === 'business' && t.businessId) {
                const b = businesses.find((x) => x.id === t.businessId);
                lbl = b ? b.name : '—';
              } else {
                const r = residents.find((x) => String(x.apt) === String(t.apt));
                lbl = r ? String(r.apt) : String(t.apt || '—');
              }
              const acctCode = t.category === 'business' ? '5400' : '5100';
              const acct = getAccountByCode(acctCode);
              return (
                <tr key={t.id}>
                  <td className="dt-muted dt-mono">{fmtTxDateTime(t)}</td>
                  <td className="dt-title dt-mono">{lbl}</td>
                  <td className="dt-text">{t.desc}</td>
                  <td className="dt-mono" style={{ fontSize: 11 }} title={acct?.name || ''}>{acctCode}</td>
                  <td className="dt-mono ta-right" style={{ color: 'var(--success)' }}>{t.amount.toLocaleString()}</td>
                  <td className="dt-text">{methodName(t.method)}</td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={6} className="empty-state">Орлого байхгүй</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ExpenseTab({ transactions, clientele }) {
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [day, setDay] = useState('');
  const [query, setQuery] = useState('');

  const years = [...new Set(transactions.filter((t) => t && t.type === 'expense' && t.year).map((t) => t.year))].sort((a, b) => b - a);
  const q = query.trim().toLowerCase();

  const list = useMemo(() => transactions.filter((t) => {
    if (!t || t.type !== 'expense') return false;
    if (month && t.month != month) return false;
    if (year && t.year != year) return false;
    if (day) {
      const parts = (t.date || '').split('-');
      if (!(parts.length === 3 && +parts[2] === +day)) return false;
    }
    if (q && !(t.subcat || '').toLowerCase().includes(q) && !(t.desc || '').toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => b.id - a.id), [transactions, month, year, day, q]);

  return (
    <>
      <div className="gate-filters">
        <input placeholder="Хайх (ангилал, тайлбар)..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Бүх сар</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}-р сар</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">Бүх он</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={day} onChange={(e) => setDay(e.target.value)}>
          <option value="">Бүх өдөр</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Огноо</th><th>Ангилал</th><th>Харилцагч</th><th>Тайлбар</th><th className="ta-right">Дүн</th></tr></thead>
          <tbody>
            {list.map((t) => {
              const cl = t.clienteleId ? clientele.find((c) => c.id === t.clienteleId) : null;
              return (
                <tr key={t.id}>
                  <td className="dt-muted dt-mono">{fmtTxDateTime(t)}</td>
                  <td className="dt-title">{t.subcat || t.desc}</td>
                  <td className="dt-text">{cl ? cl.legalName : '—'}</td>
                  <td className="dt-text">{(t.desc && t.desc !== t.subcat) ? t.desc : ''}</td>
                  <td className="dt-mono ta-right" style={{ color: 'var(--danger)' }}>{t.amount.toLocaleString()}</td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={5} className="empty-state">Зарлага байхгүй</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function IncomeSubcatsTab({ incomeSubcats, currentUser, currentProfile, onReload }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit(c) { setEditing(c || 'new'); setName(c ? c.name : ''); }

  async function handleSave() {
    if (!name.trim()) { alert('Дэд ангиллын нэрийг оруулна уу'); return; }
    setSaving(true);
    const isEdit = editing !== 'new';
    const { error } = isEdit
      ? await sb.from('income_subcategories').update({ name: name.trim() }).eq('id', editing.id)
      : await sb.from('income_subcategories').insert({ name: name.trim(), sort_order: incomeSubcats.length + 1 });
    if (error) { setSaving(false); alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, isEdit ? 'edit' : 'add', 'nbb-settings', isEdit ? editing.id : null, name.trim());
    setSaving(false);
    setEditing(null);
    onReload();
  }
  async function handleDelete(c) {
    if (!confirm('Устгах уу?')) return;
    const { error } = await sb.from('income_subcategories').delete().eq('id', c.id);
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'nbb-settings', c.id, c.name);
    onReload();
  }

  return (
    <>
      <div className="page-header-row"><div /><button className="btn-primary" onClick={() => startEdit(null)}>+ Дэд ангилал нэмэх</button></div>
      {editing && (
        <div className="wizard-row" style={{ marginBottom: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Дэд ангиллын нэр" />
          <button className="btn-primary btn-sm" disabled={saving} onClick={handleSave}>Хадгалах</button>
          <button className="btn-ghost-sm" onClick={() => setEditing(null)}>Болих</button>
        </div>
      )}
      {!incomeSubcats.length && <div className="empty-state">Дэд ангилал бүртгэгдээгүй байна</div>}
      {incomeSubcats.map((c) => (
        <div key={c.id} className="card" style={{ padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600 }}>{c.name}</div>
          <div>
            <button className="btn-ghost-sm" onClick={() => startEdit(c)}>✎</button>
            <button className="btn-ghost-sm danger" onClick={() => handleDelete(c)}>✕</button>
          </div>
        </div>
      ))}
    </>
  );
}

function AddTransactionModal({ type, incomeSubcats, clientele, currentUser, currentProfile, onClose }) {
  const [category, setCategory] = useState(type === 'income' ? (incomeSubcats[0]?.name || '') : (EXPENSE_CATS[Object.keys(EXPENSE_CATS)[0]][0]));
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [clienteleId, setClienteleId] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!amount || +amount <= 0) { alert('Дүн оруулна уу'); return; }
    setSaving(true);
    const d = new Date(date);
    const month = d.getMonth() + 1, year = d.getFullYear();
    const finalDesc = desc.trim() || category;
    const row = {
      apt: null, desc: finalDesc, subcat: category, type, amount: +amount,
      method: 'bank', ref: '', month, year, date,
      status: 'completed', category: type,
      clienteleId: type === 'expense' && clienteleId ? +clienteleId : null,
    };
    const { error } = await sb.from('transactions').insert(row);
    if (error) { setSaving(false); alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }

    const res = type === 'expense'
      ? await accountingRecordExpense(category, +amount, date, finalDesc)
      : await accountingRecordIncome(category, +amount, date, finalDesc);
    if (!res.success) console.warn('Journal entry үүсгэхэд алдаа:', res.error);

    await logActivity(currentUser, currentProfile, 'add', 'transactions', null, `${finalDesc} — ${(+amount).toLocaleString()}₮`);
    setSaving(false);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="page-header-row"><h2>{type === 'expense' ? 'Зарлага нэмэх' : 'Орлого нэмэх'}</h2><button className="btn-ghost" onClick={onClose}>✕</button></div>
        <label className="field"><span>Ангилал</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {type === 'income'
              ? incomeSubcats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)
              : Object.entries(EXPENSE_CATS).map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map((item) => <option key={item} value={item}>{item}</option>)}
                </optgroup>
              ))}
          </select>
        </label>
        <label className="field"><span>Дүн</span><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label className="field"><span>Тайлбар</span><input value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        <label className="field"><span>Огноо</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        {type === 'expense' && (
          <label className="field"><span>Харилцагч (сонголттой)</span>
            <select value={clienteleId} onChange={(e) => setClienteleId(e.target.value)}>
              <option value="">— Сонгохгүй —</option>
              {clientele.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
            </select>
          </label>
        )}
        <div className="form-actions">
          <button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button>
        </div>
      </div>
    </div>
  );
}
