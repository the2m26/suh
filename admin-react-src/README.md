# admin-react

`suh.html` (vanilla JS admin систем)-ийг React рүү Strangler Fig аргачлалаар
шилжүүлэх шинэ Vite+React app. Дэлгэрэнгүй төлөвлөгөө: `suhhandbook.html`-ийн
"⚛ React шилжилт" tab.

## Тохиролцсон 3 архитектурын шийдвэр (2026-08-06)

### 1. Хоёр apps зэрэгцэн ажиллах (navigation)
- `suh.html` sidebar-ийн доод хэсэгт "⚛ React (турших)" холбоос → `admin-react/`
  (шинэ tab-аар нээгдэнэ)
- `admin-react` Sidebar-ийн доод хэсэгт "← suh.html руу буцах" холбоос
- Хоёулаа **relative зам** ашиглана (`admin-react/`, `../suh.html`) — GitHub
  Pages дээр `/suh/` дэд замд хоёул sibling хавтас байрлана
- `admin-react` build бүрэн `suh.html`-ийг орлох хүртэл (5-р түвшин
  дуусах хүртэл) энэ параллель байдал үргэлжилнэ

### 2. Өгөгдлийн загвар хоёр талдаа зэрэг ажиллах ёстой
- `src/lib/permissions.js` дэх `AUTH_ROLES`/`AUTH_MODULES`/`AUTH_ACTIONS`/
  `ROLE_LABELS`/`ADMIN_ONLY_PAGES` нь `suh.html`-ийн ижил тэмдэглэгээтэй
  массивуудтай (мөр ~5866-5916) **ЯГ ТААРЧ** байх ёстой
- `suh.html`-д шинэ модуль/role/action нэмэгдэх, эсвэл `feeSettings`-ийн
  `overdueDays`/`riskDays` мэт талбар өөрчлөгдөх бүрд, **admin-react-ийн
  харгалзах файлыг ч мөн зэрэг шинэчлэх ёстой**
- Одоогоор автомат sync механизмгүй (гар аргаар) — олон СӨХ/repo (multi-tenant)
  тохиолдолд энэ дүрмийг мартахгүй байхын тулд PR checklist эсвэл codegen
  script нэмэх санааг дараа үе шатанд авч үзэж болно

### 3. Санхүүгийн логикийг НЭГ Л газар бичих
- `src/lib/financeEngine.js` — `calcFee()`/`daysUnpaidForResident()`/
  `getUnpaidMonths()`/`allocatePaymentToMonths()`/`classifyPaymentStatus()`
  нь `suh.html`-ийн finance.js/residents.js-ийн эх функцүүдийн React талын
  **ганц эх сурвалж**. Global хамааралгүй, цэвэр функц (эксплицит параметр
  авдаг) — тестлэхэд хялбар, `src/lib/__tests__/`-д 0-р түвшний 4 regression
  тест кейс (Cosmo/isVirtual, catch-up төлбөр, хугацааны 2 хил, boundary
  чиглэл) бүгд эндхийг шалгадаг
- 3-р түвшин (Санхүүгийн цөм)-ийг React рүү шилжүүлэхэд, `suh.html`-ийн
  үндсэн функцүүдийг ЭНД ШУУД хуулбарлахгүй — эдгээрийг **ЗАСВАРЛАХ** юм бол
  (жиш нь шинэ boundary дүрэм) ХОЁР талд зэрэг хийх (Шийдвэр 2-той адил
  зарчим)

## Тест ажиллуулах

```
npm test        # vitest run — бүх regression тест
npm run build   # vite build — dist/ үүсгэнэ
```
