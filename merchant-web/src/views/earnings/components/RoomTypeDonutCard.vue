<script setup lang="ts">
/**
 * 房型表现环形图卡(Figma `1306:18423` charts-grid grid-row-2 右)。
 * 圆心是总预订数 + "Bookings",右侧图例是「色块 + 房型名 + 占比」三行(稿面 50% / 35% / 15%)。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomTypePerformanceItem } from '@/api/stats';
import { DONUT_RADIUS, DONUT_STROKE, donutSegments, donutTotal } from '../helpers';
import ChartPanel from './ChartPanel.vue';

const props = defineProps<{ items: RoomTypePerformanceItem[] }>();

const { t } = useI18n();

const segments = computed(() => donutSegments(props.items));
const total = computed(() => donutTotal(props.items));
</script>

<template>
  <ChartPanel :title="t('earnings.charts.roomType')" bordered :padding="20">
    <div class="donut-row">
      <div class="donut">
        <svg class="donut-svg" viewBox="0 0 156 156" role="img">
          <circle cx="78" cy="78" :r="DONUT_RADIUS" fill="none" stroke="#EBF0FF" :stroke-width="DONUT_STROKE" />
          <circle
            v-for="segment in segments"
            :key="segment.key"
            cx="78"
            cy="78"
            :r="DONUT_RADIUS"
            fill="none"
            :stroke="segment.color"
            :stroke-width="DONUT_STROKE"
            :stroke-dasharray="segment.dash"
            :stroke-dashoffset="segment.offset"
            transform="rotate(-90 78 78)"
          />
        </svg>
        <div class="donut-center">
          <span class="donut-total">{{ total }}</span>
          <span class="donut-caption">{{ t('earnings.charts.bookings') }}</span>
        </div>
      </div>
      <ul class="legend">
        <li v-for="segment in segments" :key="segment.key" class="legend-item">
          <span class="legend-swatch" :style="{ background: segment.color }" />
          <span class="legend-name">{{ segment.name }}</span>
          <span class="legend-percent">{{ segment.percent }}%</span>
        </li>
      </ul>
    </div>
  </ChartPanel>
</template>

<style scoped lang="less">
@import '../tokens.less';

.donut-row {
  display: flex;
  align-items: center;
  gap: 24px;
  width: 100%;
}

.donut {
  position: relative;
  width: 156px;
  height: 156px;
  flex: none;
}

.donut-svg {
  display: block;
  width: 156px;
  height: 156px;
}

.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  pointer-events: none;
}

.donut-total {
  color: @ea-ink;
  font-family: @ea-font-display;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}

.donut-caption {
  color: @ea-ink-muted;
  font-family: @ea-font-body;
  font-size: 12px;
  font-weight: 500;
}

.legend {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.legend-swatch {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex: none;
}

.legend-name {
  flex: 1;
  overflow: hidden;
  color: @ea-ink;
  font-family: @ea-font-body;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-percent {
  color: @ea-ink-muted;
  font-family: @ea-font-body;
  font-size: 12px;
  font-weight: 500;
}
</style>
