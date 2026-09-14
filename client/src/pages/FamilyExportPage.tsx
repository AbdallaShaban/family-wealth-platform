import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Archive,
  CheckCircle2,
  Copy,
  Download,
  FileCheck2,
  FileJson,
  FileSpreadsheet,
  HardDriveDownload,
  HardDriveUpload,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "تعذر إتمام العملية الآن.";

/** LTR-isolated date — prevents BiDi scrambling in RTL containers */
function LtrDate({ value }: { value: string | number | null | undefined }) {
  if (!value) return <span className="text-slate-400 dark:text-slate-600">—</span>;
  const iso = new Date(value).toISOString();
  return <span dir="ltr" className="font-mono tabular-nums text-xs">{iso.slice(0, 10)}</span>;
}

export default function FamilyExportPage() {
  const [selectedBackupJson, setSelectedBackupJson] = useState<any | null>(null);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [restoreMode, setRestoreMode] = useState<"clone" | "overwrite">("clone");
  const [clonedWorkspaceName, setClonedWorkspaceName] = useState("");
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportFamily = trpc.family.exports.family.useMutation({
    onSuccess: result => {
      const blob = new Blob([result.content], { type: result.contentType });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      toast.success("تم إنشاء التصدير التحليلي وتنزيله بنجاح.");
    },
    onError: error => toast.error(errorText(error)),
  });

  const fullExport = trpc.family.backup.fullExport.useMutation({
    onSuccess: result => {
      const jsonStr = JSON.stringify(result, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `family-full-backup-${result.workspaceMetadata.name.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      toast.success(`تم إنشاء النسخة الاحتياطية الشاملة (${result.manifest.totalRows} سجلاً عبر ${result.workspaceMetadata.tableCount} جدولاً).`);
    },
    onError: error => toast.error(errorText(error)),
  });

  const validateBackup = trpc.family.backup.validateBackup.useMutation({
    onSuccess: result => {
      setValidationResult(result);
      if (result.valid) {
        toast.success(`تم التحقق من سلامة النسخة الاحتياطية (${result.totalRows} سجلاً). البصمة الرقمية مطابقة.`);
      } else {
        toast.error(`فشل فحص سلامة النسخة: ${result.errors.join("; ")}`);
      }
    },
    onError: error => toast.error(errorText(error)),
  });

  const restoreBackup = trpc.family.backup.restore.useMutation({
    onSuccess: result => {
      setConfirmRestoreOpen(false);
      setSelectedBackupJson(null);
      setValidationResult(null);
      toast.success(
        result.workspaceId
          ? `تمت استعادة البيانات بنجاح في المساحة "${result.workspaceName}" (${result.totalRestoredRows} سجلاً مستعاداً).`
          : "تمت الاستعادة بنجاح."
      );
    },
    onError: error => toast.error(errorText(error)),
  });

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setSelectedBackupJson(parsed);
        if (parsed.workspaceMetadata?.name) {
          setClonedWorkspaceName(`${parsed.workspaceMetadata.name} (نسخة مستعادة)`);
        }
        validateBackup.mutate({ envelope: parsed });
      } catch {
        toast.error("الملف المحدد ليس ملف JSON صالحًا.");
        setSelectedBackupJson(null);
        setValidationResult(null);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => handleFile(e.target.files?.[0]);

  const executeRestore = () => {
    if (!selectedBackupJson || !validationResult?.valid) return;
    restoreBackup.mutate({
      backup: selectedBackupJson,
      mode: restoreMode,
      newWorkspaceName: restoreMode === "clone" ? clonedWorkspaceName : undefined,
    });
  };

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-5xl space-y-6" dir="rtl">
        <PageHeader
          title="مركز الاستعادة والنسخ الاحتياطي المؤسسي"
          description="إدارة شاملة لاستمرارية العمليات المالية والتعافي من الكوارث (Disaster Recovery) تشمل حزم التداول لكافة الجداول مع بصمة SHA-256."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "الحوكمة والإدارة", href: "/export" },
            { label: "النسخ الاحتياطي والتعافي" },
          ]}
          badge={
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 font-medium text-xs shadow-2xs">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>تغطية متكاملة (SHA-256 Verified Manifest)</span>
            </div>
          }
        />

        {/* ── Section 1: Full System Disaster Recovery Snapshot ── */}
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Archive className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <p className="text-slate-900 dark:text-white font-bold text-sm">النسخ الاحتياطي الشامل للنظام (Disaster Recovery)</p>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mb-5 leading-5">
            تصدير علائقي كامل لجميع بيانات مساحة العمل مع بيان سلامة رقمي مشفر (SHA-256 Manifest).
          </p>

          {/* Compliance banner */}
          <div className="bg-slate-50 dark:bg-[#0E1420] border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4 mb-5 flex items-start gap-3">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-800 dark:text-slate-200 font-bold text-xs mb-0.5">ضمان استمرارية الأعمال والامتثال:</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-5">
                يحتوي ملف الـ Backup على البنية العلائقية الكاملة لمساحتك، ويصلح للاستعادة الفورية في أي وقت أو للاستنساخ في بيئة معزولة دون أي فقدان للأرصدة التاريخية أو مسارات FIFO.
              </p>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 shrink-0 self-center">
              موصى به للأرشفة الدورية
            </span>
          </div>

          {/* Full export button */}
          <button
            type="button"
            disabled={fullExport.isPending}
            onClick={() => fullExport.mutate()}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-3 px-5 rounded-xl shadow-xs transition-all border border-slate-900 dark:border-transparent flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {fullExport.isPending ? <Loader2 className="size-4 animate-spin" /> : <HardDriveDownload className="size-4" />}
            تصدير النسخة الشاملة الآن (JSON + SHA-256)
          </button>
        </div>

        {/* ── Section 2: Restore & Clone Engine ── */}
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs mb-6">
          <div className="flex items-center gap-2 mb-1">
            <HardDriveUpload className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-slate-900 dark:text-white font-bold text-sm">استعادة مساحة العمل من نسخة احتياطية (Restore &amp; Clone Engine)</p>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mb-5 leading-5">
            استعادة ذرية متكاملة مع إعادة تخريط المفاتيح الأجنبية وتفادي أي تكرار أو أخطاء علائقية.
          </p>

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />

          {!selectedBackupJson ? (
            /* Dropzone */
            <div
              role="button"
              tabIndex={0}
              aria-label="اضغط أو اسحب لاختيار ملف النسخة الاحتياطية"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
              onDragEnter={e => { e.preventDefault(); setIsDragging(true); }}
              onDragOver={e => e.preventDefault()}
              onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
              onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                isDragging
                  ? "border-indigo-400 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20"
                  : "border-slate-200 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-500 bg-slate-50/50 dark:bg-[#0E1420]/40"
              }`}
            >
              <div className="size-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                <Upload className="size-5" />
              </div>
              <p className="text-slate-800 dark:text-slate-200 font-bold text-sm mb-1">اضغط لاختيار ملف النسخة الاحتياطية الشاملة</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs">يجب أن يحمل الملف تنسيق <span dir="ltr" className="font-mono">family-full-backup-v1</span> مع بيان SHA-256 سليم</p>
            </div>
          ) : (
            /* File loaded state */
            <div className="space-y-4 rounded-xl border border-slate-200/80 dark:border-slate-800 p-5 bg-slate-50/40 dark:bg-[#0E1420]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
                    <FileCheck2 className="size-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{selectedBackupJson.workspaceMetadata?.name}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>العملة الأساس: <span className="font-mono font-bold">{selectedBackupJson.workspaceMetadata?.baseCurrency}</span></span>
                      <span>·</span>
                      <span>تاريخ التصدير: <LtrDate value={selectedBackupJson.workspaceMetadata?.exportedAt} /></span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedBackupJson(null); setValidationResult(null); }}
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  تغيير الملف
                </button>
              </div>

              {/* Validation state */}
              {validateBackup.isPending ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="size-4 animate-spin" />
                  جارٍ فحص البصمة الرقمية وسلامة الجداول...
                </div>
              ) : validationResult?.valid ? (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 p-3 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span className="font-medium">فحص السلامة اجتاز بنجاح: البصمة الرقمية مطابقة لـ {validationResult.totalRows} سجلاً.</span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg font-mono font-bold text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">SHA-256 ✓</span>
                </div>
              ) : validationResult ? (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <ShieldAlert className="size-4 shrink-0" />
                  <span>{validationResult?.errors?.join("; ") || "الملف المحدد غير صالح."}</span>
                </div>
              ) : null}

              {/* Restore mode selection */}
              {validationResult?.valid && (
                <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-4">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">اختر وضع الاستعادة:</p>
                  <RadioGroup
                    value={restoreMode}
                    onValueChange={(val: "clone" | "overwrite") => setRestoreMode(val)}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    {/* Clone */}
                    <div className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${restoreMode === "clone" ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/20" : "border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#0E1420]"}`}>
                      <RadioGroupItem value="clone" id="mode-clone" className="mt-0.5" />
                      <label htmlFor="mode-clone" className="cursor-pointer space-y-1 flex-1">
                        <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                          <Copy className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                          استنساخ كمساحة جديدة (Clone)
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] block leading-5">
                          إنشاء مساحة عمل مستقلة واستيراد الجداول فيها دون أي مساس بالمساحة الحالية.
                        </span>
                      </label>
                    </div>

                    {/* Overwrite */}
                    <div className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${restoreMode === "overwrite" ? "border-rose-300 dark:border-rose-700 bg-rose-50/40 dark:bg-rose-950/20" : "border-rose-200/60 dark:border-rose-900/60 hover:bg-rose-50/30 dark:hover:bg-rose-950/10"}`}>
                      <RadioGroupItem value="overwrite" id="mode-overwrite" className="mt-0.5" />
                      <label htmlFor="mode-overwrite" className="cursor-pointer space-y-1 flex-1">
                        <span className="font-bold text-rose-700 dark:text-rose-400 text-xs flex items-center gap-1.5">
                          <RefreshCw className="size-3.5" />
                          استبدال المساحة الحالية (Overwrite)
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] block leading-5">
                          حذف البيانات الحالية في هذه المساحة واستبدالها بمحتوى النسخة الاحتياطية. (إجراء حرج).
                        </span>
                      </label>
                    </div>
                  </RadioGroup>

                  {/* Clone workspace name */}
                  {restoreMode === "clone" && (
                    <div className="space-y-1.5 pt-1">
                      <label htmlFor="cloned-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        اسم مساحة العمل المستنسخة:
                      </label>
                      <input
                        id="cloned-name"
                        value={clonedWorkspaceName}
                        onChange={e => setClonedWorkspaceName(e.target.value)}
                        placeholder="اسم المساحة الجديدة"
                        className="h-9 w-full max-w-md bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl text-xs py-2 px-3 font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                      />
                    </div>
                  )}

                  {/* Restore action button */}
                  <div className="pt-1">
                    {restoreMode === "clone" ? (
                      <button
                        type="button"
                        disabled={restoreBackup.isPending}
                        onClick={() => setConfirmRestoreOpen(true)}
                        className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-2.5 px-5 rounded-xl shadow-xs transition-all border border-slate-900 dark:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {restoreBackup.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <HardDriveUpload className="size-3.5" />}
                        بدء استنساخ مساحة العمل
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={restoreBackup.isPending}
                        onClick={() => setConfirmRestoreOpen(true)}
                        className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-xs transition-all border border-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {restoreBackup.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <HardDriveUpload className="size-3.5" />}
                        تأكيد استبدال مساحة العمل
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Section 3: On-Demand Analytical Export ── */}
        <div>
          <p className="text-slate-900 dark:text-white font-bold text-sm mb-4">التصدير التحليلي السريع (On-Demand Export)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* JSON card */}
            <div className="bg-slate-50/60 dark:bg-[#0E1420] border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileJson className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <p className="text-slate-900 dark:text-white font-bold text-sm">JSON تحليلي منظم</p>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-5">
                  قراءات الحسابات والدفتر والحيازات والمستحقات مجمعة لتحليلها برمجيًا أو تصديرها إلى أدوات BI خارجية.
                </p>
              </div>
              <button
                type="button"
                disabled={exportFamily.isPending}
                onClick={() => exportFamily.mutate({ format: "json" })}
                className="bg-white hover:bg-slate-100 text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white border border-slate-200/90 dark:border-slate-700 font-bold text-xs py-2 px-4 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 self-end mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="size-3.5" />
                تنزيل JSON
              </button>
            </div>

            {/* CSV card */}
            <div className="bg-slate-50/60 dark:bg-[#0E1420] border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-slate-900 dark:text-white font-bold text-sm">CSV تشغيلي للجداول</p>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-5">
                  صفوف موحدة للحسابات والعمليات والمستحقات وتقييمات الزكاة لتسهيل فتحها في Excel أو Google Sheets.
                </p>
              </div>
              <button
                type="button"
                disabled={exportFamily.isPending}
                onClick={() => exportFamily.mutate({ format: "csv" })}
                className="bg-white hover:bg-slate-100 text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white border border-slate-200/90 dark:border-slate-700 font-bold text-xs py-2 px-4 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 self-end mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="size-3.5" />
                تنزيل CSV
              </button>
            </div>
          </div>
        </div>

        {/* Confirm Dialog */}
        <ConfirmDialog
          open={confirmRestoreOpen}
          onOpenChange={setConfirmRestoreOpen}
          title={restoreMode === "clone" ? "تأكيد استنساخ مساحة عمل جديدة" : "تحذير أمني: استبدال محتويات المساحة الحالية"}
          description={
            restoreMode === "clone"
              ? `سيتم إنشاء مساحة عمل جديدة باسم "${clonedWorkspaceName || "نسخة مستعادة"}" واستعادة جميع الجداول بداخلها ذرّيًا. هل تود المتابعة؟`
              : "تحذير: سيتم مسح بيانات المساحة الحالية بالكامل واستبدالها بالبيانات المحفوظة في ملف النسخة الاحتياطية. لا يمكن التراجع عن هذا الإجراء إلا بوجود نسخة احتياطية أخرى. هل تود المتابعة بالفعل؟"
          }
          confirmLabel={restoreMode === "clone" ? "تأكيد الاستنساخ" : "نعم، استبدل المساحة بالكامل"}
          cancelLabel="إلغاء"
          isLoading={restoreBackup.isPending}
          onConfirm={executeRestore}
        />
      </main>
    </DashboardLayout>
  );
}
