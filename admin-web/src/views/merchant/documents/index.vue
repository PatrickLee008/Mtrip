<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Modal, message } from 'ant-design-vue';
import {
  DownloadOutlined,
  EyeOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
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

const { loading, list, query, search, reset, pagination, load } = useTable(fetchDocuments, {
  keyword: '',
  status: undefined,
  docType: '',
});

const STAT_CARDS = computed(() => [
  { key: 'total', label: t('merchant.documentsPage.statTotal'), value: stats.value.total ?? 0 },
  { key: 'verified', label: t('merchant.documentsPage.statVerified'), value: stats.value.verified ?? 0, color: '#059669' },
  { key: 'pending', label: t('merchant.documentsPage.statPending'), value: stats.value.pending ?? 0, color: '#D97706' },
  { key: 'expired', label: t('merchant.documentsPage.statExpired'), value: stats.value.expired ?? 0, color: '#DC2626' },
  { key: 'resubmission', label: t('merchant.documentsPage.statResubmission'), value: stats.value.resubmission ?? 0, color: '#1D4ED8' },
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
  { title: t('merchant.documentsPage.colMerchant'), dataIndex: 'merchant_name', width: 180 },
  { title: t('merchant.documentsPage.colDocument'), dataIndex: 'name', width: 220 },
  { title: t('merchant.documentsPage.colType'), dataIndex: 'doc_type', width: 180 },
  { title: t('merchant.documentsPage.colStatus'), dataIndex: 'status', width: 150 },
  { title: t('merchant.documentsPage.colExpiry'), dataIndex: 'expiry_date', width: 130 },
  { title: t('merchant.documentsPage.colLastVerified'), dataIndex: 'last_verified_at', width: 150 },
  { title: t('merchant.documentsPage.colReviewer'), dataIndex: 'reviewer_name', width: 120 },
  { title: t('common.action'), key: 'action_col', width: 190, fixed: 'right' as const },
]);

// ---------- 文档详情抽屉(双 Tab:Document Preview / Verification History) ----------
const drawerOpen = ref(false);
const drawerLoading = ref(false);
const drawerTab = ref<'preview' | 'history'>('preview');
const docDetail = ref<TableRow | null>(null);
const docHistory = ref<TableRow[]>([]);

async function openPreview(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  drawerTab.value = 'preview';
  drawerLoading.value = true;
  try {
    const data = await apiMerchantDocumentDetail(row.id);
    docDetail.value = data.document;
    docHistory.value = data.history;
  } finally {
    drawerLoading.value = false;
  }
}

function openHistory(row: TableRow): void {
  void openPreview(row).then(() => {
    drawerTab.value = 'history';
  });
}

function downloadDoc(row: TableRow): void {
  if (row.file_url) {
    window.open(row.file_url, '_blank');
  } else {
    message.info(t('merchant.documentsPage.notVerified'));
  }
}

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
      await apiVerifyDocReview({ docId: row.id, action: 'verify' });
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

const RESUB_REASONS = computed(() => [
  { key: 'resubR1', label: t('merchant.documentsPage.resubR1') },
  { key: 'resubR2', label: t('merchant.documentsPage.resubR2') },
  { key: 'resubR3', label: t('merchant.documentsPage.resubR3') },
  { key: 'resubR4', label: t('merchant.documentsPage.resubR4') },
  { key: 'resubR5', label: t('merchant.documentsPage.resubR5') },
  { key: 'resubR6', label: t('merchant.documentsPage.resubR6') },
]);

function openResub(row: TableRow): void {
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
    await apiMerchantDocumentResubmit(resubTarget.value.id, resubReason.value);
    message.success(t('merchant.documentsPage.resubSuccess'));
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
    <div style="font-size: 12px; color: var(--sap-muted, #94a3b8); margin-bottom: 4px">
      {{ t('merchant.documentsPage.subtitle') }}
    </div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px">
      <div>
        <div style="font-size: 18px; font-weight: 700; color: #1a2332">{{ t('merchant.documentsPage.title') }}</div>
        <div style="font-size: 12px; color: #64748b">{{ t('merchant.documentsPage.pageDesc') }}</div>
      </div>
      <a-button type="link" style="color: #1664ff" @click="exportList">
        <template #icon><DownloadOutlined /></template>{{ t('common.export') }}
      </a-button>
    </div>

    <!-- 5 张统计卡(可点击过滤) -->
    <a-row :gutter="12" style="margin-bottom: 16px">
      <a-col v-for="card in STAT_CARDS" :key="card.key" :span="4" :xs="12" :sm="8" :md="4">
        <div
          class="stat-card"
          :class="{ active: activeStat === card.key }"
          style="cursor: pointer; border-radius: 10px; border: 1px solid #e3e8f0; background: #fff; padding: 14px 16px; transition: all 0.2s"
          @click="filterByStat(card.key)"
        >
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px">{{ card.label }}</div>
          <div style="font-size: 22px; font-weight: 700; color: #1a2332">{{ card.value }}</div>
        </div>
      </a-col>
    </a-row>

    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('merchant.documentsPage.keyword')">
          <a-input v-model:value="query.keyword" allow-clear :placeholder="t('merchant.documentsPage.keywordPlaceholder')" style="width: 220px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('merchant.documentsPage.statusLabel')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 170px" @change="search">
            <a-select-option :value="1">{{ t('merchant.verifyPage.docVerified') }}</a-select-option>
            <a-select-option :value="2">{{ t('merchant.verifyPage.docPending') }}</a-select-option>
            <a-select-option :value="3">{{ t('merchant.verifyPage.docRejected') }}</a-select-option>
            <a-select-option :value="4">{{ t('merchant.verifyPage.docExpired') }}</a-select-option>
            <a-select-option :value="5">{{ t('merchant.verifyPage.docResubRequired') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('merchant.documentsPage.docTypeLabel')">
          <a-select v-model:value="query.docType" allow-clear :placeholder="t('common.all')" style="width: 220px" @change="search">
            <a-select-option v-for="tp in DOC_TYPES" :key="tp" :value="tp">{{ docTypeLabel(tp) }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1280 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'merchant_name'">
            <div style="font-weight: 600">{{ record.merchant_name || '-' }}</div>
            <div style="font-size: 11px; color: #94a3b8">#{{ record.merchant_id }}</div>
          </template>
          <template v-else-if="column.dataIndex === 'name'">
            <div>{{ record.name || docTypeLabel(record.doc_type) }}</div>
            <div style="font-size: 11px; color: #94a3b8">{{ record.file_size ? `${record.file_size} · PDF` : 'PDF' }}</div>
          </template>
          <template v-else-if="column.dataIndex === 'doc_type'">{{ docTypeLabel(record.doc_type) }}</template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="DOC_STATUS" />
          </template>
          <template v-else-if="column.dataIndex === 'expiry_date'">
            <span>{{ record.expiry_date || '-' }}</span>
            <a-tag v-if="record.expiring_soon === 1" color="warning" style="margin-left: 4px">
              {{ t('merchant.documentsPage.expiringSoon') }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'last_verified_at'">
            {{ record.last_verified_at || t('merchant.documentsPage.notVerified') }}
          </template>
          <template v-else-if="column.dataIndex === 'reviewer_name'">
            {{ record.reviewer_name || '-' }}
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-tooltip :title="t('merchant.documentsPage.preview')">
                <a-button type="link" size="small" @click="openPreview(record)"><template #icon><EyeOutlined /></template></a-button>
              </a-tooltip>
              <a-tooltip :title="t('merchant.documentsPage.download')">
                <a-button type="link" size="small" @click="downloadDoc(record)"><template #icon><DownloadOutlined /></template></a-button>
              </a-tooltip>
              <a-tooltip :title="t('merchant.documentsPage.history')">
                <a-button type="link" size="small" @click="openHistory(record)"><template #icon><HistoryOutlined /></template></a-button>
              </a-tooltip>
              <a-tooltip :title="t('merchant.documentsPage.verify')">
                <a-button
                  v-if="record.status === 2 || record.status === 4"
                  v-perm="'merchant:verify:doc'"
                  type="link"
                  size="small"
                  style="color: #059669"
                  @click="confirmVerify(record)"
                ><template #icon><SyncOutlined /></template></a-button>
              </a-tooltip>
              <a-tooltip :title="t('merchant.documentsPage.resubmit')">
                <a-button
                  v-if="record.status !== 5"
                  v-perm="'merchant:verify:resubmit'"
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
    </a-card>

    <!-- 文档详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" :width="560" :title="docDetail ? `${docDetail.name || docTypeLabel(docDetail.doc_type)} · ${docDetail.merchant_name}` : ''">
      <a-spin :spinning="drawerLoading">
        <template v-if="docDetail">
          <a-tabs v-model:activeKey="drawerTab">
            <a-tab-pane key="preview" :tab="t('merchant.documentsPage.previewTitle')">
              <a-alert
                v-if="docDetail.status === 1"
                type="success"
                show-icon
                :message="t('merchant.verifyPage.docVerified')"
                style="margin-bottom: 14px"
              />
              <a-alert
                v-else-if="docDetail.status === 2"
                type="warning"
                show-icon
                :message="t('merchant.verifyPage.docPending')"
                style="margin-bottom: 14px"
              />
              <a-alert
                v-else-if="docDetail.status === 3"
                type="error"
                show-icon
                :message="t('merchant.verifyPage.docRejected')"
                :description="docDetail.reject_reason || ''"
                style="margin-bottom: 14px"
              />
              <a-alert
                v-else-if="docDetail.status === 4"
                type="error"
                show-icon
                :message="t('merchant.verifyPage.docExpired')"
                style="margin-bottom: 14px"
              />
              <a-alert
                v-else
                type="info"
                show-icon
                :message="t('merchant.verifyPage.docResubRequired')"
                :description="docDetail.reject_reason || ''"
                style="margin-bottom: 14px"
              />

              <div style="display: flex; align-items: center; gap: 12px; border: 1px solid #e3e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px">
                <div style="width: 40px; height: 48px; border: 1px solid #dbe3ef; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #ef4444; font-weight: 700; font-size: 12px; flex-shrink: 0">PDF</div>
                <div style="flex: 1; min-width: 0">
                  <div style="font-weight: 600; word-break: break-all">{{ docDetail.file_url ? docDetail.file_url.split('/').pop() : docDetail.name }}</div>
                  <div style="font-size: 12px; color: #64748b; margin-top: 2px">
                    {{ t('merchant.documentsPage.fileSize') }} {{ docDetail.file_size || '-' }} · PDF
                  </div>
                </div>
                <a-button v-if="docDetail.file_url" :href="docDetail.file_url" target="_blank" size="small">
                  <template #icon><DownloadOutlined /></template>{{ t('merchant.documentsPage.download') }}
                </a-button>
              </div>

              <a-descriptions :column="1" size="small" bordered>
                <a-descriptions-item :label="t('merchant.documentsPage.documentType')">{{ docTypeLabel(docDetail.doc_type) }}</a-descriptions-item>
                <a-descriptions-item :label="t('merchant.documentsPage.merchant')">{{ docDetail.merchant_name }} (#{{ docDetail.merchant_id }})</a-descriptions-item>
                <a-descriptions-item :label="t('merchant.documentsPage.fileName')">{{ docDetail.file_url ? docDetail.file_url.split('/').pop() : '-' }}</a-descriptions-item>
                <a-descriptions-item :label="t('merchant.documentsPage.uploadedDate')">{{ docDetail.uploaded_at || '-' }}</a-descriptions-item>
                <a-descriptions-item :label="t('merchant.documentsPage.expiryDate')">{{ docDetail.expiry_date || '-' }}</a-descriptions-item>
                <a-descriptions-item :label="t('merchant.documentsPage.lastVerified')">{{ docDetail.last_verified_at || t('merchant.documentsPage.notVerified') }}</a-descriptions-item>
                <a-descriptions-item :label="t('merchant.documentsPage.assignedReviewer')">{{ docDetail.reviewer_name || '-' }}</a-descriptions-item>
              </a-descriptions>
            </a-tab-pane>

            <a-tab-pane key="history" :tab="t('merchant.documentsPage.historyTitle')">
              <div style="font-size: 12px; color: #64748b; margin-bottom: 14px">{{ t('merchant.documentsPage.historyDesc') }}</div>
              <a-timeline>
                <a-timeline-item v-for="(item, idx) in docHistory" :key="idx">
                  <div style="display: flex; align-items: center; gap: 8px">
                    <span style="font-weight: 600">{{ item.action }}</span>
                    <span style="font-size: 11px; color: #94a3b8">{{ item.by }}</span>
                  </div>
                  <div v-if="item.note" style="font-size: 12px; color: #64748b">{{ item.note }}</div>
                  <div style="font-size: 11px; color: #94a3b8">{{ item.date }}</div>
                </a-timeline-item>
              </a-timeline>
            </a-tab-pane>
          </a-tabs>
        </template>
      </a-spin>
    </a-drawer>

    <!-- 要求重交弹窗 -->
    <a-modal
      v-model:open="resubOpen"
      :title="t('merchant.documentsPage.resubModalTitle')"
      :confirm-loading="resubSaving"
      :ok-text="t('merchant.verifyPage.sendNotification')"
      @ok="doResub"
    >
      <p style="margin: 8px 0 12px">
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
.stat-card {
  &:hover {
    border-color: #1664ff;
    box-shadow: 0 2px 8px rgba(22, 100, 255, 0.12);
  }
  &.active {
    border-color: #1664ff;
    background: rgba(22, 100, 255, 0.06);
    box-shadow: 0 2px 8px rgba(22, 100, 255, 0.12);
  }
}
</style>
