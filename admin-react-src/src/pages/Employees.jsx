import { useCallback, useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { logActivity } from '../lib/dbUtils';
import { employeeDisplayName, filterEmployeesList } from '../lib/employeeHelpers';
import { calculatePayrollGeneric, buildPayrollLinesGeneric } from '../lib/payrollEngine';
import { dbCreateJournalEntry } from '../lib/accountingBridge';

function mapEmployeeRow(e) {
  return {
    id: e.id, dbId: e.id, fullName: e.full_name, registerNumber: e.register_number || '',
    ttd: e.ttd || '', homeAddress: e.home_address || '',
    position: e.position || '', baseSalary: +e.base_salary || 0, hireDate: e.hire_date || '',
    status: e.status, terminationDate: e.termination_date || '', phone: e.phone || '', email: e.email || '',
    bankName: e.bank_name || '', ibanSuffix: e.iban_suffix || '', bankAccount: e.bank_account || '', note: e.note || '',
    lastName: e.last_name || '', parentName: e.parent_name || '', firstName: e.first_name || '',
    insuredType: e.insured_type || 1, nationality: e.nationality || 'mongol', occupationCode: e.occupation_code || '',
  };
}

export default function Employees() {
  const { currentUser, currentProfile } = useAuth();
  const { canAdd, canWrite, canDelete } = usePermissions();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState('list');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb.from('employees').select('*').order('full_name');
    if (error) { console.error('employees ачаалах алдаа:', error.message); setLoading(false); return; }
    setEmployees((data || []).map(mapEmployeeRow));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => filterEmployeesList(employees, query), [employees, query]);
  const perm = { canAdd: canAdd('employees'), canWrite: canWrite('employees'), canDelete: canDelete('employees') };
  const activeCount = employees.filter((e) => e.status === 'active').length;
  const totalSalary = employees.filter((e) => e.status === 'active').reduce((s, e) => s + e.baseSalary, 0);

  async function handleDelete(e) {
    if (!perm.canDelete) return;
    if (!confirm('Устгах уу?')) return;
    const { error } = await sb.from('employees').delete().eq('id', e.dbId);
    if (error) { alert('Устгахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'delete', 'employees', e.dbId, employeeDisplayName(e));
    load();
  }

  if (editing) {
    return (
      <EmployeeForm
        employee={editing === 'new' ? null : editing}
        currentUser={currentUser}
        currentProfile={currentProfile}
        onClose={() => { setEditing(null); load(); }}
      />
    );
  }

  return (
    <div className="page page-wide">
      <h2>Ажилтны бүртгэл</h2>
      <div className="gate-tabs">
        <button className={'gate-tab' + (tab === 'list' ? ' active' : '')} onClick={() => setTab('list')}>Жагсаалт</button>
        <button className={'gate-tab' + (tab === 'payroll' ? ' active' : '')} onClick={() => setTab('payroll')}>Цалингийн явц</button>
      </div>

      {tab === 'payroll' ? (
        <PayrollTab employees={employees} canWrite={perm.canWrite} currentUser={currentUser} currentProfile={currentProfile} />
      ) : (
        <>
          <div className="page-header-row">
            <div />
            {perm.canAdd && <button className="btn-primary" onClick={() => setEditing('new')}>+ Ажилтан нэмэх</button>}
          </div>
          <div className="gate-filters">
            <input placeholder="Хайх (нэр, албан тушаал)..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {loading && <div className="empty-state">Ачаалж байна...</div>}
          {!loading && !list.length && <div className="empty-state">Ажилтан олдсонгүй</div>}
          {!loading && list.length > 0 && (
            <>
              <div className="dt-muted" style={{ marginBottom: 10 }}>
                Нийт: {employees.length} ажилтан · Ажиллаж байгаа: {activeCount} · Сарын нийт үндсэн цалин: {totalSalary.toLocaleString()}₮
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>№</th><th>Нэр</th><th>Регистр</th><th>ТТД</th><th>Албан тушаал</th>
                      <th>Үндсэн цалин</th><th>Дансны дугаар</th><th>Ажилд орсон</th>
                      <th>Гэрийн хаяг</th><th>Утас</th><th>И-мэйл</th><th>Төлөв</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((e, idx) => {
                      const ibanFull = (e.ibanSuffix || e.bankAccount) ? `MN${e.ibanSuffix || ''}${e.bankAccount || ''}` : '—';
                      return (
                        <tr key={e.id} onClick={() => setEditing(e)}>
                          <td><div className="res-row-avatar" style={{ background: 'rgba(59,130,246,0.18)', color: '#60A5FA' }}>{idx + 1}</div></td>
                          <td className="dt-title">{employeeDisplayName(e)}</td>
                          <td className="dt-text dt-mono">{e.registerNumber || '—'}</td>
                          <td className="dt-text dt-mono">{e.ttd || '—'}</td>
                          <td className="dt-text">{e.position || '—'}</td>
                          <td className="dt-text dt-mono ta-right">{e.baseSalary.toLocaleString()}₮</td>
                          <td className="dt-text dt-mono" title={e.bankName || ''}>{ibanFull}</td>
                          <td className="dt-text">{e.hireDate || '—'}</td>
                          <td className="dt-muted" style={{ maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.homeAddress || ''}>{e.homeAddress || '—'}</td>
                          <td className="dt-text dt-mono">{e.phone || '—'}</td>
                          <td className="dt-text" style={{ maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.email || ''}>{e.email || '—'}</td>
                          <td>{e.status === 'active' ? <span className="status-ok">Ажиллаж байгаа</span> : <span className="status-muted">Чөлөөлөгдсөн</span>}</td>
                          <td onClick={(ev) => ev.stopPropagation()}>
                            {perm.canWrite && <button className="btn-ghost-sm" onClick={() => setEditing(e)}>✎</button>}
                            {perm.canDelete && <button className="btn-ghost-sm danger" onClick={() => handleDelete(e)}>✕</button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function EmployeeForm({ employee, currentUser, currentProfile, onClose }) {
  const isEdit = !!employee;
  const [lastName, setLastName] = useState(employee?.lastName || '');
  const [firstName, setFirstName] = useState(employee?.firstName || '');
  const [parentName, setParentName] = useState(employee?.parentName || '');
  const [registerNumber, setRegisterNumber] = useState(employee?.registerNumber || '');
  const [ttd, setTtd] = useState(employee?.ttd || '');
  const [homeAddress, setHomeAddress] = useState(employee?.homeAddress || '');
  const [position, setPosition] = useState(employee?.position || '');
  const [baseSalary, setBaseSalary] = useState(employee?.baseSalary || '');
  const [hireDate, setHireDate] = useState(employee?.hireDate || new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState(employee?.status || 'active');
  const [terminationDate, setTerminationDate] = useState(employee?.terminationDate || '');
  const [phone, setPhone] = useState(employee?.phone || '');
  const [email, setEmail] = useState(employee?.email || '');
  const [bankName, setBankName] = useState(employee?.bankName || '');
  const [ibanSuffix, setIbanSuffix] = useState(employee?.ibanSuffix || '');
  const [bankAccount, setBankAccount] = useState(employee?.bankAccount || '');
  const [nationality, setNationality] = useState(employee?.nationality || 'mongol');
  const [insuredType, setInsuredType] = useState(employee?.insuredType || 1);
  const [occupationCode, setOccupationCode] = useState(employee?.occupationCode || '');
  const [note, setNote] = useState(employee?.note || '');
  const [saving, setSaving] = useState(false);

  // employees.js-ийн renderEmployeeTaxOverridesUI()/renderEmployeeSalaryComponentsUI()
  // (мөр ~475-594) — хэрэглэгчийн 2026-08-06 зөвшөөрлөөр React рүү портлогдов.
  const [taxTypes, setTaxTypes] = useState([]);
  const [taxOverrides, setTaxOverrides] = useState({}); // {code: {enabled, rate_override, employee_rate_override, employer_rate_override, exemption_reason, useCustomRate}}
  const [componentCatalog, setComponentCatalog] = useState([]);
  const [componentEnabled, setComponentEnabled] = useState({}); // {code: bool}
  const [loadingTax, setLoadingTax] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingTax(true);
      const [{ data: tt }, { data: sc }, ovRes, compRes] = await Promise.all([
        sb.from('tax_types').select('*').eq('applies_to_payroll', true).eq('enabled', true),
        sb.from('salary_components').select('*').eq('enabled', true),
        isEdit ? sb.from('employee_tax_overrides').select('*').eq('employee_id', employee.dbId) : Promise.resolve({ data: [] }),
        isEdit ? sb.from('employee_salary_components').select('component_code').eq('employee_id', employee.dbId) : Promise.resolve({ data: [] }),
      ]);
      setTaxTypes(tt || []);
      setComponentCatalog(sc || []);
      const ovMap = {};
      (ovRes.data || []).forEach((o) => {
        ovMap[o.tax_code] = {
          enabled: o.enabled, rate_override: o.rate_override, employee_rate_override: o.employee_rate_override,
          employer_rate_override: o.employer_rate_override, exemption_reason: o.exemption_reason || '',
          useCustomRate: o.rate_override != null || o.employee_rate_override != null || o.employer_rate_override != null,
        };
      });
      setTaxOverrides(ovMap);
      const compMap = {};
      (compRes.data || []).forEach((c) => { compMap[c.component_code] = true; });
      setComponentEnabled(compMap);
      setLoadingTax(false);
    })();
  }, [isEdit, employee?.dbId]);

  function getOverride(code) {
    return taxOverrides[code] || { enabled: true, rate_override: null, employee_rate_override: null, employer_rate_override: null, exemption_reason: '', useCustomRate: false };
  }
  function updateOverride(code, patch) {
    setTaxOverrides((o) => ({ ...o, [code]: { ...getOverride(code), ...patch } }));
  }

  async function handleSave() {
    const fullName = `${lastName.trim()} ${firstName.trim()}`.trim() || firstName.trim();
    if (!firstName.trim()) { alert('Нэрийг оруулна уу'); return; }
    // Идэвхгүй болгосон татвар бүрт шалтгаан заавал байх ёстой (employees.js-ийн
    // readAndSaveEmployeeTaxOverrides()-ийн ижил баталгаажуулалт).
    for (const t of taxTypes) {
      const ov = getOverride(t.code);
      if (!ov.enabled && !ov.exemption_reason.trim()) {
        alert(`"${t.name}"-г идэвхгүй болгоход шалтгаан заавал бичнэ γγ`);
        return;
      }
    }
    setSaving(true);
    const row = {
      full_name: fullName, register_number: registerNumber.trim() || null, position: position.trim() || null,
      ttd: ttd.trim() || null, home_address: homeAddress.trim() || null,
      base_salary: +baseSalary || 0, hire_date: hireDate || null, status,
      termination_date: terminationDate || null, phone: phone.trim() || null, email: email.trim() || null,
      bank_name: bankName.trim() || null, iban_suffix: ibanSuffix.trim() || null, bank_account: bankAccount.trim() || null,
      note: note.trim() || null,
      last_name: lastName.trim() || null, parent_name: parentName.trim() || null, first_name: firstName.trim() || null,
      insured_type: +insuredType || 1, nationality, occupation_code: occupationCode.trim() || null,
    };
    let error, newId;
    if (isEdit) {
      ({ error } = await sb.from('employees').update(row).eq('id', employee.dbId));
    } else {
      const res = await sb.from('employees').insert(row).select().single();
      error = res.error; newId = res.data?.id;
    }
    if (error) { setSaving(false); alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    const employeeDbId = employee?.dbId || newId;

    // Татварын override бүр (employees.js-ийн readAndSaveEmployeeTaxOverrides())
    for (const t of taxTypes) {
      const ov = getOverride(t.code);
      const upsertRow = {
        employee_id: employeeDbId, tax_code: t.code, enabled: ov.enabled,
        rate_override: ov.enabled && ov.useCustomRate && t.calculation_type === 'simple' ? (+ov.rate_override || null) : null,
        employee_rate_override: ov.enabled && ov.useCustomRate && t.calculation_type === 'split' ? (+ov.employee_rate_override || null) : null,
        employer_rate_override: ov.enabled && ov.useCustomRate && t.calculation_type === 'split' ? (+ov.employer_rate_override || null) : null,
        exemption_reason: ov.enabled ? null : (ov.exemption_reason.trim() || null),
      };
      const { error: ovErr } = await sb.from('employee_tax_overrides').upsert(upsertRow, { onConflict: 'employee_id,tax_code' });
      if (ovErr) console.error('tax override save error:', ovErr.message);
    }

    // Цалингийн нэмэгдэл (employees.js-ийн readAndSaveEmployeeSalaryComponents())
    for (const c of componentCatalog) {
      if (componentEnabled[c.code]) {
        const { error: compErr } = await sb.from('employee_salary_components').upsert(
          { employee_id: employeeDbId, component_code: c.code }, { onConflict: 'employee_id,component_code' }
        );
        if (compErr) console.error('salary component save error:', compErr.message);
      } else {
        const { error: delErr } = await sb.from('employee_salary_components').delete().eq('employee_id', employeeDbId).eq('component_code', c.code);
        if (delErr) console.error('salary component remove error:', delErr.message);
      }
    }

    await logActivity(currentUser, currentProfile, isEdit ? 'edit' : 'add', 'employees', employeeDbId, fullName);
    setSaving(false);
    onClose();
  }

  return (
    <div className="news-editor-form">
      <div className="page-header-row">
        <h2>{isEdit ? 'Ажилтны мэдээлэл засах' : 'Ажилтан нэмэх'}</h2>
        <button className="btn-ghost" onClick={onClose}>← Буцах</button>
      </div>

      <div className="field-row">
        <label className="field"><span>Овог</span><input value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
        <label className="field"><span>Нэр</span><input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
        <label className="field"><span>Эцэг/эхийн нэр</span><input value={parentName} onChange={(e) => setParentName(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Регистрийн дугаар</span><input value={registerNumber} onChange={(e) => setRegisterNumber(e.target.value)} /></label>
        <label className="field"><span>ТТД</span><input value={ttd} onChange={(e) => setTtd(e.target.value)} /></label>
      </div>
      <label className="field"><span>Гэрийн хаяг</span><input value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} /></label>

      <div className="field-row">
        <label className="field"><span>Албан тушаал</span><input value={position} onChange={(e) => setPosition(e.target.value)} /></label>
        <label className="field"><span>Γндсэн цалин</span><input type="number" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Ажилд орсон өдөр</span><input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} /></label>
        <label className="field"><span>Төлөв</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Ажиллаж байгаа</option>
            <option value="terminated">Чөлөөлөгдсөн</option>
          </select>
        </label>
        {status === 'terminated' && (
          <label className="field"><span>Чөлөөлөгдсөн өдөр</span><input type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} /></label>
        )}
      </div>

      <div className="field-row">
        <label className="field"><span>Утас</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="field"><span>И-мэйл</span><input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      </div>

      <div className="field-row">
        <label className="field"><span>Банк</span><input value={bankName} onChange={(e) => setBankName(e.target.value)} /></label>
        <label className="field"><span>IBAN сүүлч (8)</span><input value={ibanSuffix} onChange={(e) => setIbanSuffix(e.target.value)} /></label>
        <label className="field"><span>Дансны дугаар</span><input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} /></label>
      </div>

      <div className="field-row">
        <label className="field"><span>Иргэншил</span>
          <select value={nationality} onChange={(e) => setNationality(e.target.value)}>
            <option value="mongol">Монгол</option>
            <option value="foreign">Гадаад</option>
          </select>
        </label>
        <label className="field"><span>Даатгуулагчийн төрөл</span><input type="number" value={insuredType} onChange={(e) => setInsuredType(e.target.value)} /></label>
        <label className="field"><span>Мэргэжлийн код</span><input value={occupationCode} onChange={(e) => setOccupationCode(e.target.value)} /></label>
      </div>

      <label className="field"><span>Тэмдэглэл</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>

      <div className="field">
        <span>Татварын override</span>
        {loadingTax && <div className="dt-muted">Ачаалж байна...</div>}
        {!loadingTax && !taxTypes.length && <div className="dt-muted">Идэвхтэй, цалинд хамаарах татвар алга</div>}
        {!loadingTax && taxTypes.map((t) => {
          const ov = getOverride(t.code);
          return (
            <div key={t.code} className="tax-override-row">
              <label className="tax-override-toggle">
                <input type="checkbox" checked={ov.enabled} onChange={(e) => updateOverride(t.code, { enabled: e.target.checked })} />
                {t.name} суутгах
              </label>
              {ov.enabled ? (
                t.calculation_type !== 'progressive' ? (
                  <div style={{ marginTop: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <input type="checkbox" checked={ov.useCustomRate} onChange={(e) => updateOverride(t.code, { useCustomRate: e.target.checked })} />
                      Тусгай хувь хэмжээ ашиглах
                    </label>
                    {ov.useCustomRate && (
                      t.calculation_type === 'simple' ? (
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="number" step="0.001" style={{ width: 100 }} placeholder={t.rate_percent}
                            value={ov.rate_override ?? ''} onChange={(e) => updateOverride(t.code, { rate_override: e.target.value })} />
                          <span className="dt-muted" style={{ fontSize: 11 }}>% (анхдагч: {t.rate_percent}%)</span>
                        </div>
                      ) : (
                        <div style={{ marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="number" step="0.001" style={{ width: 85 }} placeholder={t.employee_rate_percent}
                              value={ov.employee_rate_override ?? ''} onChange={(e) => updateOverride(t.code, { employee_rate_override: e.target.value })} />
                            <span className="dt-muted" style={{ fontSize: 11 }}>% ажилтан</span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="number" step="0.001" style={{ width: 85 }} placeholder={t.employer_rate_percent}
                              value={ov.employer_rate_override ?? ''} onChange={(e) => updateOverride(t.code, { employer_rate_override: e.target.value })} />
                            <span className="dt-muted" style={{ fontSize: 11 }}>% ажил олгогч</span>
                          </span>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="dt-muted" style={{ fontSize: 11, marginTop: 6 }}>Шаталсан тооцоолол хэвээр ажиллана — зөвхөн идэвхтэй/идэвхгүй сонголт боломжтой</div>
                )
              ) : (
                <input style={{ marginTop: 8, width: '100%' }} placeholder="Шалтгаан (жиш: Тэтгэврийн насны, НДШ дүүргэсэн)"
                  value={ov.exemption_reason} onChange={(e) => updateOverride(t.code, { exemption_reason: e.target.value })} />
              )}
            </div>
          );
        })}
      </div>

      <div className="field">
        <span>Цалингийн нэмэгдэл</span>
        {loadingTax && <div className="dt-muted">Ачаалж байна...</div>}
        {!loadingTax && !componentCatalog.length && <div className="dt-muted">Идэвхтэй цалингийн нэмэгдэл алга</div>}
        {!loadingTax && componentCatalog.map((c) => (
          <label key={c.code} className="tax-override-toggle" style={{ marginBottom: 6 }}>
            <input type="checkbox" checked={!!componentEnabled[c.code]}
              onChange={(e) => setComponentEnabled((m) => ({ ...m, [c.code]: e.target.checked }))} />
            {c.name}
            <span className="dt-muted" style={{ fontSize: 11, marginLeft: 6 }}>({Math.round(c.amount).toLocaleString()}₮ / сар бүр)</span>
          </label>
        ))}
      </div>

      <div className="dt-muted" style={{ marginBottom: 14 }}>
        Цалингийн тооцоолол "Ажилтны бүртгэл → Цалингийн явц" табаас хийгдэнэ. Цалингийн хуудас (payslip) харах UI хараахан ортоогүй.
      </div>

      <div className="form-actions">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button>
      </div>
    </div>
  );
}

// employees.js-ийн renderPayrollPreview()/runMonthlyPayroll() (мөр ~270-366)
// — хэрэглэгчийн 2026-08-06 зөвшөөрлөөр React рүү портлогдов. Тухайн сард
// цалин аль хэдийн тооцоологдсон эсэхийг journal_entries.reference-ээр
// шалгаж, ДАВХАРДУУЛАХГҮЙ.
function PayrollTab({ employees, canWrite, currentUser, currentProfile }) {
  const [taxTypes, setTaxTypes] = useState([]);
  const [brackets, setBrackets] = useState([]);
  const [overridesByEmp, setOverridesByEmp] = useState({});
  const [componentsByEmp, setComponentsByEmp] = useState({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [alreadyRun, setAlreadyRun] = useState(false);

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const activeEmployees = employees.filter((e) => e.status === 'active');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: tt }, { data: br }, { data: ov }, { data: comps }, { data: alreadyRows }] = await Promise.all([
        sb.from('tax_types').select('*').eq('applies_to_payroll', true).eq('enabled', true),
        sb.from('tax_brackets').select('*'),
        sb.from('employee_tax_overrides').select('*'),
        sb.from('employee_salary_components').select('*, salary_components(code, name, amount, expense_account)'),
        sb.from('journal_entries').select('id').ilike('reference', `payroll:%:${yearMonth}`).limit(1),
      ]);
      setTaxTypes(tt || []);
      setBrackets(br || []);
      const ovByEmp = {};
      (ov || []).forEach((o) => { (ovByEmp[o.employee_id] = ovByEmp[o.employee_id] || []).push(o); });
      setOverridesByEmp(ovByEmp);
      const compByEmp = {};
      (comps || []).forEach((c) => {
        const sc = c.salary_components;
        if (!sc) return;
        (compByEmp[c.employee_id] = compByEmp[c.employee_id] || []).push({ code: sc.code, name: sc.name, amount: +sc.amount || 0, expense_account: sc.expense_account });
      });
      setComponentsByEmp(compByEmp);
      setAlreadyRun((alreadyRows || []).length > 0);
      setLoading(false);
    })();
  }, [yearMonth]);

  const rows = activeEmployees.map((e) => ({
    employee: e,
    result: calculatePayrollGeneric(e.baseSalary, taxTypes, brackets, overridesByEmp[e.dbId] || [], componentsByEmp[e.dbId] || []),
  }));
  const totalGross = rows.reduce((s, r) => s + r.result.grossSalary, 0);
  const totalNet = rows.reduce((s, r) => s + r.result.netPay, 0);
  const totalEmployerCost = rows.reduce((s, r) => s + r.result.totalEmployerCost, 0);

  async function handleRunPayroll() {
    if (!canWrite) return;
    if (alreadyRun) { alert(`${yearMonth} сарын цалин аль хэдийн тооцоологдсон байна — дахин хийхгүй`); return; }
    if (!activeEmployees.length) { alert('Ажиллаж байгаа ажилтан алга'); return; }
    if (!confirm(`${yearMonth} сарын цалинг ${activeEmployees.length} ажилтанд тооцох уу?\n(Энэ үйлдлийг буцаах боломжгүй тул анхаарна уу.)`)) return;

    setRunning(true);
    const entryDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    let succeeded = 0, failed = 0;
    for (const { employee, result } of rows) {
      const party = 'employee:' + employee.dbId;
      const lines = buildPayrollLinesGeneric(party, result);
      const res = await dbCreateJournalEntry(entryDate, `${employee.fullName} -- ${yearMonth} сарын цалин`, `payroll:employee:${employee.dbId}:${yearMonth}`, lines);
      res.success ? succeeded++ : failed++;
    }
    await logActivity(currentUser, currentProfile, 'payroll', 'employees', null, `${yearMonth} сарын цалин: ${succeeded} амжилттай${failed ? ', ' + failed + ' алдаатай' : ''}`);
    setRunning(false);
    setAlreadyRun(true);
    alert(`${yearMonth} сарын цалин: ${succeeded} амжилттай${failed ? ', ' + failed + ' алдаатай' : ''}`);
  }

  if (loading) return <div className="empty-state">Ачаалж байна...</div>;
  if (!activeEmployees.length) return <div className="empty-state">Ажиллаж байгаа ажилтан алга</div>;

  return (
    <>
      <div className="page-header-row">
        <div className="dt-muted">{yearMonth} сарын урьдчилсан тооцоолол{alreadyRun ? ' (аль хэдийн тооцоологдсон)' : ''}</div>
        {canWrite && <button className="btn-primary" disabled={running || alreadyRun} onClick={handleRunPayroll}>{alreadyRun ? '✓ Тооцоологдсон' : 'Цалин тооцоолох'}</button>}
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Нэр</th><th className="ta-right">Нийт цалин</th>
              {taxTypes.map((t) => <th key={t.code} className="ta-right">{t.name}</th>)}
              <th className="ta-right">Гарт олгох</th><th className="ta-right">Аж.олгогчийн зардал</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ employee, result }) => (
              <tr key={employee.id}>
                <td className="dt-title">{employeeDisplayName(employee)}</td>
                <td className="dt-mono ta-right">{result.grossSalary.toLocaleString()}</td>
                {taxTypes.map((t) => {
                  const b = result.breakdown.find((x) => x.code === t.code);
                  return <td key={t.code} className="dt-mono ta-right">{b?.exempt ? <span className="dt-muted" title={b.reason}>чөлөөт</span> : (b?.employeeAmount || 0).toLocaleString()}</td>;
                })}
                <td className="dt-mono ta-right" style={{ fontWeight: 700 }}>{result.netPay.toLocaleString()}</td>
                <td className="dt-mono ta-right dt-muted">{result.totalEmployerCost.toLocaleString()}</td>
              </tr>
            ))}
            <tr style={{ background: 'rgba(59,130,246,0.08)', fontWeight: 700 }}>
              <td>НИЙТ</td>
              <td className="dt-mono ta-right">{totalGross.toLocaleString()}</td>
              {taxTypes.map((t) => <td key={t.code} />)}
              <td className="dt-mono ta-right">{totalNet.toLocaleString()}</td>
              <td className="dt-mono ta-right">{totalEmployerCost.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="dt-muted" style={{ marginTop: 14 }}>
        Ажилтан тус бүрийн татварын override (чөлөөлөх/тусгай хувь хэмжээ) болон цалингийн нэмэгдэл (Хоол/Унаа/Утас) тохируулах бол одоогоор suh.html-ийг ашиглана уу — эдгээр тохиргооны UI хараахан React рүү ортоогүй, гэхдээ тэдгээрийг ХАДГАЛСАН DB утгыг энд тооцоололд зөв ашиглаж байна.
      </div>
    </>
  );
}
