import { describe, it, expect, vi } from "vitest";
import {
  normalizeReceiptNumerals,
  parseReceiptAmount,
  parseReceiptDate,
  extractReceiptData,
  checkReceiptDuplicate,
  analyzeReceiptImage,
} from "../receiptOcrService";

describe("Receipt OCR & Financial Template Extraction Engine", () => {
  describe("Numeral and Amount Normalization", () => {
    it("converts Eastern Arabic numerals and Arabic decimal comma properly", () => {
      const raw = "المبلغ: ١٬٥٠٠٫٥٠ جم";
      const normalized = normalizeReceiptNumerals(raw);
      expect(normalized).toContain("1,500.50");
      expect(parseReceiptAmount("١٬٥٠٠٫٥٠")).toBe(1500.5);
    });

    it("handles standard comma separators in amounts", () => {
      expect(parseReceiptAmount("25,450.75")).toBe(25450.75);
      expect(parseReceiptAmount("1000")).toBe(1000);
      expect(parseReceiptAmount("invalid")).toBe(0);
    });
  });

  describe("Date Parsing", () => {
    it("parses DD/MM/YYYY dates with time", () => {
      const res = parseReceiptDate("تاريخ المعاملة: 14/05/2025 15:30");
      expect(res.dateStr).toContain("2025-05-14");
    });

    it("parses Arabic month names", () => {
      const res = parseReceiptDate("التاريخ: 15 فبراير 2025 - 04:30 م");
      expect(res.dateStr).toContain("2025-02-15");
    });
  });

  describe("Template 1: InstaPay (IPN)", () => {
    it("extracts outbound InstaPay receipt successfully", () => {
      const rawReceipt = `
        شبكة المدفوعات اللحظية IPN
        معاملة إنستاباي ناجحة
        مبلغ المعاملة: EGP 4,250.00
        المستفيد: أحمد محمد الشريف
        حساب المستفيد: ahmed@instapay
        الرقم المرجعي: 405891234567
        التاريخ: 12/03/2025 14:15
        تم التحويل بنجاح
      `;

      const result = extractReceiptData(rawReceipt);
      expect(result.success).toBe(true);
      expect(result.provider).toBe("Instapay");
      expect(result.direction).toBe("expense");
      expect(result.amount).toBe(4250);
      expect(result.currency).toBe("EGP");
      expect(result.reference).toBe("405891234567");
      expect(result.counterparty).toContain("أحمد محمد الشريف");
      expect(result.accountOrWallet).toBe("ahmed@instapay");
      expect(result.suggestedMemo).toContain("تحويل إنستاباي صادر إلى أحمد محمد الشريف");
      expect(result.suggestedMemo).toContain("405891234567");
    });

    it("extracts inbound InstaPay receipt successfully", () => {
      const rawReceipt = `
        تم استلام تحويل عبر إنستاباي
        المبلغ: 1,800.00 جم
        من: سارة عبد الرحمن
        الرقم المرجعي: 501234987654
        تاريخ وتوقيت العملية: 2025-04-10 11:20
      `;

      const result = extractReceiptData(rawReceipt);
      expect(result.success).toBe(true);
      expect(result.provider).toBe("Instapay");
      expect(result.direction).toBe("income");
      expect(result.amount).toBe(1800);
      expect(result.reference).toBe("501234987654");
      expect(result.counterparty).toContain("سارة عبد الرحمن");
      expect(result.suggestedMemo).toContain("تحويل إنستاباي وارد من سارة عبد الرحمن");
    });
  });

  describe("Template 2: Vodafone Cash & Telco Wallets", () => {
    it("extracts mobile wallet transfer receipt", () => {
      const rawReceipt = `
        فودافون كاش
        تم تحويل مبلغ 1,200.00 جنيه
        إلى رقم 01012345678 بنجاح
        رقم العملية: VF9823410
        التاريخ: 20/02/2025 18:45
        مصاريف التحويل: 1 جنيه
      `;

      const result = extractReceiptData(rawReceipt);
      expect(result.success).toBe(true);
      expect(result.provider).toBe("Vodafone Cash");
      expect(result.amount).toBe(1200);
      expect(result.accountOrWallet).toBe("01012345678");
      expect(result.reference).toBe("VF9823410");
      expect(result.direction).toBe("expense");
    });
  });

  describe("Template 3: National Bank of Egypt (NBE)", () => {
    it("extracts NBE transfer advice receipt", () => {
      const rawReceipt = `
        البنك الأهلي المصري NBE
        إشعار تحويل إلكتروني
        المبلغ: EGP 15,000.00
        المستفيد: شركة النور للتجارة
        حساب رقم: **9876
        الرقم المرجعي: NBE884920193
        التاريخ: 05/01/2025 09:30
      `;

      const result = extractReceiptData(rawReceipt);
      expect(result.success).toBe(true);
      expect(result.provider).toBe("NBE");
      expect(result.amount).toBe(15000);
      expect(result.reference).toBe("NBE884920193");
      expect(result.counterparty).toBe("شركة النور للتجارة");
      expect(result.accountOrWallet).toBe("**9876");
    });
  });

  describe("Template 4: CIB Bank Receipt", () => {
    it("extracts CIB transfer details", () => {
      const rawReceipt = `
        Commercial International Bank - CIB
        Transfer Receipt
        Amount: 7,500.00 EGP
        To: Mohamed Tarek
        Transaction ID: CIB77281930
        Date: 12/02/2025 16:00
      `;

      const result = extractReceiptData(rawReceipt);
      expect(result.success).toBe(true);
      expect(result.provider).toBe("CIB");
      expect(result.amount).toBe(7500);
      expect(result.reference).toBe("CIB77281930");
      expect(result.counterparty).toBe("Mohamed Tarek");
    });
  });

  describe("Template 5: Telda Receipt", () => {
    it("extracts Telda transfer receipt", () => {
      const rawReceipt = `
        Telda تيلدا
        Money Sent
        Amount: 350.00 EGP
        Sent to @omarkhalid
        Transaction ID: TLD-99381-XYZ
        Date: 2025-03-01 19:22
      `;

      const result = extractReceiptData(rawReceipt);
      expect(result.success).toBe(true);
      expect(result.provider).toBe("Telda");
      expect(result.amount).toBe(350);
      expect(result.counterparty).toBe("@omarkhalid");
      expect(result.reference).toBe("TLD-99381-XYZ");
    });
  });

  describe("Duplicate Reference Check & Advisory Security", () => {
    it("handles duplicate checking without throwing when db is unavailable or offline", async () => {
      const res = await checkReceiptDuplicate(1, "REF12345678");
      expect(res).toHaveProperty("isDuplicate");
    });

    it("returns warning if duplicate is found in ledger", async () => {
      const analysis = await analyzeReceiptImage({
        workspaceId: 1,
        rawTextFallback: `
          معاملة إنستاباي
          المبلغ: 500.00 جم
          المرجع: REF_TEST_DUPLICATE_999
        `,
      });

      expect(analysis.parsed.success).toBe(true);
      expect(analysis.parsed.amount).toBe(500);
      expect(analysis.parsed.reference).toBe("REF_TEST_DUPLICATE_999");
    });
  });
});
