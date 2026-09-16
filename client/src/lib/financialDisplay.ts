export const DEFAULT_CURRENCY = "EGP";

export function normalizeCurrency(currency?: string | null) {
  const normalized = String(currency ?? DEFAULT_CURRENCY).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_CURRENCY;
}

export function formatMoney(
  value: number | string | null | undefined,
  currency?: string | null,
  maximumFractionDigits = 2
) {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const safeCurrency = normalizeCurrency(currency);
  try {
    const formattedNumber = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: maximumFractionDigits,
      maximumFractionDigits,
    }).format(safeAmount);
    return `${safeCurrency} ${formattedNumber}`;
  } catch {
    return `${safeCurrency} ${safeAmount.toFixed(maximumFractionDigits)}`;
  }
}

export const PRIVATE_VALUE_PLACEHOLDER = "••••••";

function parseValidDate(val: Date | number | string | null | undefined): Date | null {
  if (val === null || val === undefined || val === "") return null;
  const d = val instanceof Date ? val : new Date(typeof val === "string" && /^\d+$/.test(val) ? Number(val) : val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Standard international date format: DD/MM/YYYY (e.g. 15/09/2026).
 * Enforces strict English LTR numerals to eliminate Arabic numeral inversion.
 */
export function formatStandardDate(date: Date | number | string | null | undefined): string {
  const d = parseValidDate(date);
  if (!d) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export const formatDate = formatStandardDate;

/**
 * Standard international timestamp format: DD/MM/YYYY hh:mm A (e.g. 15/09/2026 10:15 AM).
 */
export function formatFullTimestamp(date: Date | number | string | null | undefined): string {
  const d = parseValidDate(date);
  if (!d) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const strHours = String(hours).padStart(2, "0");

  return `${day}/${month}/${year} ${strHours}:${minutes} ${ampm}`;
}

export const formatDateTime = formatFullTimestamp;

/**
 * Standard English short month abbreviation: Jan, Feb, Mar, etc.
 */
export function formatShortMonth(date: Date | number | string | null | undefined): string {
  const d = parseValidDate(date);
  if (!d) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[d.getMonth()] || "";
}
