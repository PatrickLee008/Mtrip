<script setup lang="ts">
/**
 * Bulk Update 网格(Figma `1163:16345` 的 Bulk Update 画板:房型 × 日期 + 多选)。
 * 每格可勾选,选中态为主色描边 + 右上角勾选徽标;已屏蔽格显示 `Blocked` 与 `-`。
 */
import { computed } from 'vue';
import dayjs from 'dayjs';
import { useI18n } from 'vue-i18n';
import type { AvailabilityDay, AvailabilityRoom } from '@/api/availability';
import AvIcon from './AvIcon.vue';
import { cellState, priceShort, type CellState } from '../helpers';

const props = defineProps<{
  rows: { room: AvailabilityRoom; days: Record<string, AvailabilityDay> }[];
  dates: string[];
  currency: string;
  /** 选中的 `roomId_date` 键集合 */
  selected: string[];
}>();

const emit = defineEmits<{ (e: 'toggle', roomId: number, date: string): void }>();

const { t } = useI18n();

const legend = computed<{ state: CellState; label: string }[]>(() => [
  { state: 'available', label: t('availability.legend.available') },
  { state: 'low', label: t('availability.legend.low') },
  { state: 'sold', label: t('availability.legend.sold') },
  { state: 'blocked', label: t('availability.legend.blocked') },
]);

const template = computed(() => `200px repeat(${props.dates.length}, minmax(0, 1fr))`);

function stateOf(roomId: number, date: string): CellState {
  const day = props.rows.find((row) => row.room.id === roomId)?.days[date];
  return day ? cellState(day) : 'available';
}

function badgeOf(roomId: number, date: string): string {
  const day = props.rows.find((row) => row.room.id === roomId)?.days[date];
  if (!day) return '';
  return day.isClosed === 1 ? t('availability.cell.blocked') : t('availability.cell.avail', { count: day.stockLeft });
}

function priceOf(roomId: number, date: string): string {
  const day = props.rows.find((row) => row.room.id === roomId)?.days[date];
  if (!day) return '';
  if (day.isClosed === 1) return '-';
  return `${props.currency} ${priceShort(day.price)}`;
}
</script>

<template>
  <div class="bulk-card">
    <div class="bulk-scroll">
      <div class="bulk-head" :style="{ gridTemplateColumns: template }">
        <div class="bulk-room-head">{{ t('availability.columns.rooms') }}</div>
        <div v-for="date in dates" :key="date" class="bulk-date-head">
          <span class="bulk-weekday">{{ dayjs(date).format('ddd') }}</span>
          <span class="bulk-date">{{ dayjs(date).format('MMM D') }}</span>
        </div>
      </div>

      <div class="bulk-body">
        <div v-for="row in rows" :key="row.room.id" class="bulk-row" :style="{ gridTemplateColumns: template }">
          <div class="bulk-room-cell">{{ row.room.name }}</div>
          <button
            v-for="date in dates"
            :key="date"
            type="button"
            class="bulk-cell"
            :class="[stateOf(row.room.id, date), { selected: selected.includes(`${row.room.id}_${date}`) }]"
            @click="emit('toggle', row.room.id, date)"
          >
            <span class="bulk-info">
              <span class="bulk-badge">{{ badgeOf(row.room.id, date) }}</span>
              <span class="bulk-price">{{ priceOf(row.room.id, date) }}</span>
            </span>
            <span v-if="selected.includes(`${row.room.id}_${date}`)" class="bulk-check"><AvIcon name="check" :size="10" /></span>
          </button>
        </div>
      </div>
    </div>

    <div class="bulk-legend">
      <span v-for="item in legend" :key="item.state" class="bulk-legend-item">
        <i :class="item.state"></i>
        {{ item.label }}
      </span>
    </div>
  </div>
</template>

<style scoped lang="less">
@import '../tokens.less';

.bulk-card {
  overflow: hidden;
  border: 1px solid @av-line;
  border-radius: 16px;
  background: #fff;
}
.bulk-scroll {
  overflow-x: auto;
}
.bulk-head,
.bulk-row {
  display: grid;
  min-width: 860px;
}

.bulk-head {
  background: @av-soft;
}
.bulk-room-head {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-right: 1px solid @av-line;
  border-bottom: 1px solid @av-line;
  color: @av-ink;
  font-family: @av-font-body;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}
.bulk-date-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 12px;
  border-right: 1px solid @av-line;
  border-bottom: 1px solid @av-line;

  &:last-child {
    border-right: 0;
  }
}
.bulk-weekday {
  color: @av-ink-muted;
  font-family: @av-font-body;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
}
.bulk-date {
  color: @av-ink;
  font-family: @av-font-body;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}

.bulk-row {
  &:last-child .bulk-room-cell,
  &:last-child .bulk-cell {
    border-bottom: 0;
  }
}
.bulk-room-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-right: 1px solid @av-line;
  border-bottom: 1px solid @av-line;
  color: @av-ink;
  font-family: @av-font-body;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}

.bulk-cell {
  position: relative;
  display: flex;
  min-height: 108px;
  flex-direction: column;
  justify-content: center;
  padding: 8px;
  border: 0;
  border-right: 1px solid @av-line;
  border-bottom: 1px solid @av-line;
  background: #fff;
  font-family: @av-font-body;
  text-align: left;
  cursor: pointer;

  &:last-child {
    border-right: 0;
  }
  &:hover {
    background: @av-soft;
  }
  &.selected {
    background: @av-primary-soft;
    border-color: @av-primary;
    box-shadow: inset 0 0 0 1px @av-primary;
  }
  /* 已屏蔽格稿面底为 @av-chip-bg、描边仍是 @av-line */
  &.blocked {
    background: @av-chip-bg;
  }
}

.bulk-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bulk-badge {
  align-self: flex-start;
  padding: 4px 8px;
  border: 1px solid;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
}
.bulk-price {
  color: @av-primary;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}

.bulk-cell.available .bulk-badge {
  border-color: @av-primary;
  background: @av-primary-soft;
  color: @av-primary;
}
.bulk-cell.low .bulk-badge {
  border-color: @av-low;
  background: @av-low-soft;
  color: @av-low;
}
.bulk-cell.sold .bulk-badge {
  border-color: @av-sold;
  background: @av-sold-soft;
  color: @av-sold;
}
.bulk-cell.blocked .bulk-badge {
  border-color: @av-line;
  background: @av-line;
  color: @av-ink-muted;
}
.bulk-cell.blocked .bulk-price {
  color: @av-ink-muted;
}

.bulk-check {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 0 0 0 4px;
  background: @av-primary;
  color: #fff;
}

.bulk-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 16px;
  border-top: 1px solid @av-line;
  background: #fff;
}
.bulk-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: @av-ink-muted;
  font-family: @av-font-body;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;

  i {
    display: block;
    width: 14px;
    height: 14px;
    border: 1px solid;
    border-radius: 3px;
  }
  i.available {
    border-color: @av-primary;
    background: @av-primary-soft;
  }
  i.low {
    border-color: @av-low;
    background: @av-low-soft;
  }
  i.sold {
    border-color: @av-sold;
    background: @av-sold-soft;
  }
  i.blocked {
    border-color: @av-line;
    background: #fff;
  }
}
</style>
