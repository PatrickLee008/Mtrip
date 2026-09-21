<script setup lang="ts">
/**
 * 优惠码促销表格(Figma `2285:21516` 的 `Table Container`)。
 *
 * 稿面硬值:容器底纯白、描边 1px `#E2E8F0`、radius 12;
 * 表头行 padding 12px 24px、底 `#F8FAFC`、下描边 1px;数据行 padding 16px 24px、下描边 1px;
 * 列宽 券码 180 / 折扣 150 / 领取进度 200 / 有效期 180 / 状态 120 / 操作 100;
 * 券码用胶囊(padding 6px 12px、底 `#F1F5F9`、描边 1px、radius 6);
 * 进度条 140×6、底 `#E2E8F0`、radius 3;操作键 28×28、底 `#F1F5F9`、radius 6。
 */
import { useI18n } from 'vue-i18n';
import PromoIcon from './PromoIcon.vue';
import type { MerchantPromotion } from '@/api/promotions';
import { discountText, statusKey, usageRatio, usageText, validityText } from '../helpers';

defineProps<{
  list: MerchantPromotion[];
  currency: string;
  loading: boolean;
}>();

defineEmits<{
  (e: 'edit', row: MerchantPromotion): void;
  (e: 'duplicate', row: MerchantPromotion): void;
  (e: 'toggle', row: MerchantPromotion): void;
  (e: 'publish', row: MerchantPromotion): void;
  (e: 'remove', row: MerchantPromotion): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="promo-table">
    <div class="t-head">
      <span class="c-code">{{ t('promotions.table.couponCode') }}</span>
      <span class="c-discount">{{ t('promotions.table.discount') }}</span>
      <span class="c-usage">{{ t('promotions.table.usageLimit') }}</span>
      <span class="c-dates">{{ t('promotions.table.validDates') }}</span>
      <span class="c-status">{{ t('promotions.table.status') }}</span>
      <span class="c-actions">{{ t('promotions.table.actions') }}</span>
    </div>

    <div v-if="loading" class="t-state">{{ t('common.loading') }}</div>
    <div v-else-if="list.length === 0" class="t-state">{{ t('promotions.empty') }}</div>

    <template v-else>
      <div v-for="row in list" :key="row.id" class="t-row">
      <span class="c-code">
        <span class="code-chip">{{ row.promo_code || row.coupon_name }}</span>
      </span>
      <span class="c-discount">{{ discountText(row, currency) }}</span>
      <span class="c-usage">
        <template v-if="row.total_count > 0">
          <span class="usage-text">{{ usageText(row) }}</span>
          <span class="usage-track"><i class="usage-fill" :style="{ width: `${usageRatio(row) * 100}%` }" /></span>
        </template>
        <span v-else class="usage-text muted">{{ t('promotions.unlimited') }}</span>
      </span>
      <span class="c-dates">{{ validityText(row) || t('promotions.noExpiry') }}</span>
      <span class="c-status">
        <span class="badge" :class="`badge-${statusKey(row.status)}`">
          <i v-if="statusKey(row.status) !== 'upcoming'" class="dot" />
          {{ t(`promotions.status.${statusKey(row.status)}`) }}
        </span>
      </span>
      <span class="c-actions">
        <button
          v-if="Number(row.status) === 0"
          v-perm="'mch:promotions:status'"
          type="button"
          class="icon-btn"
          :title="t('promotions.actions.start')"
          @click="$emit('publish', row)"
        >
          <PromoIcon name="play" :size="14" />
        </button>
        <button
          v-else-if="[1, 2].includes(Number(row.status))"
          v-perm="'mch:promotions:status'"
          type="button"
          class="icon-btn"
          :title="Number(row.status) === 1 ? t('promotions.actions.pause') : t('promotions.actions.resume')"
          @click="$emit('toggle', row)"
        >
          <PromoIcon :name="Number(row.status) === 1 ? 'pause' : 'play'" :size="14" />
        </button>
        <button
          v-perm="'mch:promotions:edit'"
          type="button"
          class="icon-btn"
          :title="t('common.edit')"
          @click="$emit('edit', row)"
        >
          <PromoIcon name="edit" :size="14" />
        </button>
        <button
          v-perm="'mch:promotions:duplicate'"
          type="button"
          class="icon-btn"
          :title="t('promotions.actions.duplicate')"
          @click="$emit('duplicate', row)"
        >
          <PromoIcon name="copy" :size="14" />
        </button>
        <button
          v-if="[0, 3].includes(Number(row.status))"
          v-perm="'mch:promotions:delete'"
          type="button"
          class="icon-btn danger"
          :title="t('common.delete')"
          @click="$emit('remove', row)"
        >
          <PromoIcon name="trash" :size="14" />
        </button>
      </span>
      </div>
    </template>
  </div>
</template>

<style scoped lang="less">
@import '../tokens.less';

.promo-table {
  overflow: hidden;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-card;
  background: #fff;
}

.t-head,
.t-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.t-head {
  padding: 12px 24px;
  border-bottom: 1px solid @pr-line;
  background: @pr-soft;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.t-row {
  padding: 16px 24px;
  border-bottom: 1px solid @pr-line;
  color: @pr-ink;
  font-family: @pr-font-body;
  font-size: 13px;
  font-weight: 500;

  &:last-child {
    border-bottom: 0;
  }
}

.t-state {
  padding: 48px 0;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 14px;
  text-align: center;
}

/* 列宽与稿面模板一致(券码 180 / 折扣 150 / 进度 200 / 有效期 180 / 状态 120 / 操作 100) */
.c-code {
  flex: none;
  width: 180px;
  min-width: 0;
}

.c-discount {
  flex: none;
  width: 150px;
  color: @pr-primary;
  font-weight: 700;
}

.c-usage {
  display: flex;
  flex: none;
  width: 200px;
  flex-direction: column;
  gap: 6px;
}

.c-dates {
  flex: none;
  width: 180px;
  color: @pr-ink;
}

.c-status {
  flex: none;
  width: 120px;
}

.c-actions {
  display: flex;
  flex: none;
  // 稿面只画了 edit + copy(合计 68px);删除是功能需求追加的第 4 个键,故列宽放到 160
  width: 160px;
  justify-content: flex-end;
  gap: 12px;
}

.code-chip {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  padding: 6px 12px;
  border: 1px solid @pr-line;
  border-radius: 6px;
  background: @pr-chip-bg;
  color: @pr-ink;
  font-family: @pr-font-body;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.usage-text {
  color: @pr-ink;
  font-size: 12px;
  font-weight: 500;

  &.muted {
    color: @pr-ink-muted;
  }
}

.usage-track {
  display: block;
  width: 140px;
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: @pr-line;
}

.usage-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: @pr-primary;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 99px;
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

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid @pr-line;
  border-radius: 6px;
  background: @pr-chip-bg;
  color: @pr-ink-muted;
  cursor: pointer;

  &:hover {
    border-color: @pr-primary;
    color: @pr-primary;
  }

  &.danger:hover {
    border-color: @pr-danger;
    color: @pr-danger;
  }
}

@media (max-width: 1180px) {
  .promo-table {
    overflow-x: auto;
  }

  .t-head,
  .t-row {
    min-width: 1000px;
  }
}
</style>
