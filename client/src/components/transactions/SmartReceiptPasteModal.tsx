import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ClipboardPaste,
  CheckCircle2,
  AlertTriangle,
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  Smartphone,
  Wallet,
  Receipt,
  Upload,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Calendar,
  Hash,
  User,
  X,
} from "lucide-react";

interface SmartReceiptPasteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SmartReceiptPasteModal({
  open,
  onOpenChange,
  onSuccess,
}: SmartReceiptPasteModalProps) {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("none");
  const [direction, setDirection] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [occurredAtDate, setOccurredAtDate] = useState<string>("");
  const [showRawText, setShowRawText] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const accountsQuery = trpc.family.accounts.list.useQuery(undefined, { enabled: open });
  const categoriesQuery = trpc.family.cashFlow.categories.useQuery(undefined, { enabled: open });

  const parseMutation = trpc.receipt.parseReceiptImage.useMutation();
  const postReceiptMutation = trpc.receipt.postApprovedReceipt.useMutation();

  const liquidAccounts = (accountsQuery.data ?? []).filter(
    (a) => ["bank", "cash", "wallet"].includes(a.accountType) && a.status !== "archived"
  );

  const availableCategories = (categoriesQuery.data ?? []).filter(
    (c) => c.direction === (direction === "income" ? "income" : "expense") && !c.isArchived
  );

  // Set default account when accounts load
  useEffect(() => {
    if (liquidAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(String(liquidAccounts[0].id));
    }
  }, [liquidAccounts, selectedAccountId]);

  // Global paste listener when modal is open
  useEffect(() => {
    if (!open) return;

    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept paste if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleImageFile(file);
          }
          return;
        }
      }

      // If text was pasted
      const text = e.clipboardData?.getData("text");
      if (text && text.trim().length > 10) {
        handleRawTextSubmit(text.trim());
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [open]);

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("يرجى اختيار ملف صورة صالح (PNG, JPG, WebP)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setImageBase64(b64);
      triggerAnalysis({ imageBase64: b64 });
    };
    reader.onerror = () => {
      toast.error("حدث خطأ أثناء قراءة ملف الصورة.");
    };
    reader.readAsDataURL(file);
  };

  const handleRawTextSubmit = (text: string) => {
    setRawText(text);
    triggerAnalysis({ rawTextFallback: text });
  };

  const triggerAnalysis = (payload: { imageBase64?: string; rawTextFallback?: string }) => {
    parseMutation.mutate(payload, {
      onSuccess: (data) => {
        if (data.parsed) {
          if (data.parsed.amount > 0) {
            setAmount(data.parsed.amount.toFixed(2));
          }
          setDirection(data.parsed.direction);
          setReference(data.parsed.reference || "");
          setMemo(data.parsed.suggestedMemo || "");

          if (data.parsed.occurredAt) {
            const dateObj = new Date(data.parsed.occurredAt);
            setOccurredAtDate(dateObj.toISOString().slice(0, 16));
          }

          // Smart account matching based on provider and counterparty
          if (liquidAccounts.length > 0) {
            const prov = data.parsed.provider.toLowerCase();
            const matched = liquidAccounts.find(
              (a) =>
                a.institution?.toLowerCase().includes(prov) ||
                a.name.toLowerCase().includes(prov) ||
                (prov === "vodafone cash" && (a.institution?.includes("فودافون") || a.name.includes("كاش"))) ||
                (prov === "nbe" && (a.institution?.includes("الأهلي") || a.name.includes("الأهلي"))) ||
                (prov === "cib" && (a.institution?.includes("CIB") || a.name.includes("CIB")))
            );
            if (matched) {
              setSelectedAccountId(String(matched.id));
            }
          }

          if (data.duplicate?.isDuplicate) {
            toast.warning(`الرقم المرجعي مسجل مسبقاً برقم قيد #${data.duplicate.existingEvent?.id}`, {
              duration: 6000,
            });
          } else if (data.parsed.amount > 0) {
            toast.success(`تم استخراج بيانات الإيصال بنجاح (${data.parsed.provider})`);
          }
        }
      },
      onError: (err) => {
        toast.error("تعذر تحليل الإيصال: " + err.message);
      },
    });
  };

  const handleReset = () => {
    setImageBase64(null);
    setRawText("");
    setAmount("");
    setReference("");
    setMemo("");
    setOccurredAtDate("");
    parseMutation.reset();
  };

  const handlePostToLedger = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("يرجى إدخال مبلغ صالح بالجنيه المصري.");
      return;
    }
    if (!selectedAccountId) {
      toast.error("يرجى اختيار الحساب المصرفي أو المحفظة.");
      return;
    }

    const timestamp = occurredAtDate ? new Date(occurredAtDate).getTime() : Date.now();
    const idempotencyKey = reference ? `receipt-${reference}` : `receipt-${crypto.randomUUID()}`;

    postReceiptMutation.mutate(
      {
        accountId: Number(selectedAccountId),
        direction,
        amount: parsedAmount.toFixed(2),
        currency: "EGP",
        occurredAt: timestamp,
        categoryId: selectedCategoryId !== "none" ? Number(selectedCategoryId) : null,
        memo: memo.trim() || `إيصال مسحوب ضوئياً`,
        reference: reference.trim() || null,
        idempotencyKey,
      },
      {
        onSuccess: (data) => {
          toast.success("تم اعتماد الإيصال وترحيله إلى الدفتر المحاسبي بنجاح!");
          utils.family.accounts.list.invalidate();
          utils.family.ledger.invalidate();
          utils.family.cashFlow.invalidate();
          onOpenChange(false);
          handleReset();
          onSuccess?.();
        },
        onError: (err) => {
          toast.error("فشل ترحيل الإيصال: " + err.message);
        },
      }
    );
  };

  const parsedData = parseMutation.data?.parsed;
  const duplicateInfo = parseMutation.data?.duplicate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0 border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Receipt className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>مطابقة إيصالات إنستاباي والمحافظ الفورية (OCR)</span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-1.5 py-0.5">
                    الذكاء المالي
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  التقاط وتحليل فوري للقطات شاشة إنستاباي، فودافون كاش، الأهلي، CIB، وتيلدا بدون حفظ على السيرفر.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-5">
          {/* Supported Providers Header Strip */}
          <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-800 dark:text-slate-200 ml-1">القوالب المدعومة:</span>
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 font-medium text-[11px] shadow-2xs border border-slate-200/60 dark:border-slate-700/60">إنستاباي (IPN)</span>
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 font-medium text-[11px] shadow-2xs border border-slate-200/60 dark:border-slate-700/60">فودافون كاش ومحافظ الاتصالات</span>
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 font-medium text-[11px] shadow-2xs border border-slate-200/60 dark:border-slate-700/60">البنك الأهلي (NBE)</span>
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 font-medium text-[11px] shadow-2xs border border-slate-200/60 dark:border-slate-700/60">البنك التجاري الدولي (CIB)</span>
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 font-medium text-[11px] shadow-2xs border border-slate-200/60 dark:border-slate-700/60">تيلدا (Telda)</span>
          </div>

          {/* Interactive Paste & Drop Area */}
          {!imageBase64 && !parsedData?.success && (
            <div
              ref={dropZoneRef}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleImageFile(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
                isDragging
                  ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 scale-[1.01]"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-900/20"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleImageFile(e.target.files[0]);
                  }
                }}
              />
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                  <ClipboardPaste className="size-7" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                    الصق لقطة الشاشة بـ <kbd className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-xs">Ctrl + V</kbd> أو اسحبها هنا
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    يمكنك تصوير شاشة التحويل من هاتفك ولصقها مباشرة، وسيقوم المحرك باستخراج المبلغ والرقم المرجعي فوراً.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="size-3.5" />
                    <span>اختيار ملف من الجهاز</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRawText(!showRawText);
                    }}
                  >
                    {showRawText ? "إخفاء النص المباشر" : "لصق نص الإيصال يدوياً"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Raw Text Fallback Input */}
          {showRawText && !imageBase64 && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                نص الرسالة أو الإيصال المنسوخ:
              </Label>
              <Textarea
                rows={3}
                placeholder="الصق نص التحويل البنكي أو رسالة إنستاباي هنا..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="text-xs font-mono resize-none bg-white dark:bg-slate-900"
              />
              <Button
                type="button"
                size="sm"
                className="w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!rawText.trim() || parseMutation.isPending}
                onClick={() => handleRawTextSubmit(rawText.trim())}
              >
                {parseMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin ml-1.5" />
                    <span>جاري التحليل...</span>
                  </>
                ) : (
                  <span>تحليل النص واستخراج الحقول</span>
                )}
              </Button>
            </div>
          )}

          {/* Analysis Loading State */}
          {parseMutation.isPending && (
            <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center space-y-3">
              <Loader2 className="size-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  جاري قراءة الإيصال واستخراج الحقول ضوئياً...
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  معالجة الصورة تتم بالكامل في الذاكرة لضمان الخصوصية وسرعة المطابقة.
                </p>
              </div>
            </div>
          )}

          {/* Duplicate Reference Alert Banner */}
          {duplicateInfo?.isDuplicate && (
            <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="size-4.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>تنبيه ازدواجية الرقم المرجعي (Duplicate Reference)</span>
              </div>
              <p className="text-xs leading-relaxed">
                الرقم المرجعي <strong>({reference})</strong> مقيد مسبقاً في الدفاتر المحاسبية برقم قيد <strong>#{duplicateInfo.existingEvent?.id}</strong> بمبلغ <strong>{duplicateInfo.existingEvent?.grossAmount} EGP</strong>.
                يرجى التأكد من أن هذه ليست عملية مكررة لمنع القيد المزدوج في دفتر الأستاذ.
              </p>
            </div>
          )}

          {/* Parsed Fields & Edit Review Card */}
          {(parsedData || imageBase64) && !parseMutation.isPending && (
            <div className="space-y-4">
              {/* Image Preview & Quick Reset Bar */}
              {imageBase64 && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                  <div className="flex items-center gap-3">
                    <img
                      src={imageBase64}
                      alt="Receipt preview"
                      className="size-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-2xs"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        لقطة شاشة الإيصال جاهزة
                      </span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        تمت القراءة بنجاح ({parsedData?.provider || "إيصال"})
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="text-xs gap-1 h-8 rounded-lg"
                  >
                    <X className="size-3.5" />
                    <span>صورة أخرى</span>
                  </Button>
                </div>
              )}

              {/* Extraction Metrics Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-semibold block">المبلغ المستخرج</span>
                  <strong className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                    {amount ? `${Number(amount).toLocaleString()} EGP` : "---"}
                  </strong>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-semibold block">المصدر / البنك</span>
                  <strong className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 block truncate">
                    {parsedData?.provider || "غير محدد"}
                  </strong>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-semibold block">الرقم المرجعي (RRN)</span>
                  <strong className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 mt-1 block truncate">
                    {reference || "---"}
                  </strong>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-semibold block">الطرف الآخر / المحفظة</span>
                  <strong className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 block truncate">
                    {parsedData?.counterparty || parsedData?.accountOrWallet || "---"}
                  </strong>
                </div>
              </div>

              {/* Editable Fields Form */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20 space-y-4">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-500" />
                  <span>مراجعة وتعديل بيانات القيد المحاسبي قبل الترحيل</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">حساب التسوية المصرفي أو المحفظة</Label>
                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                      <SelectTrigger className="text-xs h-9 bg-white dark:bg-slate-900">
                        <SelectValue placeholder="اختر الحساب..." />
                      </SelectTrigger>
                      <SelectContent dir="rtl" className="bg-white dark:bg-slate-900">
                        {liquidAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={String(acc.id)} className="text-xs">
                            {acc.name} ({acc.currency}) · {acc.institution || "حساب نقدي"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">نوع العملية المالية</Label>
                    <Select value={direction} onValueChange={(val: any) => setDirection(val)}>
                      <SelectTrigger className="text-xs h-9 bg-white dark:bg-slate-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="rtl" className="bg-white dark:bg-slate-900">
                        <SelectItem value="expense" className="text-xs">
                          مصروف / تحويل صادر (Expense)
                        </SelectItem>
                        <SelectItem value="income" className="text-xs">
                          إيراد / تحويل وارد (Income)
                        </SelectItem>
                        <SelectItem value="transfer" className="text-xs">
                          تحويل داخلي بين الحسابات (Transfer)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">المبلغ (EGP)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="text-xs font-mono h-9 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">تصنيف التدفق النقدي (اختياري)</Label>
                    <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                      <SelectTrigger className="text-xs h-9 bg-white dark:bg-slate-900">
                        <SelectValue placeholder="بدون تصنيف فوري" />
                      </SelectTrigger>
                      <SelectContent dir="rtl" className="bg-white dark:bg-slate-900">
                        <SelectItem value="none" className="text-xs">
                          بدون تصنيف فوري
                        </SelectItem>
                        {availableCategories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">الرقم المرجعي (Reference / RRN)</Label>
                    <Input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="e.g. 405812345678"
                      className="text-xs font-mono h-9 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">تاريخ ووقت المعاملة</Label>
                    <Input
                      type="datetime-local"
                      value={occurredAtDate}
                      onChange={(e) => setOccurredAtDate(e.target.value)}
                      className="text-xs h-9 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">البيان المحاسبي والملاحظات (Memo)</Label>
                  <Input
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="بيان العملية المسجل في دفتر الأستاذ..."
                    className="text-xs h-9 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 flex-row items-center justify-between sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs rounded-xl"
          >
            إلغاء
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={!amount || Number(amount) <= 0 || postReceiptMutation.isPending}
            onClick={handlePostToLedger}
            className="gap-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            {postReceiptMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>جاري الترحيل للدفتر...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                <span>اعتماد وترحيل إلى الدفتر المحاسبي</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
