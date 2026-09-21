<script setup lang="ts">
/**
 * Select Period 月份导航 + 月份浮层(Figma `1163:16345` 的 `month-navigator` 与 `calendar-popover`)。
 * 浮层内是「年 ‹ › + 12 个月格」,选中格为主色实底。
 */
import { computed, ref, watch } from 'vue';
import dayjs from 'dayjs';
import AvIcon from './AvIcon.vue';
import { useDismiss } from '@/composables/useDismiss';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const root = ref<HTMLElement | null>(null);
const open = ref(false);
const pickerYear = ref(Number(props.modelValue.slice(0, 4)));

const current = computed(() => dayjs(`${props.modelValue}-01`));
const monthLabel = computed(() => current.value.format('MMMM YYYY'));
const months = computed(() =>
  Array.from({ length: 12 }, (_, index) => dayjs(`${pickerYear.value}-${String(index + 1).padStart(2, '0')}-01`).format('MMM')),
);

useDismiss(root, open, () => (open.value = false));

watch(open, (value) => {
  if (value) pickerYear.value = Number(props.modelValue.slice(0, 4));
});

function shiftMonth(delta: number): void {
  emit('update:modelValue', current.value.add(delta, 'month').format('YYYY-MM'));
}

function shiftYear(delta: number): void {
  pickerYear.value += delta;
}

function pickMonth(index: number): void {
  emit('update:modelValue', `${pickerYear.value}-${String(index + 1).padStart(2, '0')}`);
  open.value = false;
}
</script>

<template>
  <div ref="root" class="mn">
    <div class="mn-control">
      <button type="button" class="mn-step" :aria-label="'previous month'" @click="shiftMonth(-1)">
        <AvIcon name="chevron-left" />
      </button>
      <button type="button" class="mn-label" :aria-expanded="open" @click="open = !open">{{ monthLabel }}</button>
      <button type="button" class="mn-step" :aria-label="'next month'" @click="shiftMonth(1)">
        <AvIcon name="chevron-right" />
      </button>
    </div>

    <div v-if="open" class="mn-popover">
      <div class="mn-head">
        <button type="button" class="mn-head-btn" @click="shiftYear(-1)"><AvIcon name="chevron-left" /></button>
        <span class="mn-year">{{ pickerYear }}</span>
        <button type="button" class="mn-head-btn" @click="shiftYear(1)"><AvIcon name="chevron-right" /></button>
      </div>
      <div class="mn-grid">
        <button
          v-for="(label, index) in months"
          :key="label"
          type="button"
          class="mn-cell"
          :class="{ active: pickerYear === Number(modelValue.slice(0, 4)) && index === Number(modelValue.slice(5, 7)) - 1 }"
          @click="pickMonth(index)"
        >
          {{ label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
@import '../tokens.less';

.mn {
  position: relative;
}
.mn-control {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 37px;
  padding: 8px 12px;
  border: 1px solid @av-line;
  border-radius: 8px;
  background: @av-soft;
}
.mn-step {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: 1px solid @av-line;
  border-radius: 4px;
  background: #fff;
  color: @av-ink;
  cursor: pointer;

  &:hover {
    border-color: @av-primary;
    color: @av-primary;
  }
}
.mn-label {
  width: 120px;
  border: 0;
  background: transparent;
  color: @av-ink;
  font-family: @av-font-body;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
  cursor: pointer;
}
.mn-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 30;
  width: 320px;
  padding: 20px;
  border: 1px solid @av-line;
  border-radius: 16px;
  background: #fff;
  box-shadow: @av-shadow-panel;
}
.mn-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.mn-year {
  color: @av-ink;
  font-family: @av-font-body;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.5;
}
.mn-head-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 8px;
  border: 1px solid @av-line;
  border-radius: 8px;
  background: @av-soft;
  color: @av-ink;
  cursor: pointer;

  &:hover {
    border-color: @av-primary;
    color: @av-primary;
  }
}
.mn-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.mn-cell {
  height: 44px;
  border: 1px solid @av-line;
  border-radius: 10px;
  background: @av-soft;
  color: @av-ink;
  font-family: @av-font-body;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
  cursor: pointer;

  &:hover {
    border-color: @av-primary;
  }
  &.active {
    border-color: @av-primary;
    background: @av-primary;
    color: #fff;
    font-weight: 800;
  }
}
</style>
