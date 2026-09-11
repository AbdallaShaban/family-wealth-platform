import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

import { OnboardingChecklist } from "./OnboardingChecklist";

describe("OnboardingChecklist", () => {
  it("renders with 0 completed steps", () => {
    const markup = renderToStaticMarkup(
      <OnboardingChecklist
        hasAccounts={false}
        hasTransactions={false}
        hasInvestments={false}
        hasGoals={false}
      />
    );
    expect(markup).toContain("خارطة الجاهزية المالية والمؤسسية");
    expect(markup).toContain("مكتمل 0 من 4 خطوات");
    expect(markup).toContain("إضافة حساب");
  });

  it("renders with some completed steps", () => {
    const markup = renderToStaticMarkup(
      <OnboardingChecklist
        hasAccounts={true}
        hasTransactions={true}
        hasInvestments={false}
        hasGoals={false}
      />
    );
    expect(markup).toContain("مكتمل 2 من 4 خطوات");
    expect(markup).toContain("مكتمل");
  });
});
