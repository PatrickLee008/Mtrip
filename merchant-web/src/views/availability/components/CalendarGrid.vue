<script setup lang="ts">
/**
 * 月历视图(Figma `1163:16345` 的 `calendar-container` / `grid-header` / `week-row-*` / `legend-bar`)。
 * 七列 Sun…Sat,格高 110,四态由 helpers.cellState 判定;非本月日期的日号降为 40% 不透明度。
 */
import { computed } from 'vue';
import dayjs from 'dayjs';
import { useI18n } from 'vue-i18n';
import type { AvailabilityDay } from '@/api/availability';
import AvIcon from './AvIcon.vue';
import { cellState, priceShort, type CellState } from '../helpers';

const props = defineProps<{
  /** 当月天数(YYYY-MM-DD → 当日数据) */
  days: Record<string, AvailabilityDay>;
  /** 当前月份 YYYY-MM */
  month: string;
  selectedDate: string | null;
  currency: string;
}>();

const emit = defineEmits<{ (e: 'select', date: string): void }>();

const { t } = useI18n();

const weekdays = computed(() => Array.from({ length: 7 }, (_, index) => dayjs().day(index).format('ddd')));

/** 稿面网格覆盖整月所在周(首格回退到当月 1 日所在周的周日,末格前进到月末所在周的周六) */
const weeks = computed(() => {
  const first = dayjs(`${props.month}-01`);
  const start = first.subtract(first.day(), 'day');
  const last = first.endOf('month');
  const total = last.diff(start, 'day') + 1;
  const rows: string[][] = [];
  for (let i = 0; i < total; i += 7) {
    rows.push(Array.from({ length: 7 }, (_, j) => start.add(i + j, 'day').format('YYYY-MM-DD')));
  }
  return rows;
});

const legend = computed<{ state: CellState; label: string }[]>(() => [
  { state: 'available', label: t('availability.legend.available') },
  { state: 'low', label: t('availability.legend.low') },
  { state: 'sold', label: t('availability.legend.sold') },
  { state: 'blocked', label: t('availability.legend.blocked') },
]);

function stateOf(date: string): CellState {
  const day = props.days[date];
  return day ? cellState(day) : 'available';
}

function badgeOf(date: string): string {
  const day = props.days[date];
  if (!day) return '';
  return day.isClosed === 1 ? t('availability.cell.blocked') : t('availability.cell.avail', { count: day.stockLeft });
}

function priceOf(date: string): string {
  const day = props.days[date];
  if (!day) return '';
  if (day.isClosed === 1) return '-';
  return `${props.currency} ${priceShort(day.price)}`;
}

function leftOf(date: string): number {
  return props.days[date]?.stockLeft ?? 0;
}
</script>

<template>
  <div class="cal-card">
    <div class="cal-head">
      <div v-for="label in weekdays" :key="label" class="cal-head-cell">{{ label }}</div>
    </div>

    <div class="cal-body">
      <div v-for="(week, weekIndex) in weeks" :key="weekIndex" class="cal-week" :class="{ last: weekIndex === weeks.length - 1 }">
        <button
          v-for="date in week"
          :key="date"
          type="button"
          class="cal-cell"
          :class="[stateOf(date), { selected: date === selectedDate }]"
          @click="emit('select', date)"
        >
          <span class="cal-top">
            <span v-if="stateOf(date) === 'low'" class="cal-warn">
              <AvIcon name="alert-circle" :size="12" />
              <em>{{ t('availability.cell.left', { count: leftOf(date) }) }}</em>
            </span>
            <span v-else-if="stateOf(date) === 'sold'" class="cal-sold">{{ t('availability.legend.sold') }}</span>
            <span v-else class="cal-spacer"></span>
            <span class="cal-date" :class="{ outside: dayjs(date).format('YYYY-MM') !== month }">{{ dayjs(date).format('D') }}</span>
          </span>

          <span class="cal-info" :class="{ tight: stateOf(date) === 'low' || stateOf(date) === 'sold' }">
            <span class="cal-badge">{{ badgeOf(date) }}</span>
            <span class="cal-price">{{ priceOf(date) }}</span>
          </span>

          <span v-if="date === selectedDate" class="cal-check"><AvIcon name="check" :size="10" /></span>
        </button>
      </div>
    </div>

    <div class="cal-legend">
      <span v-for="item in legend" :key="item.state" class="cal-legend-item">
        <i :class="item.state"></i>
        {{ item.label }}
      </span>
    </div>
  </div>
</template>

<style scoped lang="less">
@import '../tokens.less';

.cal-card {
  overflow: hidden;
  border: 1px solid @av-line;
  border-radius: 16px;
  background: #fff;
}

/* 表头:底 @av-soft,每格右+下描边,末格只下描边 */
.cal-head {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  background: @av-soft;
}
.cal-head-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
  border-right: 1px solid @av-line;
  border-bottom: 1px solid @av-line;
  color: @av-ink;
  font-family: @av-font-body;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;

  &:last-child {
    border-right: 0;
  }
}

.cal-week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.cal-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 110px;
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
  .cal-week.last & {
    border-bottom: 0;
  }
  &:hover {
    background: @av-soft;
  }
  /* 选中态稿面为 2px 主色描边;用 inset 阴影补足第 2 像素,避免边框变化撑动网格 */
  &.selected {
    background: @av-primary-soft;
    border-color: @av-primary;
    box-shadow: inset 0 0 0 1px @av-primary;
  }
}

.cal-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.cal-spacer {
  display: block;
  width: 1px;
  height: 10px;
}
.cal-date {
  color: @av-ink;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;

  &.outside {
    opacity: 0.4;
  }
}
.cal-warn {
  display: flex;
  align-items: center;
  gap: 2px;
  color: @av-low;

  em {
    font-size: 10px;
    font-style: normal;
    font-weight: 600;
    line-height: 1.5;
  }
}
.cal-sold {
  color: @av-sold;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
  text-transform: uppercase;
}

.cal-info {
  display: flex;
  flex-direction: column;
  gap: 8px;

  /* 稿面:低库存/售罄两态的徽标与价格间距是 4,常态是 8 */
  &.tight {
    gap: 4px;
  }
}
.cal-badge {
  align-self: flex-start;
  padding: 4px 8px;
  border: 1px solid;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
}
.cal-price {
  color: @av-primary;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}

/* 四态配色(徽标底/描边/字与稿面逐字一致) */
.cal-cell.available .cal-badge {
  border-color: @av-primary;
  background: @av-primary-soft;
  color: @av-primary;
}
.cal-cell.low .cal-badge {
  border-color: @av-low;
  background: @av-low-soft;
  color: @av-low;
}
.cal-cell.sold .cal-badge {
  border-color: @av-sold;
  background: @av-sold-soft;
  color: @av-sold;
}
.cal-cell.blocked .cal-badge {
  border-color: @av-line;
  background: @av-line;
  color: @av-ink-muted;
}
.cal-cell.blocked .cal-price {
  color: @av-ink-muted;
}

.cal-check {
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

.cal-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 16px;
  border-top: 1px solid @av-line;
  background: #fff;
}
.cal-legend-item {
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

@media (max-width: 1180px) {
  .cal-card {
    overflow-x: auto;
  }
  .cal-head,
  .cal-week {
    min-width: 900px;
  }
}
</style>
