<script setup lang="ts">
/**
 * 右侧编辑面板(Figma `1163:16345` 的 Edit Panel 组件集 `1145:10347` / `1163:17357`)。
 * 两种模式共用骨架,仅标题与头部徽标不同:
 *  - `normal` → `Update Selected Dates` + 日历图标 + 选中日期
 *  - `bulk`   → `Apply Bulk Changes` + 对勾图标 + `{n} room-dates selected`
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AvIcon from './AvIcon.vue';

const props = defineProps<{
  variant: 'normal' | 'bulk';
  /** normal: 选中日期文本;bulk: 已选 room-date 数量 */
  dateLabel: string;
  selectedCount: number;
  currency: string;
  /** 保存按钮的权限键(与后端 #[Permission] 同一把钥匙):单日 = mch:availability:edit,批量 = mch:availability:bulk-update */
  savePerm: string;
  saving?: boolean;
}>();

const emit = defineEmits<{ (e: 'close'): void; (e: 'save'): void }>();

const { t } = useI18n();

/** 表单三字段(稿面 Room Status / Available Rooms / Base Price per Night) */
const status = defineModel<'open' | 'blocked'>('status', { required: true });
const rooms = defineModel<number>('rooms', { required: true });
const price = defineModel<number>('price', { required: true });

const priceFocused = ref(false);
const priceText = ref('');

const title = computed(() => (props.variant === 'bulk' ? t('availability.panel.applyBulk') : t('availability.panel.updateSelected')));
const badgeIcon = computed(() => (props.variant === 'bulk' ? 'check-circle' : 'calendar'));

function formatPrice(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0';
}

watch(price, (value) => {
  if (!priceFocused.value) priceText.value = formatPrice(value);
}, { immediate: true });

function onPriceFocus(): void {
  priceFocused.value = true;
  priceText.value = String(price.value);
}

function onPriceInput(event: Event): void {
  priceText.value = (event.target as HTMLInputElement).value;
}

function onPriceBlur(): void {
  priceFocused.value = false;
  const parsed = Number(priceText.value.replace(/[^0-9.]/g, ''));
  price.value = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  priceText.value = formatPrice(price.value);
}

function stepRooms(delta: number): void {
  rooms.value = Math.max(0, rooms.value + delta);
}
</script>

<template>
  <aside class="panel">
    <header class="panel-header">
      <div class="panel-heading">
        <h2>{{ title }}</h2>
        <p class="panel-badge">
          <AvIcon :name="badgeIcon" />
          <span v-if="variant === 'bulk'">{{ t('availability.panel.selectedCount', { count: selectedCount }) }}</span>
          <span v-else>{{ dateLabel }}</span>
        </p>
      </div>
      <button type="button" class="panel-close" :aria-label="t('common.cancel')" @click="emit('close')">
        <AvIcon name="x" :size="15" />
      </button>
    </header>

    <div class="panel-form">
      <div class="form-group">
        <span class="form-label">{{ t('availability.panel.roomStatus') }}</span>
        <div class="segmented">
          <button type="button" class="segment" :class="{ active: status === 'open' }" @click="status = 'open'">
            {{ t('availability.panel.open') }}
          </button>
          <button type="button" class="segment" :class="{ active: status === 'blocked' }" @click="status = 'blocked'">
            {{ t('availability.panel.blocked') }}
          </button>
        </div>
      </div>

      <div class="form-group">
        <span class="form-label">{{ t('availability.fields.availableRooms') }}</span>
        <div class="stepper">
          <button type="button" class="stepper-btn" :aria-label="t('availability.panel.decrease')" @click="stepRooms(-1)">
            <AvIcon name="minus" />
          </button>
          <span class="stepper-value">{{ rooms }}</span>
          <button type="button" class="stepper-btn" :aria-label="t('availability.panel.increase')" @click="stepRooms(1)">
            <AvIcon name="plus" />
          </button>
        </div>
      </div>

      <div class="form-group">
        <span class="price-label">{{ t('availability.fields.basePrice') }}</span>
        <div class="price-input">
          <input
            v-model="priceText"
            class="price-field"
            type="text"
            inputmode="decimal"
            @focus="onPriceFocus"
            @input="onPriceInput"
            @blur="onPriceBlur"
          />
          <!--
            稿面此处是币种下拉(MMK + chevron)。本次按用户决定改为**只读**:后端 saveDay/batchSet
            只落 price,不接收 currency,做成可切换会是不生效的假控件,故只保留币种胶囊、去掉 chevron。
          -->
          <span class="currency-chip">{{ currency }}</span>
        </div>
      </div>
    </div>

    <footer class="panel-footer">
      <button type="button" class="btn-cancel" @click="emit('close')">{{ t('common.cancel') }}</button>
      <button v-perm="savePerm" type="button" class="btn-save" :disabled="saving" @click="emit('save')">
        {{ t('availability.panel.saveUpdates') }}
      </button>
    </footer>
  </aside>
</template>

<style scoped lang="less">
@import '../tokens.less';

.panel {
  display: flex;
  width: 380px;
  flex: none;
  flex-direction: column;
  align-self: flex-start;
  border: 1px solid @av-line;
  border-radius: 16px;
  background: #fff;
  box-shadow: @av-shadow-panel;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid @av-line;
}
.panel-heading {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;

  h2 {
    margin: 0;
    color: @av-ink;
    font-family: @av-font-page;
    font-size: 16px;
    font-weight: 800;
    line-height: 1.5;
  }
}
.panel-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: @av-primary;
  font-family: @av-font-body;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}
.panel-close {
  display: flex;
  height: 44px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: @av-ink;
  cursor: pointer;

  &:hover {
    background: @av-soft;
  }
}

.panel-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-label {
  color: @av-ink-muted;
  font-family: @av-font-page;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.5;
  text-transform: uppercase;
}

.segmented {
  display: flex;
  gap: 0;
  padding: 3px;
  border-radius: 8px;
  background: @av-chip-bg;
}
.segment {
  flex: 1;
  height: 34px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: @av-ink-muted;
  font-family: @av-font-page;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;

  &.active {
    background: #fff;
    color: @av-ink;
    font-weight: 700;
    box-shadow: @av-shadow-panel;
  }
}

.stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 4px;
  border: 1px solid @av-line;
  border-radius: 8px;
}
.stepper-btn {
  display: flex;
  width: 36px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: @av-chip-bg;
  color: @av-ink;
  cursor: pointer;

  &:hover {
    background: darken(@av-chip-bg, 4%);
  }
}
.stepper-value {
  flex: 1;
  color: @av-ink;
  font-family: @av-font-body;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
}

.price-label {
  color: @av-ink-label;
  font-family: @av-font-page;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}
.price-input {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 8px 8px 8px 12px;
  border: 0.8px solid @av-line;
  border-radius: 8px;
  background: #fff;
}
.price-field {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: @av-ink;
  font-family: @av-font-page;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  outline: none;
}
.currency-chip {
  display: flex;
  flex: none;
  align-items: center;
  padding: 4px;
  border: 0.3px solid @av-primary;
  border-radius: 4px;
  background: @av-primary-soft;
  color: @av-primary;
  font-family: @av-font-page;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.panel-footer {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid @av-line;
  background: @av-soft;
  border-radius: 0 0 16px 16px;
}
.btn-cancel,
.btn-save {
  flex: 1;
  padding: 12px 0;
  border-radius: 8px;
  font-family: @av-font-body;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
  cursor: pointer;
}
.btn-cancel {
  border: 1px solid @av-line;
  background: #fff;
  color: @av-ink-muted;
}
.btn-save {
  border: 0;
  background: @av-primary;
  color: #fff;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>
