<script setup lang="ts">
/**
 * Room Type 下拉(Figma `1163:16345` 的 `room-type-dropdown` + `room-type-dropdown-panel`)。
 * 稿面控件不是 antd Select 形态(bed 图标 + `#F8FAFC` 底 + 蓝色描边),故自绘。
 */
import { computed, ref } from 'vue';
import AvIcon from './AvIcon.vue';
import { useDismiss } from '../useDismiss';

const props = withDefaults(
  defineProps<{
    modelValue: number | null;
    options: { id: number; name: string }[];
    /** 稿面:日历模式选中态描边为主色,批量模式的快速筛选为普通描边 */
    variant?: 'primary' | 'default';
    placeholder: string;
  }>(),
  { variant: 'default' },
);

const emit = defineEmits<{ (e: 'update:modelValue', value: number | null): void }>();

const root = ref<HTMLElement | null>(null);
const open = ref(false);
const current = computed(() => props.options.find((item) => item.id === props.modelValue) ?? null);

useDismiss(root, open, () => (open.value = false));

function pick(id: number): void {
  emit('update:modelValue', id);
  open.value = false;
}
</script>

<template>
  <div ref="root" class="rt-select">
    <button type="button" class="rt-trigger" :class="variant" :aria-expanded="open" @click="open = !open">
      <AvIcon name="bed" :size="16" />
      <span class="rt-value">{{ current ? current.name : placeholder }}</span>
      <AvIcon name="chevron-down" :size="14" />
    </button>
    <div v-if="open" class="rt-panel" role="listbox">
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        role="option"
        :aria-selected="option.id === modelValue"
        class="rt-item"
        :class="{ active: option.id === modelValue }"
        @click="pick(option.id)"
      >
        {{ option.name }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="less">
@import '../tokens.less';

.rt-select {
  position: relative;
}
.rt-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 37px;
  padding: 8px 12px;
  border: 1px solid @av-line;
  border-radius: 8px;
  background: @av-soft;
  color: @av-ink;
  font-family: @av-font-body;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;

  &.primary {
    border-color: @av-primary;
  }
}
.rt-value {
  max-width: 220px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.rt-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 30;
  min-width: 150px;
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid @av-line;
  border-radius: 8px;
  background: #fff;
  box-shadow: @av-shadow-dropdown;
}
.rt-item {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 10px 12px;
  border: 0;
  background: transparent;
  color: @av-ink;
  font-family: @av-font-body;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: @av-soft;
  }
  &.active {
    background: @av-chip-bg;
  }
}
</style>
