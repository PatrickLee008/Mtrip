<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import {
  apiMerchantDeletionList, apiMerchantDeletionDetail, apiMerchantDeletionReview,
  type MerchantDeletionRow, type MerchantDeletionDetail,
} from '@/api/merchant';
import PageContainer from '@/components/PageContainer.vue';
import SearchFilterBar, { type FilterConfig } from '@/components/SearchFilterBar.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';

const { t } = useI18n();
const user = useUserStore();
const colors: Record<string, string> = { pending: 'orange', approved: 'green', rejected: 'red', cancelled: 'default' };
const { list, query, pagination, loading, search, reset, load } = useTable(apiMerchantDeletionList,
  { status: 'pending', keyword: '', siteId: 0 });
const filterValues = ref<Record<string, string | number | undefined>>({ status: query.status });
const filterKey = ref(0);
const filters = computed<FilterConfig[]>(() => [{
  key: 'status',
  label: t('merchantDeletion.status'),
  allLabel: t('common.all'),
  options: Object.keys(colors).map(value => ({ value, label: t('merchantDeletion.states.' + value) })),
}]);

function searchFilters(): void {
  query.status = filterValues.value.status ?? '';
  search();
}

function resetFilters(): void {
  reset();
  filterValues.value = { status: query.status };
  filterKey.value += 1;
}

const tablePagination = computed(() => ({
  ...pagination.value,
  showQuickJumper: false,
  showSizeChanger: false,
  showTotal: (total: number, range: [number, number]) => t('merchant.verifyPage.paginationInfo', { from: range[0], to: range[1], total }),
}));

const columns = computed(() => [
  { title: t('merchantDeletion.merchant'), key: 'merchant', width: 310 },
  { title: t('merchantDeletion.applicant'), dataIndex: 'applicant_name', width: 200 },
  { title: t('merchantDeletion.submitted'), dataIndex: 'submitted_at', width: 185 },
  { title: t('merchantDeletion.status'), key: 'status', width: 130 },
  { title: t('common.action'), key: 'action', width: 100 },
]);

const drawer = ref(false);
const detail = ref<MerchantDeletionDetail | null>(null);
const detailLoading = ref(false);
const modal = ref(false);
const decision = ref<'approved' | 'rejected'>('approved');
const note = ref('');
const saving = ref(false);

async function openDetail(row: MerchantDeletionRow) {
  drawer.value = true;
  detail.value = null;
  detailLoading.value = true;
  try { detail.value = await apiMerchantDeletionDetail(row.id); }
  finally { detailLoading.value = false; }
}

function openReview(value: 'approved' | 'rejected') {
  decision.value = value;
  note.value = '';
  modal.value = true;
}

async function review() {
  if (!detail.value || !note.value.trim() || saving.value) return;
  saving.value = true;
  const row = detail.value;
  try {
    detail.value = await apiMerchantDeletionReview(row.id, decision.value, note.value.trim());
    modal.value = false;
    message.success(t('tip.saveSuccess'));
  } catch {
    try {
      detail.value = await apiMerchantDeletionDetail(row.id);
      if (detail.value.status !== 'pending') modal.value = false;
    } catch { /* The HTTP client reports request errors. */ }
  } finally {
    saving.value = false;
    void load();
  }
}

void load();
</script>

<template>
  <PageContainer>
    <div class="module-list-heading">
      <div>
        <div class="module-list-eyebrow">{{ t('menu.merchant') }}</div>
        <h1>{{ t('menu.merchantDeletion') }}</h1>
        <p>{{ t('merchantDeletion.subtitle') }}</p>
      </div>
    </div>
    <SearchFilterBar :key="filterKey" v-model="query.keyword" v-model:filter-values="filterValues"
      :filters="filters" :placeholder="t('merchantDeletion.keyword')" :total="pagination.total"
      :result-label="t('merchant.verifyPage.resultCount')" @search="searchFilters">
      <template #filters>
        <SiteTreeSelect v-if="user.isSuper" v-model:value="query.siteId" class="module-list-site-filter" size="small"
          :bordered="false" :aria-label="t('common.site')" allow-all :dropdown-match-select-width="260" @change="searchFilters" />
        <a-button type="text" size="small" class="module-list-reset" @click="resetFilters">{{ t('common.reset') }}</a-button>
      </template>
    </SearchFilterBar>
    <a-table class="module-list-table" :columns="columns" :data-source="list" :loading="loading"
      :pagination="tablePagination" :scroll="{ x: 860 }" row-key="id" size="middle">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'merchant'">
          {{ record.merchant_name }} <small v-if="record.merchant_code">· {{ record.merchant_code }}</small>
        </template>
        <a-tag v-else-if="column.key === 'status'" :color="colors[record.status]">{{ t('merchantDeletion.states.' + record.status) }}</a-tag>
        <a-button v-else-if="column.key === 'action'" type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
      </template>
    </a-table>

    <a-drawer v-model:open="drawer" :title="t('merchantDeletion.detail')" width="min(760px, 100vw)">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions bordered :column="1" size="small">
            <a-descriptions-item :label="t('merchantDeletion.request')">#{{ detail.id }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchantDeletion.merchant')">{{ detail.merchant_name }} · {{ detail.merchant_code || '#' + detail.merchant_id }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchantDeletion.applicant')">{{ detail.applicant_name }} · #{{ detail.account_id }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchantDeletion.status')"><a-tag :color="colors[detail.status]">{{ t('merchantDeletion.states.' + detail.status) }}</a-tag></a-descriptions-item>
            <a-descriptions-item :label="t('merchantDeletion.reason')">
              {{ t('merchantDeletion.reasons.' + detail.reason) }}
              <div v-if="detail.details" class="note">{{ detail.details }}</div>
            </a-descriptions-item>
            <a-descriptions-item :label="t('merchantDeletion.properties')">
              <div v-for="property in detail.properties" :key="property.id">
                {{ property.store_name }} · #{{ property.id }}<span v-if="property.business_type"> · {{ property.business_type }}</span>
              </div>
              <span v-if="!detail.properties.length">—</span>
            </a-descriptions-item>
          </a-descriptions>
          <h3>{{ t('merchantDeletion.history') }}</h3>
          <a-timeline>
            <a-timeline-item>
              <strong>{{ t('merchantDeletion.submitted') }}</strong>
              <div>{{ detail.applicant_name }} · #{{ detail.account_id }} · {{ detail.submitted_at }}</div>
            </a-timeline-item>
            <a-timeline-item v-if="detail.resolved_at">
              <strong>{{ t('merchantDeletion.states.' + detail.status) }}</strong>
              <div>{{ detail.resolver_name }} · #{{ detail.resolver_id }} · {{ detail.resolved_at }}</div>
              <div v-if="detail.review_note" class="note">{{ detail.review_note }}</div>
            </a-timeline-item>
          </a-timeline>
        </template>
      </a-spin>
      <template v-if="user.isSuper && detail?.status === 'pending'" #footer>
        <a-space>
          <a-button v-perm="'merchant:deletion:review'" danger @click="openReview('rejected')">{{ t('merchantDeletion.reject') }}</a-button>
          <a-button v-perm="'merchant:deletion:review'" type="primary" @click="openReview('approved')">{{ t('merchantDeletion.approve') }}</a-button>
        </a-space>
      </template>
    </a-drawer>

    <a-modal v-model:open="modal" :title="t(decision === 'approved' ? 'merchantDeletion.approve' : 'merchantDeletion.reject')"
      :confirm-loading="saving" :ok-button-props="{ disabled: !note.trim(), danger: decision === 'approved' }"
      :cancel-button-props="{ disabled: saving }" :closable="!saving" :mask-closable="!saving" :keyboard="!saving" @ok="review">
      <a-alert v-if="decision === 'approved'" type="warning" show-icon :message="t('merchantDeletion.approvalWarning')" class="approval-warning" />
      <a-form layout="vertical">
        <a-form-item :label="t('merchantDeletion.note')" required>
          <a-textarea v-model:value="note" :maxlength="500" :rows="4" show-count />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
@import '@/styles/module-list.less';

.approval-warning { margin-bottom: 16px; }
.note { white-space: pre-wrap; overflow-wrap: anywhere; }
h3 { margin-top: 22px; }
</style>
