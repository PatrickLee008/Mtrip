<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { apiMerchantDetail, apiPropertyCommercial, apiSavePropertyCommercial, type PropertyCommercialView } from '@/api/merchant';
import { genUUID } from '@/utils/uuid';
const props = defineProps<{ merchantId: number; defaultRate: string }>();
const { t } = useI18n();
const properties = ref<{ id: number; store_name: string }[]>([]);
const selected = ref<number>();
const data = ref<PropertyCommercialView | null>(null);
const loading = ref(false);
const failed = ref(false);
const saving = ref(false);
const open = ref(false);
const form = reactive({ inherit: true, rate: 0, effectiveAt: '', reason: '' });
let listSerial = 0;
let detailSerial = 0;
let requestId = ''; let retryPayload = '';
async function loadProperties(): Promise<void> {
  const request = ++listSerial; detailSerial++; open.value = false; selected.value = undefined; data.value = null; properties.value = [];
  failed.value = false; loading.value = true;
  try {
    const result = await apiMerchantDetail(props.merchantId);
    if (request !== listSerial) return;
    properties.value = result.properties.map(p => ({ id: Number(p.id), store_name: String(p.store_name) }));
    selected.value = properties.value[0]?.id;
  } catch { if (request === listSerial) failed.value = true; }
  finally { if (request === listSerial) loading.value = false; }
}
watch(() => props.merchantId, () => { void loadProperties(); }, { immediate: true });
async function load(): Promise<void> {
  const request = ++detailSerial; data.value = null; failed.value = false; open.value = false;
  if (!selected.value) { loading.value = false; return; }
  loading.value = true;
  try { const result = await apiPropertyCommercial(props.merchantId, selected.value); if (request === detailSerial) data.value = result; }
  catch { if (request === detailSerial) failed.value = true; }
  finally { if (request === detailSerial) loading.value = false; }
}
function retry(): void { if (selected.value) void load(); else void loadProperties(); }
watch(selected, () => { void load(); });
function edit(): void {
  if (!data.value) return;
  Object.assign(form, { inherit: data.value.current?.commission_rate == null, rate: Number(data.value.current?.commission_rate ?? 0),
    effectiveAt: new Date().toISOString().slice(0,19), reason: '' });
  requestId = ''; retryPayload = ''; open.value = true;
}
async function save(): Promise<void> {
  if (saving.value || !data.value || !selected.value) return;
  const when = new Date(form.effectiveAt + 'Z');
  if (!form.reason.trim() || form.reason.trim().length > 500 || !Number.isFinite(when.getTime())
    || (!form.inherit && (!Number.isFinite(form.rate) || form.rate < 0 || form.rate > 100 || !/^\d+(\.\d{1,2})?$/.test(String(form.rate))))) {
    message.warning(t('merchantCommercial.propertyRequired')); return;
  }
  const payload = { merchantId: props.merchantId, propertyId: selected.value, expectedVersion: data.value.latest_version,
    commissionRate: form.inherit ? null : form.rate, effectiveAt: when.toISOString(), reason: form.reason.trim() };
  const key = JSON.stringify(payload);
  if (key !== retryPayload) { requestId = genUUID(); retryPayload = key; }
  saving.value = true;
  try {
    const result = await apiSavePropertyCommercial({ ...payload, requestId });
    if (props.merchantId === payload.merchantId && selected.value === payload.propertyId) { data.value = result; open.value = false; }
    message.success(t('tip.saveSuccess'));
  }
  finally { saving.value = false; }
}
</script>
<template>
  <section class="property-commission">
    <header class="property-header">
      <h4>{{ t('merchantCommercial.propertyCommission') }}</h4>
      <a-button v-if="data" v-perm="'merchant:list:edit'" type="link" size="small" @click="edit">
        {{ t('merchantCommercial.editProperty') }}
      </a-button>
    </header>
    <a-select v-if="properties.length" v-model:value="selected" class="property-select"
      :disabled="saving" :aria-label="t('merchantCommercial.selectProperty')" :placeholder="t('merchantCommercial.selectProperty')">
      <a-select-option v-for="property in properties" :key="property.id" :value="property.id">{{ property.store_name }} (#{{ property.id }})</a-select-option>
    </a-select>
    <a-spin :spinning="loading" size="small">
      <div v-if="data" class="property-rate" aria-live="polite">
        <div>
          <span class="rate-label">{{ t('merchantCommercial.effectiveRate') }}</span>
          <strong>{{ data.current?.commission_rate ?? defaultRate }}<small>%</small></strong>
        </div>
        <span class="rate-source" :class="{ override: data.current?.commission_rate != null }">
          {{ t(data.current?.commission_rate == null ? 'merchantCommercial.merchantDefault' : 'merchantCommercial.propertyOverride') }}
        </span>
      </div>
      <a-alert v-else-if="failed" type="error" :message="t('merchantCommercial.loadFailed')"><template #action><a-button @click="retry">{{ t('common.refresh') }}</a-button></template></a-alert>
      <div v-else class="property-placeholder">{{ loading ? '' : t('merchant.profile.noProperties') }}</div>
    </a-spin>
    <a-modal v-model:open="open" :title="t('merchantCommercial.propertyCommission')" :confirm-loading="saving" :mask-closable="!saving" @ok="save">
      <a-form layout="vertical">
        <a-form-item><a-checkbox v-model:checked="form.inherit">{{ t('merchantCommercial.inheritRate') }}</a-checkbox></a-form-item>
        <a-form-item v-if="!form.inherit" :label="t('merchantCommercial.commissionRate')"><a-input-number v-model:value="form.rate" :min="0" :max="100" :precision="2" /></a-form-item>
        <a-form-item :label="t('merchantCommercial.effectiveUtc')" required><a-input v-model:value="form.effectiveAt" type="datetime-local" step="1" /></a-form-item>
        <a-form-item :label="t('merchantCommercial.reason')" required><a-textarea v-model:value="form.reason" :maxlength="500" /></a-form-item>
      </a-form>
      <a-table :data-source="data?.history ?? []" :pagination="{pageSize:5}" row-key="id" :scroll="{x:650}">
        <a-table-column key="version" data-index="version" :title="t('merchantCommercial.history')" />
        <a-table-column key="commission_rate" :title="t('merchantCommercial.commissionRate')"><template #default="{record}">{{ record.commission_rate == null ? t('merchantCommercial.inheritRate') : `${record.commission_rate}%` }}</template></a-table-column>
        <a-table-column key="effective_at" data-index="effective_at" :title="t('merchantCommercial.effectiveUtc')" />
        <a-table-column key="created_by_name" data-index="created_by_name" :title="t('merchantCommercial.editor')" />
        <a-table-column key="reason" data-index="reason" :title="t('merchantCommercial.reason')" />
      </a-table>
    </a-modal>
  </section>
</template>

<style scoped>
.property-commission { display: grid; gap: 10px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #e3e8f0; }
.property-header, .property-rate { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 12px; }
.property-header h4 { margin: 0; color: #344054; font-size: 12px; font-weight: 600; line-height: 18px; }
.property-header .ant-btn { height: auto; padding: 2px 0; color: #4f46e5; font-size: 12px; }
.property-select { width: 100%; min-width: 0; font-size: 12px; }
.property-rate { padding: 10px 12px; border-radius: 8px; background: #f8fafc; }
.rate-label { display: block; color: #475569; font-size: 11px; line-height: 17px; }
.property-rate strong { display: block; margin-top: 2px; color: #1a2332; font-size: 18px; line-height: 24px; font-weight: 600; font-variant-numeric: tabular-nums; }
.property-rate small { margin-left: 2px; font-size: 12px; }
.rate-source { padding: 2px 8px; border: 1px solid #dce3eb; border-radius: 12px; color: #475569; background: #fff; font-size: 11px; line-height: 16px; }
.rate-source.override { color: #4338ca; border-color: #c7d2fe; background: #eef2ff; }
.property-placeholder { min-height: 36px; padding: 8px 0; color: #64748b; font-size: 12px; }
</style>
