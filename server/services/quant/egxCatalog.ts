/**
 * Master Directory of Egyptian Equities (EGX30, EGX70, EGX100) & Egyptian Mutual Funds
 * Provides comprehensive metadata, official ticker codes, Arabic company names, sectors,
 * and intelligent fuzzy Arabic search normalization.
 */

export interface EGXMasterEntry {
  ticker: string; // e.g. "MPCO.CA"
  symbol: string; // e.g. "MPCO"
  nameAr: string; // e.g. "المنصورة للدواجن"
  nameEn: string; // e.g. "Mansoura Poultry"
  sector: string; // e.g. "الأغذية والمشروبات والزراعة"
  assetType: "EGX_STOCK" | "MUTUAL_FUND" | "GOLD";
  aliases: string[]; // Variations for search matching
  indexMembership?: ("EGX30" | "EGX70" | "EGX100" | "EGX33")[];
  typicalDividendYield?: number;
}

/**
 * Normalizes Arabic text for tolerant and accurate fuzzy matching:
 * - Unifies alef forms (أ, إ, آ -> ا)
 * - Unifies teh marbuta and heh (ة -> ه)
 * - Unifies alef maqsura and yaa (ى -> ي)
 * - Removes Arabic diacritics (tashkeel)
 * - Strips extra whitespace and symbols
 */
export function normalizeArabic(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "") // remove tashkeel
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[-_.\s]+/g, " ");
}

/**
 * Master Equities and Funds Catalog
 */
export const EGX_MASTER_CATALOG: EGXMasterEntry[] = [
  // --- Poultry, Food & Agriculture ---
  {
    ticker: "MPCO.CA",
    symbol: "MPCO",
    nameAr: "المنصورة للدواجن",
    nameEn: "Mansoura Poultry",
    sector: "الأغذية والمشروبات والزراعة",
    assetType: "EGX_STOCK",
    aliases: ["المنصوره للدواجن", "المنصورة", "دواجن المنصورة", "منصورة دواجن", "mpco"],
    indexMembership: ["EGX70", "EGX100"],
    typicalDividendYield: 3.2,
  },
  {
    ticker: "POUL.CA",
    symbol: "POUL",
    nameAr: "القاهرة للدواجن",
    nameEn: "Cairo Poultry",
    sector: "الأغذية والمشروبات والزراعة",
    assetType: "EGX_STOCK",
    aliases: ["القاهره للدواجن", "دواجن القاهرة", "poul"],
    indexMembership: ["EGX70", "EGX100"],
  },
  {
    ticker: "ISMA.CA",
    symbol: "ISMA",
    nameAr: "الإسماعيلية مصر للدواجن",
    nameEn: "Ismailia Misr Poultry",
    sector: "الأغذية والمشروبات والزراعة",
    assetType: "EGX_STOCK",
    aliases: ["اسماعيلية دواجن", "اسماعيليه مصر للدواجن", "isma"],
    indexMembership: ["EGX70", "EGX100"],
  },
  {
    ticker: "JUFO.CA",
    symbol: "JUFO",
    nameAr: "جهينة للصناعات الغذائية",
    nameEn: "Juhayna Food Industries",
    sector: "الأغذية والمشروبات",
    assetType: "EGX_STOCK",
    aliases: ["جهينه", "جهينة", "jufo", "juhayna"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 3.5,
  },
  {
    ticker: "DOMT.CA",
    symbol: "DOMT",
    nameAr: "الصناعات الغذائية العربية (دومتي)",
    nameEn: "Arabian Food Industries (Domty)",
    sector: "الأغذية والمشروبات",
    assetType: "EGX_STOCK",
    aliases: ["دومتي", "دومتى", "domt", "domty"],
    indexMembership: ["EGX70", "EGX100"],
    typicalDividendYield: 4.1,
  },
  {
    ticker: "EAST.CA",
    symbol: "EAST",
    nameAr: "الشرقية - إيسترن كومباني",
    nameEn: "Eastern Company",
    sector: "الأغذية والمشروبات والتبغ",
    assetType: "EGX_STOCK",
    aliases: ["الشرقية للدخان", "الشرقيه", "ايسترن كومباني", "ايسترن", "دخان", "east"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 9.5,
  },

  // --- Banking & Financial Services ---
  {
    ticker: "COMI.CA",
    symbol: "COMI",
    nameAr: "البنك التجاري الدولي - مصر (CIB)",
    nameEn: "Commercial International Bank (CIB)",
    sector: "الخدمات المالية والمصرفية",
    assetType: "EGX_STOCK",
    aliases: ["التجاري الدولي", "التجاري", "البنك التجاري", "cib", "comi"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 3.5,
  },
  {
    ticker: "ADIB.CA",
    symbol: "ADIB",
    nameAr: "مصرف أبوظبي الإسلامي - مصر",
    nameEn: "Abu Dhabi Islamic Bank - Egypt",
    sector: "الخدمات المالية والمصرفية",
    assetType: "EGX_STOCK",
    aliases: ["ابوظبي الاسلامي", "مصرف ابو ظبي", "adib"],
    indexMembership: ["EGX30", "EGX33", "EGX100"],
    typicalDividendYield: 5.2,
  },
  {
    ticker: "CIEB.CA",
    symbol: "CIEB",
    nameAr: "بنك كريدي أجريكول - مصر",
    nameEn: "Credit Agricole Egypt",
    sector: "الخدمات المالية والمصرفية",
    assetType: "EGX_STOCK",
    aliases: ["كريدي اجريكول", "كريدي", "اجريكول", "cieb"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 7.8,
  },
  {
    ticker: "QNBA.CA",
    symbol: "QNBA",
    nameAr: "بنك قطر الوطني الأهلي (QNB)",
    nameEn: "Qatar National Bank Alahli",
    sector: "الخدمات المالية والمصرفية",
    assetType: "EGX_STOCK",
    aliases: ["قطر الوطني", "qnb", "qnba"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 4.6,
  },
  {
    ticker: "FAIT.CA",
    symbol: "FAIT",
    nameAr: "بنك فيصل الإسلامي المصري",
    nameEn: "Faisal Islamic Bank of Egypt",
    sector: "الخدمات المالية والمصرفية",
    assetType: "EGX_STOCK",
    aliases: ["فيصل الاسلامي", "بنك فيصل", "fait"],
    indexMembership: ["EGX30", "EGX33", "EGX100"],
    typicalDividendYield: 6.0,
  },
  {
    ticker: "SAUD.CA",
    symbol: "SAUD",
    nameAr: "بنك البركة مصر",
    nameEn: "Al Baraka Bank Egypt",
    sector: "الخدمات المالية والمصرفية",
    assetType: "EGX_STOCK",
    aliases: ["البركة", "بنك البركه", "saud"],
    indexMembership: ["EGX70", "EGX33", "EGX100"],
    typicalDividendYield: 5.8,
  },
  {
    ticker: "CANA.CA",
    symbol: "CANA",
    nameAr: "بنك قناة السويس",
    nameEn: "Suez Canal Bank",
    sector: "الخدمات المالية والمصرفية",
    assetType: "EGX_STOCK",
    aliases: ["قناة السويس", "بنك قناه السويس", "cana"],
    indexMembership: ["EGX70", "EGX100"],
    typicalDividendYield: 4.5,
  },

  // --- Non-Banking Financial, Fintech & Investments ---
  {
    ticker: "FWRY.CA",
    symbol: "FWRY",
    nameAr: "فوري لتكنولوجيا البنوك والمدفوعات",
    nameEn: "Fawry for Banking Technology",
    sector: "التكنولوجيا والمدفوعات الإلكترونية",
    assetType: "EGX_STOCK",
    aliases: ["فوري", "فورى", "مدفوعات فوري", "fwry", "fawry"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 1.2,
  },
  {
    ticker: "EFIH.CA",
    symbol: "EFIH",
    nameAr: "إي فاينانس للاستثمارات المالية والرقمية",
    nameEn: "e-finance for Digital and Financial Investments",
    sector: "التكنولوجيا والمدفوعات الإلكترونية",
    assetType: "EGX_STOCK",
    aliases: ["اي فاينانس", "اي فايننس", "فاينانس", "efih", "e-finance"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 3.1,
  },
  {
    ticker: "HRHO.CA",
    symbol: "HRHO",
    nameAr: "إي إف جي القابضة (هيرميس)",
    nameEn: "EFG Holding",
    sector: "الخدمات المالية غير المصرفية",
    assetType: "EGX_STOCK",
    aliases: ["هيرميس", "المجموعة المالية هيرميس", "اي اف جي", "efg", "hrho", "hermes"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 3.8,
  },
  {
    ticker: "BTFH.CA",
    symbol: "BTFH",
    nameAr: "بلتون القابضة",
    nameEn: "Beltone Holding",
    sector: "الخدمات المالية غير المصرفية",
    assetType: "EGX_STOCK",
    aliases: ["بلتون", "بلتون المالية", "btfh", "beltone"],
    indexMembership: ["EGX30", "EGX100"],
  },
  {
    ticker: "CCAP.CA",
    symbol: "CCAP",
    nameAr: "شركة القلعة للاستشارات المالية",
    nameEn: "Qalaa Holdings",
    sector: "الخدمات المالية غير المصرفية",
    assetType: "EGX_STOCK",
    aliases: ["القلعة", "القلعه", "ccap", "qalaa"],
    indexMembership: ["EGX30", "EGX100"],
  },
  {
    ticker: "BINV.CA",
    symbol: "BINV",
    nameAr: "بي إنفستمنتس القابضة",
    nameEn: "B Investments Holding",
    sector: "الخدمات المالية غير المصرفية",
    assetType: "EGX_STOCK",
    aliases: ["بي انفستمنتس", "بي انفستمنت", "binv"],
    indexMembership: ["EGX70", "EGX100"],
  },
  {
    ticker: "ACTF.CA",
    symbol: "ACTF",
    nameAr: "أكت فاينانشال للاستشارات",
    nameEn: "Act Financial",
    sector: "الخدمات المالية غير المصرفية",
    assetType: "EGX_STOCK",
    aliases: ["اكت", "اكت فاينانشال", "actf"],
    indexMembership: ["EGX70", "EGX100"],
  },

  // --- Real Estate & Development ---
  {
    ticker: "TMGH.CA",
    symbol: "TMGH",
    nameAr: "مجموعة طلعت مصطفى القابضة",
    nameEn: "Talaat Moustafa Group Holding",
    sector: "العقارات والتطوير العمراني",
    assetType: "EGX_STOCK",
    aliases: ["طلعت مصطفى", "طلعت", "مجموعة طلعت", "مدينتي", "الرحاب", "tmgh"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 2.1,
  },
  {
    ticker: "MNHD.CA",
    symbol: "MNHD",
    nameAr: "مدينة مصر للإسكان والتعمير",
    nameEn: "Madinet Masr for Housing and Development",
    sector: "العقارات والتطوير العمراني",
    assetType: "EGX_STOCK",
    aliases: ["مدينة مصر", "مدينه مصر", "مدينة نصر", "mnhd", "masr"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 4.2,
  },
  {
    ticker: "PHDC.CA",
    symbol: "PHDC",
    nameAr: "بالم هيلز للتعمير",
    nameEn: "Palm Hills Developments",
    sector: "العقارات والتطوير العمراني",
    assetType: "EGX_STOCK",
    aliases: ["بالم هيلز", "بالم", "phdc", "palm hills"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 3.9,
  },
  {
    ticker: "HELI.CA",
    symbol: "HELI",
    nameAr: "مصر الجديدة للإسكان والتعمير",
    nameEn: "Heliopolis Housing and Development",
    sector: "العقارات والتطوير العمراني",
    assetType: "EGX_STOCK",
    aliases: ["مصر الجديدة", "مصر الجديده", "هليوبوليس", "heli"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 4.5,
  },
  {
    ticker: "OCDI.CA",
    symbol: "OCDI",
    nameAr: "السادس من أكتوبر للتنمية والاستثمار (سوديك)",
    nameEn: "Six of October Development & Investment (SODIC)",
    sector: "العقارات والتطوير العمراني",
    assetType: "EGX_STOCK",
    aliases: ["سوديك", "اكتوبر للتنمية", "ocdi", "sodic"],
    indexMembership: ["EGX30", "EGX100"],
  },
  {
    ticker: "ORHD.CA",
    symbol: "ORHD",
    nameAr: "أوراسكوم للتنمية مصر",
    nameEn: "Orascom Development Egypt",
    sector: "العقارات والسياحة",
    assetType: "EGX_STOCK",
    aliases: ["اوراسكوم للتنمية", "الجونة", "orhd"],
    indexMembership: ["EGX30", "EGX100"],
  },

  // --- Industrial, Materials, Steel, Chemicals & Petrochemicals ---
  {
    ticker: "SWDY.CA",
    symbol: "SWDY",
    nameAr: "السويدي إليكتريك",
    nameEn: "Elsewedy Electric",
    sector: "الصناعة والمقاولات والكابلات",
    assetType: "EGX_STOCK",
    aliases: ["السويدي", "السويدى", "السويدي اليكتريك", "كابلات السويدي", "swdy", "elsewedy"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 4.0,
  },
  {
    ticker: "ESRS.CA",
    symbol: "ESRS",
    nameAr: "حديد عز",
    nameEn: "Ezz Steel",
    sector: "المواد الأساسية والمعادن",
    assetType: "EGX_STOCK",
    aliases: ["حديد عز", "عز للصلب", "عز", "esrs", "ezz"],
    indexMembership: ["EGX30", "EGX100"],
  },
  {
    ticker: "EGAL.CA",
    symbol: "EGAL",
    nameAr: "مصر للألومنيوم",
    nameEn: "Egypt Aluminum",
    sector: "المواد الأساسية والمعادن",
    assetType: "EGX_STOCK",
    aliases: ["مصر للالومنيوم", "الومنيوم", "مصر للالمنيوم", "egal"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 8.5,
  },
  {
    ticker: "ABUK.CA",
    symbol: "ABUK",
    nameAr: "أبو قير للأسمدة والصناعات الكيماوية",
    nameEn: "Abu Qir Fertilizers",
    sector: "المواد الأساسية والبتروكيماويات",
    assetType: "EGX_STOCK",
    aliases: ["ابو قير", "ابوقير", "ابو قير للاسمدة", "abuk"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 8.0,
  },
  {
    ticker: "MFPC.CA",
    symbol: "MFPC",
    nameAr: "مصر لإنتاج الأسمدة (موبكو)",
    nameEn: "Misr Fertilizers Production Company (MOPCO)",
    sector: "المواد الأساسية والبتروكيماويات",
    assetType: "EGX_STOCK",
    aliases: ["موبكو", "مصر لانتاج الاسمدة", "اسمدة موبكو", "mfpc", "mopco"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 6.8,
  },
  {
    ticker: "SKPC.CA",
    symbol: "SKPC",
    nameAr: "سيدي كرير للبتروكيماويات (سيدبك)",
    nameEn: "Sidi Kerir Petrochemicals (SIDPEC)",
    sector: "المواد الأساسية والبتروكيماويات",
    assetType: "EGX_STOCK",
    aliases: ["سيدي كرير", "سيدبك", "سيدى كرير", "skpc", "sidpec"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 7.2,
  },
  {
    ticker: "AMOC.CA",
    symbol: "AMOC",
    nameAr: "الإسكندرية للزيوت المعدنية (أموك)",
    nameEn: "Alexandria Mineral Oils Company (AMOC)",
    sector: "الطاقة والزيوت المعدنية",
    assetType: "EGX_STOCK",
    aliases: ["اموك", "الاسكندرية للزيوت", "زيوت معدنية", "amoc"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 8.2,
  },
  {
    ticker: "ORAS.CA",
    symbol: "ORAS",
    nameAr: "أوراسكوم كونستراكشون بي إل سي",
    nameEn: "Orascom Construction PLC",
    sector: "المقاولات والإنشاءات",
    assetType: "EGX_STOCK",
    aliases: ["اوراسكوم كونستراكشون", "اوراسكوم للانشاء", "oras"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 5.0,
  },
  {
    ticker: "EKHO.CA",
    symbol: "EKHO",
    nameAr: "القابضة المصرية الكويتية",
    nameEn: "Egypt Kuwait Holding",
    sector: "الاستثمار والغاز والكيماويات",
    assetType: "EGX_STOCK",
    aliases: ["المصرية الكويتية", "الكويتية", "المصريه الكويتيه", "ekho"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 6.5,
  },

  // --- Telecommunications & Technology ---
  {
    ticker: "ETEL.CA",
    symbol: "ETEL",
    nameAr: "الشركة المصرية للاتصالات (وي WE)",
    nameEn: "Telecom Egypt (WE)",
    sector: "الاتصالات وتكنولوجيا المعلومات",
    assetType: "EGX_STOCK",
    aliases: ["المصرية للاتصالات", "المصريه للاتصالات", "وي", "we", "etel", "telecom egypt"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 4.8,
  },
  {
    ticker: "RAYA.CA",
    symbol: "RAYA",
    nameAr: "راية القابضة للاستثمارات المالية",
    nameEn: "Raya Holding for Financial Investments",
    sector: "التكنولوجيا والاتصالات",
    assetType: "EGX_STOCK",
    aliases: ["راية", "رايه", "raya"],
    indexMembership: ["EGX70", "EGX100"],
  },

  // --- Pharmaceuticals & Healthcare ---
  {
    ticker: "ISPH.CA",
    symbol: "ISPH",
    nameAr: "ابن سينا فارما",
    nameEn: "Ibnsina Pharma",
    sector: "الرعاية الصحية والأدوية",
    assetType: "EGX_STOCK",
    aliases: ["ابن سينا", "ابن سينا فارما", "ادوية ابن سينا", "isph", "ibnsina"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 4.0,
  },
  {
    ticker: "CLHO.CA",
    symbol: "CLHO",
    nameAr: "مجموعة مستشفيات كليوباترا",
    nameEn: "Cleopatra Hospital Company",
    sector: "الرعاية الصحية والمستشفيات",
    assetType: "EGX_STOCK",
    aliases: ["كليوباترا", "مستشفيات كليوباترا", "clho"],
    indexMembership: ["EGX70", "EGX100"],
  },

  // --- Textiles & Manufacturing ---
  {
    ticker: "ORWE.CA",
    symbol: "ORWE",
    nameAr: "النساجون الشرقيون للسجاد",
    nameEn: "Oriental Weavers Carpet",
    sector: "المنسوجات والسلع المعمرة",
    assetType: "EGX_STOCK",
    aliases: ["النساجون الشرقيون", "النساجون", "orwe", "oriental weavers"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 7.5,
  },
  {
    ticker: "DSCW.CA",
    symbol: "DSCW",
    nameAr: "دايس للملابس الجاهزة",
    nameEn: "Dice Sport & Casual Wear",
    sector: "المنسوجات والملابس",
    assetType: "EGX_STOCK",
    aliases: ["دايس", "دايس للملابس", "dscw", "dice"],
    indexMembership: ["EGX70", "EGX100"],
  },
  {
    ticker: "RUBX.CA",
    symbol: "RUBX",
    nameAr: "روبكس العالمية لتصنيع البلاستيك والاكريلك",
    nameEn: "Rubex International",
    sector: "الصناعات البلاستيكية",
    assetType: "EGX_STOCK",
    aliases: ["روبكس", "روبكس بلاستيك", "rubx"],
    indexMembership: ["EGX70", "EGX100"],
  },

  // --- Transport & Logistics ---
  {
    ticker: "ALCN.CA",
    symbol: "ALCN",
    nameAr: "الإسكندرية لتداول الحاويات والبضائع",
    nameEn: "Alexandria Container and Cargo Handling",
    sector: "خدمات النقل واللوجستيات",
    assetType: "EGX_STOCK",
    aliases: ["اسكندرية للحاويات", "حاويات اسكندرية", "alcn"],
    indexMembership: ["EGX30", "EGX100"],
    typicalDividendYield: 9.0,
  },
  {
    ticker: "ETRS.CA",
    symbol: "ETRS",
    nameAr: "المصرية لخدمات النقل (إيجيترانس)",
    nameEn: "Egyptian Transport and Commercial Services (Egytrans)",
    sector: "خدمات النقل واللوجستيات",
    assetType: "EGX_STOCK",
    aliases: ["ايجيترانس", "ايجي ترانس", "etrs", "egytrans"],
    indexMembership: ["EGX70", "EGX100"],
  },

  // --- Automotive ---
  {
    ticker: "GBCO.CA",
    symbol: "GBCO",
    nameAr: "جي بي كوربوريشن (غبور)",
    nameEn: "GB Corp",
    sector: "السيارات والسلع الاستهلاكية المعمرة",
    assetType: "EGX_STOCK",
    aliases: ["غبور", "جي بي", "غبور اوتو", "gbco", "auto"],
    indexMembership: ["EGX30", "EGX100"],
  },

  // --- Mutual Funds & Physical Gold Funds ---
  {
    ticker: "AZG",
    symbol: "AZG",
    nameAr: "صندوق أزيموت للذهب (AZ Gold)",
    nameEn: "Azimut Egypt Gold Fund",
    sector: "صناديق الذهب والمعادن النفيسة",
    assetType: "MUTUAL_FUND",
    aliases: ["ازيموت للذهب", "صندوق ازيموت", "ازيموت ذهب", "azg", "azimut gold"],
  },
  {
    ticker: "BWS",
    symbol: "BWS",
    nameAr: "صندوق بلتون وفرة لمؤشر الشريعة (EGX33)",
    nameEn: "Beltone Wafra Fund (EGX33)",
    sector: "صناديق المؤشرات الإسلامية",
    assetType: "MUTUAL_FUND",
    aliases: ["بلتون وفرة", "وفرة", "وفره", "bws"],
  },
  {
    ticker: "CMS",
    symbol: "CMS",
    nameAr: "صندوق مصر شريعة إكويتي (EGX33)",
    nameEn: "Misr Shariah Equity Fund",
    sector: "صناديق المؤشرات الإسلامية",
    assetType: "MUTUAL_FUND",
    aliases: ["مصر شريعة", "شريعة اكويتي", "cms"],
  },
  {
    ticker: "BRE",
    symbol: "BRE",
    nameAr: "صندوق بلتون للاستثمار العقاري",
    nameEn: "Beltone Real Estate Fund",
    sector: "صناديق الاستثمار العقاري",
    assetType: "MUTUAL_FUND",
    aliases: ["بلتون عقاري", "بلتون العقاري", "bre"],
  },
  {
    ticker: "BSEC",
    symbol: "BSEC",
    nameAr: "صندوق بلتون بي سيكيور للسيولة النقدية",
    nameEn: "Beltone B-Secure Money Market Fund",
    sector: "صناديق أسواق النقد والسيولة",
    assetType: "MUTUAL_FUND",
    aliases: ["بي سيكيور", "بلتون سيولة", "b-secure", "bsec", "bms"],
  },
  {
    ticker: "CI30",
    symbol: "CI30",
    nameAr: "صندوق سي آي 30 لمؤشر البورصة المصرية",
    nameEn: "CI 30 Index Fund",
    sector: "صناديق مؤشرات الأسهم",
    assetType: "MUTUAL_FUND",
    aliases: ["سي اي 30", "صندوق سي اي", "ci30"],
  },
  {
    ticker: "MISR_DAILY",
    symbol: "MISR_DAILY",
    nameAr: "صندوق بنك مصر النقدي اليومي (عائد تراكمي)",
    nameEn: "Banque Misr Daily Money Market Fund",
    sector: "صناديق أسواق النقد والسيولة",
    assetType: "MUTUAL_FUND",
    aliases: ["صندوق مصر النقدي", "يومي بنك مصر", "صندوق مصر يومي", "misr daily"],
  },
  {
    ticker: "NBE_4TH",
    symbol: "NBE_4TH",
    nameAr: "صندوق البنك الأهلي الرابع (أسهم ونمو)",
    nameEn: "NBE 4th Equity Fund",
    sector: "صناديق الأسهم المصرية",
    assetType: "MUTUAL_FUND",
    aliases: ["الاهلي الرابع", "صندوق الاهلي 4", "الاهلي اسهم", "nbe 4th"],
  },
  {
    ticker: "NBE06",
    symbol: "NBE06",
    nameAr: "صندوق بشائر - البنك الأهلي المصري (متوافق مع الشريعة)",
    nameEn: "NBE Bashayer Islamic Fund",
    sector: "صناديق الأسهم الإسلامية",
    assetType: "MUTUAL_FUND",
    aliases: ["صندوق بشاير", "صندوق بشائر", "بشائر", "بشاير", "البنك الاهلى المصرى صندوق بشاير", "الاهلي بشائر", "nbe06", "nbe 6"],
  },
  {
    ticker: "HELA_ISLAMIC",
    symbol: "HELA_ISLAMIC",
    nameAr: "صندوق سنابل الإسلامي (متوافق مع الشريعة)",
    nameEn: "Sanabel Islamic Equity Fund",
    sector: "صناديق الأسهم الإسلامية",
    assetType: "MUTUAL_FUND",
    aliases: ["سنابل", "صندوق سنابل", "سنابل الاسلامي", "sanabel"],
  },

  // --- Physical Spot Gold ---
  {
    ticker: "GOLD_24K",
    symbol: "GOLD_24K",
    nameAr: "ذهب عيار 24 (سعر الجرام الصافي)",
    nameEn: "Gold 24K Pure Ingot (Per Gram)",
    sector: "المعادن الثمينة والملاذ الآمن",
    assetType: "GOLD",
    aliases: ["ذهب 24", "عيار 24", "ذهب عيار 24", "ذهب", "الذهب", "gold", "gold 24k"],
  },
  {
    ticker: "GOLD_21K",
    symbol: "GOLD_21K",
    nameAr: "ذهب عيار 21 (سعر الجرام بالصاغة)",
    nameEn: "Gold 21K (Per Gram)",
    sector: "المعادن الثمينة والملاذ الآمن",
    assetType: "GOLD",
    aliases: ["ذهب 21", "عيار 21", "ذهب عيار 21", "gold 21k"],
  },
  {
    ticker: "SOVEREIGN",
    symbol: "SOVEREIGN",
    nameAr: "الجنيه الذهب (8 جرام عيار 21)",
    nameEn: "Gold Sovereign (8g 21K)",
    sector: "المعادن الثمينة والملاذ الآمن",
    assetType: "GOLD",
    aliases: ["جنيه ذهب", "الجنيه الذهب", "جنيه الذهب", "sovereign"],
  },
];

/**
 * Intelligent Asset Resolver:
 * Takes any user input (Arabic company name, English name, or ticker symbol)
 * and resolves it to its official EGX catalog entry.
 */
export function resolveEgxAsset(query: string): EGXMasterEntry | null {
  if (!query) return null;
  const raw = query.trim();
  const upper = raw.toUpperCase().replace(/\.CA$/, "");
  const normQuery = normalizeArabic(raw);

  // 1. Direct match on symbol or ticker
  const directSymbol = EGX_MASTER_CATALOG.find(
    (e) => e.symbol.toUpperCase() === upper || e.ticker.toUpperCase() === `${upper}.CA` || e.ticker.toUpperCase() === upper
  );
  if (directSymbol) return directSymbol;

  // 2. Exact normalized Arabic name match
  const exactName = EGX_MASTER_CATALOG.find(
    (e) => normalizeArabic(e.nameAr) === normQuery
  );
  if (exactName) return exactName;

  // 3. Exact alias match
  const aliasMatch = EGX_MASTER_CATALOG.find((e) =>
    e.aliases.some((alias) => normalizeArabic(alias) === normQuery || alias.toUpperCase() === upper)
  );
  if (aliasMatch) return aliasMatch;

  // 4. Word boundary / substring match in Arabic name or aliases
  const partialMatch = EGX_MASTER_CATALOG.find((e) => {
    const normName = normalizeArabic(e.nameAr);
    if (normName.includes(normQuery) || normQuery.includes(normName)) return true;
    return e.aliases.some((alias) => {
      const normAlias = normalizeArabic(alias);
      return normAlias.includes(normQuery) || normQuery.includes(normAlias);
    });
  });
  if (partialMatch) return partialMatch;

  return null;
}

/**
 * Search the EGX catalog for autocomplete / instant suggestions
 */
export function searchEgxCatalog(query: string, limit = 8): EGXMasterEntry[] {
  if (!query || query.trim().length === 0) {
    // Return top 8 prominent retail assets
    return EGX_MASTER_CATALOG.slice(0, limit);
  }

  const raw = query.trim();
  const upper = raw.toUpperCase();
  const normQuery = normalizeArabic(raw);

  const results: EGXMasterEntry[] = [];
  const seen = new Set<string>();

  for (const item of EGX_MASTER_CATALOG) {
    if (seen.has(item.ticker)) continue;

    const matchesSymbol = item.symbol.toUpperCase().includes(upper) || item.ticker.toUpperCase().includes(upper);
    const matchesNameAr = normalizeArabic(item.nameAr).includes(normQuery);
    const matchesNameEn = item.nameEn.toLowerCase().includes(raw.toLowerCase());
    const matchesAlias = item.aliases.some((a) => normalizeArabic(a).includes(normQuery) || a.toUpperCase().includes(upper));

    if (matchesSymbol || matchesNameAr || matchesNameEn || matchesAlias) {
      results.push(item);
      seen.add(item.ticker);
      if (results.length >= limit) break;
    }
  }

  return results;
}
