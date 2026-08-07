import { describe, it, expect } from 'vitest';
import { classifyPaymentStatus, daysUnpaidForResident } from '../financeEngine';

// ⚠️ ЭТАЛОН БОЛГОСОН БОДИТ АЛДАА (2026-08-05→06, 2 удаагийн засвар):
// (1) 2026-08-05: сараар (бүхэл тоогоор) тооцдог байсан тул "7-р сар
//     төлөөгүй, 8-р сарын нэхэмжлэх аль хэдийн илгээгдсэн" үед ч "1 сар л
//     төлөөгүй" гэж тооцогдож, Хугацаа хэтэрсэн рүү шилжихийн тулд 2 бүтэн
//     сар хүлээх шаардлагатай байсан. → ХОНОГООР тооцоолол руу шилжив.
// (2) 2026-08-06: анхны хэрэгжүүлэлтэд "Хүлээлттэйд тооцох хугацаа" гэсэн
//     ГУРАВ ДАХЬ талбар байсан нь Overdue-тэй зөрчилдөж зай үүсгэдэг байсан.
//     → ЗӨВХӨН 2 БОДИТ ХИЛ (overdueThreshold, riskThreshold) үлдээж,
//     Хүлээлттэй нь "Хугацаа хэтэрсэн хилээс бага" гэдгээр АВТОМАТААР
//     тооцогддог (дериватив) болгов.

describe('Төлбөрийн төлөв — ХОНОГООР тооцоолол, 2 бодит хил', () => {
  const overdueThreshold = 35;
  const riskThreshold = 365;

  it('0 хоног төлөгдөөгүй бол "paid" (ямар ч tab-д ороогүй)', () => {
    expect(classifyPaymentStatus(0, overdueThreshold, riskThreshold)).toBe('paid');
  });

  it('1-34 хоног хооронд "pending" (АВТОМАТААР дериватив, тусдаа талбар шаардахгүй)', () => {
    expect(classifyPaymentStatus(1, overdueThreshold, riskThreshold)).toBe('pending');
    expect(classifyPaymentStatus(20, overdueThreshold, riskThreshold)).toBe('pending');
    expect(classifyPaymentStatus(34, overdueThreshold, riskThreshold)).toBe('pending');
  });

  it('overdueThreshold (35)-аас эхлэн riskThreshold (365) хүртэл "overdue"', () => {
    expect(classifyPaymentStatus(35, overdueThreshold, riskThreshold)).toBe('overdue');
    expect(classifyPaymentStatus(200, overdueThreshold, riskThreshold)).toBe('overdue');
    expect(classifyPaymentStatus(364, overdueThreshold, riskThreshold)).toBe('overdue');
  });

  it('riskThreshold (365)-аас эхлэн "risk"', () => {
    expect(classifyPaymentStatus(365, overdueThreshold, riskThreshold)).toBe('risk');
    expect(classifyPaymentStatus(1000, overdueThreshold, riskThreshold)).toBe('risk');
  });

  it('⚠️ БАГТААЖ ГАРАХГүй ХИЛ: 34→35 шилжихэд яг НЭГ удаа pending→overdue шилжинэ, зай үүсэхгүй', () => {
    expect(classifyPaymentStatus(34, overdueThreshold, riskThreshold)).toBe('pending');
    expect(classifyPaymentStatus(35, overdueThreshold, riskThreshold)).toBe('overdue');
  });

  it('⚠️ БАГТААЖ ГАРАХГүй ХИЛ: 364→365 шилжихэд яг НЭГ удаа overdue→risk шилжинэ', () => {
    expect(classifyPaymentStatus(364, overdueThreshold, riskThreshold)).toBe('overdue');
    expect(classifyPaymentStatus(365, overdueThreshold, riskThreshold)).toBe('risk');
  });

  it('daysUnpaidForResident() 7-р сарын нэхэмжлэх 8-р сар руу шилжсэн ч сараар БИШ, ХОНОГООР зөв тооцоолсон эсэхийг баталгаажуулна', () => {
    // ownDate 2026-01-01, гүйлгээний түүх байхгүй → sendDay=1-ээр 2026-01-01-нээс
    // өнөөдөр (2026-08-06) хүртэлх хоногийг тооцно (~218 хоног — overdue хилийг
    // давсан ч risk хилд хүрээгүй, яг ХОНОГООР тооцоолсныг батална).
    const r = { apt: 301, isVirtual: false, ownDate: '2026-01-01' };
    const today = new Date(2026, 7, 6); // 2026-08-06
    const days = daysUnpaidForResident(r, [], 1, today);
    expect(days).toBeGreaterThan(overdueThreshold);
    expect(days).toBeLessThan(riskThreshold);
    expect(classifyPaymentStatus(days, overdueThreshold, riskThreshold)).toBe('overdue');
  });
});
