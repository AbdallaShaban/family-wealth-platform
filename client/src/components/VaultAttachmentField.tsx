import React, { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export interface VaultAttachmentFieldProps {
  onAttachmentReady?: (documentId: number, filename: string) => void;
  onSelectDocument?: (documentId: number | null) => void;
  linkedEntityType?: "financial_event" | "general" | "special_asset" | "insurance_policy" | "insurance_claim";
  linkedEntityId?: string;
  disabled?: boolean;
}

const acceptedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"];

export function VaultAttachmentField({
  onAttachmentReady,
  onSelectDocument,
  linkedEntityType = "financial_event",
  linkedEntityId = "draft-event",
  disabled = false,
}: VaultAttachmentFieldProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<{ id: number; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = trpc.family.vault.upload.useMutation({
    onSuccess: (result) => {
      const fileName = file?.name || "وثيقة مرفقة";
      toast.success(`تم حفظ الوثيقة "${fileName}" في الخزنة وربطها بالعملية.`);
      setUploadedDoc({ id: result.id, name: fileName });
      onAttachmentReady?.(result.id, fileName);
      onSelectDocument?.(result.id);
    },
    onError: (error) => {
      toast.error(error.message || "تعذر رفع الوثيقة إلى الخزنة.");
      setFile(null);
    },
  });

  const handleFileSelected = async (selected: File | null) => {
    if (!selected) return;
    if (selected.size > 8_000_000) {
      toast.error("الحد الأقصى للوثيقة المرفقة هو 8 ميغابايت.");
      return;
    }
    if (!acceptedTypes.includes(selected.type)) {
      toast.error("الصيغ المدعومة: PDF أو صور JPG/PNG/WEBP أو مستند نصي TXT.");
      return;
    }

    setFile(selected);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result.split(",")[1] || "");
          } else {
            reject(new Error("تعذر قراءة الملف"));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(selected);
      });

      upload.mutate({
        originalName: selected.name,
        mimeType: selected.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | "text/plain",
        contentBase64: base64,
        linkedEntityType,
        linkedEntityId,
      });
    } catch {
      toast.error("حدث خطأ أثناء معالجة الملف.");
      setFile(null);
    }
  };

  const removeAttachment = () => {
    setFile(null);
    setUploadedDoc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onSelectDocument?.(null);
  };

  return (
    <div className="space-y-2 text-right" dir="rtl">
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
        disabled={disabled || upload.isPending}
        onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)}
      />

      {uploadedDoc ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5 text-xs text-foreground">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold truncate">{uploadedDoc.name}</span>
            <Badge variant="secondary" className="text-[10px]">
              مرفق بالخزنة #{uploadedDoc.id}
            </Badge>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={removeAttachment}
          >
            <X className="size-3.5" />
            <span className="sr-only">إزالة المرفق</span>
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || upload.isPending}
          onClick={() => fileInputRef.current?.click()}
          className="gap-2 text-xs h-9 w-full sm:w-auto border-dashed hover:border-primary/50"
        >
          {upload.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Paperclip className="size-3.5 text-muted-foreground" />
          )}
          {upload.isPending ? "جارٍ التشفير والرفع إلى الخزنة…" : "إرفاق مستند/فاتورة في الخزنة"}
        </Button>
      )}
    </div>
  );
}

export default VaultAttachmentField;
