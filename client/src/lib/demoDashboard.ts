export type DashboardPreviewMode = "live" | "demo" | "empty";

export function getDashboardPreviewMode(demoEnabled: boolean, hasRealData: boolean): DashboardPreviewMode {
  if (demoEnabled) return "demo";
  return hasRealData ? "live" : "empty";
}

export const demoDashboard = {
  baseCurrency: "EGP",
  netWorth: "3284500",
  liquidBalance: "634800",
  liabilities: "214000",
  investments: "1789600",
  unrealizedPnl: "146300",
  accounts: [
    { id: "cash", name: "حساب السيولة اليومية", value: 245000, currency: "EGP", kind: "مصرفي" },
    { id: "reserve", name: "احتياطي الطوارئ", value: 389800, currency: "EGP", kind: "ادخاري" },
    { id: "property", name: "الأصول الخاصة", value: 1260000, currency: "EGP", kind: "أصل خاص" },
  ],
  allocation: [
    { name: "استثمارات", value: 1789600, color: "#11a889" },
    { name: "أصول خاصة", value: 1260000, color: "#6a7df5" },
    { name: "سيولة", value: 634800, color: "#e7a84e" },
  ],
  cashFlow: [
    { month: "يناير", income: 128000, expense: 68500 },
    { month: "فبراير", income: 134000, expense: 74200 },
    { month: "مارس", income: 126500, expense: 69900 },
    { month: "أبريل", income: 141000, expense: 78800 },
    { month: "مايو", income: 138000, expense: 72100 },
    { month: "يونيو", income: 149500, expense: 83100 },
  ],
  events: [
    { id: "demo-1", type: "تحويل إلى احتياطي الطوارئ", amount: "25000", currency: "EGP", date: "اليوم، 10:30 ص", tone: "income" },
    { id: "demo-2", type: "قسط تأمين سنوي", amount: "18400", currency: "EGP", date: "أمس، 02:15 م", tone: "expense" },
    { id: "demo-3", type: "تحديث تقييم محفظة", amount: "68200", currency: "EGP", date: "21 أغسطس", tone: "growth" },
  ],
  debts: [
    { id: "demo-debt-1", name: "تمويل عقاري", outstanding: "180000", currency: "EGP", payment: "9200", rate: "12.5" },
    { id: "demo-debt-2", name: "بطاقة ائتمان", outstanding: "34000", currency: "EGP", payment: "6800", rate: "24.0" },
  ],
} as const;
