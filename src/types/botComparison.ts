export interface ComparisonTableItems {
  botId: string | undefined;
  botName: string;
  trades?: string;
  profitClosed: number;
  profitClosedRatio?: number;
  profitOpen: number;
  profitOpenRatio?: number;
  /** profitOpenRatio is relative to exchange-posted margin (see utils/openProfit.ts) */
  profitOpenOnExchangeMargin?: boolean;
  stakeCurrency: string;
  wins: number;
  losses: number;
  balance: number;
  stakeCurrencyDecimals?: number;
  isDryRun?: boolean;
  isLoggedIn?: boolean;
  isOnline?: boolean;
  balanceAppendix: string;
}
