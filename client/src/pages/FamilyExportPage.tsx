import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Archive,
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
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

export default function FamilyExportPage() {
  const [selectedBackupJson, setSelectedBackupJson] = useState<any | null>(null);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [restoreMode, setRestoreMode] = useState<"clone" | "overwrite">("clone");
  const [clonedWorkspaceName, setClonedWorkspaceName] = useState("");
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Existing analytical export mutation
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

  // Full-State 51-table disaster recovery export mutation
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

  // Pre-restore validation mutation
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

  // Full restore mutation
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
      } catch (err) {
        toast.error("الملف المحدد ليس ملف JSON صالحًا.");
        setSelectedBackupJson(null);
        setValidationResult(null);
      }
    };
    reader.readAsText(file);
  };

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
          category="الحوكمة والتحليل"
          title="مركز الاستعادة والنسخ الاحتياطي المؤسسي"
          description="إدارة شاملة لاستمرارية العمليات المالية والتعافي من الكوارث (Disaster Recovery)، تشمل حزم الجداول الـ 51 كاملة مع بصمة SHA-256، بالإضافة إلى التصدير التحليلي."
          badge={{ text: "حماية تامة 51 جدولاً · SHA-256", variant: "institutional" }}
        />

        {/* Section 1: Institutional Full-State Backup */}
        <Card className="fintech-surface-card border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Archive className="size-5 text-primary" />
                  النسخ الاحتياطي الشامل للنظام (Disaster Recovery)
                </CardTitle>
                <CardDescription>
                  تصدير علائقي كامل لجميع بيانات مساحة العمل (51 جدولاً تشمل دفتر القيود، الـ Lots، الحسابات، التقييمات، والتسويات) مع بيان سلامة رقمي مشفر (SHA-256 Manifest).
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                موصى به للأرشفة الدورية
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-muted/40 p-4 text-xs leading-6 text-muted-foreground flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
              <div>
                <strong className="text-foreground block mb-0.5">ضمان استمرارية الأعمال والامتثال:</strong>
                يحتوي ملف الـ Backup على البنية العلائقية الكاملة لمساحتك، ويصلح للاستعادة الفورية في أي وقت أو للاستنساخ في بيئة معزولة دون أي فقدان للأرصدة التاريخية أو مسارات FIFO.
              </div>
            </div>
            <Button
              className="gap-2"
              size="lg"
              disabled={fullExport.isPending}
              onClick={() => fullExport.mutate()}
            >
              {fullExport.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <HardDriveDownload className="size-4" />
              )}
              تصدير النسخة الشاملة الآن (JSON + SHA-256)
            </Button>
          </CardContent>
        </Card>

        {/* Section 2: Disaster Recovery Restore Engine */}
        <Card className="fintech-surface-card border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <HardDriveUpload className="size-5 text-amber-500" />
              استعادة مساحة العمل من نسخة احتياطية (Restore & Clone Engine)
            </CardTitle>
            <CardDescription>
              استعادة ذرية متكاملة لـ 51 جدولاً مع إعادة تخريط المفاتيح الأجنبية وتفادي أي تكرار أو أخطاء علائقية.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />

            {!selectedBackupJson ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-muted-foreground/30 hover:border-primary rounded-2xl p-8 text-center transition-colors bg-muted/20"
              >
                <Upload className="mx-auto size-10 text-muted-foreground mb-3" />
                <p className="font-semibold text-sm">اضغط لاختيار ملف النسخة الاحتياطية الشاملة (.json)</p>
                <p className="text-xs text-muted-foreground mt-1">يجب أن يحمل الملف تنسيق family-full-backup-v1 مع بيان SHA-256 سليم</p>
              </div>
            ) : (
              <div className="space-y-4 rounded-xl border border-border p-5 bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileCheck2 className="size-6 text-emerald-500" />
                    <div>
                      <strong className="text-sm block">{selectedBackupJson.workspaceMetadata?.name}</strong>
                      <span className="text-xs text-muted-foreground">
                        العملة الأساس: {selectedBackupJson.workspaceMetadata?.baseCurrency} · تاريخ التصدير:{" "}
                        {selectedBackupJson.workspaceMetadata?.exportedAt
                          ? new Date(selectedBackupJson.workspaceMetadata.exportedAt).toLocaleDateString("ar-EG")
                          : "غير محدد"}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedBackupJson(null);
                      setValidationResult(null);
                    }}
                  >
                    تغيير الملف
                  </Button>
                </div>

                {validateBackup.isPending ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    جارٍ فحص البصمة الرقمية وسلامة الجداول الـ 51...
                  </div>
                ) : validationResult?.valid ? (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-[#0B1628] dark:text-slate-100 font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>فحص السلامة اجتاز بنجاح: البصمة الرقمية مطابقة لـ {validationResult.totalRows} سجلاً.</span>
                    </div>
                    <Badge variant="outline" className="bg-emerald-500/20 border-emerald-500/30 text-[#0B1628] dark:text-slate-100 font-medium">
                      SHA-256 سليم
                    </Badge>
                  </div>
                ) : (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
                    <ShieldAlert className="size-4 shrink-0" />
                    <span>{validationResult?.errors?.join("; ") || "الملف المحدد غير صالح."}</span>
                  </div>
                )}

                {validationResult?.valid && (
                  <div className="pt-3 border-t border-border/60 space-y-4">
                    <Label className="text-xs font-semibold">اختر وضع الاستعادة:</Label>
                    <RadioGroup
                      value={restoreMode}
                      onValueChange={(val: "clone" | "overwrite") => setRestoreMode(val)}
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      <div className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30">
                        <RadioGroupItem value="clone" id="mode-clone" className="mt-1" />
                        <Label htmlFor="mode-clone" className="cursor-pointer space-y-1">
                          <strong className="block text-sm flex items-center gap-1.5">
                            <Copy className="size-3.5 text-primary" />
                            استنساخ كمساحة جديدة (Clone)
                          </strong>
                          <span className="text-xs text-muted-foreground block font-normal leading-5">
                            إنشاء مساحة عمل مستقلة تمامًا واستيراد الـ 51 جدولاً فيها دون أي مساس بالمساحة الحالية.
                          </span>
                        </Label>
                      </div>

                      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 p-3 cursor-pointer hover:bg-destructive/5">
                        <RadioGroupItem value="overwrite" id="mode-overwrite" className="mt-1" />
                        <Label htmlFor="mode-overwrite" className="cursor-pointer space-y-1">
                          <strong className="block text-sm flex items-center gap-1.5 text-destructive">
                            <RefreshCw className="size-3.5" />
                            استبدال المساحة الحالية (Overwrite)
                          </strong>
                          <span className="text-xs text-muted-foreground block font-normal leading-5">
                            حذف البيانات الحالية في هذه المساحة واستبدالها بمحتوى النسخة الاحتياطية. (إجراء حرج).
                          </span>
                        </Label>
                      </div>
                    </RadioGroup>

                    {restoreMode === "clone" && (
                      <div className="space-y-1.5 pt-1">
                        <Label htmlFor="cloned-name" className="text-xs">اسم مساحة العمل المستنسخة:</Label>
                        <Input
                          id="cloned-name"
                          value={clonedWorkspaceName}
                          onChange={e => setClonedWorkspaceName(e.target.value)}
                          placeholder="اسم المساحة الجديدة"
                          className="max-w-md"
                        />
                      </div>
                    )}

                    <div className="pt-2">
                      <Button
                        variant={restoreMode === "overwrite" ? "destructive" : "default"}
                        disabled={restoreBackup.isPending}
                        onClick={() => setConfirmRestoreOpen(true)}
                        className="gap-2"
                      >
                        {restoreBackup.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <HardDriveUpload className="size-4" />
                        )}
                        {restoreMode === "clone" ? "بدء استنساخ مساحة العمل" : "تأكيد استبدال مساحة العمل"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: On-Demand Analytical Exports */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold">التصدير التحليلي السريع (On-Demand Export)</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="fintech-surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileJson className="size-5 text-primary" />
                  JSON تحليلي منظم
                </CardTitle>
                <CardDescription>
                  قراءات الحسابات والدفتر والحيازات والمستحقات مجمعة لتحليلها برمجيًا أو تصديرها إلى أدوات BI خارجية.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="gap-2"
                  variant="outline"
                  disabled={exportFamily.isPending}
                  onClick={() => exportFamily.mutate({ format: "json" })}
                >
                  <Download className="size-4" />
                  تنزيل JSON
                </Button>
              </CardContent>
            </Card>

            <Card className="fintech-surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="size-5 text-primary" />
                  CSV تشغيلي للجداول
                </CardTitle>
                <CardDescription>
                  صفوف موحدة للحسابات والعمليات والمستحقات وتقييمات الزكاة لتسهيل فتحها في Excel أو Google Sheets.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="gap-2"
                  variant="outline"
                  disabled={exportFamily.isPending}
                  onClick={() => exportFamily.mutate({ format: "csv" })}
                >
                  <Download className="size-4" />
                  تنزيل CSV
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Confirm Modal for Restore */}
        <ConfirmDialog
          open={confirmRestoreOpen}
          onOpenChange={setConfirmRestoreOpen}
          title={restoreMode === "clone" ? "تأكيد استنساخ مساحة عمل جديدة" : "تحذير أمني: استبدال محتويات المساحة الحالية"}
          description={
            restoreMode === "clone"
              ? `سيتم إنشاء مساحة عمل جديدة باسم "${clonedWorkspaceName || "نسخة مستعادة"}" واستعادة جميع الجداول الـ 51 بداخلها ذرّيًا. هل تود المتابعة؟`
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
