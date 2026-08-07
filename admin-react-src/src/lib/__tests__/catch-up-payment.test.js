import { describe, it, expect } from 'vitest';
import { allocatePaymentToMonths, getUnpaidMonths } from '../financeEngine';

// ⚠️ ЭТАЛОН БОЛГОСОН БОДИТ АЛДАА (2026-08-05): резидент 3 сарын өртэй байхад
// нийт дүнгээ нэг дор төлөхөд, ӨМНӨ зөвхөн 1 transaction+journal entry
// үүсгэдэг байсан (зөвхөн одоогийн сарын задаргааг л харуулдаг байсан) —
// үлдсэн өмнөх сарууд DB-д "төлөгдөөгүй" хэвээр үлддэг байв.
//
// Заавал баримтлах зарчим: резидент/ААН аль сараа төлөхөө ӨӨРӨӨ СОНГОДОГГүй
// — хамгийн эртний төлөгдөөгүй сараас эхлэн дараалан "хөөж" төлдөг. Нийт
// дүнг тохирох тооны сард хуваарилж, сар БүРД ТУСДАА transaction+journal
// entry үүсгэх ёстой (зөвхөн 1 биш).

const feeCatalog = [{ active: true, applies_to: 'resident', unit_type: 'flat', rate: 20000 }];

// Резидент 2026-01-01-нээс өмчилсөн, 2026-08 хүртэл ЯМАР Ч сар төлөөгүй (8 сар өртэй)
const resident = { id: 5, apt: 205, isVirtual: false, ownDate: '2026-01-01' };

describe('Catch-up төлбөр — олон сарын өрийг нэг дор төлөхөд сар бүрд тусдаа бүртгэл үүсэх ёстой', () => {
  it('3 сарын өртэй резидент нийт дүнгээ (60000 = 3×20000) нэг дор төлөхөд 3 ТУСДАА мөр үүснэ (1 биш)', () => {
    // 2026-06, 07, 08 гэсэн 3 сар төлөгдөөгүй гэж үзье (01-05 төлөгдсөн)
    const transactions = [
      { type: 'income', category: 'resident', apt: 205, month: 1, year: 2026 },
      { type: 'income', category: 'resident', apt: 205, month: 2, year: 2026 },
      { type: 'income', category: 'resident', apt: 205, month: 3, year: 2026 },
      { type: 'income', category: 'resident', apt: 205, month: 4, year: 2026 },
      { type: 'income', category: 'resident', apt: 205, month: 5, year: 2026 },
    ];
    const missing = getUnpaidMonths(resident, 'resident', 'ownDate', transactions, 8, 2026);
    expect(missing).toEqual([6, 7, 8]);

    const allocations = allocatePaymentToMonths(resident, 'resident', 60000, feeCatalog, transactions, 8, 2026);

    // ⚠️ ЭНЭ бол шалгах гол зүйл: 1 мөр биш, 3 ТУСДАА мөр байх ёстой
    expect(allocations).toHaveLength(3);
    expect(allocations.map((a) => a.month)).toEqual([6, 7, 8]);
    // Мөн дүн зөв хуваарилагдсан байх ёстой (нийлбэр нь оруулсан дүнтэй тэнцүү)
    const total = allocations.reduce((s, a) => s + a.amount, 0);
    expect(total).toBe(60000);
  });

  it('Хэсэгчилсэн дүн (2 сарын үнэтэй ойролцоо) оруулахад 2 сарыг л хуваарилна, 3 дахийг биш', () => {
    const transactions = [
      { type: 'income', category: 'resident', apt: 205, month: 1, year: 2026 },
      { type: 'income', category: 'resident', apt: 205, month: 2, year: 2026 },
      { type: 'income', category: 'resident', apt: 205, month: 3, year: 2026 },
      { type: 'income', category: 'resident', apt: 205, month: 4, year: 2026 },
      { type: 'income', category: 'resident', apt: 205, month: 5, year: 2026 },
    ];
    const allocations = allocatePaymentToMonths(resident, 'resident', 40000, feeCatalog, transactions, 8, 2026);
    expect(allocations).toHaveLength(2);
    expect(allocations.map((a) => a.month)).toEqual([6, 7]);
  });

  it('Дан ганц сарын дүн (нэг сарын хэвийн төлбөр) 1 мөр л үүсгэнэ — олон сарын үед 1 мөрөөр хязгаарлагдахгүй болохыг харьцуулна', () => {
    const transactions = [];
    const singleMonthResident = { id: 6, apt: 206, isVirtual: false, ownDate: '2026-08-01' };
    const allocations = allocatePaymentToMonths(singleMonthResident, 'resident', 20000, feeCatalog, transactions, 8, 2026);
    expect(allocations).toHaveLength(1);
    expect(allocations[0]).toEqual({ month: 8, amount: 20000 });
  });
});
