<script setup lang="ts">
import { computed } from 'vue';
import { formatAmount, currencySymbol } from '@/utils/format';

/**
 * 金额显示:千分位 + 财务分级色(UI 方案 2.1 财务金额分级色)
 * type: income 收入(绿) / expense 支出(红) / commission 佣金(蓝) / tax 税费(灰)
 */
const props = withDefaults(
  defineProps<{
    value: number | string;
    currency?: string;
    type?: 'income' | 'expense' | 'commission' | 'tax' | 'plain';
    digits?: number;
  }>(),
  { currency: '', type: 'plain', digits: 2 },
);

const cls = computed(() => (props.type === 'plain' ? '' : `amount-${props.type}`));
const text = computed(() => {
  const symbol = props.currency ? currencySymbol(props.currency) : '';
  return symbol + formatAmount(props.value, props.digits);
});
</script>

<template>
  <span :class="cls" class="amount-text">{{ text }}</span>
</template>

<style scoped>
.amount-text {
  font-variant-numeric: tabular-nums;
}
</style>
