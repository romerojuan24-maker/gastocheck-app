export const CURRENCIES = {
  MXN: { symbol: '$', name: 'Mexican Peso', locale: 'es-MX' },
  BRL: { symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  EUR: { symbol: '€', name: 'Euro', locale: 'es-ES' },
  ARS: { symbol: '$', name: 'Argentine Peso', locale: 'es-AR' },
  COP: { symbol: '$', name: 'Colombian Peso', locale: 'es-CO' },
  CLP: { symbol: '$', name: 'Chilean Peso', locale: 'es-CL' },
  PEN: { symbol: 'S/', name: 'Peruvian Sol', locale: 'es-PE' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = 'MXN'
): string {
  const currencyInfo = CURRENCIES[currency];
  if (!currencyInfo) return `${amount}`;

  return new Intl.NumberFormat(currencyInfo.locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

export function getCurrencySymbol(currency: CurrencyCode = 'MXN'): string {
  return CURRENCIES[currency]?.symbol ?? '$';
}
