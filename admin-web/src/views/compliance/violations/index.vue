<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import ComplianceLinks from '@/components/merchant/ComplianceLinks.vue';
import ComplianceFilters from '@/components/merchant/ComplianceFilters.vue';
import ComplianceActionModal from '@/components/merchant/ComplianceActionModal.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useCompliancePresentation } from '@/composables/useCompliancePresentation';
import { useUserStore } from '@/stores/user';
import { apiViolations, apiViolationRecord, apiRules } from '@/api/compliance';
const { t } = useI18n();
const route = useRoute();
const user = useUserStore();
const { caseStatus } = useCompliancePresentation();
const { list, loading, query, load, search, reset, pagination } = useTable(apiViolations, { merchantId: Number(route.query.merchantId) || undefined, siteId: undefined, keyword: '', category: undefined, status: undefined });
watch(() => route.query.merchantId, (id) => { query.merchantId = Number(id) || undefined; void search(); });
const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 }, { title: t('complianceS6.merchant'), dataIndex: 'merchant_name', width: 180 },
  { title: t('complianceS6.rule'), dataIndex: 'rule_title', width: 190 }, { title: t('complianceS6.category'), dataIndex: 'category_code', width: 110 },
  { title: t('complianceS6.status'), dataIndex: 'status', width: 100 }, { title: t('complianceS6.latestAction'), dataIndex: 'latest_action', width: 140 },
  { title: t('complianceS6.version'), dataIndex: 'version', width: 70 }, { title: t('common.action'), key: 'actions', width: 340, fixed: 'right' as const },
]);
const open = ref(false);
const selected = ref<TableRow>({});
const action = ref('resolve');
function handle(row: TableRow, next: string): void { selected.value = row; action.value = next; open.value = true; }
const recordOpen = ref(false);
const saving = ref(false);
const ruleLoading = ref(false);
const options = ref<TableRow[]>([]);
const selectedRule = computed(() => options.value.find((r) => r.id === form.ruleId));
const form = reactive({ merchantId: undefined as number | undefined, ruleId: undefined as number | undefined, details: '', detectedDate: '', note: '', requestId: '' });
const ruleKeyword = ref('');
function newRecord(): void {
  Object.assign(form, { merchantId: query.merchantId, ruleId: undefined, details: '', detectedDate: new Date().toISOString().slice(0, 10), note: '', requestId: crypto.randomUUID() });
  options.value = []; ruleKeyword.value = ''; recordOpen.value = true;
}
watch(() => form.merchantId, () => { options.value = []; form.ruleId = undefined; });
async function loadRules(): Promise<void> {
  if (!form.merchantId) { message.warning(t('complianceS6.chooseMerchant')); return; }
  ruleLoading.value = true;
  try { options.value = (await apiRules({ merchantId: form.merchantId, keyword: ruleKeyword.value, pageSize: 200 })).list; form.ruleId = undefined; }
  finally { ruleLoading.value = false; }
}
async function record(): Promise<void> {
  if (!form.merchantId || !selectedRule.value || !form.details.trim() || !form.note.trim()) { message.warning(t('common.required')); return; }
  saving.value = true;
  try {
    await apiViolationRecord({ ...form, expectedVersion: 0, ruleRevisionId: selectedRule.value.effective_revision_id });
    recordOpen.value = false; message.success(t('tip.saveSuccess')); await load();
  } finally { saving.value = false; }
}
onMounted(load);
</script>
<template>
  <PageContainer>
    <ComplianceLinks :merchant-id="query.merchantId" />
    <ComplianceFilters :query="query" @search="search" @reset="reset">
      <a-form-item :label="t('complianceS6.status')"><a-select v-model:value="query.status" allow-clear style="width: 120px"><a-select-option v-for="n in [1, 2]" :key="n" :value="n">{{ caseStatus[n].text }}</a-select-option></a-select></a-form-item>
    </ComplianceFilters>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #extra><a-button v-perm="'platform:violation:record'" type="primary" @click="newRecord">{{ t('complianceS6.record') }}</a-button></template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1300 }">
        <template #expandedRowRender="{ record: row }"><p style="white-space: pre-wrap">{{ row.details || '-' }}</p><p>{{ t('complianceS6.ruleVersion') }}: {{ row.rule_revision_id || t('complianceS6.legacy') }} · {{ t('complianceS6.detected') }}: {{ row.detected_date }} · {{ t('complianceS6.severity') }}: {{ t(`complianceS6.severities.s${row.severity}`) }}</p></template>
        <template #bodyCell="{ column, record: row }">
          <template v-if="column.dataIndex === 'merchant_name'"><router-link v-if="user.hasPerm('merchant:list:list')" :to="{ path: '/merchant/list', query: { merchantId: row.merchant_id } }">{{ row.merchant_name }} #{{ row.merchant_id }}</router-link><span v-else>{{ row.merchant_name }} #{{ row.merchant_id }}</span></template>
          <template v-else-if="column.dataIndex === 'category_code'">{{ row.category_code ? t(`complianceS6.categories.${row.category_code}`) : t('complianceS6.legacy') }}</template>
          <template v-else-if="column.dataIndex === 'status'"><StatusTag :value="row.status" :map="caseStatus" /></template>
          <template v-else-if="column.dataIndex === 'latest_action'">{{ row.latest_action ? t(`complianceS6.actions.${row.latest_action}`) : '-' }}</template>
          <template v-else-if="column.key === 'actions'">
            <a-space wrap :size="0">
              <a-button v-if="Number(row.status) === 1 && row.rule_revision_id" v-perm="'platform:warning:issue'" type="link" @click="handle(row, 'warn')">{{ t('complianceS6.actions.warn') }}</a-button>
              <a-button v-if="Number(row.status) === 1 && row.rule_revision_id && Number(row.merchant_status) === 3 && user.hasPerm('merchant:status:suspend')" v-perm="'platform:violation:handle'" type="link" danger @click="handle(row, 'suspend')">{{ t('complianceS6.actions.suspend') }}</a-button>
              <a-button v-if="Number(row.can_restore) === 1 && user.hasPerm('merchant:status:activate')" v-perm="'platform:violation:handle'" type="link" @click="handle(row, 'restore')">{{ t('complianceS6.actions.restore') }}</a-button>
              <a-button v-perm="'platform:violation:handle'" type="link" @click="handle(row, Number(row.status) === 1 ? 'resolve' : 'reopen')">{{ t(`complianceS6.actions.${Number(row.status) === 1 ? 'resolve' : 'reopen'}`) }}</a-button>
              <router-link v-perm="'platform:compliance:list'" :to="{ path: '/compliance/history', query: { merchantId: row.merchant_id, violationId: row.id } }">{{ t('complianceS6.history') }}</router-link>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
    <ComplianceActionModal v-model:open="open" :row="selected" :action="action" @changed="load" />
    <a-modal v-model:open="recordOpen" :title="t('complianceS6.record')" :confirm-loading="saving" width="680px" @ok="record">
      <a-alert :message="t('complianceS6.chooseMerchant')" type="info" style="margin-bottom: 16px" />
      <a-form layout="vertical">
        <a-form-item :label="t('complianceS6.merchantId')" required><a-input-number v-model:value="form.merchantId" :min="1" /></a-form-item>
        <a-form-item :label="t('complianceS6.ruleKeyword')"><a-space><a-input v-model:value="ruleKeyword" @press-enter="loadRules" /><a-button :loading="ruleLoading" @click="loadRules">{{ t('complianceS6.loadRules') }}</a-button></a-space></a-form-item>
        <a-form-item :label="t('complianceS6.rule')" required><a-select v-model:value="form.ruleId" show-search option-filter-prop="label" :not-found-content="t('complianceS6.noRules')"><a-select-option v-for="r in options" :key="r.id" :value="r.id" :label="r.title">#{{ r.id }} {{ r.title }} · v{{ r.version }}</a-select-option></a-select></a-form-item>
        <a-alert v-if="selectedRule" :message="t(`complianceS6.categories.${selectedRule.category}`)" :description="selectedRule.body" type="info" />
        <a-form-item :label="t('complianceS6.details')" required><a-textarea v-model:value="form.details" :rows="4" :maxlength="5000" /></a-form-item>
        <a-form-item :label="t('complianceS6.detected')"><a-date-picker v-model:value="form.detectedDate" value-format="YYYY-MM-DD" /></a-form-item>
        <a-form-item :label="t('complianceS6.note')" required><a-textarea v-model:value="form.note" :maxlength="500" /></a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
