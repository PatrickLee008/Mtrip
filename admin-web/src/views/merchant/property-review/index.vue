<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PropertyReviewDetail from './PropertyReviewDetail.vue';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { apiMerchantPropertyContentList } from '@/api/merchant';

const { t } = useI18n();
const stats = ref<Record<string, number>>({});

async function fetchReviews(params: Record<string, unknown>) {
  const data = await apiMerchantPropertyContentList(params);
  stats.value = data.stats ?? {};
  return data;
}

const reviews = useTable(fetchReviews, { keyword: '', status: 1 });
const statusOptions = computed(() => [
  { value: undefined, label: t('merchant.propertyReviewPage.statusAll') },
  { value: 1, label: t('merchant.propertyReviewPage.statusPending') },
  { value: 2, label: t('merchant.propertyReviewPage.statusApproved') },
  { value: 3, label: t('merchant.propertyReviewPage.statusRejected') },
  { value: 0, label: t('merchant.propertyReviewPage.statusDraft') },
]);
const cards = computed(() => [
  { key: 'total', status: undefined, label: t('merchant.propertyReviewPage.statTotal'), value: stats.value.total ?? 0, icon: FileSearchOutlined, tone: 'blue' },
  { key: 'pending', status: 1, label: t('merchant.propertyReviewPage.statPending'), value: stats.value.pending ?? 0, icon: ClockCircleOutlined, tone: 'orange' },
  { key: 'approved', status: 2, label: t('merchant.propertyReviewPage.statApproved'), value: stats.value.approved ?? 0, icon: CheckCircleOutlined, tone: 'green' },
  { key: 'rejected', status: 3, label: t('merchant.propertyReviewPage.statRejected'), value: stats.value.rejected ?? 0, icon: CloseCircleOutlined, tone: 'red' },
]);
const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 75 },
  { title: t('goods.audit.propertyReview.property'), dataIndex: 'store_name', ellipsis: true },
  { title: t('goods.audit.merchant'), dataIndex: 'merchant_name', width: 180, ellipsis: true },
  { title: t('goods.audit.roomReview.version'), dataIndex: 'version', width: 90 },
  { title: t('common.status'), dataIndex: 'status', width: 130 },
  { title: t('goods.audit.submitTime'), dataIndex: 'submitted_at', width: 175 },
  { title: t('merchant.propertyReviewPage.reviewedAt'), dataIndex: 'reviewed_at', width: 175 },
  { title: t('common.action'), key: 'action_col', width: 100, fixed: 'right' as const },
]);

function selectStatus(status: number | undefined): void {
  reviews.query.status = status;
  reviews.search();
}

function statusLabel(status: number): string {
  return t(`merchant.propertyReviewPage.status.${status}`);
}

function statusColor(status: number): string {
  return ({ 0: 'default', 1: 'warning', 2: 'success', 3: 'error' } as Record<number, string>)[status] ?? 'default';
}

const route = useRoute();
const router = useRouter();
const queuePath = '/merchant/property-review';

function queryId(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return 0;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : 0;
}

const revisionId = computed(() => queryId(route.query.revisionId));

function openDetail(row: TableRow): void {
  void router.push({ path: queuePath, query: { revisionId: String(row.id) } });
}

function closeDetail(): void {
  const merchantId = queryId(route.query.merchantId);
  const businessId = queryId(route.query.businessId);
  if (merchantId && businessId) {
    void router.replace({ path: '/merchant-verify/approved', query: { merchantId: String(merchantId), businessId: String(businessId) } });
  } else {
    void router.replace({ path: queuePath });
  }
}

watch(revisionId, id => {
  if (!id && route.path === queuePath) void reviews.load();
}, { immediate: true });
</script>

<template>
  <PropertyReviewDetail v-if="revisionId" :key="revisionId" :revision-id="revisionId" @close="closeDetail" @reviewed="closeDetail" />
  <PageContainer v-else>
    <div class="review-page">
      <header class="page-head">
        <div>
          <h1>{{ t('merchant.propertyReviewPage.title') }}</h1>
          <p>{{ t('merchant.propertyReviewPage.subtitle') }}</p>
        </div>
        <a-button @click="reviews.load"><template #icon><ReloadOutlined /></template>{{ t('common.refresh') }}</a-button>
      </header>

      <div class="stats-grid">
        <button
          v-for="card in cards"
          :key="card.key"
          type="button"
          :class="['stat-card', `tone-${card.tone}`, { active: reviews.query.status === card.status }]"
          @click="selectStatus(card.status)"
        >
          <span class="stat-icon"><component :is="card.icon" /></span>
          <strong>{{ card.value }}</strong>
          <span>{{ card.label }}</span>
        </button>
      </div>

      <a-card :bordered="false" class="review-card">
        <div class="toolbar">
          <a-input
            v-model:value="reviews.query.keyword"
            allow-clear
            :placeholder="t('merchant.propertyReviewPage.searchPlaceholder')"
            style="width: 300px"
            @press-enter="reviews.search()"
          >
            <template #prefix><SearchOutlined /></template>
          </a-input>
          <a-select v-model:value="reviews.query.status" :options="statusOptions" style="width: 170px" @change="reviews.search" />
          <a-button type="primary" @click="reviews.search()">{{ t('common.search') }}</a-button>
        </div>

        <a-table
          :columns="columns"
          :data-source="reviews.list.value"
          :loading="reviews.loading.value"
          :pagination="reviews.pagination.value"
          :scroll="{ x: 1080 }"
          row-key="id"
          size="middle"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'store_name'">
              <strong>{{ record.store_name }}</strong>
              <div class="muted">#{{ record.property_id }}</div>
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'reviewed_at'">{{ record.reviewed_at || '-' }}</template>
            <template v-else-if="column.key === 'action_col'">
              <a-button type="link" size="small" @click="openDetail(record)">
                {{ record.status === 1 ? t('merchant.propertyReviewPage.viewUpdates') : t('common.detail') }}
              </a-button>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

  </PageContainer>
</template>

<style scoped lang="less">
.review-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h1 { margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 28px; color: #14213d; }
.page-head p { margin: 6px 0 0; color: #64748b; }
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.stat-card { display: grid; grid-template-columns: 38px 1fr; gap: 2px 12px; align-items: center; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; color: #64748b; text-align: left; cursor: pointer; }
.stat-card:hover, .stat-card.active { border-color: #315efb; box-shadow: 0 6px 18px rgba(49, 94, 251, 0.1); }
.stat-card strong { color: #0f172a; font-size: 23px; line-height: 26px; }
.stat-card > span:last-child { grid-column: 2; font-size: 12px; }
.stat-icon { grid-row: 1 / span 2; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; font-size: 18px; }
.tone-blue .stat-icon { color: #315efb; background: #eef2ff; }
.tone-orange .stat-icon { color: #c26a00; background: #fff7e6; }
.tone-green .stat-icon { color: #15803d; background: #ecfdf3; }
.tone-red .stat-icon { color: #c24141; background: #fff1f2; }
.review-card { border-radius: 12px; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05); }
.toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.muted { color: #94a3b8; font-size: 12px; }
@media (max-width: 900px) { .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .stats-grid { grid-template-columns: 1fr; } .page-head { align-items: stretch; flex-direction: column; } }
</style>
