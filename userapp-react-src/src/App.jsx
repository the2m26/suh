import { useEffect, useState } from 'react';
import { sb } from './lib/supabase';

// hex өнгийг хар/цагаан руу шугаман хольж тодорхой хувиар харлуулах/цайруулах
function tintHex(hex, tint) {
  const h = (hex || '#000000').replace('#', '');
  let r = parseInt(h.substr(0, 2), 16) || 0, g = parseInt(h.substr(2, 2), 16) || 0, b = parseInt(h.substr(4, 2), 16) || 0;
  const amt = Math.min(Math.abs(tint || 0), 50) / 50;
  const mixTo = tint < 0 ? 0 : 255;
  r = Math.round(r + (mixTo - r) * amt);
  g = Math.round(g + (mixTo - g) * amt);
  b = Math.round(b + (mixTo - b) * amt);
  return `rgb(${r},${g},${b})`;
}
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Payment from './components/Payment';
import Profile from './components/Profile';
import TileGrid from './components/TileGrid';
import TabBar from './components/TabBar';
import News from './components/News';
import Polls from './components/Polls';
import GuestInvite from './components/GuestInvite';
import CallLog from './components/CallLog';
import CallService from './components/CallService';
import UsefulContacts from './components/UsefulContacts';
import EmergencyContacts from './components/EmergencyContacts';
import Inbox from './components/Inbox';
import './App.css';

// ⚠️ 2026-07-30: v8 үндэст зөвхөн `dashboard` байсан TILE_PAGES-г бүрэн
// сэргээв. "elevator"/"camera" TILE_PAGES-д ороогүй тул автоматаар
// "Энэ модуль удахгүй нэмэгдэнэ" харагдана (гуравдагч үйлчилгээ хүлээгдэж буй).
const TILE_PAGES = {
  dashboard: { title: 'ХЯНАХ САМБАР', render: () => <Dashboard /> },
  news: { title: 'МЭДЭЭ, МЭДЭЭЛЭЛ', render: () => <News /> },
};

const HOME_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2 2.5 11h2.3v9.3h6V15h2.4v5.3h6V11h2.3z" /></svg>
);
const PAYMENT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);
const PROFILE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19a4 4 0 014-3h8a4 4 0 014 3" /><circle cx="12" cy="8" r="4" />
  </svg>
);
const BACK_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const BELL_ICON = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
const PLUS_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const LOGOUT_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);
  const [bottomTab, setBottomTab] = useState('home'); // home | payment | profile
  const [openTile, setOpenTile] = useState(null); // { key, label }
  const [showAddTileModal, setShowAddTileModal] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [openPollId, setOpenPollId] = useState(null);
  const [newsUnread, setNewsUnread] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);

  // PWA badge — мэдээ + мэдэгдлийн уншаагүй нийлбэрээр
  useEffect(() => {
    const total = newsUnread + notifUnread;
    if ('setAppBadge' in navigator) {
      if (total > 0) navigator.setAppBadge(total).catch(() => {});
      else if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
    }
  }, [newsUnread, notifUnread]);

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
    document.documentElement.setAttribute('data-theme', profile?.theme || 'dark');
  }, [profile?.theme]);

  // ⚠️ 2026-07-30 засав: эх кодоос яг тааруулав — CSS хүлээж байгаа хувьсагчийн
  // нэр (--card-tint-overlay/--card-bg-computed) өмнө нь буруу байсан (нэг
  // useEffect-д хольж, --card-tint-computed гэсэн БУРУУ нэрээр бичсэн байснаас
  // 2 слайдер аль аль нь ажиллахгүй болсон байсан).
  useEffect(() => {
    const tint = profile?.card_tint ?? 0;
    const overlay = tint < 0 ? `rgba(0,0,0,${Math.min(-tint, 50) / 100})` : `rgba(255,255,255,${Math.min(tint, 50) / 100})`;
    document.documentElement.style.setProperty('--card-tint-overlay', overlay);
  }, [profile?.card_tint]);

  useEffect(() => {
    const transparency = profile?.card_transparency ?? 0;
    const alpha = 1 - Math.min(transparency, 90) / 100;
    const [r, g, b] = profile?.theme === 'light' ? [255, 255, 255] : [22, 36, 64];
    document.documentElement.style.setProperty('--card-bg-computed', `rgba(${r},${g},${b},${alpha})`);
  }, [profile?.card_transparency, profile?.theme]);

  // ⚠️ 2026-08-02 дахин зохион байгуулав: 10 өнгөний сонголт (bg_color)
  // одоо "overlay давхарга"-аар БИШ, ШУУД глобал --bg-page-г солино
  // (body-ийн бодит дэвсгэр) — учир нь энэ нь илүү энгийн, урьдчилан
  // таамаглах боломжтой үр дүнтэй ("картны хүрээ, дэвсгэр өөр өөр
  // тохиргоотой тул хэвийн, зөвхөн хамгийн ард байх үндсэн өнгийг
  // сольж байгаа юм"). Зураг сонгосон үед л хуучин overlay арга (blur+tint)
  // хэвээрээ үлдэнэ (зураг заавал тусдаа давхарга байх ёстой тул).
  useEffect(() => {
    const tint = profile?.bg_tint ?? 0;
    if (profile?.bg_image_url) {
      const overlay = tint < 0 ? `rgba(0,0,0,${Math.min(-tint, 50) / 100})` : `rgba(255,255,255,${Math.min(tint, 50) / 100})`;
      document.documentElement.style.setProperty('--bg-tint-overlay', overlay);
      document.documentElement.style.removeProperty('--bg-page');
    } else if (profile?.bg_color) {
      document.documentElement.style.setProperty('--bg-page', tintHex(profile.bg_color, tint));
    } else {
      document.documentElement.style.removeProperty('--bg-page');
    }
  }, [profile?.bg_tint, profile?.bg_color, profile?.bg_image_url]);

  // ⚠️ 2026-07-30 нэмэв: "Интерфейс"-ийн картын хүрээний өнгө (0=#000000 —
  // 255=#ffffff саарал хэмжүүр). Утга сонгоогүй үед App.css-ийн стандарт
  // --border-card хэвээр үлдэнэ (fallback).
  useEffect(() => {
    if (profile?.card_border_gray == null) {
      document.documentElement.style.removeProperty('--card-border-computed');
      return;
    }
    const g = Math.max(0, Math.min(255, profile.card_border_gray));
    const hex = g.toString(16).padStart(2, '0');
    document.documentElement.style.setProperty('--card-border-computed', `#${hex}${hex}${hex}`);
  }, [profile?.card_border_gray]);

  // Шинэ мэдээ уншаагүй тоог 1 минут тутам шалгана
  useEffect(() => {
    if (!user) return;
    async function check() {
      const { data } = await sb.from('news_posts').select('published_at').eq('status', 'published')
        .order('published_at', { ascending: false }).limit(50);
      const lastSeen = localStorage.getItem('suh_news_last_seen');
      const unseen = (data || []).filter(p => !lastSeen || new Date(p.published_at) > new Date(lastSeen));
      setNewsUnread(unseen.length);
    }
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [user]);

  // Шинэ мэдэгдэл уншаагүй тоог 1 минут тутам шалгана
  useEffect(() => {
    if (!user) return;
    async function check() {
      const { data } = await sb.rpc('get_my_notifications', { p_limit: 50 });
      const lastSeen = localStorage.getItem('suh_notif_last_seen');
      const unseen = (data || []).filter(n => !lastSeen || new Date(n.sent_at) > new Date(lastSeen));
      setNotifUnread(unseen.length);
    }
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [user]);

  function handleLoggedIn(u, p) { setUser(u); setProfile(p); }
  async function handleLogout() { await sb.auth.signOut(); setUser(null); setProfile(null); }
  function goHome() { setBottomTab('home'); setOpenTile(null); setOpenPollId(null); }
  function openTilePage(key, label) {
    if (key === 'news') { localStorage.setItem('suh_news_last_seen', new Date().toISOString()); setNewsUnread(0); }
    setOpenTile({ key, label });
    setOpenPollId(null);
  }
  function onBack() { openPollId ? setOpenPollId(null) : setOpenTile(null); }

  if (checking) return <div className="pool-empty">Ачаалж байна...</div>;
  if (!user) return <Login onLoggedIn={handleLoggedIn} />;

  let mainContent;
  if (bottomTab === 'payment') mainContent = <Payment profile={profile} />;
  else if (bottomTab === 'profile') mainContent = <Profile profile={profile} user={user} onProfileUpdate={setProfile} />;
  else if (openTile?.key === 'polls') mainContent = <Polls profile={profile} openPollId={openPollId} onOpenPoll={setOpenPollId} />;
  else if (openTile?.key === 'guest-invite') mainContent = <GuestInvite profile={profile} />;
  else if (openTile?.key === 'call-service') mainContent = <CallService />;
  else if (openTile?.key === 'useful-contacts') mainContent = <UsefulContacts />;
  else if (openTile?.key === 'emergency-contacts') mainContent = <EmergencyContacts />;
  else if (openTile?.key === 'call-log') mainContent = <CallLog profile={profile} />;
  else if (openTile && TILE_PAGES[openTile.key]) mainContent = TILE_PAGES[openTile.key].render();
  else if (openTile) mainContent = <div className="pool-empty">Энэ модуль удахгүй нэмэгдэнэ</div>;
  else mainContent = <TileGrid onOpenTile={openTilePage} showAddModal={showAddTileModal} onCloseAddModal={() => setShowAddTileModal(false)} newsUnreadCount={newsUnread} />;

  const pageTitle = bottomTab === 'payment' ? 'Төлбөр' : bottomTab === 'profile' ? 'Profile' : (openTile ? openTile.label : null);

  return (
    <div className="app-shell">
      {profile.bg_image_url && (
        <div className="app-bg-layer" style={{ backgroundImage: `linear-gradient(var(--bg-tint-overlay), var(--bg-tint-overlay)), url(${profile.bg_image_url})`, filter: `blur(${profile.bg_blur ?? 8}px)` }} />
      )}

      {pageTitle ? (
        <div className="content-page-header">
          {bottomTab === 'home' && <button className="icon-btn" onClick={onBack} aria-label="Буцах">{BACK_ICON}</button>}
          <div className="content-page-title">{pageTitle}</div>
        </div>
      ) : (
        <div className="home-header">
          <div>
            <div className="app-title">СӨХ</div>
            <div className="user-greeting">{profile.full_name || user.email} · Сууц өмчлөгч</div>
          </div>
          <div className="header-actions">
            <button className="icon-btn" aria-label="Мэдэгдэл" onClick={() => {
              setShowInbox(true);
              localStorage.setItem('suh_notif_last_seen', new Date().toISOString());
              setNotifUnread(0);
            }}>
              {BELL_ICON}
              {notifUnread > 0 && <span className="inbox-badge show">{notifUnread}</span>}
            </button>
            <button className="icon-btn" aria-label="Нуусан товчоо сэргээх" onClick={() => setShowAddTileModal(true)}>{PLUS_ICON}</button>
            <button className="icon-btn" aria-label="Гарах" onClick={handleLogout}>{LOGOUT_ICON}</button>
          </div>
        </div>
      )}

      <div className="content-body">
        {mainContent}
      </div>

      {showInbox && <Inbox onClose={() => setShowInbox(false)} />}

      <div className="tab-bar-wrap">
        <TabBar
          active={{ home: 0, payment: 1, profile: 2 }[bottomTab]}
          onChange={i => {
            const tab = ['home', 'payment', 'profile'][i];
            if (tab === 'home') goHome();
            else { setBottomTab(tab); setOpenTile(null); setOpenPollId(null); }
          }}
          tabs={[
            { key: 'home', label: 'Home', icon: HOME_ICON },
            { key: 'payment', label: 'Төлбөр', icon: PAYMENT_ICON },
            { key: 'profile', label: 'Profile', icon: PROFILE_ICON },
          ]}
        />
      </div>
    </div>
  );
}
