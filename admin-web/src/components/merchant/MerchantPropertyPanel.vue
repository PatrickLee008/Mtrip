<script setup lang="ts">
import StoreBookingActions from '@/components/merchant/StoreBookingActions.vue';
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import type { TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
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
const businessTypes = computed<Record<string, string>>(() => ({
  hotel: t('merchant.onboardingPage.bizHotel'),
  restaurant: t('merchant.onboardingPage.bizRestaurant'),
  airline: t('merchant.onboardingPage.bizAirline'),
  car_rental: t('merchant.onboardingPage.bizCarRental'),
  attraction: t('merchant.onboardingPage.bizAttraction'),
}));
const unlinkedStores = computed(() => props.properties.filter(s => !s.source_business_id));
const choices = computed(() => [
  { value: 0, label: t('merchantDirectory.createProperty') },
  ...unlinkedStores.value.map(s => ({ value: Number(s.id), label: '#' + s.id + ' ' + s.store_name })),
]);
function linked(business: TableRow): TableRow | undefined {
  return props.properties.find(s => Number(s.source_business_id) === Number(business.id));
}
function businessKycBadge(business: TableRow): StatusItem {
  const application = props.applications.find(app => Number(app.id) === Number(business.application_id));
  const status = Number(business.kyc_status);
  if (Number(application?.state_model_version) === 1) {
    const keys = ['kycLocked', 'kycDraft', 'kycSubmitted', 'kycUnderReview', 'kycResubmitRequired', 'kycVerified', 'kycRejected'];
    const colors: StatusItem['color'][] = ['default', 'default', 'warning', 'processing', 'orange', 'success', 'error'];
    return { text: keys[status] ? t(`merchant.onboardingPage.${keys[status]}`) : t('merchantDirectory.unknown'), color: colors[status] || 'default' };
  }
  return { text: status >= 0 && status <= 4 ? t(`merchantDirectory.kyc${status}`) : t('merchantDirectory.unknown'), color: status === 1 ? 'success' : 'warning' };
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
  { title: t('common.type'), dataIndex: 'business_type', width: 100 },
  { title: t('merchantDirectory.kyc'), key: 'kyc', width: 105 },
  { title: t('merchantDirectory.property'), key: 'property' },
  { title: t('common.action'), key: 'action', width: 100 },
]);
</script>

<template>
  <section class="property-section">
    <h4>{{ t('merchant.profile.properties') }} <span>{{ properties.length }}</span></h4>
    <div class="property-cards">
      <article v-for="store in properties" :key="store.id" class="property-card">
        <div class="property-card-heading">
          <div><strong>{{ store.store_name }}</strong><span class="property-id">#{{ store.id }}</span></div>
          <a-tag v-if="store.deleted_at">{{ t('merchantDirectory.archived') }}</a-tag>
          <a-tag v-else>{{ businessTypes[store.business_type] || store.business_type || '—' }}</a-tag>
        </div>
        <div class="property-muted">{{ [store.city_key, store.country_code].filter(Boolean).join(', ') || '—' }}</div>
        <template v-if="!store.deleted_at">
          <a-tag v-if="Number(store.operating_status) === 3" color="error">{{ t('merchant.storeBooking.state3') }}</a-tag>
          <StoreBookingActions :store="store" @changed="emit('changed')" />
        </template>
        <template v-for="business in businesses.filter(business => Number(business.id) === Number(store.source_business_id))" :key="business.id">
          <div v-if="business.contact_name" class="property-contact">{{ business.contact_name }}</div>
          <div v-if="business.contact_phone || business.contact_email" class="property-muted">{{ [business.contact_phone, business.contact_email].filter(Boolean).join(' · ') }}</div>
        </template>
      </article>
      <div v-if="!properties.length" class="property-empty">{{ t('merchant.profile.noProperties') }}</div>
    </div>
    <details class="property-management">
      <summary>{{ t('merchantDirectory.businessProperties') }}</summary>
      <div class="property-management-body">
        <dl class="property-company">
          <div><dt>{{ t('merchantDirectory.group') }}</dt><dd>{{ group?.group_name || '—' }}</dd></div>
          <div v-for="app in applications" :key="app.id"><dt>{{ app.app_no }}</dt><dd>{{ app.company_name }} · {{ app.reg_number || '—' }} · {{ app.country || '—' }}</dd></div>
        </dl>
        <a-alert v-if="!applications.length" type="info" show-icon :message="t('merchantDirectory.noApplication')" />
        <a-button type="link" @click="showHistory">{{ t('merchantDirectory.history') }}</a-button>
        <p class="property-muted">{{ t('merchantDirectory.mappingHint') }}</p>
        <a-table :columns="businessColumns" :data-source="businesses" row-key="id" size="small" :pagination="false" :scroll="{ x: 670 }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'kyc'">
              <a-tag :color="businessKycBadge(record).color">{{ businessKycBadge(record).text }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'business_type'">{{ businessTypes[record.business_type] || record.business_type || '—' }}</template>
            <template v-else-if="column.dataIndex === 'business_name'">
              <div>{{ record.business_name }}</div>
              <div class="property-muted">{{ record.city || '—' }} · {{ record.contact_name || '—' }}</div>
              <div class="property-muted">{{ record.contact_phone || '—' }} · {{ record.contact_email || '—' }}</div>
            </template>
            <template v-else-if="column.key === 'property'">
              <template v-if="linked(record)">
                <div>#{{ linked(record)?.id }} {{ linked(record)?.store_name }}</div>
                <a-tag v-if="linked(record)?.deleted_at">{{ t('merchantDirectory.archived') }}</a-tag>
                <div class="property-muted">{{ linked(record)?.country_code }} / {{ linked(record)?.city_key }}</div>
              </template>
              <a-tag v-else-if="record.business_type === 'hotel'" color="warning">{{ t('merchantDirectory.unmapped') }}</a-tag>
              <span v-else class="property-muted">{{ t('merchantDirectory.notApplicable') }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button v-if="record.business_type === 'hotel' && record.kyc_status === 1 && !linked(record)?.deleted_at && [3, 4].includes(Number(merchant.status))" v-perm="'merchant:property:bind'" size="small" type="link" @click="edit(record)">
                {{ linked(record) ? t('common.edit') : t('merchantDirectory.bind') }}
              </a-button>
            </template>
          </template>
        </a-table>
      </div>
    </details>
  </section>
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
.property-section h4 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 12px; line-height: 18px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #64748b; }
.property-section h4 > span { padding: 0 6px; border-radius: 10px; background: #f1f5f9; color: #64748b; font-size: 11px; letter-spacing: 0; }
.property-cards { display: flex; flex-direction: column; gap: 8px; }
.property-card { padding: 12px 14px; border: 1px solid #e3e8f0; border-radius: 8px; background: #f8fafc; }
.property-card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.property-card-heading > div { min-width: 0; }
.property-card-heading strong { color: #1a2332; font-size: 13px; line-height: 20px; overflow-wrap: anywhere; }
.property-card-heading :deep(.ant-tag) { flex-shrink: 0; margin: 0; font-size: 11px; }
.property-id { margin-left: 8px; color: #94a3b8; font: 11px monospace; }
.property-muted { margin: 4px 0 0; font-size: 12px; line-height: 18px; color: #94a3b8; overflow-wrap: anywhere; }
.property-contact { margin-top: 8px; font-size: 12px; color: #64748b; overflow-wrap: anywhere; }
.property-empty { padding: 16px; border: 1px dashed #e3e8f0; border-radius: 8px; text-align: center; color: #94a3b8; font-size: 12px; }
.property-management { margin-top: 12px; border: 1px solid #e3e8f0; border-radius: 8px; }
.property-management > summary { padding: 12px 14px; color: #64748b; font-size: 12px; font-weight: 500; cursor: pointer; }
.property-management-body { padding: 0 14px 14px; min-width: 0; }
.property-management-body > p { margin: 0 0 12px; }
.property-company { margin: 0 0 8px; }
.property-company > div { margin-bottom: 8px; }
.property-company dt { font-size: 11px; color: #94a3b8; }
.property-company dd { margin: 2px 0 0; font-size: 12px; color: #1a2332; overflow-wrap: anywhere; }
</style>
