import { useEffect, useState } from 'react';
import { sb } from './lib/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    sb.auth.getSession().then(async ({ data }) => {
      if (data?.session?.user) {
        const { data: p } = await sb.from('user_profiles').select('*').eq('id', data.session.user.id).maybeSingle();
        if (p && p.role === 'ot') {
          setUser(data.session.user);
          setProfile(p);
        } else {
          await sb.auth.signOut();
        }
      }
      setChecking(false);
    });
  }, []);

  function handleLoggedIn(u, p) {
    setUser(u);
    setProfile(p);
  }

  async function handleLogout() {
    await sb.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  if (checking) return <div className="pool-empty">Ачаалж байна...</div>;
  if (!user) return <Login onLoggedIn={handleLoggedIn} />;

  return (
    <div className="app-shell">
      <div className="home-header">
        <div>
          <div className="app-title">СӨХ</div>
          <div className="user-greeting">{profile.full_name || user.email} · Сууц өмчлөгч</div>
        </div>
        <button className="icon-btn" onClick={handleLogout}>Гарах</button>
      </div>
      <div className="content-body">
        <Dashboard />
      </div>
    </div>
  );
}
