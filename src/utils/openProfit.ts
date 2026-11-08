import type { Trade } from '@/types';

/**
 * Aggregation of open-trade profit.
 *
 * Every open trade contributes a profit amount (numerator) and a capital basis (weight):
 *
 * - Default (any bot without exchange position data - spot, cross / plain isolated futures,
 *   any exchange, any API version):
 *     profit = (total_profit_ratio ?? profit_ratio ?? 0) * stake_amount
 *     basis  = stake_amount
 *   This is FreqUI's historic rule, kept operation for operation so the result stays identical.
 *
 * - Exchange-reported margin (freqtrade `exchange.futures_balance_from_exchange`, API >= 2.50,
 *   trade carries a positive, finite `exchange_margin`):
 *     profit = total_profit_abs ?? profit_abs ?? 0
 *     basis  = exchange_margin
 *   With margin added after entry (isolated auto-margin / manual add-margin), freqtrade's
 *   profit ratios stay relative to the original margin while the stake shown can include the
 *   added margin - weighting such a ratio by that stake counts the loss several times.
 *   Freqtrade's own absolute profit (incl. fees, funding and realized partial exits - the same
 *   value the "Open Profit" amount shows) divided by the margin actually posted on the
 *   exchange is the return on the capital that is really at stake.
 *   `exchange_unrealized_pnl` is NOT used as numerator: it excludes fees and funding and would
 *   disagree with the absolute open profit displayed next to the ratio.
 *
 * Trades are classified one by one, so a bot whose exchange reports no position for some
 * trades (not yet filled, liquidated) still gets a coherent ratio.
 */
export interface OpenProfitContribution {
  /** Profit in stake currency */
  profit: number;
  /** Capital the profit is relative to, in stake currency */
  basis: number;
}

/** Margin posted on the exchange for this trade, if reported and usable as a ratio basis. */
export function exchangeMarginBasis(trade: Trade): number | undefined {
  const margin = trade.exchange_margin;
  return typeof margin === 'number' && Number.isFinite(margin) && margin > 0 ? margin : undefined;
}

/** True if the trade carries any of the exchange position fields. */
export function hasExchangePositionFields(trade: Trade): boolean {
  return (
    trade.exchange_margin !== undefined ||
    trade.exchange_extra_margin !== undefined ||
    trade.exchange_unrealized_pnl !== undefined ||
    trade.exchange_liquidation_price !== undefined
  );
}

/** Absolute open profit of a trade, including realized profit of partial exits. */
export function tradeOpenProfitAbs(trade: Trade): number {
  return trade.total_profit_abs ?? trade.profit_abs ?? 0;
}

export function openProfitContribution(trade: Trade): OpenProfitContribution {
  const margin = exchangeMarginBasis(trade);
  if (margin !== undefined) {
    return { profit: tradeOpenProfitAbs(trade), basis: margin };
  }
  return {
    profit: (trade.total_profit_ratio ?? trade.profit_ratio ?? 0) * trade.stake_amount,
    basis: trade.stake_amount,
  };
}

/**
 * Profit of a single trade relative to the margin posted on the exchange.
 * undefined if the exchange reports no usable margin for the trade.
 */
export function tradeProfitRatioOnExchangeMargin(trade: Trade): number | undefined {
  const margin = exchangeMarginBasis(trade);
  return margin === undefined ? undefined : tradeOpenProfitAbs(trade) / margin;
}

/** True if at least one trade's ratio basis is the exchange-posted margin. */
export function usesExchangeMarginBasis(trades: Trade[]): boolean {
  return trades.some((trade) => exchangeMarginBasis(trade) !== undefined);
}

/** Sum of the absolute open profit of all trades. */
export function openProfitAbs(trades: Trade[]): number {
  return trades.reduce((a, b) => a + tradeOpenProfitAbs(b), 0);
}

/**
 * Open profit ratio of a set of trades: sum(profit) / sum(basis).
 * undefined if there is no positive, finite basis (no open trades) - never NaN or Infinity.
 */
export function openProfitRatio(trades: Trade[]): number | undefined {
  let profit = 0;
  let basis = 0;
  for (const trade of trades) {
    const c = openProfitContribution(trade);
    profit = profit + c.profit;
    basis = basis + c.basis;
  }
  const ratio = profit / basis;
  return basis > 0 && Number.isFinite(ratio) ? ratio : undefined;
}
