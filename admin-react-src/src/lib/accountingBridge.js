import { sb } from './supabase';

// АРХИТЕКТУРЫН ШИЙДВЭР 3: энэ файл accounting-bridge.js-ийн React талын НЭГ Л
// эх сурвалж. suh.html-д энэ логик өөрчлөгдвөл ЭНД ч мөн зэрэг тааруулах ёстой.
// Алдаа гарвал ГОЛ гүйлгээ зогсохгүй — зөвхөн console/toast анхааруулна.

export async function dbCreateJournalEntry(date, description, reference, lines) {
  const { data, error } = await sb.rpc('create_journal_entry', {
    p_date: date, p_description: description, p_reference: reference, p_lines: lines,
  });
  if (error) {
    console.error('Journal entry алдаа:', error.message, { date, description, reference, lines });
    return { success: false, error: error.message };
  }
  return { success: true, entryId: data };
}

export async function dbGetPartyBalance(account, party) {
  const { data, error } = await sb.rpc('get_party_balance', { p_account: account, p_party: party });
  if (error) { console.error('get_party_balance алдаа:', error.message); return 0; }
  return +data || 0;
}

export async function accountingRecordIncome(subcat, amount, date, description) {
  return dbCreateJournalEntry(date, description || subcat, `income:5600:${date}`,
    [{ account: '1020', debit: amount, credit: 0 }, { account: '5600', debit: 0, credit: amount }]);
}

// accounting-bridge.js-ийн accountingRecordResidentPayment() — ААН-ийн
// (аль хэдийн зөвшөөрөгдсөн) яг ижил загвар, зөвхөн 1110/'resident:' party.
export async function accountingRecordResidentPayment(apt, amountPaid, date, description, refKey) {
  const party = 'resident:' + apt;
  const openBalance = Math.max(await dbGetPartyBalance('1110', party), 0);
  const settleAmount = Math.min(amountPaid, openBalance);
  const overpayAmount = +(amountPaid - settleAmount).toFixed(2);
  const lines = [{ account: '1020', debit: amountPaid, credit: 0, party }];
  if (settleAmount > 0) lines.push({ account: '1110', debit: 0, credit: settleAmount, party });
  if (overpayAmount > 0) lines.push({ account: '3050', debit: 0, credit: overpayAmount, party });
  const ref = refKey ? `payment:resident:${apt}:${date}:${refKey}` : `payment:resident:${apt}:${date}`;
  return dbCreateJournalEntry(date, description || `${apt} тоот — төлбөр хүлээн авав`, ref, lines);
}

export async function accountingRecordBusinessPayment(businessId, amountPaid, date, description, refKey) {
  const party = 'business:' + businessId;
  const openBalance = Math.max(await dbGetPartyBalance('1120', party), 0);
  const settleAmount = Math.min(amountPaid, openBalance);
  const overpayAmount = +(amountPaid - settleAmount).toFixed(2);
  const lines = [{ account: '1020', debit: amountPaid, credit: 0, party }];
  if (settleAmount > 0) lines.push({ account: '1120', debit: 0, credit: settleAmount, party });
  if (overpayAmount > 0) lines.push({ account: '3050', debit: 0, credit: overpayAmount, party });
  const ref = refKey ? `payment:business:${businessId}:${date}:${refKey}` : `payment:business:${businessId}:${date}`;
  return dbCreateJournalEntry(date, description || `Аж ахуйн нэгж #${businessId} — төлбөр хүлээн авав`, ref, lines);
}

export async function accountingRecordDepreciation(assetId, assetName, amount, date) {
  if (!amount || amount <= 0) return { success: true };
  const party = 'asset:' + assetId;
  return dbCreateJournalEntry(date, `${assetName} — элэгдэл (${date})`, `depreciation:asset:${assetId}:${date}`,
    [{ account: '7060', debit: amount, credit: 0, party }, { account: '2015', debit: 0, credit: amount, party }]);
}

export async function accountingRecordAssetDisposal(assetId, assetName, originalCost, accumulatedDep, disposalValue, date) {
  const party = 'asset:' + assetId;
  const bookValue = originalCost - accumulatedDep;
  const diff = (disposalValue || 0) - bookValue;
  const lines = [];
  if (accumulatedDep > 0) lines.push({ account: '2015', debit: accumulatedDep, credit: 0, party });
  if (disposalValue > 0) lines.push({ account: '1010', debit: disposalValue, credit: 0, party });
  if (diff > 0) lines.push({ account: '8700', debit: 0, credit: diff, party });
  if (diff < 0) lines.push({ account: '8700', debit: -diff, credit: 0, party });
  lines.push({ account: '2010', debit: 0, credit: originalCost, party });
  if (lines.length < 2) return { success: true };
  return dbCreateJournalEntry(date, `${assetName} — актлагдсан`, `disposal:asset:${assetId}:${date}`, lines);
}

// assets.js-ийн мөнгөн дүнгийн элэгдлийн томьёо (2026-08-06 зөвшөөрлөөр портлов).
export function accumulatedDepreciationAtMonths(a, monthsElapsed) {
  monthsElapsed = Math.max(0, Math.min(monthsElapsed, a.usefulLife || 0));
  if (a.depMethod === 'declining_balance') {
    const annualRate = (a.decliningRate || 20) / 100;
    const monthlyRate = annualRate / 12;
    let bookValue = a.cost;
    let accumulated = 0;
    for (let m = 0; m < monthsElapsed; m++) {
      const dep = Math.min(bookValue - a.salvage, bookValue * monthlyRate);
      if (dep <= 0) break;
      bookValue -= dep;
      accumulated += dep;
    }
    return accumulated;
  }
  const monthlyDep = (a.cost - a.salvage) / (a.usefulLife || 1);
  return Math.min(monthlyDep * monthsElapsed, a.cost - a.salvage);
}

export function computeDepreciation(a, monthsBetweenDatesFn) {
  if (!a.purchaseDate || !a.usefulLife) return { accumulated: 0, bookValue: a.cost };
  const endDateStr = (a.status === 'disposed' && a.disposalDate) ? a.disposalDate : new Date().toISOString().slice(0, 10);
  const monthsElapsed = monthsBetweenDatesFn(a.purchaseDate, endDateStr);
  const accumulated = accumulatedDepreciationAtMonths(a, monthsElapsed);
  return { accumulated, bookValue: Math.max(a.cost - accumulated, a.salvage) };
}
