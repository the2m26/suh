import { useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabase';
import { CHART_OF_ACCOUNTS, ACCOUNT_CATEGORIES } from '../lib/chartOfAccounts';
import { getTrialBalance, getLedger, generateCashFlowStatement } from '../lib/accountingReports';

export default function AccountingReports() {
  const [tab, setTab] = useState('trial');
  const [journalEntries, setJournalEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await sb
        .from('journal_entries')
        .select('id, entry_date, description, reference, journal_lines(account_code, debit, credit, party)')
        .order('entry_date', { ascending: true })
        .order('id', { ascending: true });
      if (error) { console.error('Journal дата ачаалахад алдаа:', error.message); setLoading(false); return; }
      setJournalEntries((data || []).map((e) => ({
        id: e.id, date: e.entry_date, description: e.description, reference: e.reference,
        lines: (e.journal_lines || []).map((l) => ({ account: l.account_code, debit: +l.debit, credit: +l.credit, party: l.party })),
      })));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="page page-wide">
      <div className="gate-tabs">
        <button className={'gate-tab' + (tab === 'trial' ? ' active' : '')} onClick={() => setTab('trial')}>Тэнцэл шалгах хүснэгэт</button>
        <button className={'gate-tab' + (tab === 'ledger' ? ' active' : '')} onClick={() => setTab('ledger')}>Дэвтэр (данс тус бүр)</button>
        <button className={'gate-tab' + (tab === 'journal' ? ' active' : '')} onClick={() => setTab('journal')}>Ерөнхий журнал</button>
        <button className={'gate-tab' + (tab === 'cashflow' ? ' active' : '')} onClick={() => setTab('cashflow')}>Мөнгөн гүйлгээний урсгал</button>
      </div>
      {loading ? <div className="empty-state">Ачаалж байна...</div> : tab === 'trial' ? (
        <TrialBalanceTab journalEntries={journalEntries} />
      ) : tab === 'ledger' ? (
        <LedgerTab journalEntries={journalEntries} />
      ) : tab === 'cashflow' ? (
        <CashFlowTab journalEntries={journalEntries} />
      ) : (
        <GeneralJournalTab journalEntries={journalEntries} />
      )}
    </div>
  );
}

function CashFlowTab({ journalEntries }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const cf = useMemo(() => generateCashFlowStatement(journalEntries, { fromDate: start, toDate: end }), [journalEntries, start, end]);

  function rowsHtml(rows) {
    return rows.map((r) => (
      <div key={r.line} className="page-header-row" style={{ paddingLeft: 16, marginBottom: 3 }}>
        <span className="dt-text">{r.label}</span>
        <span className="dt-mono">{r.amount.toLocaleString()}</span>
      </div>
    ));
  }

  return (
    <>
      <div className="gate-filters">
        <select value={year} onChange={(e) => setYear(+e.target.value)}>
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(+e.target.value)}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}-р сар</option>)}
        </select>
      </div>
      <div className="dt-muted" style={{ marginBottom: 14 }}>{cf.reconciles ? <span className="status-ok">✓ Тохирч байна</span> : <span style={{ color: 'var(--danger)' }}>✗ Зөрүүтэй байна</span>}</div>

      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>1. Үндсэн үйл ажиллагааны мөнгөн гүйлгээ</div>
        {cf.operating.rows.length ? rowsHtml(cf.operating.rows) : <div className="dt-muted">Хөдөлгөөнгүй</div>}
        <div className="page-header-row" style={{ fontWeight: 700, marginTop: 6 }}><span>Цэвэр</span><span className="dt-mono">{cf.operating.total.toLocaleString()}</span></div>
      </div>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>2. Хөрөнгө оруулалтын үйл ажиллагааны мөнгөн гүйлгээ</div>
        {cf.investing.rows.length ? rowsHtml(cf.investing.rows) : <div className="dt-muted">Хөдөлгөөнгүй</div>}
        <div className="page-header-row" style={{ fontWeight: 700, marginTop: 6 }}><span>Цэвэр</span><span className="dt-mono">{cf.investing.total.toLocaleString()}</span></div>
      </div>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>3. Санхүүгийн үйл ажиллагааны мөнгөн гүйлгээ</div>
        {cf.financing.rows.length ? rowsHtml(cf.financing.rows) : <div className="dt-muted">Хөдөлгөөнгүй</div>}
        <div className="page-header-row" style={{ fontWeight: 700, marginTop: 6 }}><span>Цэвэр</span><span className="dt-mono">{cf.financing.total.toLocaleString()}</span></div>
      </div>
      <div className="card" style={{ padding: 16 }}>
        <div className="page-header-row" style={{ fontWeight: 700 }}><span>Бүх цэвэр мөнгөн гүйлгээ</span><span className="dt-mono">{cf.netChange.toLocaleString()}</span></div>
        <div className="page-header-row"><span className="dt-muted">Мөнгөний эхний үлдэгдэл</span><span className="dt-mono">{cf.beginningBalance.toLocaleString()}</span></div>
        <div className="page-header-row" style={{ fontWeight: 700, borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}><span>Мөнгөний эцсийн үлдэгдэл</span><span className="dt-mono">{cf.endingBalance.toLocaleString()}</span></div>
      </div>
    </>
  );
}

function TrialBalanceTab({ journalEntries }) {
  const tb = useMemo(() => getTrialBalance(journalEntries), [journalEntries]);
  if (!tb.rows.length) return <div className="empty-state">Хөдөлгөөн бүхий данс алга</div>;
  return (
    <>
      <div className="dt-muted" style={{ marginBottom: 10 }}>
        {tb.balanced ? <span className="status-ok">✓ Тэнцвэртэй</span> : <span style={{ color: 'var(--danger)' }}>⚠ Тэнцвэргүй — Дт нийлбэр Кт-тэй тэнцүү биш</span>}
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Код</th><th>Нэр</th><th>Төрөл</th><th className="ta-right">Дт</th><th className="ta-right">Кт</th></tr></thead>
          <tbody>
            {tb.rows.map((r) => (
              <tr key={r.code}>
                <td className="dt-mono">{r.code}</td>
                <td className="dt-title">{r.name}</td>
                <td className="dt-muted">{ACCOUNT_CATEGORIES[r.category]?.label || r.category}</td>
                <td className="dt-mono ta-right">{r.debit ? r.debit.toLocaleString() : ''}</td>
                <td className="dt-mono ta-right">{r.credit ? r.credit.toLocaleString() : ''}</td>
              </tr>
            ))}
            <tr style={{ background: 'rgba(59,130,246,0.08)', fontWeight: 700 }}>
              <td colSpan={3}>НИЙТ</td>
              <td className="dt-mono ta-right">{tb.totalDebit.toLocaleString()}</td>
              <td className="dt-mono ta-right">{tb.totalCredit.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function LedgerTab({ journalEntries }) {
  const accountsWithData = useMemo(() => {
    const codes = new Set();
    journalEntries.forEach((e) => e.lines.forEach((l) => codes.add(l.account)));
    return CHART_OF_ACCOUNTS.filter((a) => codes.has(a.code));
  }, [journalEntries]);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!code && accountsWithData.length) setCode(accountsWithData[0].code);
  }, [accountsWithData, code]);

  const ledger = useMemo(() => (code ? getLedger(journalEntries, code) : null), [journalEntries, code]);

  return (
    <>
      <select value={code} onChange={(e) => setCode(e.target.value)} className="news-topic-filter">
        {accountsWithData.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
      </select>
      {!ledger || !ledger.rows.length ? (
        <div className="empty-state">Энэ дансанд хөдөлгөөн алга</div>
      ) : (
        <>
          <div className="dt-muted" style={{ marginBottom: 10 }}>Эцсийн үлдэгдэл: {ledger.endingBalance.toLocaleString()}₮</div>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Огноо</th><th>Тайлбар</th><th>Талбар (party)</th><th className="ta-right">Дт</th><th className="ta-right">Кт</th><th className="ta-right">Үлдэгдэл</th></tr></thead>
              <tbody>
                {ledger.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="dt-mono">{r.date}</td>
                    <td className="dt-text">{r.description}</td>
                    <td className="dt-muted" style={{ fontSize: 11 }}>{r.party || '—'}</td>
                    <td className="dt-mono ta-right">{r.debit ? r.debit.toLocaleString() : ''}</td>
                    <td className="dt-mono ta-right">{r.credit ? r.credit.toLocaleString() : ''}</td>
                    <td className="dt-mono ta-right" style={{ fontWeight: 600 }}>{r.runningBalance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function GeneralJournalTab({ journalEntries }) {
  const [query, setQuery] = useState('');
  const sorted = useMemo(() => journalEntries.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)), [journalEntries]);
  const filtered = query
    ? sorted.filter((e) => (e.description || '').toLowerCase().includes(query.toLowerCase()) || (e.reference || '').toLowerCase().includes(query.toLowerCase()))
    : sorted;

  return (
    <>
      <input placeholder="Хайх (тайлбар, reference)..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 320, marginBottom: 14 }} className="news-topic-filter" />
      {!filtered.length && <div className="empty-state">Бичлэг олдсонгүй</div>}
      {filtered.map((entry) => {
        const total = entry.lines.reduce((s, l) => s + l.debit, 0);
        return (
          <div key={entry.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
            <div className="page-header-row" style={{ marginBottom: 8 }}>
              <div>
                <div className="dt-title">{entry.description}</div>
                <div className="dt-muted" style={{ fontSize: 11 }}>{entry.date} · {entry.reference}</div>
              </div>
              <div className="dt-mono">{total.toLocaleString()}₮</div>
            </div>
            <table className="data-table" style={{ minWidth: 'auto' }}>
              <tbody>
                {entry.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="dt-mono" style={{ fontSize: 12 }}>{l.account}</td>
                    <td className="dt-mono ta-right" style={{ fontSize: 12 }}>{l.debit ? l.debit.toLocaleString() : ''}</td>
                    <td className="dt-mono ta-right" style={{ fontSize: 12 }}>{l.credit ? l.credit.toLocaleString() : ''}</td>
                    <td className="dt-muted" style={{ fontSize: 11 }}>{l.party || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
