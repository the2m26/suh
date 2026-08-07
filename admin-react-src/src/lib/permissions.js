// ⚠️ АРХИТЕКТУРЫН ШИЙДВЭР 2 (2026-08-06 тохиролцсон): Энэ файл нь suh.html-ийн
// AUTH_ROLES/AUTH_MODULES/AUTH_ACTIONS/ROLE_LABELS/ADMIN_ONLY_PAGES-тэй ЯГ
// ТААРЧ байх ёстой. suh.html-д эдгээрийг өөрчлөх (шинэ модуль нэмэх, role
// нэмэх/хасах, action нэмэх) бүрд ЭНД Ч мөн зэрэг шинэчлэх ёстой — эс тэгвэл
// хоёр apps өөр өөр эрхийн матрицтай болно. Эх сурвалж: suh.html мөр ~5866-5916.

// Admin-ийг энд оруулаагүй — Admin үргэлж бүрэн эрхтэй (get_permission_level()
// дотор баталгаажсан), иймд Хандах эрхийн тохиргоо матрицад тохируулах шаардлагагүй.
export const AUTH_ROLES = [
  { key: 'uz', label: 'Удирдах зөвлөл' },
  { key: 'hz', label: 'Хяналтын зөвлөл' },
  { key: 'gz', label: 'Гүйцэтгэх захирал' },
  { key: 'nb', label: 'Нягтлан бодогч' },
  { key: 'mn', label: 'Менежер' },
  { key: 'ot', label: 'Сууц өмчлөгч' },
];

export const AUTH_MODULES = [
  { key: 'dashboard', page: 'dashboard', label: 'Хянах самбар', actions: ['view'] },
  { key: 'residents', page: 'residents', label: 'Сууц өмчлөгчийн бүртгэл', actions: ['view', 'add', 'edit', 'delete', 'print', 'export'] },
  { key: 'businesses', page: 'business', label: 'Аж ахуйн нэгж бүртгэл', actions: ['view', 'add', 'edit', 'delete', 'print', 'export'] },
  { key: 'clientele', page: 'clientele', label: 'Харилцагчийн бүртгэл', actions: ['view', 'add', 'edit', 'delete', 'print', 'export'] },
  { key: 'transactions', page: 'finance', label: 'Гүйлгээний бүртгэл', actions: ['view', 'add', 'edit', 'delete', 'print', 'export', 'payment'] },
  { key: 'assets', page: 'assets', label: 'Үндсэн хөрөнгө бүртгэл', actions: ['view', 'add', 'edit', 'delete', 'print', 'export'] },
  { key: 'payments', page: 'payments', label: 'Төлбөр төлөлт', actions: ['view', 'print', 'export', 'payment'] },
  { key: 'apartments', page: 'apartments', label: 'Тоот, зогсоол, агуулах', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'reports', page: 'reports', label: 'СӨХ дотоод тайлан', actions: ['view', 'print', 'export'] },
  { key: 'fintax', page: 'fintax', label: 'Санхүү, татварын тайлан', actions: ['view', 'print', 'export'] },
  { key: 'notifications', page: 'communications', label: 'Зар, мэдэгдэл илгээх', actions: ['view', 'add', 'edit', 'delete', 'notify'] },
  { key: 'polls', page: 'polls', label: 'Сонгууль, санал асуулга', actions: ['view', 'add', 'edit', 'delete', 'print', 'export'] },
  { key: 'accounting', page: 'accounting', label: 'Нягтлан бодох бүртгэл', actions: ['view', 'print', 'export', 'invoice'] },
  { key: 'employees', page: 'employees', label: 'Ажилтны бүртгэл', actions: ['view', 'add', 'edit', 'delete', 'print', 'export', 'payroll'] },
  { key: 'call-log', page: null, label: 'Ирсэн санал, хүсэлт (CC center-ийн эх өгөгдөл)', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'cc-center', page: 'cc-center', label: 'CC center', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'gate-log', page: 'gate-log', label: 'Хаалтны удирдлага', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'news', page: 'news', label: 'Мэдээ, мэдээлэл', actions: ['view'] },
  { key: 'newseditor', page: 'newseditor', label: 'Мэдээний агрегат', actions: ['view', 'add', 'edit', 'delete'] },
];

export const AUTH_ACTIONS = ['view', 'add', 'edit', 'delete', 'print', 'export', 'payroll', 'invoice', 'notify', 'payment'];

export const AUTH_ACTION_LABELS = {
  view: 'Харах', add: 'Нэмэх', edit: 'Засах', delete: 'Устгах',
  print: 'Хэвлэх', export: 'Экспорт',
  payroll: 'Сарын цалин тооцох', invoice: 'Журналд нэхэмжлэх бүртгэх',
  notify: 'Мэдэгдэл илгээх', payment: 'Төлбөр бүртгэх',
};

export const ROLE_LABELS = {
  admin: 'Админ', uz: 'Удирдах зөвлөл', hz: 'Хяналтын зөвлөл',
  gz: 'Гүйцэтгэх захирал', nb: 'Нягтлан бодогч',
  mn: 'Менежер', ot: 'Сууц өмчлөгч',
};

// role='ot' (Сууц өмчлөгч) admin-react-д ХЭЗЭЭ Ч нэвтрэхгүй (suh.html-тэй адил
// бодлого, 2026-07-30 шийдвэр) — зөвхөн userapp-react ашиглана.
export const BLOCKED_ROLES = ['ot'];

export const ADMIN_ONLY_PAGES = [
  'admin', 'tariff-settings', 'market-valuation', 'auth_levels', 'users',
  'nbb-settings', 'asset-settings', 'sokh-settings', 'app-settings',
  'activity-log', 'ai-integration-plan', 'cosmo-settings',
];

// ------------------------------------------------------------------
// Pure permission-check функцүүд. suh.html-ийн canView/canWrite/canAdd/...
// глобал хувьсагч (currentProfile, myPermissions) ашигладаг байсныг React-д
// тохируулж, ХОЁР ЛАВ параметр авдаг цэвэр функц болгов (АРХИТЕКТУРЫН ШИЙДВЭР 3-ийн
// зарчим: тооцооллын логикийг нэг эх сурвалжтай, дам хамааралгүй байлгах).
// myPermissions хэлбэр: {resource: {action: level}}, level: 1=Тийм 2=Үгүй 3=Өөрийнхийг харах
// ------------------------------------------------------------------

export function canView(role, myPermissions, resource) {
  if (role === 'admin') return true;
  const lvl = myPermissions?.[resource]?.view;
  return lvl === 1 || lvl === 3; // 3 = Өөрийнхийг харах (зөвхөн 'ot' рольд хамаарна)
}

export function canWrite(role, myPermissions, resource) {
  if (role === 'admin') return true;
  return myPermissions?.[resource]?.edit === 1;
}

export function canAdd(role, myPermissions, resource) {
  if (role === 'admin') return true;
  return myPermissions?.[resource]?.add === 1;
}

export function canDelete(role, myPermissions, resource) {
  if (role === 'admin') return true;
  return myPermissions?.[resource]?.delete === 1;
}

export function canPrint(role, myPermissions, resource) {
  if (role === 'admin') return true;
  return myPermissions?.[resource]?.print === 1;
}

export function canExport(role, myPermissions, resource) {
  if (role === 'admin') return true;
  return myPermissions?.[resource]?.export === 1;
}

export function canAccrue(role, myPermissions) {
  if (role === 'admin') return true;
  return myPermissions?.['accounting']?.invoice === 1;
}

export function canAccessPage(role, myPermissions, pageName) {
  if (role === 'admin') return true;
  if (ADMIN_ONLY_PAGES.includes(pageName)) return false;
  const moduleDef = AUTH_MODULES.find((m) => m.page === pageName);
  if (moduleDef && !canView(role, myPermissions, moduleDef.key)) return false;
  return true;
}
