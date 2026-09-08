import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import { PrivacyModeProvider } from "@/contexts/PrivacyModeContext";
import SensitiveValue from "./SensitiveValue";

describe("SensitiveValue", () => {
  it("renders the financial value when privacy mode is inactive", () => {
    const markup = renderToStaticMarkup(<PrivacyModeProvider><SensitiveValue>١٢٬٥٠٠ ج.م</SensitiveValue></PrivacyModeProvider>);
    expect(markup).toContain("١٢٬٥٠٠ ج.م");
    expect(markup).toContain("data-sensitive-value");
  });

  it("replaces the value with a stable accessible mask when privacy mode is active", () => {
    const markup = renderToStaticMarkup(<PrivacyModeProvider initialPrivate><SensitiveValue>١٢٬٥٠٠ ج.م</SensitiveValue></PrivacyModeProvider>);
    expect(markup).toContain("••••••");
    expect(markup).toContain("قيمة مخفية في وضع الخصوصية");
    expect(markup).not.toContain("١٢٬٥٠٠ ج.م");
  });
});
