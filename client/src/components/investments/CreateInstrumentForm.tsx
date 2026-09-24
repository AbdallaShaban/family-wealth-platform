import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CreatableCombobox from "@/components/CreatableCombobox";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export type AssetType = "equity" | "fund" | "bond" | "gold" | "real_estate" | "cash_equivalent" | "other";

export const assetTypeLabel: Record<AssetType, string> = {
  equity: "أسهم",
  fund: "صناديق استثمار",
  bond: "سندات وصكوك",
  gold: "ذهب ومعادن ثمينة",
  real_estate: "أصول عقارية",
  cash_equivalent: "أشباه النقد والسيولة",
  other: "أخرى",
};

export const subCategoriesByAssetType: Record<AssetType, string[]> = {
  equity: [
    "أسهم مدرجة مباشرة",
    "أسهم شركات خاصة",
    "وثائق حقوق أولوية",
    "أخرى",
  ],
  fund: [
    "صندوق نقد يومي (سيولة)",
    "صندوق أسهم",
    "صندوق ذهب",
    "صندوق استثمار متوازن",
    "صندوق استثمار عقاري",
    "صندوق مؤشرات متداولة (ETF)",
    "أخرى",
  ],
  gold: [
    "سبائك معتمدة (عيار 24)",
    "جنيهات ذهب (عيار 21)",
    "ذهب عيني / كسر",
    "فضة ومعادن ثمينة",
    "أخرى",
  ],
  real_estate: [
    "عقار سكني",
    "عقار تجاري / إداري",
    "أراضي استثمارية",
    "أخرى",
  ],
  bond: [
    "سندات حكومية وأذون خزانة",
    "سندات توريق وشركات",
    "صكوك تمويلية",
    "أخرى",
  ],
  cash_equivalent: [
    "أذون خزانة قصيرة الأجل",
    "شهادات ادخار بنكية",
    "ودائع لأجل",
    "أخرى",
  ],
  other: [
    "عام / غير مصنف",
  ],
};

export const egxSectors: string[] = [
  "البنوك والخدمات المالية غير المصرفية",
  "العقارات والتطوير العقاري",
  "الرعاية الصحية والأدوية",
  "البناء ومواد التشييد",
  "الأغذية والمشروبات والتبغ",
  "الاتصالات والإعلام والتكنولوجيا",
  "الصناعة والسلع المعمرة والمنسوجات",
  "الموارد الأساسية والبتروكيماويات",
  "السياحة والفنادق والترفيه",
  "الخدمات والنقل والشحن",
  "الطاقة المتجددة والمرافق",
  "قطاع آخر / غير مصنف",
];

interface CreateInstrumentFormProps {
  canEdit: boolean;
  baseCurrency?: string;
  onSuccess?: () => void;
}

export const CreateInstrumentForm = React.memo(function CreateInstrumentForm({
  canEdit,
  baseCurrency = "EGP",
  onSuccess,
}: CreateInstrumentFormProps) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [assetType, setAssetType] = useState<AssetType>("equity");
  const [subCategory, setSubCategory] = useState("أسهم مدرجة مباشرة");
  const [sector, setSector] = useState("البنوك والخدمات المالية غير المصرفية");

  const showSector =
    assetType === "equity" ||
    (assetType === "fund" && (subCategory === "صندوق أسهم" || subCategory === "EQUITY_FUND"));

  const handleAssetTypeChange = (newType: AssetType) => {
    setAssetType(newType);
    const available = subCategoriesByAssetType[newType] || [];
    setSubCategory(available[0] ?? "أخرى");
  };

  const createInstrument = trpc.family.instruments.create.useMutation({
    onSuccess: () => {
      toast.success("تمت إضافة الأداة الاستثمارية بنجاح.");
      setName("");
      setSymbol("");
      setSubCategory("أسهم مدرجة مباشرة");
      setSector("البنوك والخدمات المالية غير المصرفية");
      void utils.family.instruments.list.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "فشل حفظ الأداة الاستثمارية.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      return toast.error("يرجى إدخال اسم الأداة الاستثمارية.");
    }
    createInstrument.mutate({
      name: name.trim(),
      symbol: symbol.trim() || null,
      currency: currency.trim() || "EGP",
      assetType,
      subCategory: subCategory || null,
      sector: showSector ? sector : null,
      isin: null,
    });
  };

  return (
    <Card className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 p-5">
        <CardTitle className="text-slate-900 dark:text-white font-bold text-base">
          إضافة أداة استثمارية جديدة
        </CardTitle>
        <CardDescription className="text-slate-500 dark:text-slate-400 text-xs mt-1">
          تسجيل الرمز والبيانات التصنيفية لتتبع الأداء والأسعار السوقية.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="inst-name" className="text-slate-800 dark:text-slate-200 font-bold text-xs">
                اسم الأداة أو الشركة *
              </Label>
              <Input
                id="inst-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: البنك التجاري الدولي"
                required
                disabled={!canEdit}
                className="w-full bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2 px-3 h-auto"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inst-symbol" className="text-slate-800 dark:text-slate-200 font-bold text-xs">
                الرمز السوقي (Ticker)
              </Label>
              <Input
                id="inst-symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="مثال: COMI"
                disabled={!canEdit}
                className="w-full bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl font-medium text-sm py-2 px-3 h-auto font-mono text-left"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label className="text-slate-800 dark:text-slate-200 font-bold text-xs">عملة التداول</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={!canEdit}>
                <SelectTrigger className="w-full bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl font-medium text-sm py-2.5 px-3 h-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800">
                  <SelectItem value="EGP">EGP — جنيه مصري</SelectItem>
                  <SelectItem value="USD">USD — دولار أمريكي</SelectItem>
                  <SelectItem value="EUR">EUR — يورو</SelectItem>
                  <SelectItem value="SAR">SAR — ريال سعودي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-800 dark:text-slate-200 font-bold text-xs">نوع الأصل الأساسي</Label>
              <Select value={assetType} onValueChange={(v) => handleAssetTypeChange(v as AssetType)} disabled={!canEdit}>
                <SelectTrigger className="w-full bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl font-medium text-sm py-2.5 px-3 h-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800">
                  {(Object.keys(assetTypeLabel) as AssetType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {assetTypeLabel[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-800 dark:text-slate-200 font-bold text-xs">التصنيف الفرعي</Label>
              <CreatableCombobox
                id="instrument-subcategory"
                value={subCategory}
                onChange={setSubCategory}
                options={subCategoriesByAssetType[assetType] || []}
                placeholder="اختر التصنيف الفرعي أو اكتب مخصصاً..."
                disabled={!canEdit}
              />
            </div>
          </div>

          {showSector && (
            <div className="grid gap-2">
              <Label className="text-slate-800 dark:text-slate-200 font-bold text-xs">القطاع الاقتصادي</Label>
              <CreatableCombobox
                id="instrument-sector"
                value={sector}
                onChange={setSector}
                options={egxSectors}
                placeholder="اختر القطاع أو اكتب قطاعاً جديداً..."
                disabled={!canEdit}
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={!canEdit || createInstrument.isPending}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 px-6 rounded-xl shadow-sm transition-all dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 border border-slate-900 dark:border-transparent disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {createInstrument.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
            {canEdit ? "حفظ الأداة" : "تتطلب صلاحية محرر أو مستشار"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
});
