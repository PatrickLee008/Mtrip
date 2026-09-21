<script setup lang="ts">
/**
 * 收益拆解卡(Figma `1306:18423` financial-row 右侧 earnings-card)。
 *
 * 三行扣减(Gross → 促销折扣 → 平台佣金)→ 分隔线 → Net Settlement Payout 高亮块。
 * 稿面佣金按**百分比**展示("- 15%"),后端 overview 新增 commissionRate 供给;毛收入为 0 时显示占位。
 */
import { useI18n } from 'vue-i18n';
import type { EarningsOverview } from '@/api/earnings';
import { deductionMoneyText, deductionPercentText, moneyText } from '../helpers';
import ChartPanel from './ChartPanel.vue';

const props = defineProps<{ overview: EarningsOverview; currency: string }>();

const { t } = useI18n();
</script>

<template>
  <ChartPanel class="earnings-card" :title="t('earnings.breakdown.title')" :padding="24">
    <div class="rows">
      <div class="row">
        <span class="row-label">{{ t('earnings.breakdown.grossRevenue') }}</span>
        <span class="row-value">{{ moneyText(props.overview.grossRevenue, props.currency) }}</span>
      </div>
      <div class="row">
        <span class="row-label">{{ t('earnings.breakdown.promotions') }}</span>
        <span class="row-value deduction">{{ deductionMoneyText(props.overview.discountAmount, props.currency) }}</span>
      </div>
      <div class="row">
        <span class="row-label">{{ t('earnings.breakdown.commission') }}</span>
        <span class="row-value deduction">{{ deductionPercentText(props.overview.commissionRate) }}</span>
      </div>
      <span class="divider" />
      <div class="net-box">
        <span class="net-label">{{ t('earnings.breakdown.netPayout') }}</span>
        <span class="net-value">{{ moneyText(props.overview.netSettlement, props.currency) }}</span>
      </div>
    </div>
  </ChartPanel>
</template>

<style scoped lang="less">
@import '../tokens.less';

.earnings-card {
  flex: none;
  width: @ea-earnings-width;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.row-label {
  color: @ea-ink-muted;
  font-family: @ea-font-body;
  font-size: 14px;
  font-weight: 400;
}

.row-value {
  color: @ea-ink;
  font-family: @ea-font-body;
  font-size: 16px;
  font-weight: 600;

  &.deduction {
    color: @ea-danger;
  }
}

.divider {
  display: block;
  width: 100%;
  height: 1px;
  background: @ea-line;
}

.net-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border-radius: @ea-radius-control;
  background: @ea-primary-chip;
}

.net-label {
  color: @ea-primary;
  font-family: @ea-font-body;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.net-value {
  color: @ea-primary;
  font-family: @ea-font-display;
  font-size: 26px;
  font-weight: 800;
  line-height: 1.2;
}

@media (max-width: 1200px) {
  .earnings-card {
    width: 100%;
  }
}
</style>
