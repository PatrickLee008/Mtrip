<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, SyncOutlined, DownloadOutlined, FileTextOutlined, MenuOutlined, DownOutlined, UserOutlined, PaperClipOutlined, ClockCircleOutlined, KeyOutlined, CopyOutlined, MailOutlined, MessageOutlined, BellOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import MerchantVerifyNav from '@/components/MerchantVerifyNav.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { exportCsv } from '@/utils/exportCsv';
import {
  apiVerifyApprove,
  apiVerifyApprovalCredentials,
  apiVerifyDetail,
  apiVerifyDocReview,
  apiVerifyList,
  apiVerifyReject,
  apiVerifyRegenerateCode,
  apiVerifyResubmit,
  apiVerifyResubmitReceived,
  type VerifyApprovalCredentials,
} from '@/api/merchant';

/**
 * 商户验证工作流(Super Admin Portal Phase 1)
 * 4 状态页共用本组件,tab 由路由末段决定:/merchant-verify/{pending|approved|rejected|resubmission}
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const TABS = [
  { key: 'pending', label: 'Pending Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'resubmission', label: 'Resubmission' },
];

function tabFromPath(path: string): string {
  const seg = path.split('/').pop() || 'pending';
  return TABS.some((x) => x.key === seg) ? seg : 'pending';
}
const activeTab = computed(() => tabFromPath(route.path));

/** 页头大标题(原型:Pending Verification / Approved / Rejected / Resubmission) */
const PAGE_TITLE_KEY: Record<string, string> = {
  pending: 'merchant.verifyPage.queuePending',
  approved: 'merchant.verifyPage.queueApproved',
  rejected: 'merchant.verifyPage.queueRejected',
  resubmission: 'merchant.verifyPage.queueResubmission',
};
/** 页头副标题 */
const PAGE_SUBTITLE_KEY: Record<string, string> = {
  pending: 'merchant.verifyPage.pendingSubtitle',
  approved: 'merchant.verifyPage.approvedSubtitle',
  rejected: 'merchant.verifyPage.rejectedSubtitle',
  resubmission: 'merchant.verifyPage.resubmissionSubtitle',
};
const pageTitle = computed(() => t(PAGE_TITLE_KEY[activeTab.value] ?? 'merchant.verifyPage.queuePending'));
const pageSubtitle = computed(() => t(PAGE_SUBTITLE_KEY[activeTab.value] ?? 'merchant.verifyPage.pendingSubtitle'));

/** 导出当前筛选结果 */
async function doExport(): Promise<void> {
  const data = await apiVerifyList({ ...query, page: 1, pageSize: 200 });
  exportCsv(`merchant-verification-${Date.now()}.csv`, [
    { key: 'application_no', label: 'Lead ID' },
    { key: 'merchant_name', label: 'Merchant' },
    { key: 'merchant_short_name', label: 'Business' },
    { key: 'credit_code', label: 'Reg. Number' },
    { key: 'created_at', label: 'Submitted' },
    { key: 'status', label: 'Status' },
    { key: 'audit_by', label: 'Assigned Ops' },
  ], data.list);
}

// merchant_info.status 语义(含 Phase 1 扩展 6=待重新提交)
const VP = (k: string): string => t(`merchant.verifyPage.${k}`);
const DOC_STATUS = computed<Record<number, StatusItem>>(() => ({
  1: { text: t('merchant.verifyPage.docReviewed'), color: 'success' },
  2: { text: t('merchant.verifyPage.docAwaitingReviewStatus'), color: 'warning' },
  3: { text: t('merchant.verifyPage.docRejected'), color: 'error' },
  4: { text: t('merchant.verifyPage.docExpired'), color: 'error' },
  5: { text: t('merchant.verifyPage.docResubRequired'), color: 'processing' },
}));

/** 预置驳回原因(键与后端 VerifyController::REJECT_REASONS 及 merchant.rejectReasons.r{1..9} 对齐) */
const REJECT_REASONS = computed(() =>
  [1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => ({ value, label: t(`merchant.rejectReasons.r${value}`) })),
);

const { loading, list, total, query, load, search, reset, pagination } = useTable(apiVerifyList, {
  tab: activeTab.value,
  keyword: '',
  category: undefined,
  city: '',
});

// 路由切换(不同状态页)→ 同步 tab 并从第一页重查
watch(
  () => route.path,
  () => {
    query.tab = activeTab.value;
    search();
  },
);

const columns = computed(() => [
  { title: VP('colLeadId'), dataIndex: 'application_no', width: 140 },
  { title: VP('colMerchant'), dataIndex: 'merchant_name', width: 220 },
  { title: VP('colBusiness'), dataIndex: 'merchant_short_name', width: 160 },
  { title: VP('colRegNumber'), dataIndex: 'credit_code', width: 150 },
  { title: VP('colSubmitted'), dataIndex: 'created_at', width: 165 },
  { title: VP('colVerifStatus'), dataIndex: 'status', width: 120 },
  { title: VP('colAssignedOps'), dataIndex: 'audit_by', width: 140 },
  { title: t('common.action'), key: 'action_col', width: 150, fixed: 'right' as const },
]);

/** 商户验证状态徽章(对齐原型:采用 status 徽章配色) */
const VERIF_BADGE: Record<number, { text: string; color: string; bg: string; border?: string }> = {
  0: { text: VP('statusPending'), color: '#B54708', bg: '#FFFBEB', border: '#FDE68A' },
  2: { text: VP('statusRejected'), color: '#C01048', bg: '#FFF1F3', border: '#FECDD3' },
  3: { text: VP('statusApproved'), color: '#027A48', bg: '#ECFDF3', border: '#A7F3D0' },
  4: { text: VP('statusSuspended'), color: '#C01048', bg: '#FFF1F3', border: '#FECDD3' },
  5: { text: VP('statusClosed'), color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0' },
  6: { text: VP('statusResubmission'), color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
};


// ---------- 详情抽屉 ----------
const drawerOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);
const documents = ref<TableRow[]>([]);
const timeline = ref<TableRow[]>([]);
const businesses = ref<TableRow[]>([]);
const kycSubmission = ref<{ method: string; submitted_by: string; confirmation: string; confirmed_at?: string | null } | null>(null);
type ResubmissionInfo = { requested_by: string; requested_at: string; note: string; total: number; resubmitted: number };
const resubmission = ref<ResubmissionInfo | null>(null);
type AccessGrant = { access_code: string; generated_at?: string | null; generated_by: string; delivery_status: string; channels: string[] };
const accessGrant = ref<AccessGrant | null>(null);

// ---------- 注册商家表格(原型:点击切换,联动下方该商家的上传文件) ----------
const BUSINESS_TYPES = computed(() => [
  { value: 'hotel', label: '🏨 ' + t('merchant.onboardingPage.bizHotel') },
  { value: 'restaurant', label: '🍽️ ' + t('merchant.onboardingPage.bizRestaurant') },
  { value: 'airline', label: '✈️ ' + t('merchant.onboardingPage.bizAirline') },
  { value: 'car_rental', label: '🚗 ' + t('merchant.onboardingPage.bizCarRental') },
  { value: 'attraction', label: '🎯 ' + t('merchant.onboardingPage.bizAttraction') },
]);
const BIZ_TYPE_EMOJI: Record<string, string> = { hotel: '🏨', restaurant: '🍽️', airline: '✈️', car_rental: '🚗', attraction: '🎯' };
function bizTypeText(type: string): string {
  const hit = BUSINESS_TYPES.value.find((o) => o.value === type);
  return hit ? hit.label.replace(/^\S+\s/u, '') : type || '-';
}
const RB_KYC_BADGE = computed<Record<number, { text: string; bg: string; color: string; border: string }>>(() => ({
  0: { text: t('merchant.onboardingPage.kycTodo'), bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
  1: { text: t('merchant.onboardingPage.kycVerified'), bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  2: { text: t('merchant.onboardingPage.kycPending'), bg: '#fffbeb', color: '#b54708', border: '#fde68a' },
  3: { text: t('merchant.onboardingPage.kycUnderReview'), bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  4: { text: t('merchant.onboardingPage.kycRejected'), bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
}));
const verifyBizId = ref(0);
const openBizId = ref(0);
const verifyCurrentBiz = computed<TableRow | null>(() => businesses.value.find((b) => b.id === verifyBizId.value) ?? null);
const verifyBusinessTypes = computed(() =>
  [...new Set(businesses.value.map((biz) => bizTypeText(String(biz.business_type ?? ''))).filter((type) => type !== '-'))].join(', ') || '-',
);
/** 当前选中商家的上传文件(按 biz_unit 过滤) */
const verifyDocs = computed<TableRow[]>(() => {
  const bizId = String(verifyBizId.value || '');
  if (!bizId) return documents.value;
  return documents.value.filter((d) => String((d as TableRow).biz_unit || '') === bizId);
});
type VerifyDocumentRow = {
  key: string;
  doc_type: string;
  required_name: string;
  required: boolean;
  upload: TableRow | null;
};
type ResubmissionDocumentRow = VerifyDocumentRow & {
  upload: TableRow;
  revision: TableRow | null;
};
/**
 * 以商家绑定的 KYC 模板为基准生成文件清单，并合并同 biz_unit 下实际上传记录。
 * 模板外的历史上传记录也保留在列表中，避免审核资料被隐藏。
 */
const verifyRequiredDocs = computed<VerifyDocumentRow[]>(() => {
  const uploadsByType = new Map(
    verifyDocs.value
      .filter((doc) => Boolean(doc.file_url))
      .map((doc) => [String(doc.doc_type || ''), doc]),
  );
  const templateDocs = Array.isArray(verifyCurrentBiz.value?.kyc_template_docs)
    ? verifyCurrentBiz.value.kyc_template_docs as { name?: string; doc_type?: string; required?: boolean }[]
    : [];
  const rows = templateDocs
    .filter((doc) => doc.doc_type)
    .map((doc) => ({
      key: String(doc.doc_type),
      doc_type: String(doc.doc_type),
      required_name: String(doc.name || doc.doc_type),
      required: doc.required !== false,
      upload: uploadsByType.get(String(doc.doc_type)) ?? null,
    }));
  const knownTypes = new Set(rows.map((doc) => doc.doc_type));
  verifyDocs.value.forEach((doc) => {
    const docType = String(doc.doc_type || '');
    if (docType && !knownTypes.has(docType)) {
      rows.push({ key: `uploaded-${doc.id}`, doc_type: docType, required_name: String(doc.doc_type), required: false, upload: doc });
    }
  });
  return rows;
});
const requiredDocumentRows = computed(() => verifyRequiredDocs.value.filter((doc) => doc.required));
function latestSubmittedRevision(upload: TableRow): TableRow | null {
  const revisions = Array.isArray(upload.revisions) ? upload.revisions as TableRow[] : [];
  return revisions.find((revision) => Boolean(revision.file_url)) ?? null;
}
const resubmissionDocumentRows = computed<ResubmissionDocumentRow[]>(() => {
  const rows: ResubmissionDocumentRow[] = [];
  for (const doc of verifyRequiredDocs.value) {
    if (!doc.upload) continue;
    const revisions = Array.isArray(doc.upload.revisions) ? doc.upload.revisions as TableRow[] : [];
    if (Number(doc.upload.status) !== 5 && revisions.length === 0 && Number(doc.upload.was_rejected) !== 1) continue;
    rows.push({ ...doc, upload: doc.upload, revision: latestSubmittedRevision(doc.upload) });
  }
  return rows;
});
function toggleVerifyBiz(biz: TableRow): void {
  verifyBizId.value = biz.id;
  openBizId.value = openBizId.value === biz.id ? 0 : biz.id;
}

/** 已审核文档数(status 1 核验通过 / 3 已驳回 视为已给出决定) */
const reviewedCount = computed(() =>
  requiredDocumentRows.value.filter((doc) => doc.upload && [1, 3].includes(Number(doc.upload.status))).length,
);
/** 最终核实决定副标题(对齐原型:已审核 N/M 份文件 — 请审核所有文件 / 全部通过 / 有驳回) */
const finalDecisionSubtitle = computed(() => {
  const rejected = requiredDocumentRows.value.filter((doc) => Number(doc.upload?.status) === 3).length;
  const total = requiredDocumentRows.value.length;
  const allApproved = total > 0 && reviewedCount.value === total && rejected === 0;
  if (allApproved) return t('merchant.verifyPage.finalDecisionApproved');
  if (rejected > 0) return t('merchant.verifyPage.finalDecisionRejected', { n: rejected });
  return t('merchant.verifyPage.finalDecisionPending', { n: reviewedCount.value, total });
});

async function openDetail(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  detailLoading.value = true;
  try {
    const data = await apiVerifyDetail(row.id);
    detail.value = data.merchant;
    documents.value = data.documents;
    businesses.value = data.businesses || [];
    timeline.value = data.timeline;
    kycSubmission.value = data.kyc_submission ?? null;
    resubmission.value = data.resubmission ?? null;
    accessGrant.value = data.access_grant ?? null;
    // 默认选中第一个注册商家(biz 为空则 0 → 显示全部文档)
    verifyBizId.value = businesses.value[0]?.id ?? 0;
    openBizId.value = 0;
  } finally {
    detailLoading.value = false;
  }
}

const docColumns = computed(() => [
  { title: VP('colDoc'), dataIndex: 'required_name', width: 250, ellipsis: true },
  { title: VP('colDocStatus'), dataIndex: 'status', width: 125 },
  { title: VP('colDocUploaded'), dataIndex: 'uploaded_at', width: 105 },
  { title: t('common.action'), key: 'doc_action', width: 220 },
]);
function formatUploadDate(value: unknown): string {
  return value ? String(value).slice(0, 10) : '-';
}
function documentFileName(doc: TableRow | null): string {
  if (!doc) return '-';
  if (doc.file_name || doc.name) return String(doc.file_name || doc.name);
  const path = String(doc.file_url || '').split('?')[0];
  const name = path.split('/').pop();
  return name ? decodeURIComponent(name) : '-';
}

// ---------- 审核动作 ----------
const actionTarget = ref<TableRow | null>(null);

const approveOpen = ref(false);
const approveRemark = ref('');
const approveSaving = ref(false);
const approvePreparing = ref(false);
const approveCredentials = ref<VerifyApprovalCredentials | null>(null);
const approveTargetDetail = ref<TableRow | null>(null);
const approveChannels = ref<string[]>(['email', 'sms', 'inapp']);
function isApprovalReady(data: Awaited<ReturnType<typeof apiVerifyDetail>>): boolean {
  const registered = data.businesses || [];
  if (registered.length > 0) return registered.every((business) => Number(business.kyc_status) === 1);
  return data.documents.length > 0 && data.documents.every((doc) => Number(doc.status) === 1);
}
async function openApprove(row: TableRow): Promise<void> {
  approvePreparing.value = true;
  try {
    const approvalDetail = await apiVerifyDetail(row.id);
    if (!isApprovalReady(approvalDetail)) {
      message.warning(t('merchant.verifyPage.approveRequirementsPending'));
      return;
    }
    actionTarget.value = row;
    approveTargetDetail.value = approvalDetail.merchant;
    approveCredentials.value = await apiVerifyApprovalCredentials(row.id);
    approveRemark.value = '';
    approveChannels.value = ['email', 'sms', 'inapp'];
    approveOpen.value = true;
  } finally {
    approvePreparing.value = false;
  }
}
async function doApprove(): Promise<void> {
  if (!actionTarget.value || !approveCredentials.value) return;
  if (approveChannels.value.length === 0) {
    message.warning(t('merchant.verifyPage.approveChannelRequired'));
    return;
  }
  approveSaving.value = true;
  try {
    await apiVerifyApprove({
      id: actionTarget.value.id,
      remark: approveRemark.value,
      channels: approveChannels.value,
      accessCode: approveCredentials.value.access_code,
      oneTimePassword: approveCredentials.value.one_time_password,
    });
    approveOpen.value = false;
    message.success(t('merchant.verifyPage.approveSuccess'));
    await openDetail(actionTarget.value);
    await load();
  } finally {
    approveSaving.value = false;
  }
}

async function copyCredential(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
  message.success(t('merchant.verifyPage.credentialCopied'));
}

const regenerateSaving = ref(false);
async function regenerateAccessCode(): Promise<void> {
  if (!detail.value) return;
  regenerateSaving.value = true;
  try {
    await apiVerifyRegenerateCode(detail.value.id);
    message.success(t('merchant.verifyPage.accessCodeRegenerated'));
    await refreshDocs();
  } finally {
    regenerateSaving.value = false;
  }
}

function deliveryChannelLabel(channel: string): string {
  const key: Record<string, string> = {
    email: 'approveChannelEmail',
    sms: 'approveChannelSms',
    inapp: 'approveChannelInapp',
  };
  return key[channel] ? t(`merchant.verifyPage.${key[channel]}`) : channel;
}

const rejectOpen = ref(false);
const rejectReasonCode = ref<number | undefined>(undefined);
const rejectNote = ref('');
const rejectSaving = ref(false);
function openReject(row: TableRow): void {
  actionTarget.value = row;
  rejectReasonCode.value = undefined;
  rejectNote.value = '';
  rejectOpen.value = true;
}
async function doReject(): Promise<void> {
  if (!actionTarget.value) return;
  if (!rejectReasonCode.value) {
    message.warning(t('merchant.verifyPage.rejectRequiredWarn'));
    return;
  }
  rejectSaving.value = true;
  try {
    await apiVerifyReject(actionTarget.value.id, rejectReasonCode.value, rejectNote.value.trim() || undefined);
    message.success(t('merchant.verifyPage.rejectSuccess'));
    rejectOpen.value = false;
    drawerOpen.value = false;
    await router.push('/merchant-verify/rejected');
  } finally {
    rejectSaving.value = false;
  }
}

const resubOpen = ref(false);
const resubComment = ref('');
const resubSaving = ref(false);
function openResub(row: TableRow): void {
  actionTarget.value = row;
  resubComment.value = '';
  resubOpen.value = true;
}
async function doResub(): Promise<void> {
  if (!actionTarget.value) return;
  if (!resubComment.value.trim()) {
    message.warning(t('merchant.verifyPage.resubRequiredWarn'));
    return;
  }
  resubSaving.value = true;
  try {
    await apiVerifyResubmit(actionTarget.value.id, resubComment.value);
    message.success(t('merchant.verifyPage.resubSuccess'));
    resubOpen.value = false;
    drawerOpen.value = false;
    await load();
  } finally {
    resubSaving.value = false;
  }
}

/** 确认商户已重新提交文件(重新提交 → 待验证闭环) */
const resubReceivedSaving = ref(false);
async function markResubmitted(row: TableRow): Promise<void> {
  resubReceivedSaving.value = true;
  try {
    await apiVerifyResubmitReceived(row.id);
    message.success(t('merchant.verifyPage.resubReceivedSuccess'));
    drawerOpen.value = false;
    await load();
  } finally {
    resubReceivedSaving.value = false;
  }
}

// ---------- 文档核验 ----------
async function verifyDoc(row: TableRow): Promise<void> {
  await apiVerifyDocReview({ docId: row.id, action: 'verify' });
  message.success(t('merchant.verifyPage.docVerifySuccess'));
  await refreshDocs();
}
const docRejectOpen = ref(false);
const docRejectReason = ref('');
const docRejectSaving = ref(false);
const docTarget = ref<TableRow | null>(null);
function openDocReject(row: TableRow): void {
  docTarget.value = row;
  docRejectReason.value = '';
  docRejectOpen.value = true;
}
async function doDocReject(): Promise<void> {
  if (!docTarget.value) return;
  if (!docRejectReason.value.trim()) {
    message.warning(t('merchant.verifyPage.docRejectRequiredWarn'));
    return;
  }
  docRejectSaving.value = true;
  try {
    await apiVerifyDocReview({ docId: docTarget.value.id, action: 'reject', reason: docRejectReason.value });
    message.success(t('merchant.verifyPage.docRejectSuccess'));
    docRejectOpen.value = false;
    await refreshDocs();
  } finally {
    docRejectSaving.value = false;
  }
}
async function refreshDocs(): Promise<void> {
  if (!detail.value) return;
  const data = await apiVerifyDetail(detail.value.id);
  detail.value = data.merchant;
  documents.value = data.documents;
  businesses.value = data.businesses || [];
  timeline.value = data.timeline;
  kycSubmission.value = data.kyc_submission ?? null;
  resubmission.value = data.resubmission ?? null;
  accessGrant.value = data.access_grant ?? null;
}

const canAct = computed(() => activeTab.value === 'pending' || activeTab.value === 'resubmission');

onMounted(() => {
  query.tab = activeTab.value;
  void load();
});
</script>

<template>
  <PageContainer>
    <!-- 页头(严格对齐原型:小标题 uppercase 11/500/#94A3B8 + 大标题 18/700/#1A2332 + 副标题 13/#94A3B8;在卡片导航上方) -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin: 0 0 16px">
      <div>
        <div style="font-size: 11px; color: #94a3b8; font-weight: 500; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em">{{ t('merchant.verifyPage.pageKicker') }}</div>
        <h1 class="verify-page-title" style="font-size: 18px; font-weight: 700; color: #1a2332">{{ pageTitle }}</h1>
        <p style="font-size: 13px; color: #94a3b8; margin-top: 2px">{{ pageSubtitle }}</p>
      </div>
      <a-button class="verify-export-btn" @click="doExport"><template #icon><DownloadOutlined /></template>{{ t('merchant.verifyPage.exportCsv') }}</a-button>
    </div>

    <MerchantVerifyNav :key="activeTab" :active="activeTab" />

    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('merchant.verifyPage.keywordLabel')">
          <a-input v-model:value="query.keyword" allow-clear :placeholder="t('merchant.verifyPage.keywordPlaceholder')" style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('merchant.verifyPage.colCountry')">
          <a-select v-model:value="query.city" allow-clear :placeholder="t('common.all')" style="width: 140px">
            <a-select-option value="中国">中国</a-select-option>
            <a-select-option value="缅甸">缅甸</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
        <div style="margin-left: auto; align-self: center; font-size: 12px; color: #64748b">{{ t('merchant.verifyPage.resultCount', { total: total }) }}</div>
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
        :scroll="{ x: 1260 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'application_no'">
            <span style="font-weight: 500; font-family: monospace; color: #2563eb">{{ record.application_no || '-' }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'merchant_name'">
            <div style="font-weight: 600">{{ record.merchant_name }}</div>
            <div style="font-size: 11px; color: var(--sap-muted)">{{ record.address || '-' }}</div>
          </template>
          <template v-else-if="column.dataIndex === 'merchant_short_name'">
            <span style="display: inline-block; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom">{{ record.merchant_short_name || '-' }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'credit_code'">
            <span style="font-family: monospace; font-size: 12px">{{ record.credit_code ? String(record.credit_code).slice(0, 12) + (String(record.credit_code).length > 12 ? '…' : '') : '-' }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'created_at'">
            <span style="font-family: monospace; font-size: 12px; color: #475569">{{ record.created_at || '-' }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <span v-if="VERIF_BADGE[record.status]" class="verify-badge" :style="{ color: VERIF_BADGE[record.status].color, background: VERIF_BADGE[record.status].bg, borderColor: VERIF_BADGE[record.status].border || 'transparent' }">
              {{ VERIF_BADGE[record.status].text }}
            </span>
            <span v-else>{{ record.status }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'audit_by'">
            <span :style="record.audit_by ? undefined : 'color: var(--sap-muted)'">{{ record.audit_by || t('merchant.verifyPage.unassigned') }}</span>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-tooltip :title="t('common.detail')">
                <a-button type="link" size="small" @click="openDetail(record)"><EyeOutlined /></a-button>
              </a-tooltip>
              <template v-if="canAct">
                <a-tooltip :title="t('merchant.verifyPage.btnApprove')">
                <a-button v-perm="'merchant:verify:approve'" type="link" size="small" style="color: #059669" :loading="approvePreparing" @click="openApprove(record)"><CheckCircleOutlined /></a-button>
                </a-tooltip>
                <a-tooltip :title="t('merchant.verifyPage.btnReject')">
                  <a-button v-perm="'merchant:verify:reject'" type="link" size="small" style="color: #c01048" @click="openReject(record)"><CloseCircleOutlined /></a-button>
                </a-tooltip>
                <a-tooltip :title="t('merchant.verifyPage.btnResubmit')">
                  <a-button v-if="activeTab === 'pending'" v-perm="'merchant:verify:resubmit'" type="link" size="small" style="color: #d97706" @click="openResub(record)"><SyncOutlined /></a-button>
                </a-tooltip>
                <a-tooltip :title="t('merchant.verifyPage.footerConfirmResubmission')">
                  <a-button v-if="activeTab === 'resubmission'" v-perm="'merchant:verify:resubmit'" type="link" size="small" style="color: #d97706" :loading="resubReceivedSaving" @click="markResubmitted(record)"><SyncOutlined /></a-button>
                </a-tooltip>
              </template>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 验证详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" :width="760" :class="{ 'resubmission-drawer': activeTab === 'resubmission' }">
      <template #title>
        <div class="verify-drawer-title">
          <div>{{ t('merchant.verifyPage.drawerTitle') }}</div>
          <span v-if="detail">{{ detail.application_no || detail.merchant_code || '-' }} · {{ detail.merchant_name }}</span>
        </div>
      </template>
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <div v-if="activeTab === 'resubmission' && resubmission" class="resub-request-card">
            <div class="resub-request-card__head">
              <span class="resub-request-card__icon"><SyncOutlined /></span>
              <div class="resub-request-card__heading">
                <strong>{{ t('merchant.verifyPage.resubRequestTitle') }}</strong>
                <span>{{ t('merchant.verifyPage.resubRequestSubtitle') }}</span>
              </div>
              <span class="resub-request-card__progress">{{ t('merchant.verifyPage.resubProgress', { done: resubmission.resubmitted, total: resubmission.total }) }}</span>
            </div>
            <div class="resub-request-card__stats">
              <div><span>{{ t('merchant.verifyPage.resubRequester') }}</span><strong>{{ resubmission.requested_by || '-' }}</strong></div>
              <div><span>{{ t('merchant.verifyPage.resubRequestDate') }}</span><strong>{{ formatUploadDate(resubmission.requested_at) }}</strong></div>
              <div><span>{{ t('merchant.verifyPage.resubmittedFiles') }}</span><strong>{{ resubmission.resubmitted }}/{{ resubmission.total }}</strong></div>
            </div>
            <div class="resub-request-card__reason"><strong>{{ t('merchant.verifyPage.resubReason') }}：</strong>{{ resubmission.note || '-' }}</div>
          </div>

          <div v-if="activeTab !== 'resubmission'" class="fd-review-mode vd-review-mode">
            <div class="fd-review-mode__title">{{ t('merchant.verifyPage.reviewModeTitle') }}</div>
            <div class="fd-review-mode__desc">{{ t('merchant.verifyPage.reviewModeDesc') }}</div>
          </div>

          <!-- §1 公司信息(原型 2×2 + 3 列信息网格) -->
          <div class="co-section-heading">
            <UserOutlined class="co-heading-icon" />
            <h4 class="co-heading-text">{{ t('merchant.verifyPage.companyInfo') }}</h4>
            <div class="co-heading-line" />
          </div>
          <div class="verify-info-stack">
            <div class="verify-info-grid verify-info-grid--2">
              <div class="verify-info-cell"><span>{{ t('merchant.verifyPage.detailCompanyName') }}</span><strong>{{ detail.merchant_short_name || detail.merchant_name }}</strong></div>
              <div class="verify-info-cell"><span>{{ t('merchant.verifyPage.detailCreditCode') }}</span><strong>{{ detail.credit_code || '-' }}</strong></div>
              <div class="verify-info-cell"><span>{{ t('merchant.verifyPage.detailCountry') }}</span><strong>{{ detail.country || '-' }}</strong></div>
              <div class="verify-info-cell"><span>{{ t('merchant.verifyPage.colSubmitted') }}</span><strong>{{ formatUploadDate(detail.application_submitted_at || detail.created_at) }}</strong></div>
            </div>
            <div class="verify-info-grid verify-info-grid--3">
              <div class="verify-info-cell"><span>{{ t('merchant.verifyPage.detailBusinessCount') }}</span><strong>{{ businesses.length }}</strong></div>
              <div class="verify-info-cell"><span>{{ t('merchant.verifyPage.detailBusinessTypes') }}</span><strong>{{ verifyBusinessTypes }}</strong></div>
              <div class="verify-info-cell"><span>{{ t('merchant.verifyPage.detailMerchantId') }}</span><strong>{{ detail.merchant_code || '-' }}</strong></div>
            </div>
          </div>

          <!-- §3 注册商家(原型:表格,点击行切换,联动下方该商家的上传文件) -->
          <div class="co-section-heading">
            <MenuOutlined class="co-heading-icon" />
            <h4 class="co-heading-text">{{ t('merchant.onboardingPage.registeredBusinesses') }} ({{ businesses.length }})</h4>
            <div class="co-heading-line" />
          </div>
          <div v-if="businesses.length" class="rb-table">
            <div class="rb-head">
              <span class="rb-th rb-c-index">#</span>
              <span class="rb-th rb-c-name">{{ t('merchant.verifyPage.colBizName') }}</span>
              <span class="rb-th rb-c-type">{{ t('merchant.onboardingPage.bizDetailBusinessType') }}</span>
              <span class="rb-th rb-c-city">{{ t('merchant.onboardingPage.bizColCity') }}</span>
              <span class="rb-th rb-c-kyc">{{ t('merchant.onboardingPage.bizColKyc') }}</span>
              <span class="rb-th rb-c-exp" />
            </div>
            <template v-for="(biz, idx) in businesses" :key="biz.id">
            <div
              class="rb-row"
              :class="{ 'is-open': openBizId === biz.id, 'is-selected': verifyBizId === biz.id }"
              @click="toggleVerifyBiz(biz)"
            >
              <span class="rb-td rb-c-index">{{ idx + 1 }}</span>
              <span class="rb-td rb-c-name">
                <span class="rb-emoji">{{ BIZ_TYPE_EMOJI[biz.business_type] || '🏢' }}</span>
                <span class="rb-name">{{ biz.business_name || '-' }}</span>
              </span>
              <span class="rb-td rb-c-type">{{ bizTypeText(biz.business_type) || '-' }}</span>
              <span class="rb-td rb-c-city">{{ biz.city || '-' }}</span>
              <span class="rb-td rb-c-kyc">
                <span
                  v-if="RB_KYC_BADGE[biz.kyc_status]"
                  class="rb-badge"
                  :style="{ background: RB_KYC_BADGE[biz.kyc_status].bg, color: RB_KYC_BADGE[biz.kyc_status].color, borderColor: RB_KYC_BADGE[biz.kyc_status].border }"
                >{{ RB_KYC_BADGE[biz.kyc_status].text }}</span>
                <span v-else>-</span>
              </span>
              <span class="rb-td rb-c-exp">
                <DownOutlined class="rb-chevron" :class="{ 'is-open': openBizId === biz.id }" />
              </span>
            </div>
            <div v-if="openBizId === biz.id" class="rb-expand">
              <div class="rb-expand-title">{{ t('merchant.onboardingPage.bizSubmittedDetails') }}</div>
              <div class="co-grid co-grid--3col">
                <div class="co-cell">
                  <div class="co-cell-label">{{ t('merchant.onboardingPage.bizDetailBusinessType') }}</div>
                  <div class="co-cell-value">{{ bizTypeText(biz.business_type) || '-' }}</div>
                </div>
                <div class="co-cell">
                  <div class="co-cell-label">{{ t('merchant.onboardingPage.bizContact') }}</div>
                  <div class="co-cell-value">{{ biz.contact_name || '-' }}</div>
                </div>
                <div class="co-cell">
                  <div class="co-cell-label">{{ t('merchant.onboardingPage.bizColCity') }}</div>
                  <div class="co-cell-value">{{ biz.city || '-' }}</div>
                </div>
                <div class="co-cell">
                  <div class="co-cell-label">{{ t('merchant.onboardingPage.bizPhone') }}</div>
                  <div class="co-cell-value">{{ biz.contact_phone || '-' }}</div>
                </div>
                <div class="co-cell">
                  <div class="co-cell-label">{{ t('merchant.onboardingPage.bizEmail') }}</div>
                  <div class="co-cell-value">{{ biz.contact_email || '-' }}</div>
                </div>
              </div>
            </div>
            </template>
          </div>
          <a-empty v-else :description="t('merchant.verifyPage.noRegisteredBusiness')" :image="undefined" style="margin: 12px 0" />

          <template v-if="activeTab === 'resubmission'">
            <div class="co-section-heading">
              <PaperClipOutlined class="co-heading-icon" />
              <h4 class="co-heading-text">{{ t('merchant.verifyPage.resubmittedFiles') }}</h4>
              <div class="co-heading-line" />
            </div>
            <div v-if="verifyCurrentBiz" class="resub-selected-business">
              <span class="resub-selected-business__emoji">{{ BIZ_TYPE_EMOJI[verifyCurrentBiz.business_type] || '🏢' }}</span>
              <div><strong>{{ verifyCurrentBiz.business_name || '-' }}</strong><span>{{ t('merchant.verifyPage.resubSelectBusiness') }}</span></div>
            </div>

            <div v-for="item in resubmissionDocumentRows" :key="item.key" class="resub-document-card">
              <div class="resub-document-card__title"><FileTextOutlined />{{ item.required_name }}</div>
              <div class="resub-document-card__compare">
                <div class="resub-document-card__original">
                  <span class="resub-status resub-status--rejected"><CloseCircleOutlined />{{ t('merchant.verifyPage.resubOriginalRejected') }}</span>
                  <a v-if="item.upload.file_url" class="resub-file resub-file--original" :href="item.upload.file_url" target="_blank">
                    <FileTextOutlined />
                    <span><strong>{{ documentFileName(item.upload) }}</strong><small>{{ t('merchant.verifyPage.colDocUploaded') }}：{{ formatUploadDate(item.upload.uploaded_at) }}</small></span>
                  </a>
                  <div class="resub-reason-box">
                    <strong>{{ t('merchant.verifyPage.resubRejectReason') }}</strong>
                    <span>{{ item.upload.reject_reason || resubmission?.note || '-' }}</span>
                    <small>{{ t('merchant.verifyPage.resubAuthor', { name: item.upload.reviewer_name || resubmission?.requested_by || '-', date: formatUploadDate(item.upload.last_verified_at || item.upload.resubmit_required_at || item.upload.updated_at || resubmission?.requested_at) }) }}</small>
                  </div>
                </div>
                <div class="resub-document-card__replacement">
                  <template v-if="item.revision">
                    <span class="resub-status resub-status--review"><SyncOutlined />{{ t('merchant.verifyPage.resubNewAwaitingReview') }}</span>
                    <a class="resub-file resub-file--replacement" :href="item.revision.file_url" target="_blank">
                      <FileTextOutlined />
                      <span><strong>{{ documentFileName(item.revision) }}</strong><small>{{ t('merchant.verifyPage.colDocUploaded') }}：{{ formatUploadDate(item.revision.uploaded_at) }}</small></span>
                    </a>
                    <div class="resub-document-card__actions">
                      <a-button class="verify-doc-action verify-doc-action--preview" size="small" :href="item.revision.file_url" target="_blank"><template #icon><EyeOutlined /></template>{{ t('merchant.verifyPage.docActionView') }}</a-button>
                      <a-button v-perm="'merchant:verify:doc'" class="verify-doc-action verify-doc-action--approve" size="small" :disabled="item.upload.status === 1" @click="verifyDoc(item.upload)"><template #icon><CheckCircleOutlined /></template>{{ t('merchant.verifyPage.docActionApprove') }}</a-button>
                      <a-button v-perm="'merchant:verify:doc'" class="verify-doc-action verify-doc-action--reject" size="small" :disabled="item.upload.status === 3" @click="openDocReject(item.upload)"><template #icon><CloseCircleOutlined /></template>{{ t('merchant.verifyPage.docActionReject') }}</a-button>
                    </div>
                  </template>
                  <template v-else>
                    <span class="resub-status resub-status--waiting"><SyncOutlined />{{ t('merchant.verifyPage.resubWaitingReply') }}</span>
                    <div class="resub-file resub-file--waiting"><ClockCircleOutlined />{{ t('merchant.verifyPage.resubMerchantPending') }}</div>
                  </template>
                </div>
              </div>
            </div>
            <a-empty v-if="!resubmissionDocumentRows.length" :description="t('merchant.verifyPage.resubNoFiles')" :image="undefined" style="margin: 16px 0" />
          </template>

          <template v-if="activeTab !== 'resubmission'">
          <!-- §3 KYC 提交详情 -->
          <div v-if="kycSubmission" class="co-section-heading">
            <h4 class="co-heading-text">{{ t('merchant.verifyPage.kycSubmissionDetails') }}</h4>
            <div class="co-heading-line" />
          </div>
          <div v-if="kycSubmission" class="verify-submission-grid">
            <div><span>{{ t('merchant.verifyPage.kycMethod') }}</span><strong>{{ kycSubmission.method }}</strong></div>
            <div><span>{{ t('merchant.verifyPage.kycSubmittedBy') }}</span><strong>{{ kycSubmission.submitted_by }}</strong></div>
            <div><span>{{ t('merchant.verifyPage.kycConfirmation') }}</span><strong>{{ kycSubmission.confirmation }}</strong></div>
          </div>

          <!-- §4 上传文件(按所选商家展示) -->
          <div class="co-section-heading">
            <h4 class="co-heading-text">{{ t('merchant.verifyPage.docHeader') }}<template v-if="verifyCurrentBiz"> · {{ verifyCurrentBiz.business_name }}</template></h4>
            <div class="co-heading-line" />
          </div>
          <a-table :columns="docColumns" :data-source="verifyRequiredDocs" row-key="key" size="small" table-layout="fixed" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'required_name'">
                <div class="verify-document-name">
                  <span class="verify-document-icon"><FileTextOutlined /></span>
                  <span><strong>{{ record.required_name }}</strong><small>{{ record.doc_type }}</small></span>
                </div>
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <template v-if="record.upload">
                  <div><StatusTag :value="record.upload.status" :map="DOC_STATUS" /></div>
                  <div v-if="record.upload.status === 2" class="verify-doc-awaiting">{{ t('merchant.verifyPage.docAwaitingReview') }}</div>
                </template>
                <span v-else class="verify-doc-missing">{{ t('merchant.verifyPage.docNotUploaded') }}</span>
              </template>
              <template v-else-if="column.dataIndex === 'uploaded_at'">{{ formatUploadDate(record.upload?.uploaded_at) }}</template>
              <template v-else-if="column.key === 'doc_action'">
                <a-space :size="4">
                  <a-button class="verify-doc-action verify-doc-action--preview" size="small" :disabled="!record.upload?.file_url" :href="record.upload?.file_url" target="_blank"><template #icon><EyeOutlined /></template>{{ t('merchant.verifyPage.docActionPreview') }}</a-button>
                  <a-button v-perm="'merchant:verify:doc'" class="verify-doc-action verify-doc-action--approve" size="small" :disabled="!record.upload || record.upload.status === 1" @click="record.upload && verifyDoc(record.upload)"><template #icon><CheckCircleOutlined /></template>{{ t('merchant.verifyPage.docActionApprove') }}</a-button>
                  <a-button v-perm="'merchant:verify:doc'" class="verify-doc-action verify-doc-action--reject" size="small" :disabled="!record.upload || record.upload.status === 3" @click="record.upload && openDocReject(record.upload)"><template #icon><CloseCircleOutlined /></template>{{ t('merchant.verifyPage.docActionReject') }}</a-button>
                </a-space>
              </template>
            </template>
          </a-table>
          <a-empty v-if="!verifyRequiredDocs.length" :description="t('merchant.verifyPage.emptyNoDocs')" :image="undefined" style="margin: 12px 0" />

          <!-- 最终核实决定(原型:摘要在内容区,操作固定于抽屉底部) -->
          <div class="fd-card">
            <div class="fd-head">
              <span class="fd-title">{{ t('merchant.verifyPage.finalDecision') }}</span>
              <span class="fd-subtitle">{{ finalDecisionSubtitle }}</span>
            </div>
            <span class="fd-count">{{ reviewedCount }}/{{ requiredDocumentRows.length }}</span>
          </div>

          <!-- §4 时间线(原型样式) -->
          <div class="co-section-heading">
            <h4 class="co-heading-text">{{ t('merchant.verifyPage.timelineHeader') }}</h4>
            <div class="co-heading-line" />
          </div>
          <div v-if="timeline.length" class="onb-tl">
            <div v-for="ev in timeline" :key="ev.id" class="onb-tl-item">
              <div class="onb-tl-dot" :style="ev.is_exception === 1 ? 'background:#dc2626;box-shadow:0 0 0 2px #dc2626' : 'background:#1664ff;box-shadow:0 0 0 2px #1664ff'" />
              <div class="onb-tl-row">
                <span class="onb-tl-date">{{ String(ev.created_at || '').slice(0, 10) }}</span>
                <span class="onb-tl-tag" :style="ev.is_exception === 1 ? 'color:#dc2626;background:#dc262615' : 'color:#1664ff;background:#1664ff15'">{{ ev.operator_name || t('merchant.verifyPage.timelineSystem') }}</span>
              </div>
              <div class="onb-tl-action">{{ ev.note || ev.action }}</div>
              <div class="onb-tl-by">by {{ ev.operator_name || t('merchant.verifyPage.timelineSystem') }} · {{ ev.created_at }}</div>
            </div>
          </div>
          <a-empty v-if="!timeline.length" :description="t('merchant.verifyPage.emptyNoTimeline')" :image="undefined" style="margin: 12px 0" />

          <template v-if="accessGrant">
            <div class="co-section-heading merchant-access-heading">
              <KeyOutlined class="co-heading-icon" />
              <h4 class="co-heading-text">{{ t('merchant.verifyPage.accessPermissionTitle') }}</h4>
              <div class="co-heading-line" />
            </div>
            <div class="merchant-access-code-row">
              <div class="merchant-access-code"><KeyOutlined /><strong>{{ accessGrant.access_code }}</strong></div>
              <a-button @click="copyCredential(accessGrant.access_code)"><template #icon><CopyOutlined /></template>{{ t('merchant.verifyPage.credentialCopy') }}</a-button>
              <a-button v-perm="'merchant:verify:regencode'" :loading="regenerateSaving" @click="regenerateAccessCode"><template #icon><SyncOutlined /></template>{{ t('merchant.verifyPage.accessCodeRegenerate') }}</a-button>
            </div>
            <div class="merchant-access-grant-card">
              <div class="merchant-access-grant-card__title"><CheckCircleOutlined />{{ t('merchant.verifyPage.credentialsDelivered') }}</div>
              <div class="merchant-access-grant-card__grid">
                <div><span>{{ t('merchant.verifyPage.accessGeneratedDate') }}</span><strong>{{ formatUploadDate(accessGrant.generated_at) }}</strong></div>
                <div><span>{{ t('merchant.verifyPage.accessGeneratedBy') }}</span><strong>{{ accessGrant.generated_by || '-' }}</strong></div>
                <div><span>{{ t('merchant.verifyPage.accessDeliveryStatus') }}</span><strong>{{ accessGrant.delivery_status === 'sent' ? t('merchant.verifyPage.accessGeneratedSent') : t('merchant.verifyPage.accessGenerated') }}</strong></div>
                <div><span>{{ t('merchant.verifyPage.accessDeliveredVia') }}</span><strong>{{ accessGrant.channels.map(deliveryChannelLabel).join('、') || '-' }}</strong></div>
              </div>
            </div>
          </template>
          </template>
        </template>
      </a-spin>
      <template #footer>
        <div v-if="detail && activeTab === 'pending' && Number(detail.status) === 0" class="fd-actions">
          <a-button v-perm="'merchant:verify:resubmit'" @click="openResub(detail)">{{ t('merchant.verifyPage.footerRequestResubmission') }}</a-button>
          <a-button v-perm="'merchant:verify:reject'" danger @click="openReject(detail)">{{ t('merchant.verifyPage.footerReject') }}</a-button>
          <a-button v-perm="'merchant:verify:approve'" type="primary" @click="openApprove(detail)">{{ t('merchant.verifyPage.footerApproveMerchant') }}</a-button>
        </div>
        <div v-else-if="detail && activeTab === 'resubmission'" class="fd-actions fd-actions--resubmission">
          <a-button v-perm="'merchant:verify:resubmit'" class="resub-footer-action resub-footer-action--request" @click="openResub(detail)"><template #icon><SyncOutlined /></template>{{ t('merchant.verifyPage.footerRequestResubmission') }}</a-button>
          <a-button v-perm="'merchant:verify:reject'" class="resub-footer-action resub-footer-action--reject" @click="openReject(detail)"><template #icon><CloseCircleOutlined /></template>{{ t('merchant.verifyPage.footerRejectApplication') }}</a-button>
          <a-button v-perm="'merchant:verify:approve'" type="primary" class="resub-footer-action resub-footer-action--approve" @click="openApprove(detail)"><template #icon><CheckCircleOutlined /></template>{{ t('merchant.verifyPage.footerApproveMerchant') }}</a-button>
        </div>
      </template>
    </a-drawer>

    <!-- 批准商户（原型：访问码 + 一次性初始密码 + 交付渠道 + 通知预览） -->
    <a-modal v-model:open="approveOpen" width="780px" wrap-class-name="approve-merchant-modal" :mask-closable="false" :closable="false">
      <template #title>
        <div class="approve-merchant-title">
          <span class="approve-merchant-title__icon"><CheckCircleOutlined /></span>
          <div><strong>{{ t('merchant.verifyPage.approveModalTitle') }}</strong><span>{{ approveTargetDetail?.merchant_name || '-' }} · {{ approveTargetDetail?.application_no || approveTargetDetail?.merchant_code || '-' }}</span></div>
        </div>
      </template>
      <div class="approve-ready-alert">{{ t('merchant.verifyPage.approveReadyMessage') }}</div>

      <div class="approve-field-label">{{ t('merchant.verifyPage.merchantAccessCode') }} <span>{{ t('merchant.verifyPage.autoGenerated') }}</span></div>
      <div class="approve-credential-row">
        <div class="approve-credential-value"><KeyOutlined /><strong>{{ approveCredentials?.access_code || '-' }}</strong></div>
        <a-button class="approve-copy-btn" @click="approveCredentials && copyCredential(approveCredentials.access_code)"><template #icon><CopyOutlined /></template>{{ t('merchant.verifyPage.credentialCopy') }}</a-button>
      </div>

      <div class="approve-field-label">{{ t('merchant.verifyPage.oneTimePassword') }} <span>{{ t('merchant.verifyPage.visibleOnce') }}</span></div>
      <div class="approve-credential-row">
        <div class="approve-credential-value"><KeyOutlined /><strong>{{ approveCredentials?.one_time_password || '-' }}</strong></div>
        <a-button class="approve-copy-btn" @click="approveCredentials && copyCredential(approveCredentials.one_time_password)"><template #icon><CopyOutlined /></template>{{ t('merchant.verifyPage.credentialCopy') }}</a-button>
      </div>

      <div class="approve-field-label approve-channel-label">{{ t('merchant.verifyPage.approveDeliveryChannels') }}</div>
      <a-checkbox-group v-model:value="approveChannels" class="approve-channel-grid">
        <label class="approve-channel-card"><a-checkbox value="email" /><MailOutlined /><span>{{ t('merchant.verifyPage.approveChannelEmail') }}</span></label>
        <label class="approve-channel-card"><a-checkbox value="sms" /><MessageOutlined /><span>{{ t('merchant.verifyPage.approveChannelSms') }}</span></label>
        <label class="approve-channel-card"><a-checkbox value="inapp" /><BellOutlined /><span>{{ t('merchant.verifyPage.approveChannelInapp') }}</span></label>
      </a-checkbox-group>

      <div class="approve-field-label approve-preview-label">{{ t('merchant.verifyPage.loginInstructionPreview') }}</div>
      <div class="approve-notice-preview">
        <div class="approve-notice-preview__bar"><i /><i /><i /><span>{{ t('merchant.verifyPage.merchantNoticePreview') }}</span></div>
        <div class="approve-notice-preview__body">
          <p>{{ t('merchant.verifyPage.approveNoticeCongrats') }}</p>
          <div><span>{{ t('merchant.verifyPage.merchantAccessCode') }}</span><strong>{{ approveCredentials?.access_code || '-' }}</strong></div>
          <div><span>{{ t('merchant.verifyPage.oneTimePassword') }}</span><strong>{{ approveCredentials?.one_time_password || '-' }}</strong></div>
          <p>{{ t('merchant.verifyPage.approveNoticeInstruction') }}</p>
        </div>
      </div>
      <template #footer>
        <div class="approve-modal-actions">
          <a-button size="large" @click="approveOpen = false">{{ t('common.cancel') }}</a-button>
          <a-button type="primary" size="large" :loading="approveSaving" @click="doApprove"><template #icon><CheckCircleOutlined /></template>{{ t('merchant.verifyPage.approveAndSendCredentials') }}</a-button>
        </div>
      </template>
    </a-modal>

    <!-- 驳回 -->
    <a-modal v-model:open="rejectOpen" :title="t('merchant.verifyPage.rejectModalTitle')" :confirm-loading="rejectSaving" :ok-text="t('merchant.verifyPage.footerRejectApplication')" :ok-button-props="{ danger: true }" @ok="doReject">
      <a-form layout="vertical">
        <a-form-item :label="t('merchant.verifyPage.rejectReasonLabel')" required>
          <a-select v-model:value="rejectReasonCode" :options="REJECT_REASONS" :placeholder="t('merchant.verifyPage.rejectReasonPlaceholder')" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('merchant.verifyPage.rejectNoteLabel')">
          <a-textarea v-model:value="rejectNote" :rows="3" :placeholder="t('merchant.verifyPage.rejectNotePlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 请求重新提交 -->
    <a-modal v-model:open="resubOpen" :title="t('merchant.verifyPage.resubModalTitle')" :confirm-loading="resubSaving" :ok-text="t('merchant.verifyPage.resubOk')" @ok="doResub">
      <a-textarea v-model:value="resubComment" :rows="4" :placeholder="t('merchant.verifyPage.resubPlaceholder')" />
    </a-modal>

    <!-- 文档驳回 -->
    <a-modal v-model:open="docRejectOpen" :title="t('merchant.verifyPage.docRejectModalTitle')" :confirm-loading="docRejectSaving" :ok-text="t('merchant.verifyPage.btnReject')" :ok-button-props="{ danger: true }" @ok="doDocReject">
      <a-textarea v-model:value="docRejectReason" :rows="3" :placeholder="t('merchant.verifyPage.docRejectPlaceholder')" />
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
/* 页头大标题:取消全局对 h1 的 margin-top:0 覆盖,恢复默认顶部间距(仅当前页面标题) */
.verify-page-title {
  margin-top: revert;
}

/* 页头 Export 按钮(原型:height 34 / 13px / #475569 / 边框 #E3E8F0 / 白底, hover #F8FAFC) */
.verify-export-btn {
  height: 34px;
  font-size: 13px;
  color: #475569;
  border: 1px solid #e3e8f0;
  background: #fff;
}
.verify-export-btn:hover {
  background: #f8fafc !important;
  border-color: #e3e8f0 !important;
  color: #475569 !important;
}

/* 商户验证状态徽章(原型 Pending/Under Review/Approved/Rejected/Resubmission 配色) */
.verify-badge {
  display: inline-block;
  padding: 1px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  white-space: nowrap;
}

.verify-drawer-title > div {
  color: #1a2332;
  font-size: 15px;
  font-weight: 700;
  line-height: 20px;
}
.verify-drawer-title > span {
  display: block;
  margin-top: 2px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
}

/* 分区标题(与 onboarding 一致:大写标题 + 延伸线) */
.co-section-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 18px 0 10px;
}
.co-section-heading:first-of-type {
  margin-top: 0;
}
.co-heading-icon {
  flex-shrink: 0;
  color: #94a3b8;
  font-size: 13px;
}
.co-heading-text {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  letter-spacing: 0.84px;
  text-transform: uppercase;
  color: #64748b;
}
.co-heading-line {
  flex: 1;
  height: 1px;
  background: #f1f5f9;
}

.vd-review-mode {
  margin-top: 0;
}
.verify-info-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.verify-info-grid {
  display: grid;
  gap: 8px;
}
.verify-info-grid--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.verify-info-grid--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.verify-info-cell {
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid #f1f5f9;
  border-radius: 6px;
  background: #f8fafc;
}
.verify-info-cell > span,
.verify-submission-grid span {
  display: block;
  margin-bottom: 3px;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 500;
}
.verify-info-cell > strong,
.verify-submission-grid strong {
  display: block;
  overflow: hidden;
  color: #1a2332;
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.verify-submission-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.verify-submission-grid > div {
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid #f1f5f9;
  border-radius: 6px;
  background: #f8fafc;
}
.verify-doc-awaiting {
  margin-top: 3px;
  color: #b54708;
  font-size: 10px;
}
.verify-document-name {
  display: flex;
  align-items: center;
  gap: 12px;
}
.verify-document-name strong,
.verify-document-name small {
  display: block;
}
.verify-document-name strong {
  color: #1a2332;
  font-size: 13px;
  font-weight: 600;
}
.verify-document-name small,
.verify-doc-missing {
  color: #94a3b8;
  font-size: 11px;
}
.verify-document-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  place-items: center;
  border-radius: 8px;
  background: #eff6ff;
  color: #1664ff;
  font-size: 17px;
}
.verify-doc-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  padding: 0 6px;
  line-height: 1;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.verify-doc-action :deep(.ant-btn-icon) {
  display: inline-flex;
  align-items: center;
}
.verify-doc-action--preview {
  color: #1664ff;
  border-color: #bfdbfe;
  background: #eff6ff;
}
.verify-doc-action--approve {
  color: #059669;
  border-color: #a7f3d0;
  background: #ecfdf3;
}
.verify-doc-action--reject {
  color: #c01048;
  border-color: #fecdd3;
  background: #fff1f3;
}

/* 时间线(原型样式:左侧竖线 + 彩色圆点白光环 + monospace 时间 + 来源标签 + action + by) */
.onb-tl {
  position: relative;
  margin-top: 8px;
  margin-left: 5px;
  padding-left: 20px;
  border-left: 2px solid #e3e8f0;
}
.onb-tl-item {
  position: relative;
  margin-bottom: 14px;
}
.onb-tl-item:last-child {
  margin-bottom: 0;
}
.onb-tl-dot {
  position: absolute;
  left: -25px;
  top: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #fff;
}
.onb-tl-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.onb-tl-date {
  font-size: 10px;
  font-family: monospace;
  color: #94a3b8;
  white-space: nowrap;
}
.onb-tl-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 0 5px;
  border-radius: 3px;
}
.onb-tl-action {
  font-size: 12px;
  font-weight: 500;
  color: #1a2332;
  margin-top: 4px;
  word-break: break-word;
}
.onb-tl-by {
  font-size: 11px;
  color: #64748b;
  margin-top: 3px;
}

/* 注册商家表格(原型,同 onboarding rb 表格样式) */
.rb-badge {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}
.rb-table {
  margin-top: 10px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.rb-head,
.rb-row {
  display: grid;
  grid-template-columns: 24px minmax(150px, 1fr) 110px 100px 96px 20px;
  align-items: center;
}
.rb-head {
  background: #f8fafc;
}
.rb-th {
  padding: 8px;
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.rb-row {
  cursor: pointer;
  border-top: 1px solid #f1f5f9;
  transition: background 0.15s ease;
}
.rb-row:hover {
  background: #f8fafc;
}
.rb-row.is-selected,
.rb-row.is-open {
  background: #f0f9ff;
  border-left: 3px solid #1664ff;
}
.rb-td {
  padding: 8px;
  font-size: 12px;
  color: #1a2332;
}
.rb-c-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
.rb-emoji {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #eef4ff;
  font-size: 13px;
  flex-shrink: 0;
}
.rb-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rb-c-exp {
  display: flex;
  align-items: center;
  justify-content: center;
}
.rb-chevron {
  color: #94a3b8;
  font-size: 10px;
  transition: transform 0.2s ease;
}
.rb-chevron.is-open {
  transform: rotate(180deg);
}
.rb-expand {
  padding: 10px 12px;
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
}
.rb-expand-title {
  margin-bottom: 8px;
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.co-grid {
  display: grid;
  gap: 8px;
}
.co-grid--3col {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.co-cell {
  padding: 8px 12px;
  border: 1px solid #f1f5f9;
  border-radius: 6px;
  background: #f8fafc;
}
.co-cell-label {
  margin-bottom: 2px;
  color: #94a3b8;
  font-size: 11px;
  line-height: 16.5px;
}
.co-cell-value {
  color: #1a2332;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  word-break: break-all;
}
/* Verification Admin Review Mode 提示条 */
.fd-review-mode {
  margin-top: 16px;
  padding: 10px 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #eff6ff;
}
.fd-review-mode__title {
  font-size: 12px;
  font-weight: 700;
  color: #1d4ed8;
  margin-bottom: 2px;
}
.fd-review-mode__desc {
  font-size: 11px;
  color: #1e40af;
  line-height: 1.5;
}

/* 最终核实决定卡 */
.fd-card {
  position: relative;
  margin-top: 14px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  background: #fff;
}
.fd-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
}
.fd-title {
  font-size: 13px;
  font-weight: 700;
  color: #1a2332;
}
.fd-subtitle {
  font-size: 11px;
  color: #64748b;
}
.fd-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.fd-actions--resubmission {
  gap: 8px;
}
.resub-footer-action--request {
  border-color: #fcd34d;
  background: #fffbeb;
  color: #b45309;
}
.resub-footer-action--request:hover,
.resub-footer-action--request:focus {
  border-color: #f59e0b;
  background: #fef3c7;
  color: #92400e;
}
.resub-footer-action--reject {
  border-color: #fecdd3;
  background: #fff1f2;
  color: #be123c;
}
.resub-footer-action--reject:hover,
.resub-footer-action--reject:focus {
  border-color: #fda4af;
  background: #ffe4e6;
  color: #9f1239;
}
.resub-footer-action--approve {
  border-color: #2463eb;
  background: #2463eb;
  color: #fff;
}
.resub-footer-action--approve:hover,
.resub-footer-action--approve:focus {
  border-color: #1d4ed8;
  background: #1d4ed8;
  color: #fff;
}
.fd-count {
  position: absolute;
  right: 14px;
  bottom: 12px;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 600;
}

/* 已批准详情：商户访问权限 */
.merchant-access-heading {
  margin-top: 28px;
}
.merchant-access-code-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10px;
}
.merchant-access-code {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  height: 42px;
  padding: 0 16px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  background: #f8fafc;
  color: #94a3b8;
}
.merchant-access-code strong {
  overflow: hidden;
  color: #1a2332;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.merchant-access-code-row .ant-btn {
  height: 42px;
}
.merchant-access-grant-card {
  margin-top: 12px;
  padding: 14px 16px;
  border: 1px solid #a7f3d0;
  border-radius: 8px;
  background: #ecfdf3;
}
.merchant-access-grant-card__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  color: #027a48;
  font-size: 12px;
  font-weight: 700;
}
.merchant-access-grant-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 28px;
}
.merchant-access-grant-card__grid span,
.merchant-access-grant-card__grid strong {
  display: block;
}
.merchant-access-grant-card__grid span {
  margin-bottom: 3px;
  color: #94a3b8;
  font-size: 10px;
}
.merchant-access-grant-card__grid strong {
  color: #1a2332;
  font-size: 12px;
  font-weight: 500;
}

/* 批准商户弹窗：原型布局 */
:global(.approve-merchant-modal .ant-modal-content) {
  overflow: hidden;
  padding: 0;
  border-radius: 18px;
}
:global(.approve-merchant-modal .ant-modal-header) {
  margin: 0;
  padding: 28px 36px 22px;
  border-bottom: 1px solid #f1f5f9;
}
:global(.approve-merchant-modal .ant-modal-body) {
  padding: 28px 36px 20px;
}
:global(.approve-merchant-modal .ant-modal-footer) {
  margin: 0;
  padding: 0 36px 28px;
  border: 0;
}
.approve-merchant-title {
  display: flex;
  align-items: center;
  gap: 14px;
}
.approve-merchant-title__icon {
  display: grid;
  width: 50px;
  height: 50px;
  flex: 0 0 50px;
  place-items: center;
  border-radius: 12px;
  background: #ecfdf3;
  color: #059669;
  font-size: 24px;
}
.approve-merchant-title > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.approve-merchant-title strong {
  color: #1a2332;
  font-size: 22px;
  line-height: 30px;
}
.approve-merchant-title span:not(.approve-merchant-title__icon) {
  overflow: hidden;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.approve-ready-alert {
  margin-bottom: 26px;
  padding: 18px 20px;
  border: 1px solid #a7f3d0;
  border-radius: 10px;
  background: #ecfdf3;
  color: #027a48;
  font-size: 14px;
}
.approve-field-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 9px;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 700;
}
.approve-field-label > span {
  padding: 2px 9px;
  border-radius: 999px;
  background: #ecfdf3;
  color: #059669;
  font-size: 11px;
  font-weight: 500;
}
.approve-credential-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 104px;
  gap: 12px;
  margin-bottom: 22px;
}
.approve-credential-value {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 62px;
  padding: 0 20px;
  border: 1px solid #e3e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #94a3b8;
}
.approve-credential-value strong {
  overflow: hidden;
  color: #1a2332;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 18px;
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.approve-copy-btn {
  height: 62px;
  border-radius: 10px;
}
.approve-channel-label,
.approve-preview-label {
  margin-top: 4px;
}
.approve-channel-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
  margin-bottom: 24px;
}
.approve-channel-card {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 54px;
  padding: 0 14px;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  background: #eff6ff;
  color: #1d4ed8;
  cursor: pointer;
}
.approve-channel-card > span:last-child {
  color: #1a2332;
  font-size: 14px;
}
.approve-notice-preview {
  overflow: hidden;
  border: 1px solid #e3e8f0;
  border-radius: 10px;
}
.approve-notice-preview__bar {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 46px;
  padding: 0 18px;
  border-bottom: 1px solid #f1f5f9;
  background: #f8fafc;
}
.approve-notice-preview__bar i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fca5a5;
}
.approve-notice-preview__bar i:nth-child(2) { background: #fcd34d; }
.approve-notice-preview__bar i:nth-child(3) { background: #6ee7b7; }
.approve-notice-preview__bar span {
  margin-left: 4px;
  color: #94a3b8;
  font-size: 12px;
}
.approve-notice-preview__body {
  padding: 20px 24px;
  color: #1a2332;
  font-size: 13px;
}
.approve-notice-preview__body > p {
  margin: 0 0 14px;
}
.approve-notice-preview__body > p:last-child {
  margin: 14px 0 0;
  color: #64748b;
}
.approve-notice-preview__body > div {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 10px;
  padding: 11px 16px;
  border-radius: 8px;
  background: #f8fafc;
}
.approve-notice-preview__body span {
  color: #94a3b8;
  font-size: 10px;
  font-weight: 700;
}
.approve-notice-preview__body strong {
  color: #1664ff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
}
.approve-modal-actions {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
}
.approve-modal-actions .ant-btn {
  height: 54px;
  border-radius: 10px;
  font-size: 15px;
}
.approve-modal-actions .ant-btn-primary {
  font-weight: 700;
}

/* 重新提交详情：请求摘要 + 原稿/重交稿双栏卡片 */
.resub-request-card {
  margin-top: 16px;
  overflow: hidden;
  border: 1px solid #fcd34d;
  border-radius: 10px;
  background: #fffbeb;
  color: #92400e;
}
.resub-request-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 22px;
}
.resub-request-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 10px;
  background: #fef3c7;
  color: #d97706;
  font-size: 20px;
}
.resub-request-card__heading {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.resub-request-card__heading strong {
  font-size: 15px;
  line-height: 22px;
}
.resub-request-card__heading span {
  color: #c2410c;
  font-size: 12px;
  line-height: 18px;
}
.resub-request-card__progress {
  margin-left: auto;
  padding: 5px 14px;
  border: 1px solid #fcd34d;
  border-radius: 999px;
  background: #fef3c7;
  color: #92400e;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.resub-request-card__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid #fcd34d;
  border-bottom: 1px solid #fcd34d;
}
.resub-request-card__stats > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 22px;
}
.resub-request-card__stats span {
  color: #b45309;
  font-size: 11px;
  font-weight: 600;
}
.resub-request-card__stats strong {
  color: #78350f;
  font-size: 13px;
}
.resub-request-card__reason {
  padding: 12px 22px;
  color: #92400e;
  font-size: 12px;
  line-height: 18px;
}
.resub-selected-business {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 12px 18px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  background: #f8fafc;
}
.resub-selected-business__emoji {
  font-size: 18px;
}
.resub-selected-business > div {
  display: flex;
  flex-direction: column;
}
.resub-selected-business strong {
  color: #1a2332;
  font-size: 13px;
}
.resub-selected-business span:not(.resub-selected-business__emoji) {
  color: #94a3b8;
  font-size: 11px;
}
.resub-document-card {
  margin-top: 16px;
  overflow: hidden;
  border: 1px solid #e3e8f0;
  border-radius: 10px;
  background: #fff;
}
.resub-document-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 13px 20px;
  border-bottom: 1px solid #e3e8f0;
  background: #f8fafc;
  color: #1a2332;
  font-size: 13px;
  font-weight: 700;
}
.resub-document-card__compare {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.resub-document-card__original,
.resub-document-card__replacement {
  min-width: 0;
  padding: 18px 20px;
}
.resub-document-card__original {
  border-right: 1px solid #e3e8f0;
  background: #fff8f8;
}
.resub-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 2px 9px;
  border: 1px solid;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}
.resub-status--rejected {
  border-color: #fecdd3;
  background: #fff1f3;
  color: #c01048;
}
.resub-status--review {
  border-color: #fcd34d;
  background: #fffbeb;
  color: #b45309;
}
.resub-status--waiting {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #94a3b8;
}
.resub-file {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 70px;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid;
  border-radius: 8px;
  text-decoration: none;
}
.resub-file > .anticon {
  flex: 0 0 auto;
  font-size: 17px;
}
.resub-file > span {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.resub-file strong {
  overflow: hidden;
  color: #1a2332;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.resub-file small {
  color: #94a3b8;
  font-size: 11px;
}
.resub-file--original {
  border-color: #fecdd3;
  background: #fff;
  color: #e11d48;
}
.resub-file--replacement {
  border-color: #a7f3d0;
  background: #ecfdf3;
  color: #059669;
}
.resub-file--waiting {
  min-height: 48px;
  border-color: #cbd5e1;
  border-style: dashed;
  background: #f8fafc;
  color: #94a3b8;
  font-size: 12px;
}
.resub-reason-box {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid #fecdd3;
  border-radius: 8px;
  background: #fff1f3;
}
.resub-reason-box strong {
  color: #c01048;
  font-size: 11px;
}
.resub-reason-box span {
  color: #9f1239;
  font-size: 12px;
  line-height: 18px;
}
.resub-reason-box small {
  color: #94a3b8;
  font-size: 11px;
}
.resub-document-card__actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
@media (max-width: 900px) {
  .resub-document-card__compare {
    grid-template-columns: 1fr;
  }
  .resub-document-card__original {
    border-right: 0;
    border-bottom: 1px solid #e3e8f0;
  }
}
</style>
