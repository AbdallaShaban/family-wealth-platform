import { and, eq, like, or } from "drizzle-orm";
import { getDb } from "../db";
import { financialEvents } from "../../drizzle/schema";

export type ReceiptProvider =
  | "Instapay"
  | "Vodafone Cash"
  | "NBE"
  | "CIB"
  | "Telda"
  | "Generic";

export type ReceiptDirection = "expense" | "income" | "transfer";

export interface ParsedReceiptData {
  success: boolean;
  provider: ReceiptProvider;
  direction: ReceiptDirection;
  amount: number;
  currency: string;
  reference?: string;
  counterparty?: string;
  accountOrWallet?: string;
  occurredAt: number;
  dateStr: string;
  confidence: number; // 0 to 100
  suggestedMemo: string;
  rawText: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingEvent?: {
    id: number;
    eventType: string;
    grossAmount: string;
    occurredAt: number;
    memo: string | null;
    externalRef: string | null;
  };
}

export interface ReceiptOcrAnalysisResult {
  parsed: ParsedReceiptData;
  duplicate: DuplicateCheckResult;
  warnings: string[];
}

/** Converts Eastern Arabic numerals (٠-٩) and decimal separators to standard Arabic numerals (0-9) */
export function normalizeReceiptNumerals(str: string): string {
  const eastern = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  let out = str || "";
  for (let i = 0; i < 10; i++) {
    out = out.replaceAll(eastern[i], String(i));
  }
  // Replace Arabic decimal separator ٫ with standard period .
  out = out.replaceAll("٫", ".");
  // Replace Arabic thousands separator ٬ with standard comma ,
  out = out.replaceAll("٬", ",");
  return out;
}

/** Parse numeric amount from string cleanly */
export function parseReceiptAmount(amountStr: string): number {
  if (!amountStr) return 0;
  const clean = normalizeReceiptNumerals(amountStr)
    .replace(/,/g, "")
    .replace(/[^\d.]/g, "")
    .trim();
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : Math.round(val * 100) / 100;
}

const ARABIC_MONTHS: Record<string, number> = {
  يناير: 0,
  فبراير: 1,
  مارس: 2,
  أبريل: 3,
  ابريل: 3,
  مايو: 4,
  يونيو: 5,
  يوليو: 6,
  أغسطس: 7,
  اغسطس: 7,
  سبتمبر: 8,
  أكتوبر: 9,
  اكتوبر: 9,
  نوفمبر: 10,
  ديسمبر: 11,
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** Extract and normalize date & timestamp from receipt text */
export function parseReceiptDate(text: string): { timestamp: number; dateStr: string } {
  const norm = normalizeReceiptNumerals(text);
  const now = Date.now();

  // Pattern 1: ISO or standard YYYY-MM-DD or DD/MM/YYYY with optional time
  // e.g., 2025-05-14 14:30 or 14/05/2025 02:30:15
  const dmyMatch = norm.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|ص|م)?)?/i);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;

    // Handle YYYY-MM-DD vs DD-MM-YYYY
    if (day > 1900 && month >= 0 && month <= 11) {
      // Swapped format: YYYY-MM-DD
      const tmp = day;
      day = parseInt(dmyMatch[3], 10);
      year = tmp;
    }

    let hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 12;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const meridiem = (dmyMatch[7] || "").toLowerCase();
    if ((meridiem === "pm" || meridiem === "م") && hours < 12) hours += 12;
    if ((meridiem === "am" || meridiem === "ص") && hours === 12) hours = 0;

    const parsed = new Date(year, month, day, hours, minutes);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
      return {
        timestamp: parsed.getTime(),
        dateStr: parsed.toISOString().slice(0, 16).replace("T", " "),
      };
    }
  }

  // Pattern 2: Arabic month name, e.g. "14 مايو 2025" or "14 May 2025 - 04:30 م"
  const arabicMonthRegex = new RegExp(
    `(\\d{1,2})\\s+(${Object.keys(ARABIC_MONTHS).join("|")})\\s+(\\d{4})(?:[\\s,-]+(\\d{1,2}):(\\d{2})\\s*(ص|م|am|pm)?)?`,
    "i"
  );
  const arMatch = norm.match(arabicMonthRegex);
  if (arMatch) {
    const day = parseInt(arMatch[1], 10);
    const monthKey = arMatch[2].toLowerCase();
    const month = ARABIC_MONTHS[monthKey] ?? 0;
    const year = parseInt(arMatch[3], 10);
    let hours = arMatch[4] ? parseInt(arMatch[4], 10) : 12;
    const minutes = arMatch[5] ? parseInt(arMatch[5], 10) : 0;
    const meridiem = (arMatch[6] || "").toLowerCase();
    if ((meridiem === "م" || meridiem === "pm") && hours < 12) hours += 12;
    if ((meridiem === "ص" || meridiem === "am") && hours === 12) hours = 0;

    const parsed = new Date(year, month, day, hours, minutes);
    if (!isNaN(parsed.getTime())) {
      return {
        timestamp: parsed.getTime(),
        dateStr: parsed.toISOString().slice(0, 16).replace("T", " "),
      };
    }
  }

  return {
    timestamp: now,
    dateStr: new Date(now).toISOString().slice(0, 16).replace("T", " "),
  };
}

/**
 * High-precision heuristic parser for Egyptian receipts:
 * 1. Instapay (IPN)
 * 2. Vodafone Cash & Telco Wallets
 * 3. NBE (Al Ahly Net / Mobile)
 * 4. CIB (Commercial International Bank)
 * 5. Telda
 * 6. Generic Egyptian Bank
 */
export function extractReceiptData(rawText: string): ParsedReceiptData {
  const norm = normalizeReceiptNumerals(rawText || "").trim();
  const { timestamp, dateStr } = parseReceiptDate(norm);

  const fallback: ParsedReceiptData = {
    success: false,
    provider: "Generic",
    direction: "expense",
    amount: 0,
    currency: "EGP",
    occurredAt: timestamp,
    dateStr,
    confidence: 0,
    suggestedMemo: "إيصال مالي",
    rawText,
  };

  if (!norm || norm.length < 5) return fallback;

  // 1. INSTAPAY (إنستاباي / شبكة المدفوعات اللحظية / IPN)
  if (/instapay|إنستاباي|انستاباي|ipn|شبكة المدفوعات اللحظية|معاملة إنستاباي/i.test(norm)) {
    // Reference extraction (Instapay RRN: 12 digits or explicit label)
    let reference: string | undefined;
    const refMatch =
      norm.match(/(?:الرقم المرجعي|مرجع المعاملة|رقم المعاملة|المرجع|rrn|reference\s*(?:no|id)?|txn\s*id)[\s:]*([A-Za-z0-9_-]{6,36})/i) ||
      norm.match(/\b(40\d{10}|50\d{10}|20\d{10}|\d{12})\b/);
    if (refMatch) reference = refMatch[1];

    // Direction: Inbound vs Outbound
    const isInbound = /تم استلام|وارد|استلام تحويل|received|deposit/i.test(norm);
    const direction: ReceiptDirection = isInbound ? "income" : "expense";

    // Amount extraction
    // Instapay receipts typically show: "مبلغ المعاملة: 1,500.00 EGP" or "EGP 1,500.00" or "١٬٥٠٠٫٠٠ جم"
    let amount = 0;
    const amtMatch =
      norm.match(/(?:مبلغ المعاملة|المبلغ|amount|transfer of|إجمالي المبلغ)[\s:]*(?:egp|جم|ج\.م)?\s*([0-9,.]+)/i) ||
      norm.match(/(?:egp|جم|ج\.م)\s*([0-9,.]+)/i) ||
      norm.match(/([0-9,.]+)\s*(?:جم|ج\.م|egp|جنيه)/i);
    if (amtMatch) amount = parseReceiptAmount(amtMatch[1]);

    // Counterparty & Account/IPA
    let counterparty: string | undefined;
    let accountOrWallet: string | undefined;

    // IPA format e.g. username@instapay
    const ipaMatch = norm.match(/([a-zA-Z0-9._-]+@instapay)/i);
    if (ipaMatch) accountOrWallet = ipaMatch[1];

    if (isInbound) {
      const fromMatch = norm.match(/(?:من|from|اسم المحول)[\s:]+([^\n\r.]+?)(?:\s+(?:عبر|بواسطة|إلى|to|الرقم|ref)|$|\n)/i);
      if (fromMatch) counterparty = fromMatch[1].replace(/بنجاح/g, "").trim();
    } else {
      const toMatch = norm.match(/(?:إلى|الي|to|المستفيد|اسم المستفيد)[\s:]+([^\n\r.]+?)(?:\s+(?:عبر|بواسطة|من|from|الرقم|ref)|$|\n)/i);
      if (toMatch) counterparty = toMatch[1].replace(/بنجاح/g, "").trim();
    }

    const memoTitle = isInbound
      ? `تحويل إنستاباي وارد${counterparty ? ` من ${counterparty}` : ""}`
      : `تحويل إنستاباي صادر${counterparty ? ` إلى ${counterparty}` : ""}`;
    const suggestedMemo = reference ? `${memoTitle} [مرجع: ${reference}]` : memoTitle;

    return {
      success: amount > 0,
      provider: "Instapay",
      direction,
      amount,
      currency: "EGP",
      reference,
      counterparty,
      accountOrWallet,
      occurredAt: timestamp,
      dateStr,
      confidence: amount > 0 && reference ? 95 : 85,
      suggestedMemo,
      rawText,
    };
  }

  // 2. VODAFONE CASH & MOBILE WALLETS (فودافون كاش / أورنج كاش / اتصالات كاش / وي باي)
  if (
    /vodafone|فودافون|أورنج كاش|orange cash|اتصالات كاش|etisalat cash|e& cash|وي باي|we pay|محفظة|smart wallet/i.test(norm) ||
    (/01[0125]\d{8}/.test(norm) && /كاش|تحويل|جنيه/.test(norm))
  ) {
    let reference: string | undefined;
    const refMatch = norm.match(/(?:رقم العملية|كود المعاملة|transaction\s*id|txn)[\s:]*([A-Za-z0-9]{6,20})/i);
    if (refMatch) reference = refMatch[1];

    // Mobile wallet number
    let accountOrWallet: string | undefined;
    const phoneMatch = norm.match(/\b(01[0125]\d{8})\b/);
    if (phoneMatch) accountOrWallet = phoneMatch[1];

    // Direction: Inbound vs Outbound
    const isInbound = /تم استلام|استلمت|وارد|received|إيداع/i.test(norm);
    const direction: ReceiptDirection = isInbound ? "income" : "expense";

    // Amount
    let amount = 0;
    const amtMatch =
      norm.match(/(?:تحويل|مبلغ|amount|خصم|قيمة|سحب)?\s*([0-9,.]+)\s*(?:جنيه|جم|ج\.م|egp)/i) ||
      norm.match(/(?:egp|جنيه|جم)\s*([0-9,.]+)/i);
    if (amtMatch) amount = parseReceiptAmount(amtMatch[1]);

    let counterparty = accountOrWallet ? `محفظة ${accountOrWallet}` : undefined;
    const nameMatch = norm.match(/(?:إلى|الي|من|to|from)[\s:]+([^\n\r.]+?)(?:\s+(?:بنجاح|رقم|كود)|$|\n)/i);
    if (nameMatch && !/^\d+$/.test(nameMatch[1].trim())) {
      counterparty = nameMatch[1].trim();
    }

    const providerName: ReceiptProvider = /orange/i.test(norm) || /أورنج/.test(norm)
      ? "Generic"
      : /etisalat|اتصالات/i.test(norm)
      ? "Generic"
      : "Vodafone Cash";

    const memoTitle = isInbound
      ? `إيداع / استلام محفظة إلكترونية${counterparty ? ` (${counterparty})` : ""}`
      : `سداد / تحويل محفظة إلكترونية${counterparty ? ` إلى ${counterparty}` : ""}`;
    const suggestedMemo = reference ? `${memoTitle} [عملية: ${reference}]` : memoTitle;

    return {
      success: amount > 0,
      provider: providerName,
      direction,
      amount,
      currency: "EGP",
      reference,
      counterparty,
      accountOrWallet,
      occurredAt: timestamp,
      dateStr,
      confidence: amount > 0 ? 90 : 80,
      suggestedMemo,
      rawText,
    };
  }

  // 3. NBE (البنك الأهلي المصري - Al Ahly Net / Mobile)
  if (/الأهلي|البنك الأهلي|al ahly|ahly net|nbe|national bank of egypt/i.test(norm)) {
    let reference: string | undefined;
    const refMatch = norm.match(/(?:رقم المعاملة|الرقم المرجعي|مرجع|transaction\s*ref|reference)[\s:]*([A-Za-z0-9]{8,24})/i);
    if (refMatch) reference = refMatch[1];

    let accountOrWallet: string | undefined;
    const accMatch = norm.match(/(?:حساب رقم|من حساب|إلى حساب|account)[\s:]*([*\d]{4,20})/i);
    if (accMatch) accountOrWallet = accMatch[1];

    let amount = 0;
    const amtMatch =
      norm.match(/(?:المبلغ|amount|قيمة المعاملة)[\s:]*(?:egp|جم|ج\.م)?\s*([0-9,.]+)/i) ||
      norm.match(/(?:egp|جم|ج\.م)\s*([0-9,.]+)/i) ||
      norm.match(/([0-9,.]+)\s*(?:جم|ج\.م|egp|جنيه)/i);
    if (amtMatch) amount = parseReceiptAmount(amtMatch[1]);

    const isInbound = /إيداع|وارد|استلام|credit/i.test(norm);
    const direction: ReceiptDirection = isInbound ? "income" : "expense";

    let counterparty: string | undefined;
    const benefMatch = norm.match(/(?:المستفيد|اسم المستفيد|beneficiary)[\s:]+([^\n\r.]+?)(?:\s+(?:حساب|رقم|$|\n))/i);
    if (benefMatch) counterparty = benefMatch[1].trim();

    const memoTitle = `معاملة البنك الأهلي المصري (NBE)${counterparty ? ` - ${counterparty}` : ""}`;
    const suggestedMemo = reference ? `${memoTitle} [مرجع: ${reference}]` : memoTitle;

    return {
      success: amount > 0,
      provider: "NBE",
      direction,
      amount,
      currency: "EGP",
      reference,
      counterparty,
      accountOrWallet,
      occurredAt: timestamp,
      dateStr,
      confidence: amount > 0 ? 92 : 80,
      suggestedMemo,
      rawText,
    };
  }

  // 4. CIB (Commercial International Bank / Smart Wallet)
  if (/cib|البنك التجاري الدولي|commercial international bank/i.test(norm)) {
    let reference: string | undefined;
    const refMatch = norm.match(/(?:transaction\s*id|reference|رقم المرجع|رقم العملية)[\s:]*([A-Za-z0-9_-]{6,36})/i);
    if (refMatch) reference = refMatch[1];

    let amount = 0;
    const amtMatch =
      norm.match(/(?:amount|مبلغ|إجمالي)[\s:]*(?:egp|جم)?\s*([0-9,.]+)/i) ||
      norm.match(/(?:egp|جم)\s*([0-9,.]+)/i) ||
      norm.match(/([0-9,.]+)\s*(?:egp|جم|جنيه)/i);
    if (amtMatch) amount = parseReceiptAmount(amtMatch[1]);

    const isInbound = /credit|إيداع|وارد/i.test(norm);
    const direction: ReceiptDirection = isInbound ? "income" : "expense";

    let counterparty: string | undefined;
    const benefMatch = norm.match(/(?:to|beneficiary|إلى|المستفيد)[\s:]+([^\n\r]+)/i);
    if (benefMatch) {
      counterparty = benefMatch[1].replace(/(?:account|ref|transaction).*$/i, "").trim();
    }

    const memoTitle = `معاملة CIB بنكية${counterparty ? ` - ${counterparty}` : ""}`;
    const suggestedMemo = reference ? `${memoTitle} [مرجع: ${reference}]` : memoTitle;

    return {
      success: amount > 0,
      provider: "CIB",
      direction,
      amount,
      currency: "EGP",
      reference,
      counterparty,
      occurredAt: timestamp,
      dateStr,
      confidence: amount > 0 ? 92 : 80,
      suggestedMemo,
      rawText,
    };
  }

  // 5. TELDA (تيلدا)
  if (/telda|تيلدا|@telda/i.test(norm)) {
    let reference: string | undefined;
    const refMatch = norm.match(/(?:transaction\s*id|رقم العملية|reference)[\s:]*([A-Za-z0-9-]{6,36})/i);
    if (refMatch) reference = refMatch[1];

    let counterparty: string | undefined;
    const userMatch = norm.match(/@([A-Za-z0-9_]+)/i);
    if (userMatch) counterparty = `@${userMatch[1]}`;

    let amount = 0;
    const amtMatch =
      norm.match(/(?:amount|مبلغ)?\s*(?:egp|جم)?\s*([0-9,.]+)\s*(?:egp|جم|جنيه)?/i);
    if (amtMatch) amount = parseReceiptAmount(amtMatch[1]);

    const isInbound = /received|استلام|وارد/i.test(norm);
    const direction: ReceiptDirection = isInbound ? "income" : "expense";

    const memoTitle = `تحويل تيلدا (Telda)${counterparty ? ` مع ${counterparty}` : ""}`;
    const suggestedMemo = reference ? `${memoTitle} [ID: ${reference}]` : memoTitle;

    return {
      success: amount > 0,
      provider: "Telda",
      direction,
      amount,
      currency: "EGP",
      reference,
      counterparty,
      occurredAt: timestamp,
      dateStr,
      confidence: amount > 0 ? 90 : 75,
      suggestedMemo,
      rawText,
    };
  }

  // 6. GENERIC EGYPTIAN BANK / FINANCIAL RECEIPT FALLBACK
  let genericAmount = 0;
  const genAmtMatch =
    norm.match(/(?:مبلغ|amount|إجمالي|total|egp|جم|ج\.م)\s*([0-9,.]+)/i) ||
    norm.match(/([0-9,.]+)\s*(?:جم|ج\.م|egp|جنيه)/i);
  if (genAmtMatch) genericAmount = parseReceiptAmount(genAmtMatch[1]);

  let genericRef: string | undefined;
  const genRefMatch = norm.match(/(?:مرجع|مرجعي|reference|ref|رقم العملية|transaction\s*id)[\s:]*([A-Za-z0-9]{6,24})/i);
  if (genRefMatch) genericRef = genRefMatch[1];

  const suggestedMemo = genericRef
    ? `إيصال مصرفي مسحوب [مرجع: ${genericRef}]`
    : `إيصال مصرفي مسحوب ضوئياً`;

  return {
    success: genericAmount > 0,
    provider: "Generic",
    direction: "expense",
    amount: genericAmount,
    currency: "EGP",
    reference: genericRef,
    occurredAt: timestamp,
    dateStr,
    confidence: genericAmount > 0 ? 70 : 30,
    suggestedMemo,
    rawText,
  };
}

/** Check if this transaction reference already exists in the family ledger */
export async function checkReceiptDuplicate(
  workspaceId: number,
  reference?: string
): Promise<DuplicateCheckResult> {
  if (!reference || reference.trim().length < 4) {
    return { isDuplicate: false };
  }

  const cleanRef = reference.trim();
  const db = await getDb();
  if (!db) return { isDuplicate: false };

  try {
    const [existing] = await db
      .select({
        id: financialEvents.id,
        eventType: financialEvents.eventType,
        grossAmount: financialEvents.grossAmount,
        occurredAt: financialEvents.occurredAt,
        memo: financialEvents.memo,
        externalRef: financialEvents.externalRef,
      })
      .from(financialEvents)
      .where(
        and(
          eq(financialEvents.workspaceId, workspaceId),
          or(
            eq(financialEvents.externalRef, cleanRef),
            like(financialEvents.memo, `%${cleanRef}%`),
            like(financialEvents.idempotencyKey, `%${cleanRef}%`)
          )
        )
      )
      .limit(1);

    if (existing) {
      return {
        isDuplicate: true,
        existingEvent: existing,
      };
    }
  } catch (err) {
    console.warn("[ReceiptOCR] Duplicate check query notice:", err);
  }

  return { isDuplicate: false };
}

/**
 * Perform Optical Character Recognition (OCR) directly from in-memory Image Buffer.
 * ZERO disk file writes ensures complete privacy and compliance.
 */
export async function performReceiptOcr(imageBuffer: Buffer): Promise<string> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker(["ara", "eng"], 1, {
      errorHandler: (err) => console.warn("[Tesseract OCR Worker Notice]:", err),
    });

    // Timeout guard: 12 seconds max for OCR worker
    const ocrPromise = (async () => {
      const result = await worker.recognize(imageBuffer);
      await worker.terminate();
      return result.data.text || "";
    })();

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error("OCR_TIMEOUT")), 12000)
    );

    return await Promise.race([ocrPromise, timeoutPromise]);
  } catch (err: any) {
    console.warn("[ReceiptOCR] Tesseract worker execution notice:", err?.message || err);
    return "";
  }
}

/**
 * Main service endpoint for Receipt OCR & Financial Template Extraction
 */
export async function analyzeReceiptImage(params: {
  workspaceId: number;
  imageBase64?: string;
  rawTextFallback?: string;
}): Promise<ReceiptOcrAnalysisResult> {
  let recognizedText = params.rawTextFallback || "";
  const warnings: string[] = [];

  // In-memory buffer conversion from base64
  if (params.imageBase64 && params.imageBase64.length > 50) {
    try {
      const cleanBase64 = params.imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
      const imageBuffer = Buffer.from(cleanBase64, "base64");
      
      const ocrResult = await performReceiptOcr(imageBuffer);
      if (ocrResult.trim().length > 0) {
        recognizedText = recognizedText ? `${recognizedText}\n${ocrResult}` : ocrResult;
      } else if (!recognizedText) {
        warnings.push("لم يتمكن محرك القراءة الضوئية من استخراج نصوص واضحة من لقطة الشاشة. يرجى التأكد من وضوح الصورة.");
      }
    } catch (err: any) {
      warnings.push("تعذر معالجة لقطة الشاشة في الذاكرة: " + (err?.message || "خطأ غير معروف"));
    }
  }

  const parsed = extractReceiptData(recognizedText);

  // Check duplicate reference in the ledger
  const duplicate = await checkReceiptDuplicate(params.workspaceId, parsed.reference);
  if (duplicate.isDuplicate) {
    warnings.push(`تحذير تكرار: الرقم المرجعي (${parsed.reference}) مسجل مسبقاً في الدفاتر المحاسبية برقم قيد #${duplicate.existingEvent?.id}.`);
  }

  return {
    parsed,
    duplicate,
    warnings,
  };
}
