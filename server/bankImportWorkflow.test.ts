import { describe, expect, it } from "vitest";
import { canPostImportedRow, shouldKeepImportInReview } from "./bankImportWorkflow";

describe("bank import workflow", () => {
  it("permits only reviewed new income or expense rows with a category and usable monetary data", () => {
    expect(canPostImportedRow({ matchStatus: "new", classification: "income", categoryId: 4, occurredAt: 1, amount: "10" })).toBe(true);
    expect(canPostImportedRow({ matchStatus: "possible_duplicate", classification: "income", categoryId: 4, occurredAt: 1, amount: "10" })).toBe(false);
    expect(canPostImportedRow({ matchStatus: "new", classification: "expense", categoryId: null, occurredAt: 1, amount: "10" })).toBe(false);
  });

  it("keeps an import open for invalid, potential-duplicate, or unreviewed rows", () => {
    expect(shouldKeepImportInReview([{ matchStatus: "posted" }, { matchStatus: "excluded" }, { matchStatus: "exact_duplicate" }])).toBe(false);
    expect(shouldKeepImportInReview([{ matchStatus: "posted" }, { matchStatus: "possible_duplicate" }])).toBe(true);
    expect(shouldKeepImportInReview([{ matchStatus: "invalid" }])).toBe(true);
  });
});
