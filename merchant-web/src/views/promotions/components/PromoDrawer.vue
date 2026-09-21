<script setup lang="ts">
/**
 * 新建 / 编辑促销抽屉(Figma `2285:21516` 的 `drawer`)。
 *
 * 稿面结构:头部(标题 + 关闭)→ 主体(表单分组,间距 20)→ 页脚(Cancel / Publish Promotion)。
 * 面板宽 562、头部/主体/页脚 padding 24、头部与页脚各一条 1px 分隔线、遮罩 `rgba(15,23,42,0.4)`。
 *
 * ## 稿面字段 + 功能需求追加字段
 * 稿面按三种促销各画了一组字段;功能需求额外要求「适用物业 / 兑换上限 / 出资模式 / 条款」,
 * 故在稿面字段之后按同一 Label/Input 令牌追加(见文件内 `[req]` 注释),其余顺序照稿。
 *
 * ## 百分比 ↔ 计价口径
 * 表单里 `discountValue` 始终是**设计口径**(百分比促销 = 立减百分比),换算交给
 * `helpers.formToPayload` + 后端 `discountPair()`,本组件不做 10 分制转换。
 */
import { computed, reactive, ref, watch } from 'vue';
import dayjs, { type Dayjs } from 'dayjs';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import PromoIcon from './PromoIcon.vue';
import {
  DISCOUNT_UNIT,
  PROMOTION_KIND,
  type MerchantPromotion,
  type PromotionOptions,
  type PromotionPayload,
} from '@/api/promotions';
import {
  defaultForm,
  formFromDetail,
  formToPayload,
  randomPromoCode,
  validateForm,
  type PromotionForm,
} from '../helpers';

const props = defineProps<{
  open: boolean;
  /** 有值 = 编辑,无值 = 新建 */
  detail: MerchantPromotion | null;
  /** 新建时的初始形态(跟随当前 Tab) */
  kind: number;
  options: PromotionOptions;
  saving: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: PromotionPayload): void;
}>();

const { t } = useI18n();
const form = reactive<PromotionForm>(defaultForm());
/** 日期区间选择器的桥接值(表单里存字符串,选择器要 dayjs) */
const dateRange = ref<[Dayjs, Dayjs] | null>(null);

const editing = computed(() => props.detail !== null && Number(props.detail.id) > 0);
const title = computed(() => (editing.value ? t('promotions.drawer.editTitle') : t('promotions.drawer.title')));

/** 折扣单位是否按「立减百分比」处理(kind=3 才由用户选) */
const isPercentUnit = computed(() => form.promotionKind === PROMOTION_KIND.percentage
  || form.promotionKind === PROMOTION_KIND.longStay
  || (form.promotionKind === PROMOTION_KIND.promoCode && form.discountUnit === DISCOUNT_UNIT.percent));

const unitSuffix = computed(() => (isPercentUnit.value ? '%' : props.options.currency));

/** 房型可选项:只列已选物业下的房型 */
const roomOptions = computed(() => props.options.roomTypes.filter((room) => form.propertyIds.includes(room.property_id)));

/** 出资模式:商家自建促销一律商家全额出资(平台出资/共担来自平台活动,见 /campaigns)*/
const fundingText = computed(() => t('promotions.funding.merchantFull'));

function reset(): void {
  const next = props.detail ? formFromDetail(props.detail) : defaultForm(props.kind);
  Object.assign(form, next);
  dateRange.value = next.validStart && next.validEnd ? [dayjs(next.validStart), dayjs(next.validEnd)] : null;
  if (form.validStart === '' && form.validEnd === '') {
    // 稿面默认给一段已填好的有效期窗口(30 天)
    const start = dayjs();
    const end = dayjs().add(30, 'day');
    dateRange.value = [start, end];
    form.validStart = start.format('YYYY-MM-DD');
    form.validEnd = end.format('YYYY-MM-DD');
  }
}

// immediate:组件在「已打开」状态下挂载时(SSR 校验 / 直接进入编辑)也要完成一次回填
watch(() => props.open, (open) => {
  if (open) reset();
}, { immediate: true });

watch(dateRange, (range) => {
  form.validStart = range && range[0] ? range[0].format('YYYY-MM-DD') : '';
  form.validEnd = range && range[1] ? range[1].format('YYYY-MM-DD') : '';
});

/** 物业变化时清掉不再属于所选物业的房型,避免提交出越界房型被后端拒绝 */
watch(() => form.propertyIds.slice(), () => {
  const allowed = roomOptions.value.map((room) => room.id);
  form.roomTypeIds = form.roomTypeIds.filter((id) => allowed.includes(id));
});

function pickKind(kind: number): void {
  if (form.promotionKind === kind) return;
  form.promotionKind = kind;
  form.discountUnit = kind === PROMOTION_KIND.fixedAmount ? DISCOUNT_UNIT.amount : DISCOUNT_UNIT.percent;
  form.discountValue = kind === PROMOTION_KIND.fixedAmount ? 0 : 20;
  if (kind === PROMOTION_KIND.longStay && form.minNights < 2) form.minNights = 3;
}

function pickUnit(unit: number): void {
  form.discountUnit = unit;
}

function generateCode(): void {
  form.promoCode = randomPromoCode();
}

function submit(): void {
  // 优惠码促销在稿面里没有「促销名称」输入框,券码即标识 —— 用券码兜底名称
  if (form.promotionKind === PROMOTION_KIND.promoCode && form.couponName.trim() === '') {
    form.couponName = form.promoCode.trim().toUpperCase();
  }
  const invalid = validateForm(form);
  if (invalid !== '') {
    message.warning(t(invalid));
    return;
  }
  // 所选物业必须属于同一商户:商家出资优惠不允许跨商户外溢(集团账号尤其容易踩)
  const merchants = Array.from(new Set(
    props.options.properties.filter((item) => form.propertyIds.includes(item.id)).map((item) => item.merchant_id),
  ));
  if (merchants.length !== 1) {
    message.warning(t('promotions.validation.oneMerchant'));
    return;
  }
  emit('save', { ...formToPayload(form), merchantId: merchants[0] });
}

function close(): void {
  emit('close');
}
</script>

<template>
  <div v-if="open" class="drawer-root">
    <div class="scrim" @click="close" />
    <aside class="drawer">
      <header class="drawer-header">
        <h2 class="drawer-title">{{ title }}</h2>
        <button type="button" class="icon-btn" @click="close">
          <PromoIcon name="x" :size="14" />
        </button>
      </header>

      <div class="drawer-body">
        <!-- 稿面:Discount Type 三选卡 -->
        <section class="form-field">
          <span class="field-label">{{ t('promotions.drawer.discountType') }}</span>
          <div class="radio-cards">
            <button
              type="button"
              class="radio-card"
              :class="{ active: form.promotionKind === PROMOTION_KIND.percentage }"
              @click="pickKind(PROMOTION_KIND.percentage)"
            >
              <PromoIcon name="percent" :size="16" />
              <span>% {{ t('promotions.kind.1') }}</span>
            </button>
            <button
              type="button"
              class="radio-card"
              :class="{ active: form.promotionKind === PROMOTION_KIND.fixedAmount }"
              @click="pickKind(PROMOTION_KIND.fixedAmount)"
            >
              <PromoIcon name="banknote" :size="16" />
              <span>$ {{ t('promotions.kind.2') }}</span>
            </button>
            <button
              type="button"
              class="radio-card"
              :class="{ active: form.promotionKind === PROMOTION_KIND.promoCode }"
              @click="pickKind(PROMOTION_KIND.promoCode)"
            >
              <PromoIcon name="ticket" :size="16" />
              <span>{{ t('promotions.drawer.promoCodeType') }}</span>
            </button>
          </div>
        </section>

        <!-- 稿面(kind=3):Coupon Code + Generate Random -->
        <section v-if="form.promotionKind === PROMOTION_KIND.promoCode" class="form-field">
          <span class="field-label">{{ t('promotions.drawer.couponCode') }}</span>
          <div class="inline-row">
            <input v-model="form.promoCode" class="text-input" :placeholder="t('promotions.drawer.codePlaceholder')" />
            <button type="button" class="btn primary" @click="generateCode">{{ t('promotions.drawer.generate') }}</button>
          </div>
        </section>

        <!-- 稿面(kind=1/2/4):Promotion Name -->
        <section v-else class="form-field">
          <span class="field-label">{{ t('promotions.drawer.name') }}</span>
          <input v-model="form.couponName" class="text-input" :placeholder="t('promotions.drawer.namePlaceholder')" />
        </section>

        <!-- 稿面(kind=1/2/4):Description -->
        <section v-if="form.promotionKind !== PROMOTION_KIND.promoCode" class="form-field">
          <span class="field-label">{{ t('promotions.drawer.description') }}</span>
          <input v-model="form.description" class="text-input" :placeholder="t('promotions.drawer.descriptionPlaceholder')" />
        </section>

        <!-- 稿面:Discount Value(+ kind=3 的单位下拉) -->
        <section class="form-field">
          <span class="field-label">{{ t('promotions.drawer.discountValue') }}</span>
          <div class="inline-row">
            <a-select
              v-if="form.promotionKind === PROMOTION_KIND.promoCode"
              :value="form.discountUnit"
              class="unit-select"
              :options="[
                { value: DISCOUNT_UNIT.percent, label: `% ${t('promotions.unit.percent')}` },
                { value: DISCOUNT_UNIT.amount, label: `${options.currency} ${t('promotions.unit.amount')}` },
              ]"
              @change="pickUnit"
            />
            <div v-else class="unit-chip">{{ unitSuffix }}</div>
            <a-input-number v-model:value="form.discountValue" class="grow" :min="0" :precision="2" />
          </div>
        </section>

        <!-- 功能需求:长住规则(最少入住晚数 / 适用入住时长上限) -->
        <section v-if="form.promotionKind === PROMOTION_KIND.longStay" class="form-field">
          <span class="field-label">{{ t('promotions.drawer.stayRules') }}</span>
          <div class="inline-row">
            <div class="mini-field">
              <span class="mini-label">{{ t('promotions.drawer.minNights') }}</span>
              <a-input-number v-model:value="form.minNights" class="full" :min="2" :precision="0" />
            </div>
            <div class="mini-field">
              <span class="mini-label">{{ t('promotions.drawer.maxNights') }}</span>
              <a-input-number v-model:value="form.maxNights" class="full" :min="0" :precision="0" />
            </div>
          </div>
        </section>

        <!-- 功能需求:适用物业(稿面未画,按同一令牌追加) -->
        <section class="form-field">
          <span class="field-label">{{ t('promotions.drawer.properties') }}</span>
          <a-select
            v-model:value="form.propertyIds"
            mode="multiple"
            show-search
            option-filter-prop="label"
            :placeholder="t('promotions.drawer.propertiesPlaceholder')"
            :options="options.properties.map((item) => ({ value: item.id, label: `${item.property_name}${item.merchant_name ? ` / ${item.merchant_name}` : ''}` }))"
          />
        </section>

        <!-- 稿面:Select Room Types -->
        <section class="form-field">
          <span class="field-label">{{ t('promotions.drawer.roomTypes') }}</span>
          <a-select
            v-model:value="form.roomTypeIds"
            mode="multiple"
            show-search
            option-filter-prop="label"
            :disabled="form.propertyIds.length === 0"
            :placeholder="form.propertyIds.length === 0 ? t('promotions.drawer.roomTypesDisabled') : t('promotions.drawer.roomTypesAll')"
            :options="roomOptions.map((item) => ({ value: item.id, label: item.room_name }))"
          />
        </section>

        <!-- 稿面:Usage Limit + Limit total number of uses(功能需求的「兑换上限」即此) -->
        <section class="form-field">
          <span class="field-label">{{ t('promotions.drawer.usageLimit') }}</span>
          <a-input-number v-model:value="form.totalCount" class="full" :min="0" :precision="0" :disabled="!form.limitTotal" />
          <label class="checkbox-row">
            <input v-model="form.limitTotal" type="checkbox" class="checkbox" />
            <span>{{ t('promotions.drawer.limitTotal') }}</span>
          </label>
        </section>

        <!-- 稿面:Booking Dates / Validity Period + No expiry date -->
        <section class="form-field">
          <span class="field-label">{{ form.promotionKind === PROMOTION_KIND.promoCode ? t('promotions.drawer.validityPeriod') : t('promotions.drawer.bookingDates') }}</span>
          <a-range-picker v-model:value="dateRange" class="full" :disabled="form.noExpiry" />
          <label class="checkbox-row">
            <input v-model="form.noExpiry" type="checkbox" class="checkbox" />
            <span>{{ t('promotions.drawer.noExpiry') }}</span>
          </label>
        </section>

        <!-- 功能需求:出资模式(商家自建促销只读) -->
        <section class="form-field">
          <span class="field-label">{{ t('promotions.drawer.funding') }}</span>
          <div class="readonly-pill">{{ fundingText }}</div>
        </section>

        <!-- 功能需求:条款(面向客人) -->
        <section class="form-field">
          <span class="field-label">{{ t('promotions.drawer.terms') }}</span>
          <a-textarea v-model:value="form.remark" :rows="3" :placeholder="t('promotions.drawer.termsPlaceholder')" />
        </section>

        <!-- 稿面:Internal Staff Notes -->
        <section class="form-field">
          <span class="field-label">{{ t('promotions.drawer.staffNotes') }}</span>
          <a-textarea v-model:value="form.staffNote" :rows="3" :placeholder="t('promotions.drawer.staffNotesPlaceholder')" />
        </section>
      </div>

      <footer class="drawer-footer">
        <button type="button" class="btn ghost" @click="close">{{ t('common.cancel') }}</button>
        <button type="button" class="btn primary lg" :disabled="saving" @click="submit">
          {{ t('promotions.drawer.publish') }}
        </button>
      </footer>
    </aside>
  </div>
</template>

<style scoped lang="less">
@import '../tokens.less';

.drawer-root {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.scrim {
  position: absolute;
  inset: 0;
  background: @pr-scrim;
}

.drawer {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  width: @pr-drawer-width;
  max-width: 100%;
  height: 100%;
  flex-direction: column;
  border-left: 1px solid @pr-line;
  background: #fff;
}

.drawer-header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  border-bottom: 1px solid @pr-line;
}

.drawer-title {
  margin: 0;
  color: @pr-ink-page;
  font-family: @pr-font-display;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.5;
}

.drawer-body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  padding: 24px;
}

.drawer-footer {
  display: flex;
  flex: none;
  justify-content: flex-end;
  gap: 12px;
  padding: 24px;
  border-top: 1px solid @pr-line;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  color: @pr-ink-label;
  font-family: @pr-font-body;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.mini-field {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.mini-label {
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 11px;
  font-weight: 600;
}

.radio-cards {
  display: flex;
  gap: 12px;
}

.radio-card {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-control;
  background: #fff;
  color: @pr-ink;
  font-family: @pr-font-body;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;

  &.active {
    border-color: @pr-primary;
    background: @pr-primary-soft;
    color: @pr-primary;
  }
}

.inline-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.text-input {
  width: 100%;
  height: @pr-input-height;
  padding: 8px 12px;
  border: 0.8px solid @pr-line;
  border-radius: @pr-radius-control;
  background: #fff;
  color: @pr-ink;
  font-family: @pr-font-body;
  font-size: 14px;
  line-height: 1.5;

  &::placeholder {
    color: @pr-ink-muted;
  }

  &:focus {
    border-color: @pr-primary;
    outline: none;
  }
}

.unit-chip,
.readonly-pill {
  display: flex;
  height: @pr-input-height;
  align-items: center;
  padding: 8px 12px;
  border: 0.8px solid @pr-line;
  border-radius: @pr-radius-control;
  background: @pr-chip-bg;
  color: @pr-ink;
  font-family: @pr-font-body;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
}

.readonly-pill {
  width: 100%;
  font-weight: 500;
}

.unit-select {
  flex: none;
  width: 150px;
}

.grow {
  flex: 1;
  min-width: 0;
}

.full {
  width: 100%;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: @pr-ink;
  font-family: @pr-font-body;
  font-size: 12px;
  cursor: pointer;
}

.checkbox {
  width: 18px;
  height: 18px;
  flex: none;
  accent-color: @pr-primary;
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
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: @pr-input-height;
  padding: 12px 20px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-control;
  background: #fff;
  color: @pr-ink;
  font-family: @pr-font-button;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;

  &.primary {
    border-color: @pr-primary;
    background: @pr-primary;
    color: #fff;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

/* 表单控件对齐稿面的 44 高 / 8 圆角(antd 默认 32 高) */
:deep(.ant-input-number),
:deep(.ant-select-selector),
:deep(.ant-picker),
:deep(.ant-input) {
  border-radius: @pr-radius-control !important;
}

:deep(.ant-input-number),
:deep(.ant-select-single .ant-select-selector),
:deep(.ant-picker) {
  height: @pr-input-height;
}

:deep(.ant-select-single .ant-select-selector .ant-select-selection-item),
:deep(.ant-select-single .ant-select-selector .ant-select-selection-placeholder) {
  line-height: @pr-input-height - 2px;
}

:deep(.ant-select-multiple .ant-select-selector) {
  min-height: @pr-input-height;
  padding: 6px 12px;
}

:deep(.ant-input-number-input) {
  height: @pr-input-height - 2px;
}

@media (max-width: 620px) {
  .radio-cards {
    flex-direction: column;
  }
}
</style>
