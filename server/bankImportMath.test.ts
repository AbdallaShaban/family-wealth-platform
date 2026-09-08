import { describe, expect, it } from "vitest";
import { buildImportRows, detectDuplicate, parseBankDate, parseCsv, validateColumnMapping } from "./bankImportMath";

describe("bank CSV parsing", () => {
  it("parses quoted comma-separated values and maps signed amounts", () => {
    const csv = parseCsv('Date,Description,Amount,Ref\n2026-08-01,"Coffee, cafe",-1,ABC-1\n2026-08-02,Salary,"1,200.50",ABC-2');
    validateColumnMapping(csv.headers, { dateColumn: "Date", descriptionColumn: "Description", amountColumn: "Amount", referenceColumn: "Ref" });
    const rows = buildImportRows({ rows: csv.rows, contentHash: "hash", mapping: { dateColumn: "Date", descriptionColumn: "Description", amountColumn: "Amount", referenceColumn: "Ref" } });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ description: "Coffee, cafe", amount: "-1.000000", classification: "expense", externalRef: "ABC-1" });
    expect(rows[1]).toMatchObject({ amount: "1200.500000", classification: "income" });
  });

  it("uses debit and credit columns and marks invalid dates", () => {
    const rows = buildImportRows({ rows: [{ Date: "03/08/2026", Description: "Bill", Debit: "1.234,50", Credit: "" }, { Date: "bad", Description: "Broken", Debit: "2", Credit: "" }], contentHash: "hash", mapping: { dateColumn: "Date", descriptionColumn: "Description", debitColumn: "Debit", creditColumn: "Credit" } });
    expect(rows[0]).toMatchObject({ amount: "-1234.500000", classification: "expense", matchStatus: "new" });
    expect(rows[1]).toMatchObject({ matchStatus: "invalid" });
    expect(parseBankDate("2026-02-30")).toBeNull();
  });
});

describe("import duplicate matching", () => {
  it("prefers exact external references and then flags close amount/date matches", () => {
    const events = [{ id: 8, externalRef: "ABC-1", occurredAt: Date.UTC(2026, 7, 1), grossAmount: "20.00", eventType: "expense" }];
    expect(detectDuplicate({ row: { occurredAt: Date.UTC(2026, 7, 1), amount: "-20", externalRef: "ABC-1", classification: "expense" }, events })).toEqual({ status: "exact_duplicate", eventId: 8 });
    expect(detectDuplicate({ row: { occurredAt: Date.UTC(2026, 7, 2), amount: "-20", externalRef: null, classification: "expense" }, events })).toEqual({ status: "possible_duplicate", eventId: 8 });
  });
});
