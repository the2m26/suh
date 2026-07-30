import { useState } from 'react';
import { sb, setRememberMe } from '../lib/supabase';

const EYE_OPEN = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EYE_CLOSED = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// ⚠️ userapp.html-ийн doUserLogin()-той ЯГ ИЖИЛ логик: зөвхөн "ot" (Сууц
// өмчлөгч) роль нэвтэрч чадна — бусад роль автоматаар гарна.
export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const client = setRememberMe(remember);
    const { data, error: authErr } = await client.auth.signInWithPassword({ email, password });
    if (authErr) {
      setError('И-мэйл эсвэл нууц үг буруу байна');
      setLoading(false);
      return;
    }
    const { data: profile } = await client.from('user_profiles').select('*').eq('id', data.user.id).maybeSingle();
    if (!profile || profile.role !== 'ot') {
      await client.auth.signOut();
      setError('Танд энэ аппад нэвтрэх эрх байхгүй байна');
      setLoading(false);
      return;
    }
    onLoggedIn(data.user, profile);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src="/suh/userapp-react/logicon.png" alt="suh" className="login-logo" />
        <h1 className="login-title">СӨХ</h1>
        <p>Хэрэглэгчийн эрхээрээ нэвтэрнэ vv</p>
        <form onSubmit={handleLogin}>
          <label>И-мэйл</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tanii@mail.mn" autoComplete="username" required />
          <label>Нууц үг</label>
          <div className="password-field">
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
            <button type="button" className="password-eye" onClick={() => setShowPassword(s => !s)} aria-label="Нууц үг харах/нуух">
              {showPassword ? EYE_CLOSED : EYE_OPEN}
            </button>
          </div>
          <label className="remember-row">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
            <span>Намайг сана</span>
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Түр хүлээнэ vv...' : 'Нэвтрэх'}
          </button>
        </form>
      </div>
    </div>
  );
}
