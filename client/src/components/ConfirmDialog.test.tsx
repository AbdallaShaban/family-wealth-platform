import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <footer>{children}</footer>,
}));

import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders closed without content", () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="تأكيد الترحيل"
        description="هل أنت متأكد من ترحيل الصفوف المحددة؟"
        onConfirm={() => {}}
      />
    );
    expect(markup).toBe("");
  });

  it("renders open with title and description", () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="تأكيد الترحيل"
        description="هل أنت متأكد من ترحيل الصفوف المحددة؟"
        confirmLabel="نعم، رحّل الآن"
        cancelLabel="تراجع"
        variant="destructive"
        onConfirm={() => {}}
      />
    );
    expect(markup).toContain("تأكيد الترحيل");
    expect(markup).toContain("هل أنت متأكد من ترحيل الصفوف المحددة؟");
    expect(markup).toContain("نعم، رحّل الآن");
    expect(markup).toContain("تراجع");
  });
});
