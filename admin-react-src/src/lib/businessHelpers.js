// businesses.js-ийн цэвэр туслах функцүүдийн React талын эх сурвалж.

export function filterBusinessesList(businesses, query) {
  const q = (query || '').toLowerCase();
  const list = q ? (businesses || []).filter((b) => {
    return (b.name || '').toLowerCase().includes(q)
      || (b.regno || '').includes(q)
      || (b.mobile || '').includes(q)
      || (b.phone || '').includes(q)
      || (b.contract || '').toLowerCase().includes(q)
      || (b.vehicles || []).join(' ').toLowerCase().includes(q)
      || (b.parkings || []).join(' ').toLowerCase().includes(q)
      || (b.storages || []).join(' ').toLowerCase().includes(q);
  }) : (businesses || []);
  return list.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'mn'));
}

export function filterClienteleList(clientele, query) {
  const q = (query || '').toLowerCase();
  const list = q ? (clientele || []).filter((c) => {
    return (c.legalName || '').toLowerCase().includes(q)
      || (c.regNo || '').includes(q)
      || (c.ceo || '').toLowerCase().includes(q)
      || (c.mobile || '').includes(q)
      || (c.phone || '').includes(q)
      || (c.email || '').toLowerCase().includes(q)
      || (c.contractNo || '').toLowerCase().includes(q)
      || (c.note || '').toLowerCase().includes(q);
  }) : (clientele || []);
  return list.slice().sort((a, b) => (a.legalName || '').localeCompare(b.legalName || '', 'mn'));
}

// businesses.js-ийн openBusinessDetail() дэх гэрээний хугацааны төлөв.
export function contractStatus(endStr) {
  if (!endStr) return null;
  const now = new Date();
  const endDate = new Date(endStr.replace(/\//g, '-'));
  if (isNaN(endDate)) return null;
  const expired = endDate < now;
  const expiring = !expired && (endDate - now) < 30 * 24 * 60 * 60 * 1000;
  if (expired) return 'expired';
  if (expiring) return 'expiring';
  return 'active';
}

// businesses.js-ийн renderBusinesses()-ийн 12 сарын гэрээний төлбөрийн
// badge (мөр ~141-147).
export function businessMonthBadges(businessId, transactions, curMonth, curYear) {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  return months.map((m) => {
    const wasPaid = transactions.some((t) => t && t.businessId === businessId && t.month === m && t.year === curYear);
    const isFuture = m > curMonth;
    return { month: m, status: isFuture ? 'future' : (wasPaid ? 'paid' : 'unpaid') };
  });
}
