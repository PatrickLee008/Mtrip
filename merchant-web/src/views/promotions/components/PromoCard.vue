<script setup lang="ts">
/**
 * 促销卡片(Figma `2285:21516` 的 `promo-card`)。
 *
 * 稿面硬值:卡内 padding 24、gap 20、radius 16、描边 1px `#E2E8F0`、底纯白;
 * 标题 Plus Jakarta Sans SemiBold 18(`#1B1D30`);
 * 描述 Inter Regular 14 `rgba(25,26,37,0.5)`;元数据 Label Inter SemiBold 11 大写、值 Inter Medium 13 主色;
 * 操作键 row、flex-end、gap 8,按钮 padding 8px 16px、gap 6、radius 8。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import PromoIcon from './PromoIcon.vue';
import type { MerchantPromotion } from '@/api/promotions';
import { discountText, kindOf, lifecycleKey, targetText, validityText } from '../helpers';

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
  (e: 'remove', row: MerchantPromotion): void;
  (e: 'end', row: MerchantPromotion): void;
}>();

const { t } = useI18n();

const isActive = computed(() => Number(props.promotion.status) === 1);
const isDraft = computed(() => Number(props.promotion.status) === 0);
const state = computed(() => lifecycleKey(props.promotion));
const longStay = computed(() => kindOf(props.promotion) === 4);
const canToggle = computed(() => ['draft', 'active', 'upcoming', 'paused'].includes(state.value));

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
      </h3>
      <div class="card-controls">
        <span class="condition-badge" :class="{ 'long-stay': longStay }">{{ longStay ? t('promotions.kind.4') : t('promotions.standard') }}</span>
        <span class="badge" :class="`badge-${state}`"><i class="dot" />{{ t(`promotions.status.${state}`) }}</span>
        <button v-if="canToggle" v-perm="'mch:promotions:status'" type="button" class="status-switch" role="switch" :aria-checked="isActive" :aria-label="isDraft ? t('promotions.actions.start') : (isActive ? t('promotions.actions.pause') : t('promotions.actions.resume'))" @click="isDraft ? $emit('publish', promotion) : $emit('toggle', promotion)"><span /></button>
        <a-dropdown :trigger="['click']">
          <button type="button" class="more-btn" :aria-label="t('promotions.table.actions')"><span aria-hidden="true">&#8942;</span></button>
          <template #overlay>
            <a-menu>
              <a-menu-item key="duplicate" v-perm="'mch:promotions:duplicate'" @click="$emit('duplicate', promotion)">{{ t('promotions.actions.duplicate') }}</a-menu-item>
              <a-menu-item v-if="[1, 2].includes(Number(promotion.status))" key="end" v-perm="'mch:promotions:status'" @click="$emit('end', promotion)">{{ t('promotions.actions.end') }}</a-menu-item>
              <a-menu-item v-if="[0, 1, 2, 3].includes(Number(promotion.status))" key="remove" v-perm="'mch:promotions:delete'" danger @click="$emit('remove', promotion)">{{ t('promotions.actions.archive') }}</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
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
        <span class="meta-value">{{ validity || t('promotions.noExpiry') }}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">{{ t('promotions.drawer.discountValue') }}</span>
        <span class="meta-value">{{ discountText(promotion, currency) }}</span>
      </div>
    </div>

    <footer class="card-actions">
      <button v-if="[0, 1, 2].includes(Number(promotion.status))" v-perm="'mch:promotions:edit'" type="button" class="action-btn" @click="$emit('edit', promotion)">
        <PromoIcon name="edit" :size="14" />
        <span>{{ t('promotions.drawer.editTitle') }}</span>
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

.card-header { flex-wrap: wrap; }
.card-title { flex: 1; min-width: 140px; overflow-wrap: anywhere; }
.card-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.condition-badge { padding: 3px 10px; border-radius: 99px; color: #8200c4; background: #f5eafa; font-size: 12px; font-weight: 600; }
.condition-badge.long-stay { color: #238f87; background: #ccfbf1; }
.status-switch { display: flex; align-items: center; width: 44px; height: 22px; padding: 2px; border: 0; border-radius: 20px; background: #d4dbfa; cursor: pointer; }
.status-switch span { width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .15s; }
.status-switch[aria-checked='true'] { background: @pr-primary; }
.status-switch[aria-checked='true'] span { transform: translateX(22px); }
.more-btn { border: 0; background: transparent; color: @pr-ink-muted; font-size: 24px; cursor: pointer; }
.badge-draft, .badge-ended { color: @pr-ink-sub; background: @pr-neutral-soft; }
@media (max-width: 620px) { .promo-card { padding: 16px; } .metadata { flex-wrap: wrap; } .meta-item { flex-basis: 40%; } }

.card-title {
  margin: 0;
  color: @pr-ink;
  font-family: @pr-font-display;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.5;
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
  overflow-wrap: anywhere;
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

}
</style>
