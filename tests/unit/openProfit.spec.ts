import type { Trade } from '@/types';
import {
  exchangeMarginBasis,
  hasExchangePositionFields,
  openProfitAbs,
  openProfitContribution,
  openProfitRatio,
  tradeProfitRatioOnExchangeMargin,
  usesExchangeMarginBasis,
} from '@/utils/openProfit';
import { describe, expect, it } from 'vitest';

/**
 * Verbatim copy of the rule FreqUI used before exchange-margin support
 * (BotComparisonList.vue). Every fixture without exchange fields must reproduce it exactly.
 */
function legacyOpenProfitRatio(trades: Trade[]): number {
  const allStakes = trades.reduce((a, b) => a + b.stake_amount, 0);
  return (
    trades.reduce((a, b) => a + (b.total_profit_ratio ?? b.profit_ratio ?? 0) * b.stake_amount, 0) /
    allStakes
  );
}
function legacyOpenProfitAbs(trades: Trade[]): number {
  return trades.reduce((a, b) => a + (b.total_profit_abs ?? b.profit_abs ?? 0), 0);
}

let nextId = 1;
function makeTrade(overrides: Partial<Trade>): Trade {
  const id = nextId++;
  return {
    botId: 'ftbot.1',
    botTradeId: `ftbot.1__${id}`,
    botName: 'bot',
    trade_id: id,
    pair: 'BTC/USDT:USDT',
    is_open: true,
    amount: 1,
    stake_amount: 100,
    timeframe: '5m',
    open_rate: 100,
    open_date: '2026-11-08 00:00:00',
    open_timestamp: 1794096000000,
    fee_open: 0.0005,
    profit_ratio: 0,
    profit_pct: 0,
    profit_abs: 0,
    stop_loss_abs: 0,
    stop_loss_ratio: -0.1,
    stop_loss_pct: -10,
    ...overrides,
  };
}

// --- Fixtures without exchange_* fields (older API, spot, other exchanges, option off) ---

const spotBot = [
  makeTrade({
    pair: 'BTC/USDT',
    trading_mode: 'spot',
    stake_amount: 100,
    profit_ratio: 0.031,
    profit_abs: 3.1,
  }),
  makeTrade({
    pair: 'ETH/USDT',
    trading_mode: 'spot',
    stake_amount: 50,
    profit_ratio: -0.0137,
    profit_abs: -0.685,
  }),
];

const isolatedFuturesBot = [
  makeTrade({
    trading_mode: 'futures',
    leverage: 10,
    stake_amount: 20,
    profit_ratio: 0.215,
    profit_abs: 4.3,
    total_profit_ratio: 0.215,
    total_profit_abs: 4.3,
  }),
  makeTrade({
    pair: 'SOL/USDT:USDT',
    trading_mode: 'futures',
    leverage: 5,
    stake_amount: 33.3,
    profit_ratio: -0.4421,
    profit_abs: -14.722,
    total_profit_ratio: -0.4421,
    total_profit_abs: -14.722,
  }),
];

// Cross margin: stake per trade, profit relative to stake - same shape as isolated.
const crossFuturesBot = [
  makeTrade({
    trading_mode: 'futures',
    leverage: 3,
    stake_amount: 70.7,
    profit_ratio: 0.0123,
    profit_abs: 0.86961,
  }),
  makeTrade({
    pair: 'XRP/USDT:USDT',
    trading_mode: 'futures',
    leverage: 3,
    stake_amount: 12.1,
    profit_ratio: 0.1,
    profit_abs: 1.21,
  }),
];

// DCA with partial exits: total_profit_* includes realized profit and differs from profit_*.
const dcaPartialExitBot = [
  makeTrade({
    stake_amount: 61.4,
    max_stake_amount: 150,
    profit_ratio: -0.05,
    profit_abs: -3.07,
    realized_profit: 7.5,
    total_profit_ratio: 0.0295,
    total_profit_abs: 4.43,
    nr_of_successful_entries: 3,
    nr_of_successful_exits: 2,
  }),
  makeTrade({ pair: 'ADA/USDT', stake_amount: 10, profit_ratio: 0.02, profit_abs: 0.2 }),
];

const shortBot = [
  makeTrade({
    is_short: true,
    trading_mode: 'futures',
    leverage: 2,
    stake_amount: 45,
    profit_ratio: 0.0733,
    profit_abs: 3.2985,
    total_profit_ratio: 0.0733,
    total_profit_abs: 3.2985,
  }),
  makeTrade({
    is_short: true,
    pair: 'DOGE/USDT:USDT',
    trading_mode: 'futures',
    leverage: 2,
    stake_amount: 15,
    profit_ratio: -0.2,
    profit_abs: -3,
  }),
];

// Older API: no total_profit_* and profit_ratio may be null.
const oldApiBot = [
  makeTrade({ stake_amount: 0.01, profit_ratio: null, profit_abs: undefined }),
  makeTrade({ stake_amount: 0.03, profit_ratio: 0.017, profit_abs: 0.00051 }),
];

const normalBots: Record<string, Trade[]> = {
  spotBot,
  isolatedFuturesBot,
  crossFuturesBot,
  dcaPartialExitBot,
  shortBot,
  oldApiBot,
};

// --- Isolated auto-margin (AMR) bot with exchange.futures_balance_from_exchange ---
// Real shape from a demo bot: stake_amount includes the added margin, profit_ratio is relative
// to the original margin (0.2087 here), so ratio * stake counts the loss ~3 times.
const amrLoser = makeTrade({
  pair: 'QNT/USDT:USDT',
  trading_mode: 'futures',
  leverage: 75,
  stake_amount: 0.65987295,
  profit_ratio: -2.03880082,
  profit_abs: -0.42551095,
  total_profit_ratio: -2.03880082,
  total_profit_abs: -0.42551095,
  exchange_margin: 0.66860168,
  exchange_extra_margin: 0.00872873,
  exchange_unrealized_pnl: -0.3944,
  exchange_liquidation_price: 85.12,
});
const amrWinner = makeTrade({
  pair: '0G/USDT:USDT',
  is_short: true,
  trading_mode: 'futures',
  leverage: 50,
  stake_amount: 0.04573921,
  profit_ratio: 0.97669509,
  profit_abs: 0.04464868,
  total_profit_ratio: 0.97669509,
  total_profit_abs: 0.04464868,
  exchange_margin: 0.04702219,
  exchange_extra_margin: 0.00128298,
  exchange_unrealized_pnl: 0.0468,
  exchange_liquidation_price: 0.1473,
});
const amrBot = [amrLoser, amrWinner];

describe('openProfit - bots without exchange position fields', () => {
  it.each(Object.entries(normalBots))('%s: ratio is identical to the legacy rule', (_, trades) => {
    expect(trades.some(hasExchangePositionFields)).toBe(false);
    expect(usesExchangeMarginBasis(trades)).toBe(false);
    // Object.is: bit-for-bit identical, not just "close to".
    expect(Object.is(openProfitRatio(trades), legacyOpenProfitRatio(trades))).toBe(true);
    expect(Object.is(openProfitAbs(trades), legacyOpenProfitAbs(trades))).toBe(true);
  });

  it('DCA with partial exits uses total_profit_ratio (incl. realized)', () => {
    const [dca] = dcaPartialExitBot;
    expect(openProfitContribution(dca!)).toEqual({ profit: 0.0295 * 61.4, basis: 61.4 });
  });

  it('no open trades gives undefined instead of NaN', () => {
    expect(Number.isNaN(legacyOpenProfitRatio([]))).toBe(true);
    expect(openProfitRatio([])).toBeUndefined();
    expect(openProfitAbs([])).toBe(0);
  });

  it('zero stake gives undefined instead of NaN', () => {
    expect(openProfitRatio([makeTrade({ stake_amount: 0, profit_ratio: 0.1 })])).toBeUndefined();
  });
});

describe('openProfit - bots with exchange position fields', () => {
  it('legacy rule overstates the loss', () => {
    expect(legacyOpenProfitRatio(amrBot)).toBeCloseTo(-1.8433, 4);
  });

  it('ratio = sum(total profit abs) / sum(exchange margin)', () => {
    const expected = (-0.42551095 + 0.04464868) / (0.66860168 + 0.04702219);
    expect(openProfitRatio(amrBot)).toBeCloseTo(expected, 12);
    expect(openProfitRatio(amrBot)).toBeCloseTo(-0.5322, 4);
    expect(usesExchangeMarginBasis(amrBot)).toBe(true);
  });

  it('absolute open profit is unchanged by the exchange fields', () => {
    expect(openProfitAbs(amrBot)).toBe(legacyOpenProfitAbs(amrBot));
  });

  it('per-trade profit on posted margin matches the aggregate rule', () => {
    expect(tradeProfitRatioOnExchangeMargin(amrLoser)).toBeCloseTo(-0.42551095 / 0.66860168, 12);
    expect(openProfitRatio([amrLoser])).toBe(tradeProfitRatioOnExchangeMargin(amrLoser));
    expect(tradeProfitRatioOnExchangeMargin(spotBot[0]!)).toBeUndefined();
  });

  it('uses profit_abs when total_profit_abs is absent', () => {
    const t = makeTrade({ profit_abs: 2, total_profit_abs: undefined, exchange_margin: 8 });
    expect(openProfitRatio([t])).toBe(0.25);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['zero', 0],
    ['negative', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('exchange_margin %s falls back to the stake rule for that trade', (_, margin) => {
    const t = makeTrade({
      stake_amount: 10,
      profit_ratio: 0.5,
      profit_abs: 99,
      exchange_margin: margin as number | null | undefined,
      exchange_extra_margin: null,
      exchange_unrealized_pnl: null,
      exchange_liquidation_price: null,
    });
    expect(exchangeMarginBasis(t)).toBeUndefined();
    expect(openProfitContribution(t)).toEqual({ profit: 5, basis: 10 });
    expect(openProfitRatio([t])).toBe(0.5);
  });

  it('mixed trades in one bot: each trade uses its own basis', () => {
    const unreported = makeTrade({ stake_amount: 10, profit_ratio: 0.1, exchange_margin: null });
    const expected = (-0.42551095 + 1) / (0.66860168 + 10);
    expect(openProfitRatio([amrLoser, unreported])).toBeCloseTo(expected, 12);
  });

  it('hasExchangePositionFields detects null-valued fields (option on, no position)', () => {
    expect(hasExchangePositionFields(makeTrade({ exchange_margin: null }))).toBe(true);
    expect(hasExchangePositionFields(makeTrade({}))).toBe(false);
  });
});
