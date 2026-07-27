import { useState } from 'react';
import { sb } from '../lib/supabase';

// ⚠️ userapp.html-ийн doUserLogin()-той ЯГ ИЖИЛ логик: зөвхөн "ot" (Сууц
// өмчлөгч) роль нэвтэрч чадна — бусад роль автоматаар гарна.
export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: authErr } = await sb.auth.signInWithPassword({ email, password });
    if (authErr) {
      setError('И-мэйл эсвэл нууц үг буруу байна');
      setLoading(false);
      return;
    }
    const { data: profile } = await sb.from('user_profiles').select('*').eq('id', data.user.id).maybeSingle();
    if (!profile || profile.role !== 'ot') {
      await sb.auth.signOut();
      setError('Танд энэ аппад нэвтрэх эрх байхгүй байна');
      setLoading(false);
      return;
    }
    onLoggedIn(data.user, profile);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>СӨХ</h1>
        <p>Хэрэглэгчийн эрхээрээ нэвтэрнэ vv</p>
        <form onSubmit={handleLogin}>
          <label>И-мэйл</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tanii@mail.mn" autoComplete="username" required />
          <label>Нууц үг</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Түр хүлээнэ үү...' : 'Нэвтрэх'}
          </button>
        </form>
      </div>
    </div>
  );
}
