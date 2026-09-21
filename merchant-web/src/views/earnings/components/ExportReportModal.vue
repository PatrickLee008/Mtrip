<script setup lang="ts">
/**
 * 导出财务报表弹窗(Figma `1306:18423` Export Report Dialog,520 宽)。
 *
 * 稿面三个格式卡 Excel / CSV / PDF 全部保留(顺序与配色照稿),
 * 但当前只有 CSV 真正可下载 —— Excel/PDF 置灰并标注「即将开放」,
 * 不引入 xlsx / pdf 生成依赖。报告类型是真实下拉(两种都能产出 CSV)。
 */
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EaIcon from './EaIcon.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    rangeLabel: string;
    loading?: boolean;
  }>(),
  { loading: false },
);

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void;
  (event: 'download', payload: { reportType: string; format: string }): void;
}>();

const { t } = useI18n();

/** 可下载的格式(Excel / PDF 待接入) */
const FORMATS = [
  { key: 'xlsx', label: 'Excel', ext: '.xlsx', available: false },
  { key: 'csv', label: 'CSV', ext: '.csv', available: true },
  { key: 'pdf', label: 'PDF', ext: '.pdf', available: false },
];

const reportType = ref('settlement');
const format = ref('csv');

function close(): void {
  emit('update:open', false);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close();
  }
}

function submit(): void {
  if (props.loading) {
    return;
  }
  emit('download', { reportType: reportType.value, format: format.value });
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      window.addEventListener('keydown', onKeydown);
    } else {
      window.removeEventListener('keydown', onKeydown);
    }
  },
);

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="ea-modal-scrim" @click.self="close">
      <section class="ea-modal" role="dialog" aria-modal="true">
        <header class="modal-header">
          <h2 class="modal-title">{{ t('earnings.exportDialog.title') }}</h2>
          <button type="button" class="icon-btn" :aria-label="t('common.cancel')" @click="close">
            <EaIcon name="x" :size="24" />
          </button>
        </header>

        <div class="modal-content">
          <label class="field">
            <span class="field-label">{{ t('earnings.exportDialog.reportType') }}</span>
            <span class="select-wrapper">
              <select v-model="reportType" class="select">
                <option value="settlement">{{ t('earnings.exportDialog.typeSettlement') }}</option>
                <option value="bookings">{{ t('earnings.exportDialog.typeBookings') }}</option>
              </select>
              <EaIcon name="chevron-down" :size="24" class="select-icon" />
            </span>
          </label>

          <div class="field">
            <span class="field-label">{{ t('earnings.exportDialog.dateRange') }}</span>
            <span class="range-box">
              <EaIcon name="calendar" :size="14" />
              <span class="range-text">{{ rangeLabel }}</span>
            </span>
          </div>

          <div class="field">
            <span class="field-label">{{ t('earnings.exportDialog.format') }}</span>
            <div class="format-row">
              <button
                v-for="item in FORMATS"
                :key="item.key"
                type="button"
                class="format-card"
                :class="{ active: format === item.key && item.available, disabled: !item.available }"
                :disabled="!item.available"
                :title="item.available ? item.ext : t('earnings.exportDialog.comingSoon')"
                @click="format = item.key"
              >
                <EaIcon name="file-text" :size="36" />
                <span class="format-text">
                  <span class="format-label">{{ item.label }}</span>
                  <span class="format-ext">{{ item.ext }}</span>
                </span>
              </button>
            </div>
            <p class="format-hint">{{ t('earnings.exportDialog.comingSoonHint') }}</p>
          </div>
        </div>

        <footer class="modal-footer">
          <button type="button" class="btn ghost" @click="close">{{ t('common.cancel') }}</button>
          <button type="button" class="btn primary" :disabled="loading" @click="submit">
            <EaIcon name="download" :size="16" />
            {{ t('earnings.exportDialog.download') }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped lang="less">
@import '../tokens.less';

.ea-modal-scrim {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}

.ea-modal {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 520px;
  max-width: 100%;
  padding: 32px 0 24px;
  border-radius: @ea-radius-panel;
  background: #ffffff;
  box-shadow: @ea-shadow-modal;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.modal-title {
  margin: 0;
  color: @ea-ink;
  font-family: @ea-font-display;
  font-size: 20px;
  font-weight: 700;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: @ea-ink;
  cursor: pointer;
}

.modal-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 24px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  color: @ea-ink;
  font-family: @ea-font-body;
  font-size: 14px;
  font-weight: 600;
}

.select-wrapper {
  position: relative;
  display: block;
}

.select {
  width: 100%;
  height: @ea-control-height;
  padding: 0 36px 0 12px;
  border: 1px solid @ea-line;
  border-radius: @ea-radius-control;
  background: #ffffff;
  color: @ea-ink-muted;
  font-family: @ea-font-body;
  font-size: 12px;
  font-weight: 600;
  appearance: none;
  cursor: pointer;
}

.select-icon {
  position: absolute;
  top: 50%;
  right: 10px;
  color: @ea-ink;
  pointer-events: none;
  transform: translateY(-50%);
}

.range-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid @ea-line;
  border-radius: @ea-radius-control;
  color: @ea-ink-muted;
}

.range-text {
  font-family: @ea-font-body;
  font-size: 12px;
  font-weight: 600;
}

.format-row {
  display: flex;
  gap: 12px;
}

.format-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1.5px solid @ea-line;
  border-radius: 10px;
  background: transparent;
  color: @ea-ink-muted;
  cursor: pointer;

  &.active {
    border-color: @ea-primary;
    background: rgba(65, 105, 237, 0.04);
    color: @ea-primary;
  }

  &.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.format-text {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.format-label {
  font-family: @ea-font-body;
  font-size: 14px;
  font-weight: 600;
}

.format-ext {
  font-family: @ea-font-body;
  font-size: 12px;
  font-weight: 400;
}

.format-hint {
  margin: 0;
  color: @ea-ink-aux;
  font-family: @ea-font-body;
  font-size: 12px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 24px 24px 0;
  border-top: 1px solid @ea-line;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: @ea-control-height;
  border: 0;
  cursor: pointer;
  font-family: @ea-font-body;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;

  &.ghost {
    padding: 0 12px;
    border: 1px solid @ea-line;
    border-radius: 6px;
    background: transparent;
    color: @ea-ink;
  }

  &.primary {
    padding: 0 20px;
    border-radius: @ea-radius-control;
    background: @ea-primary;
    color: #ffffff;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }
}
</style>
