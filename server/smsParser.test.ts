import { describe, expect, it } from "vitest";
import { normalizeNumerals, parseEgyptianFinancialSms } from "./smsParser";

describe("Egyptian Banking & InstaPay SMS Parser Suite", () => {
  it("normalizes Eastern Arabic numerals and Arabic decimal point correctly", () => {
    expect(normalizeNumerals("١٢٣٤.٥٠")).toBe("1234.50");
    expect(normalizeNumerals("مبلغ ٤٥٠٫٧٥ جم")).toBe("مبلغ 450.75 جم");
  });

  it("parses InstaPay outbound transfer correctly", () => {
    const sms = "تم تحويل مبلغ 1,500.00 جم بنجاح إلى أحمد محمد عبر إنستاباي. الرقم المرجعي IPN20240925123456";
    const res = parseEgyptianFinancialSms(sms);
    expect(res.success).toBe(true);
    expect(res.provider).toBe("InstaPay");
    expect(res.transactionType).toBe("TRANSFER");
    expect(res.amount).toBe(1500.0);
    expect(res.counterparty).toContain("أحمد محمد");
    expect(res.reference).toBe("IPN20240925123456");
  });

  it("parses InstaPay inbound transfer correctly", () => {
    const sms = "تم استلام تحويل بمبلغ 3,250.50 جم من محمود حسن عبر إنستاباي. الرقم المرجعي IPN99887766";
    const res = parseEgyptianFinancialSms(sms);
    expect(res.success).toBe(true);
    expect(res.provider).toBe("InstaPay");
    expect(res.transactionType).toBe("INCOME");
    expect(res.amount).toBe(3250.5);
    expect(res.counterparty).toContain("محمود حسن");
    expect(res.reference).toBe("IPN99887766");
  });

  it("parses CIB credit card POS purchase correctly", () => {
    const sms = "تمت عملية شراء ببطاقة CIB المنتهية بـ **1234 بمبلغ EGP 450.75 لدى CARREFOUR MAADI في 2026-09-25 14:30. الرصيد المتاح 45,200.00 جم";
    const res = parseEgyptianFinancialSms(sms);
    expect(res.success).toBe(true);
    expect(res.provider).toBe("CIB");
    expect(res.transactionType).toBe("EXPENSE");
    expect(res.amount).toBe(450.75);
    expect(res.counterparty).toContain("CARREFOUR MAADI");
    expect(res.accountMask).toBe("**1234");
  });

  it("parses NBE debit purchase notification correctly", () => {
    const sms = "تم خصم مبلغ 850.50 جم من حسابك رقم **4321 طرف تاجر GOURMET MARKET";
    const res = parseEgyptianFinancialSms(sms);
    expect(res.success).toBe(true);
    expect(res.provider).toBe("NBE");
    expect(res.transactionType).toBe("EXPENSE");
    expect(res.amount).toBe(850.5);
    expect(res.counterparty).toContain("GOURMET MARKET");
  });

  it("parses Banque Misr card purchase correctly", () => {
    const sms = "عملية خصم بقيمة 320.00 ج.م على بطاقتكم المنتهية بـ 7890 لدى HYPER ONE";
    const res = parseEgyptianFinancialSms(sms);
    expect(res.success).toBe(true);
    expect(res.provider).toBe("Banque Misr");
    expect(res.transactionType).toBe("EXPENSE");
    expect(res.amount).toBe(320.0);
    expect(res.counterparty).toContain("HYPER ONE");
  });

  it("parses Vodafone Cash transfer correctly", () => {
    const sms = "تم تحويل 500 جنيه إلى 01012345678 بنجاح. مصاريف التحويل 1 جنيه. رصيدك الحالي 4,200 جنيه. رقم العملية 123456789";
    const res = parseEgyptianFinancialSms(sms);
    expect(res.success).toBe(true);
    expect(res.provider).toBe("Vodafone Cash");
    expect(res.transactionType).toBe("TRANSFER");
    expect(res.amount).toBe(500);
    expect(res.counterparty).toContain("01012345678");
    expect(res.reference).toBe("123456789");
  });

  it("handles empty or irrelevant text safely", () => {
    const res = parseEgyptianFinancialSms("مرحبا بكم في خدمة العملاء");
    expect(res.success).toBe(false);
    expect(res.amount).toBe(0);
  });
});
