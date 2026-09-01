<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Modal, message } from 'ant-design-vue';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  FilterOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import {
  apiMerchantDocumentDetail,
  apiMerchantDocumentResubmit,
  apiMerchantDocuments,
  apiVerifyDocReview,
} from '@/api/merchant';
import { exportCsv } from '@/utils/exportCsv';
import { openMerchantDocument, fetchMerchantDocument } from '@/utils/merchantDocument';
const previewUrl = ref('');
const previewMime = ref('');
const previewLoading = ref(false);
function clearPreview(): void { if (previewUrl.value) URL.revokeObjectURL(previewUrl.value); previewUrl.value = ''; }
async function previewFile(): Promise<void> {
  const id = docDetail.value?.id;
  if (!id) return;
  previewLoading.value = true;
  try {
    const file = await fetchMerchantDocument(id);
    if (!drawerOpen.value || docDetail.value?.id !== id) return;
    clearPreview(); previewUrl.value = URL.createObjectURL(file.blob); previewMime.value = file.blob.type;
  } finally { previewLoading.value = false; }
}
onBeforeUnmount(clearPreview);
import DocumentReplaceModal from '@/components/merchant/DocumentReplaceModal.vue';
const replaceOpen = ref(false);
const replaceTarget = ref<TableRow | null>(null);
const docRevisions = ref<TableRow[]>([]);
function replaceDoc(row: TableRow): void { replaceTarget.value = row; replaceOpen.value = true; }
async function replaced(): Promise<void> { drawerOpen.value = false; await load(); }

/**
 * 商户资质文档库(Super Admin Portal 模块 03 Merchant Documents)
 * 需求源:docs/redesign/需求分析-商户管理模块.md §3.6
 * 五张统计卡(可点击过滤) + 类型筛选 + 行操作(预览/下载/核验历史/核验/要求重交) + 双 Tab 详情抽屉
 */
const { t } = useI18n();

const DOC_STATUS = computed<Record<number, StatusItem>>(() => ({
  1: { text: t('merchant.verifyPage.docVerified'), color: 'success' },
  2: { text: t('merchant.verifyPage.docPending'), color: 'warning' },
  3: { text: t('merchant.verifyPage.docRejected'), color: 'error' },
  4: { text: t('merchant.verifyPage.docExpired'), color: 'error' },
  5: { text: t('merchant.verifyPage.docResubRequired'), color: 'processing' },
}));

const DOC_TYPES = [
  'business_reg',
  'hotel_license',
  'id_doc',
  'bank_letter',
  'tax_cert',
  'premises_lease',
  'fnb_license',
  'fire_safety',
  'tourism_license',
  'air_operator_cert',
  'vehicle_reg',
  'insurance_cert',
] as const;

function docTypeLabel(type: string): string {
  const key = `merchant.documentsPage.docTypes.${type}`;
  const label = t(key);
  return label === key ? type : label;
}

// 列表 + 统计卡(统计卡仅站点口径,由同一接口返回,前端旁路缓存)
const stats = ref<Record<string, number>>({});

async function fetchDocuments(params: Record<string, unknown>): Promise<{ list: TableRow[]; total: number; page: number; pageSize: number }> {
  const data = await apiMerchantDocuments(params);
  if (data.stats) {
    stats.value = data.stats;
  }
  return data;
}

const { loading, list, total, page, pageSize, query, search, pagination, load } = useTable(fetchDocuments, {
  keyword: '',
  status: undefined,
  docType: '',
});

const STAT_CARDS = computed(() => [
  { key: 'total', label: t('merchant.documentsPage.statTotal'), value: stats.value.total ?? 0, icon: FileTextOutlined, tone: 'blue' },
  { key: 'verified', label: t('merchant.documentsPage.statVerified'), value: stats.value.verified ?? 0, icon: SafetyCertificateOutlined, tone: 'green' },
  { key: 'pending', label: t('merchant.documentsPage.statPending'), value: stats.value.pending ?? 0, icon: ClockCircleOutlined, tone: 'orange' },
  { key: 'expired', label: t('merchant.documentsPage.statExpired'), value: stats.value.expired ?? 0, icon: ExclamationCircleOutlined, tone: 'red' },
  { key: 'resubmission', label: t('merchant.documentsPage.statResubmission'), value: stats.value.resubmission ?? 0, icon: SyncOutlined, tone: 'blue' },
]);

const activeStat = ref<string>('total');

function filterByStat(key: string): void {
  activeStat.value = key;
  const map: Record<string, number | undefined> = {
    total: undefined,
    verified: 1,
    pending: 2,
    expired: 4,
    resubmission: 5,
  };
  query.status = map[key];
  search();
}

const columns = computed(() => [
  { title: t('merchant.documentsPage.colMerchant'), dataIndex: 'merchant_name', width: 190 },
  { title: t('merchant.documentsPage.colType'), dataIndex: 'doc_type', width: 280 },
  { title: t('merchant.documentsPage.colStatus'), dataIndex: 'status', width: 170 },
  { title: t('merchant.documentsPage.colExpiry'), dataIndex: 'expiry_date', width: 130 },
  { title: t('merchant.documentsPage.colLastVerified'), dataIndex: 'last_verified_at', width: 145 },
  { title: t('merchant.documentsPage.colReviewer'), dataIndex: 'reviewer_name', width: 145 },
  { title: t('common.action'), key: 'action_col', width: 230, fixed: 'right' as const },
]);

const tablePagination = computed(() => ({
  ...pagination.value,
  showSizeChanger: false,
  showQuickJumper: false,
  showTotal: () => t('merchant.documentsPage.paginationInfo', {
    from: total.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1,
    to: Math.min(page.value * pageSize.value, total.value),
    total: total.value,
  }),
}));

function formatFileSize(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  const text = String(value);
  if (/[^\d.]/.test(text)) return text;
  const bytes = Number(text);
  if (!Number.isFinite(bytes)) return text;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function displayDate(value: unknown): string {
  return value ? String(value).slice(0, 10) : '-';
}

function reviewerInitials(name: unknown): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : String(name || '-').slice(0, 2).toUpperCase();
}

function handleStatusChange(): void {
  const statByStatus: Record<number, string> = { 1: 'verified', 2: 'pending', 4: 'expired', 5: 'resubmission' };
  activeStat.value = query.status === undefined ? 'total' : statByStatus[query.status] ?? '';
  search();
}

// ---------- 文档详情抽屉(双 Tab:Document Preview / Verification History) ----------
const drawerOpen = ref(false);
const drawerLoading = ref(false);
const drawerTab = ref<'preview' | 'history'>('preview');
const docDetail = ref<TableRow | null>(null);
const docHistory = ref<TableRow[]>([]);
watch([drawerOpen, () => docDetail.value?.id], clearPreview);

async function openPreview(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  drawerTab.value = 'preview';
  drawerLoading.value = true;
  try {
    const data = await apiMerchantDocumentDetail(row.id);
    docDetail.value = data.document;
    docHistory.value = data.history;
    docRevisions.value = data.revisions;
  } finally {
    drawerLoading.value = false;
  }
}

function openHistory(row: TableRow): void {
  void openPreview(row).then(() => {
    drawerTab.value = 'history';
  });
}

function downloadDoc(row: TableRow): void { void openMerchantDocument(row.id); }

/** 导出当前筛选结果(整改 D2,分页上限 200) */
async function exportList(): Promise<void> {
  const data = await apiMerchantDocuments({ ...query, page: 1, pageSize: 200 });
  exportCsv(`merchant-documents-${Date.now()}.csv`, [
    { key: 'merchant_name', label: 'Merchant' },
    { key: 'name', label: 'Document' },
    { key: 'doc_type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'expiry_date', label: 'Expiry Date' },
    { key: 'last_verified_at', label: 'Last Verified' },
    { key: 'reviewer_name', label: 'Reviewer' },
  ], data.list.map((row) => ({
    ...row,
    name: row.name || docTypeLabel(row.doc_type),
    doc_type: docTypeLabel(row.doc_type),
    status: DOC_STATUS.value[row.status]?.text ?? row.status,
  })));
}

// ---------- 核验通过 ----------
function confirmVerify(row: TableRow): void {
  Modal.confirm({
    title: t('merchant.documentsPage.verify'),
    content: t('merchant.documentsPage.verifyConfirm', { doc: row.name || docTypeLabel(row.doc_type) }),
    okText: t('merchant.documentsPage.verify'),
    async onOk() {
      await apiVerifyDocReview({ docId: row.id, action: 'verify', expectedVersion: row.document_version });
      message.success(t('merchant.documentsPage.verifySuccess'));
      await load();
    },
  });
}

// ---------- 要求重交 ----------
const resubOpen = ref(false);
const resubSaving = ref(false);
const resubTarget = ref<TableRow | null>(null);
const resubReason = ref('');
const resubMode = ref<'resubmit' | 'reject'>('resubmit');
function openReject(row: TableRow): void { openResub(row); resubMode.value = 'reject'; }

const RESUB_REASONS = computed(() => [
  { key: 'resubR1', label: t('merchant.documentsPage.resubR1') },
  { key: 'resubR2', label: t('merchant.documentsPage.resubR2') },
  { key: 'resubR3', label: t('merchant.documentsPage.resubR3') },
  { key: 'resubR4', label: t('merchant.documentsPage.resubR4') },
  { key: 'resubR5', label: t('merchant.documentsPage.resubR5') },
  { key: 'resubR6', label: t('merchant.documentsPage.resubR6') },
]);

function openResub(row: TableRow): void {
  resubMode.value = 'resubmit';
  resubTarget.value = row;
  resubReason.value = '';
  resubOpen.value = true;
}

async function doResub(): Promise<void> {
  if (!resubReason.value) {
    message.warning(t('merchant.documentsPage.resubReasonRequired'));
    return;
  }
  if (!resubTarget.value) {
    return;
  }
  resubSaving.value = true;
  try {
    if (resubMode.value === 'reject') {
      await apiVerifyDocReview({ docId: resubTarget.value.id, action: 'reject', reason: resubReason.value, expectedVersion: resubTarget.value.document_version });
    } else {
      await apiMerchantDocumentResubmit(resubTarget.value.id, resubReason.value, resubTarget.value.document_version);
    }
    message.success(t(resubMode.value === 'reject' ? 'merchant.verifyPage.docRejectSuccess' : 'merchant.documentsPage.resubSuccess'));
    resubOpen.value = false;
    await load();
  } finally {
    resubSaving.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <div class="documents-page">
      <div class="page-heading">
        <div>
          <div class="page-eyebrow">{{ t('merchant.documentsPage.subtitle') }}</div>
          <h1>{{ t('merchant.documentsPage.title') }}</h1>
          <p>{{ t('merchant.documentsPage.pageDesc') }}</p>
        </div>
        <a-button class="export-button" @click="exportList">
          <template #icon><DownloadOutlined /></template>{{ t('common.export') }}
        </a-button>
      </div>

      <!-- 5 张统计卡(可点击过滤) -->
      <div class="stats-grid">
        <div
          class="stat-card"
          v-for="card in STAT_CARDS"
          :key="card.key"
          :class="[`tone-${card.tone}`, { active: activeStat === card.key }]"
          @click="filterByStat(card.key)"
        >
          <div class="stat-card-top">
            <span class="stat-icon"><component :is="card.icon" /></span>
            <span v-if="activeStat === card.key" class="active-dot" />
          </div>
          <div class="stat-value">{{ card.value }}</div>
          <div class="stat-label">{{ card.label }}</div>
        </div>
      </div>

      <div class="document-toolbar">
        <div class="toolbar-search">
          <SearchOutlined />
          <a-input v-model:value="query.keyword" allow-clear :placeholder="t('merchant.documentsPage.keywordPlaceholder')" :bordered="false" @press-enter="search" />
        </div>
        <div class="toolbar-filters">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('merchant.documentsPage.allStatuses')" :bordered="false" @change="handleStatusChange">
            <a-select-option :value="1">{{ t('merchant.verifyPage.docVerified') }}</a-select-option>
            <a-select-option :value="2">{{ t('merchant.verifyPage.docPending') }}</a-select-option>
            <a-select-option :value="3">{{ t('merchant.verifyPage.docRejected') }}</a-select-option>
            <a-select-option :value="4">{{ t('merchant.verifyPage.docExpired') }}</a-select-option>
            <a-select-option :value="5">{{ t('merchant.verifyPage.docResubRequired') }}</a-select-option>
          </a-select>
          <a-select v-model:value="query.docType" allow-clear :placeholder="t('merchant.documentsPage.allDocumentTypes')" :bordered="false" @change="search">
            <a-select-option v-for="tp in DOC_TYPES" :key="tp" :value="tp">{{ docTypeLabel(tp) }}</a-select-option>
          </a-select>
          <div class="result-count"><FilterOutlined />{{ t('merchant.documentsPage.resultCount', { total }) }}</div>
        </div>
      </div>

      <div class="documents-table-card">
      <a-table
        class="documents-table"
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="tablePagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1260 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'merchant_name'">
            <div class="merchant-name">{{ record.merchant_name || '-' }}</div>
            <div class="merchant-meta">#{{ record.merchant_id }}</div>
          </template>
          <template v-else-if="column.dataIndex === 'doc_type'">
            <div class="document-cell">
              <span class="document-icon"><FileTextOutlined /></span>
              <span>
                <span class="document-name">{{ docTypeLabel(record.doc_type) }}</span>
                <span class="document-meta">{{ formatFileSize(record.file_size) }} · PDF</span>
              </span>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="DOC_STATUS" />
          </template>
          <template v-else-if="column.dataIndex === 'expiry_date'">
            <span :class="{ 'expired-date': record.status === 4 }">{{ displayDate(record.expiry_date) }}</span>
            <a-tag v-if="record.expiring_soon === 1" color="warning" class="expiring-tag">
              {{ t('merchant.documentsPage.expiringSoon') }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'last_verified_at'">
            <span :class="{ 'muted-value': !record.last_verified_at }">{{ record.last_verified_at ? displayDate(record.last_verified_at) : t('merchant.documentsPage.notVerified') }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'reviewer_name'">
            <div v-if="record.reviewer_name" class="reviewer-cell">
              <span class="reviewer-avatar">{{ reviewerInitials(record.reviewer_name) }}</span>
              <span>{{ record.reviewer_name }}</span>
            </div>
            <span v-else class="muted-value">-</span>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="2" class="action-icons">
              <a-tooltip :title="t('merchant.documentsPage.preview')">
                <a-button type="link" size="small" @click="openPreview(record)"><template #icon><EyeOutlined /></template></a-button>
              </a-tooltip>
              <a-tooltip :title="t('merchant.documentsPage.download')">
                <a-button v-perm="'merchant:document:download'" type="link" size="small" @click="downloadDoc(record)"><template #icon><DownloadOutlined /></template></a-button>
              </a-tooltip>
              <a-tooltip :title="t('merchant.documentsPage.history')">
                <a-button type="link" size="small" @click="openHistory(record)"><template #icon><HistoryOutlined /></template></a-button>
              </a-tooltip>
              <a-tooltip :title="t('merchant.documentsPage.verify')">
                <a-button
                  v-if="record.status === 2"
                  v-perm="'merchant:document:verify'"
                  type="link"
                  size="small"
                  style="color: #059669"
                  @click="confirmVerify(record)"
                ><template #icon><CheckCircleOutlined /></template></a-button>
              </a-tooltip>
              <a-tooltip v-if="record.status === 2" :title="t('merchant.verifyPage.docRejectModalTitle')">
                <a-button v-perm="'merchant:document:verify'" type="link" danger size="small" @click="openReject(record)"><template #icon><ExclamationCircleOutlined /></template></a-button>
              </a-tooltip>
              <a-tooltip :title="t('merchant.s3.replace')">
                <a-button v-perm="'merchant:document:replace'" type="link" size="small" @click="replaceDoc(record)"><template #icon><SyncOutlined /></template></a-button>
              </a-tooltip>
              <a-tooltip :title="t('merchant.documentsPage.resubmit')">
                <a-button
                  v-if="record.status !== 5"
                  v-perm="'merchant:document:verify'"
                  type="link"
                  size="small"
                  style="color: #d97706"
                  @click="openResub(record)"
                ><template #icon><ReloadOutlined /></template></a-button>
              </a-tooltip>
            </a-space>
          </template>
        </template>
      </a-table>
      </div>
    </div>

    <!-- 文档详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" :width="620" root-class-name="merchant-doc-drawer">
      <template #title>
        <div v-if="docDetail" class="drawer-title-block">
          <div class="drawer-title">{{ docTypeLabel(docDetail.doc_type) }}</div>
          <div class="drawer-subtitle">{{ docDetail.merchant_name }} · #{{ docDetail.merchant_id }}</div>
        </div>
      </template>
      <a-spin :spinning="drawerLoading">
        <template v-if="docDetail">
          <a-tabs v-model:activeKey="drawerTab" class="document-tabs">
            <a-tab-pane key="preview" :tab="t('merchant.documentsPage.previewTitle')">
              <div class="detail-status" :class="`status-${docDetail.status}`">
                <StatusTag :value="docDetail.status" :map="DOC_STATUS" />
                <span v-if="docDetail.reject_reason" class="status-reason">{{ docDetail.reject_reason }}</span>
              </div>

              <div class="preview-card">
                <div class="preview-hero">
                  <span class="preview-file-icon"><FileTextOutlined /></span>
                  <div class="preview-file-name">{{ docDetail.name || docTypeLabel(docDetail.doc_type) }}</div>
                  <div class="preview-file-meta">{{ formatFileSize(docDetail.file_size) }} · {{ t('merchant.documentsPage.pdfDocument') }}</div>
                  <div class="preview-lines"><i /><i /><i /><i /></div>
                </div>
                <div class="preview-facts">
                  <div>
                    <span>{{ t('merchant.documentsPage.uploaded') }}</span>
                    <strong>{{ displayDate(docDetail.uploaded_at) }}</strong>
                  </div>
                  <div>
                    <span>{{ t('merchant.documentsPage.fileSize') }}</span>
                    <strong>{{ formatFileSize(docDetail.file_size) }}</strong>
                  </div>
                  <div>
                    <span>{{ t('merchant.documentsPage.expiryDate') }}</span>
                    <strong>{{ displayDate(docDetail.expiry_date) }}</strong>
                  </div>
                </div>
              </div>

              <div v-if="docDetail.has_file" class="inline-preview-action">
                <a-button v-perm="'merchant:document:download'" :loading="previewLoading" @click="previewFile">
                  <template #icon><EyeOutlined /></template>{{ t('merchant.documentsPage.preview') }}
                </a-button>
              </div>

              <iframe v-if="previewUrl && previewMime === 'application/pdf'" :src="previewUrl" :title="docDetail.name" class="file-preview-frame" />
              <img v-else-if="previewUrl && previewMime.startsWith('image/')" :src="previewUrl" :alt="docDetail.name" class="file-preview-image" />
              <a-descriptions :column="1" size="small" bordered class="document-details">
                <a-descriptions-item :label="t('merchant.documentsPage.documentType')">{{ docTypeLabel(docDetail.doc_type) }}</a-descriptions-item>
                <a-descriptions-item :label="t('merchant.documentsPage.merchant')">{{ docDetail.merchant_name }} (#{{ docDetail.merchant_id }})</a-descriptions-item>
                <a-descriptions-item :label="t('merchant.documentsPage.fileName')">{{ docDetail.name }}</a-descriptions-item>
                <a-descriptions-item :label="t('merchant.documentsPage.uploadedDate')">{{ displayDate(docDetail.uploaded_at) }}</a-descriptions-item>
                <a-descriptions-item :label="t('merchant.documentsPage.expiryDate')">{{ displayDate(docDetail.expiry_date) }}</a-descriptions-item>
                <a-descriptions-item :label="t('merchant.documentsPage.lastVerified')">{{ docDetail.last_verified_at ? displayDate(docDetail.last_verified_at) : t('merchant.documentsPage.notVerified') }}</a-descriptions-item>
                <a-descriptions-item :label="t('merchant.documentsPage.assignedReviewer')">{{ docDetail.reviewer_name || '-' }}</a-descriptions-item>
              </a-descriptions>

              <a-button v-if="docDetail.has_file" v-perm="'merchant:document:download'" block class="download-original" @click="downloadDoc(docDetail)">
                <template #icon><DownloadOutlined /></template>{{ t('merchant.documentsPage.downloadOriginal') }}
              </a-button>
            </a-tab-pane>

            <a-tab-pane key="history" :tab="t('merchant.documentsPage.historyTitle')">
              <div class="history-description">{{ t('merchant.documentsPage.historyDesc') }}</div>
              <a-alert type="info" :message="t('merchant.s3.historyNotice')" class="history-notice" />
              <a-list :data-source="docRevisions" size="small">
                <template #renderItem="{ item }"><a-list-item>
                  <span>{{ item.lifecycle_version === null ? t('merchant.s3.legacy') : `v${item.lifecycle_version}` }} · {{ item.file_name || item.source }} · {{ item.uploaded_at }}</span>
                  <a-button v-if="item.has_file" v-perm="'merchant:document:download'" type="link" @click="openMerchantDocument(docDetail.id, item.id)">{{ t('merchant.documentsPage.download') }}</a-button>
                </a-list-item></template>
              </a-list>
              <a-timeline>
                <a-timeline-item v-for="(item, idx) in docHistory" :key="idx">
                  <div style="display: flex; align-items: center; gap: 8px">
                    <span style="font-weight: 600">v{{ item.version }} · {{ t(`merchant.s3.events.${item.action}`) }}</span>
                    <span style="font-size: 11px; color: #94a3b8">{{ item.actor_name }}</span>
                  </div>
                  <div v-if="item.reason" style="font-size: 12px; color: #64748b">{{ item.reason }}</div>
                  <div style="font-size: 11px; color: #94a3b8">{{ item.created_at }}</div>
                </a-timeline-item>
              </a-timeline>
            </a-tab-pane>
          </a-tabs>
        </template>
      </a-spin>
    </a-drawer>

    <DocumentReplaceModal v-model:open="replaceOpen" :document="replaceTarget" @saved="replaced" />
    <!-- 要求重交弹窗 -->
    <a-modal
      v-model:open="resubOpen"
      :title="t(resubMode === 'reject' ? 'merchant.verifyPage.docRejected' : 'merchant.documentsPage.resubModalTitle')"
      :confirm-loading="resubSaving"
      :ok-text="t(resubMode === 'reject' ? 'common.confirm' : 'merchant.verifyPage.sendNotification')"
      @ok="doResub"
    >
      <p v-if="resubMode === 'resubmit'" style="margin: 8px 0 12px">
        {{ t('merchant.documentsPage.resubNotifyText', {
          name: resubTarget?.merchant_name ?? '',
          doc: resubTarget ? resubTarget.name || docTypeLabel(resubTarget.doc_type) : '',
        }) }}
      </p>
      <a-form layout="vertical">
        <a-form-item :label="`${t('merchant.documentsPage.resubReason')} *`">
          <a-select v-model:value="resubReason" :placeholder="t('merchant.documentsPage.resubReasonPlaceholder')">
            <a-select-option v-for="r in RESUB_REASONS" :key="r.key" :value="r.label">{{ r.label }}</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.documents-page {
  color: #1a2332;
}

.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;

  h1 {
    margin: 4px 0 2px;
    color: #172033;
    font-size: 20px;
    font-weight: 700;
    line-height: 1.4;
  }

  p {
    margin: 0;
    color: #94a3b8;
    font-size: 13px;
  }
}

.page-eyebrow {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.7px;
  text-transform: uppercase;
}

.export-button {
  height: 36px;
  border-color: #e3e8f0;
  border-radius: 7px;
  color: #475569;
  box-shadow: none;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.stat-card {
  min-height: 112px;
  padding: 14px 16px;
  cursor: pointer;
  background: #fff;
  border: 1px solid #e3e8f0;
  border-radius: 9px;
  transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;

  &:hover {
    border-color: #1664ff;
    box-shadow: 0 4px 14px rgba(22, 100, 255, 0.08);
  }

  &.active {
    border-color: #9fc0ff;
    background: #eef4ff;
    box-shadow: 0 0 0 1px rgba(22, 100, 255, 0.08);
  }

  &.tone-green { --stat-color: #059669; --stat-bg: #ecfdf5; }
  &.tone-orange { --stat-color: #d97706; --stat-bg: #fffbeb; }
  &.tone-red { --stat-color: #dc2626; --stat-bg: #fff1f2; }
  &.tone-blue { --stat-color: #1664ff; --stat-bg: #eff6ff; }
}

.stat-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
}

.stat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: var(--stat-color);
  font-size: 15px;
  background: var(--stat-bg);
  border-radius: 7px;
}

.active-dot {
  width: 6px;
  height: 6px;
  background: #1664ff;
  border-radius: 50%;
}

.stat-value {
  color: var(--stat-color);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 25px;
  line-height: 1;
}

.stat-label {
  margin-top: 6px;
  color: #94a3b8;
  font-size: 12px;
}

.stat-card.active .stat-label {
  color: #1664ff;
  font-weight: 600;
}

.document-toolbar {
  display: flex;
  align-items: center;
  min-height: 48px;
  margin-bottom: 16px;
  padding: 6px 10px 6px 14px;
  background: #fff;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
}

.toolbar-search {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 260px;
  color: #94a3b8;

  :deep(.ant-input-affix-wrapper) {
    box-shadow: none;
  }
}

.toolbar-filters {
  display: flex;
  align-items: center;

  :deep(.ant-select) {
    width: 190px;
    border-left: 1px solid #e3e8f0;
  }

  :deep(.ant-select-selector) {
    padding-left: 18px !important;
    color: #64748b;
    box-shadow: none !important;
  }
}

.result-count {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 30px;
  padding-left: 16px;
  color: #94a3b8;
  font-size: 12px;
  white-space: nowrap;
  border-left: 1px solid #e3e8f0;
}

.documents-table-card {
  overflow: hidden;
  background: #fff;
  border: 1px solid #e3e8f0;
  border-radius: 9px;
}

.documents-table {
  :deep(.ant-table) {
    color: #475569;
    font-size: 12px;
  }

  :deep(.ant-table-thead > tr > th) {
    padding-top: 12px;
    padding-bottom: 12px;
    color: #64748b;
    font-size: 11px;
    font-weight: 600;
    background: #f8fafc;
    border-bottom-color: #e3e8f0;
  }

  :deep(.ant-table-tbody > tr > td) {
    height: 62px;
    padding-top: 9px;
    padding-bottom: 9px;
    border-bottom-color: #f1f5f9;
  }

  :deep(.ant-table-pagination.ant-pagination) {
    margin: 0;
    padding: 12px 16px;
    background: #fafbfc;
    border-top: 1px solid #f1f5f9;
  }

  :deep(.ant-pagination-total-text) {
    margin-right: auto;
    color: #94a3b8;
    font-size: 12px;
  }

  :deep(.ant-pagination-item),
  :deep(.ant-pagination-prev),
  :deep(.ant-pagination-next) {
    min-width: 28px;
    height: 28px;
    line-height: 26px;
    border: 0;
    border-radius: 4px;
  }

  :deep(.ant-pagination-item-active) {
    background: #1664ff;
  }

  :deep(.ant-pagination-item-active a) {
    color: #fff;
  }

  :deep(.ant-tag) {
    margin-inline-end: 0;
    padding: 1px 9px;
    font-size: 11px;
    line-height: 20px;
    border-radius: 999px;
  }
}

.merchant-name,
.document-name {
  display: block;
  color: #1a2332;
  font-size: 12px;
  font-weight: 600;
}

.merchant-meta,
.document-meta {
  display: block;
  margin-top: 2px;
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
}

.document-cell,
.reviewer-cell {
  display: flex;
  align-items: center;
  gap: 9px;
}

.document-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 6px;
}

.reviewer-avatar {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  background: #1664ff;
  border-radius: 50%;
}

.muted-value { color: #cbd5e1; }
.expired-date { color: #ef4444; }
.expiring-tag { margin-left: 4px; }

.action-icons {
  :deep(.ant-btn-link) {
    color: #94a3b8;
  }

  :deep(.ant-btn-link:hover) {
    color: #1664ff;
    background: #eff6ff;
  }
}

:global(.merchant-doc-drawer .ant-drawer-header) {
  padding: 16px 28px;
  border-bottom: 1px solid #e3e8f0;
}

:global(.merchant-doc-drawer .ant-drawer-body) {
  padding: 0 28px 28px;
}

.drawer-title {
  color: #1a2332;
  font-size: 17px;
  font-weight: 700;
}

.drawer-subtitle {
  margin-top: 2px;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 400;
}

.document-tabs {
  :deep(.ant-tabs-nav) {
    margin: 0 -28px 22px;
    padding: 0 28px;
  }

  :deep(.ant-tabs-tab) {
    padding: 16px 0 14px;
    color: #64748b;
    font-size: 14px;
  }

  :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
    color: #1664ff;
    font-weight: 600;
  }

  :deep(.ant-tabs-ink-bar) {
    height: 3px;
    background: #1664ff;
  }
}

.detail-status {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 58px;
  margin-bottom: 18px;
  padding: 12px 18px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 9px;

  &.status-1 { background: #ecfdf5; border-color: #a7f3d0; }
  &.status-2 { background: #fffbeb; border-color: #fde68a; }
  &.status-3,
  &.status-4 { background: #fff1f2; border-color: #fecdd3; }
}

.status-reason {
  color: #64748b;
  font-size: 12px;
}

.preview-card {
  overflow: hidden;
  margin-bottom: 16px;
  border: 1px solid #e3e8f0;
  border-radius: 10px;
}

.preview-hero {
  display: flex;
  min-height: 270px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 28px;
  text-align: center;
  background: #f4f7fb;
}

.preview-file-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  margin-bottom: 16px;
  color: #059669;
  font-size: 30px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
}

.preview-file-name {
  max-width: 100%;
  overflow-wrap: anywhere;
  color: #1a2332;
  font-size: 14px;
  font-weight: 600;
}

.preview-file-meta {
  margin-top: 7px;
  color: #94a3b8;
  font-size: 12px;
}

.preview-lines {
  width: 72%;
  margin-top: 24px;

  i {
    display: block;
    width: 100%;
    height: 6px;
    margin-top: 8px;
    background: #e2e8f0;
    border-radius: 999px;
  }

  i:nth-child(2) { width: 75%; }
  i:nth-child(3) { width: 92%; }
  i:nth-child(4) { width: 62%; }
}

.preview-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 16px 18px;
  background: #fff;

  span,
  strong {
    display: block;
  }

  span {
    margin-bottom: 5px;
    color: #94a3b8;
    font-size: 11px;
    text-transform: uppercase;
  }

  strong {
    color: #1a2332;
    font-size: 12px;
    font-weight: 500;
  }
}

.inline-preview-action {
  margin-bottom: 16px;
  text-align: right;
}

.file-preview-frame {
  width: 100%;
  height: 420px;
  margin-bottom: 16px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
}

.file-preview-image {
  display: block;
  max-width: 100%;
  max-height: 420px;
  margin: 0 auto 16px;
  border-radius: 8px;
}

.document-details {
  :deep(.ant-descriptions-view) {
    overflow: hidden;
    border-color: #e3e8f0;
    border-radius: 9px;
  }

  :deep(.ant-descriptions-row > th),
  :deep(.ant-descriptions-row > td) {
    padding: 13px 18px;
    border-bottom-color: #f1f5f9;
  }

  :deep(.ant-descriptions-item-label) {
    width: 36%;
    color: #94a3b8;
    background: #fff;
  }

  :deep(.ant-descriptions-item-content) {
    color: #1a2332;
    background: #fff;
  }

  :deep(.ant-descriptions-row:nth-child(even) > th),
  :deep(.ant-descriptions-row:nth-child(even) > td) {
    background: #fafbfc;
  }
}

.download-original {
  height: 44px;
  margin-top: 18px;
  color: #475569;
  background: #f8fafc;
  border-color: #e3e8f0;
  border-radius: 8px;
  font-weight: 500;
}

.history-description {
  margin-bottom: 14px;
  color: #64748b;
  font-size: 12px;
}

.history-notice { margin-bottom: 12px; }

@media (max-width: 1100px) {
  .stats-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .document-toolbar { align-items: stretch; flex-direction: column; gap: 8px; }
  .toolbar-filters { border-top: 1px solid #f1f5f9; padding-top: 8px; }
}

@media (max-width: 720px) {
  .page-heading { align-items: flex-start; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .toolbar-filters { align-items: stretch; flex-direction: column; }
  .toolbar-filters :deep(.ant-select) { width: 100%; border: 0; }
  .result-count { border: 0; }
}
</style>
