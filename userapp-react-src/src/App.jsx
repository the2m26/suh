import { useEffect, useState } from 'react';
import { sb } from './lib/supabase';
import { shouldShowPushBanner, dismissPushBanner, enablePush } from './lib/push';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Payment from './components/Payment';
import Profile from './components/Profile';
import TileGrid from './components/TileGrid';
import './App.css';

// Tile хайрцгаар нээгддэг, бодит хэрэгжилттэй хуудсууд.
const TILE_PAGES = {
  dashboard: { title: 'ХЯНАХ САМБАР', render: () => <Dashboard /> },
};

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);
  const [bottomTab, setBottomTab] = useState('home'); // home | payment | profile
  const [openTile, setOpenTile] = useState(null); // { key, label }
  const [showPushBanner, setShowPushBanner] = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(async ({ data }) => {
      if (data?.session?.user) {
        const { data: p } = await sb.from('user_profiles').select('*').eq('id', data.session.user.id).maybeSingle();
        if (p && p.role === 'ot') { setUser(data.session.user); setProfile(p); }
        else await sb.auth.signOut();
      }
      setChecking(false);
    });
  }, []);

  useEffect(() => {
    if (user) shouldShowPushBanner().then(setShowPushBanner);
  }, [user]);

  function handleLoggedIn(u, p) { setUser(u); setProfile(p); }
  async function handleLogout() { await sb.auth.signOut(); setUser(null); setProfile(null); }

  async function handleEnablePush() {
    const res = await enablePush(user.id);
    setShowPushBanner(false);
    if (!res.ok) alert(res.msg);
  }
  function handleDismissPush() { dismissPushBanner(); setShowPushBanner(false); }

  function goHome() { setBottomTab('home'); setOpenTile(null); }

  if (checking) return <div className="pool-empty">Ачаалж байна...</div>;
  if (!user) return <Login onLoggedIn={handleLoggedIn} />;

  let mainContent;
  if (bottomTab === 'payment') mainContent = <Payment profile={profile} />;
  else if (bottomTab === 'profile') mainContent = <Profile profile={profile} />;
  else if (openTile && TILE_PAGES[openTile.key]) mainContent = TILE_PAGES[openTile.key].render();
  else if (openTile) mainContent = <div className="pool-empty">Энэ модуль удахгүй нэмэгдэнэ</div>;
  else mainContent = <TileGrid onOpenTile={(key, label) => setOpenTile({ key, label })} />;

  const pageTitle = bottomTab === 'payment' ? 'Төлбөр' : bottomTab === 'profile' ? 'Profile' : (openTile ? openTile.label : null);

  return (
    <div className="app-shell">
      {!pageTitle ? (
        <div className="home-header">
          <div>
            <div className="app-title">СӨХ</div>
            <div className="user-greeting">{profile.full_name || user.email} · Сууц өмчлөгч</div>
          </div>
        </div>
      ) : (
        <div className="content-page-header">
          <button className="icon-btn" onClick={goHome}>←</button>
          <div className="content-page-title">{pageTitle}</div>
        </div>
      )}

      {showPushBanner && (
        <div className="mobile-list-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🔔 Апп хаалттай үед ч шинэ нэхэмжлэл, мэдээ, мэдэгдэл шууд утсанд ирдэг болгох уу?</div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button className="icon-btn" style={{ padding: '6px 10px', fontSize: 11 }} onClick={handleEnablePush}>Идэвхжүүлэх</button>
            <button className="icon-btn" style={{ padding: '6px 10px', fontSize: 11 }} onClick={handleDismissPush}>үгүй</button>
          </div>
        </div>
      )}

      <div className="content-body">{mainContent}</div>

      <div className="tab-bar-wrap">
        <nav className="tab-bar">
          <button className={`tab-btn ${bottomTab === 'home' ? 'active' : ''}`} onClick={goHome}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2 2.5 11h2.3v9.3h6V15h2.4v5.3h6V11h2.3z"/></svg>
            Home
          </button>
          <button className={`tab-btn ${bottomTab === 'payment' ? 'active' : ''}`} onClick={() => { setBottomTab('payment'); setOpenTile(null); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            Төлбөр
          </button>
          <button className={`tab-btn ${bottomTab === 'profile' ? 'active' : ''}`} onClick={() => { setBottomTab('profile'); setOpenTile(null); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19a4 4 0 014-3h8a4 4 0 014 3"/><circle cx="12" cy="8" r="4"/></svg>
            Profile
          </button>
        </nav>
      </div>
      <button className="icon-btn" style={{ position: 'fixed', top: 16, right: 16, zIndex: 95 }} onClick={handleLogout}>Гарах</button>
    </div>
  );
}
