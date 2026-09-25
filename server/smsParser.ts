/**
 * Egyptian Banking & InstaPay SMS / Clipboard Parser
 * Supports InstaPay (Inbound & Outbound), CIB, NBE, Banque Misr, QNB, Vodafone Cash, and Telco Wallets.
 */

export interface ParsedFinancialMessage {
  success: boolean;
  provider: "InstaPay" | "CIB" | "NBE" | "Banque Misr" | "QNB" | "Vodafone Cash" | "Generic Egyptian Bank";
  transactionType: "EXPENSE" | "INCOME" | "TRANSFER";
  amount: number;
  currency: string;
  counterparty?: string;
  accountMask?: string;
  reference?: string;
  timestamp?: string;
  confidence: number; // 0 to 100
  suggestedMemo: string;
  rawText: string;
}

export type ParsedSmsResult = ParsedFinancialMessage;

/** Converts Eastern Arabic numerals (٠-٩) and decimal separators to standard Arabic numerals (0-9) */
export function normalizeNumerals(str: string): string {
  const eastern = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  let out = str;
  for (let i = 0; i < 10; i++) {
    out = out.replaceAll(eastern[i], String(i));
  }
  out = out.replaceAll("٫", ".");
  return out;
}

function parseAmount(numStr: string): number {
  if (!numStr) return 0;
  const clean = normalizeNumerals(numStr).replace(/,/g, "").trim();
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : Math.round(val * 100) / 100;
}

export function parseEgyptianFinancialSms(rawText: string): ParsedFinancialMessage {
  const text = normalizeNumerals(rawText || "").trim();

  const fallback: ParsedFinancialMessage = {
    success: false,
    provider: "Generic Egyptian Bank",
    transactionType: "EXPENSE",
    amount: 0,
    currency: "EGP",
    confidence: 0,
    suggestedMemo: text.slice(0, 100),
    rawText,
  };

  if (!text) return fallback;

  // Crucial: remove "Available Balance / الرصيد المتاح" clause to prevent picking balance as transaction amount
  const sanitizedText = text.replace(/(?:الرصيد المتاح|الرصيد الحالي|available balance|avail(?:\s*bal)?|balance)[^.]*/gi, "");

  // Extract Card/Account Mask (e.g. **1234, 1234)
  let accountMask: string | undefined;
  const maskMatch = text.match(/(?:المنتهية بـ|المنتهي بـ|ending(?:\s+in)?|رقم|card|بطاقتكم|حسابك)\s*(?:[*\s]*)(\d{4})/i);
  if (maskMatch) {
    accountMask = `**${maskMatch[1]}`;
  }

  // Extract Reference / Transaction ID
  let reference: string | undefined;
  const refMatch = text.match(/(?:الرقم المرجعي|رقم العملية|مرجع|ref(?:erence)?|txn(?:\s*id)?|auth)[\s:]*([A-Za-z0-9]+)/i);
  if (refMatch) {
    reference = refMatch[1];
  }

  // 1. INSTAPAY (إنستاباي / IPN)
  if (/instapay|إنستاباي|انستاباي|ipn/i.test(text)) {
    // 1.1 Inbound
    if (/استلام|تم استلام|وارد|received/i.test(sanitizedText)) {
      const amtMatch = sanitizedText.match(/(?:بمبلغ|مبلغ|amount|received)\s*(?:egp|جم|ج\.م)?\s*([0-9,.]+)/i) ||
                       sanitizedText.match(/([0-9,.]+)\s*(?:جم|ج\.م|egp|جنيه)/i);
      const senderMatch = sanitizedText.match(/(?:من|from)\s+([^.\n\r]+?)(?:\s+(?:عبر|بواسطة|via)\s+إنستاباي|\.|\s+الرقم المرجعي|\s+ref|$)/i);
      const amount = amtMatch ? parseAmount(amtMatch[1]) : 0;
      const counterparty = senderMatch ? senderMatch[1].trim() : undefined;
      return {
        success: amount > 0,
        provider: "InstaPay",
        transactionType: "INCOME",
        amount,
        currency: "EGP",
        counterparty,
        reference,
        confidence: 95,
        suggestedMemo: counterparty ? `تحويل وارد عبر إنستاباي من ${counterparty}` : "تحويل إنستاباي وارد",
        rawText,
      };
    }

    // 1.2 Outbound
    const amtMatch = sanitizedText.match(/(?:بمبلغ|مبلغ|amount|transfer of)\s*(?:egp|جم|ج\.م)?\s*([0-9,.]+)/i) ||
                     sanitizedText.match(/([0-9,.]+)\s*(?:جم|ج\.م|egp|جنيه)/i);
    const recipMatch = sanitizedText.match(/(?:إلى|الي|to)\s+([^.\n\r]+?)(?:\s+(?:عبر|بواسطة|via)\s+إنستاباي|\.|\s+الرقم المرجعي|\s+ref|$)/i);
    const amount = amtMatch ? parseAmount(amtMatch[1]) : 0;
    const counterparty = recipMatch ? recipMatch[1].replace(/بنجاح/g, "").trim() : undefined;
    return {
      success: amount > 0,
      provider: "InstaPay",
      transactionType: "TRANSFER",
      amount,
      currency: "EGP",
      counterparty,
      reference,
      confidence: 95,
      suggestedMemo: counterparty ? `تحويل إنستاباي إلى ${counterparty}` : "تحويل إنستاباي صادر",
      rawText,
    };
  }

  // 2. VODAFONE CASH & MOBILE WALLETS
  if (/vodafone|فودافون|كاش|أورنج كاش|اتصالات كاش|وي باي|smart wallet|مصاريف التحويل|رقم العملية/i.test(text) && (/01[0125]\d{8}/.test(text) || /كاش/.test(text))) {
    const amtMatch = sanitizedText.match(/(?:تحويل|خصم|سحب|استلام|استلمت|مبلغ)?\s*([0-9,.]+)\s*(?:جنيه|جم|ج\.م|egp)/i) ||
                     sanitizedText.match(/([0-9,.]+)\s*(?:جنيه|جم|ج\.م|egp)/i);
    const phoneMatch = sanitizedText.match(/(01[0125]\d{8})/);
    const isIncome = /استلام|استلمت|إيداع/i.test(sanitizedText);
    const amount = amtMatch ? parseAmount(amtMatch[1]) : 0;
    return {
      success: amount > 0,
      provider: "Vodafone Cash",
      transactionType: isIncome ? "INCOME" : phoneMatch ? "TRANSFER" : "EXPENSE",
      amount,
      currency: "EGP",
      counterparty: phoneMatch ? phoneMatch[1] : undefined,
      reference,
      confidence: 90,
      suggestedMemo: phoneMatch ? `محفظة إلكترونية: ${phoneMatch[1]}` : isIncome ? "إيداع محفظة إلكترونية" : "معاملة محفظة إلكترونية",
      rawText,
    };
  }

  // 3. CIB (Commercial International Bank)
  if (/cib|البنك التجاري الدولي/i.test(text)) {
    const isAtm = /سحب|atm/i.test(sanitizedText);
    const amtMatch = sanitizedText.match(/(?:بمبلغ|مبلغ|egp|جم|ج\.م)\s*([0-9,.]+)/i) ||
                     sanitizedText.match(/([0-9,.]+)\s*(?:egp|جم|ج\.م|جنيه)/i);
    const merchantMatch = sanitizedText.match(/(?:لدى|at)\s+([^.\n\r]+?)(?:\s+في|\s+on|\.|$)/i);
    const amount = amtMatch ? parseAmount(amtMatch[1]) : 0;
    const counterparty = isAtm ? "سحب نقدي ATM" : merchantMatch ? merchantMatch[1].trim() : undefined;
    return {
      success: amount > 0,
      provider: "CIB",
      transactionType: "EXPENSE",
      amount,
      currency: "EGP",
      counterparty,
      accountMask,
      reference,
      confidence: 92,
      suggestedMemo: counterparty ? `CIB: ${counterparty}` : "معاملة CIB",
      rawText,
    };
  }

  // 4. NBE (البنك الأهلي المصري)
  if (/البنك الأهلي|الأهلي المصري|nbe|ميزة|طرف تاجر/i.test(text)) {
    const amtMatch = sanitizedText.match(/(?:مبلغ|قيمة|بمبلغ)\s*([0-9,.]+)/i) ||
                     sanitizedText.match(/([0-9,.]+)\s*(?:جم|ج\.م|egp|جنيه)/i);
    const merchantMatch = sanitizedText.match(/(?:طرف تاجر|لدى)\s+([^.\n\r]+?)(?:\.|$)/i);
    const amount = amtMatch ? parseAmount(amtMatch[1]) : 0;
    const counterparty = merchantMatch ? merchantMatch[1].trim() : undefined;
    return {
      success: amount > 0,
      provider: "NBE",
      transactionType: "EXPENSE",
      amount,
      currency: "EGP",
      counterparty: counterparty || "البنك الأهلي",
      accountMask,
      reference,
      confidence: 90,
      suggestedMemo: counterparty ? `البنك الأهلي: ${counterparty}` : "معاملة البنك الأهلي المصري",
      rawText,
    };
  }

  // 5. BANQUE MISR (بنك مصر)
  if (/بنك مصر|banque misr|بطاقتكم المنتهية/i.test(text)) {
    const amtMatch = sanitizedText.match(/(?:بقيمة|مبلغ|بمبلغ)\s*([0-9,.]+)/i) ||
                     sanitizedText.match(/([0-9,.]+)\s*(?:ج\.م|جم|egp|جنيه)/i);
    const merchantMatch = sanitizedText.match(/(?:لدى|at)\s+([^.\n\r]+?)(?:\.|$)/i);
    const amount = amtMatch ? parseAmount(amtMatch[1]) : 0;
    const counterparty = merchantMatch ? merchantMatch[1].trim() : undefined;
    return {
      success: amount > 0,
      provider: "Banque Misr",
      transactionType: "EXPENSE",
      amount,
      currency: "EGP",
      counterparty,
      accountMask,
      reference,
      confidence: 90,
      suggestedMemo: counterparty ? `بنك مصر: ${counterparty}` : "مشتريات بنك مصر",
      rawText,
    };
  }

  // 6. QNB ALAHLI
  if (/qnb|قطر الوطني/i.test(text)) {
    const amtMatch = sanitizedText.match(/(?:egp|جم)?\s*([0-9,.]+)\s*(?:egp|جم|جنيه)?/i);
    const merchantMatch = sanitizedText.match(/(?:at|لدى)\s+([^.\n\r]+?)(?:\s+on|\s+في|\.|$)/i);
    const amount = amtMatch ? parseAmount(amtMatch[1]) : 0;
    const counterparty = merchantMatch ? merchantMatch[1].trim() : undefined;
    return {
      success: amount > 0,
      provider: "QNB",
      transactionType: "EXPENSE",
      amount,
      currency: "EGP",
      counterparty,
      accountMask,
      reference,
      confidence: 92,
      suggestedMemo: counterparty ? `QNB: ${counterparty}` : "مشتريات QNB",
      rawText,
    };
  }

  // 7. GENERIC EGYPTIAN BANKING PATTERN
  const genericAmountMatch = sanitizedText.match(/(?:مبلغ|قيمة|amount|debited|credited|خصم|شراء)\s*[:=]?\s*([0-9,.]+)/i) ||
                             sanitizedText.match(/([0-9,.]+)\s*(?:جم|ج\.م|egp|جنيه)/i);
  if (genericAmountMatch) {
    const amount = parseAmount(genericAmountMatch[1]);
    const isCredit = /إيداع|استلام|وارد|credit|received|refund/i.test(sanitizedText);
    return {
      success: amount > 0,
      provider: "Generic Egyptian Bank",
      transactionType: isCredit ? "INCOME" : "EXPENSE",
      amount,
      currency: "EGP",
      accountMask,
      reference,
      confidence: 70,
      suggestedMemo: isCredit ? "إيداع بنكي / تحويل وارد" : "معاملة بنكية / مدفوعات",
      rawText,
    };
  }

  return fallback;
}

export const parseFinancialSms = parseEgyptianFinancialSms;
