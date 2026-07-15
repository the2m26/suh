// ============================================================
// accounting-bridge.js — suh.html-ийн санхүүгийн урсгалыг Supabase-ийн
// нягтлан бодох бүртгэлийн backend-тэй (chart_of_accounts/journal_entries/
// journal_lines + create_journal_entry() RPC) холбоно.
// ============================================================
// АРХИТЕКТУР: Энэ файл нь ЗӨВХӨН Дт/Кт мөрүүдийг угсарч
// sb.rpc('create_journal_entry', ...)-г дуудна. Балансын шалгалт, дансны
// код зөв эсэх зэрэг БҮХ баталгаажуулалт Postgres талд (create_journal_entry
// RPC дотор) хийгддэг тул энд дахин давхардуулаагүй.
//
// ЧУХАЛ ЗАРЧИМ: Энэ hook-ууд нь ОДОО байгаа transactions/businesses
// урсгалыг ОГТ ӨӨРЧЛӨХГҮЙ — зөвхөн ТЭДНИЙ ХАЖУУГААР нэмэлт journal entry
// үүсгэдэг ("instrumentation"). Хэрэв journal entry үүсгэхэд алдаа гарвал
// (жишээ нь сүлжээ тасрах), ГОЛ гүйлгээ (transactions insert) саадгүй
// үргэлжилнэ — зөвхөн toast анхааруулга гарна. Ингэснээр аккруэл системийн
// алдаа өдөр тутмын ажлыг зогсоохгүй.
// ============================================================

async function db_createJournalEntry(date, description, reference, lines) {
  const { data, error } = await sb.rpc('create_journal_entry', {
    p_date: date, p_description: description, p_reference: reference, p_lines: lines,
  });
  if (error) {
    console.error('Journal entry алдаа:', error.message, { date, description, reference, lines });
    return { success: false, error: error.message };
  }
  return { success: true, entryId: data };
}

async function db_getPartyBalance(account, party) {
  const { data, error } = await sb.rpc('get_party_balance', { p_account: account, p_party: party });
  if (error) { console.error('get_party_balance алдаа:', error.message); return 0; }
  return +data || 0;
}

// ------------------------------------------------------------
// САР БҮРИЙН АККРУЭЛ (нэхэмжлэх) — админ товч дараад дуудна.
// Аль хэдийн энэ сард нэхэмжилсэн эсэхийг reference-ээр шалгаж, ДАВХАРДУУЛАХГҮЙ.
// ------------------------------------------------------------
async function accountingCheckAlreadyAccrued(yearMonth) {
  const { data, error } = await sb.from('journal_entries').select('id').ilike('reference', `accrual:%:${yearMonth}`).limit(1);
  if (error) { console.error(error); return false; }
  return data && data.length > 0;
}

// Тухайн party-д өмнөх сараас "Урьдчилж орсон орлого" (3050) үлдэгдэлтэй эсэхийг шалгаж,
// байвал шинэ нэхэмжлэлтэй нь автоматаар тулгана (3050-г шавхаж, зөвхөн үлдэгдэл хэсгийг
// шинэ авлага (1110/1120) болгоно). Прэпайд байхгүй бол энгийн 2 мөрийн бичилт хэвээр.
async function buildAccrualLines(receivableAccount, incomeAccount, party, amount) {
  const prepaid = Math.max(await db_getPartyBalance('3050', party), 0);
  const offset = Math.min(prepaid, amount);
  const remaining = +(amount - offset).toFixed(2);
  const lines = [];
  if (offset > 0) lines.push({ account: '3050', debit: offset, credit: 0, party });
  if (remaining > 0) lines.push({ account: receivableAccount, debit: remaining, credit: 0, party });
  lines.push({ account: incomeAccount, debit: 0, credit: amount });
  return lines;
}

// ------------------------------------------------------------
// НЭХЭМЖЛЭХ ИЛГЭЭХ (Нягтлан бодох бүртгэл → "Нэхэмжлэх илгээх" tab).
// Хуучин "Гүйлгээний бүртгэл" хуудсанд байсан товчийг энд зөвлөж
// шилжүүлэв. Одоо тухайн сарыг илгээхээс өмнө хүлээн авагчдын
// жагсаалтыг харж, зарим хүнийг ЭНЭ САРААС түр хасах (invoiceExcludedIds,
// session-only — refresh хийвэл дахин бүрэн жагсаалт руу буцна) боломжтой.
// ------------------------------------------------------------
let invoiceExcludedIds = new Set();

async function sendMonthlyInvoice() {
  if (!canAccrue()) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  const yearMonth = `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}`;
  if (await accountingCheckAlreadyAccrued(yearMonth)) {
    toast('Тухайн сарын нэхэмжлэх аль хэдийн илгээгдсэн байна. Дахин хийгдэхгүй', 'error');
    return;
  }
  const rows = buildLiveInvoicePreviewRows();
  if (!rows.length) { toast('Нэхэмжлэх илгээх хүлээн авагч алга', 'error'); return; }
  if (!confirm(`${yearMonth} сарын хураамж/түрээсийг ${rows.length} хүлээн авагчид нэхэмжлэх үү?\n(Энэ үйлдлийг буцаах боломжгүй тул анхаарна уу.)`)) return;

  let succeeded = 0, failed = 0;
  for (const row of rows) {
    if (row.type === 'resident') {
      const lines = await buildAccrualLines('1110', '5100', row.partyKey, row.amount);
      const res = await db_createJournalEntry(
        `${yearMonth}-01`, `${row.label} тоот — ${yearMonth} сарын хураамж нэхэмжлэв`,
        `accrual:resident:${row.label}:${yearMonth}`, lines
      );
      res.success ? succeeded++ : failed++;
    } else {
      const lines = await buildAccrualLines('1120', '5400', row.partyKey, row.amount);
      const res = await db_createJournalEntry(
        `${yearMonth}-01`, `${row.label} — ${yearMonth} сарын түрээс нэхэмжлэв`,
        `accrual:business:${row.raw.id}:${yearMonth}`, lines
      );
      res.success ? succeeded++ : failed++;
    }
  }
  toast('Илгээсэн нэхэмжлэхийг цуцлах боломжгүйг анхаарна уу', failed ? 'error' : 'success');
  invoiceExcludedIds.clear();
  if (typeof renderInvoiceTab === 'function') renderInvoiceTab();
}

// Одоогийн (илгээгээгүй) сарын урьдчилсан жагсаалт — хасагдсан
// (invoiceExcludedIds) хүлээн авагчийг оруулахгvй.
function buildLiveInvoicePreviewRows() {
  const rows = [];
  for (const r of residents) {
    const partyKey = 'resident:' + r.apt;
    if (invoiceExcludedIds.has(partyKey)) continue;
    const amount = calcFee(residentSqm(r));
    if (!amount) continue;
    rows.push({ type: 'resident', partyKey, label: String(r.apt), name: (r.firstname || r.owner || '') + ' ' + (r.lastname || ''), amount, raw: r });
  }
  for (const b of businesses) {
    const partyKey = 'business:' + b.id;
    if (invoiceExcludedIds.has(partyKey)) continue;
    if (!b.monthlyFee) continue;
    rows.push({ type: 'business', partyKey, label: b.name, name: b.name, amount: +b.monthlyFee, raw: b });
  }
  return rows;
}

// ------------------------------------------------------------
// ТӨЛБӨР ХҮЛЭЭН АВАХ (settlement) hook-ууд — savePayment()/saveBizPayment()-
// ийн ХАЖУУГААР нэмэлтээр дуудагдана (тэдгээрийн одоогийн логикийг
// огт өөрчлөхгүй).
// ------------------------------------------------------------
async function accountingRecordResidentPayment(apt, amountPaid, date, description) {
  const party = 'resident:' + apt;
  const openBalance = Math.max(await db_getPartyBalance('1110', party), 0);
  const settleAmount = Math.min(amountPaid, openBalance);
  const overpayAmount = +(amountPaid - settleAmount).toFixed(2);

  const lines = [{ account: '1020', debit: amountPaid, credit: 0, party }];
  if (settleAmount > 0) lines.push({ account: '1110', debit: 0, credit: settleAmount, party });
  if (overpayAmount > 0) lines.push({ account: '3050', debit: 0, credit: overpayAmount, party });

  return db_createJournalEntry(date, description || `${apt} тоот — төлбөр хүлээн авав`, `payment:resident:${apt}:${date}`, lines);
}

async function accountingRecordBusinessPayment(businessId, amountPaid, date, description) {
  const party = 'business:' + businessId;
  const openBalance = Math.max(await db_getPartyBalance('1120', party), 0);
  const settleAmount = Math.min(amountPaid, openBalance);
  const overpayAmount = +(amountPaid - settleAmount).toFixed(2);

  const lines = [{ account: '1020', debit: amountPaid, credit: 0, party }];
  if (settleAmount > 0) lines.push({ account: '1120', debit: 0, credit: settleAmount, party });
  if (overpayAmount > 0) lines.push({ account: '3050', debit: 0, credit: overpayAmount, party });

  return db_createJournalEntry(date, description || `Аж ахуйн нэгж #${businessId} — төлбөр хүлээн авав`, `payment:business:${businessId}:${date}`, lines);
}

// ------------------------------------------------------------
// ҮНДСЭН ХӨРӨНГӨ (fixed_assets) hook-ууд — assets.js-ийн ХАЖУУГААР
// нэмэлтээр дуудагдана (одоогийн логикийг огт өөрчлөхгүй).
//
// ⚠️ ӨНӨӨДРИЙН ЗАСВАР (НББ-тэй бүрэн синхрон болгосон):
//   1. Бүх мөрд `party: 'asset:'+assetId` шошго нэмэв — тухайн ганц хөрөнгийн
//      2010/2015 дансны үлдэгдлийг getPartyBalance()-аар асуух боломжтой болсон.
//   2. reference/description-д ХӨРӨНГИЙН НЭР биш, ID ашигладаг болсон
//      (нэр давхцах/өөрчлөгдөх үед бичилт тасрахаас сэргийлнэ).
//   3. Өртөг засварлах (cost correction), Excel импортын цоорхойг нөхөх
//      (reconcile) функц нэмэгдэв.
// ------------------------------------------------------------

// Худалдан авалт: Дт 2010 (Үндсэн хөрөнгө) / Кт 1020 (Харилцах)
// ⚠️ Хялбарчлал: бэлнээр/харилцахаар шууд төлсөн гэж үзнэ. Зээлээр
// (нийлүүлэгчийн өглөгөөр) авсан бол нягтлан бодогч гараар засварлана.
async function accountingRecordAssetPurchase(assetId, assetName, cost, date) {
  if (!cost || cost <= 0) return { success: true };
  const party = 'asset:' + assetId;
  return db_createJournalEntry(date, `${assetName} — худалдан авалт`, `purchase:asset:${assetId}:${date}`,
    [{ account: '2010', debit: cost, credit: 0, party }, { account: '1020', debit: 0, credit: cost, party }]);
}

// Сарын элэгдэл: Дт 7060 (Элэгдлийн зардал) / Кт 2015 (Хуримтлагдсан элэгдэл)
// АНХААР: cash дансад ХӨДӨЛГӨӨН ХИЙХГҮЙ — элэгдэл мөнгөн бус зардал.
async function accountingRecordDepreciation(assetId, assetName, amount, date) {
  if (!amount || amount <= 0) return { success: true };
  const party = 'asset:' + assetId;
  return db_createJournalEntry(date, `${assetName} — элэгдэл (${date})`, `depreciation:asset:${assetId}:${date}`,
    [{ account: '7060', debit: amount, credit: 0, party }, { account: '2015', debit: 0, credit: amount, party }]);
}

// Актлалт (disposal): Кт 2010 (анхны өртөг бүхэлдээ хасагдана), Дт 2015
// (хуримтлагдсан элэгдэл цэвэрлэгдэнэ), Дт мөнгөн хөрөнгө (борлуулсан
// орлого байвал), Дт/Кт 8700 (алдагдал/ашиг — тэнцвэржүүлэгч мөр).
async function accountingRecordAssetDisposal(assetId, assetName, originalCost, accumulatedDep, disposalValue, date) {
  const party = 'asset:' + assetId;
  const bookValue = originalCost - accumulatedDep;
  const diff = (disposalValue || 0) - bookValue; // > 0 = ашиг, < 0 = алдагдал
  const lines = [];
  if (accumulatedDep > 0) lines.push({ account: '2015', debit: accumulatedDep, credit: 0, party });
  if (disposalValue > 0) lines.push({ account: '1010', debit: disposalValue, credit: 0, party });
  if (diff > 0) lines.push({ account: '8700', debit: 0, credit: diff, party });
  if (diff < 0) lines.push({ account: '8700', debit: -diff, credit: 0, party });
  lines.push({ account: '2010', debit: 0, credit: originalCost, party });
  if (lines.length < 2) return { success: true }; // хэвийн бус (0 өртөгтэй) тохиолдол
  return db_createJournalEntry(date, `${assetName} — актлагдсан`, `disposal:asset:${assetId}:${date}`, lines);
}

// Хөрөнгийн өртгийг ЗАСВАРЛАХ (edit) үед — анхны бичилтийг буруу гэж үзэж,
// зөрүүг нь Дт/Кт 2010 vs 1020 хооронд тохируулна.
async function accountingRecordAssetCostCorrection(assetId, assetName, oldCost, newCost, date) {
  const diff = +(newCost - oldCost).toFixed(2);
  if (Math.abs(diff) < 1) return { success: true };
  const party = 'asset:' + assetId;
  const lines = diff > 0
    ? [{ account: '2010', debit: diff, credit: 0, party }, { account: '1020', debit: 0, credit: diff, party }]
    : [{ account: '1020', debit: -diff, credit: 0, party }, { account: '2010', debit: 0, credit: -diff, party }];
  return db_createJournalEntry(date, `${assetName} — өртөг засварлав (${fmt(oldCost)} → ${fmt(newCost)})`,
    `cost_correction:asset:${assetId}:${date}`, lines);
}

// Тухайн хөрөнгийн 2010 дансанд (party='asset:{id}') аль хэдийн худалдан
// авалтын бичилт байгаа эсэхийг шалгаж, ДУТУУ бол автоматаар нөхнө.
// Энэ нь Excel-ээр бөөнөөр импортолсон (suhimpex.html, saveAsset()-г
// тойрсон) хөрөнгийг ч НББ-тэй синхрон болгодог — эх сурвалжаас үл хамааран.
async function reconcileAssetPurchaseEntries() {
  if (typeof assets === 'undefined') return { fixed: 0 };
  let fixed = 0, failed = 0;
  for (const a of assets) {
    if (!a.dbId || !a.cost || a.cost <= 0) continue;
    const existing = await db_getPartyBalance('2010', 'asset:' + a.dbId);
    if (existing > 0) continue; // аль хэдийн бичигдсэн
    const res = await accountingRecordAssetPurchase(a.dbId, a.name, a.cost, a.purchaseDate || todayStr());
    res.success ? fixed++ : failed++;
  }
  if (fixed > 0) console.info(`НББ синхрончлол: ${fixed} хөрөнгийн худалдан авалтын бичилт нөхөгдлөө.`);
  if (failed > 0) console.warn(`НББ синхрончлол: ${failed} хөрөнгө нөхөгдөж чадсангүй.`);
  return { fixed, failed };
}

// ------------------------------------------------------------
// ЗАРДЛЫН ДАНСНЫ MAPPING (санал болгож буй эхний хувилбар) — EXPENSE_CATS
// (finance.js)-ийн чөлөөт текст ангиллыг chart_of_accounts-ийн тодорхой
// дансуудтай нийцүүлнэ. ⚠️ ЭНЭ MAPPING-ИЙГ НЯГТЛАН БОДОГЧООР ХЯНУУЛАХЫГ
// ЗӨВЛӨЖ БАЙНА — зарим зүйл тодорхойгүй тул хамгийн ойрхон дансанд
// (ихэвчлэн 7090 "Бусад") ноогдуулсан болно.
// ------------------------------------------------------------
const EXPENSE_SUBCAT_TO_ACCOUNT = {
  'Цалин хөлсний зардал': '7010',
  'НДШ зардал': '7020',
  'Татварын зардал (ХХОАТ)': '3020', // энэ бол өглөг тооцох тул онцгой тохиолдол — доор тайлбарласан
  'Ашиглалтын зардалд төлсөн (цахилгаан, ус, дулаан, санхүүгийн програм)': '7040',
  'Интернет, шуудан холбоо, бичиг хэрэг': '7050',
  'Шатахуун, тээврийн хөлс': '7070',
  'Хуримтлалын сан': '4100', // энэ зардал биш, цэвэр хөрөнгийн нөөц рүү шилжүүлэлт — тусад нь бодолцоно
  'Үндсэн хөрөнгийн элэгдэл': '7060',
};
function mapExpenseSubcatToAccount(subcat) {
  return EXPENSE_SUBCAT_TO_ACCOUNT[subcat] || '7090'; // тодорхойгүй бол "Бусад ерөнхий зардал"
}

async function accountingRecordExpense(subcat, amount, date, description) {
  const account = mapExpenseSubcatToAccount(subcat);
  // Онцгой тохиолдол: элэгдлийг ГАР АРГААР (Зарлага нэмэх маягтаар) оруулбал ч мөнгөн бус
  // зардал хэвээр байх ёстой — cash (1020) биш, 2015 (Хуримтлагдсан элэгдэл) дансыг хөндөнө.
  if (account === '7060') {
    return db_createJournalEntry(date, description || subcat, `expense:${account}:${date}`,
      [{ account, debit: amount, credit: 0 }, { account: '2015', debit: 0, credit: amount }]);
  }
  return db_createJournalEntry(date, description || subcat, `expense:${account}:${date}`,
    [{ account, debit: amount, credit: 0 }, { account: '1020', debit: 0, credit: amount }]);
}

async function accountingRecordIncome(subcat, amount, date, description) {
  // Одоогийн INCOME_CATS нь резидент/бизнесээс тусдаа "бусад орлого" төрлүүд
  // (жишээ нь антен/лифтний самбарын түрээс, банкны хүү) — эдгээрийг 5600
  // (Бусад орлого) дансанд ноогдуулна.
  return db_createJournalEntry(date, description || subcat, `income:5600:${date}`,
    [{ account: '1020', debit: amount, credit: 0 }, { account: '5600', debit: 0, credit: amount }]);
}
