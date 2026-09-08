export const DEFAULT_CURRENCY = "EGP";

export function normalizeCurrency(currency?: string | null) {
  const normalized = String(currency ?? DEFAULT_CURRENCY).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_CURRENCY;
}

export function formatMoney(value: number | string | null | undefined, currency?: string | null, maximumFractionDigits = 2) {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const safeCurrency = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits,
    }).format(safeAmount);
  } catch {
    return `${safeAmount.toFixed(maximumFractionDigits)} ${safeCurrency}`;
  }
}

export const PRIVATE_VALUE_PLACEHOLDER = "••••••";
