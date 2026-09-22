<script setup lang="ts">
/**
 * 酒店资料 · Long Stay Details 页签(视图 + 编辑态)
 *
 * 设计源:Figma `696:4375`(视图)/ `747:5592`(编辑态)
 *        + 弹窗 `857:10674` / `861:10823` / `865:10863` / `865:10898`
 * 规格落档:.figma-cache/696-6334.md
 *
 * 契约与 HotelAmenities.vue 一致:modelValue / editing / disabled + editRequested,
 * 便于 profile.vue 用同一套外壳承载六个页签。
 */
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { DeleteFilled, EditOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { LongStayBenefit, LongStayPromotion, PropertyLongStay } from '@/api/properties';

const PROMOTION_LIMIT = 10;
const BENEFIT_LIMIT = 12;

const props = defineProps<{
  modelValue: PropertyLongStay;
  editing?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: PropertyLongStay];
  editRequested: [];
}>();
const { t } = useI18n();

const visiblePromotions = computed(() => props.modelValue.promotions);
const visibleBenefits = computed(() => props.modelValue.benefits);

const promotionModal = ref(false);
const benefitModal = ref(false);
const editingPromotionId = ref('');
const editingBenefitId = ref('');
const promotionForm = reactive({ name: '', discount: 0, status: true });
const benefitForm = reactive({ name: '', status: true, bold: false });

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emitPromotions(rows: LongStayPromotion[]): void {
  emit('update:modelValue', { promotions: rows.map((row) => ({ ...row })), benefits: props.modelValue.benefits.map((row) => ({ ...row })) });
}

function emitBenefits(rows: LongStayBenefit[]): void {
  emit('update:modelValue', { promotions: props.modelValue.promotions.map((row) => ({ ...row })), benefits: rows.map((row) => ({ ...row })) });
}

function openPromotionCreate(): void {
  if (props.modelValue.promotions.length >= PROMOTION_LIMIT) {
    message.warning(t('properties.profile.longStayTab.limitReached', { limit: PROMOTION_LIMIT }));
    return;
  }
  editingPromotionId.value = '';
  Object.assign(promotionForm, { name: '', discount: 0, status: true });
  promotionModal.value = true;
}

function openPromotionEdit(row: LongStayPromotion): void {
  editingPromotionId.value = row.id;
  Object.assign(promotionForm, { name: row.name, discount: row.discount, status: row.status });
  promotionModal.value = true;
}

function savePromotion(): void {
  const name = promotionForm.name.trim();
  if (!name) {
    message.warning(t('properties.profile.longStayTab.nameRequired'));
    return;
  }
  const duplicate = props.modelValue.promotions.some((row) => row.id !== editingPromotionId.value
    && row.name.trim().toLowerCase() === name.toLowerCase());
  if (duplicate) {
    message.warning(t('properties.profile.longStayTab.duplicate'));
    return;
  }
  const row: LongStayPromotion = {
    id: editingPromotionId.value || nextId('lsp'),
    name,
    discount: Math.max(0, Math.min(100, Number(promotionForm.discount) || 0)),
    status: promotionForm.status,
  };
  emitPromotions(editingPromotionId.value
    ? props.modelValue.promotions.map((current) => current.id === editingPromotionId.value ? row : current)
    : [...props.modelValue.promotions, row]);
  promotionModal.value = false;
}

/** 卡片底部的开关(稿面:一行「标签 + 开关」);加粗同理,但停用的权益不能又是加粗的 */
function changePromotionStatus(row: LongStayPromotion, checked: boolean | string | number): void {
  emitPromotions(props.modelValue.promotions.map((current) => current.id === row.id ? { ...current, status: Boolean(checked) } : current));
}

function changeBenefitStatus(row: LongStayBenefit, checked: boolean | string | number): void {
  const status = Boolean(checked);
  emitBenefits(props.modelValue.benefits.map((current) => current.id === row.id
    ? { ...current, status, bold: status && current.bold } : current));
}

function changeBenefitBold(row: LongStayBenefit, checked: boolean | string | number): void {
  emitBenefits(props.modelValue.benefits.map((current) => current.id === row.id
    ? { ...current, bold: Boolean(checked) } : current));
}

function removePromotion(row: LongStayPromotion): void {
  emitPromotions(props.modelValue.promotions.filter((current) => current.id !== row.id));
}

function openBenefitCreate(): void {
  if (props.modelValue.benefits.length >= BENEFIT_LIMIT) {
    message.warning(t('properties.profile.longStayTab.limitReached', { limit: BENEFIT_LIMIT }));
    return;
  }
  editingBenefitId.value = '';
  Object.assign(benefitForm, { name: '', status: true, bold: false });
  benefitModal.value = true;
}

function openBenefitEdit(row: LongStayBenefit): void {
  editingBenefitId.value = row.id;
  Object.assign(benefitForm, { name: row.name, status: row.status, bold: row.bold });
  benefitModal.value = true;
}

function saveBenefit(): void {
  const name = benefitForm.name.trim();
  if (!name) {
    message.warning(t('properties.profile.longStayTab.nameRequired'));
    return;
  }
  const duplicate = props.modelValue.benefits.some((row) => row.id !== editingBenefitId.value
    && row.name.trim().toLowerCase() === name.toLowerCase());
  if (duplicate) {
    message.warning(t('properties.profile.longStayTab.duplicate'));
    return;
  }
  const row: LongStayBenefit = {
    id: editingBenefitId.value || nextId('lsb'),
    name,
    status: benefitForm.status,
    bold: benefitForm.status && benefitForm.bold,
  };
  emitBenefits(editingBenefitId.value
    ? props.modelValue.benefits.map((current) => current.id === editingBenefitId.value ? row : current)
    : [...props.modelValue.benefits, row]);
  benefitModal.value = false;
}

function removeBenefit(row: LongStayBenefit): void {
  emitBenefits(props.modelValue.benefits.filter((current) => current.id !== row.id));
}
</script>

<template>
  <template v-if="!editing">
    <!-- 稿面是两张卡:促销卡带头(标题 + Edit 药丸),权益卡没有卡头 -->
    <section class="ls-panel">
      <div class="panel-head">
        <h2>{{ t('properties.profile.longStay') }}</h2>
        <button v-perm="['mch:properties:profile-edit', 'mch:properties:profile-submit']" type="button" class="mtrip-edit-pill" :disabled="disabled" @click="emit('editRequested')"><EditOutlined />{{ t('common.edit') }}</button>
      </div>

      <div class="ls-section">
        <h3>{{ t('properties.profile.longStayTab.promotionTitle') }}</h3>
        <div v-if="visiblePromotions.length" class="promo-list">
          <div v-for="row in visiblePromotions" :key="row.id" :class="['promo-row', { inactive: !row.status }]">
            <span class="promo-name">{{ row.name }}</span>
            <i class="promo-line" />
            <span class="promo-value">{{ row.discount }} %</span>
            <i class="promo-dot" />
          </div>
        </div>
        <p v-else class="empty-row">{{ t('properties.profile.longStayTab.emptyPromotions') }}</p>
      </div>
    </section>

    <section class="ls-panel">
      <div class="ls-section">
        <h3>{{ t('properties.profile.longStayTab.benefitsTitle') }}</h3>
        <div v-if="visibleBenefits.length" class="benefit-grid">
          <span v-for="row in visibleBenefits" :key="row.id" :class="['benefit', { bold: row.bold, inactive: !row.status }]"><i />{{ row.name }}</span>
        </div>
        <p v-else class="empty-row">{{ t('properties.profile.longStayTab.emptyBenefits') }}</p>
      </div>
    </section>
  </template>

  <template v-else>
    <section class="ls-panel">
      <div class="edit-section-head">
        <h2>{{ t('properties.profile.longStayTab.promotionsCardTitle') }} <em>{{ t('properties.profile.longStayTab.count', { count: visiblePromotions.length, limit: PROMOTION_LIMIT }) }}</em></h2>
        <div><a-button type="primary" @click="openPromotionCreate"><PlusOutlined />{{ t('properties.profile.addNew') }}</a-button><span class="collapse-mark">⌄</span></div>
      </div>
      <div v-if="visiblePromotions.length" class="ls-card-grid">
        <article v-for="row in visiblePromotions" :key="row.id" class="ls-edit-card">
          <div class="ls-card-tools">
            <button type="button" :aria-label="t('common.edit')" @click="openPromotionEdit(row)"><EditOutlined /></button>
            <button type="button" :aria-label="t('common.delete')" @click="removePromotion(row)"><DeleteFilled /></button>
          </div>
          <div class="ls-card-body">
            <strong>{{ row.name }}</strong>
            <i class="ls-card-line" />
            <b>{{ row.discount }}%</b>
          </div>
          <div class="ls-card-status">
            <span>{{ t('properties.profile.longStayTab.promotionStatus') }}</span>
            <a-switch :checked="row.status" @change="changePromotionStatus(row, $event)" />
          </div>
        </article>
      </div>
      <p v-else class="empty-row">{{ t('properties.profile.longStayTab.emptyPromotions') }}</p>
    </section>

    <section class="ls-panel">
      <div class="edit-section-head">
        <h2>{{ t('properties.profile.longStayTab.benefitsTitle') }} <em>{{ t('properties.profile.longStayTab.count', { count: visibleBenefits.length, limit: BENEFIT_LIMIT }) }}</em></h2>
        <div><a-button type="primary" @click="openBenefitCreate"><PlusOutlined />{{ t('properties.profile.addNew') }}</a-button><span class="collapse-mark">⌄</span></div>
      </div>
      <div v-if="visibleBenefits.length" class="ls-card-grid">
        <article v-for="row in visibleBenefits" :key="row.id" class="ls-edit-card">
          <div class="ls-card-tools">
            <button type="button" :aria-label="t('common.edit')" @click="openBenefitEdit(row)"><EditOutlined /></button>
            <button type="button" :aria-label="t('common.delete')" @click="removeBenefit(row)"><DeleteFilled /></button>
          </div>
          <div class="ls-card-body single">
            <strong :class="{ light: !row.bold }">{{ row.name }}</strong>
          </div>
          <div class="ls-card-status">
            <span>{{ t('properties.profile.longStayTab.promotionStatus') }}</span>
            <a-switch :checked="row.status" @change="changeBenefitStatus(row, $event)" />
          </div>
          <div class="ls-card-status">
            <span>{{ t('properties.profile.longStayTab.boldBenefit') }}</span>
            <a-switch :checked="row.bold" :disabled="!row.status" @change="changeBenefitBold(row, $event)" />
          </div>
        </article>
      </div>
      <p v-else class="empty-row">{{ t('properties.profile.longStayTab.emptyBenefits') }}</p>
    </section>
  </template>

  <a-modal v-model:open="promotionModal" :title="t(editingPromotionId ? 'properties.profile.longStayTab.editPromotion' : 'properties.profile.longStayTab.createPromotion')" :footer="null" width="980px">
    <div class="modal-switches">
      <label><span>{{ t('properties.profile.longStayTab.promotionStatus') }}</span><a-switch v-model:checked="promotionForm.status" /></label>
    </div>
    <a-form layout="vertical" class="ls-form">
      <a-form-item :label="t('properties.profile.longStayTab.promotionName')" required><a-input v-model:value="promotionForm.name" :maxlength="60" /></a-form-item>
      <a-form-item :label="t('properties.profile.longStayTab.promotionDiscount')">
        <div class="suffix-input">
          <a-input-number v-model:value="promotionForm.discount" :min="0" :max="100" :precision="0" />
          <span>%</span>
        </div>
      </a-form-item>
    </a-form>
    <div class="modal-actions"><a-button @click="promotionModal = false">{{ t('common.cancel') }}</a-button><a-button type="primary" @click="savePromotion">{{ t('common.save') }}</a-button></div>
  </a-modal>

  <a-modal v-model:open="benefitModal" :title="t(editingBenefitId ? 'properties.profile.longStayTab.editBenefit' : 'properties.profile.longStayTab.createBenefit')" :footer="null" width="980px">
    <div class="modal-switches">
      <label><span>{{ t('properties.profile.longStayTab.promotionStatus') }}</span><a-switch v-model:checked="benefitForm.status" /></label>
      <label><span>{{ t('properties.profile.longStayTab.boldBenefit') }}</span><a-switch v-model:checked="benefitForm.bold" :disabled="!benefitForm.status" /></label>
    </div>
    <a-form layout="vertical" class="ls-form">
      <a-form-item :label="t('properties.profile.longStayTab.benefitName')" required><a-input v-model:value="benefitForm.name" :maxlength="60" /></a-form-item>
    </a-form>
    <div class="modal-actions"><a-button @click="benefitModal = false">{{ t('common.cancel') }}</a-button><a-button type="primary" @click="saveBenefit">{{ t(editingBenefitId ? 'properties.profile.longStayTab.save' : 'properties.profile.longStayTab.createNow') }}</a-button></div>
  </a-modal>
</template>

<style scoped lang="less">
.ls-panel { margin-bottom: 16px; padding: 15px 16px; border: 1px solid #e9ebf2; border-radius: 10px; background: #fff; box-shadow: 0 2px 6px rgb(24 27 42 / 3%); }
.panel-head, .edit-section-head, .modal-switches label, .modal-actions { display: flex; align-items: center; }
.panel-head { min-height: 32px; justify-content: space-between; gap: 14px; padding-bottom: 10px; border-bottom: 1px solid #eef0f4; }
.panel-head h2, .edit-section-head h2 { margin: 0; font-size: 14px; line-height: 22px; }
/* 卡片头的 Edit 用全局共享的 .mtrip-edit-pill(见 src/styles/index.less),四个页签一份 */
/* 分组小标:稿面 Inter Medium 500/16 灰 */
.ls-section { padding-top: 14px; }.ls-panel > .ls-section:first-child { padding-top: 0; }
.ls-section h3 { margin: 0 0 10px; color: rgb(25 26 37 / 50%); font-size: 16px; font-weight: 500; }
/* 促销行(Figma EL-ca7e79c5):row / gap 24,名称列右对齐、固定 300px 分隔线、取值列左对齐 —— 三者在行内居中,
   行尾绝对定位一枚 12px 状态绿点(EL-f77b9d60,原来是 12x12 的「Ellipse active」组件) */
.promo-list { display: grid; gap: 16px; }
.promo-row { position: relative; display: flex; align-items: center; justify-content: center; gap: 24px; }
.promo-name { flex: 1; color: rgb(25 26 37 / 50%); font-size: 16px; font-weight: 600; text-align: right; }
.promo-line { flex: 0 1 300px; height: 1px; background: #e2e8f0; }
.promo-value { flex: 1; color: #1b1d30; font-size: 16px; font-weight: 700; text-align: left; }
.promo-dot { position: absolute; top: 50%; right: 0; width: 12px; height: 12px; margin-top: -6px; border-radius: 50%; background: #00a63e; }
.promo-row.inactive .promo-dot { background: #c3c6d0; }
.benefit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 24px; }
.benefit { display: flex; align-items: center; gap: 10px; color: #181b2a; font-size: 14px; font-weight: 500; }
.benefit.bold { font-weight: 700; }.benefit.inactive { color: #a5a8b1; text-decoration: line-through; }
.benefit i { flex: 0 0 auto; width: 12px; height: 12px; border-radius: 50%; background: #00a63e; }
.benefit.inactive i { background: #c3c6d0; }
.empty-row { margin: 0; color: #a5a8b1; font-size: 12px; }
.edit-section-head { justify-content: space-between; gap: 14px; padding-bottom: 12px; border-bottom: 1px solid #edf0f4; }
.edit-section-head h2 { display: flex; align-items: center; gap: 12px; }
.edit-section-head em { color: #c87542; font-size: 11px; font-style: normal; font-weight: 600; }
.edit-section-head > div { display: flex; align-items: center; gap: 20px; color: #9699a4; }
/* 编辑态(Figma 772:9574 / 772:10432):与儿童加床卡同壳 —— 主色 1.5px 描边 / 圆角 8 / padding 0 0 24px,
   一屏 3 张并排(实测卡宽 392 + 间距 16),顶部铅笔左·垃圾桶右、内容行底部 1px 分隔线、底部「标签 + 开关」行 */
.ls-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
.ls-edit-card { display: grid; gap: 16px; padding: 0 0 24px; border: 1.5px solid #4d6cf4; border-radius: 8px; background: #fff; }
.ls-card-tools { display: flex; align-items: center; justify-content: space-between; }
.ls-card-tools button { display: grid; padding: 12px; border: 0; background: transparent; color: #c66e35; cursor: pointer; place-items: center; }
.ls-card-tools button:last-child { color: #ff303f; }
.ls-card-tools :deep(svg) { font-size: 24px; }
/* 促销卡内容行:名称(右) — 弹性线 — 折扣(左),PJS 600/24 主色;权益卡只有名称 */
.ls-card-body { display: flex; align-items: center; gap: 16px; padding: 16px 16px 24px; border-bottom: 1px solid #e2e8f0; }
.ls-card-body.single { justify-content: flex-start; }
.ls-card-body strong, .ls-card-body b { color: #4d6cf4; font-family: 'Plus Jakarta Sans', Inter, sans-serif; font-size: 24px; font-weight: 600; white-space: nowrap; }
.ls-card-body strong.light { font-weight: 400; }
.ls-card-line { flex: 1; height: 1px; background: #e2e8f0; }
.ls-card-status { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 0 16px; }
.ls-card-status > span { color: #1b1d30; font-size: 16px; font-weight: 600; }
.modal-switches { display: flex; gap: 20px; margin: -8px 0 20px; padding: 3px 0 16px; border-bottom: 1px solid #eceef3; }
.modal-switches label { flex: 1; justify-content: space-between; gap: 14px; color: #414552; font-size: 13px; font-weight: 600; }
.modal-switches label + label { padding-left: 20px; border-left: 1px solid #eceef3; }
.ls-form :deep(.ant-form-item-label > label) { color: #686c78; font-size: 12px; font-weight: 600; }
.suffix-input { display: flex; align-items: center; gap: 8px; }.suffix-input :deep(.ant-input-number) { flex: 1; }
.suffix-input > span { padding: 3px 10px; border-radius: 4px; background: rgb(65 105 237 / 8%); color: #4d6cf4; font-size: 12px; font-weight: 600; }
.modal-actions { justify-content: flex-end; gap: 14px; padding-top: 10px; border-top: 1px solid #eceef3; }
@media (max-width: 600px) { .benefit-grid { grid-template-columns: 1fr; }.ls-card-grid { grid-template-columns: 1fr; }.modal-switches { align-items: stretch; flex-direction: column; }.modal-switches label + label { padding: 12px 0 0; border-top: 1px solid #eceef3; border-left: 0; } }
</style>
