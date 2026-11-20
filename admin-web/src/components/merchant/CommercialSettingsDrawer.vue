<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { CalculatorOutlined, CloseOutlined, HistoryOutlined } from '@ant-design/icons-vue';
import dayjs, { type Dayjs } from 'dayjs';
import PropertyCommissionSettings from './PropertyCommissionSettings.vue';
import type { TableRow } from '@/composables/useTable';
import { genUUID } from '@/utils/uuid';
import { apiMerchantCommercialSettings, apiMerchantCommercialSave, apiMerchantCommercialHistory,
  type CommissionPlan, type MerchantCommercialSettings, type CommercialTerms } from '@/api/merchant';

const props = defineProps<{ merchant: TableRow }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useI18n();
const data = ref<MerchantCommercialSettings | null>(null);
const loading = ref(false);
const loadFailed = ref(false);
const editOpen = ref(false);
const saving = ref(false);
const expectedVersion = ref(0);
const historyOpen = ref(false);
const historyFailed = ref(false);
const history = { list: ref<CommercialTerms[]>([]), total: ref(0), page: ref(1), pageSize: ref(10), loading: ref(false) };
const historyPagination = computed(() => ({ current: history.page.value, pageSize: history.pageSize.value, total: history.total.value,
  showSizeChanger: false, showQuickJumper: false, onChange: (page: number) => { void loadHistory(page); },
  showTotal: (total: number, range: [number, number]) => t('merchant.verifyPage.paginationInfo', { from: range[0], to: range[1], total }),
}));
const form = reactive({ commissionPlan: undefined as CommissionPlan | undefined, commissionRate: null as number | null,
  transactionFeeRate: null as number | null, payAtHotelEnabled: false, noShowFeeEnabled: false,
  merchantUpfrontRate: 0 as number | null, effectiveAt: undefined as Dayjs | undefined, reason: '' });
watch(() => form.payAtHotelEnabled, enabled => {
  if (!enabled) { form.noShowFeeEnabled = false; form.merchantUpfrontRate = 0; }
}, { flush: 'sync' });
watch(() => form.noShowFeeEnabled, enabled => { if (!enabled) form.merchantUpfrontRate = 0; }, { flush: 'sync' });
let loadRequest = 0;
let historyRequest = 0;
let requestId = '';
let retryPayload = '';
async function load(): Promise<void> {
  const request = ++loadRequest;
  loading.value = true;
  loadFailed.value = false;
  try {
    const result = await apiMerchantCommercialSettings(props.merchant.id);
    if (request === loadRequest) data.value = result;
  } catch {
    if (request === loadRequest) { data.value = null; loadFailed.value = true; }
  } finally { if (request === loadRequest) loading.value = false; }
}
watch(() => props.merchant.id, () => {
  editOpen.value = false;
  historyOpen.value = false;
  historyRequest += 1;
  history.list.value = [];
  history.total.value = 0;
  history.loading.value = false;
  historyFailed.value = false;
  data.value = null;
  void load();
}, { immediate: true });
function toDate(value: string): Dayjs { return dayjs(value.replace(' ', 'T') + 'Z'); }
function formatTime(value: string | null): string { return value ? toDate(value).format('YYYY-MM-DD HH:mm') : '—'; }
function planText(plan: string | null): string { return t(`merchantDirectory.${plan || 'unconfigured'}`); }
function enabledText(enabled: boolean): string { return t(enabled ? 'status.enabled' : 'status.disabled'); }
function summaryFields(terms: CommercialTerms) {
  return [
    { key: 'commissionPlan', label: t('merchant.profile.commissionPlan'), value: planText(terms.commission_plan) },
    { key: 'commissionRate', label: t('merchantCommercial.commissionRate'), value: `${terms.commission_rate}%` },
    { key: 'transactionFee', label: t('merchantCommercial.transactionFeeRate'), value: `${terms.transaction_fee_rate}%` },
    { key: 'payAtHotel', label: t('merchantCommercial.payAtHotel'), value: enabledText(terms.pay_at_hotel_enabled) },
    { key: 'noShow', label: t('merchantCommercial.noShowFee'), value: enabledText(terms.no_show_fee_enabled) },
    { key: 'upfront', label: t('merchantCommercial.merchantUpfrontRate'), value: `${terms.merchant_upfront_rate}%` },
  ];
}
async function openEdit(): Promise<void> {
  const merchantId = props.merchant.id;
  editOpen.value = true;
  requestId = '';
  retryPayload = '';
  form.effectiveAt = undefined;
  form.reason = '';
  await load();
  if (!editOpen.value || props.merchant.id !== merchantId || !data.value) return;
  expectedVersion.value = data.value.latest_version;
  const current = data.value.current;
  Object.assign(form, { commissionPlan: current.commission_plan || undefined, commissionRate: Number(current.commission_rate),
    transactionFeeRate: Number(current.transaction_fee_rate), payAtHotelEnabled: current.pay_at_hotel_enabled,
    noShowFeeEnabled: current.no_show_fee_enabled, merchantUpfrontRate: Number(current.merchant_upfront_rate) });
}
function validRate(value: number | null, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max && /^\d+(\.\d{1,2})?$/.test(String(value));
}
const validRates = computed(() => validRate(form.commissionRate, 100) && validRate(form.transactionFeeRate, 100) && validRate(form.merchantUpfrontRate, 30));
const preview = computed(() => {
  if (!validRates.value) return null;
  // Example room price: 100,000 MMK. Use integer cents and basis points for each component.
  const price = 10000000;
  const commission = Math.round(price * Math.round(Number(form.commissionRate) * 100) / 10000);
  const transactionFee = Math.round(commission * Math.round(Number(form.transactionFeeRate) * 100) / 10000);
  const merchantUpfront = form.payAtHotelEnabled && form.noShowFeeEnabled ? Math.round(price * Math.round(Number(form.merchantUpfrontRate) * 100) / 10000) : 0;
  return { commission: commission / 100, transactionFee: transactionFee / 100, merchantUpfront: merchantUpfront / 100,
    upfront: (commission + merchantUpfront + transactionFee) / 100, balance: (price - commission - merchantUpfront) / 100 };
});
function money(value: number): string { return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} MMK`; }
async function save(): Promise<void> {
  if (saving.value || loading.value || !data.value) return;
  if (!form.commissionPlan || !form.effectiveAt?.isValid() || !form.reason.trim() || form.reason.trim().length > 500) {
    message.warning(t('merchantCommercial.required')); return;
  }
  if (!validRates.value || (!form.payAtHotelEnabled && (form.noShowFeeEnabled || form.merchantUpfrontRate !== 0))
    || (!form.noShowFeeEnabled && form.merchantUpfrontRate !== 0)
    || (form.payAtHotelEnabled && Number(form.commissionRate) + Number(form.merchantUpfrontRate) > 100)) {
    message.warning(t('merchantCommercial.invalidRates')); return;
  }
  const payload = { id: props.merchant.id, expectedVersion: expectedVersion.value, commissionPlan: form.commissionPlan,
    commissionRate: Number(form.commissionRate), transactionFeeRate: Number(form.transactionFeeRate),
    payAtHotelEnabled: form.payAtHotelEnabled, noShowFeeEnabled: form.noShowFeeEnabled,
    merchantUpfrontRate: Number(form.merchantUpfrontRate), effectiveAt: form.effectiveAt.millisecond(0).toISOString(), reason: form.reason.trim() };
  const key = JSON.stringify(payload);
  if (key !== retryPayload) { requestId = genUUID(); retryPayload = key; }
  saving.value = true;
  try {
    data.value = await apiMerchantCommercialSave({ ...payload, requestId });
    editOpen.value = false;
    message.success(t('tip.saveSuccess'));
    emit('changed');
  } catch { /* HTTP layer displays the error; preserve the form and request ID for retry. */ }
  finally { saving.value = false; }
}
async function loadHistory(page = 1): Promise<void> {
  const request = ++historyRequest;
  history.page.value = page;
  history.loading.value = true;
  historyFailed.value = false;
  try {
    const result = await apiMerchantCommercialHistory({ id: props.merchant.id, page, pageSize: history.pageSize.value });
    if (request !== historyRequest) return;
    history.list.value = result.list;
    history.total.value = result.total;
  } catch {
    if (request === historyRequest) { history.list.value = []; history.total.value = 0; historyFailed.value = true; }
  } finally { if (request === historyRequest) history.loading.value = false; }
}
function showHistory(): void { historyOpen.value = true; void loadHistory(); }
</script>

<template>
  <section class="commercial-section">
    <div class="commercial-section-heading">
      <h4>{{ t('merchantCommercial.title') }}</h4>
      <a-button v-perm="'merchant:list:list'" type="link" size="small" @click="showHistory"><HistoryOutlined />{{ t('merchantCommercial.history') }}</a-button>
    </div>
    <a-spin :spinning="loading">
      <div v-if="data" class="commercial-summary">
        <dl class="commercial-summary-grid">
          <div v-for="field in summaryFields(data.current)" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div>
        </dl>
        <p class="commercial-muted">{{ data.current.version ? t('merchantCommercial.currentVersion', { version: data.current.version, date: formatTime(data.current.effective_at) }) : t('merchantCommercial.legacyTerms') }}</p>
        <p v-if="data.next" class="commercial-next">{{ t('merchantCommercial.nextVersion', { version: data.next.version, date: formatTime(data.next.effective_at) }) }}</p>
        <a-button v-if="[3, 4].includes(Number(merchant.status))" v-perm="'merchant:list:edit'" class="commercial-edit" block @click="openEdit">{{ t('merchantCommercial.edit') }}</a-button>
        <PropertyCommissionSettings :merchant-id="merchant.id" />
      </div>
      <a-alert v-else-if="loadFailed" type="error" :message="t('merchantCommercial.loadFailed')">
        <template #action><a-button size="small" @click="load">{{ t('common.refresh') }}</a-button></template>
      </a-alert>
    </a-spin>
  </section>

  <a-drawer v-model:open="editOpen" root-class-name="merchant-commercial-drawer" :width="600" :z-index="1100" :closable="false" :mask-closable="!saving" :keyboard="!saving">
    <template #title>
      <div class="commercial-heading"><div><h2>{{ t('merchantCommercial.edit') }}</h2><p>{{ merchant.merchant_name }} ({{ merchant.merchant_code || '#' + merchant.id }})</p></div>
        <a-button type="text" :disabled="saving" :aria-label="t('common.close')" @click="editOpen = false"><CloseOutlined /></a-button>
      </div>
    </template>
    <a-spin :spinning="loading">
      <a-alert v-if="loadFailed" type="error" :message="t('merchantCommercial.loadFailed')" />
      <a-form v-else layout="vertical" :disabled="saving || loading" class="commercial-form">
        <a-alert v-if="data?.next" type="info" :message="t('merchantCommercial.scheduledHint')" />
        <section class="commercial-card">
          <header><span>1</span><div><h3>{{ t('merchantCommercial.commissionTitle') }}</h3><p>{{ t('merchantCommercial.commissionHint') }}</p></div></header>
          <a-form-item :label="t('merchant.profile.commissionPlan')" html-for="commercial-plan" required>
            <a-select id="commercial-plan" v-model:value="form.commissionPlan" :placeholder="t('common.pleaseSelect')">
              <a-select-option v-for="plan in ['vip', 'premium', 'standard']" :key="plan" :value="plan">{{ planText(plan) }}</a-select-option>
            </a-select>
          </a-form-item>
          <div class="commercial-form-grid">
            <a-form-item :label="t('merchantCommercial.commissionRate')" html-for="commercial-rate" required><a-input-number id="commercial-rate" v-model:value="form.commissionRate" :min="0" :max="100" :step="0.01" :precision="2" addon-after="%" /></a-form-item>
            <a-form-item :label="t('merchantCommercial.transactionFeeRate')" html-for="commercial-fee" :extra="t('merchantCommercial.transactionFeeHint')" required><a-input-number id="commercial-fee" v-model:value="form.transactionFeeRate" :min="0" :max="100" :step="0.01" :precision="2" addon-after="%" /></a-form-item>
          </div>
        </section>
        <section class="commercial-card">
          <header><span>2</span><div><h3>{{ t('merchantCommercial.payAtHotelTitle') }}</h3><p>{{ t('merchantCommercial.payAtHotelHint') }}</p></div></header>
          <div class="commercial-switch-row"><div><strong>{{ t('merchantCommercial.payAtHotel') }}</strong><p>{{ t('merchantCommercial.payAtHotelDescription') }}</p></div><a-switch v-model:checked="form.payAtHotelEnabled" :aria-label="t('merchantCommercial.payAtHotel')" /></div>
          <p class="commercial-muted">{{ t('merchantCommercial.appNotOpen') }}</p>
        </section>
        <section class="commercial-card commercial-card-no-show">
          <header><span>3</span><div><h3>{{ t('merchantCommercial.noShowTitle') }}</h3><p>{{ t('merchantCommercial.noShowHint') }}</p></div></header>
          <a-radio-group v-model:value="form.noShowFeeEnabled" :disabled="!form.payAtHotelEnabled" class="commercial-radio-group" :aria-label="t('merchantCommercial.noShowTitle')">
            <a-radio :value="false" class="commercial-choice" :class="{ selected: !form.noShowFeeEnabled }"><strong>{{ t('merchantCommercial.noFee') }}</strong><p>{{ t('merchantCommercial.noFeeHint') }}</p></a-radio>
            <a-radio :value="true" class="commercial-choice" :class="{ selected: form.noShowFeeEnabled }"><strong>{{ t('merchantCommercial.chargeFee') }}</strong><p>{{ t('merchantCommercial.chargeFeeHint') }}</p></a-radio>
          </a-radio-group>
          <a-form-item v-if="form.noShowFeeEnabled" :label="t('merchantCommercial.merchantUpfrontRate')" html-for="commercial-upfront" :extra="t('merchantCommercial.upfrontMax')" class="commercial-upfront" required><a-input-number id="commercial-upfront" v-model:value="form.merchantUpfrontRate" :min="0" :max="30" :step="0.01" :precision="2" :disabled="!form.payAtHotelEnabled" addon-after="%" /></a-form-item>
          <div v-if="form.payAtHotelEnabled && preview" class="commercial-preview">
            <div class="commercial-preview-header"><CalculatorOutlined /><div><strong>{{ t('merchantCommercial.previewTitle') }}</strong><p>{{ t('merchantCommercial.examplePrice') }}</p></div><span>{{ t('merchantCommercial.livePreview') }}</span></div>
            <dl>
              <div><dt>{{ t('merchantCommercial.commissionAmount', { rate: form.commissionRate }) }}</dt><dd>{{ money(preview.commission) }}</dd></div>
              <div><dt>{{ t('merchantCommercial.transactionFeeAmount', { rate: form.transactionFeeRate }) }}</dt><dd>{{ money(preview.transactionFee) }}</dd></div>
              <div><dt>{{ t('merchantCommercial.merchantUpfrontAmount', { rate: form.merchantUpfrontRate }) }}</dt><dd>{{ money(preview.merchantUpfront) }}</dd></div>
              <div class="commercial-preview-total"><dt>{{ t('merchantCommercial.customerUpfront') }}</dt><dd>{{ money(preview.upfront) }}</dd></div>
              <div><dt>{{ t('merchantCommercial.balanceAtHotel') }}</dt><dd>{{ money(preview.balance) }}</dd></div>
            </dl>
            <p>{{ t('merchantCommercial.previewFeeHint') }}</p>
          </div>
          <p v-else class="commercial-muted">{{ t('merchantCommercial.previewUnavailable') }}</p>
        </section>
        <section class="commercial-card">
          <header><span>4</span><div><h3>{{ t('merchantCommercial.effectiveTitle') }}</h3><p>{{ t('merchantCommercial.effectiveHint') }}</p></div></header>
          <a-form-item :label="t('merchantCommercial.effectiveAt')" html-for="commercial-effective" required><a-date-picker id="commercial-effective" v-model:value="form.effectiveAt" :show-time="{ format: 'HH:mm' }" format="YYYY-MM-DD HH:mm" :placeholder="t('merchantCommercial.selectDateTime')" /><div class="commercial-muted">{{ t('merchantCommercial.localTime') }}</div></a-form-item>
          <a-form-item :label="t('merchantCommercial.reason')" html-for="commercial-reason" required><a-textarea id="commercial-reason" v-model:value="form.reason" :maxlength="500" :rows="3" show-count /></a-form-item>
        </section>
      </a-form>
    </a-spin>
    <template #footer><div class="commercial-footer"><a-button :disabled="saving" @click="editOpen = false">{{ t('common.cancel') }}</a-button><a-button type="primary" :loading="saving" :disabled="loading || !data || loadFailed" @click="save">{{ t('merchantCommercial.save') }}</a-button></div></template>
  </a-drawer>

  <a-drawer v-model:open="historyOpen" root-class-name="merchant-commercial-history" :width="600" :z-index="1100" :title="t('merchantCommercial.history')">
    <p class="commercial-muted">{{ t('merchantCommercial.localTime') }}</p>
    <a-spin :spinning="history.loading.value">
      <a-alert v-if="historyFailed" type="error" :message="t('merchantCommercial.historyFailed')">
        <template #action><a-button size="small" @click="loadHistory(history.page.value)">{{ t('common.refresh') }}</a-button></template>
      </a-alert>
      <article v-for="record in history.list.value" :key="record.version" class="commercial-history-card">
        <h3>{{ t('merchantCommercial.version', { version: record.version }) }} <span>{{ formatTime(record.effective_at) }}</span></h3>
        <dl class="commercial-summary-grid"><div v-for="field in summaryFields(record)" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div></dl>
        <p class="commercial-history-reason">{{ record.reason }}</p>
        <p class="commercial-muted">{{ record.created_by_name || '—' }} · {{ formatTime(record.created_at) }}</p>
      </article>
      <a-empty v-if="!historyFailed && !history.loading.value && !history.list.value.length" :description="t('common.noData')" />
      <a-pagination v-if="history.total.value" v-bind="historyPagination" size="small" />
    </a-spin>
  </a-drawer>
</template>

<style scoped>
.commercial-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.commercial-section h4 { margin: 0; font-size: 12px; line-height: 18px; font-weight: 600; letter-spacing: .06em; color: #64748b; text-transform: uppercase; }
.commercial-section-heading .ant-btn { padding: 0; height: auto; font-size: 11px; }
.commercial-summary { border: 1px solid #e3e8f0; border-radius: 8px; padding: 14px; }
.commercial-summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0; }
.commercial-summary-grid dt { color: #94a3b8; font-size: 11px; line-height: 17px; }
.commercial-summary-grid dd { margin: 3px 0 0; color: #1a2332; font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
.commercial-muted { margin: 10px 0 0; color: #94a3b8; font-size: 11px; line-height: 17px; }
.commercial-next { margin: 8px 0 0; padding: 8px 10px; border-radius: 6px; background: #fffaeb; color: #b54708; font-size: 11px; line-height: 17px; }
.commercial-edit { margin-top: 12px; height: 36px; border-color: #c7d2fe; background: #eef2ff; color: #4f46e5; font-size: 13px; }
.commercial-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.commercial-heading > div { min-width: 0; }
.commercial-heading h2 { margin: 0; color: #1a2332; font-size: 15px; font-weight: 700; line-height: 21px; }
.commercial-heading p { margin: 1px 0 0; color: #94a3b8; font-size: 12px; font-weight: 400; line-height: 18px; overflow-wrap: anywhere; }
.commercial-heading > .ant-btn { flex: 0 0 32px; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; color: #64748b; }
.commercial-form { display: flex; flex-direction: column; gap: 16px; }
.commercial-card { padding: 20px; border: 1px solid #e3e8f0; border-radius: 12px; background: #fff; box-shadow: 0 1px 3px #10182812; }
.commercial-card-no-show { border-color: #c7d2fe; }
.commercial-card header { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; }
.commercial-card header > span { display: flex; align-items: center; justify-content: center; flex: 0 0 28px; height: 28px; border-radius: 50%; background: #5354f8; color: #fff; font-size: 12px; font-weight: 600; }
.commercial-card h3 { margin: 0; font-size: 13px; line-height: 20px; font-weight: 700; color: #1a2332; }
.commercial-card header p { margin: 2px 0 0; font-size: 12px; line-height: 18px; color: #64748b; }
.commercial-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.commercial-card :deep(.ant-form-item) { margin-bottom: 16px; }
.commercial-card :deep(.ant-form-item:last-child) { margin-bottom: 0; }
.commercial-card :deep(.ant-form-item-label > label) { font-size: 12px; font-weight: 600; color: #344054; height: auto; }
.commercial-card :deep(.ant-form-item-extra) { margin-top: 4px; font-size: 10px; line-height: 16px; color: #94a3b8; }
.commercial-card :deep(.ant-input-number-group-wrapper), .commercial-card :deep(.ant-input-number), .commercial-card :deep(.ant-picker) { width: 100%; }
.commercial-card :deep(.ant-select-selector) { min-height: 40px; align-items: center; }
.commercial-card :deep(.ant-input-number-input) { height: 38px; font-size: 13px; }
.commercial-card :deep(.ant-picker) { min-height: 40px; }
.commercial-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; border: 1px solid #e3e8f0; border-radius: 8px; background: #f8fafc; }
.commercial-switch-row strong { font-size: 13px; color: #1a2332; }
.commercial-switch-row p { margin: 3px 0 0; color: #64748b; font-size: 12px; line-height: 18px; }
.commercial-switch-row :deep(.ant-switch-checked) { background: #47b88e; }
.commercial-radio-group { display: flex; flex-direction: column; gap: 12px; }
.commercial-choice { display: flex; align-items: flex-start; margin: 0; padding: 14px; border: 1px solid #e3e8f0; border-radius: 8px; }
.commercial-choice.selected { border-color: #5354f8; background: #f8f9ff; }
.commercial-choice :deep(.ant-radio) { margin-top: 2px; }
.commercial-choice strong { font-size: 12px; color: #1a2332; }
.commercial-choice p { margin: 3px 0 0; font-size: 12px; line-height: 18px; color: #64748b; }
.commercial-upfront { margin-top: 14px; padding: 0 14px; }
.commercial-preview { margin-top: 16px; border: 1px solid #c7d2fe; border-radius: 10px; background: #f6f8ff; overflow: hidden; }
.commercial-preview-header { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #e3e8f0; }
.commercial-preview-header > .anticon { padding: 8px; border-radius: 6px; background: #fff; color: #5354f8; }
.commercial-preview-header > div { flex: 1; min-width: 0; }
.commercial-preview-header strong { font-size: 12px; color: #1a2332; }
.commercial-preview-header p { margin: 2px 0 0; font-size: 10px; color: #64748b; }
.commercial-preview-header > span:last-child { padding: 2px 6px; border: 1px solid #e3e8f0; border-radius: 12px; background: #fff; color: #5354f8; font-size: 9px; font-weight: 600; }
.commercial-preview dl { margin: 0; padding: 12px 14px 0; }
.commercial-preview dl > div { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-bottom: 8px; }
.commercial-preview dt { color: #475569; font-size: 12px; line-height: 18px; }
.commercial-preview dd { margin: 0; font: 500 12px/18px monospace; color: #1a2332; white-space: nowrap; }
.commercial-preview-total { padding-top: 12px; border-top: 1px solid #d0d5dd; }
.commercial-preview-total dt { color: #1a2332; font-weight: 700; }
.commercial-preview-total dd { color: #5354f8; font-size: 15px; font-weight: 700; }
.commercial-preview > p { margin: 0; padding: 0 14px 12px; color: #64748b; font-size: 10px; line-height: 16px; }
.commercial-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.commercial-footer .ant-btn { height: 38px; border-radius: 7px; font-size: 13px; font-weight: 600; }
.commercial-footer .ant-btn-primary { background: #5354f8; }
.commercial-history-card { padding: 14px; margin-top: 12px; border: 1px solid #e3e8f0; border-radius: 8px; }
.commercial-history-card h3 { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin: 0 0 12px; color: #1a2332; font-size: 13px; }
.commercial-history-card h3 > span { color: #64748b; font-size: 11px; font-weight: 400; }
.commercial-history-reason { margin: 12px 0 0; padding-top: 10px; border-top: 1px solid #f1f5f9; color: #475569; font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
:global(.merchant-commercial-drawer .ant-drawer-content-wrapper), :global(.merchant-commercial-history .ant-drawer-content-wrapper) { max-width: 100vw; }
:global(.merchant-commercial-drawer .ant-drawer-header) { min-height: 60px; padding: 10px 24px; border-color: #e3e8f0; }
:global(.merchant-commercial-drawer .ant-drawer-body) { padding: 20px 24px; background: #fafbfc; }
:global(.merchant-commercial-drawer .ant-drawer-footer) { padding: 14px 24px; border-color: #e3e8f0; }
:global(.merchant-commercial-history .ant-pagination) { margin-top: 16px; }
@media (max-width: 480px) {
  .commercial-form-grid { grid-template-columns: 1fr; gap: 0; }
  .commercial-card { padding: 16px; }
  .commercial-preview-header > span:last-child { display: none; }
  .commercial-preview-total dd { font-size: 13px; }
  :global(.merchant-commercial-drawer .ant-drawer-header), :global(.merchant-commercial-drawer .ant-drawer-footer) { padding: 10px 16px; }
  :global(.merchant-commercial-drawer .ant-drawer-body), :global(.merchant-commercial-history .ant-drawer-body) { padding: 16px; }
}
</style>
