<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import type { TableRow } from '@/composables/useTable';
import { apiMerchantPropertyBind, apiMerchantPropertyHistory } from '@/api/merchant';
import { useTable } from '@/composables/useTable';

const props = defineProps<{ merchant: TableRow; applications: TableRow[]; businesses: TableRow[]; properties: TableRow[]; group: TableRow | null }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useI18n();
const open = ref(false);
const saving = ref(false);
const historyOpen = ref(false);
const history = useTable(params => apiMerchantPropertyHistory({ ...params, merchantId: props.merchant.id }));
function showHistory(): void {
  historyOpen.value = true;
  history.search();
}
const historyColumns = computed(() => [
  { title: t('merchantDirectory.property'), dataIndex: 'store_id', width: 75 },
  { title: t('merchantDirectory.version'), dataIndex: 'version', width: 65 },
  { title: t('merchantStatus.note'), dataIndex: 'note' },
  { title: t('merchantStatus.actor'), dataIndex: 'actor_name', width: 100 },
  { title: t('common.createdAt'), dataIndex: 'created_at', width: 165 },
]);
const target = ref<TableRow | null>(null);
const form = reactive({ storeId: 0, expectedVersion: 0, countryCode: '', cityKey: '', note: '' });
const hotels = computed(() => props.businesses.filter(b => b.business_type === 'hotel'));
const unlinkedStores = computed(() => props.properties.filter(s => !s.source_business_id));
const choices = computed(() => [
  { value: 0, label: t('merchantDirectory.createProperty') },
  ...unlinkedStores.value.map(s => ({ value: Number(s.id), label: '#' + s.id + ' ' + s.store_name })),
]);
function linked(business: TableRow): TableRow | undefined {
  return props.properties.find(s => Number(s.source_business_id) === Number(business.id));
}
function edit(business: TableRow): void {
  target.value = business;
  const store = linked(business);
  Object.assign(form, { storeId: Number(store?.id ?? 0), expectedVersion: Number(store?.mapping_version ?? 0),
    countryCode: store?.country_code ?? '', cityKey: store?.city_key ?? business.city ?? '', note: '' });
  open.value = true;
}
function storeChanged(value: number): void {
  form.expectedVersion = Number(props.properties.find(s => Number(s.id) === value)?.mapping_version ?? 0);
}
async function save(): Promise<void> {
  if (!target.value || !/^[a-z]{2}$/i.test(form.countryCode.trim()) || !form.cityKey.trim() || !form.note.trim()) {
    message.warning(t('merchantDirectory.required'));
    return;
  }
  saving.value = true;
  try {
    await apiMerchantPropertyBind({ merchantId: props.merchant.id, businessId: target.value.id, ...form });
    open.value = false;
    message.success(t('tip.saveSuccess'));
    emit('changed');
  } finally { saving.value = false; }
}
const businessColumns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 65 },
  { title: t('merchantDirectory.business'), dataIndex: 'business_name' },
  { title: t('merchantDirectory.kyc'), key: 'kyc', width: 105 },
  { title: t('merchantDirectory.property'), key: 'property' },
  { title: t('common.action'), key: 'action', width: 100 },
]);
</script>

<template>
  <a-divider orientation="left">{{ t('merchantDirectory.businessDetails') }}</a-divider>
  <a-descriptions :column="1" size="small" bordered>
    <a-descriptions-item :label="t('merchantDirectory.group')">{{ group?.group_name || '-' }}</a-descriptions-item>
    <a-descriptions-item v-for="app in applications" :key="app.id" :label="app.app_no">
      {{ app.company_name }} · {{ app.reg_number || '-' }} · {{ app.country || '-' }}
    </a-descriptions-item>
  </a-descriptions>
  <a-alert v-if="!applications.length" type="info" show-icon :message="t('merchantDirectory.noApplication')" style="margin-top: 12px" />
  <a-divider orientation="left">{{ t('merchantDirectory.hotelProperties') }}</a-divider>
  <a-button type="link" @click="showHistory">{{ t('merchantDirectory.history') }}</a-button>
  <a-alert type="info" show-icon :message="t('merchantDirectory.mappingHint')" style="margin-bottom: 12px" />
  <a-table :columns="businessColumns" :data-source="hotels" row-key="id" size="small" :pagination="false" :scroll="{ x: 570 }">
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'kyc'">
        <a-tag :color="record.kyc_status === 1 ? 'success' : 'warning'">{{ t('merchantDirectory.kyc' + record.kyc_status) }}</a-tag>
      </template>
      <template v-else-if="column.dataIndex === 'business_name'">
        <div>{{ record.business_name }}</div>
        <div class="property-muted">{{ record.city || '-' }} · {{ record.contact_name || '-' }}</div>
        <div class="property-muted">{{ record.contact_phone || '-' }} · {{ record.contact_email || '-' }}</div>
      </template>
      <template v-else-if="column.key === 'property'">
        <template v-if="linked(record)">
          <div>#{{ linked(record)?.id }} {{ linked(record)?.store_name }}</div>
          <a-tag v-if="linked(record)?.deleted_at">{{ t('merchantDirectory.archived') }}</a-tag>
          <div class="property-muted">{{ linked(record)?.country_code }} / {{ linked(record)?.city_key }}</div>
        </template>
        <a-tag v-else color="warning">{{ t('merchantDirectory.unmapped') }}</a-tag>
      </template>
      <template v-else-if="column.key === 'action'">
        <a-button v-if="record.kyc_status === 1 && !linked(record)?.deleted_at && [3, 4].includes(Number(merchant.status))" v-perm="'merchant:property:bind'" size="small" type="link" @click="edit(record)">
          {{ linked(record) ? t('common.edit') : t('merchantDirectory.bind') }}
        </a-button>
      </template>
    </template>
  </a-table>
  <a-alert v-if="businesses.length > hotels.length" type="info" :message="t('merchantDirectory.deferred', { count: businesses.length - hotels.length })" style="margin-top: 12px" />
  <div v-if="unlinkedStores.length" style="margin-top: 12px">
    <div>{{ t('merchantDirectory.legacyStores') }}</div>
    <a-tag v-for="store in unlinkedStores" :key="store.id" style="margin-top: 8px">#{{ store.id }} {{ store.store_name }}</a-tag>
  </div>
  <a-drawer v-model:open="historyOpen" :title="t('merchantDirectory.history')" width="720">
    <a-table :columns="historyColumns" :data-source="history.list.value" :loading="history.loading.value"
      :pagination="history.pagination.value" row-key="id" :scroll="{ x: 630 }">
      <template #expandedRowRender="{ record }">
        <div>{{ t('merchantDirectory.before') }}: {{ record.before_json || '-' }}</div>
        <div>{{ t('merchantDirectory.after') }}: {{ record.after_json }}</div>
      </template>
    </a-table>
  </a-drawer>
  <a-modal v-model:open="open" :title="t('merchantDirectory.bind')" :confirm-loading="saving" @ok="save">
    <a-alert type="warning" show-icon :message="t('merchantDirectory.bindConfirm')" style="margin-bottom: 16px" />
    <a-form layout="vertical">
      <a-form-item :label="t('merchantDirectory.business')">{{ target?.business_name }}</a-form-item>
      <a-form-item :label="t('merchantDirectory.property')">
        <a-input v-if="target && linked(target)" :value="linked(target)?.store_name" disabled />
        <a-select v-else v-model:value="form.storeId" :options="choices" @change="storeChanged" />
      </a-form-item>
      <a-form-item required :label="t('merchantDirectory.country')"><a-input v-model:value="form.countryCode" :maxlength="2" placeholder="MM" /></a-form-item>
      <a-form-item required :label="t('merchantDirectory.city')"><a-input v-model:value="form.cityKey" :maxlength="80" /></a-form-item>
      <a-form-item required :label="t('merchantStatus.note')"><a-textarea v-model:value="form.note" :maxlength="500" :rows="3" /></a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.property-muted { font-size: 12px; color: #64748b; overflow-wrap: anywhere; }
</style>
