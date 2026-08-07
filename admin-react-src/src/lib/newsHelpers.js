// news.js-ийн (мөр ~14-58) цэвэр туслах функцүүдийн React талын эх сурвалж.
// ⚠️ Архитектурын шийдвэр 2: news.js дэх NEWS_TOPICS өөрчлөгдвөл ЭНД ч мөн
// зэрэг тааруулах ёстой.

export const NEWS_TOPICS = [
  { value: 'news', label: 'Мэдээ' },
  { value: 'uz', label: 'Удирдах зөвлөлийн шийдвэр' },
  { value: 'hz', label: 'Хяналтын зөвлөлийн шийдвэр' },
  { value: 'gz', label: 'Гүйцэтгэх захирлын шийдвэр' },
  { value: 'progress', label: 'Явцын тайлан' },
  { value: 'rules', label: 'Дүрэм, журам' },
  { value: 'assembly', label: 'Бүх гишүүдийн хурал' },
  { value: 'election', label: 'Сонгууль, санал асуулга' },
  { value: 'phone', label: 'Хэрэгцээт утас' },
  { value: 'jobs', label: 'Ажлын зар' },
];

export function newsTopicLabel(value) {
  const t = NEWS_TOPICS.find((t) => t.value === value);
  return t ? t.label : '';
}

const NEWS_WEEKDAY_NAMES = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];

// news.js-ийн _fmtNewsCardDate() — "YYYY.MM.DD Гариг, HH:MM:SS" формат.
export function fmtNewsCardDate(dateObj) {
  const p2 = (n) => String(n).padStart(2, '0');
  const weekday = NEWS_WEEKDAY_NAMES[dateObj.getDay()];
  return `${dateObj.getFullYear()}.${p2(dateObj.getMonth() + 1)}.${p2(dateObj.getDate())} ${weekday} гариг, ${p2(dateObj.getHours())}:${p2(dateObj.getMinutes())}:${p2(dateObj.getSeconds())}`;
}

export const NEWS_SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['p', 'div', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'font', 'span', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'target', 'color'],
  ALLOW_DATA_ATTR: false,
};

// localStorage-д хадгалсан "үзсэн ID" жагсаалт — браузер бүрд зөвхөн НЭГ УДАА
// view counter нэмэгдэхийн тулд (news.js-ийн NEWS_VIEWED_KEY-тэй ИЖИЛ түлхүүр
// биш — admin-react тусдаа namespace ашиглана, хоёр apps view count-ыг зэрэг
// нэмэхээс сэргийлэх зорилготой).
export const NEWS_VIEWED_KEY = 'suh_admin_news_viewed_ids';

export function getNewsViewedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(NEWS_VIEWED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export function saveNewsViewedIds(set) {
  localStorage.setItem(NEWS_VIEWED_KEY, JSON.stringify([...set]));
}
