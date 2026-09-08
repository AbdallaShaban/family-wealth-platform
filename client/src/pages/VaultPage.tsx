import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileLock2, FileText, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const errorText = (error: unknown) => error instanceof Error ? error.message : "تعذر إكمال العملية الآن.";
const date = (value: number) => new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(value));
const size = (value: number) => value < 1024 * 1024 ? `${Math.ceil(value / 1024)} ك.ب` : `${(value / 1024 / 1024).toFixed(1)} م.ب`;
type VaultLinkType = "general" | "insurance_policy" | "insurance_claim" | "special_asset" | "financial_event";

const acceptedFileTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"];

export default function VaultPage() {
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

  return <DashboardLayout><main className="mx-auto max-w-6xl space-y-6" dir="rtl">
    <header className="rounded-[1.75rem] bg-gradient-to-l from-violet-700 to-slate-950 p-7 text-white">
      <p className="text-sm text-violet-100">FAMILY / DOCUMENT VAULT</p>
      <h1 className="mt-2 text-3xl font-bold">خزنة المستندات</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">ترتبط الوثائق بمساحة العائلة فقط. يُشفّر مفتاح التخزين والاسم الوصفي، ويُسجل كل تنزيل بعد التحقق من الصلاحية.</p>
    </header>

    <section className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
      <Card className="fintech-surface-card">
        <CardHeader><CardTitle className="flex items-center gap-2"><UploadCloud className="size-5 text-primary" />رفع وثيقة</CardTitle><CardDescription>اسحب الملف أو اختره يدويًا. لا تخزن الواجهة الملف بعد الإرسال، ولا يُسمح إلا بصيغ المستندات المعتمدة.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <input ref={inputRef} className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,text/plain" onChange={event => chooseFile(event.target.files?.[0] ?? null)} />
          <div
            role="button"
            tabIndex={0}
            aria-label="اسحب مستندًا هنا أو اختر ملفًا"
            className={`vault-dropzone ${isDragging ? "is-dragging" : ""}`}
            onClick={() => inputRef.current?.click()}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click(); } }}
            onDragEnter={event => { event.preventDefault(); setIsDragging(true); }}
            onDragOver={event => event.preventDefault()}
            onDragLeave={event => { event.preventDefault(); setIsDragging(false); }}
            onDrop={event => { event.preventDefault(); setIsDragging(false); chooseFile(event.dataTransfer.files?.[0] ?? null); }}
          >
            <span className="vault-dropzone-icon"><UploadCloud className="size-5" /></span>
            <div><strong>{file ? file.name : "اسحب المستند هنا"}</strong><p>{file ? `${size(file.size)} · ${file.type || "صيغة غير معروفة"}` : "أو انقر لاختيار ملف PDF أو صورة أو نص حتى 8 ميغابايت"}</p></div>
          </div>
          {file && <div className="vault-file-ready"><FileText className="size-4" /><span>الملف جاهز للرفع. راجع الارتباط قبل المتابعة.</span><button type="button" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }} aria-label="إزالة الملف">إزالة</button></div>}
          <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>نوع الارتباط</Label><Select value={linkType} onValueChange={value => setLinkType(value as VaultLinkType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general">سجل عائلي عام</SelectItem><SelectItem value="insurance_policy">بوليصة تأمين</SelectItem><SelectItem value="insurance_claim">مطالبة تأمينية</SelectItem><SelectItem value="special_asset">أصل خاص</SelectItem><SelectItem value="financial_event">عملية مالية</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="vault-link-id">معرّف الارتباط</Label><Input id="vault-link-id" value={linkId} onChange={event => setLinkId(event.target.value)} placeholder="رقم السجل أو وصف مختصر" /></div></div>
          <Button className="gap-2" disabled={!file || upload.isPending} onClick={() => void submit()}>{upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}رفع إلى الخزنة</Button>
        </CardContent>
      </Card>
      <Card className="fintech-surface-card">
        <CardHeader><CardTitle className="flex items-center gap-2"><FileLock2 className="size-5 text-primary" />وثائقي</CardTitle><CardDescription>يظهر فقط ما ينتمي إلى مساحة FAMILY والملف الشخصي الحاليين.</CardDescription></CardHeader>
        <CardContent>{documents.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">جارٍ تحميل الوثائق…</p> : documents.error ? <p className="py-8 text-center text-sm text-destructive">{errorText(documents.error)}</p> : documents.data?.length ? <div className="space-y-2">{documents.data.map(document => <article className="vault-document-row" key={document.id}><span className="vault-document-icon"><FileLock2 className="size-4" /></span><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{document.originalName}</strong><p>{document.mimeType} · {size(document.byteSize)} · {date(document.createdAt)} · {document.linkedEntityType}</p></div><Button size="sm" variant="outline" disabled={download.isPending} onClick={() => download.mutate({ documentId: document.id })}><Download className="size-4" /><span className="sr-only">تنزيل</span></Button></article>)}</div> : <div className="fintech-empty-state"><FileLock2 className="fintech-empty-state-icon" /><h3>لا توجد مستندات في الخزنة</h3><p>ارفع عقدًا أو وثيقة أو صورة مرجعية، ثم اربطها بالسجل المناسب داخل مساحة FAMILY.</p></div>}</CardContent>
      </Card>
    </section>
  </main></DashboardLayout>;
}
