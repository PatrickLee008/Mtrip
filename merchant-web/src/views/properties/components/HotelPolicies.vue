<script setup lang="ts">
/**
 * 酒店资料 · Hotel Policies 页签(视图 + 编辑态)
 *
 * 设计源:Figma `696:4711`(视图)/ `748:7074`(编辑态)
 *        + 弹窗 `814:13469` / `816:13556`(Children & Extra Beds)
 * 规格落档:.figma-cache/696-6334.md
 *
 * 稿面偏差(已与用户确认):
 *  ① Check In/Out 的数字滚轮时间控件不做,沿用本页 Details 的 <input type="time"> 口径;
 *  ② Property Rules 稿面没有编辑弹窗(只有 edit/trash 图标),故行内直接编辑;
 *  ③ 编辑态底部沿用页面既有 Cancel / Save Draft / Submit Review。
 */
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import {
  ArrowRightOutlined,
  BgColorsOutlined,
  CarOutlined,
  CoffeeOutlined,
  DeleteFilled,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  HeartOutlined,
  PlusOutlined,
  ReadOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SoundOutlined,
  StarOutlined,
  StopOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { PolicyChild, PolicyRule, PropertyPolicies } from '@/api/properties';
import { FALLBACK_CURRENCY, currencySelectOptions } from '@/config/currencies';

const CHILD_LIMIT = 10;
const RULE_LIMIT = 12;

const ruleIcons = {
  'no-smoking': StopOutlined,
  quiet: SoundOutlined,
  pool: BgColorsOutlined,
  pets: HeartOutlined,
  parking: CarOutlined,
  family: TeamOutlined,
  security: SafetyCertificateOutlined,
  sparkles: StarOutlined,
  food: CoffeeOutlined,
  rules: ReadOutlined,
  fitness: RocketOutlined,
  power: ThunderboltOutlined,
} as const;
const ruleIconOptions = ['no-smoking', 'quiet', 'pool', 'pets', 'parking', 'family', 'security', 'sparkles', 'food', 'rules', 'fitness', 'power'];
const unitOptions = ['night', 'day', 'stay', 'booking'];

const props = defineProps<{
  modelValue: PropertyPolicies;
  editing?: boolean;
  disabled?: boolean;
  /** 物业币种(hotel_room_type.currency),金额输入框右侧胶囊用 */
  currency?: string;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: PropertyPolicies];
  editRequested: [];
}>();
const { t } = useI18n();

const collapsed = ref<string[]>([]);
const childModal = ref(false);
const ruleModal = ref(false);
const editingRuleId = ref('');
const ruleForm = reactive<PolicyRule>({ id: '', name: '', description: '', icon: 'sparkles', status: true });
const editingChildId = ref('');
const childForm = reactive<PolicyChild>({ id: '', name: '', description: '', amount: '', currency: '', unit: '', status: true });
/** 物业币种优先,取不到再退回字典兜底(货币字典见 src/config/currencies.ts) */
const defaultCurrency = computed(() => String(props.currency || '').trim().toUpperCase() || FALLBACK_CURRENCY);
/** 下拉选项 = 字典 + 物业币种 + 当前编辑值(物业币种可能不在占位字典里) */
const currencyOptions = computed(() => currencySelectOptions(defaultCurrency.value, childForm.currency)
  .map((code) => ({ value: code, label: code })));

const bookingRows = computed(() => [
  { key: 'cancellation', label: t('properties.profile.policiesTab.cancellation'), value: props.modelValue.booking.cancellation },
  { key: 'prepayment', label: t('properties.profile.policiesTab.prepayment'), value: props.modelValue.booking.prepayment },
  { key: 'taxesFees', label: t('properties.profile.policiesTab.taxesFees'), value: props.modelValue.booking.taxesFees },
]);
const checkInDocuments = computed(() => props.modelValue.checkIn.documents);
/** 「整块是否填过」:时间、说明、证件任一有值即算填过,未填过才给一处「未填写」提示 */
const checkInFilled = computed(() => Boolean(props.modelValue.checkIn.time || props.modelValue.checkIn.description || checkInDocuments.value.length));
const checkOutFilled = computed(() => Boolean(props.modelValue.checkOut.time || props.modelValue.checkOut.description));

function isOpen(key: string): boolean {
  return !collapsed.value.includes(key);
}

function toggle(key: string): void {
  collapsed.value = isOpen(key) ? [...collapsed.value, key] : collapsed.value.filter((item) => item !== key);
}

function ruleIconFor(key: string) {
  return ruleIcons[key as keyof typeof ruleIcons] || StarOutlined;
}

/**
 * 卡片上的金额文案:金额为空或为 0(含 0.00 / 「1,000」这类千分位写法)一律显示为「免费 / Complimentary」,
 * 与稿面 `Complimentary / night` 那一行同口径;填了具体金额才原样显示。
 */
function amountLabel(row: PolicyChild): string {
  const normalized = row.amount.replace(/[,\s]/g, '');
  const isFree = normalized === '' || Number(normalized) === 0;
  if (isFree) return t('properties.profile.policiesTab.complimentary');
  // 纯数字金额补上该条政策自己的币种(MMK 35,000);金额里已经写了货币或文字的照原样显示
  return /^\d+(\.\d+)?$/.test(normalized) && row.currency ? `${row.currency} ${row.amount}` : row.amount;
}

function patch(value: Partial<PropertyPolicies>): void {
  emit('update:modelValue', { ...props.modelValue, ...value });
}

function patchCheckIn(value: Partial<PropertyPolicies['checkIn']>): void {
  patch({ checkIn: { ...props.modelValue.checkIn, ...value } });
}

function patchCheckOut(value: Partial<PropertyPolicies['checkOut']>): void {
  patch({ checkOut: { ...props.modelValue.checkOut, ...value } });
}

function patchBooking(value: Partial<PropertyPolicies['booking']>): void {
  patch({ booking: { ...props.modelValue.booking, ...value } });
}

function patchChildren(rows: PolicyChild[]): void {
  patch({ children: rows.map((row) => ({ ...row })) });
}

function patchRules(rows: PolicyRule[]): void {
  patch({ rules: rows.map((row) => ({ ...row })) });
}

function setDocument(index: number, value: string): void {
  const documents = [...props.modelValue.checkIn.documents];
  documents[index] = value;
  patchCheckIn({ documents });
}

function addDocument(): void {
  if (props.modelValue.checkIn.documents.length >= 8) return;
  patchCheckIn({ documents: [...props.modelValue.checkIn.documents, ''] });
}

function removeDocument(index: number): void {
  patchCheckIn({ documents: props.modelValue.checkIn.documents.filter((_, position) => position !== index) });
}

function openChildCreate(): void {
  if (props.modelValue.children.length >= CHILD_LIMIT) {
    message.warning(t('properties.profile.policiesTab.limitReached', { limit: CHILD_LIMIT }));
    return;
  }
  editingChildId.value = '';
  Object.assign(childForm, { id: '', name: '', description: '', amount: '', currency: defaultCurrency.value, unit: 'night', status: true });
  childModal.value = true;
}

function openChildEdit(row: PolicyChild): void {
  editingChildId.value = row.id;
  Object.assign(childForm, { ...row, currency: row.currency || defaultCurrency.value });
  childModal.value = true;
}

function saveChild(): void {
  const name = childForm.name.trim();
  if (!name) {
    message.warning(t('properties.profile.policiesTab.policyNameRequired'));
    return;
  }
  const duplicate = props.modelValue.children.some((row) => row.id !== editingChildId.value
    && row.name.trim().toLowerCase() === name.toLowerCase());
  if (duplicate) {
    message.warning(t('properties.profile.policiesTab.duplicate'));
    return;
  }
  const row: PolicyChild = {
    id: editingChildId.value || `chd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    description: childForm.description.trim(),
    amount: childForm.amount.trim(),
    currency: childForm.currency.trim().toUpperCase(),
    unit: childForm.unit.trim(),
    status: childForm.status,
  };
  patchChildren(editingChildId.value
    ? props.modelValue.children.map((current) => current.id === editingChildId.value ? row : current)
    : [...props.modelValue.children, row]);
  childModal.value = false;
}

function removeChild(row: PolicyChild): void {
  patchChildren(props.modelValue.children.filter((current) => current.id !== row.id));
}

function changeChildStatus(row: PolicyChild, checked: boolean | string | number): void {
  patchChildren(props.modelValue.children.map((current) => current.id === row.id ? { ...current, status: Boolean(checked) } : current));
}

/** 物业规则与儿童加床政策同构:卡片只展示,铅笔开弹窗(设计稿没画规则弹窗,沿用同屏既有弹窗语言) */
function openRuleCreate(): void {
  if (props.modelValue.rules.length >= RULE_LIMIT) {
    message.warning(t('properties.profile.policiesTab.limitReached', { limit: RULE_LIMIT }));
    return;
  }
  editingRuleId.value = '';
  Object.assign(ruleForm, { id: '', name: '', description: '', icon: 'sparkles', status: true });
  ruleModal.value = true;
}

function openRuleEdit(row: PolicyRule): void {
  editingRuleId.value = row.id;
  Object.assign(ruleForm, { ...row });
  ruleModal.value = true;
}

function saveRule(): void {
  const name = ruleForm.name.trim();
  if (!name) {
    message.warning(t('properties.profile.policiesTab.ruleNameRequired'));
    return;
  }
  const duplicate = props.modelValue.rules.some((row) => row.id !== editingRuleId.value
    && row.name.trim().toLowerCase() === name.toLowerCase());
  if (duplicate) {
    message.warning(t('properties.profile.policiesTab.duplicate'));
    return;
  }
  const row: PolicyRule = {
    id: editingRuleId.value || `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    description: ruleForm.description.trim(),
    icon: ruleForm.icon,
    status: ruleForm.status,
  };
  patchRules(editingRuleId.value
    ? props.modelValue.rules.map((current) => current.id === editingRuleId.value ? row : current)
    : [...props.modelValue.rules, row]);
  ruleModal.value = false;
}

function updateRule(row: PolicyRule, value: Partial<PolicyRule>): void {
  patchRules(props.modelValue.rules.map((current) => current.id === row.id ? { ...current, ...value } : current));
}

function removeRule(row: PolicyRule): void {
  patchRules(props.modelValue.rules.filter((current) => current.id !== row.id));
}
</script>

<template>
  <template v-if="!editing">
    <section class="hp-panel">
      <div class="panel-head">
        <h2>{{ t('properties.profile.policies') }}</h2>
        <button v-perm="['mch:properties:profile-edit', 'mch:properties:profile-submit']" type="button" class="mtrip-edit-pill" :disabled="disabled" @click="emit('editRequested')"><EditOutlined />{{ t('common.edit') }}</button>
      </div>

      <div class="hp-section">
        <button type="button" class="hp-section-head" :aria-expanded="isOpen('booking')" @click="toggle('booking')">
          <span>{{ t('properties.profile.policiesTab.booking') }}</span><DownOutlined :class="{ rotated: isOpen('booking') }" />
        </button>
        <div v-show="isOpen('booking')" class="hp-section-body">
          <template v-for="(row, index) in bookingRows" :key="row.key">
            <div v-if="index > 0" class="hp-form-line" />
            <div class="hp-field hp-field-block">
              <span class="hp-label">{{ row.label }}</span>
              <span :class="['hp-value', { empty: !row.value }]">{{ row.value || t('properties.profile.notProvided') }}</span>
            </div>
          </template>
        </div>
      </div>

      <div class="hp-section">
        <button type="button" class="hp-section-head" :aria-expanded="isOpen('checkin')" @click="toggle('checkin')">
          <span>{{ t('properties.profile.policiesTab.checkInOut') }}</span><DownOutlined :class="{ rotated: isOpen('checkin') }" />
        </button>
        <div v-show="isOpen('checkin')" class="hp-section-body">
          <div class="hp-check">
            <span class="hp-label">{{ t('properties.profile.policiesTab.checkIn') }}</span>
            <div class="hp-check-value">
              <strong v-if="modelValue.checkIn.time" class="hp-check-time">{{ modelValue.checkIn.time }}</strong>
              <p v-if="modelValue.checkIn.description" class="hp-check-text">{{ modelValue.checkIn.description }}</p>
              <div v-if="checkInDocuments.length" class="hp-check-documents">
                <span class="hp-check-documents-label">{{ t('properties.profile.policiesTab.documents') }}</span>
                <template v-for="(document, index) in checkInDocuments" :key="`${document}-${index}`">
                  <i v-if="index > 0" class="hp-check-dot">.</i>
                  <b>{{ document }}</b>
                </template>
              </div>
              <p v-if="!checkInFilled" class="hp-check-text empty">{{ t('properties.profile.notProvided') }}</p>
            </div>
          </div>
          <div class="hp-form-line" />
          <div class="hp-check">
            <span class="hp-label">{{ t('properties.profile.policiesTab.checkOut') }}</span>
            <div class="hp-check-value">
              <strong v-if="modelValue.checkOut.time" class="hp-check-time">{{ modelValue.checkOut.time }}</strong>
              <p v-if="modelValue.checkOut.description" class="hp-check-text">{{ modelValue.checkOut.description }}</p>
              <p v-if="!checkOutFilled" class="hp-check-text empty">{{ t('properties.profile.notProvided') }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="hp-section">
        <button type="button" class="hp-section-head" :aria-expanded="isOpen('children')" @click="toggle('children')">
          <span>{{ t('properties.profile.policiesTab.children') }}</span><DownOutlined :class="{ rotated: isOpen('children') }" />
        </button>
        <div v-show="isOpen('children')" class="hp-section-body">
          <div v-if="modelValue.children.length" class="hp-card-grid">
            <article v-for="row in modelValue.children" :key="row.id" :class="['hp-view-card', { inactive: !row.status }]">
              <div class="hp-card-block">
                <strong class="hp-card-name">{{ row.name }}</strong>
                <p class="hp-card-desc">{{ row.description || t('properties.profile.notProvided') }}</p>
              </div>
              <div class="hp-card-amount">
                <b>{{ amountLabel(row) }}</b>
                <span v-if="row.unit">/ {{ t(`properties.profile.policiesTab.units.${row.unit}`) }}</span>
              </div>
            </article>
          </div>
          <p v-else class="empty-row">{{ t('properties.profile.policiesTab.emptyChildren') }}</p>
          <div :class="['hp-field', 'hp-field-block', 'hp-pet', { inactive: !modelValue.pet.status }]">
            <span class="hp-label">{{ t('properties.profile.policiesTab.pet') }}</span>
            <p :class="['hp-text', { empty: !modelValue.pet.description }]">{{ modelValue.pet.description || t('properties.profile.notProvided') }}</p>
          </div>
        </div>
      </div>

      <div class="hp-section">
        <button type="button" class="hp-section-head" :aria-expanded="isOpen('rules')" @click="toggle('rules')">
          <span>{{ t('properties.profile.policiesTab.rules') }}</span><DownOutlined :class="{ rotated: isOpen('rules') }" />
        </button>
        <div v-show="isOpen('rules')" class="hp-section-body">
          <div v-if="modelValue.rules.length" class="hp-card-grid">
            <article v-for="row in modelValue.rules" :key="row.id" :class="['hp-view-card', { inactive: !row.status }]">
              <component :is="ruleIconFor(row.icon)" class="hp-rule-view-icon" />
              <div class="hp-card-block">
                <strong class="hp-card-name">{{ row.name }}</strong>
                <p class="hp-card-desc">{{ row.description || t('properties.profile.notProvided') }}</p>
              </div>
            </article>
          </div>
          <p v-else class="empty-row">{{ t('properties.profile.policiesTab.emptyRules') }}</p>
        </div>
      </div>
    </section>
  </template>

  <template v-else>
    <section class="hp-panel">
      <div class="edit-section-head"><h2>{{ t('properties.profile.policiesTab.booking') }}</h2><DownOutlined class="collapse-mark" /></div>
      <a-form layout="vertical" class="hp-form">
        <a-form-item :label="t('properties.profile.policiesTab.cancellation')"><a-textarea :value="modelValue.booking.cancellation" :rows="2" :maxlength="500" @update:value="patchBooking({ cancellation: $event })" /></a-form-item>
        <a-form-item :label="t('properties.profile.policiesTab.prepayment')"><a-textarea :value="modelValue.booking.prepayment" :rows="2" :maxlength="500" @update:value="patchBooking({ prepayment: $event })" /></a-form-item>
        <a-form-item :label="t('properties.profile.policiesTab.taxesFees')"><a-textarea :value="modelValue.booking.taxesFees" :rows="2" :maxlength="500" @update:value="patchBooking({ taxesFees: $event })" /></a-form-item>
      </a-form>
    </section>

    <section class="hp-panel">
      <div class="edit-section-head"><h2>{{ t('properties.profile.policiesTab.checkInPolicy') }}</h2><DownOutlined class="collapse-mark" /></div>
      <a-form layout="vertical" class="hp-form">
        <a-form-item :label="t('properties.profile.policiesTab.checkIn')"><a-input :value="modelValue.checkIn.time" type="time" :maxlength="20" @update:value="patchCheckIn({ time: $event })" /></a-form-item>
        <a-form-item :label="t('properties.profile.policiesTab.description')"><a-textarea :value="modelValue.checkIn.description" :rows="2" :maxlength="500" @update:value="patchCheckIn({ description: $event })" /></a-form-item>
        <a-form-item :label="t('properties.profile.policiesTab.documents')">
          <div class="hp-document-editor">
            <div v-for="(document, index) in modelValue.checkIn.documents" :key="index" class="hp-document-row">
              <a-input :value="document" :maxlength="80" @update:value="setDocument(index, $event)" />
              <a-button type="text" danger @click="removeDocument(index)"><DeleteOutlined /></a-button>
            </div>
            <a-button type="dashed" block @click="addDocument"><PlusOutlined />{{ t('properties.profile.addNew') }}</a-button>
          </div>
        </a-form-item>
      </a-form>
    </section>

    <section class="hp-panel">
      <div class="edit-section-head"><h2>{{ t('properties.profile.policiesTab.checkOutPolicy') }}</h2><DownOutlined class="collapse-mark" /></div>
      <a-form layout="vertical" class="hp-form">
        <a-form-item :label="t('properties.profile.policiesTab.checkOut')"><a-input :value="modelValue.checkOut.time" type="time" :maxlength="20" @update:value="patchCheckOut({ time: $event })" /></a-form-item>
        <a-form-item :label="t('properties.profile.policiesTab.description')"><a-textarea :value="modelValue.checkOut.description" :rows="2" :maxlength="500" @update:value="patchCheckOut({ description: $event })" /></a-form-item>
      </a-form>
    </section>

    <section class="hp-panel">
      <div class="edit-section-head">
        <h2>{{ t('properties.profile.policiesTab.children') }} <em>{{ t('properties.profile.policiesTab.count', { count: modelValue.children.length, limit: CHILD_LIMIT }) }}</em></h2>
        <div><a-button type="primary" @click="openChildCreate"><PlusOutlined />{{ t('properties.profile.addNew') }}</a-button><DownOutlined class="collapse-mark" /></div>
      </div>
      <div v-if="modelValue.children.length" class="hp-card-grid">
        <article v-for="row in modelValue.children" :key="row.id" :class="['hp-edit-card', { inactive: !row.status }]">
          <div class="hp-edit-card-top">
            <div class="hp-edit-card-tools">
              <button type="button" :aria-label="t('common.edit')" @click="openChildEdit(row)"><EditOutlined /></button>
              <button type="button" :aria-label="t('common.delete')" @click="removeChild(row)"><DeleteFilled /></button>
            </div>
            <div class="hp-edit-card-body">
              <div class="hp-card-block">
                <strong class="hp-card-name">{{ row.name }}</strong>
                <p class="hp-card-desc">{{ row.description || t('properties.profile.notProvided') }}</p>
              </div>
              <div class="hp-card-amount">
                <b>{{ amountLabel(row) }}</b>
                <span v-if="row.unit">/ {{ t(`properties.profile.policiesTab.units.${row.unit}`) }}</span>
              </div>
            </div>
          </div>
          <div class="hp-edit-card-status">
            <span>{{ t('properties.profile.policiesTab.policyStatus') }}</span>
            <a-switch :checked="row.status" @change="changeChildStatus(row, $event)" />
          </div>
        </article>
      </div>
      <p v-else class="empty-row">{{ t('properties.profile.policiesTab.emptyChildren') }}</p>
    </section>

    <section class="hp-panel">
      <div class="edit-section-head"><h2>{{ t('properties.profile.policiesTab.pet') }}</h2><a-switch v-model:checked="modelValue.pet.status" :aria-label="t('properties.profile.policiesTab.policyStatus')" /></div>
      <a-form layout="vertical" class="hp-form">
        <a-form-item :label="t('properties.profile.policiesTab.description')"><a-textarea :value="modelValue.pet.description" :rows="2" :maxlength="500" @update:value="patch({ pet: { ...modelValue.pet, description: $event } })" /></a-form-item>
      </a-form>
    </section>

    <section class="hp-panel">
      <div class="edit-section-head">
        <h2>{{ t('properties.profile.policiesTab.rules') }} <em>{{ t('properties.profile.policiesTab.count', { count: modelValue.rules.length, limit: RULE_LIMIT }) }}</em></h2>
        <div><a-button type="primary" @click="openRuleCreate"><PlusOutlined />{{ t('properties.profile.addNew') }}</a-button><DownOutlined class="collapse-mark" /></div>
      </div>
      <div v-if="modelValue.rules.length" class="hp-card-grid">
        <article v-for="row in modelValue.rules" :key="row.id" :class="['hp-edit-card', { inactive: !row.status }]">
          <div class="hp-edit-card-tools">
            <button type="button" :aria-label="t('common.edit')" @click="openRuleEdit(row)"><EditOutlined /></button>
            <button type="button" :aria-label="t('common.delete')" @click="removeRule(row)"><DeleteFilled /></button>
          </div>
          <div class="hp-edit-card-body">
            <component :is="ruleIconFor(row.icon)" class="hp-rule-view-icon" />
            <div class="hp-card-block">
              <strong class="hp-card-name">{{ row.name }}</strong>
              <p class="hp-card-desc">{{ row.description || t('properties.profile.notProvided') }}</p>
            </div>
          </div>
          <div class="hp-edit-card-status">
            <span>{{ t('properties.profile.policiesTab.policyStatus') }}</span>
            <a-switch :checked="row.status" @change="updateRule(row, { status: Boolean($event) })" />
          </div>
        </article>
      </div>
      <p v-else class="empty-row">{{ t('properties.profile.policiesTab.emptyRules') }}</p>
    </section>
  </template>

  <a-modal v-model:open="ruleModal" :footer="null" width="min(1260px, 94vw)">
    <template #title><span class="hp-modal-title">{{ t(editingRuleId ? 'properties.profile.policiesTab.editRule' : 'properties.profile.policiesTab.createRule') }}</span></template>
    <div class="hp-child-form">
      <div class="hp-switch-row">
        <span>{{ t('properties.profile.policiesTab.policyStatus') }}</span>
        <a-switch v-model:checked="ruleForm.status" />
      </div>
      <div class="hp-form-line" />
      <a-form layout="vertical" class="hp-form-grid">
        <a-form-item :label="t('properties.profile.policiesTab.ruleName')" required><a-input v-model:value="ruleForm.name" :maxlength="60" /></a-form-item>
        <a-form-item :label="t('properties.profile.policiesTab.ruleIcon')">
          <a-select v-model:value="ruleForm.icon" :dropdown-match-select-width="false">
            <a-select-option v-for="icon in ruleIconOptions" :key="icon" :value="icon"><component :is="ruleIconFor(icon)" /> {{ t(`properties.profile.policiesTab.icons.${icon}`) }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('properties.profile.policiesTab.shortDescription')" class="hp-form-span"><a-textarea v-model:value="ruleForm.description" :rows="2" :maxlength="500" /></a-form-item>
      </a-form>
    </div>
    <div class="hp-modal-actions">
      <a-button class="hp-modal-cancel" @click="ruleModal = false">{{ t('common.cancel') }}</a-button>
      <a-button type="primary" class="hp-modal-submit" @click="saveRule">{{ t(editingRuleId ? 'common.save' : 'properties.profile.policiesTab.createNow') }}<ArrowRightOutlined /></a-button>
    </div>
  </a-modal>

  <a-modal v-model:open="childModal" :footer="null" width="min(1260px, 94vw)">
    <template #title><span class="hp-modal-title">{{ t(editingChildId ? 'properties.profile.policiesTab.editChild' : 'properties.profile.policiesTab.createChild') }}</span></template>
    <div class="hp-child-form">
      <div class="hp-switch-row">
        <span>{{ t('properties.profile.policiesTab.policyStatus') }}</span>
        <a-switch v-model:checked="childForm.status" />
      </div>
      <div class="hp-form-line" />
      <a-form layout="vertical" class="hp-form-grid">
        <a-form-item :label="t('properties.profile.policiesTab.policyName')" required><a-input v-model:value="childForm.name" :maxlength="60" /></a-form-item>
        <a-form-item :label="t('properties.profile.policiesTab.shortDescription')"><a-input v-model:value="childForm.description" :maxlength="120" /></a-form-item>
        <a-form-item :label="t('properties.profile.policiesTab.amount')">
          <div class="hp-amount-box">
            <a-input v-model:value="childForm.amount" :maxlength="40" :bordered="false" :placeholder="t('properties.profile.policiesTab.amountPlaceholder')" />
            <a-select v-model:value="childForm.currency" class="hp-currency-select" :options="currencyOptions" :bordered="false" :dropdown-match-select-width="false" :aria-label="t('properties.profile.policiesTab.currency')" />
          </div>
        </a-form-item>
        <a-form-item :label="t('properties.profile.policiesTab.perUnit')">
          <a-select v-model:value="childForm.unit">
            <a-select-option v-for="unit in unitOptions" :key="unit" :value="unit">{{ t(`properties.profile.policiesTab.units.${unit}`) }}</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </div>
    <div class="hp-modal-actions">
      <a-button class="hp-modal-cancel" @click="childModal = false">{{ t('common.cancel') }}</a-button>
      <a-button type="primary" class="hp-modal-submit" @click="saveChild">{{ t(editingChildId ? 'common.save' : 'properties.profile.policiesTab.createNow') }}<ArrowRightOutlined /></a-button>
    </div>
  </a-modal>
</template>

<style scoped lang="less">
.hp-panel { margin-bottom: 16px; padding: 15px 16px; border: 1px solid #e9ebf2; border-radius: 10px; background: #fff; box-shadow: 0 2px 6px rgb(24 27 42 / 3%); }
.panel-head, .edit-section-head, .hp-section-head, .hp-field, .hp-document-row { display: flex; align-items: center; }
.panel-head { min-height: 32px; justify-content: space-between; gap: 14px; padding-bottom: 10px; border-bottom: 1px solid #eef0f4; }
.panel-head h2, .edit-section-head h2 { margin: 0; font-size: 14px; line-height: 22px; }
.hp-section + .hp-section { border-top: 1px solid #f1f2f6; }
.hp-section-head { width: 100%; justify-content: space-between; gap: 10px; padding: 14px 0 10px; border: 0; background: none; color: #4d6cf4; font-size: 16px; font-weight: 600; cursor: pointer; }
/* 稿面 chevron 的「24」是 lucide 的方框尺寸,笔画本身只有 14x8(有大量内边距);
   antd 的 DownOutlined 字形几乎填满方框(24px 时实测 20x14),照抄 24 会明显偏大 —— 取 16px 与稿面视觉等大。 */
.hp-section-head :deep(svg) { color: #9aa0ae; font-size: 16px; transition: transform .18s; }
.hp-section-head :deep(svg.rotated) { transform: rotate(180deg); }
/* 分组体:稿面四个分组容器(696:4787 / 696:4811 / 696:4840 / 696:4882)都是 column + gap 24;
   分组头自身有 10px 下内边距,这里再补 14 → 头部到首块 24 */
.hp-section-body { display: grid; gap: 24px; padding: 14px 0; }
.hp-field { align-items: flex-start; gap: 18px; }.hp-field-block { display: grid; gap: 16px; }
/* 入住 / 退房政策(Figma 696:4817 / 696:4834):标签独占一行,下方值块整体居中 ——
   时间 Plus Jakarta Sans 700/48/-0.02em、说明 Inter 400/16 居中、证件行居中且证件之间以 `.` 分隔 */
.hp-check { display: grid; gap: 16px; }
/* 两块之间用独立的分隔线元素(.hp-form-line),间距由分组体的 gap 24 提供 */
.hp-check-value { display: grid; justify-items: center; gap: 16px; }
.hp-check-time { color: #4d6cf4; font-family: 'Plus Jakarta Sans', Inter, sans-serif; font-size: 48px; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; }
.hp-check-text { margin: 0; color: #1b1d30; font-size: 16px; line-height: 24px; text-align: center; }
.hp-check-text.empty { color: #a5a8b1; }
.hp-check-documents { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: center; gap: 16px; }
.hp-check-documents-label { color: #ec1317; font-size: 16px; font-weight: 500; }
.hp-check-documents b, .hp-check-dot { color: #1b1d30; font-size: 16px; font-weight: 600; }
.hp-check-dot { font-style: normal; }
.hp-label { flex: 0 0 190px; color: #8c8f9b; font-size: 16px; font-weight: 500; }
.hp-value { color: #181b2a; font-size: 16px; font-weight: 600; overflow-wrap: anywhere; }.hp-value.empty, .hp-text.empty { color: #a5a8b1; font-weight: 400; }
.hp-text { margin: 0; color: #1b1d30; font-size: 16px; font-weight: 600; line-height: 24px; }
/* ⚠️ 与稿面不同(用户口径):稿面 `696:4879` 的「宠物政策」是灰色标签(和 入住/退房 同款),
   但这一块在视图里夹在「儿童与加床政策」与「物业规则」两个蓝色分组标题之间,按用户要求也做成蓝色标题样式。
   「未填写」则走 .hp-text.empty 淡化(#a5a8b1 / 400),与「预订政策」几行的未填写同口径。 */
.hp-pet.inactive { opacity: .6; }
.hp-pet .hp-label { color: #4d6cf4; font-weight: 600; }
/* 儿童与加床政策:一屏 3 张并排卡(Figma 696:4846 视图 / 772:11929 编辑)。
   视图卡 = 白底 1px #E2E8F0 + 圆角 12 + padding 20;编辑卡 = 主色 1.5px 描边 + 圆角 8,
   顶部 edit/delete 分居两角,内容块底部 1px 分隔线,底部 Policy Status 行。 */
.hp-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
/* 卡片/规则列表与分组头之间要留出上边距:编辑态稿面 gap 16(Figma 772:12395),
   视图态分组头自身已有 10px 下内边距,再补 14 凑成稿面的 24(Figma 696:4841) */
.hp-card-grid { margin-top: 16px; }
.hp-view-card { display: grid; gap: 16px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
.hp-view-card.inactive { opacity: .6; }
.hp-card-block { display: grid; gap: 8px; min-width: 0; }
.hp-card-name { color: #1b1d30; font-size: 16px; font-weight: 700; line-height: 24px; overflow-wrap: anywhere; }
.hp-card-desc { margin: 0; color: rgba(25, 26, 37, .5); font-size: 14px; line-height: 21px; }
.hp-card-amount { display: flex; align-items: center; gap: 4px; }
.hp-card-amount b { color: #4d6cf4; font-size: 16px; font-weight: 600; }
.hp-card-amount span { color: rgba(25, 26, 37, .5); font-size: 12px; font-weight: 400; }
.hp-edit-card { display: grid; gap: 16px; padding: 0 0 24px; border: 1.5px solid #4d6cf4; border-radius: 8px; background: #fff; }
.hp-edit-card.inactive { opacity: .62; }
.hp-edit-card-tools { display: flex; align-items: center; justify-content: space-between; }
.hp-edit-card-tools button { display: grid; padding: 12px; border: 0; background: transparent; color: #c66e35; cursor: pointer; place-items: center; }
.hp-edit-card-tools button:last-child { color: #ff303f; }
.hp-edit-card-tools :deep(svg) { font-size: 24px; }
.hp-edit-card-body { display: grid; gap: 16px; padding: 16px 16px 24px; border-bottom: 1px solid #e2e8f0; }
.hp-edit-card-status { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 0 16px; }
.hp-edit-card-status > span { color: #1b1d30; font-size: 16px; font-weight: 600; }

/* 物业规则卡(Figma 696:4882 视图 / 772:12307 编辑):与儿童卡同一套壳,把金额行换成 36x36 图标 */
.hp-rule-view-icon { color: #4d6cf4; font-size: 36px; line-height: 1; }
.empty-row { margin: 0; color: #a5a8b1; font-size: 12px; }
.edit-section-head { justify-content: space-between; gap: 14px; padding-bottom: 12px; border-bottom: 1px solid #edf0f4; }
.edit-section-head h2 { display: flex; align-items: center; gap: 12px; }
.edit-section-head em { color: #c87542; font-size: 11px; font-style: normal; font-weight: 600; }
.edit-section-head > div { display: flex; align-items: center; gap: 20px; color: #9699a4; }
/* 编辑卡右上角的展开箭头:与视图分组头同一枚 chevron、同一尺寸
   (稿面两处都是 24 方框的 lucide chevron,实测笔画 14x8;原先用的文字箭头字符太小,已换成图标) */
.collapse-mark { color: #9aa0ae; font-size: 16px; }
.hp-form { padding-top: 12px; }.hp-form :deep(.ant-form-item-label > label) { color: #686c78; font-size: 12px; font-weight: 600; }
.hp-form :deep(.ant-textarea) { border-color: #e4e7ef; border-radius: 6px; }
.hp-document-editor { display: grid; gap: 8px; }
.hp-form-grid .hp-form-span { grid-column: 1 / -1; }
/* 儿童与加床政策弹窗(Figma 816:13556 / 814:13469):
   标题 PJS 600/18 → 状态行 + 1px 分隔线 → 2×2 字段网格(24 gap) → Cancel / Create Now(44 高) */
.hp-modal-title { color: #1b1d30; font-family: 'Plus Jakarta Sans', Inter, sans-serif; font-size: 18px; font-weight: 600; }
.hp-child-form { display: grid; gap: 24px; padding-top: 4px; }
.hp-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; color: #1b1d30; font-size: 16px; font-weight: 600; }
.hp-form-line { height: 1px; background: #e2e8f0; }
.hp-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.hp-form-grid :deep(.ant-form-item) { margin-bottom: 0; }
.hp-form-grid :deep(.ant-form-item-label) { padding-bottom: 6px; }
.hp-form-grid :deep(.ant-form-item-label > label) { color: #334155; font-size: 12px; font-weight: 600; }
/* ⚠️ 全局 src/styles/index.less 用 !important 把 antd 控件的尺寸/描边钉死了
   (`.ant-input{min-height:34px!important}`、`.ant-select-single:not(...) .ant-select-selector{height:34px!important}`、
   下拉文本 `line-height:32px!important`),不加 !important 的话**只有下拉框停在 34px**,
   与另外三个 44px 的输入框不等高。四个控件在这里统一:高 44 / 圆角 8 / 边 #E2E8F0 / 白底。 */
.hp-child-form :deep(.ant-input),
.hp-child-form :deep(.ant-select-single:not(.ant-select-customize-input):not(.hp-currency-select) .ant-select-selector) {
  height: 44px !important;
  min-height: 44px !important;
  border-color: #e2e8f0 !important;
  border-radius: 8px !important;
  background: #fff !important;
  box-shadow: none !important;
}
.hp-child-form :deep(.ant-select-single .ant-select-selector) { display: flex; align-items: center; }
.hp-child-form :deep(.ant-select-single .ant-select-selector .ant-select-selection-item),
.hp-child-form :deep(.ant-select-single .ant-select-selector .ant-select-selection-placeholder) {
  line-height: 42px !important;
}
.hp-amount-box { display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 5px 0 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }
.hp-child-form .hp-amount-box :deep(.ant-input) { flex: 1; height: 42px !important; min-height: 42px !important; padding: 0 !important; border: 0 !important; background: transparent !important; box-shadow: none !important; }
/* 金额框右侧的币种下拉(Figma 816:13582 的小胶囊;原来是只读,现按需求改为可选)。
   货币字典见 src/config/currencies.ts —— 定稿后只改那一个文件。 */
.hp-amount-box :deep(.hp-currency-select) { flex: 0 0 auto; width: 72px; }
.hp-amount-box :deep(.hp-currency-select .ant-select-selector) {
  display: flex;
  height: 24px !important;
  min-height: 24px !important;
  padding: 0 4px !important;
  align-items: center;
  border: 0 !important;
  border-radius: 4px !important;
  background: rgb(65 105 237 / 8%) !important;
  box-shadow: none !important;
}
.hp-amount-box :deep(.hp-currency-select .ant-select-selection-item) {
  padding: 0 16px 0 0 !important;
  color: #4d6cf4 !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  line-height: 24px !important;
}
.hp-amount-box :deep(.hp-currency-select .ant-select-arrow) { right: 4px; margin-top: -6px; height: 12px; color: #4d6cf4 !important; font-size: 12px; }
.hp-modal-actions { display: flex; align-items: center; justify-content: flex-end; gap: 16px; padding-top: 8px; }
.hp-modal-actions :deep(.ant-btn) { height: 44px; }
.hp-modal-cancel { padding: 0 12px; border-color: #e2e8f0; border-radius: 6px; }
.hp-modal-submit { padding: 0 16px; border-radius: 8px; }
@media (max-width: 900px) { .hp-label { flex-basis: 150px; }.hp-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .hp-field { flex-direction: column; gap: 6px; }.hp-card-grid { grid-template-columns: 1fr; }.hp-form-grid { grid-template-columns: 1fr; } }
</style>
