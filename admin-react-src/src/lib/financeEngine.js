// ⚠️ АРХИТЕКТУРЫН ШИЙДВЭР 3 (2026-08-06 тохиролцсон): Энэ файл suh.html-ийн
// finance.js/residents.js доторх calcFee()/daysUnpaidForResident()/
// _getUnpaidMonths()/_allocatePaymentToMonths()-ийн (2026-08-05/06 сайтар
// зассан хувилбар) React талын НЭГ Л эх сурвалж. suh.html дахь тэдгээр
// функцүүд module-level глобал хувьсагч (transactions, feeCatalog,
// feeSettings, invoiceSchedule)-аас шүүдэг байсан бол эндхийг бүгдийг
// ЭКСПЛИЦИТ параметр болгосон — цэвэр функц, тестлэхэд хялбар.
//
// ⚠️ suh.html дэх эх функцүүдэд өөрчлөлт орвол (жиш нь шинэ fee unit_type
// нэмэгдэх, boundary логик дахин өөрчлөгдөх) ЭНД Ч мөн зэрэг тааруулах ёстой
// — эс тэгвэл хоёр apps санхүүгийн тооцоолол зөрчилдөнө.

// ------------------------------------------------------------------
// Тарифын нэгжийн тоо хэмжээ (finance.js _feeQuantity() эх сурвалж)
// ------------------------------------------------------------------
export function feeQuantity(entity, entityType, unitType, ctx = {}) {
  if (unitType === 'flat' || unitType === 'main_count') return 1;
  if (unitType === 'main_sqm') {
    if (entityType === 'resident') return ctx.residentSqm ? ctx.residentSqm(entity) : (+entity.sqm || 0);
    return +entity.area || 0;
  }
  if (unitType === 'storage_sqm') {
    return (entity.storages || []).reduce((s, label) => s + (ctx.getSpotSqm ? ctx.getSpotSqm('storage', label) : 0), 0);
  }
  if (unitType === 'storage_count') return (entity.storages || []).length;
  if (unitType === 'parking_sqm') {
    return (entity.parkings || []).reduce((s, label) => s + (ctx.getSpotSqm ? ctx.getSpotSqm('parking', label) : 0), 0);
  }
  if (unitType === 'parking_count') return (entity.parkings || []).length;
  return 0;
}

// Нэгдсэн тооцооллын engine — Сууц/ААН хоёуланд адилхан (finance.js calcEntityFee())
export function calcEntityFee(entity, entityType, feeCatalog, ctx = {}) {
  const rows = (feeCatalog || []).filter((f) => f.active && f.applies_to === entityType);
  const total = rows.reduce((s, f) => s + feeQuantity(entity, entityType, f.unit_type, ctx) * (+f.rate || 0), 0);
  return Math.round(total);
}

// ⚠️ REGRESSION TEST КЕЙС 1 (Cosmo/isVirtual): 2026-08-05-нд олдсон алдаа —
// isVirtual=true (Cosmo, apt=0) мөр санхүүгийн ЯМАР Ч тооцоололд орж
// болохгүй. calcFee()-ийн ЭХЭНД шууд хамгаалалт тавьсанаар БүХ дуудагч
// газар (нийт орлого, өрийн тайлан г.м) нэг дор зөв болдог (DRY).
export function calcFee(r, feeCatalog, ctx = {}) {
  if (r && r.isVirtual) return 0;
  return calcEntityFee(r, 'resident', feeCatalog, ctx);
}

export function calcBusinessFee(b, feeCatalog, ctx = {}) {
  return calcEntityFee(b, 'business', feeCatalog, ctx);
}

// ------------------------------------------------------------------
// Хугацааны (өдрөөр) төлбөрийн төлөв — daysUnpaidForResident()/
// daysUnpaidForBusiness() эх сурвалж (2026-08-05 сараас өдөр рүү шилжсэн).
// ------------------------------------------------------------------

// transactions: бүх гүйлгээний массив, sendDay: invoiceSchedule.sendDay,
// today: Date (тестэд тогтмол огноо дамжуулж болно, анхны утга — одоо).
export function daysUnpaidForResident(r, transactions, sendDay = 1, today = new Date()) {
  // ⚠️ REGRESSION ТЕСТ КЕЙС 1: Cosmo-ийн виртуал резидент мөр үргэлж 0 буцаана.
  if (r && r.isVirtual) return 0;
  const relevantTx = (transactions || [])
    .filter((t) => t && String(t.apt) === String(r.apt) && t.type === 'income' && t.category === 'resident')
    .sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
  const lastPay = relevantTx[0];
  let unpaidMonth, unpaidYear;
  if (lastPay) {
    unpaidMonth = lastPay.month + 1;
    unpaidYear = lastPay.year;
    if (unpaidMonth > 12) { unpaidMonth = 1; unpaidYear += 1; }
  } else if (r.ownDate) {
    const od = new Date(r.ownDate);
    if (isNaN(od)) return 999 * 30;
    unpaidMonth = od.getMonth() + 1;
    unpaidYear = od.getFullYear();
  } else {
    return 999 * 30;
  }
  const invoiceSentDate = new Date(unpaidYear, unpaidMonth - 1, sendDay || 1);
  const diffDays = Math.floor((today - invoiceSentDate) / 86400000);
  return Math.max(0, diffDays);
}

export function daysUnpaidForBusiness(b, transactions, sendDay = 1, today = new Date()) {
  const relevantTx = (transactions || [])
    .filter((t) => t && t.businessId === b.id && t.type === 'income' && t.category === 'business')
    .sort((a, b2) => (b2.year * 100 + b2.month) - (a.year * 100 + a.month));
  const lastPay = relevantTx[0];
  let unpaidMonth, unpaidYear;
  if (lastPay) {
    unpaidMonth = lastPay.month + 1;
    unpaidYear = lastPay.year;
    if (unpaidMonth > 12) { unpaidMonth = 1; unpaidYear += 1; }
  } else if (b.start) {
    const sd = new Date(b.start);
    if (isNaN(sd)) return 999 * 30;
    unpaidMonth = sd.getMonth() + 1;
    unpaidYear = sd.getFullYear();
  } else {
    return 999 * 30;
  }
  const invoiceSentDate = new Date(unpaidYear, unpaidMonth - 1, sendDay || 1);
  const diffDays = Math.floor((today - invoiceSentDate) / 86400000);
  return Math.max(0, diffDays);
}

// ⚠️ 2026-08-06 зарчим: "Хүлээлттэй" ТУСДАА талбар биш, АВТОМАТААР дериватив
// (Хугацаа хэтэрсэн хилээс бага). ЗӨВХӨН 2 бодит хил байна: overdueThreshold,
// riskThreshold. Энэ функц suh.html-ийн 3 газарт (тодорхойлолт) давхардаж
// бичигдсэн классификацийг НЭГ дор нэгтгэв.
export function classifyPaymentStatus(daysUnpaid, overdueThreshold = 35, riskThreshold = 365) {
  if (daysUnpaid < 1) return 'paid';
  if (daysUnpaid >= riskThreshold) return 'risk';
  if (daysUnpaid >= overdueThreshold) return 'overdue';
  return 'pending';
}

// ------------------------------------------------------------------
// Хэдэн (АЛЬ) сар төлөгдөөгүй вэ — suh.html-ийн _getUnpaidMonths() эх сурвалж.
// entity[startDateField] (ownDate эсвэл start), transactions-аас тухайн
// жилийн төлөгдсөн сарууд, "хамгийн эртнээс тасрахгүй дараалсан" тооцоолол.
// ------------------------------------------------------------------
export function getUnpaidMonths(entity, entityType, startDateField, transactions, month, year) {
  const paidMonths = new Set(
    (transactions || [])
      .filter((t) => t && t.type === 'income' && t.category === entityType && t.year === year &&
        (entityType === 'resident' ? String(t.apt) === String(entity.apt) : t.businessId === entity.id))
      .map((t) => t.month)
  );
  let startMonth = 1;
  const sd = entity[startDateField] ? new Date(entity[startDateField]) : null;
  if (sd && !isNaN(sd)) {
    const sy = sd.getFullYear(), sm = sd.getMonth() + 1;
    if (sy === year) startMonth = sm;
    else if (sy > year) startMonth = month + 1;
  }
  let consecutivePaid = startMonth - 1;
  for (let m = startMonth; m <= month; m++) {
    if (paidMonths.has(m)) consecutivePaid = m; else break;
  }
  const missing = [];
  for (let m = consecutivePaid + 1; m <= month; m++) missing.push(m);
  return missing;
}

// ⚠️ REGRESSION ТЕСТ КЕЙС 2 (catch-up): резидент/ААН аль сараа төлөхөө ӨӨРӨӨ
// СОНГОДОГГүй — хамгийн эртний төлөгдөөгүй сараас эхлэн дараалан "хөөж"
// төлдөг. Оруулсан НИЙТ дүнг тохирох тооны сард хуваарилж, сар БүРД тусдаа
// {month, amount} мөр буцаана (finance.js _allocatePaymentToMonths() эх сурвалж).
export function allocatePaymentToMonths(entity, entityType, amount, feeCatalog, transactions, month, year, ctx = {}) {
  const feeRows = (feeCatalog || [])
    .filter((f) => f.active && f.applies_to === entityType)
    .map((f) => Math.round(feeQuantity(entity, entityType, f.unit_type, ctx) * (+f.rate || 0)));
  const monthlyTotal = feeRows.reduce((s, x) => s + x, 0);
  const startField = entityType === 'resident' ? 'ownDate' : 'start';
  const missingMonths = getUnpaidMonths(entity, entityType, startField, transactions, month, year);
  if (!missingMonths.length) return [];
  let monthsToApply = monthlyTotal > 0 ? Math.round(amount / monthlyTotal) : 1;
  monthsToApply = Math.max(1, Math.min(monthsToApply, missingMonths.length));
  const monthsCovered = missingMonths.slice(0, monthsToApply);
  let remaining = amount;
  return monthsCovered.map((m, idx) => {
    const isLast = idx === monthsCovered.length - 1;
    const share = isLast ? remaining : Math.min(monthlyTotal, remaining);
    remaining -= share;
    return { month: m, amount: share };
  });
}
