import { useCallback, useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { logActivity } from '../lib/dbUtils';
import { filterClienteleList } from '../lib/businessHelpers';

function mapClienteleRow(c) {
  return {
    id: c.id, dbId: c.id, legalName: c.legal_name || '', regNo: c.reg_no || '',
    ceo: c.ceo || '', mobile: c.mobile || '', phone: c.phone || '', email: c.email || '',
    contractNo: c.contract_no || '', contractStart: c.contract_start || '', contractEnd: c.contract_end || '',
    note: c.note || '',
  };
}

export default function Clientele() {
  const { currentUser, currentProfile } = useAuth();
  const { canAdd, canWrite, canDelete } = usePermissions();
  const [clientele, setClientele] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb.from('clientele').select('*').order('id');
    if (error) { console.error('clientele ачаалах алдаа:', error.message); setLoading(false); return; }
    setClientele((data || []).map(mapClienteleRow));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => filterClienteleList(clientele, query), [clientele, query]);
  const perm = { canAdd: canAdd('clientele'), canWrite: canWrite('clientele'), canDelete: canDelete('clientele') };

  async function handleDelete(c) {
    if (!perm.canDelete) return;
    if (!confirm('Устгах уу?')) return;
    const { data, error } = await sb.from('clientele').delete().eq('id', c.dbId).select();
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    if (!data || !data.length) { alert('Устгах эрхгүй байна'); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'clientele', c.dbId, c.legalName);
    load();
  }

  if (editing) {
    return (
      <ClienteleForm
        clientele={editing === 'new' ? null : editing}
        currentUser={currentUser}
        currentProfile={currentProfile}
        onClose={() => { setEditing(null); load(); }}
      />
    );
  }

  return (
    <div className="page page-wide">
      <div className="page-header-row">
        <h2>Харилцагчийн бүртгэл</h2>
        {perm.canAdd && <button className="btn-primary" onClick={() => setEditing('new')}>+ Харилцагч нэмэх</button>}
      </div>
      <div className="gate-filters">
        <input placeholder="Хайх..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {loading && <div className="empty-state">Ачаалж байна...</div>}
      {!loading && !list.length && <div className="empty-state">Харилцагч олдсонгүй</div>}
      {!loading && list.length > 0 && (
        <>
          <div className="dt-muted" style={{ marginBottom: 10 }}>Нийт: {list.length} харилцагч</div>
          <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>№</th><th>Хуулийн этгээдийн нэр</th><th>Гэрчилгээ №</th><th>Гүйцэтгэх удирдлага</th>
                <th>Гар утас</th><th>Утас</th><th>И-мэйл</th><th>Гэрээ №</th>
                <th>Гэрээ эхлэх</th><th>Гэрээ дуусах</th><th>Тэмдэглэл</th><th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c, idx) => (
                <tr key={c.id} onClick={() => setEditing(c)}>
                  <td><div className="res-row-avatar" style={{ background: 'rgba(59,130,246,0.18)', color: '#60A5FA' }}>{idx + 1}</div></td>
                  <td className="dt-title">{c.legalName}</td>
                  <td className="dt-text dt-mono">{c.regNo || '—'}</td>
                  <td className="dt-title">{c.ceo || '—'}</td>
                  <td className="dt-text dt-mono">{c.mobile || '—'}</td>
                  <td className="dt-text dt-mono">{c.phone || '—'}</td>
                  <td className="dt-text">{c.email || '—'}</td>
                  <td className="dt-text">{c.contractNo || '—'}</td>
                  <td className="dt-text dt-muted">{c.contractStart || '—'}</td>
                  <td className="dt-text dt-muted">{c.contractEnd || '—'}</td>
                  <td className="dt-muted" style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.note || ''}>{c.note || '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {perm.canWrite && <button className="btn-ghost-sm" onClick={() => setEditing(c)}>✎</button>}
                    {perm.canDelete && <button className="btn-ghost-sm danger" onClick={() => handleDelete(c)}>✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

function ClienteleForm({ clientele, currentUser, currentProfile, onClose }) {
  const isEdit = !!clientele;
  const [legalName, setLegalName] = useState(clientele?.legalName || '');
  const [regNo, setRegNo] = useState(clientele?.regNo || '');
  const [ceo, setCeo] = useState(clientele?.ceo || '');
  const [mobile, setMobile] = useState(clientele?.mobile || '');
  const [phone, setPhone] = useState(clientele?.phone || '');
  const [email, setEmail] = useState(clientele?.email || '');
  const [contractNo, setContractNo] = useState(clientele?.contractNo || '');
  const [contractStart, setContractStart] = useState(clientele?.contractStart || '');
  const [contractEnd, setContractEnd] = useState(clientele?.contractEnd || '');
  const [note, setNote] = useState(clientele?.note || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!legalName.trim()) { alert('Хуулийн этгээдийн нэрийг оруулна уу'); return; }
    setSaving(true);
    const row = {
      legal_name: legalName.trim(), reg_no: regNo.trim(), ceo: ceo.trim(),
      mobile: mobile.trim(), phone: phone.trim(), email: email.trim(),
      contract_no: contractNo.trim(), contract_start: contractStart || null, contract_end: contractEnd || null,
      note: note.trim() || null,
    };
    let error, newId;
    if (isEdit) {
      ({ error } = await sb.from('clientele').update(row).eq('id', clientele.dbId));
    } else {
      const res = await sb.from('clientele').insert(row).select().single();
      error = res.error; newId = res.data?.id;
    }
    if (error) { setSaving(false); alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, isEdit ? 'edit' : 'add', 'clientele', clientele?.dbId || newId, legalName.trim());
    setSaving(false);
    onClose();
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row">
        <h2>{isEdit ? 'Харилцагч засах' : 'Харилцагч нэмэх'}</h2>
        <button className="btn-ghost" onClick={onClose}>← Буцах</button>
      </div>
      <label className="field"><span>Хуулийн этгээдийн нэр</span><input value={legalName} onChange={(e) => setLegalName(e.target.value)} /></label>
      <div className="field-row">
        <label className="field"><span>УБД/Регистр</span><input value={regNo} onChange={(e) => setRegNo(e.target.value)} /></label>
        <label className="field"><span>Захирал</span><input value={ceo} onChange={(e) => setCeo(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Гар утас</span><input value={mobile} onChange={(e) => setMobile(e.target.value)} /></label>
        <label className="field"><span>Утас</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="field"><span>И-мэйл</span><input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Гэрээний дугаар</span><input value={contractNo} onChange={(e) => setContractNo(e.target.value)} /></label>
        <label className="field"><span>Эхлэх огноо</span><input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} /></label>
        <label className="field"><span>Дуусах огноо</span><input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} /></label>
      </div>
      <label className="field"><span>Тэмдэглэл</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="form-actions">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button>
      </div>
    </div>
  );
}
