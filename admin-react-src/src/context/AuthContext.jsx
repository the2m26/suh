import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { BLOCKED_ROLES } from '../lib/permissions';

// suh.html-ийн нэвтрэлт/session/эрхийн ачаалалтын логикийг (мөр ~6085-6420) React
// Context болгож портов. Глобал хувьсагч (currentUser/currentProfile/myPermissions)
// биш, Context state болгосноор component дахин зурагдах бүрд алдаагүй sync-тэй.

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);       // Supabase auth user
  const [currentProfile, setCurrentProfile] = useState(null); // user_profiles мөр
  const [myPermissions, setMyPermissions] = useState({});     // {resource: {action: level}}
  const [initializing, setInitializing] = useState(true);     // анхны session шалгалт дуусаагүй байгаа эсэх
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const role = currentProfile?.role || null;

  // suh.html-ийн loadMyPermissions() — get_my_permissions() RPC-г ашиглана,
  // Хандах эрхийн тохиргоо хуудсан дээр хийсэн өөрчлөлт кодыг дахин
  // deploy хийхгүйгээр шууд тусгагдана.
  const loadMyPermissions = useCallback(async () => {
    const { data, error } = await sb.rpc('get_my_permissions');
    if (error) {
      console.error('get_my_permissions error:', error.message);
      setMyPermissions({});
      return;
    }
    const perms = {};
    (data || []).forEach((r) => {
      if (!perms[r.resource]) perms[r.resource] = {};
      perms[r.resource][r.action] = r.level;
    });
    setMyPermissions(perms);
  }, []);

  // suh.html-ийн loadUserProfile() — профайл олдоогүй эсвэл role='ot'
  // (эсвэл ирээдүйд нэмэгдэж болзошгүй бусад BLOCKED_ROLES) бол шууд гаргана.
  // ⚠️ 2026-07-30 бодлого: role тодорхойгүй хэрэглэгчид ямар ч роль (жиш нь
  // хуучин 'vw'/Зочин) ТОХООХГҮЙ.
  const loadUserProfile = useCallback(async (authUser) => {
    const { data, error } = await sb.from('user_profiles').select('*').eq('id', authUser.id).single();
    if (error || !data) {
      await sb.auth.signOut();
      setCurrentUser(null);
      setCurrentProfile(null);
      return { ok: false, reason: 'not_found' };
    }
    if (BLOCKED_ROLES.includes(data.role)) {
      await sb.auth.signOut();
      setCurrentUser(null);
      setCurrentProfile(null);
      return { ok: false, reason: 'blocked_role' };
    }
    if (data.active === false) {
      await sb.auth.signOut();
      setCurrentUser(null);
      setCurrentProfile(null);
      return { ok: false, reason: 'inactive' };
    }
    setCurrentProfile(data);
    return { ok: true, profile: data };
  }, []);

  const login = useCallback(async (email, password) => {
    setLoginError('');
    setLoggingIn(true);
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        setLoginError(
          error.message === 'Invalid login credentials'
            ? 'И-мэйл эсвэл нууц үг буруу байна'
            : error.message
        );
        return false;
      }
      setCurrentUser(data.user);
      const result = await loadUserProfile(data.user);
      if (!result.ok) {
        if (result.reason === 'blocked_role') {
          setLoginError('Энэ систем зөвхөн ажилтанд зориулагдсан. Сууц өмчлөгчид зориулсан аппыг ашиглана уу.');
        } else if (result.reason === 'inactive') {
          setLoginError('Таны эрх түр хугацаагаар идэвхгүй болгогдсон байна. Админтай холбогдоно уу.');
        } else {
          setLoginError('Таны хэрэглэгчийн профайл олдсонгүй. Админтай холбогдоно уу.');
        }
        return false;
      }
      await loadMyPermissions();
      return true;
    } finally {
      setLoggingIn(false);
    }
  }, [loadUserProfile, loadMyPermissions]);

  const logout = useCallback(async () => {
    await sb.auth.signOut();
    setCurrentUser(null);
    setCurrentProfile(null);
    setMyPermissions({});
  }, []);

  // suh.html-ийн checkExistingSession() — хуудас дахин ачаалахад session-ийг
  // сэргээнэ.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (session && !cancelled) {
        setCurrentUser(session.user);
        const result = await loadUserProfile(session.user);
        if (result.ok && !cancelled) {
          await loadMyPermissions();
        }
      }
      if (!cancelled) setInitializing(false);
    })();
    return () => { cancelled = true; };
  }, [loadUserProfile, loadMyPermissions]);

  const value = {
    currentUser, currentProfile, role, myPermissions,
    initializing, loginError, loggingIn,
    login, logout,
    isLoggedIn: !!currentProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
