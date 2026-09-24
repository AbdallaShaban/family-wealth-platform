import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CreatableCombobox from "@/components/CreatableCombobox";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  AssetType,
  assetTypeLabel,
  subCategoriesByAssetType,
  egxSectors,
} from "./CreateInstrumentForm";

interface InstrumentActionModalsProps {
  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  instrument: any | null;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : "تعذر إكمال العملية الآن.");

export const InstrumentActionModals = React.memo(function InstrumentActionModals({
  editOpen,
  onEditOpenChange,
  deleteOpen,
  onDeleteOpenChange,
  instrument,
}: InstrumentActionModalsProps) {
  const utils = trpc.useUtils();

  const [editName, setEditName] = useState("");
  const [editSymbol, setEditSymbol] = useState("");
  const [editAssetType, setEditAssetType] = useState<AssetType>("equity");
  const [editSubCategory, setEditSubCategory] = useState("أسهم مدرجة مباشرة");
  const [editSector, setEditSector] = useState("البنوك والخدمات المالية غير المصرفية");

  useEffect(() => {
    if (instrument) {
      setEditName(instrument.name || "");
      setEditSymbol(instrument.symbol || "");
      const aType = (instrument.assetType || "equity") as AssetType;
      setEditAssetType(aType);
      setEditSubCategory(instrument.subCategory || (subCategoriesByAssetType[aType] || [])[0] || "أخرى");
      setEditSector(instrument.sector || egxSectors[0]);
    }
  }, [instrument]);

  const updateInstrumentMutation = trpc.family.instruments.update.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل الأداة الاستثمارية بنجاح.");
      onEditOpenChange(false);
      void utils.family.instruments.list.invalidate();
      void utils.family.portfolio.list.invalidate();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const deleteInstrumentMutation = trpc.family.instruments.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الأداة الاستثمارية بنجاح.");
      onDeleteOpenChange(false);
      void utils.family.instruments.list.invalidate();
      void utils.family.portfolio.list.invalidate();
    },
    onError: (error) => {
      onDeleteOpenChange(false);
      toast.error(error.message || "فشل حذف الأداة الاستثمارية.");
    },
  });

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instrument) return;
    updateInstrumentMutation.mutate({
      id: instrument.id,
      name: editName,
      symbol: editSymbol.trim() ? editSymbol.trim() : null,
      assetType: editAssetType,
      subCategory: editSubCategory.trim() ? editSubCategory.trim() : null,
      sector: editSector.trim() ? editSector.trim() : null,
    });
  };

  const handleConfirmDelete = () => {
    if (!instrument) return;
    deleteInstrumentMutation.mutate({ id: instrument.id });
  };

  return (
    <>
      <Dialog open={editOpen} onOpenChange={onEditOpenChange}>
        <DialogContent className="max-w-md w-full bg-white text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100 border border-slate-200/90 dark:border-slate-800 shadow-2xl rounded-2xl p-6" dir="rtl">
          <DialogHeader className="space-y-1 text-right">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/50">
                <Landmark className="size-4" />
              </div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">تعديل بيانات الأداة الاستثمارية</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mr-10">
              تحديث الاسم، الرمز، والتصنيفات للأداة المالية
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="grid gap-3.5 mt-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">اسم الأداة</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                placeholder="مثال: البنك التجاري الدولي"
                className="rounded-xl text-sm border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1420] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">رمز التداول (Ticker)</Label>
              <Input
                value={editSymbol}
                onChange={(e) => setEditSymbol(e.target.value.toUpperCase())}
                placeholder="مثال: COMI"
                className="rounded-xl text-sm font-mono border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1420] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">الفئة الأساسية</Label>
              <Select
                value={editAssetType}
                onValueChange={(val) => {
                  const nextType = val as AssetType;
                  setEditAssetType(nextType);
                  const avail = subCategoriesByAssetType[nextType] || [];
                  setEditSubCategory(avail[0] ?? "أخرى");
                }}
              >
                <SelectTrigger className="rounded-xl text-sm border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1420] text-slate-900 dark:text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#0B0F17] border-slate-200 dark:border-slate-800">
                  {Object.entries(assetTypeLabel).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-instrument-subcategory" className="text-xs font-semibold">التصنيف الفرعي</Label>
              <CreatableCombobox
                id="edit-instrument-subcategory"
                value={editSubCategory}
                onChange={setEditSubCategory}
                options={subCategoriesByAssetType[editAssetType] || []}
                placeholder="اختر التصنيف الفرعي أو اكتب مخصصاً..."
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-instrument-sector" className="text-xs font-semibold">القطاع</Label>
              <CreatableCombobox
                id="edit-instrument-sector"
                value={editSector}
                onChange={setEditSector}
                options={egxSectors}
                placeholder="اختر القطاع أو اكتب مخصصاً..."
              />
            </div>
            <DialogFooter className="mt-3 gap-2 flex-row-reverse">
              <Button
                type="button"
                variant="outline"
                onClick={() => onEditOpenChange(false)}
                className="rounded-xl text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={updateInstrumentMutation.isPending}
                className="rounded-xl text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                {updateInstrumentMutation.isPending && <Loader2 className="ml-2 size-3.5 animate-spin" />}
                حفظ التعديلات
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={onDeleteOpenChange}
        title="حذف الأداة الاستثمارية"
        description={`هل أنت متأكد من حذف الأداة "${instrument?.name}" (${instrument?.symbol || "بدون رمز"})؟ سيتم التحقق من عدم وجود عمليات محاسبية أو حيازات مفتوحة مرتبطة بها.`}
        confirmText={deleteInstrumentMutation.isPending ? "جارٍ الحذف..." : "تأكيد الحذف"}
        cancelText="إلغاء"
        variant="destructive"
        isLoading={deleteInstrumentMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
});
