// finance.js-ийн Тариф тохиргооны цэвэр тэмдэглэгээ/сонголтуудын React талын
// эх сурвалж. ⚠️ Архитектурын шийдвэр 2: finance.js-тэй ЯГ таарч байх ёстой.

export const FEE_UNIT_LABELS = {
  main_sqm: { badge: 'Талбайгаар (₮/м²/сар)', rateLabel: 'Хэмжээ (₮/м²/сар)' },
  main_count: { badge: 'Тоогоор (₮/ш/сар)', rateLabel: 'Хэмжээ (₮/ширхэг/сар)' },
  storage_sqm: { badge: 'Талбайгаар (₮/м²/сар)', rateLabel: 'Хэмжээ (₮/м²/сар)' },
  storage_count: { badge: 'Тоогоор (₮/ш/сар)', rateLabel: 'Хэмжээ (₮/ширхэг/сар)' },
  parking_sqm: { badge: 'Талбайгаар (₮/м²/сар)', rateLabel: 'Хэмжээ (₮/м²/сар)' },
  parking_count: { badge: 'Тоогоор (₮/ш/сар)', rateLabel: 'Хэмжээ (₮/ширхэг/сар)' },
  flat: { badge: 'Тогтмол (₮/сар)', rateLabel: 'Хэмжээ (₮/сар)' },
};

// object_type (main/parking/storage/custom)-аас хамааруулж, тухайн мөрд
// боломжтой unit_type сонголтуудыг тодорхойлно — үнэн ХЭРЭГЖИХГүй төрлийг
// нуугдмалаар холбохоос сэргийлнэ (2026-07-27 засвар).
export const FEE_OBJECT_UNIT_OPTIONS = {
  main: [['main_sqm', 'Талбайгаар (₮/м²/сар)'], ['main_count', 'Тоогоор (₮/ш/сар) — 1 нэгж=1'], ['flat', 'Тогтмол (₮/сар)']],
  parking: [['parking_sqm', 'Талбайгаар (₮/м²/сар)'], ['parking_count', 'Тоогоор (₮/ш/сар)'], ['flat', 'Тогтмол (₮/сар)']],
  storage: [['storage_sqm', 'Талбайгаар (₮/м²/сар)'], ['storage_count', 'Тоогоор (₮/ш/сар)'], ['flat', 'Тогтмол (₮/сар)']],
  custom: [['main_sqm', 'Талбайгаар (₮/м²/сар)'], ['parking_count', 'Зогсоолын тоогоор (₮/ш/сар)'], ['storage_count', 'Агуулахын тоогоор (₮/ш/сар)'], ['flat', 'Тогтмол (₮/сар)']],
};
