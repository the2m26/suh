import { describe, it, expect } from 'vitest';
import { classifyPaymentStatus, daysUnpaidForResident } from '../financeEngine';

// ⚠️ ЭТАЛОН БОЛГОСОН БОДИТ АЛДАА (2026-08-06): анхны хэрэгжүүлэлтэд
// "mu >= pendingThreshold" гэсэн ЭСРЭГ ЧИГЛЭЛТЭЙ (буруу) шалгалт байсан тул,
// резидент төлбөрөө төлөхөд шинэ (бага) хоногийн тоо НЭГ Ч tab-ийн нөхцөлд
// таарахгүй "алга болох" эрсдэлтэй байв (жиш нь: Хугацаа хэтэрсэн-ээс гарсан
// ч Хүлээлттэй-д ч ороогүй "хоосон зайд" унах боломжтой байсан).
//
// Заавал баримтлах зарчим: 3 tab (pending/overdue/risk)-ийн нөхцлүүд ЗАВСАРГүй,
// ХАМРАЛТ 100% байх ёстой — [1, overdueThreshold) ∪ [overdueThreshold,
// riskThreshold) ∪ [riskThreshold, ∞) — 0-ээс дээш ЯМАР ч хоногийн тоо яг НЭГ
// ангилалд орно, хэзээ ч "юунд ч ороогүй" гэж үлдэхгүй.

const overdueThreshold = 35;
const riskThreshold = 365;

describe('Boundary логикийн чиглэл — төлбөр төлөхөд "алга болох" эрсдэлгүй', () => {
  it('Эрсдэлтэй резидент (400 хоног) төлбөрөө төлөхөд шинэ 0 хоног → "paid" болж, алга болохгүй', () => {
    // Төлөхөөс өмнө
    expect(classifyPaymentStatus(400, overdueThreshold, riskThreshold)).toBe('risk');
    // Төлсний дараа (шинэ гүйлгээ үүссэнээр daysUnpaid дахин тооцогдоход 0 болно)
    expect(classifyPaymentStatus(0, overdueThreshold, riskThreshold)).toBe('paid');
  });

  it('Хугацаа хэтэрсэн резидент (100 хоног) хэсэгчилсэн төлбөр хийж 10 хоног болоход "pending" рүү ЗӨВ шилжинэ (алга болохгүй)', () => {
    expect(classifyPaymentStatus(100, overdueThreshold, riskThreshold)).toBe('overdue');
    expect(classifyPaymentStatus(10, overdueThreshold, riskThreshold)).toBe('pending');
  });

  it('0-ээс 500 хүртэлх БүХ бүхэл хоногийн утга яг НЭГ ангилалд ордог эсэхийг exhaustive шалгана (зай үүсэхгүй)', () => {
    for (let days = 0; days <= 500; days++) {
      const status = classifyPaymentStatus(days, overdueThreshold, riskThreshold);
      expect(['paid', 'pending', 'overdue', 'risk']).toContain(status);
    }
  });

  it('Хилийн ХОЁР ТАЛД (34/35, 364/365) яг НЭГ УДАА л шилждэг — 2 удаа шилжих (доголдол) байхгүй', () => {
    const statuses = [];
    for (let days = 30; days <= 40; days++) statuses.push(classifyPaymentStatus(days, overdueThreshold, riskThreshold));
    // 30-34: pending (5), 35-40: overdue (6) — яг 1 удаа шилждэг
    const transitions = statuses.filter((s, i) => i > 0 && s !== statuses[i - 1]).length;
    expect(transitions).toBe(1);
  });

  it('Реалист сценар: резидент 400 хоног (risk) байгаад, ownDate-ээ шинэчлэхгүйгээр яг ӨНӨӨДӨР төлбөр хийвэл (шинэ transaction үүсэх) daysUnpaidForResident 0 болж, "paid"-руу шилжинэ', () => {
    const r = { apt: 401, isVirtual: false, ownDate: '2025-01-01' };
    const today = new Date(2026, 7, 6);
    const beforePay = daysUnpaidForResident(r, [], 1, today);
    expect(classifyPaymentStatus(beforePay, overdueThreshold, riskThreshold)).toBe('risk');

    // Одоо тухайн сарын (8-р сар, 2026) орлогын гүйлгээ бүртгэгдсэн гэж үзье
    const txAfterPay = [{ type: 'income', category: 'resident', apt: 401, month: 8, year: 2026 }];
    const afterPay = daysUnpaidForResident(r, txAfterPay, 1, today);
    expect(afterPay).toBe(0);
    expect(classifyPaymentStatus(afterPay, overdueThreshold, riskThreshold)).toBe('paid');
  });
});
