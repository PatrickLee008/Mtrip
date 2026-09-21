<script setup lang="ts">
/**
 * 近期预订结算表(Figma `1306:18423` settlements-card)。
 *
 * 稿面是整页宽的自绘表格(7 列固定宽度 + space-between 铺满),不是 antd 表格 ——
 * 表头 #F8FAFC 底、行 14px 24px 内边距、行间 1px 分隔线、Payment / Booking Status 两个徽标列。
 * 徽标口径见 helpers.paymentBadge / bookingBadge。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RecentBookingItem } from '@/api/stats';
import { bookingBadge, bookingRef, moneyText, paymentBadge, stayRangeLabel } from '../helpers';

const props = defineProps<{ rows: RecentBookingItem[]; currency: string }>();

const { t } = useI18n();

const columns = computed(() => [
  { key: 'bookingId', label: t('earnings.settlements.bookingId') },
  { key: 'guest', label: t('earnings.settlements.guest') },
  { key: 'roomType', label: t('earnings.settlements.roomType') },
  { key: 'stay', label: t('earnings.settlements.stay') },
  { key: 'amount', label: t('earnings.settlements.amount') },
  { key: 'payment', label: t('earnings.settlements.payment') },
  { key: 'status', label: t('earnings.settlements.status') },
]);

const items = computed(() =>
  props.rows.map((row) => ({
    id: row.orderId,
    ref: bookingRef(row.orderNo),
    guest: row.guest || '—',
    roomType: row.roomType || '—',
    stay: stayRangeLabel(row.checkIn, row.checkOut),
    amount: moneyText(row.totalAmount, props.currency),
    payment: paymentBadge(row),
    booking: bookingBadge(row),
  })),
);
</script>

<template>
  <section class="settlements-card">
    <h3 class="card-title">{{ t('earnings.settlements.title') }}</h3>
    <div class="table-scroll">
      <div class="settlement-table">
        <div class="table-row table-head">
          <span v-for="column in columns" :key="column.key" class="cell">{{ column.label }}</span>
        </div>
        <div v-for="item in items" :key="item.id" class="table-row">
          <span class="cell cell-ref" :title="item.ref">{{ item.ref }}</span>
          <span class="cell cell-strong">{{ item.guest }}</span>
          <span class="cell cell-muted">{{ item.roomType }}</span>
          <span class="cell cell-muted">{{ item.stay }}</span>
          <span class="cell cell-strong">{{ item.amount }}</span>
          <span class="cell">
            <span class="badge" :class="`tone-${item.payment.tone}`">{{ t(`earnings.badge.${item.payment.key}`) }}</span>
          </span>
          <span class="cell">
            <span class="badge" :class="`tone-${item.booking.tone}`">{{ t(`earnings.badge.${item.booking.key}`) }}</span>
          </span>
        </div>
        <div v-if="!items.length" class="table-row table-empty">
          {{ t('earnings.settlements.empty') }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="less">
@import '../tokens.less';

.settlements-card {
  display: flex;
  flex-direction: column;
  padding: 24px 0 0;
  border-radius: @ea-radius-panel;
  background: #ffffff;
  box-shadow: @ea-shadow-card;
}

.card-title {
  margin: 0;
  padding: 0 24px 16px;
  color: @ea-ink;
  font-family: @ea-font-body;
  font-size: 16px;
  font-weight: 600;
}

.table-scroll {
  overflow-x: auto;
}

.settlement-table {
  min-width: 1180px;
  border-top: 1px solid @ea-line;
  border-radius: @ea-radius-card;
  background: #ffffff;
}

.table-row {
  display: grid;
  // 首列放宽到 160px:真实订单号(如 0007202609176285607783)比稿面样例 #BK-1029 长得多
  grid-template-columns: 160px 127px 118px 147px 118px 108px 136px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-bottom: 1px solid @ea-line;
}

.table-head {
  background: @ea-soft;

  .cell {
    color: @ea-ink-muted;
    font-weight: 700;
  }
}

.table-empty {
  display: block;
  color: @ea-ink-muted;
  font-family: @ea-font-body;
  font-size: 14px;
  text-align: center;
}

.cell {
  overflow: hidden;
  color: @ea-ink;
  font-family: @ea-font-body;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-ref {
  color: @ea-primary;
  font-size: 14px;
}

.cell-strong {
  color: @ea-ink;
  font-size: 14px;
  font-weight: 600;
}

.cell-muted {
  color: @ea-ink-muted;
  font-size: 14px;
  font-weight: 400;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-family: @ea-font-body;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
}

.tone-success {
  background: @ea-success-soft;
  color: @ea-success;
}

.tone-neutral {
  border-color: @ea-line;
  background: @ea-line;
  color: @ea-ink-muted;
}

.tone-refund {
  background: @ea-danger-ink-soft;
  color: @ea-danger-ink;
}

.tone-warn {
  background: @ea-warn-soft;
  color: @ea-warn;
}

.tone-primary {
  background: @ea-primary-soft;
  color: @ea-primary;
}

.tone-danger {
  background: @ea-danger-soft;
  color: @ea-danger;
}
</style>
