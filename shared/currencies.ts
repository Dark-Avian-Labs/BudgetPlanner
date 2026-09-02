export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK'] as const;
export type AllowedCurrency = (typeof CURRENCIES)[number];
