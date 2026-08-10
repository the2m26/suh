import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/dbUtils';

export default function SokhSettings() {
  const { currentUser, currentProfile } = useAuth();
  const [profile, setProfile] = useState({
    org_name: '', reg_number: '', tax_number: '', activity_type: '', nd_reg_number: '',
    province: '', district: '', khoroo: '', street: '', building: '', gate_number: '',
    landline: '', mobile: '', fax: '', email: '', website: '',
    liability_type_code: '', ownership_type_code: '', bank_accounts: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    sb.from('settings').select('value').eq('key', 'org_profile').maybeSingle().then(({ data, error }) => {
      if (error) { console.error('org_profile ачаалах алдаа:', error.message); setLoading(false); return; }
      if (data?.value) setProfile((p) => ({ ...p, ...data.value, bank_accounts: data.value.bank_accounts || [] }));
      setLoading(false);
    });
  }, []);

  function set(field, value) { setProfile((p) => ({ ...p, [field]: value })); }
  function setBank(idx, field, value) {
    setProfile((p) => ({ ...p, bank_accounts: p.bank_accounts.map((a, i) => i === idx ? { ...a, [field]: value } : a) }));
  }
  function addBank() { setProfile((p) => ({ ...p, bank_accounts: [...p.bank_accounts, { bank_name: '', account_number: '' }] })); }
  function removeBank(idx) { setProfile((p) => ({ ...p, bank_accounts: p.bank_accounts.filter((_, i) => i !== idx) })); }

  async function handleSave() {
    setSaving(true);
    const value = { ...profile, bank_accounts: profile.bank_accounts.filter((a) => a.bank_name || a.account_number) };
    const { error } = await sb.from('settings').upsert({ key: 'org_profile', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) { setSaving(false); alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    await logActivity(currentUser, currentProfile, 'edit', 'sokh-settings', null, value.org_name || 'СӨХ тохиргоо');
    setSaving(false);
    alert('СӨХ-ийн тохиргоо хадгалагдлаа ✓');
  }

  if (loading) return <div className="page"><div className="empty-state">Ачаалж байна...</div></div>;

  return (
    <div className="page">

      <div className="field-row">
        <label className="field"><span>Байгууллагын нэр</span><input value={profile.org_name} onChange={(e) => set('org_name', e.target.value)} /></label>
        <label className="field"><span>Регистрийн дугаар</span><input value={profile.reg_number} onChange={(e) => set('reg_number', e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Татвар төлөгчийн дугаар</span><input value={profile.tax_number} onChange={(e) => set('tax_number', e.target.value)} /></label>
        <label className="field"><span>НД-ийн бүртгэлийн дугаар</span><input value={profile.nd_reg_number} onChange={(e) => set('nd_reg_number', e.target.value)} /></label>
      </div>
      <label className="field"><span>Үйл ажиллагааны төрөл</span><input value={profile.activity_type} onChange={(e) => set('activity_type', e.target.value)} /></label>

      <div className="field-row">
        <label className="field"><span>Аймаг/Хот</span><input value={profile.province} onChange={(e) => set('province', e.target.value)} /></label>
        <label className="field"><span>Дүүрэг/Сум</span><input value={profile.district} onChange={(e) => set('district', e.target.value)} /></label>
        <label className="field"><span>Хороо</span><input value={profile.khoroo} onChange={(e) => set('khoroo', e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Гудамж</span><input value={profile.street} onChange={(e) => set('street', e.target.value)} /></label>
        <label className="field"><span>Байр</span><input value={profile.building} onChange={(e) => set('building', e.target.value)} /></label>
        <label className="field"><span>Хаалганы дугаар</span><input value={profile.gate_number} onChange={(e) => set('gate_number', e.target.value)} /></label>
      </div>

      <div className="field-row">
        <label className="field"><span>Ажлын утас</span><input value={profile.landline} onChange={(e) => set('landline', e.target.value)} /></label>
        <label className="field"><span>Гар утас</span><input value={profile.mobile} onChange={(e) => set('mobile', e.target.value)} /></label>
        <label className="field"><span>Факс</span><input value={profile.fax} onChange={(e) => set('fax', e.target.value)} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>И-мэйл</span><input value={profile.email} onChange={(e) => set('email', e.target.value)} /></label>
        <label className="field"><span>Вэбсайт</span><input value={profile.website} onChange={(e) => set('website', e.target.value)} /></label>
      </div>

      <div className="field">
        <span>Банкны данс</span>
        {profile.bank_accounts.length === 0 && <div className="dt-muted">Данс нэмээгүй байна</div>}
        {profile.bank_accounts.map((a, i) => (
          <div key={i} className="wizard-row">
            <input placeholder="Банкны нэр" value={a.bank_name} onChange={(e) => setBank(i, 'bank_name', e.target.value)} />
            <input placeholder="Дансны дугаар" value={a.account_number} onChange={(e) => setBank(i, 'account_number', e.target.value)} />
            <button type="button" className="btn-ghost-sm danger" onClick={() => removeBank(i)}>✕</button>
          </div>
        ))}
        <button type="button" className="btn-outline" onClick={addBank}>+ Данс нэмэх</button>
      </div>

      <div className="dt-muted" style={{ marginBottom: 14 }}>
        ⚠️ НД-7/НД-8 болон бусад цахим тайлангийн API (Сангийн яам/ТЕГ) хараахан эрх зөвшөөрөл аваагүй тул энэ хувилбарт ортоогүй.
      </div>

      <div className="form-actions">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>Хадгалах</button>
      </div>
    </div>
  );
}
