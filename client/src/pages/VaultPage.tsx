import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileLock2, FileText, Lock, Loader2, Upload, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const errorText = (error: unknown) => error instanceof Error ? error.message : "تعذر إكمال العملية الآن.";

/** LTR-isolated date to prevent BiDi scrambling in RTL containers */
function LtrDate({ value }: { value: number }) {
  const iso = new Date(value).toISOString();
  return <span dir="ltr" className="font-mono tabular-nums text-xs">{iso.slice(0, 10)}</span>;
}

const size = (value: number) =>
  value < 1024 * 1024 ? `${Math.ceil(value / 1024)} ك.ب` : `${(value / 1024 / 1024).toFixed(1)} م.ب`;

type VaultLinkType = "general" | "insurance_policy" | "insurance_claim" | "special_asset" | "financial_event";

const linkTypeLabel: Record<VaultLinkType, string> = {
  general: "سجل عائلي عام",
  insurance_policy: "وثيقة تأمين",
  insurance_claim: "مطالبة تأمينية",
  special_asset: "أصل خاص",
  financial_event: "عملية مالية",
};

const acceptedFileTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"];

/** File extension badge */
function ExtBadge({ mimeType }: { mimeType: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    "application/pdf": { label: "PDF", cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800" },
    "image/jpeg":      { label: "JPG", cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800" },
    "image/png":       { label: "PNG", cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800" },
    "image/webp":      { label: "WEBP", cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800" },
    "text/plain":      { label: "TXT", cls: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700" },
  };
  const entry = map[mimeType] ?? { label: "FILE", cls: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700" };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border font-mono ${entry.cls}`}>
      {entry.label}
    </span>
  );
}

export default function VaultPage({ embedded = false }: { embedded?: boolean }) {
  const utils = trpc.useUtils();
  const documents = trpc.family.vault.list.useQuery({});
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [linkType, setLinkType] = useState<VaultLinkType>("general");
  const [linkId, setLinkId] = useState("family-records");
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = trpc.family.vault.upload.useMutation({
    onSuccess: () => {
      toast.success("تم رفع المستند إلى الخزنة المشفرة.");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      void utils.family.vault.list.invalidate();
    },
    onError: error => toast.error(errorText(error)),
  });

  const download = trpc.family.vault.download.useMutation({
    onSuccess: result => window.open(result.url, "_blank", "noopener,noreferrer"),
    onError: error => toast.error(errorText(error)),
  });

  const chooseFile = (candidate: File | null) => {
    if (!candidate) return;
    if (candidate.size > 8_000_000) return toast.error("الحد الأقصى للمستند هو 8 ميغابايت.");
    if (!acceptedFileTypes.includes(candidate.type)) return toast.error("الصيغ المسموح بها: PDF أو JPG أو PNG أو WEBP أو TXT.");
    setFile(candidate);
  };

  const submit = async () => {
    if (!file) return toast.error("اختر مستندًا قبل الرفع.");
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result.split(",")[1] || "") : reject(new Error("تعذر قراءة الملف."));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    upload.mutate({
      originalName: file.name,
      mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | "text/plain",
      contentBase64: base64,
      linkedEntityType: linkType,
      linkedEntityId: linkId || "family-records",
    });
  };

  const content = (
    <main className="mx-auto max-w-6xl space-y-6" dir="rtl">
        <PageHeader
          title="خزنة الوثائق والمستندات"
          description="أرشفة وتخزين آمن للوثائق والعقود القانونية المشفرة مع توثيق سجلات الوصول والتحميل رقابياً."
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "الحوكمة والإدارة", href: "/vault" },
            { label: "خزنة الوثائق والمستندات" },
          ]}
          badge={
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 font-medium text-xs shadow-2xs">
              <Lock className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>تشفير صفري متقدم (AES-256 Vault)</span>
            </div>
          }
          icon={FileLock2}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── Upload Section ── */}
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs h-full">
              <div className="flex items-center gap-2 mb-1">
                <UploadCloud className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <p className="text-slate-900 dark:text-white font-bold text-sm">رفع وثيقة جديدة</p>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-5 leading-5">
                اسحب الملف أو اختره يدويًا. لا تخزن الواجهة الملف بعد الإرسال، ولا يُسمح إلا بصيغ المستندات المعتمدة.
              </p>

              {/* Hidden file input */}
              <input
                ref={inputRef}
                className="sr-only"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,text/plain"
                onChange={event => chooseFile(event.target.files?.[0] ?? null)}
              />

              {/* Drag & Drop Zone */}
              <div
                role="button"
                tabIndex={0}
                aria-label="اسحب مستندًا هنا أو اختر ملفًا"
                onClick={() => inputRef.current?.click()}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click(); } }}
                onDragEnter={event => { event.preventDefault(); setIsDragging(true); }}
                onDragOver={event => event.preventDefault()}
                onDragLeave={event => { event.preventDefault(); setIsDragging(false); }}
                onDrop={event => { event.preventDefault(); setIsDragging(false); chooseFile(event.dataTransfer.files?.[0] ?? null); }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer mb-4 ${
                  isDragging
                    ? "border-indigo-400 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20"
                    : file
                    ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/10"
                    : "border-slate-200 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-500 bg-slate-50/50 dark:bg-[#0E1420]/40"
                }`}
              >
                <div className="size-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto mb-2 shadow-2xs">
                  {file ? <FileText className="size-5" /> : <UploadCloud className="size-5" />}
                </div>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                  {file ? file.name : "اسحب المستند هنا"}
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">
                  {file
                    ? `${size(file.size)} · ${file.type || "صيغة غير معروفة"}`
                    : "أو انقر لاختيار ملف PDF أو صورة أو نص حتى 8 ميغابايت"}
                </p>
              </div>

              {/* File ready banner */}
              {file && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 mb-4">
                  <FileText className="size-3.5 shrink-0" />
                  <span className="flex-1">الملف جاهز للرفع. راجع الارتباط قبل المتابعة.</span>
                  <button
                    type="button"
                    onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }}
                    className="font-bold hover:underline"
                  >
                    إزالة
                  </button>
                </div>
              )}

              {/* Link type + ID */}
              <div className="grid gap-3 sm:grid-cols-2 mb-4">
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">نوع الارتباط</label>
                  <Select value={linkType} onValueChange={value => setLinkType(value as VaultLinkType)}>
                    <SelectTrigger className="h-9 text-xs bg-white dark:bg-[#0E1420] border-slate-300 dark:border-slate-700/80 rounded-xl font-medium text-slate-900 dark:text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(linkTypeLabel) as [VaultLinkType, string][]).map(([v, label]) => (
                        <SelectItem key={v} value={v} className="text-xs">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="vault-link-id" className="text-xs font-semibold text-slate-700 dark:text-slate-300">معرّف الارتباط</label>
                  <input
                    id="vault-link-id"
                    value={linkId}
                    onChange={event => setLinkId(event.target.value)}
                    placeholder="رقم السجل أو وصف مختصر"
                    className="h-9 bg-white dark:bg-[#0E1420] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-xl text-xs py-2.5 px-3 font-medium w-full focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                  />
                </div>
              </div>

              {/* Upload button */}
              <button
                type="button"
                disabled={!file || upload.isPending}
                onClick={() => void submit()}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm border border-slate-900 dark:border-transparent transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {upload.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                رفع إلى الخزنة
              </button>
            </div>
          </div>

          {/* ── Documents Register ── */}
          <div className="lg:col-span-7">
            <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs h-full overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-slate-200/90 dark:border-slate-800/80 flex items-center gap-2">
                <FileLock2 className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div>
                  <p className="text-slate-900 dark:text-white font-bold text-sm">وثائقي المحفوظة</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">يظهر فقط ما ينتمي إلى مساحة FAMILY والملف الشخصي الحاليين.</p>
                </div>
              </div>

              {/* Body */}
              <div className="p-6">
                {documents.isLoading ? (
                  <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">جارٍ تحميل الوثائق…</p>
                ) : documents.error ? (
                  <div className="rounded-xl border border-rose-200/80 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-300 text-center">
                    {errorText(documents.error)}
                  </div>
                ) : documents.data?.length ? (
                  <div className="space-y-2">
                    {documents.data.map(document => (
                      <article
                        key={document.id}
                        className="flex items-center gap-3 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0E1420] hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                      >
                        {/* File icon badge */}
                        <div className="size-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 shadow-2xs">
                          <FileLock2 className="size-4" />
                        </div>

                        {/* File info */}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 dark:text-white text-xs truncate mb-1">
                            {document.originalName}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <ExtBadge mimeType={document.mimeType} />
                            <span className="text-slate-500 dark:text-slate-400 text-[11px]">{size(document.byteSize)}</span>
                            <span className="text-slate-400 dark:text-slate-600 text-[10px]">·</span>
                            <LtrDate value={document.createdAt} />
                            <span className="text-slate-400 dark:text-slate-600 text-[10px]">·</span>
                            <span className="text-slate-500 dark:text-slate-400 text-[11px]">{linkTypeLabel[document.linkedEntityType as VaultLinkType] ?? document.linkedEntityType}</span>
                          </div>
                        </div>

                        {/* Download button */}
                        <button
                          type="button"
                          disabled={download.isPending}
                          onClick={() => download.mutate({ documentId: document.id })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
                          aria-label="تنزيل"
                        >
                          <Download className="size-3.5" />
                          تنزيل
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center mx-auto mb-3">
                      <FileLock2 className="size-6" />
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 font-bold text-sm mb-1">لا توجد مستندات في الخزنة</p>
                    <p className="text-slate-500 dark:text-slate-400 text-xs max-w-xs leading-5">
                      ارفع عقدًا أو وثيقة أو صورة مرجعية، ثم اربطها بالسجل المناسب داخل مساحة FAMILY.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
  );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
