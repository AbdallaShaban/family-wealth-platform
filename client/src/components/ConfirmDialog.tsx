import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  variant = "default",
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const finalConfirmLabel = confirmLabel || confirmText || "تأكيد الإجراء";
  const finalCancelLabel = cancelLabel || cancelText || "إلغاء";

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {variant === "destructive" ? (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
            ) : null}
            <div>
              <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 gap-2 sm:justify-start">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
          >
            {finalCancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={isLoading}
            onClick={handleConfirm}
            className="gap-2"
          >
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            {finalConfirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDialog;
