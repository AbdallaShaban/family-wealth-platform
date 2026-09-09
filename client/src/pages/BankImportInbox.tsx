import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, CircleAlert, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import SensitiveValue from "@/components/SensitiveValue";
import { formatMoney } from "@/lib/financialDisplay";
import { parseCsvPreview, type ParsedCsvPreview } from "@/lib/csvPreview";

type Mapping = { dateColumn: string; descriptionColumn: string; amountColumn: string | null; debitColumn: string | null; creditColumn: string | null; referenceColumn: string | null };
type Preview = ParsedCsvPreview & { content: string; filename: string };
type Classification = "income" | "expense" | "transfer" | "ignore" | "unclassified";

function textError(error: unknown) { return error instanceof Error ? error.message : "تعذر إتمام العملية. حاول مجدداً."; }
function money(value: string | null | undefined, currency: string) { return <SensitiveValue>{formatMoney(value, currency, 2)}</SensitiveValue>; }
function dateTime(value: number | null) { return value ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(value)) : "غير صالح"; }
function guess(headers: string[], words: string[]) { return headers.find(header => words.some(word => header.trim().toLowerCase().includes(word))) ?? ""; }
function defaultMapping(headers: string[]): Mapping { return { dateColumn: guess(headers, ["date", "تاريخ"]), descriptionColumn: guess(headers, ["description", "memo", "details", "بيان", "وصف"]), amountColumn: guess(headers, ["amount", "مبلغ", "value"]) || null, debitColumn: guess(headers, ["debit", "withdrawal", "خصم", "مدين"]) || null, creditColumn: guess(headers, ["credit", "deposit", "إيداع", "دائن"]) || null, referenceColumn: guess(headers, ["reference", "ref", "transaction id", "مرجع", "رقم العملية"]) || null }; }
const labels: Record<Classification, string> = { income: "دخل", expense: "مصروف", transfer: "تحويل — للمراجعة اليدوية", ignore: "استثناء", unclassified: "غير مصنف" };
const statusLabel: Record<string, string> = { new: "جديد", exact_duplicate: "مكرر مؤكد", possible_duplicate: "مكرر محتمل", invalid: "غير صالح", posted: "مُرحل", excluded: "مستثنى" };

export default function BankImportInbox() {
  const utils = trpc.useUtils();
  const accounts = trpc.family.accounts.list.useQuery();
  const categories = trpc.family.cashFlow.categories.useQuery();
  const imports = trpc.family.imports.list.useQuery();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping>({ dateColumn: "", descriptionColumn: "", amountColumn: null, debitColumn: null, creditColumn: null, referenceColumn: null });
  const [accountId, setAccountId] = useState("");
  const [selectedImportId, setSelectedImportId] = useState<number | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmPostOpen, setConfirmPostOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeImportId = selectedImportId ?? imports.data?.[0]?.id ?? null;
  const detail = trpc.family.imports.rows.useQuery({ importId: activeImportId ?? 0 }, { enabled: Boolean(activeImportId) });
  const currentAccount = accounts.data?.find(account => String(account.id) === accountId);
  const upload = trpc.family.imports.uploadCsv.useMutation({ onSuccess: result => { toast.success(`تمت إضافة ${result.rowCount} صفاً إلى Inbox للمراجعة.`); setSelectedImportId(result.importId); setSelectedRowIds([]); setPreview(null); void utils.family.imports.list.invalidate(); void utils.family.imports.rows.invalidate(); }, onError: error => toast.error(textError(error)) });
  const review = trpc.family.imports.reviewRow.useMutation({ onSuccess: () => void utils.family.imports.rows.invalidate(), onError: error => toast.error(textError(error)) });
  const post = trpc.family.imports.postReviewed.useMutation({ onSuccess: result => { toast.success(`تم ترحيل ${result.postedEventIds.length} صفاً إلى الدفتر المتوازن.`); setSelectedRowIds([]); setConfirmPostOpen(false); void utils.family.imports.rows.invalidate(); void utils.family.imports.list.invalidate(); void utils.family.dashboard.invalidate(); void utils.family.ledger.recent.invalidate(); }, onError: error => { setConfirmPostOpen(false); toast.error(textError(error)); } });
  const eligibleRows = useMemo(() => detail.data?.rows.filter(row => row.matchStatus === "new" && (row.classification === "income" || row.classification === "expense") && Boolean(row.categoryId)) ?? [], [detail.data]);

  const chooseFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 1_000_000) { toast.error("الحد الأقصى للملف في Inbox هو 1 ميغابايت."); return; }
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") { toast.error("اختر ملف CSV فقط."); return; }
    try { const content = await file.text(); const parsed = parseCsvPreview(content, 5); setPreview({ ...parsed, content, filename: file.name }); setMapping(defaultMapping(parsed.headers)); } catch (error) { toast.error(textError(error)); }
  };

  const submitUpload = () => {
    if (!preview || !accountId || !currentAccount) { toast.error("اختر حساباً وملفاً قبل إضافته إلى Inbox."); return; }
    if (!mapping.dateColumn || !mapping.descriptionColumn || (!mapping.amountColumn && !mapping.debitColumn && !mapping.creditColumn)) { toast.error("حدّد أعمدة التاريخ والوصف والمبلغ أو الخصم والإيداع."); return; }
    upload.mutate({ accountId: Number(accountId), filename: preview.filename, currency: currentAccount.currency, content: preview.content, mapping });
  };

  const selectAllEligible = () => setSelectedRowIds(eligibleRows.map(row => row.id));
  const toggleRow = (id: number) => setSelectedRowIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);

  if (accounts.isLoading || imports.isLoading) return <DashboardLayout><div className="fintech-page-loading"><Skeleton className="fintech-loading-title" /><Skeleton className="fintech-loading-panel" /></div></DashboardLayout>;
  if (accounts.error || imports.error) return <DashboardLayout><Card className="fintech-inline-error"><CardContent className="p-5">{textError(accounts.error ?? imports.error)}</CardContent></Card></DashboardLayout>;

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-7xl space-y-6" dir="rtl">
        <PageHeader
          title="Inbox كشوف الحساب"
          description="ارفع CSV، صنّف الحقول، ثم راجع الصفوف. لا ينتقل أي صف إلى الدفتر إلا بترحيل صريح بعد المطابقة."
          icon={FileSpreadsheet}
          breadcrumbs={[
            { label: "العمليات والسيولة", href: "/family/accounts" },
            { label: "كشوف الحسابات (Inbox)" },
          ]}
          badge="الترحيل قابل للتدقيق"
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
          <Card className="fintech-surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadCloud className="size-5 text-primary" />
                رفع كشف جديد
              </CardTitle>
              <CardDescription>يتم حفظ الملف المرجعي بأمان؛ الحد الأقصى 500 صف و1 ميغابايت لكل كشف.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>الحساب المستهدف</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الحساب البنكي" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.data?.filter(account => ["cash", "bank", "brokerage", "wallet"].includes(account.accountType) && account.status === "active").map(account => (
                        <SelectItem key={account.id} value={String(account.id)}>
                          {account.name} — {account.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>ملف CSV</Label>
                  <input
                    ref={fileInputRef}
                    id="csv-file-hidden"
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={event => void chooseFile(event.target.files?.[0] ?? null)}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) void chooseFile(file);
                    }}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition cursor-pointer ${
                      isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-muted/20"
                    }`}
                  >
                    <UploadCloud className="size-6 text-primary mb-1" />
                    <span className="text-xs font-medium">
                      {preview ? preview.filename : "اسحب ملف CSV هنا أو انقر للاختيار"}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">الحد الأقصى 1 ميغابايت (CSV فقط)</span>
                  </div>
                </div>
              </div>

              {preview && (
                <div className="space-y-4 rounded-2xl border border-border bg-muted/35 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm">{preview.filename}</strong>
                    <Badge variant="secondary">معاينة أول {preview.rows.length} صفوف</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <ColumnSelect label="عمود التاريخ" value={mapping.dateColumn} headers={preview.headers} onChange={value => setMapping(current => ({ ...current, dateColumn: value }))} />
                    <ColumnSelect label="عمود الوصف" value={mapping.descriptionColumn} headers={preview.headers} onChange={value => setMapping(current => ({ ...current, descriptionColumn: value }))} />
                    <ColumnSelect label="عمود المبلغ" value={mapping.amountColumn ?? "none"} headers={preview.headers} optional onChange={value => setMapping(current => ({ ...current, amountColumn: value === "none" ? null : value }))} />
                    <ColumnSelect label="عمود الخصم" value={mapping.debitColumn ?? "none"} headers={preview.headers} optional onChange={value => setMapping(current => ({ ...current, debitColumn: value === "none" ? null : value }))} />
                    <ColumnSelect label="عمود الإيداع" value={mapping.creditColumn ?? "none"} headers={preview.headers} optional onChange={value => setMapping(current => ({ ...current, creditColumn: value === "none" ? null : value }))} />
                    <ColumnSelect label="المرجع الخارجي" value={mapping.referenceColumn ?? "none"} headers={preview.headers} optional onChange={value => setMapping(current => ({ ...current, referenceColumn: value === "none" ? null : value }))} />
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-border bg-card">
                    <table className="w-full min-w-[580px] text-right text-xs">
                      <thead>
                        <tr>
                          {preview.headers.map(header => (
                            <th className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap" key={header}>
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, index) => (
                          <tr className="border-t border-border" key={index}>
                            {preview.headers.map(header => (
                              <td className="max-w-40 truncate px-3 py-2" key={header}>
                                {row[header]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <Button className="gap-2" onClick={submitUpload} disabled={!preview || upload.isPending}>
                {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                إضافة إلى Inbox للمراجعة
              </Button>
            </CardContent>
          </Card>

          <Card className="fintech-surface-card">
            <CardHeader>
              <CardTitle>الملفات الأخيرة</CardTitle>
              <CardDescription>اختر ملفاً لاستكمال المراجعة أو معرفة حالة الترحيل.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {imports.data?.length ? (
                imports.data.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedImportId(item.id); setSelectedRowIds([]); }}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-right transition ${activeImportId === item.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-sm">{item.originalFilename}</strong>
                      <small className="text-muted-foreground">{item.accountName} · {item.rowCount} صف</small>
                    </span>
                    <Badge variant="outline">{item.status === "posted" ? "مُرحل" : "مراجعة"}</Badge>
                  </button>
                ))
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">لا توجد ملفات بانتظار المراجعة.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {activeImportId && (
          <Card className="fintech-surface-card">
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>مراجعة الصفوف</CardTitle>
                <CardDescription>
                  {detail.data?.statement.originalFilename ?? "تحميل الملف…"} · الصفوف ذات المطابقة المحتملة أو المؤكدة لا تُرحّل تلقائياً.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={selectAllEligible} disabled={!eligibleRows.length}>
                  اختيار الصفوف الجاهزة ({eligibleRows.length})
                </Button>
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={!selectedRowIds.length || post.isPending}
                  onClick={() => setConfirmPostOpen(true)}
                >
                  {post.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  ترحيل المحدد ({selectedRowIds.length})
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {detail.isLoading ? (
                <Skeleton className="h-72" />
              ) : detail.error ? (
                <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  <CircleAlert className="size-5" />
                  {textError(detail.error)}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[950px] text-right text-sm">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="p-3">ترحيل</th>
                        <th className="p-3">التاريخ</th>
                        <th className="p-3">الوصف</th>
                        <th className="p-3">المبلغ</th>
                        <th className="p-3">حالة المطابقة</th>
                        <th className="p-3">التصنيف</th>
                        <th className="p-3">الفئة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.data?.rows.map(row => {
                        const canPost = row.matchStatus === "new" && (row.classification === "income" || row.classification === "expense") && Boolean(row.categoryId);
                        return (
                          <tr className="border-t border-border" key={row.id}>
                            <td className="p-3">
                              <input
                                type="checkbox"
                                aria-label={`ترحيل الصف ${row.sourceRowNumber}`}
                                disabled={!canPost}
                                checked={selectedRowIds.includes(row.id)}
                                onChange={() => toggleRow(row.id)}
                              />
                            </td>
                            <td className="p-3 whitespace-nowrap">{dateTime(row.occurredAt)}</td>
                            <td className="max-w-72 truncate p-3" title={row.description ?? ""}>
                              {row.description ?? "—"}
                            </td>
                            <td className={`p-3 font-semibold ${Number(row.amount ?? 0) < 0 ? "text-destructive" : "text-primary"}`}>
                              {money(row.amount, row.currency)}
                            </td>
                            <td className="p-3">
                              <Badge variant={row.matchStatus === "new" ? "secondary" : "outline"}>
                                {statusLabel[row.matchStatus]}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Select
                                value={row.classification}
                                disabled={row.matchStatus === "posted"}
                                onValueChange={value => review.mutate({
                                  importId: activeImportId,
                                  rowId: row.id,
                                  classification: value as Classification,
                                  categoryId: ["income", "expense"].includes(value) ? row.categoryId : null,
                                  reviewNote: null,
                                })}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(labels).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-3">
                              {["income", "expense"].includes(row.classification) ? (
                                <Select
                                  value={row.categoryId ? String(row.categoryId) : "none"}
                                  disabled={row.matchStatus === "posted"}
                                  onValueChange={value => review.mutate({
                                    importId: activeImportId,
                                    rowId: row.id,
                                    classification: row.classification as Classification,
                                    categoryId: value === "none" ? null : Number(value),
                                    reviewNote: null,
                                  })}
                                >
                                  <SelectTrigger className="w-44">
                                    <SelectValue placeholder="اختر فئة" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">بدون فئة</SelectItem>
                                    {categories.data?.filter(category => category.direction === row.classification && !category.isArchived).map(category => (
                                      <SelectItem key={category.id} value={String(category.id)}>
                                        {category.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {row.classification === "transfer" ? "سجّل التحويل يدوياً" : "—"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <ConfirmDialog
          open={confirmPostOpen}
          onOpenChange={setConfirmPostOpen}
          title="تأكيد ترحيل الصفوف المحددة"
          description={`أنت على وشك ترحيل ${selectedRowIds.length} صفاً إلى الدفتر المحاسبي المتوازن. سيتم إنشاء قيود دفتر الأستاذ الرسمية وتحديث الأرصدة. لن يمكن حذف هذه القيود إلا بقيود عكسية مدققة.`}
          confirmText={`تأكيد ترحيل (${selectedRowIds.length}) صف`}
          cancelText="إلغاء ومتابعة المراجعة"
          isLoading={post.isPending}
          onConfirm={() => {
            if (activeImportId && selectedRowIds.length) {
              post.mutate({ importId: activeImportId, rowIds: selectedRowIds });
            }
          }}
        />

        <ImportReversalControls importId={activeImportId ?? 0} rows={detail.data?.rows ?? []} />
      </main>
    </DashboardLayout>
  );
}

function ColumnSelect({ label, value, headers, optional = false, onChange }: { label: string; value: string; headers: string[]; optional?: boolean; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="اختر عموداً" />
        </SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value="none">غير مستخدم</SelectItem>}
          {headers.map(header => (
            <SelectItem value={header} key={header}>
              {header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ImportReversalControls({ importId, rows }: { importId: number; rows: Array<{ id: number; description: string | null; matchStatus: string; postedEventId: number | null }> }) {
  const utils = trpc.useUtils();
  const access = trpc.family.bootstrap.useQuery();
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmReverseOpen, setConfirmReverseOpen] = useState(false);
  const reversible = rows.filter(row => row.matchStatus === "posted" && row.postedEventId);
  const allowed = ["owner", "advisor"].includes(access.data?.membership.role ?? "viewer");
  const reverse = trpc.family.imports.reversePosted.useMutation({
    onSuccess: result => {
      toast.success(`تم إنشاء ${result.reversalEventIds.length} قيد عكس مدقق.`);
      setSelected([]);
      setConfirmReverseOpen(false);
      void utils.family.imports.rows.invalidate();
      void utils.family.imports.list.invalidate();
      void utils.family.dashboard.invalidate();
      void utils.family.ledger.recent.invalidate();
    },
    onError: error => {
      setConfirmReverseOpen(false);
      toast.error(textError(error));
    },
  });

  if (!allowed || !reversible.length) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-base">عكس ترحيل مستورد</CardTitle>
        <CardDescription>ينشئ قيداً عكسياً ولا يعدّل القيد التاريخي. يتطلب ذلك دور مستشار أو مالك.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {reversible.map(row => (
            <Button
              key={row.id}
              size="sm"
              variant={selected.includes(row.id) ? "default" : "outline"}
              onClick={() => setSelected(current => current.includes(row.id) ? current.filter(id => id !== row.id) : [...current, row.id])}
            >
              {row.description || `الصف ${row.id}`}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          disabled={!selected.length || reverse.isPending}
          onClick={() => setConfirmReverseOpen(true)}
        >
          {reverse.isPending && <Loader2 className="ml-2 size-4 animate-spin" />}
          عكس الصفوف المحددة ({selected.length})
        </Button>

        <ConfirmDialog
          open={confirmReverseOpen}
          onOpenChange={setConfirmReverseOpen}
          title="تأكيد عكس القيود المستوردة"
          description={`هل أنت متأكد من عكس ${selected.length} قيد؟ سيتم إنشاء قيود عكسية متعادلة في الدفتر المحاسبي مع الحفاظ على الأثر التدقيقي التام.`}
          confirmText={`تأكيد العكس (${selected.length})`}
          cancelText="إلغاء"
          variant="destructive"
          isLoading={reverse.isPending}
          onConfirm={() => reverse.mutate({ importId, rowIds: selected })}
        />
      </CardContent>
    </Card>
  );
}

