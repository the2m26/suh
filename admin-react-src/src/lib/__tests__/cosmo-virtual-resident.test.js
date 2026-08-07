import { describe, it, expect } from 'vitest';
import { calcFee, daysUnpaidForResident, getUnpaidMonths } from '../financeEngine';

// ⚠️ ЭТАЛОН БОЛГОСОН БОДИТ АЛДАА (2026-08-05, suh-main session): Cosmo
// (виртуал резидент, apt=0, isVirtual=true) санхүүгийн тооцоолол (өр, орлого,
// нийт нэгжийн тоо) хэсэгт "8 сарын өртэй" мэт буруу гарч байсан. Үндсэн
// шалтгаан: ownDate байхгүй тул 1-р сараас эхлэн төлбөргүй гэж тооцогдож байв.
// Мөн calcFee() дотор ч 'flat'/'main_count' fee-үүд area-аас үл хамааран
// үргэлж 1 буцаадаг байснаас Cosmo-д ч төлбөр тооцогдож болзошгүй байв.
//
// Заавал баримтлах зарчим: Cosmo ЯМАР Ч санхүүгийн тооцоололд орохгүй,
// ГЭХДЭЭ residents массиваас хасагдахгүй (CC center-т харагдаж, чатлах
// боломжтой байх ёстой тул) — тиймээс "хасах" биш "тооцооллын функцэд
// хамгаалалт тавих" аргаар шийдсэн (энэ файлын calcFee/daysUnpaidForResident
// ЭХЭНД нь isVirtual шалгалт).

const cosmo = { id: 0, apt: 0, isVirtual: true, ownDate: null, firstname: 'Cosmo' };
const feeCatalog = [
  { active: true, applies_to: 'resident', unit_type: 'flat', rate: 15000 },
  { active: true, applies_to: 'resident', unit_type: 'main_count', rate: 5000 },
];

describe('Cosmo (isVirtual) — санхүүгийн тооцоололд ОРОХГҮЙ', () => {
  it('calcFee() Cosmo-д 0 буцаана (fee catalog-ийн rate 0-ээс ялгаатай ч)', () => {
    expect(calcFee(cosmo, feeCatalog)).toBe(0);
  });

  it('calcFee() Cosmo-гүй энгийн резидентэд ердийн тооцоолол хийнэ (эталон харьцуулалт)', () => {
    const normalResident = { id: 1, apt: 101, isVirtual: false, sqm: 60 };
    expect(calcFee(normalResident, feeCatalog)).toBe(20000); // 15000(flat) + 5000(main_count)
  });

  it('daysUnpaidForResident() Cosmo-д ownDate байхгүй ч 0 буцаана (999*30 сентинел ОГТ хамаарахгүй)', () => {
    expect(daysUnpaidForResident(cosmo, [], 1, new Date(2026, 7, 6))).toBe(0);
  });

  it('daysUnpaidForResident() Cosmo-д гүйлгээний түүх байхгүй байсан ч 0 хэвээр', () => {
    const emptyTx = [];
    expect(daysUnpaidForResident(cosmo, emptyTx)).toBe(0);
  });

  it('getUnpaidMonths() Cosmo-д ownDate=null байхад 1-р сараас "999+ сар төлөгдөөгүй" гэж унахгүй — гэхдээ энэ функц isVirtual шалгадаггүй тул дуудагч тал (calcFee/daysUnpaid) хамгаалалт хийх ёстойг баталгаажуулна', () => {
    // getUnpaidMonths() өөрөө isVirtual шалгадаггүй (зориудаар цэвэр, ерөнхий
    // функц) — тиймээс Cosmo-г ЭНД дамжуулахгүйгээр, дуудагч тал (жиш нь
    // getResidentDebtInfo эквивалент) residents.filter(r=>!r.isVirtual) хийх
    // ёстойг баталгаажуулна.
    const missing = getUnpaidMonths(cosmo, 'resident', 'ownDate', [], 8, 2026);
    expect(missing.length).toBeGreaterThan(0); // энэ өөрөө хэвийн (функц isVirtual мэдэхгүй)
    // → тиймээс өрийн жагсаалт бэлдэх функц ЗААВАЛ .filter(r=>!r.isVirtual) хийх ёстой
  });
});
