import { describe, expect, it } from "vitest";
import { parseCsvPreview } from "./csvPreview";

describe("parseCsvPreview", () => {
  it("parses comma-separated values and respects quotes", () => {
    const csv = `Date,Description,Amount\n2026-01-01,"Salary payment, monthly",5000\n2026-01-02,Groceries,-120`;
    const result = parseCsvPreview(csv);

    expect(result.headers).toEqual(["Date", "Description", "Amount"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      Date: "2026-01-01",
      Description: "Salary payment, monthly",
      Amount: "5000",
    });
    expect(result.rows[1]).toEqual({
      Date: "2026-01-02",
      Description: "Groceries",
      Amount: "-120",
    });
  });

  it("auto-detects semicolon delimiters", () => {
    const csv = `Date;Details;Debit;Credit\n2026-02-01;Electric Bill;150;0\n2026-02-02;Dividends;0;350`;
    const result = parseCsvPreview(csv);

    expect(result.headers).toEqual(["Date", "Details", "Debit", "Credit"]);
    expect(result.rows[0].Details).toBe("Electric Bill");
    expect(result.rows[0].Debit).toBe("150");
  });

  it("limits preview rows to maxPreviewRows (default 5)", () => {
    const lines = ["Date,Amount"];
    for (let i = 1; i <= 10; i++) {
      lines.push(`2026-01-0${i},${i * 100}`);
    }
    const result = parseCsvPreview(lines.join("\n"), 5);
    expect(result.rows).toHaveLength(5);
  });

  it("strips UTF-8 BOM if present", () => {
    const csv = `\uFEFFDate,Amount\n2026-01-01,100`;
    const result = parseCsvPreview(csv);
    expect(result.headers[0]).toBe("Date");
  });

  it("throws on duplicate headers", () => {
    const csv = `Date,Amount,Amount\n2026-01-01,100,100`;
    expect(() => parseCsvPreview(csv)).toThrow("عناوين الأعمدة المكررة");
  });

  it("throws on empty or single line files", () => {
    expect(() => parseCsvPreview("")).toThrow("فارغ");
    expect(() => parseCsvPreview("Date,Amount")).toThrow("يجب أن يحتوي الملف على رأس وصف واحد على الأقل");
  });
});
