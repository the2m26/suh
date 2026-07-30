import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';

// ⚠️ 2026-07-30: Анхны хувилбар settings.gate_control.free_parking_hours
// (цагаар) уншдаг байсан. Тэр өдөр "Хаалтны удирдлага" ажлын үед
// settings.gate_tariff.guest_free_minutes (минутаар, илүү нарийвчилсан)
// шинэ түлхүүр үүссэн тул ЭНД ч тэр шинэ түлхүүрийг ашиглав.
export default function GuestInvite({ profile }) {
  const [plateDigits, setPlateDigits] = useState('');
  const [plateLetters, setPlateLetters] = useState('');
  const [freeMinutes, setFreeMinutes] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [recent, setRecent] = useState([]);

  async function loadRecent() {
    const { data } = await sb.from('guest_invites').select('*').eq('apt', profile.apt)
      .order('created_at', { ascending: false }).limit(5);
    setRecent(data || []);
  }

  useEffect(() => {
    (async () => {
      const { data } = await sb.from('settings').select('value').eq('key', 'gate_tariff').maybeSingle();
      setFreeMinutes(data?.value?.guest_free_minutes ?? null);
      await loadRecent();
    })();
  }, [profile.apt]);

  function onDigitsChange(e) { setPlateDigits(e.target.value.replace(/\D/g, '').slice(0, 4)); }
  function onLettersChange(e) {
    const v = e.target.value.replace(/[^а-яА-ЯөӨүҮёЁ]/g, '').toUpperCase().slice(0, 3);
    setPlateLetters(v);
  }

  async function submitInvite() {
    setError('');
    if (plateDigits.length !== 4) { setError('4 оронтой тоог бүрэн бичнэ vv'); return; }
    if (plateLetters.length !== 3) { setError('3 кирилл үсгийг бүрэн бичнэ vv'); return; }
    setStatus('sending');
    const { data: resident } = await sb.from('residents').select('id').eq('apt', profile.apt).maybeSingle();
    const { error: insErr } = await sb.from('guest_invites').insert({
      apt: profile.apt, resident_id: resident?.id || null,
      plate_digits: plateDigits, plate_letters: plateLetters, created_by: profile.id,
    });
    if (insErr) { setStatus('error'); setError('Алдаа гарлаа — дахин оролдоно уу'); return; }
    setStatus('ok');
    setPlateDigits(''); setPlateLetters('');
    await loadRecent();
    setTimeout(() => setStatus(''), 2500);
  }

  return (
    <div>
      <div className="mobile-list-item">
        <div className="guest-invite-note">
          Таны урьсан зочин машинаа хотхоны гадна талбайд түр байрлуулах буюу хаалтаар дугаараа уншуулан
          нэвтэрсэн мөчөөс эхлэн {freeMinutes ?? '—'} минут үнэгүй зогсох эрхтэй. Уг хугацаа хэтэрсэнээс
          хойш тогтоосон тарифаар зогсоолын төлбөр бодогдохыг анхаарна уу.
        </div>
        <div className="guest-plate-row" style={{ marginTop: 14 }}>
          <input type="text" inputMode="numeric" className="guest-plate-digits" placeholder="1234"
            value={plateDigits} onChange={onDigitsChange} />
          <input type="text" className="guest-plate-letters" placeholder="АБВ"
            value={plateLetters} onChange={onLettersChange} />
        </div>
        <div className="guest-invite-btn-row">
          <button className="login-btn guest-invite-btn" onClick={submitInvite} disabled={status === 'sending'}>
            {status === 'sending' ? 'Илгээж байна...' : 'Урих'}
          </button>
        </div>
        {status === 'ok' && <div className="guest-invite-success">✓ Амжилттай бүртгэгдлээ</div>}
        {error && <div className="login-error">{error}</div>}
      </div>
      {recent.length > 0 && (
        <>
          <div className="section-title">Сүүлд урьсан зочид</div>
          <div className="mobile-list-item">
            {recent.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{r.plate_digits} {r.plate_letters}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(r.created_at).toLocaleString('mn-MN')}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
