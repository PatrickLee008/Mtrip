<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import PageContainer from '@/components/PageContainer.vue';
import SearchFilterBar, { type FilterConfig } from '@/components/SearchFilterBar.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiStoreInvestigations, apiStoreInvestigationDetail, apiStoreInvestigationAction,
  type StoreInvestigationDetail, type InvestigationStatus, type InvestigationDecision } from '@/api/merchant';

const { t } = useI18n();
const route = useRoute();
const user = useUserStore();
const storeId = computed(() => Number(route.query.storeId) || undefined);
const statuses: InvestigationStatus[] = ['flagged', 'investigating', 'resolved'];
const { list, query, pagination, loading, search, reset, load } = useTable(
  params => apiStoreInvestigations({ ...params, storeId: storeId.value }), { status: '', keyword: '', siteId: 0 },
);
const filterValues = ref<Record<string, string | number | undefined>>({});
const filterKey = ref(0);
const filters = computed<FilterConfig[]>(() => [{
  key: 'status', label: t('common.status'), allLabel: t('common.all'),
  options: statuses.map(value => ({ value, label: t('storeInvestigation.statuses.' + value) })),
}]);
function searchFilters() {
  query.status = filterValues.value.status ?? '';
  search();
}
function resetFilters() {
  filterValues.value = {};
  filterKey.value += 1;
  reset();
}
watch(storeId, search, { immediate: true });

const tablePagination = computed(() => ({
  ...pagination.value, showQuickJumper: false, showSizeChanger: false,
  showTotal: (total: number, range: [number, number]) => t('merchant.verifyPage.paginationInfo', { from: range[0], to: range[1], total }),
}));
const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 72 },
  { title: t('storeInvestigation.store'), dataIndex: 'store_name', width: 190 },
  { title: t('storeInvestigation.merchant'), dataIndex: 'merchant_name', width: 180 },
  { title: t('storeInvestigation.category'), key: 'category', width: 150 },
  { title: t('common.status'), key: 'status', width: 145 },
  { title: t('storeInvestigation.updated'), dataIndex: 'updated_at', width: 185 },
  { title: t('common.action'), key: 'action', width: 85 },
]);
const colors: Record<string, string> = { flagged: 'orange', investigating: 'processing', resolved: 'success' };
const drawer = ref(false);
const detail = ref<StoreInvestigationDetail>();
const detailLoading = ref(false);
let request = 0;
async function openDetail(id: number) {
  const current = ++request;
  drawer.value = true;
  detailLoading.value = true;
  detail.value = undefined;
  try {
    const data = await apiStoreInvestigationDetail(id);
    if (request === current) detail.value = data;
  } catch { /* The API client displays the error. */ }
  finally { if (request === current) detailLoading.value = false; }
}

const action = ref<'escalate' | 'resolve'>();
const saving = ref(false);
const form = reactive({ decision: 'cleared' as InvestigationDecision, reason: '', evidence: '' });
const canSuspend = computed(() => user.isSuper && user.hasPerm('merchant:status:suspend') && detail.value?.merchant?.status === 3);
const decisions = computed(() => {
  const available: InvestigationDecision[] = ['cleared', 'store_followup'];
  if (canSuspend.value) available.push('suspend_merchant');
  return available.map(value => ({ value, label: t('storeInvestigation.decisions.' + value) }));
});
function choose(next: 'escalate' | 'resolve') {
  Object.assign(form, { decision: 'cleared', reason: '', evidence: '' });
  action.value = next;
}
async function save() {
  if (!detail.value || !action.value || saving.value || !form.reason.trim()) return;
  if (action.value === 'resolve' && form.decision === 'suspend_merchant' && !canSuspend.value) return;
  const id = detail.value.case.id;
  saving.value = true;
  try {
    await apiStoreInvestigationAction(action.value, {
      id, reason: form.reason.trim(), evidence: form.evidence.trim(),
      decision: action.value === 'resolve' ? form.decision : undefined,
      expectedVersion: form.decision === 'suspend_merchant' ? detail.value.merchant?.status_version : undefined,
    });
    message.success(t('tip.saveSuccess'));
    action.value = undefined;
    await Promise.all([openDetail(id), load()]);
  } catch {
    // Keep the draft and refresh the record in case a concurrent decision won.
    await openDetail(id);
    const expected = action.value === 'escalate' ? 'flagged' : 'investigating';
    if (detail.value?.case.status !== expected) action.value = undefined;
  } finally { saving.value = false; }
}
</script>

<template>
  <PageContainer>
    <div class="module-list-heading">
      <div>
        <div class="module-list-eyebrow">{{ t('menu.merchant') }}</div>
        <h1>{{ t('storeInvestigation.title') }}</h1>
        <p>{{ t('storeInvestigation.subtitle') }}<template v-if="storeId"> · {{ t('storeInvestigation.store') }} #{{ storeId }}</template></p>
      </div>
      <router-link v-if="storeId" to="/merchant/investigations">{{ t('storeInvestigation.title') }}</router-link>
    </div>
    <SearchFilterBar :key="filterKey" v-model="query.keyword" v-model:filter-values="filterValues"
      :filters="filters" :placeholder="t('storeInvestigation.search')" :total="pagination.total"
      :result-label="t('merchant.verifyPage.resultCount')" @search="searchFilters">
      <template #filters>
        <SiteTreeSelect v-if="user.isSuper" v-model:value="query.siteId" class="module-list-site-filter" size="small"
          :bordered="false" allow-all :dropdown-match-select-width="260" @change="searchFilters" />
        <a-button type="text" size="small" class="module-list-reset" @click="resetFilters">{{ t('common.reset') }}</a-button>
      </template>
    </SearchFilterBar>
    <a-table class="module-list-table" :columns="columns" :data-source="list" :loading="loading" :pagination="tablePagination"
      :scroll="{ x: 1010 }" row-key="id" size="middle">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'category'">{{ t('storeInvestigation.categories.' + record.category) }}</template>
        <a-tag v-else-if="column.key === 'status'" :color="colors[record.status]">{{ t('storeInvestigation.statuses.' + record.status) }}</a-tag>
        <a-button v-else-if="column.key === 'action'" type="link" size="small" @click="openDetail(record.id)">{{ t('common.detail') }}</a-button>
      </template>
    </a-table>

    <a-drawer v-model:open="drawer" :title="t('storeInvestigation.history')" width="min(720px, 100vw)">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions bordered :column="1" size="small">
            <a-descriptions-item :label="t('common.id')">#{{ detail.case.id }}</a-descriptions-item>
            <a-descriptions-item :label="t('storeInvestigation.store')">{{ detail.case.store_name }} · #{{ detail.case.store_id }}</a-descriptions-item>
            <a-descriptions-item :label="t('storeInvestigation.merchant')">{{ detail.case.merchant_name }} · #{{ detail.case.merchant_id }}</a-descriptions-item>
            <a-descriptions-item :label="t('storeInvestigation.category')">{{ t('storeInvestigation.categories.' + detail.case.category) }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.status')">{{ t('storeInvestigation.statuses.' + detail.case.status) }}</a-descriptions-item>
            <a-descriptions-item v-if="detail.case.decision" :label="t('storeInvestigation.decision')">
              {{ t('storeInvestigation.decisions.' + detail.case.decision) }}
            </a-descriptions-item>
          </a-descriptions>
          <a-timeline class="case-history">
            <a-timeline-item v-for="event in detail.history" :key="event.id">
              <strong>{{ t('storeInvestigation.actions.' + event.action) }}</strong>
              <div>{{ event.actor_name }} · {{ event.created_at }} UTC</div>
              <div class="event-note">{{ event.reason }}</div>
              <div v-if="event.evidence" class="event-note">{{ t('storeInvestigation.evidence') }}：{{ event.evidence }}</div>
            </a-timeline-item>
          </a-timeline>
        </template>
      </a-spin>
      <template #footer>
        <a-button v-if="detail?.case.status === 'flagged'" v-perm="'merchant:investigation:escalate'" type="primary" @click="choose('escalate')">
          {{ t('storeInvestigation.escalate') }}
        </a-button>
        <a-button v-if="detail?.case.status === 'investigating'" v-perm="'merchant:investigation:review'" type="primary" @click="choose('resolve')">
          {{ t('storeInvestigation.resolve') }}
        </a-button>
      </template>
    </a-drawer>

    <a-modal :open="!!action" :title="t(action === 'escalate' ? 'storeInvestigation.escalate' : 'storeInvestigation.resolve')"
      :confirm-loading="saving" :ok-button-props="{ disabled: !form.reason.trim(), danger: form.decision === 'suspend_merchant' }"
      :cancel-button-props="{ disabled: saving }" :mask-closable="false" :closable="!saving" @ok="save" @cancel="action = undefined">
      <a-alert v-if="action === 'escalate'" type="info" show-icon :message="t('storeInvestigation.escalateHint')" />
      <a-alert v-else-if="form.decision === 'suspend_merchant'" type="warning" show-icon :message="t('storeInvestigation.suspendHint')" />
      <a-form layout="vertical" class="case-history">
        <a-form-item v-if="action === 'resolve'" :label="t('storeInvestigation.decision')" required>
          <a-select v-model:value="form.decision" :options="decisions" />
        </a-form-item>
        <a-form-item :label="t('storeInvestigation.reason')" required>
          <a-textarea v-model:value="form.reason" :maxlength="500" :rows="3" />
        </a-form-item>
        <a-form-item :label="t('storeInvestigation.evidence')">
          <a-textarea v-model:value="form.evidence" :maxlength="500" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
@import '@/styles/module-list.less';
.case-history { margin-top: 18px; }
.event-note { overflow-wrap: anywhere; white-space: pre-wrap; }
</style>
