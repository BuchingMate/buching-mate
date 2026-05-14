export type Money = {
  amount: number; // minor units (cents for USD/EUR, whole units for JPY)
  currency: string; // ISO 4217
};

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "HUF", "TWD", "CLP", "ISK"]);

export function decimals(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}

export function toMinorUnits(major: string, currency: string): number {
  const trimmed = major.trim();
  if (trimmed === "") return 0;
  const factor = 10 ** decimals(currency);
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`invalid money value: ${major}`);
  }
  return Math.round(parsed * factor);
}

export function toMajorString(money: Money): string {
  const factor = 10 ** decimals(money.currency);
  if (factor === 1) return String(money.amount);
  const sign = money.amount < 0 ? "-" : "";
  const abs = Math.abs(money.amount);
  const whole = Math.floor(abs / factor);
  const frac = abs % factor;
  return `${sign}${whole}.${String(frac).padStart(decimals(money.currency), "0")}`;
}

export function toDecimalString(money: Money): string {
  return toMajorString(money);
}

export function formatDisplay(money: Money, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
  }).format(money.amount / 10 ** decimals(money.currency));
}

export function isSameCurrency(a: Money, b: Money): boolean {
  return a.currency.toUpperCase() === b.currency.toUpperCase();
}
