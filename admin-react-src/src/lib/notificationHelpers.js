// notifications.js-ийн цэвэр туслах функцүүдийн React талын эх сурвалж.

export const NOTIF_FILTER_LABELS_BY_KIND = {
  resident: { all: 'Бүх Сууц өмчлөгч', specific: 'Тухайлсан', pending: 'Хүлээгдэж буй', overdue: 'Хугацаа хэтэрсэн', risk: 'Эрсдэлтэй' },
  business: { all: 'Бүх ААН', specific: 'Тухайлсан', pending: 'Хүлээгдэж буй', overdue: 'Хугацаа хэтэрсэн', risk: 'Эрсдэлтэй' },
  staff: { all: 'Бүх ажилтан', specific_employee: 'Тухайлсан' },
};

export function resolveNotificationRecipients(kind, filter, specificId, {
  residents, businesses, employees, daysUnpaidForResidentFn, daysUnpaidForBusinessFn,
  transactions, feeThresholds, bizThresholds,
}) {
  if (kind === 'staff') {
    if (filter === 'specific_employee') {
      const e = employees.find((x) => x.id === specificId);
      return e ? [{ name: e.fullName || '—', ref_type: 'employee', ref_id: e.id }] : [];
    }
    return employees.filter((e) => e && e.status === 'active').map((e) => ({ name: e.fullName || '—', ref_type: 'employee', ref_id: e.id }));
  }

  if (kind === 'resident') {
    if (filter === 'specific') {
      const r = residents.find((x) => x.id === specificId);
      return r ? [{ name: `${r.firstname || ''} ${r.lastname || ''}`, ref_type: 'resident', ref_id: r.id, apt: r.apt }] : [];
    }
    return residents.filter((r) => {
      if (!r || r.isVirtual) return false;
      if (filter === 'all') return true;
      const mu = daysUnpaidForResidentFn(r, transactions);
      if (filter === 'pending') return mu >= 1 && mu < feeThresholds.overdue;
      if (filter === 'overdue') return mu >= feeThresholds.overdue && mu < feeThresholds.risk;
      if (filter === 'risk') return mu >= feeThresholds.risk;
      return false;
    }).map((r) => ({ name: `${r.firstname || ''} ${r.lastname || ''}`, ref_type: 'resident', ref_id: r.id, apt: r.apt }));
  }

  if (kind === 'business') {
    if (filter === 'specific') {
      const b = businesses.find((x) => x.id === specificId);
      return b ? [{ name: b.name, ref_type: 'business', ref_id: b.id }] : [];
    }
    return businesses.filter((b) => {
      if (!b) return false;
      if (filter === 'all') return true;
      const mu = daysUnpaidForBusinessFn(b, transactions);
      if (filter === 'pending') return mu >= 1 && mu < bizThresholds.overdue;
      if (filter === 'overdue') return mu >= bizThresholds.overdue && mu < bizThresholds.risk;
      if (filter === 'risk') return mu >= bizThresholds.risk;
      return false;
    }).map((b) => ({ name: b.name, ref_type: 'business', ref_id: b.id }));
  }
  return [];
}

export function buildAutoTitle(kind, filter, recipients) {
  if (kind === 'staff') return '';
  if (kind === 'resident') {
    if (filter === 'all') return 'Нийт Сууц өмчлөгч Танаа';
    return recipients.length === 1
      ? `${recipients[0].name}${recipients[0].apt ? ' ' + recipients[0].apt : ''} Танаа`
      : `${NOTIF_FILTER_LABELS_BY_KIND.resident[filter] || 'Сууц өмчлөгч'} Танаа`;
  }
  if (kind === 'business') {
    if (filter === 'all') return 'Нийт ААН-д';
    return recipients.length === 1 ? `${recipients[0].name}-д` : `${NOTIF_FILTER_LABELS_BY_KIND.business[filter] || 'ААН'}-д`;
  }
  return '';
}
