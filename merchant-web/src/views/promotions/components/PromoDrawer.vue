<script setup lang="ts">
/**
 * 新建 / 编辑促销抽屉(Figma `2285:21516` 的 `drawer`)。
 *
 * 稿面结构:头部(标题 + 关闭)→ 主体(表单分组,间距 20)→ 页脚。
 * 面板宽 562、头部/主体/页脚 padding 24、头部与页脚各一条 1px 分隔线、遮罩 `rgba(15,23,42,0.4)`。
 *
 * ## 稿面字段 + 功能需求追加字段
 * 稿面按三种促销各画了一组字段;功能需求额外要求「适用物业 / 兑换上限 / 条款」,
 * 故在稿面字段之后按同一 Label/Input 令牌追加(见文件内 `[req]` 注释),其余顺序照稿。
 *
 * ## 百分比 ↔ 计价口径
 * 表单里 `discountValue` 始终是**设计口径**(百分比促销 = 立减百分比),换算交给
 * `helpers.formToPayload` + 后端 `discountPair()`,本组件不做 10 分制转换。
 */
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
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
  validatePolicy,
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
const panel = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;
/** 适用入住日期(PRD §17.5 Specific Stay Date);空 = 不限 */
const stayRange = ref<[Dayjs, Dayjs] | null>(null);

const editing = computed(() => props.detail !== null && Number(props.detail.id) > 0);
const title = computed(() => (editing.value ? t('promotions.drawer.editTitle') : t('promotions.drawer.title')));

/** 长住保留其所属的百分比或金额单位。 */
const isPercentUnit = computed(() => form.promotionKind === PROMOTION_KIND.percentage
  || ((form.promotionKind === PROMOTION_KIND.longStay || form.promotionKind === PROMOTION_KIND.promoCode) && form.discountUnit === DISCOUNT_UNIT.percent));

const unitSuffix = computed(() => (isPercentUnit.value ? '%' : props.options.currency));

/** 房型可选项:只列已选物业下的房型 */
const roomOptions = computed(() => props.options.roomTypes.filter((room) => form.propertyIds.includes(room.property_id)));

const timezone = computed(() => props.options.policy?.timezone || 'UTC');

function reset(): void {
  const next = props.detail ? formFromDetail(props.detail) : defaultForm(props.kind);
  Object.assign(form, next);
  stayRange.value = next.stayStart && next.stayEnd ? [dayjs(next.stayStart), dayjs(next.stayEnd)] : null;
  form.validType = 1;
  form.noExpiry = false;
  if (!next.validStart || !next.validEnd) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone.value, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = (key: string) => parts.find(item => item.type === key)?.value || '';
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    form.validStart = `${today} 00:00:00`;
    form.validEnd = `${dayjs(today).add(30, 'day').format('YYYY-MM-DD')} 23:59:59`;
  }
}

// immediate:组件在「已打开」状态下挂载时(SSR 校验 / 直接进入编辑)也要完成一次回填
watch(() => props.open, (open) => {
  if (open) {
    reset();
    if (typeof document !== 'undefined') {
      previousFocus = document.activeElement as HTMLElement;
      void nextTick(() => panel.value?.focus());
    }
  } else previousFocus?.focus();
}, { immediate: true });

onBeforeUnmount(() => previousFocus?.focus());

function datePart(field: 'validStart' | 'validEnd', part: 'date' | 'time') {
  return computed({
    get: () => part === 'date' ? form[field].slice(0, 10) : (form[field].slice(11, 16) || (field === 'validEnd' ? '23:59' : '00:00')),
    set: (value: string) => {
      const date = part === 'date' ? value : form[field].slice(0, 10);
      const time = part === 'time' ? value : (form[field].slice(11, 19) || (field === 'validEnd' ? '23:59:59' : '00:00:00'));
      form[field] = date ? `${date} ${time.length === 5 ? `${time}:00` : time}` : '';
    },
  });
}
const startDate = datePart('validStart', 'date');
const startTime = datePart('validStart', 'time');
const endDate = datePart('validEnd', 'date');
const endTime = datePart('validEnd', 'time');

watch(stayRange, (range) => {
  form.stayStart = range && range[0] ? range[0].format('YYYY-MM-DD') : '';
  form.stayEnd = range && range[1] ? range[1].format('YYYY-MM-DD') : '';
});

/** 物业变化时清掉不再属于所选物业的房型,避免提交出越界房型被后端拒绝 */
watch(() => form.propertyIds.slice(), () => {
  const allowed = roomOptions.value.map((room) => room.id);
  form.roomTypeIds = form.roomTypeIds.filter((id) => allowed.includes(id));
});

function pickKind(kind: number): void {
  if (props.saving) return;
  const longStay = form.promotionKind === PROMOTION_KIND.longStay && kind !== PROMOTION_KIND.promoCode;
  if (form.promotionKind === kind) return;
  form.promotionKind = longStay ? PROMOTION_KIND.longStay : kind;
  form.discountUnit = kind === PROMOTION_KIND.fixedAmount ? DISCOUNT_UNIT.amount : DISCOUNT_UNIT.percent;
  form.discountValue = kind === PROMOTION_KIND.fixedAmount ? 0 : 20;
  if (kind === PROMOTION_KIND.longStay && form.minNights < 2) form.minNights = 3;
}

function pickCondition(longStay: boolean): void {
  form.promotionKind = longStay ? PROMOTION_KIND.longStay : (isPercentUnit.value ? PROMOTION_KIND.percentage : PROMOTION_KIND.fixedAmount);
  if (longStay && form.minNights < 2) form.minNights = 3;
}

function pickUnit(unit: number): void {
  form.discountUnit = unit;
}

function generateCode(): void {
  form.promoCode = randomPromoCode();
}

function submit(): void {
  if (props.saving) return;
  const invalid = validateForm(form) || validatePolicy(form, props.options);
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
  if (props.saving) return;
  emit('close');
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') { event.stopPropagation(); close(); }
  if (event.key !== 'Tab' || !panel.value) return;
  const elements = Array.from(panel.value.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter((element) => element.getClientRects().length > 0);
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
</script>

<template>
  <div v-if="open" class="drawer-root">
    <div class="scrim" @click="close" />
    <aside ref="panel" class="drawer" role="dialog" aria-modal="true" aria-labelledby="promotion-drawer-title" tabindex="-1" @keydown="onKeydown">
      <header class="drawer-header">
        <h2 id="promotion-drawer-title" class="drawer-title">{{ title }}</h2>
        <button type="button" class="icon-btn" :aria-label="t('common.cancel')" :disabled="saving" @click="close">
          <PromoIcon name="x" :size="14" />
        </button>
      </header>

      <div class="drawer-body" :inert="saving">
        <a-alert v-if="!options.policy?.configured" type="warning" show-icon :message="t('promotions.validation.policyMissing')" />
        <p v-else class="policy-note">{{ t('promotions.drawer.limits', { percent: options.policy.maxPercent, amount: options.policy.maxAmount, currency: options.currency, minimum: options.policy.minPayablePercent }) }}</p>
        <p class="policy-note">{{ t('promotions.drawer.claimProtection') }}</p>
        <!-- 稿面:Discount Type 三选卡 -->
        <section class="form-field">
          <span class="field-label">{{ t('promotions.drawer.discountType') }}</span>
          <div class="radio-cards">
            <button
              type="button"
              class="radio-card"
              :class="{ active: form.promotionKind !== PROMOTION_KIND.promoCode && isPercentUnit }"
              :aria-pressed="form.promotionKind !== PROMOTION_KIND.promoCode && isPercentUnit"
              @click="pickKind(PROMOTION_KIND.percentage)"
            >
              <span>% {{ t('promotions.kind.1') }}</span>
            </button>
            <button
              type="button"
              class="radio-card"
              :class="{ active: form.promotionKind !== PROMOTION_KIND.promoCode && !isPercentUnit }"
              :aria-pressed="form.promotionKind !== PROMOTION_KIND.promoCode && !isPercentUnit"
              @click="pickKind(PROMOTION_KIND.fixedAmount)"
            >
              <span>$ {{ t('promotions.kind.2') }}</span>
            </button>
            <button
              type="button"
              class="radio-card"
              :class="{ active: form.promotionKind === PROMOTION_KIND.promoCode }"
              :aria-pressed="form.promotionKind === PROMOTION_KIND.promoCode"
              @click="pickKind(PROMOTION_KIND.promoCode)"
            >
              <span>{{ t('promotions.drawer.promoCodeType') }}</span>
            </button>
          </div>
        </section>

        <section v-if="form.promotionKind !== PROMOTION_KIND.promoCode" class="form-field">
          <span class="field-label">{{ t('promotions.drawer.promotionCondition') }}</span>
          <div class="radio-cards">
            <button type="button" class="radio-card" :class="{ active: form.promotionKind !== PROMOTION_KIND.longStay }" :aria-pressed="form.promotionKind !== PROMOTION_KIND.longStay" @click="pickCondition(false)">{{ t('promotions.standard') }}</button>
            <button type="button" class="radio-card" :class="{ active: form.promotionKind === PROMOTION_KIND.longStay }" :aria-pressed="form.promotionKind === PROMOTION_KIND.longStay" @click="pickCondition(true)">{{ t('promotions.kind.4') }}</button>
          </div>
        </section>

        <section class="form-field">
          <span class="field-label">{{ t('promotions.drawer.name') }}</span>
          <input v-model="form.couponName" class="text-input" :placeholder="t('promotions.drawer.namePlaceholder')" maxlength="100" />
        </section>

        <!-- Coupon Code + Generate Random -->
        <section v-if="form.promotionKind === PROMOTION_KIND.promoCode" class="form-field">
          <span class="field-label">{{ t('promotions.drawer.couponCode') }}</span>
          <div class="inline-row code-row">
            <input v-model="form.promoCode" class="text-input" :placeholder="t('promotions.drawer.codePlaceholder')" />
            <button type="button" class="btn primary" @click="generateCode">{{ t('promotions.drawer.generate') }}</button>
          </div>
        </section>

        <!-- 稿面(kind=1/2/4):Description -->
        <section v-if="form.promotionKind !== PROMOTION_KIND.promoCode" class="form-field">
          <span class="field-label">{{ t('promotions.drawer.description') }}</span>
          <input v-model="form.description" class="text-input" :placeholder="t('promotions.drawer.descriptionPlaceholder')" />
        </section>

        <section class="form-field">
          <span class="field-label">{{ t('promotions.drawer.redemptionRules') }}</span>
          <div class="inline-row field-row">
            <label class="mini-field"><span class="mini-label">{{ t('promotions.drawer.minAmount') }}</span><a-input-number v-model:value="form.minAmount" class="full" :min="0" :precision="2" /></label>
            <label v-if="isPercentUnit" class="mini-field"><span class="mini-label">{{ t('promotions.drawer.maxDiscount') }}</span><a-input-number v-model:value="form.maxDiscount" class="full" :min="0" :precision="2" /></label>
            <label class="mini-field"><span class="mini-label">{{ t('promotions.drawer.perUserLimit') }}</span><a-input-number v-model:value="form.perUserLimit" class="full" :min="1" :precision="0" /></label>
          </div>
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
            <div class="discount-control grow">
              <a-input-number v-model:value="form.discountValue" class="full" :min="0" :precision="2" :controls="false" />
              <span v-if="form.promotionKind !== PROMOTION_KIND.promoCode" class="discount-suffix">{{ unitSuffix }}</span>
            </div>
          </div>
        </section>

        <!-- 功能需求:长住规则(最少入住晚数 / 适用入住时长上限) -->
        <section v-if="form.promotionKind === PROMOTION_KIND.longStay" class="form-field">
          <span class="field-label">{{ t('promotions.drawer.stayRules') }}</span>
          <div class="inline-row field-row">
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

        <!-- PRD §17.5 使用条件(0 / 空 = 不限;判定口径见 shared CouponEligibility,与平台后台一致) -->
        <section class="form-field">
          <span class="field-label">{{ t('promotions.drawer.conditions') }}</span>
          <div class="inline-row field-row">
            <div class="mini-field">
              <span class="mini-label">{{ t('promotions.drawer.bookAdvanceDays') }}</span>
              <a-input-number v-model:value="form.bookAdvanceDays" class="full" :min="0" :max="365" :precision="0" />
            </div>
            <div class="mini-field">
              <span class="mini-label">{{ t('promotions.drawer.minRoomCount') }}</span>
              <a-input-number v-model:value="form.minRoomCount" class="full" :min="0" :max="100" :precision="0" />
            </div>
            <div class="mini-field">
              <span class="mini-label">{{ t('promotions.drawer.minHotelCount') }}</span>
              <a-input-number v-model:value="form.minHotelCount" class="full" :min="0" :max="10" :precision="0" />
            </div>
          </div>
          <span class="mini-label">{{ t('promotions.drawer.stayRange') }}</span>
          <a-range-picker v-model:value="stayRange" class="full" />
          <span class="mini-label">{{ t('promotions.drawer.conditionsTip') }}</span>
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

        <section class="form-field">
          <span class="field-label">{{ t('promotions.drawer.schedule') }} ({{ timezone }})</span>
          <div class="schedule-grid">
            <label class="mini-field"><span class="mini-label">{{ t('promotions.drawer.startDate') }}</span><input v-model="startDate" type="date" class="text-input" /></label>
            <label class="mini-field"><span class="mini-label">{{ t('promotions.drawer.startTime') }}</span><input v-model="startTime" type="time" class="text-input" /></label>
            <label class="mini-field"><span class="mini-label">{{ t('promotions.drawer.endDate') }}</span><input v-model="endDate" type="date" class="text-input" :disabled="form.noExpiry" /></label>
            <label class="mini-field"><span class="mini-label">{{ t('promotions.drawer.endTime') }}</span><input v-model="endTime" type="time" class="text-input" :disabled="form.noExpiry" /></label>
          </div>
        </section>
        <label v-if="!editing" class="checkbox-row">
          <input v-model="form.enabled" type="checkbox" class="checkbox" />
          <span>{{ t('promotions.drawer.enabled') }}</span>
        </label>

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
        <button type="button" class="btn ghost" :disabled="saving" @click="close">{{ t('common.cancel') }}</button>
        <button type="button" class="btn primary lg" :disabled="saving || !options.policy?.configured" @click="submit">
          {{ saving ? t('common.loading') : (editing ? t('common.save') : t('promotions.drawer.createPromotion')) }}
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
  flex-wrap: wrap;
  gap: 12px;
}

.radio-card {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  min-height: @pr-input-height;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-control;
  background: #fff;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  text-align: left;
  cursor: pointer;

  &::before {
    content: '';
    width: 16px;
    height: 16px;
    flex: none;
    border: 1px solid currentColor;
    border-radius: 50%;
  }

  &.active {
    border-color: @pr-primary;
    background: @pr-primary-soft;
    color: @pr-primary;
    font-weight: 600;

    &::before {
      background: radial-gradient(circle, currentColor 0 5px, transparent 5.5px);
    }
  }

  &:focus-visible {
    outline: 2px solid @pr-primary;
    outline-offset: 2px;
  }
}

.policy-note { margin: 0; color: @pr-ink-sub; font-size: 12px; line-height: 1.6; }
.schedule-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.drawer { outline: none; }
.text-input:disabled { background: @pr-soft; color: @pr-ink-muted; }
@media (max-width: 480px) {
  .drawer-header, .drawer-body, .drawer-footer { padding: 16px; }
  .inline-row { flex-wrap: wrap; }
  .schedule-grid { gap: 12px; }
}

.inline-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-row { align-items: flex-end; }

.code-row {
  flex-wrap: nowrap;

  .text-input { flex: 1; }
  .btn { flex: none; white-space: nowrap; }
}

.text-input {
  width: 100%;
  min-width: 0;
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

.discount-control {
  position: relative;

  &:has(.discount-suffix) :deep(.ant-input-number-input) { padding-right: 64px; }
}

.discount-suffix {
  position: absolute;
  inset: 0 12px 0 auto;
  display: flex;
  align-items: center;
  color: @pr-ink-muted;
  font-size: 14px;
  pointer-events: none;
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
  background: #fff !important;
  font-size: 14px !important;
}

:deep(.ant-input-number),
:deep(.ant-select-single .ant-select-selector),
:deep(.ant-picker) {
  height: @pr-input-height !important;
}

:deep(.ant-select-single .ant-select-selector .ant-select-selection-item),
:deep(.ant-select-single .ant-select-selector .ant-select-selection-placeholder) {
  line-height: @pr-input-height - 2px !important;
}

:deep(.ant-select-multiple .ant-select-selector) {
  min-height: @pr-input-height !important;
  padding: 4px 12px;
}

// Override the global 32px inner input so its content fills the 44px control.
:deep(.ant-input-number-input-wrap) {
  height: 100%;
}

:deep(.ant-input-number-input) {
  height: @pr-input-height - 2px !important;
  padding: 0 12px;
  line-height: @pr-input-height - 2px;
  font-size: 14px !important;
}

:deep(.ant-picker-input > input) {
  font-size: 14px;
}

:deep(.ant-select-disabled .ant-select-selector),
:deep(.ant-input-number-disabled) {
  background: @pr-soft !important;
}

@media (max-width: 620px) {
  .radio-cards {
    flex-direction: column;
    flex-wrap: nowrap;
  }
  .radio-card { flex: 0 0 auto; }
}
</style>
