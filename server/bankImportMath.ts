import { createHash } from "node:crypto";
import Decimal from "decimal.js";

export type CsvColumnMapping = {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn?: string | null;
  debitColumn?: string | null;
  creditColumn?: string | null;
  referenceColumn?: string | null;
};

export type ParsedCsv = { headers: string[]; rows: Record<string, string>[]; delimiter: string };
export type ParsedBankRow = {
  sourceRowNumber: number;
  rawData: Record<string, string>;
  occurredAt: number | null;
  description: string | null;
  amount: string | null;
  externalRef: string | null;
  classification: "income" | "expense" | "transfer" | "ignore" | "unclassified";
  matchStatus: "new" | "invalid";
  reviewNote: string | null;
  idempotencyKey: string;
};

function detectDelimiter(line: string) {
  const candidates = [",", ";", "\t"];
  return candidates.reduce((best, candidate) => (line.split(candidate).length > line.split(best).length ? candidate : best), ",");
}

function parseMatrix(input: string, delimiter: string) {
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"') {
      if (quoted && next === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(value => value.length > 0)) matrix.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(value => value.length > 0)) matrix.push(row);
  if (quoted) throw new Error("ملف CSV يحتوي على علامات اقتباس غير مكتملة.");
  return matrix;
}

export function parseCsv(content: string): ParsedCsv {
  const clean = content.replace(/^\uFEFF/, "");
  if (!clean.trim()) throw new Error("ملف CSV فارغ.");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const matrix = parseMatrix(clean, delimiter);
  if (matrix.length < 2) throw new Error("يجب أن يحتوي الملف على عنوان أعمدة وصف واحد على الأقل.");
  const headers = matrix[0].map((header, index) => header.trim() || `عمود ${index + 1}`);
  if (new Set(headers).size !== headers.length) throw new Error("عناوين أعمدة CSV يجب أن تكون فريدة.");
  return { headers, delimiter, rows: matrix.slice(1).map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))) };
}

function parseSignedAmount(value: string) {
  let text = value.trim().replace(/[\u00A0\s]/g, "");
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text) || text.startsWith("-") || text.endsWith("-");
  text = text.replace(/[()\-+]/g, "").replace(/[^0-9,\.]/g, "");
  if (!text || !/[0-9]/.test(text)) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    const decimalMark = lastComma > lastDot ? "," : ".";
    const grouping = decimalMark === "," ? /\./g : /,/g;
    text = text.replace(grouping, "").replace(decimalMark, ".");
  } else if (lastComma !== -1) {
    const tail = text.length - lastComma - 1;
    text = tail <= 2 ? text.replace(",", ".") : text.replace(/,/g, "");
  } else if (lastDot !== -1) {
    const tail = text.length - lastDot - 1;
    if (tail > 2) text = text.replace(/\./g, "");
  }
  try { return new Decimal(text).mul(negative ? -1 : 1); } catch { return null; }
}

export function parseBankDate(value: string) {
  const text = value.trim();
  if (!text) return null;
  const iso = /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/.exec(text);
  const european = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(text);
  let year: number; let month: number; let day: number;
  if (iso) [, year, month, day] = iso.map(Number) as [string, number, number, number];
  else if (european) [, day, month, year] = european.map(Number) as [string, number, number, number];
  else return null;
  const instant = Date.UTC(year, month - 1, day);
  const verify = new Date(instant);
  return verify.getUTCFullYear() === year && verify.getUTCMonth() === month - 1 && verify.getUTCDate() === day ? instant : null;
}

function ensureColumn(headers: string[], column: string | null | undefined, label: string, required = false) {
  if (!column && !required) return;
  if (!column || !headers.includes(column)) throw new Error(`عمود ${label} غير موجود في ملف CSV.`);
}

export function validateColumnMapping(headers: string[], mapping: CsvColumnMapping) {
  ensureColumn(headers, mapping.dateColumn, "التاريخ", true);
  ensureColumn(headers, mapping.descriptionColumn, "الوصف", true);
  ensureColumn(headers, mapping.amountColumn, "المبلغ");
  ensureColumn(headers, mapping.debitColumn, "الخصم");
  ensureColumn(headers, mapping.creditColumn, "الإيداع");
  ensureColumn(headers, mapping.referenceColumn, "المرجع");
  if (!mapping.amountColumn && !mapping.debitColumn && !mapping.creditColumn) throw new Error("اختر عمود مبلغ واحداً أو عمودي خصم وإيداع.");
}

export function buildImportRows(args: { rows: Record<string, string>[]; mapping: CsvColumnMapping; contentHash: string }) {
  return args.rows.map((rawData, index): ParsedBankRow => {
    const occurredAt = parseBankDate(rawData[args.mapping.dateColumn] ?? "");
    const description = (rawData[args.mapping.descriptionColumn] ?? "").trim().slice(0, 2_000) || null;
    const directAmount = args.mapping.amountColumn ? parseSignedAmount(rawData[args.mapping.amountColumn] ?? "") : null;
    const debit = args.mapping.debitColumn ? parseSignedAmount(rawData[args.mapping.debitColumn] ?? "") : null;
    const credit = args.mapping.creditColumn ? parseSignedAmount(rawData[args.mapping.creditColumn] ?? "") : null;
    const amount = directAmount ?? (credit ?? new Decimal(0)).minus(debit?.abs() ?? 0);
    const externalRef = args.mapping.referenceColumn ? (rawData[args.mapping.referenceColumn] ?? "").trim().slice(0, 160) || null : null;
    const invalid = !occurredAt || !description || !amount || amount.eq(0);
    const idempotencyKey = createHash("sha256").update(`${args.contentHash}:${index + 2}:${occurredAt ?? "invalid"}:${amount?.toFixed(6) ?? "invalid"}:${externalRef ?? description ?? ""}`).digest("hex");
    return {
      sourceRowNumber: index + 2, rawData, occurredAt, description, amount: amount?.toFixed(6) ?? null, externalRef,
      classification: invalid ? "unclassified" : amount!.gt(0) ? "income" : "expense",
      matchStatus: invalid ? "invalid" : "new",
      reviewNote: invalid ? "تحقق من التاريخ والوصف والمبلغ قبل الترحيل." : null,
      idempotencyKey,
    };
  });
}

export function sha256(content: string) { return createHash("sha256").update(content).digest("hex"); }

export function detectDuplicate(args: { row: Pick<ParsedBankRow, "occurredAt" | "amount" | "externalRef" | "classification">; events: Array<{ id: number; externalRef: string | null; occurredAt: number; grossAmount: string; eventType: string }> }) {
  if (args.row.externalRef) {
    const exact = args.events.find(event => event.externalRef === args.row.externalRef);
    if (exact) return { status: "exact_duplicate" as const, eventId: exact.id };
  }
  if (!args.row.occurredAt || !args.row.amount) return { status: "invalid" as const, eventId: null };
  const amount = new Decimal(args.row.amount).abs();
  const expectedTypes = args.row.classification === "income" ? ["income", "deposit"] : args.row.classification === "expense" ? ["expense", "withdrawal"] : [];
  const possible = args.events.find(event => expectedTypes.includes(event.eventType) && Math.abs(event.occurredAt - args.row.occurredAt!) <= 2 * 86_400_000 && new Decimal(event.grossAmount).eq(amount));
  return possible ? { status: "possible_duplicate" as const, eventId: possible.id } : { status: "new" as const, eventId: null };
}
