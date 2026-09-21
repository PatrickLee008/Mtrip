<script setup lang="ts">
/**
 * Promotions 页统计卡(Figma `2285:21516` 顶部三张卡 + 长住促销的第四张)。
 *
 * 稿面硬值:卡内 padding 16、gap 12、radius 12、底 `#FEFEFE`、描边 `#E2E8F0`、
 * 阴影 `0 2px 10px 0 rgba(15,23,42,0.04)`;图标底 32×32 radius 8;
 * 标签 Inter Medium 12 `#64748B`;数值 Plus Jakarta Sans Bold 24 `#1B1D30`。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import PromoIcon from './PromoIcon.vue';
import { PROMOTION_KIND, type PromotionSummary } from '@/api/promotions';

const props = defineProps<{ summary: PromotionSummary }>();
const { t } = useI18n();

/** 第四张(长住)是功能需求新增,稿面只有前三张 —— 沿用同一张卡的形状与令牌 */
const cards = computed(() => [
  { key: 'percentage', icon: 'percent', tone: 'warn', label: t('promotions.cards.percentage'), value: props.summary.percentage },
  { key: 'fixedAmount', icon: 'ticket-percent', tone: 'primary', label: t('promotions.cards.fixedAmount'), value: props.summary.fixedAmount },
  { key: 'promoCode', icon: 'ticket', tone: 'success', label: t('promotions.cards.promoCode'), value: props.summary.promoCode },
  { key: 'longStay', icon: 'moon', tone: 'primary', label: t('promotions.cards.longStay'), value: props.summary.longStay },
]);

const KIND_HINT: Record<string, number> = {
  percentage: PROMOTION_KIND.percentage,
  fixedAmount: PROMOTION_KIND.fixedAmount,
  promoCode: PROMOTION_KIND.promoCode,
  longStay: PROMOTION_KIND.longStay,
};

defineEmits<{ (e: 'pick', kind: number): void }>();
</script>

<template>
  <section class="stat-row">
    <button
      v-for="card in cards"
      :key="card.key"
      type="button"
      class="stat-card"
      @click="$emit('pick', KIND_HINT[card.key])"
    >
      <div class="stat-head">
        <span class="stat-label">{{ card.label }}</span>
        <span class="stat-icon" :class="`tone-${card.tone}`">
          <PromoIcon :name="card.icon" :size="14" />
        </span>
      </div>
      <div class="stat-value">{{ card.value }}</div>
    </button>
  </section>
</template>

<style scoped lang="less">
@import '../tokens.less';

.stat-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-card;
  background: @pr-card-bg;
  box-shadow: @pr-shadow-card;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease;

  &:hover {
    border-color: @pr-primary;
  }
}

.stat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stat-label {
  color: @pr-ink-sub;
  font-family: @pr-font-body;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: @pr-radius-control;

  &.tone-primary {
    background: @pr-primary-soft;
    color: @pr-primary;
  }

  &.tone-warn {
    background: @pr-warn-soft;
    color: @pr-warn;
  }

  &.tone-success {
    background: @pr-success-faint;
    color: @pr-success;
  }
}

.stat-value {
  padding-top: 8px;
  color: @pr-ink;
  font-family: @pr-font-display;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.5;
}

@media (max-width: 1180px) {
  .stat-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .stat-row {
    grid-template-columns: 1fr;
  }
}
</style>
