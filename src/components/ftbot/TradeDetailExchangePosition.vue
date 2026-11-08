<script setup lang="ts">
import type { Trade } from '@/types';

/**
 * Exchange view of an open futures position (freqtrade `exchange.futures_balance_from_exchange`,
 * API version 2.50 and up). Rendered only for trades that carry the exchange_* fields.
 * Amounts are in the position's settlement currency, which is the bot's stake currency.
 */
const props = defineProps<{
  trade: Trade;
  stakeCurrency: string;
}>();

const profitOnMargin = computed(() => tradeProfitRatioOnExchangeMargin(props.trade));
const hasPosition = computed(
  () =>
    isDefined(props.trade.exchange_margin) ||
    isDefined(props.trade.exchange_extra_margin) ||
    isDefined(props.trade.exchange_unrealized_pnl) ||
    isDefined(props.trade.exchange_liquidation_price),
);
</script>

<template>
  <div data-testid="exchange-position">
    <h6 class="font-semibold mt-2">Exchange position</h6>
    <ValuePair v-if="!hasPosition" description="Position">
      <span class="italic">Not reported by the exchange</span>
    </ValuePair>
    <ValuePair
      v-if="isDefined(trade.exchange_margin)"
      description="Posted margin"
      help="Margin posted on the position, including margin added after entry (e.g. auto-add-margin)."
    >
      {{ formatPriceCurrency(trade.exchange_margin, stakeCurrency) }}
    </ValuePair>
    <ValuePair
      v-if="isDefined(trade.exchange_extra_margin)"
      description="Extra margin"
      help="Posted margin minus stake: margin added after entry plus margin the exchange reserves on top (e.g. the closing fee)."
    >
      {{ formatPriceCurrency(trade.exchange_extra_margin, stakeCurrency) }}
    </ValuePair>
    <ValuePair
      v-if="isDefined(trade.exchange_unrealized_pnl)"
      description="Unrealized PnL"
      help="As reported by the exchange - excludes fees and funding, so it differs from the profit above."
    >
      {{ formatPriceCurrency(trade.exchange_unrealized_pnl, stakeCurrency) }}
    </ValuePair>
    <ValuePair
      v-if="profitOnMargin !== undefined"
      description="Profit on posted margin"
      help="Total profit divided by the posted margin - the basis of the bot's Open Profit %."
    >
      {{ formatPercent(profitOnMargin) }}
    </ValuePair>
    <ValuePair
      v-if="isDefined(trade.exchange_liquidation_price)"
      description="Liquidation Price"
      help="As reported by the exchange."
    >
      {{ formatPrice(trade.exchange_liquidation_price) }}
    </ValuePair>
  </div>
</template>
