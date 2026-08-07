import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, loginError, loggingIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    await login(email, password);
  }

  return (
    <div className="login-overlay">
      <form className="login-box" onSubmit={handleSubmit}>
        <h1 className="login-title">suh <span className="accent">admin</span></h1>
        <label>
          И-мэйл
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Нууц үг
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {loginError && <div className="login-error">{loginError}</div>}
        <button type="submit" disabled={loggingIn}>
          {loggingIn ? 'Ачаалж байна...' : 'Нэвтрэх'}
        </button>
      </form>
    </div>
  );
}
