// accounting-reports.js-ийн CHART_OF_ACCOUNTS/ACCOUNT_CATEGORIES-ийн React
// талын эх сурвалж — ЯГ хуулбар (Сангийн сайдын 386 тоот тушаалын 3-р
// хавсралт "Санхүүгийн тайлангийн А маягт"-аас албан ёсны эх хувиас
// хуулбарласан дансны жагсаалт). Архитектурын шийдвэр 2: suh.html-тэй
// таарч байх ёстой.

export const ACCOUNT_CATEGORIES = {
  asset:       { label: 'Хөрөнгө',              normal_balance: 'debit'  },
  contra_asset:{ label: 'Хөрөнгийн хасагдуулга', normal_balance: 'credit' },
  liability:   { label: 'Өр төлбөр',            normal_balance: 'credit' },
  net_assets:  { label: 'Цэвэр хөрөнгө',        normal_balance: 'credit' },
  income:      { label: 'Орлого',               normal_balance: 'credit' },
  expense:     { label: 'Зардал',               normal_balance: 'debit'  },
};


export const CHART_OF_ACCOUNTS = [
  // ============================================================
  // A. САНХҮҮГИЙН БАЙДЛЫН ДАНС — НЭГ. ХӨРӨНГӨ
  // ============================================================
  // --- Эргэлтийн хөрөнгө / Мөнгөн хөрөнгө (албан ёсны бүлэг 10) ---
  { code: '1010', name: 'Кассад байгаа бэлэн мөнгө',            category: 'asset', group: 'Мөнгөн хөрөнгө', official_code: '10' },
  { code: '1020', name: 'Харилцахад байгаа мөнгө',              category: 'asset', group: 'Мөнгөн хөрөнгө', official_code: '11',
    note: 'Банкны данс тус бүрээр туслах данс нээж болно (жишээ: 1020-01 Хаан банк, 1020-02 Голомт банк)' },

  // --- Богино хугацаат хөрөнгө оруулалт (13) ---
  { code: '1030', name: 'Богино хугацаат хөрөнгө оруулалт',     category: 'asset', group: 'Богино хугацаат хөрөнгө оруулалт', official_code: '13' },

  // --- Авлагын данс (12) ---
  { code: '1110', name: 'Сууц өмчлөгчдийн авлага',               category: 'asset', group: 'Авлагын данс', official_code: '12',
    note: 'Тухайн сарын хураамж хугацаандаа төлөгдөөгүй өмчлөгчийн авлага. residents/transactions-той шууд холбогдоно (Phase 2).' },
  { code: '1120', name: 'Аж ахуйн нэгжийн авлага',               category: 'asset', group: 'Авлагын данс', official_code: '12',
    note: 'Түрээслэгч аж ахуйн нэгжийн төлөгдөөгүй авлага. businesses-тэй холбогдоно (Phase 2).' },
  { code: '1130', name: 'Ажилтнаас авах авлага',                 category: 'asset', group: 'Авлагын данс', official_code: '12' },
  { code: '1140', name: 'Бусад авлага',                          category: 'asset', group: 'Авлагын данс', official_code: '12' },
  { code: '1190', name: 'Найдваргүй авлагын хасагдуулга',        category: 'contra_asset', group: 'Авлагын данс', official_code: '12',
    note: 'Contra-asset данс — үлдэгдэл нь бусад авлагын дансдын дүнг бууруулна (Кт талдаа өснө).' },

  // --- Бараа материал (14) ---
  { code: '1210', name: 'Бараа материал',                       category: 'asset', group: 'Бараа материал', official_code: '14' },
  { code: '1220', name: 'Түлш шатахуун',                         category: 'asset', group: 'Бараа материал', official_code: '14' },
  { code: '1230', name: 'Сэлбэг хэрэгсэл',                       category: 'asset', group: 'Бараа материал', official_code: '14' },

  // --- Урьдчилж төлсөн зардал/тооцоо (18) ---
  { code: '1400', name: 'Урьдчилж төлсөн зардал/тооцоо',        category: 'asset', group: 'Урьдчилж төлсөн зардал', official_code: '18' },

  // --- Эргэлтийн бус хөрөнгө / Үндсэн хөрөнгө (20) ---
  { code: '2010', name: 'Үндсэн хөрөнгө',                       category: 'asset', group: 'Үндсэн хөрөнгө', official_code: '20',
    note: 'fixed_assets хүснэгэлтэй шууд холбогдоно (Phase 2) — original_cost нийлбэр.' },
  { code: '2015', name: 'Үндсэн хөрөнгийн хуримтлагдсан элэгдэл', category: 'contra_asset', group: 'Үндсэн хөрөнгө', official_code: '20',
    note: 'Contra-asset — fixed_assets.accumulated_depreciation нийлбэртэй тохирно.' },

  // --- Биет бус хөрөнгө (21) ---
  { code: '2100', name: 'Биет бус хөрөнгө',                     category: 'asset', group: 'Биет бус хөрөнгө', official_code: '21' },

  // --- Хөрөнгө оруулалт (22) ---
  { code: '2200', name: 'Хөрөнгө оруулалт',                     category: 'asset', group: 'Хөрөнгө оруулалт', official_code: '22' },

  // ============================================================
  // A. САНХҮҮГИЙН БАЙДЛЫН ДАНС — ХОЁР. ӨР ТӨЛБӨР БА БАЙГУУЛЛАГЫН ӨМЧ
  // ============================================================
  // --- Богино хугацаат өр төлбөр (31/32/33) ---
  { code: '3010', name: 'Нийлүүлэгчид өгөх өглөг',              category: 'liability', group: 'Богино хугацаат өр төлбөр', official_code: '31' },
  { code: '3020', name: 'Татвар, хураамжийн өглөг',             category: 'liability', group: 'Богино хугацаат өр төлбөр', official_code: '31' },
  { code: '3030', name: 'Цалин, нийгмийн даатгалын өглөг',      category: 'liability', group: 'Богино хугацаат өр төлбөр', official_code: '31' },
  { code: '3040', name: 'Бусад өглөг',                          category: 'liability', group: 'Богино хугацаат өр төлбөр', official_code: '33' },
  { code: '3050', name: 'Урьдчилж орсон орлого',                category: 'liability', group: 'Богино хугацаат өр төлбөр', official_code: '32',
    note: 'Өмчлөгч/түрээслэгч хэдэн сарын хураамжийг урьдчилж төлсөн тохиолдолд ашиглана.' },

  // --- Урт хугацаат өр төлбөр (34) ---
  { code: '3900', name: 'Урт хугацаат өр',                      category: 'liability', group: 'Урт хугацаат өр төлбөр', official_code: '34' },

  // --- Цэвэр хөрөнгө (41/42/44) ---
  { code: '4100', name: 'Нөөц сан',                             category: 'net_assets', group: 'Цэвэр хөрөнгө', official_code: '41' },
  { code: '4200', name: 'Дахин үнэлгээний нэмэгдэл',            category: 'net_assets', group: 'Цэвэр хөрөнгө', official_code: '42' },
  { code: '4400', name: 'Хуримтлагдсан үр дүн',                 category: 'net_assets', group: 'Цэвэр хөрөнгө', official_code: '44',
    note: 'Жил бүрийн эцэст 9200 дансны үлдэгдэл энд шилждэг (Phase 2 — жилийн хаалтын гүйлгээ).' },

  // ============================================================
  // Б. ОРЛОГО, ЗАРДЛЫН ДАНС — НЭГ. ОРЛОГО
  // ============================================================
  { code: '5100', name: 'Гишүүдийн хураамж (Сууц өмчлөгчийн хураамж)', category: 'income', group: 'Орлого', official_code: '51',
    note: 'СӨХ-ийн гол орлого. transactions category=\'resident\' үүнд харгалзана (Phase 2).' },
  { code: '5200', name: 'Хөтөлбөр, төслийн орлого',             category: 'income', group: 'Орлого', official_code: '52' },
  { code: '5300', name: 'Бэлэг, хандив, тусламжийн орлого',     category: 'income', group: 'Орлого', official_code: '53' },
  { code: '5400', name: 'Түрээсийн орлого (Аж ахуйн нэгж)',     category: 'income', group: 'Орлого', official_code: '54',
    note: 'transactions category=\'business\' үүнд харгалзана (Phase 2).' },
  { code: '5500', name: 'Хөрөнгө оруулалтын орлого',            category: 'income', group: 'Орлого', official_code: '55' },
  { code: '5600', name: 'Бусад орлого',                         category: 'income', group: 'Орлого', official_code: '56' },

  // ============================================================
  // Б. ОРЛОГО, ЗАРДЛЫН ДАНС — ХОЁР. ЗАРДАЛ
  // ============================================================
  { code: '6100', name: 'Хандив, тусламжийн зардал',            category: 'expense', group: 'Зардал', official_code: '61' },
  { code: '6200', name: 'Хөтөлбөр хэрэгжүүлэх зардал',          category: 'expense', group: 'Зардал', official_code: '62' },
  { code: '6300', name: 'Төсөл хэрэгжүүлэх зардал',             category: 'expense', group: 'Зардал', official_code: '63' },

  // --- Ерөнхий удирдлагын зардал (70) — СӨХ-ийн ихэнх зардал энд ордог,
  //     тул дэд данс болгон задалж, одоогийн finance.js-ийн EXPENSE_CATS-той
  //     ирээдүйд шууд харьцуулж болохоор нэрлэв (Phase 2 mapping) ---
  { code: '7010', name: 'Цалин хөлс, шагнал урамшуулал',        category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },
  { code: '7011', name: 'Хоолны мөнгөний зардал',                category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70',
    note: 'НД ерөнхий хууль 4.1.17/19.1.3 — цалинтай адилтгах орлого' },
  { code: '7012', name: 'Унааны мөнгөний зардал',                category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70',
    note: 'НД ерөнхий хууль 4.1.17/19.1.3 — цалинтай адилтгах орлого' },
  { code: '7013', name: 'Утасны мөнгөний зардал',                category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70',
    note: 'Хуульд шууд дурдаагүй, "адилтгах орлого"-д өргөн тайлбарласан' },
  { code: '7020', name: 'Нийгмийн даатгалын зардал',            category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },
  { code: '7030', name: 'Засвар үйлчилгээний зардал',           category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },
  { code: '7040', name: 'Түлш, эрчим хүчний зардал',            category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },
  { code: '7050', name: 'Холбоо, ус, халаалтын зардал',         category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },
  { code: '7060', name: 'Үндсэн хөрөнгийн элэгдэл (зардал)',    category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70',
    note: 'Энэ зардлын эсрэг тал 2015 (Хуримтлагдсан элэгдэл) данс.' },
  { code: '7070', name: 'Томилолтын зардал',                    category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },
  { code: '7080', name: 'Сургалтын зардал',                     category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },
  { code: '7090', name: 'Бусад ерөнхий зардал',                 category: 'expense', group: 'Ерөнхий удирдлагын зардал', official_code: '70' },

  { code: '8700', name: 'Үндсэн бус үйл ажиллагааны ашиг (алдагдал)', category: 'income', group: 'Үндсэн бус үйл ажиллагаа', official_code: '87',
    note: 'Торгууль, ханшийн зөрүү, хөрөнгө худалдсаны ашиг/алдагдал зэрэг. Ашиг үед Кт, алдагдал үед Дт үлдэгдэлтэй байж болно.' },

  { code: '9200', name: 'Орлого, зарлагын нэгдсэн данс',        category: 'net_assets', group: 'Жилийн хаалтын данс', official_code: '92',
    note: 'Зөвхөн жилийн эцсийн хаалтын гүйлгээнд ашиглагдана (Phase 2) — бусад орлого/зардлын дансдыг энд хааж, дараа нь 4400 руу шилжүүлнэ.' },
];


export function getAccountByCode(code) {
  return CHART_OF_ACCOUNTS.find((a) => a.code === code) || null;
}

export function getNormalBalance(code) {
  const acc = getAccountByCode(code);
  if (!acc) return null;
  return ACCOUNT_CATEGORIES[acc.category].normal_balance;
}
