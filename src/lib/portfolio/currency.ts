/**
 * The app never converts currencies. A portfolio has exactly one currency and
 * every value is assumed to be entered in it.
 */
export const COMMON_CURRENCIES = [
  "USD", "EUR", "GBP", "ILS", "JPY", "CHF", "CAD", "AUD", "NZD", "SEK",
  "NOK", "DKK", "PLN", "CZK", "HKD", "SGD", "INR", "CNY", "KRW", "BRL",
  "MXN", "ZAR",
] as const;

export function isValidCurrencyCode(code: unknown): code is string {
  if (typeof code !== "string" || !/^[A-Z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: code });
    return true;
  } catch {
    return false;
  }
}

export function currencyName(code: string): string {
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "currency" });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}
