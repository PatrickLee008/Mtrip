<script setup lang="ts">
/**
 * 促销卡片(Figma `2285:21516` 的 `promo-card`)。
 *
 * 稿面硬值:卡内 padding 24、gap 20、radius 16、描边 1px `#E2E8F0`、底纯白;
 * 标题 Plus Jakarta Sans SemiBold 18(`#1B1D30`,折扣片段染 `#EC1317`);
 * 描述 Inter Regular 14 `rgba(25,26,37,0.5)`;元数据 Label Inter SemiBold 11 大写、值 Inter Medium 13 主色;
 * 操作键 row、flex-end、gap 8,按钮 padding 8px 16px、gap 6、radius 8。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import PromoIcon from './PromoIcon.vue';
import type { MerchantPromotion } from '@/api/promotions';
import { discountHighlight, statusKey, targetText, validityText } from '../helpers';

const props = defineProps<{
  promotion: MerchantPromotion;
  currency: string;
  propertyNames: Record<number, string>;
  roomNames: Record<number, string>;
}>();

defineEmits<{
  (e: 'edit', row: MerchantPromotion): void;
  (e: 'duplicate', row: MerchantPromotion): void;
  (e: 'toggle', row: MerchantPromotion): void;
  (e: 'publish', row: MerchantPromotion): void;
}>();

const { t } = useI18n();

const isActive = computed(() => Number(props.promotion.status) === 1);
const isDraft = computed(() => Number(props.promotion.status) === 0);

/** 标题前缀:长住/提前预订是稿面里唯一带业务前缀的两种,其余直接用促销名 */
const title = computed(() => String(props.promotion.coupon_name || ''));
const description = computed(() => String(props.promotion.description || props.promotion.remark || ''));
const target = computed(() => targetText(props.promotion, props.propertyNames, props.roomNames));
const validity = computed(() => validityText(props.promotion));
</script>

<template>
  <article class="promo-card">
    <header class="card-header">
      <h3 class="card-title">
        {{ title }}
        <span class="title-highlight">{{ discountHighlight(promotion, currency) }}</span>
      </h3>
      <span class="badge" :class="`badge-${statusKey(promotion.status)}`">
        <i v-if="statusKey(promotion.status) !== 'upcoming'" class="dot" />
        {{ t(`promotions.status.${statusKey(promotion.status)}`) }}
      </span>
    </header>

    <p class="card-desc">{{ description }}</p>

    <div class="card-line" />

    <div class="metadata">
      <div class="meta-item">
        <span class="meta-label">{{ t('promotions.fields.target') }}</span>
        <span class="meta-value">{{ target || t('promotions.fields.allRoomTypes') }}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">{{ t('promotions.fields.validityPeriod') }}</span>
        <span class="meta-value">{{ validity }}</span>
      </div>
    </div>

    <footer class="card-actions">
      <button
        v-if="isDraft"
        v-perm="'mch:promotions:status'"
        type="button"
        class="action-btn primary"
        @click="$emit('publish', promotion)"
      >
        <PromoIcon name="play" :size="14" />
        <span>{{ t('promotions.actions.start') }}</span>
      </button>
      <button
        v-else
        v-perm="'mch:promotions:status'"
        type="button"
        class="action-btn"
        @click="$emit('toggle', promotion)"
      >
        <PromoIcon :name="isActive ? 'pause' : 'play'" :size="14" />
        <span>{{ isActive ? t('promotions.actions.pause') : t('promotions.actions.resume') }}</span>
      </button>
      <button v-perm="'mch:promotions:edit'" type="button" class="action-btn" @click="$emit('edit', promotion)">
        <PromoIcon name="edit" :size="14" />
        <span>{{ t('common.edit') }}</span>
      </button>
      <button
        v-perm="'mch:promotions:duplicate'"
        type="button"
        class="action-btn icon-only"
        :title="t('promotions.actions.duplicate')"
        @click="$emit('duplicate', promotion)"
      >
        <PromoIcon name="copy" :size="14" />
      </button>
    </footer>
  </article>
</template>

<style scoped lang="less">
@import '../tokens.less';

.promo-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-promo-card;
  background: #fff;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.card-title {
  margin: 0;
  color: @pr-ink;
  font-family: @pr-font-display;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.5;
}

.title-highlight {
  color: @pr-danger;
}

.badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 99px;
  font-family: @pr-font-body;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.badge-active {
  background: @pr-success-faint;
  color: @pr-success;
}

.badge-upcoming {
  background: @pr-warn-soft;
  color: @pr-warn;
}

.badge-paused {
  background: @pr-primary-soft;
  color: @pr-primary;
}

.badge-expired {
  background: @pr-neutral-soft;
  color: @pr-ink-sub;
}

.card-desc {
  margin: 0;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
}

.card-line {
  height: 1px;
  background: @pr-line;
}

.metadata {
  display: flex;
  gap: 24px;
}

.meta-item {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  text-transform: uppercase;
}

.meta-value {
  overflow: hidden;
  color: @pr-primary;
  font-family: @pr-font-body;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-control;
  background: #fff;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;

  &:hover {
    border-color: @pr-primary;
    color: @pr-primary;
  }

  &.primary {
    border-color: @pr-primary;
    background: @pr-primary;
    color: #fff;
  }

  &.icon-only {
    padding: 8px 10px;
  }
}
</style>
