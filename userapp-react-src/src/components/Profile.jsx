import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';

// ⚠️ 2026-07-30: Энэ файл dist bundle-ээс СЭРГЭЭН БИЧИГДСЭН (эх .jsx алдагдсан
// тул) — v8 үндэсний Profile.jsx-д энэ Тохиргоо хэсэг огт байгаагүй байсан.
// Push notification-той холбоотой БүХ логик (registerServiceWorker/subscribeToPush/
// unsubscribeFromPush, VAPID key, sw.js бүртгэл) ЯГ адилхан, ӨӨРЧЛӨЛТГүй
// хуулбарлав — зөвхөн 2 зүйлийг өөрчилсөн: (1) BG_COLORS жагсаалтад 10 шинэ
// өнгө нэмсэн, (2) камерын 📷 emoji-г Home/Төлбор/Profile tab icon-той ижил
// stroke-SVG загвар болгосон.

const VAPID_PUBLIC_KEY = 'BAHU_k_7D1MVQSC5VlLga63Yr6ax1-dFHywpoo3uSrJVygt8sSQYDf_l5PZMzuyWU7Zg48rS6yITqIzb842ckME';

function urlBase64ToUint8Array(base64String) {
  const base64 = (base64String + '='.repeat((4 - base64String.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

let _swRegistration = null;
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    _swRegistration = await navigator.serviceWorker.register('/suh/userapp-react/sw.js');
    return _swRegistration;
  } catch (e) {
    console.error('Service Worker бүртгэхэд алдаа:', e);
    return null;
  }
}
async function unsubscribeFromPush(userId) {
  try {
    const reg = _swRegistration || await registerServiceWorker();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sb.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
    }
    localStorage.removeItem('suh_push_enabled');
    return { ok: true };
  } catch (e) {
    console.error('Push унтраахад алдаа:', e);
    localStorage.removeItem('suh_push_enabled');
    return { ok: true };
  }
}
async function subscribeToPush(userId) {
  try {
    const reg = _swRegistration || await registerServiceWorker();
    if (!reg) return { ok: false, msg: 'Энэ browser Push дэмждэггүй' };
    if (await Notification.requestPermission() !== 'granted') return { ok: false, msg: 'Зөвшөөрөл өгөгдсөнгүй' };
    const existing = await reg.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();
    const sub = (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })).toJSON();
    const { error } = await sb.from('push_subscriptions').upsert(
      { user_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth_key: sub.keys.auth },
      { onConflict: 'user_id,endpoint' }
    );
    if (error) {
      console.error('push_subscriptions хадгалахад алдаа:', error.message);
      return { ok: false, msg: 'Алдаа гарлаа — дахин оролдоно уу' };
    }
    localStorage.setItem('suh_push_enabled', '1');
    return { ok: true };
  } catch (e) {
    console.error('Push идэвхжүүлэхэд алдаа:', e);
    return { ok: false, msg: 'Push идэвхжүүлэхэд алдаа гарлаа (' + (e?.message || 'тодорхойгүй') + ')' };
  }
}

// ⚠️ 2026-07-30 засав: хэрэглэгчийн хүсэлтээр анхны 6 өнгийг БҮРЭН устгаж,
// доорх 10 шинэ өнгөөр бүрэн сольсон (таалагдахгүй байсан тул).
const BG_COLORS = [
  '#4a4a4a', '#af2c58', '#992c76', '#623396', '#3c3d92',
  '#016397', '#0559af', '#2f8b67', '#ff8a2b', '#78bd57',
];

// Home/Төлбор/Profile tab icon-той ЯГ ИЖИЛ stroke загвар (viewBox 24x24,
// stroke=currentColor — апп-ын үндсэн текстийн өнгийг автоматаар авна).
function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function residentSqm(resident, aptTypes) {
  const t = (aptTypes || []).find(x => (x.door_numbers || []).includes(resident.door));
  return t ? +t.sqm || 0 : 0;
}

export default function Profile({ profile, user, onProfileUpdate }) {
  const [loading, setLoading] = useState(true);
  const [resident, setResident] = useState(null);
  const [sqm, setSqm] = useState(0);
  const [pushOn, setPushOn] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const fileInputRef = useRef(null);

  async function loadResident() {
    const [{ data: r }, { data: types }] = await Promise.all([
      sb.from('residents').select('*').eq('apt', profile.apt).maybeSingle(),
      sb.from('apt_types').select('*'),
    ]);
    if (r) { setResident(r); setSqm(residentSqm(r, types || [])); }
  }

  useEffect(() => {
    loadResident().then(() => setLoading(false));
    (async () => {
      // ⚠️ 2026-07-30 засав: Үүний өмнө DB дэх push_subscriptions мөрийн ТООГ
      // шалгадаг байсан — энэ нь ТУХАЙН хэрэглэгчийн БүХ (хэдэн ч байсан)
      // төхөөрөмжийг нэгтгэж үзнэ, тул нэг төхөөрөмж дээр л зөвшөөрсөн байсан
      // ч БүХ өөр төхөөрөмж дээр toggle "худал ON" харагддаг байсан. Одоо
      // ЯГ ЭНЭ browser/төхөөрөмжийн бодит зөвшөөрөл+бүртгэлийг шалгана.
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        setPushOn(false);
        return;
      }
      try {
        const reg = _swRegistration || await registerServiceWorker();
        const sub = reg && await reg.pushManager.getSubscription();
        setPushOn(!!sub);
      } catch (e) {
        setPushOn(false);
      }
    })();
  }, [profile.apt]);

  async function togglePush() {
    if (pushOn) { if ((await unsubscribeFromPush(user.id)).ok) setPushOn(false); return; }
    const r = await subscribeToPush(user.id);
    if (r.ok) setPushOn(true); else alert(r.msg);
  }

  async function toggleTheme() {
    const theme = profile.theme === 'light' ? 'dark' : 'light';
    const { error } = await sb.rpc('update_my_preferences', {
      p_theme: theme, p_bg_url: profile.bg_image_url ?? null, p_bg_blur: profile.bg_blur ?? 8,
    });
    if (!error) onProfileUpdate({ ...profile, theme });
  }

  async function savePrefs(patch) {
    const next = { ...profile, ...patch };
    const { error } = await sb.rpc('update_my_preferences', {
      p_theme: next.theme ?? 'dark',
      p_bg_url: next.bg_image_url ?? null,
      p_bg_blur: next.bg_blur ?? 8,
      p_bg_color: next.bg_color ?? null,
      p_card_tint: next.card_tint ?? 0,
      p_card_transparency: next.card_transparency ?? 0,
      p_bg_tint: next.bg_tint ?? 0,
      p_card_border_gray: next.card_border_gray ?? null,
    });
    if (error) { alert('Хадгалахад алдаа гарлаа: ' + error.message); return; }
    onProfileUpdate(next);
  }

  async function onPickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${user.id}/background.jpg`;
    const { error } = await sb.storage.from('profile-backgrounds').upload(path, file, { upsert: true, contentType: file.type });
    if (error) { alert('Зураг байршуулахад алдаа гарлаа: ' + error.message); return; }
    const { data } = sb.storage.from('profile-backgrounds').getPublicUrl(path);
    await savePrefs({ bg_image_url: data.publicUrl + '?t=' + Date.now(), bg_color: null });
  }
  async function pickColor(hex) { await savePrefs({ bg_color: hex, bg_image_url: null }); }
  async function setBlur(v) { await savePrefs({ bg_blur: v }); }
  async function setBgTint(v) { await savePrefs({ bg_tint: v }); }
  async function setCardTint(v) { await savePrefs({ card_tint: v }); }
  async function setCardTransparency(v) { await savePrefs({ card_transparency: v }); }
  async function setCardBorderGray(v) { await savePrefs({ card_border_gray: v }); }
  async function removeBackground() { await savePrefs({ bg_image_url: null, bg_color: null }); }

  if (loading) return <div className="pool-empty">Ачаалж байна...</div>;
  if (!resident) return <div className="pool-empty">Мэдээлэл олдсонгүй</div>;

  const fullName = ((resident.firstname || '') + ' ' + (resident.lastname || '')).trim() || profile.full_name || '—';
  const phones = Array.isArray(resident.phones) ? resident.phones.filter(Boolean) : [];
  const emails = Array.isArray(resident.emails) ? resident.emails.filter(Boolean) : [];
  const infoRows = [
    ['Тоот', resident.apt],
    ['Талбай', sqm ? sqm + ' м²' : '—'],
    ['Зогсоол', (resident.parkings || []).length ? resident.parkings.join(', ') : '—'],
    ['Агуулах', (resident.storages || []).length ? resident.storages.join(', ') : '—'],
  ];

  return (
    <div>
      <div className="mobile-list-item" style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{fullName}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {resident.apt} тоот{sqm ? ' · ' + sqm + ' м²' : ''}
        </div>
      </div>

      <div className="section-title">Хэрэглэгчийн мэдээлэл</div>
      <div className="mobile-list-item">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Регистр</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{resident.reg || '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Утас</span>
          {phones.length
            ? <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                {phones.map((p, i) => <a key={i} href={`tel:${p}`} className="profile-value-link">{p}</a>)}
              </span>
            : <span style={{ fontSize: 13, fontWeight: 700 }}>—</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>И-мэйл</span>
          {emails.length
            ? <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                {emails.map((em, i) => <a key={i} href={`mailto:${em}`} className="profile-value-link">{em}</a>)}
              </span>
            : <span style={{ fontSize: 13, fontWeight: 700 }}>—</span>}
        </div>
        {infoRows.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{String(value)}</span>
          </div>
        ))}
      </div>

      <div className="section-title">Тохиргоо</div>
      <div className="mobile-list-item settings-list">
        <div className="settings-row">
          <span>Dark / Light mode</span>
          <button className={`settings-toggle ${profile.theme === 'light' ? 'on' : ''}`} onClick={toggleTheme} aria-label="Dark/Light mode">
            <span className="settings-toggle-dot" />
          </button>
        </div>
        <div className="settings-row">
          <span>Push notification</span>
          <button className={`settings-toggle ${pushOn ? 'on' : ''}`} onClick={togglePush} aria-label="Push notification">
            <span className="settings-toggle-dot" />
          </button>
        </div>

        <div className="settings-row settings-row-link" onClick={() => setBgOpen(o => !o)}>
          <span>Интерфейс</span>
          <span className="settings-row-arrow">{bgOpen ? '▲' : '▼'}</span>
        </div>
        {bgOpen && (
          <div className="profile-bg-panel">
            <div className="profile-bg-swatch-row">
              {BG_COLORS.map(hex => (
                <button key={hex} className={`profile-bg-swatch ${profile.bg_color === hex ? 'active' : ''}`}
                  style={{ background: hex }} onClick={() => pickColor(hex)} aria-label={hex} />
              ))}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickImage} />
              <button className="profile-bg-photo-btn" onClick={() => fileInputRef.current?.click()} aria-label="Альбомоос зураг сонгох">
                <CameraIcon />
              </button>
            </div>
            {profile.bg_image_url && (
              <div className="profile-card-tint-row">
                <span className="tint-dot tint-dot-sharp" />
                <input type="range" min="0" max="20" value={profile.bg_blur ?? 8} onChange={e => setBlur(+e.target.value)} />
                <span className="tint-dot tint-dot-blurred" />
              </div>
            )}
            {(profile.bg_image_url || profile.bg_color) && (
              <button className="profile-bg-remove-btn" onClick={removeBackground}>Дэвсгэрийг арилгах</button>
            )}
            {(profile.bg_image_url || profile.bg_color) && (
              <div className="profile-card-tint-row">
                <span className="tint-dot tint-dot-black" />
                <input type="range" min="-50" max="50" value={profile.bg_tint ?? 0} onChange={e => setBgTint(+e.target.value)} />
                <span className="tint-dot tint-dot-white" />
              </div>
            )}
            <div className="profile-card-tint-row">
              <span className="tint-dot tint-dot-black" />
              <input type="range" min="-50" max="50" value={profile.card_tint ?? 0} onChange={e => setCardTint(+e.target.value)} />
              <span className="tint-dot tint-dot-white" />
            </div>
            <div className="profile-card-tint-row">
              <span className="tint-dot tint-dot-solid" />
              <input type="range" min="0" max="90" value={profile.card_transparency ?? 0} onChange={e => setCardTransparency(+e.target.value)} />
              <span className="tint-dot tint-dot-hollow" />
            </div>
            <div className="profile-card-tint-row">
              <span className="tint-dot" style={{ background: '#000000' }} />
              <input type="range" min="0" max="255" value={profile.card_border_gray ?? 30} onChange={e => setCardBorderGray(+e.target.value)} />
              <span className="tint-dot" style={{ background: '#ffffff', border: '1px solid var(--border-card)' }} />
            </div>
          </div>
        )}

        <div className="settings-row settings-row-link" onClick={() => setPwOpen(o => !o)}>
          <span>Нүүц үг солих</span>
          <span className="settings-row-arrow">{pwOpen ? '▲' : '▼'}</span>
        </div>
        {pwOpen && <ChangePassword user={user} onClose={() => setPwOpen(false)} />}
      </div>
    </div>
  );
}

function ChangePassword({ user, onClose }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  async function submit() {
    setErr('');
    if (next.length < 6) { setErr('Шинэ нүүц үг хамгийн багадаа 6 тэмдэгт байх ёстой'); return; }
    if (next !== confirm) { setErr('Шинэ нүүц үг таарахгүй байна'); return; }
    setBusy(true);
    const { error: signInErr } = await sb.auth.signInWithPassword({ email: user.email, password: current });
    if (signInErr) { setErr('Одоогийн нүүц үг буруу байна'); setBusy(false); return; }
    const { error: updErr } = await sb.auth.updateUser({ password: next });
    setBusy(false);
    if (updErr) { setErr('Алдаа гарлаа: ' + updErr.message); return; }
    setDone(true);
    setCurrent(''); setNext(''); setConfirm('');
    setTimeout(() => { setDone(false); onClose(); }, 2000);
  }

  return (
    <div className="profile-pw-panel">
      <label className="profile-pw-label">Одоогийн нүүц үг</label>
      <input className="profile-edit-input" type="password" value={current} onChange={e => setCurrent(e.target.value)} />
      <label className="profile-pw-label">Шинэ нүүц үг</label>
      <input className="profile-edit-input" type="password" value={next} onChange={e => setNext(e.target.value)} />
      <label className="profile-pw-label">Шинэ нүүц үг (давтах)</label>
      <input className="profile-edit-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
      {err && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{err}</div>}
      {done && <div style={{ color: 'var(--accent)', fontSize: 12, marginTop: 6 }}>Амжилттай солигдлоо ✓</div>}
      <button className="login-btn" style={{ marginTop: 12 }} onClick={submit} disabled={busy}>
        {busy ? 'Хадгалж байна...' : 'Хадгалах'}
      </button>
    </div>
  );
}
