<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
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
import {
  apiMerchantPropertyContentAudit,
  apiMerchantPropertyContentDetail,
  apiMerchantPropertyContentList,
} from '@/api/merchant';

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
  { title: t('common.action'), key: 'action_col', width: 200, fixed: 'right' as const },
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

const drawerOpen = ref(false);
const drawerLoading = ref(false);
const detail = ref<TableRow | null>(null);
const diffRows = computed(() => {
  const current = detail.value?.effective || {};
  const submitted = detail.value?.revision?.payload || {};
  const fields = [
    'store_name', 'contact_phone', 'contact_phone2', 'contact_email', 'address', 'country_code',
    'city_key', 'longitude', 'latitude', 'description', 'star_level', 'facilities', 'amenities',
    'images', 'image_gallery', 'website', 'checkin_time', 'checkout_time',
  ];
  return fields.map((field) => ({
    field,
    current: current[field],
    submitted: submitted[field],
    changed: JSON.stringify(current[field] ?? null) !== JSON.stringify(submitted[field] ?? null),
  }));
});
const submittedImages = computed<string[]>(() => {
  const payload = detail.value?.revision?.payload || {};
  const gallery = Array.isArray(payload.image_gallery)
    ? payload.image_gallery.map((item: unknown) => typeof item === 'string' ? item : String((item as TableRow)?.url || '')).filter(Boolean)
    : [];
  const images = Array.isArray(payload.images) ? payload.images.map(String).filter(Boolean) : [];
  return Array.from(new Set([...gallery, ...images]));
});

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value) && value.every((item) => typeof item !== 'object')) return value.join(', ');
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}

function diffRowClass(record: TableRow): string {
  return record.changed ? 'changed-row' : '';
}

async function openDetail(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  drawerLoading.value = true;
  try {
    detail.value = await apiMerchantPropertyContentDetail(row.id);
  } finally {
    drawerLoading.value = false;
  }
}

const auditOpen = ref(false);
const auditSaving = ref(false);
const auditTarget = ref<TableRow | null>(null);
const auditForm = reactive({ auditStatus: 1, auditRemark: '' });

function openAudit(row: TableRow, auditStatus: number): void {
  auditTarget.value = row;
  Object.assign(auditForm, { auditStatus, auditRemark: '' });
  auditOpen.value = true;
}

async function submitAudit(): Promise<void> {
  if (!auditTarget.value) return;
  if (auditForm.auditStatus === 2 && !auditForm.auditRemark.trim()) {
    message.warning(t('goods.audit.auditModal.warningRejectReasonRequired'));
    return;
  }
  auditSaving.value = true;
  try {
    await apiMerchantPropertyContentAudit({ id: auditTarget.value.id, ...auditForm });
    message.success(t(auditForm.auditStatus === 1
      ? 'goods.audit.propertyReview.successApprove'
      : 'goods.audit.propertyReview.successReject'));
    auditOpen.value = false;
    drawerOpen.value = false;
    await reviews.load();
  } finally {
    auditSaving.value = false;
  }
}

onMounted(() => void reviews.load());
</script>

<template>
  <PageContainer>
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
          :scroll="{ x: 1180 }"
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
              <a-space :size="0">
                <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
                <template v-if="record.status === 1">
                  <a-button v-perm="'merchant:property:content-audit'" type="link" size="small" class="approve" @click="openAudit(record, 1)">{{ t('goods.audit.columns.pass') }}</a-button>
                  <a-button v-perm="'merchant:property:content-audit'" type="link" size="small" danger @click="openAudit(record, 2)">{{ t('goods.audit.columns.reject') }}</a-button>
                </template>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <a-drawer v-model:open="drawerOpen" :title="t('merchant.propertyReviewPage.detailTitle')" width="920">
      <a-spin :spinning="drawerLoading">
        <template v-if="detail">
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item :label="t('goods.audit.propertyReview.property')">{{ detail.revision.payload.store_name }}</a-descriptions-item>
            <a-descriptions-item :label="t('goods.audit.merchant')">{{ detail.revision.merchant_name }}</a-descriptions-item>
            <a-descriptions-item :label="t('goods.audit.roomReview.version')">v{{ detail.revision.version }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.status')"><a-tag :color="statusColor(detail.revision.status)">{{ statusLabel(detail.revision.status) }}</a-tag></a-descriptions-item>
            <a-descriptions-item :label="t('goods.audit.submitTime')">{{ detail.revision.submitted_at || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.propertyReviewPage.reviewedAt')">{{ detail.revision.reviewed_at || '-' }}</a-descriptions-item>
            <a-descriptions-item v-if="detail.revision.reject_reason" :label="t('merchant.propertyReviewPage.rejectReason')" :span="2">{{ detail.revision.reject_reason }}</a-descriptions-item>
          </a-descriptions>
          <a-divider orientation="left">{{ t('goods.audit.roomReview.submittedChanges') }}</a-divider>
          <a-table
            :data-source="diffRows"
            row-key="field"
            size="small"
            :pagination="false"
            :columns="[
              { title: t('goods.audit.roomReview.field'), dataIndex: 'field', width: 180 },
              { title: t('goods.audit.roomReview.currentLive'), dataIndex: 'current' },
              { title: t('goods.audit.roomReview.submitted'), dataIndex: 'submitted' },
            ]"
            :row-class-name="diffRowClass"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'current'"><pre class="diff-value">{{ displayValue(record.current) }}</pre></template>
              <template v-else-if="column.dataIndex === 'submitted'"><pre class="diff-value">{{ displayValue(record.submitted) }}</pre></template>
            </template>
          </a-table>
          <template v-if="submittedImages.length">
            <a-divider orientation="left">{{ t('goods.audit.roomReview.media') }}</a-divider>
            <a-image-preview-group><a-space wrap><a-image v-for="url in submittedImages" :key="url" :src="url" :width="120" :height="90" class="media-image" /></a-space></a-image-preview-group>
          </template>
          <template v-if="detail.revision.status === 1">
            <a-divider />
            <a-space>
              <a-button v-perm="'merchant:property:content-audit'" type="primary" @click="openAudit(detail.revision, 1)">{{ t('goods.audit.columns.pass') }}</a-button>
              <a-button v-perm="'merchant:property:content-audit'" danger @click="openAudit(detail.revision, 2)">{{ t('goods.audit.columns.reject') }}</a-button>
            </a-space>
          </template>
        </template>
      </a-spin>
    </a-drawer>

    <a-modal
      v-model:open="auditOpen"
      :title="auditForm.auditStatus === 1 ? t('goods.audit.propertyReview.approveTitle') : t('goods.audit.propertyReview.rejectTitle')"
      width="480px"
      :confirm-loading="auditSaving"
      :ok-button-props="auditForm.auditStatus === 2 ? { danger: true } : undefined"
      @ok="submitAudit"
    >
      <a-alert
        :type="auditForm.auditStatus === 1 ? 'success' : 'warning'"
        :message="auditForm.auditStatus === 1 ? t('goods.audit.propertyReview.approveNotice') : t('goods.audit.propertyReview.rejectNotice')"
        show-icon
        style="margin: 16px 0"
      />
      <a-form><a-form-item :label="t('goods.audit.roomReview.reviewNote')" :required="auditForm.auditStatus === 2"><a-textarea v-model:value="auditForm.auditRemark" :rows="3" :maxlength="500" /></a-form-item></a-form>
    </a-modal>
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
.approve { color: #15803d; }
.diff-value { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: inherit; }
:deep(.changed-row td) { background: #fffbea !important; }
.media-image { object-fit: cover; border-radius: 6px; }
@media (max-width: 900px) { .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .stats-grid { grid-template-columns: 1fr; } .page-head { align-items: stretch; flex-direction: column; } }
</style>
