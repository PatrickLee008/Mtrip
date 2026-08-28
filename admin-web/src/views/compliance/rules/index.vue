<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import type { Dayjs } from 'dayjs';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import ComplianceLinks from '@/components/merchant/ComplianceLinks.vue';
import { useUserStore } from '@/stores/user';
import { useTable, type TableRow } from '@/composables/useTable';
import { useCompliancePresentation } from '@/composables/useCompliancePresentation';
import { apiRules, apiRuleSave, apiRulePublish, apiRuleHistory, complianceCategories } from '@/api/compliance';
const { t } = useI18n();
const user = useUserStore();
const { ruleStatus } = useCompliancePresentation();
const { list, loading, query, load, search, reset, pagination } = useTable(apiRules, { keyword: '', category: undefined, status: undefined, siteId: undefined });
const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 }, { title: t('complianceS6.titleField'), dataIndex: 'title', width: 200 },
  { title: t('complianceS6.category'), dataIndex: 'category', width: 110 }, { title: t('complianceS6.site'), dataIndex: 'site_id', width: 130 },
  { title: t('complianceS6.version'), dataIndex: 'version', width: 75 }, { title: t('complianceS6.status'), dataIndex: 'effective_status', width: 100 },
  { title: t('complianceS6.effective'), dataIndex: 'effective_at', width: 165 }, { title: t('complianceS6.scheduled'), dataIndex: 'scheduled_at', width: 165 },
  { title: t('common.action'), key: 'actions', width: 290, fixed: 'right' as const },
]);
const form = reactive({ id: 0, expectedVersion: 0, siteId: 0, title: '', category: 'Booking', severity: 3, body: '', exceptions: '', note: '' });
const editOpen = ref(false);
const saving = ref(false);
function edit(row?: TableRow): void {
  Object.assign(form, { id: row?.id ?? 0, expectedVersion: Number(row?.version ?? 0), siteId: Number(row?.site_id ?? 0), title: row?.title ?? '', category: row?.category || 'Booking', severity: Number(row?.severity ?? 3), body: row?.body ?? '', exceptions: (row?.exception_merchant_ids ?? []).join(','), note: '' });
  editOpen.value = true;
}
async function save(): Promise<void> {
  if (!form.title.trim() || !form.body.trim() || !form.note.trim()) { message.warning(t('common.required')); return; }
  const exceptionMerchantIds = form.exceptions.trim() ? form.exceptions.split(',').map((v) => Number(v.trim())) : [];
  if (exceptionMerchantIds.some((id) => !Number.isSafeInteger(id) || id < 1)) { message.warning(t('complianceS6.exceptions')); return; }
  saving.value = true;
  try { await apiRuleSave({ ...form, exceptionMerchantIds }); editOpen.value = false; message.success(t('tip.saveSuccess')); await load(); }
  finally { saving.value = false; }
}
const publishOpen = ref(false);
const selected = ref<TableRow>({});
const action = ref('publish');
const note = ref('');
const effectiveAt = ref<Dayjs>();
function publication(row: TableRow, next: string): void { selected.value = row; action.value = next; note.value = ''; effectiveAt.value = undefined; publishOpen.value = true; }
async function publish(): Promise<void> {
  if (!note.value.trim()) { message.warning(t('common.required')); return; }
  saving.value = true;
  try {
    await apiRulePublish({ id: selected.value.id, expectedVersion: Number(selected.value.version), action: action.value, note: note.value, effectiveAt: effectiveAt.value?.toISOString() });
    publishOpen.value = false; message.success(t('tip.saveSuccess')); await load();
  } finally { saving.value = false; }
}
const historyOpen = ref(false);
const history = useTable(apiRuleHistory, { id: 0 });
const historyColumns = computed(() => ['version', 'action', 'effective_at', 'note', 'actor_name', 'created_at'].map((key, i) => ({ dataIndex: key, title: t(['complianceS6.version', 'common.action', 'complianceS6.effective', 'complianceS6.note', 'complianceS6.reviewer', 'complianceS6.created'][i]) })));
async function showHistory(row: TableRow): Promise<void> { history.query.id = row.id; historyOpen.value = true; await history.search(); }
function snapshot(row: TableRow): Record<string, any> { return typeof row.snapshot_json === 'string' ? JSON.parse(row.snapshot_json) : row.snapshot_json; }
onMounted(load);
</script>
<template>
  <PageContainer>
    <ComplianceLinks />
    <a-alert :message="t('complianceS6.policyNotice')" type="info" style="margin-bottom: 16px" />
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('complianceS6.ruleKeyword')"><a-input v-model:value="query.keyword" allow-clear @press-enter="search" /></a-form-item>
        <a-form-item :label="t('complianceS6.category')"><a-select v-model:value="query.category" allow-clear style="width: 140px"><a-select-option v-for="c in complianceCategories" :key="c" :value="c">{{ t(`complianceS6.categories.${c}`) }}</a-select-option></a-select></a-form-item>
        <a-form-item :label="t('complianceS6.status')"><a-select v-model:value="query.status" allow-clear style="width: 130px"><a-select-option v-for="n in [1, 2, 3]" :key="n" :value="n">{{ ruleStatus[n].text }}</a-select-option></a-select></a-form-item>
        <a-form-item v-if="user.isSuper" :label="t('complianceS6.site')"><a-input-number v-model:value="query.siteId" :min="0" /></a-form-item>
        <a-space><a-button type="primary" @click="search">{{ t('common.search') }}</a-button><a-button @click="reset">{{ t('common.reset') }}</a-button></a-space>
      </a-form>
    </a-card>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #extra><a-button v-if="user.isSuper" v-perm="'platform:rule:save'" type="primary" @click="edit()">{{ t('complianceS6.newRule') }}</a-button></template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1400 }">
        <template #expandedRowRender="{ record }"><p>{{ t('complianceS6.body') }}: {{ record.body || '-' }}</p><p>{{ t('complianceS6.liveBody') }}: {{ record.effective_body || '-' }}</p><p v-if="user.isSuper">{{ t('complianceS6.exceptions') }}: {{ record.exception_merchant_ids.join(', ') || '-' }}</p></template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'effective_status'"><StatusTag :value="record.effective_status" :map="ruleStatus" /></template>
          <template v-else-if="column.dataIndex === 'category'">{{ t(`complianceS6.categories.${record.category}`) }}</template>
          <template v-else-if="column.key === 'actions' && record.editable">
            <a-space wrap :size="0">
              <a-button v-perm="'platform:rule:save'" type="link" @click="edit(record)">{{ t('common.edit') }}</a-button>
              <a-button v-perm="'platform:rule:publish'" type="link" @click="publication(record, 'publish')">{{ t('complianceS6.actions.publish') }}</a-button>
              <a-button v-perm="'platform:rule:publish'" type="link" @click="publication(record, 'unpublish')">{{ t('complianceS6.actions.unpublish') }}</a-button>
              <a-button v-perm="'platform:rule:publish'" type="link" @click="publication(record, 'archive')">{{ t('complianceS6.actions.archive') }}</a-button>
              <a-button type="link" @click="showHistory(record)">{{ t('complianceS6.read') }}</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
    <a-modal v-model:open="editOpen" :title="t('complianceS6.saveDraft')" :confirm-loading="saving" width="720px" @ok="save">
      <a-form layout="vertical">
        <a-form-item :label="t('complianceS6.titleField')" required><a-input v-model:value="form.title" :maxlength="200" /></a-form-item>
        <a-form-item :label="t('complianceS6.site')" required><a-input-number v-model:value="form.siteId" :min="0" :disabled="!!form.id" /></a-form-item>
        <a-form-item :label="t('complianceS6.category')" required><a-select v-model:value="form.category"><a-select-option v-for="c in complianceCategories" :key="c" :value="c">{{ t(`complianceS6.categories.${c}`) }}</a-select-option></a-select></a-form-item>
        <a-form-item :label="t('complianceS6.severity')"><a-select v-model:value="form.severity"><a-select-option v-for="n in [1, 2, 3, 4]" :key="n" :value="n">{{ t(`complianceS6.severities.s${n}`) }}</a-select-option></a-select></a-form-item>
        <a-form-item :label="t('complianceS6.body')" required><a-textarea v-model:value="form.body" :rows="6" :maxlength="10000" /></a-form-item>
        <a-form-item :label="t('complianceS6.exceptions')"><a-input v-model:value="form.exceptions" /></a-form-item>
        <a-form-item :label="t('complianceS6.note')" required><a-textarea v-model:value="form.note" :maxlength="500" /></a-form-item>
      </a-form>
    </a-modal>
    <a-modal v-model:open="publishOpen" :title="t(`complianceS6.actions.${action}`)" :confirm-loading="saving" @ok="publish">
      <a-alert :message="t('complianceS6.confirmPolicy')" type="warning" style="margin-bottom: 16px" />
      <p>{{ selected.title }} · {{ t('complianceS6.version') }} {{ selected.version }}</p>
      <a-form layout="vertical">
        <a-form-item v-if="action === 'publish'" :label="t('complianceS6.effectiveInput')"><a-date-picker v-model:value="effectiveAt" show-time /></a-form-item>
        <a-form-item :label="t('complianceS6.note')" required><a-textarea v-model:value="note" :maxlength="500" /></a-form-item>
      </a-form>
    </a-modal>
    <a-drawer v-model:open="historyOpen" :title="t('complianceS6.ruleHistory')" width="850">
      <a-table :columns="historyColumns" :data-source="history.list.value" :loading="history.loading.value" :pagination="history.pagination.value" row-key="id" :scroll="{ x: 780 }">
        <template #expandedRowRender="{ record }"><p>{{ snapshot(record).title }}</p><p style="white-space: pre-wrap">{{ snapshot(record).body }}</p><p>{{ t('complianceS6.exceptions') }}: {{ snapshot(record).exceptions_json }}</p></template>
        <template #bodyCell="{ column, record }"><template v-if="column.dataIndex === 'action'">{{ t(`complianceS6.actions.${record.action}`) }}</template></template>
      </a-table>
    </a-drawer>
  </PageContainer>
</template>
