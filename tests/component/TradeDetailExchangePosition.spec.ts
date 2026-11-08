import TradeDetailExchangePosition from '@/components/ftbot/TradeDetailExchangePosition.vue';
import type { Trade } from '@/types';
import { formatPercent, formatPrice, formatPriceCurrency } from '@/utils/formatters/numberformat';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

const baseTrade = {
  botId: 'ftbot.1',
  botTradeId: 'ftbot.1__1',
  botName: 'bot',
  trade_id: 1,
  pair: 'QNT/USDT:USDT',
  is_open: true,
  amount: 1,
  stake_amount: 0.65987295,
  timeframe: '1h',
  open_rate: 100,
  open_date: '2026-11-08 00:00:00',
  open_timestamp: 1794096000000,
  fee_open: 0.00055,
  profit_ratio: -2.03880082,
  profit_pct: -203.88,
  profit_abs: -0.42551095,
  total_profit_abs: -0.42551095,
  stop_loss_abs: 0,
  stop_loss_ratio: -1,
  stop_loss_pct: -100,
  trading_mode: 'futures',
} as Trade;

function mountWith(trade: Partial<Trade>, stakeCurrency = 'USDC') {
  return mount(TradeDetailExchangePosition, {
    props: { trade: { ...baseTrade, ...trade }, stakeCurrency },
    global: { stubs: { InfoBox: true } },
  });
}

describe('TradeDetailExchangePosition.vue', () => {
  it('shows all exchange fields with the bot stake currency', () => {
    const wrapper = mountWith({
      exchange_margin: 0.66860168,
      exchange_extra_margin: 0.00872873,
      exchange_unrealized_pnl: -0.3944,
      exchange_liquidation_price: 85.12,
    });
    const text = wrapper.text();
    expect(text).toContain('Posted margin');
    expect(text).toContain(formatPriceCurrency(0.66860168, 'USDC'));
    expect(text).toContain('Extra margin');
    expect(text).toContain(formatPriceCurrency(0.00872873, 'USDC'));
    expect(text).toContain('Unrealized PnL');
    expect(text).toContain(formatPriceCurrency(-0.3944, 'USDC'));
    expect(text).toContain('Profit on posted margin');
    // Locale-independent: the same formatters the component uses.
    expect(text).toContain(formatPercent(-0.42551095 / 0.66860168));
    expect(text).toContain('Liquidation Price');
    expect(text).toContain(formatPrice(85.12));
    expect(text).not.toContain('USDT');
    expect(text).not.toContain('Not reported');
  });

  it('shows a hint when the exchange reports no position (all fields null)', () => {
    const wrapper = mountWith({
      exchange_margin: null,
      exchange_extra_margin: null,
      exchange_unrealized_pnl: null,
      exchange_liquidation_price: null,
    });
    const text = wrapper.text();
    expect(text).toContain('Not reported by the exchange');
    expect(text).not.toContain('Posted margin');
    expect(text).not.toContain('Profit on posted margin');
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('Infinity');
  });

  it('a zero margin shows the value but no ratio', () => {
    const wrapper = mountWith({ exchange_margin: 0 });
    const text = wrapper.text();
    expect(text).toContain('Posted margin');
    expect(text).not.toContain('Profit on posted margin');
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('Infinity');
  });
});
