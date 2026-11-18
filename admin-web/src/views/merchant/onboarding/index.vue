<script setup lang="ts">
import { genUUID } from '@/utils/uuid';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { message, Modal, type TablePaginationConfig } from 'ant-design-vue';
import {
  BankOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  MenuOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SearchFilterBar, { type FilterConfig } from '@/components/SearchFilterBar.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StageSteps from '@/components/StageSteps.vue';
import StatusTag from '@/components/StatusTag.vue';
import MerchantVerifyNav from '@/components/MerchantVerifyNav.vue';
import KycScopeDocuments from './components/KycScopeDocuments.vue';
import MerchantDocumentPreview from './components/MerchantDocumentPreview.vue';
import PropertyKycTemplate from './components/PropertyKycTemplate.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { useUserStore } from '@/stores/user';
import {
  apiOnboardingAdd,
  apiOnboardingAddNote,
  apiOnboardingApprove,
  apiOnboardingAssignOps,
  apiOnboardingSubmitVerification,
  apiOnboardingTestConfirmAgreement,
  apiOnboardingDetail,
  apiOnboardingFinalApprove,
  apiOnboardingCredentialRetry,
  apiOnboardingTestCredentials,
  apiOnboardingKycTemplates,
  apiOnboardingKycUpload,
  apiOnboardingList,
  apiOnboardingRegistrationResubmit,
  apiOnboardingRegistrationReviewStart,
  apiOnboardingReject,
  apiOnboardingSaveAssessment,
  apiOnboardingSendKyc,
  apiOnboardingSendReminder,
  apiOnboardingUpdateStage,
  apiVerifyDocReview,
} from '@/api/merchant';
import { apiAdminList } from '@/api/system';
import { exportCsv } from '@/utils/exportCsv';

/**
 * 商户入驻流水线(Onboarding,原型 stir-long v4.2.1 / Merchant Verification)
 * CRM 式 7 状态(6 流程节点 + 驳回):New Lead → Contacted → KYC Requested → Waiting for Documents
 *   → Under Review → Officially Approved / Rejected
 * 正式认可后转正式商户(merchant_info status=0)进入 Pending Verification
 * 2026-08-20:恢复为独立 Onboarding 页(菜单 205),展示全部线索,支持新增线索/阶段筛选;
 *   验证状态页(Pending Verification/Approved/Rejected/Resubmission)由 merchant/verify/index 承接
 */
const { t } = useI18n();
const user = useUserStore();
const isSuper = computed(() => user.profile?.isSuper === true);

const REGISTRATION_STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('merchant.onboardingPage.registrationDraft'), color: 'default' },
  1: { text: t('merchant.onboardingPage.registrationSubmitted'), color: 'processing' },
  2: { text: t('merchant.onboardingPage.registrationUnderReview'), color: 'warning' },
  3: { text: t('merchant.onboardingPage.registrationApproved'), color: 'success' },
  4: { text: t('merchant.onboardingPage.registrationResubmitRequired'), color: 'orange' },
  5: { text: t('merchant.onboardingPage.registrationRejected'), color: 'error' },
}));
// 旧阶段枚举仅用于 state_model_version=0 的兼容记录。
const STAGE_MAP = computed<Record<number, StatusItem>>(() => ({
  1: { text: t('merchant.onboardingPage.stageNewLead'), color: 'default' },
  2: { text: t('merchant.onboardingPage.stageContacted'), color: 'processing' },
  3: { text: t('merchant.onboardingPage.stageKycGranted'), color: 'cyan' },
  4: { text: t('merchant.onboardingPage.stageKycInProgress'), color: 'warning' },
  5: { text: t('merchant.onboardingPage.stageOfficiallyApproved'), color: 'success' },
  6: { text: t('merchant.onboardingPage.stageRejected'), color: 'error' },
}));
// 抽屉内阶段调整:六项全量(新线索/已联系/KYC访问权限已授予/KYC进行中/得到正式认可/已拒绝;终态走通过/驳回弹窗)
const STAGE_OPTIONS = computed(() => [1, 2, 3, 4, 5, 6].map((v) => ({ value: v, label: STAGE_MAP.value[v].text })));
/** 状态卡顶部栏阶段配色(前三项用户指定,其余按原型色板) */
const STAGE_CARD_STYLE = computed<Record<number, { bg: string; border: string }>>(() => ({
  1: { bg: '#F1F5F9', border: '#CBD5E1' },
  2: { bg: '#ECFEFF', border: '#A5F3FC' },
  3: { bg: '#F5F3FF', border: '#DDD6FE' },
  4: { bg: '#FFFBEB', border: '#FDE68A' },
  5: { bg: '#ECFDF3', border: '#A7F3D0' },
  6: { bg: '#FFF1F3', border: '#FECDD3' },
}));
const stageCardStyle = computed(() => {
  if (!isLegacy.value) {
    const colors: Record<string, string> = { error: '#fff1f3', orange: '#fffbeb', warning: '#fffbeb', cyan: '#ecfeff', processing: '#eff6ff', success: '#ecfdf5' };
    const bg = colors[currentProgress.value.status.color] || '#f1f5f9';
    return { background: bg, borderBottom: '1px solid #e3e8f0' };
  }
  const s = STAGE_CARD_STYLE.value[Number(app.value?.stage)] ?? STAGE_CARD_STYLE.value[1];
  return { background: s.bg, borderBottom: `1px solid ${s.border}` };
});
const OPERATOR_TYPES = computed(() => [
  { value: 'single_unit', label: t('merchant.onboardingPage.opSingleUnit') },
  { value: 'chain', label: t('merchant.onboardingPage.opChain') },
  { value: 'franchise', label: t('merchant.onboardingPage.opFranchise') },
  { value: 'independent', label: t('merchant.onboardingPage.opIndependent') },
  { value: 'mixed', label: t('merchant.onboardingPage.opMixed') },
]);
const BUSINESS_TYPES = computed(() => [
  { value: 'hotel', label: '🏨 ' + t('merchant.onboardingPage.bizHotel') },
  { value: 'restaurant', label: '🍽️ ' + t('merchant.onboardingPage.bizRestaurant') },
  { value: 'airline', label: '✈️ ' + t('merchant.onboardingPage.bizAirline') },
  { value: 'car_rental', label: '🚗 ' + t('merchant.onboardingPage.bizCarRental') },
  { value: 'attraction', label: '🎯 ' + t('merchant.onboardingPage.bizAttraction') },
]);
// §3 注册企业(原型实测:自绘表格 + 手风琴行展开)
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
// 预置驳回原因(与后端 VerifyController::REJECT_REASONS 对齐)
const REJECT_REASONS = computed(() =>
  Array.from({ length: 9 }, (_, i) => ({ code: i + 1, label: t(`merchant.rejectReasons.r${i + 1}`) })),
);

const { loading, list, query, load, search, pagination } = useTable(apiOnboardingList, {
  queue: '',
  registrationStatus: undefined,
  category: '',
  keyword: '',
  country: '',
});

/** 注册国家候选(整改 D1:后端 onboarding/list 已支持 country 过滤) */
const COUNTRY_OPTIONS = ['Myanmar', 'Thailand', 'China', 'Singapore'];

// 搜索筛选条(SearchFilterBar:关键词 + 业态/国家下拉筛选,筛选变化自动触发搜索)
const sfbFilters = reactive<Record<string, string | number | undefined>>({ registrationStatus: undefined, category: undefined, country: undefined });
const SEARCH_FILTERS = computed<FilterConfig[]>(() => [
  {
    key: 'registrationStatus',
    label: t('merchant.onboardingPage.filterStage'),
    allLabel: t('merchant.onboardingPage.allStages'),
    options: [0, 1, 2, 3, 4, 5].map((value) => ({ value, label: REGISTRATION_STATUS_MAP.value[value].text })),
  },
  {
    key: 'category',
    label: t('merchant.onboardingPage.filterCategory'),
    allLabel: t('merchant.onboardingPage.allCategories'),
    options: BUSINESS_TYPES.value,
  },
  {
    key: 'country',
    label: t('merchant.onboardingPage.labelCountry'),
    allLabel: t('merchant.onboardingPage.allCountries'),
    options: COUNTRY_OPTIONS.map((c) => ({ label: c, value: c })),
  },
]);
/** 搜索/筛选变化:同步筛选值到查询条件并从第一页重查 */
function handleSfbSearch(): void {
  query.registrationStatus = sfbFilters.registrationStatus;
  query.category = String(sfbFilters.category ?? '');
  query.country = String(sfbFilters.country ?? '');
  search();
}

// 表格分页(原型实测:左侧总览文案 + 右侧按钮组,无条数选择器/快速跳转)
const tablePagination = computed<TablePaginationConfig>(() => {
  const base = pagination.value;
  return {
    ...base,
    showSizeChanger: false,
    showQuickJumper: false,
    showTotal: (count: number, range?: [number, number]) => {
      const [from, to] = range ?? [0, 0];
      return t('merchant.onboardingPage.paginationInfo', { from, to, total: count });
    },
  };
});

/** 导出当前筛选结果(整改 D2) */
async function exportList(): Promise<void> {
  const data = await apiOnboardingList({ ...query, page: 1, pageSize: 200 });
  exportCsv(`merchant-onboarding-${Date.now()}.csv`, [
    { key: 'app_no', label: 'Lead ID' },
    { key: 'merchant_name', label: 'Merchant Name' },
    { key: 'business_names', label: 'Business Name' },
    { key: 'reg_number', label: 'Reg. Number' },
    { key: 'country', label: 'Country' },
    { key: 'submitted_at', label: 'Submitted' },
    { key: 'onboarding_progress', label: t('merchant.onboardingPage.colProgress') },
    { key: 'registration_status', label: 'Registration Status' },
    { key: 'assigned_ops_name', label: 'Assigned Ops' },
  ], data.list.map((row) => ({
    ...row,
    submitted_at: formatDate(row.submitted_at),
    onboarding_progress: onboardingProgress(row).status.text,
    registration_status: REGISTRATION_STATUS_MAP.value[row.registration_status]?.text ?? row.registration_status,
  })));
}

function formatDate(value: unknown): string {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, 10) : '-';
}

const columns = computed(() => [
  { title: t('merchant.onboardingPage.colLeadId'), dataIndex: 'app_no', width: 210 },
  { title: t('merchant.onboardingPage.colMerchantName'), dataIndex: 'merchant_name', ellipsis: true },
  { title: t('merchant.onboardingPage.colBusinessName'), dataIndex: 'business_names', ellipsis: true },
  { title: t('merchant.onboardingPage.colRegNumber'), dataIndex: 'reg_number', width: 112, ellipsis: true },
  { title: t('merchant.onboardingPage.colSubmitted'), dataIndex: 'submitted_at', width: 100 },
  { title: t('merchant.onboardingPage.colProgress'), key: 'progress', width: 150 },
  { title: t('merchant.onboardingPage.colAssignedOps'), dataIndex: 'assigned_ops_name', width: 110, ellipsis: true },
  { title: t('common.action'), key: 'action_col', width: 150, fixed: 'right' as const },
]);

// ---------- 运营专员候选(系统管理员) ----------
const opsOptions = ref<{ value: number; label: string }[]>([]);
async function loadOps(): Promise<void> {
  try {
    const data = await apiAdminList({ page: 1, pageSize: 100 });
    opsOptions.value = data.list.map((row: TableRow) => ({
      value: row.id,
      label: row.real_name || row.username || `#${row.id}`,
    }));
  } catch {
    opsOptions.value = [];
  }
}

// ---------- 详情抽屉 ----------
const documentPreview = ref<InstanceType<typeof MerchantDocumentPreview> | null>(null);
function openDocumentPreview(docId: number): void {
  documentPreview.value?.show(docId);
}

const drawerOpen = ref(false);
const assistOpen = ref(false);
const detailLoading = ref(false);
const app = ref<TableRow | null>(null);
const businesses = ref<TableRow[]>([]);
const documents = ref<TableRow[]>([]);
const timeline = ref<TableRow[]>([]);
const timelineExpanded = ref(false);
const notes = ref<TableRow[]>([]);
const kyc = ref<TableRow | null>(null);
const finalApprovalResult = ref<TableRow | null>(null);
const merchantKycOpen = ref(false);
const merchantUploadedCount = computed(() => (kyc.value?.merchantKyc?.documents || []).filter((doc: TableRow) => doc.hasFile).length);
const scopedAssistOpen = ref(false);
const requirementsOpen = ref(false);

const KYC_STATUS_MAP = computed<Record<string, StatusItem>>(() => ({
  locked: { text: t('merchant.onboardingPage.kycLocked'), color: 'default' },
  draft: { text: t('merchant.onboardingPage.kycDraft'), color: 'default' },
  submitted: { text: t('merchant.onboardingPage.kycSubmitted'), color: 'warning' },
  under_review: { text: t('merchant.onboardingPage.kycUnderReview'), color: 'processing' },
  resubmit_required: { text: t('merchant.onboardingPage.kycResubmitRequired'), color: 'orange' },
  approved: { text: t('merchant.onboardingPage.kycVerified'), color: 'success' },
  rejected: { text: t('merchant.onboardingPage.kycRejected'), color: 'error' },
}));

function businessKycBadge(biz: TableRow): StatusItem {
  if (isLegacy.value) {
    const badge = RB_KYC_BADGE.value[Number(biz.kyc_status)];
    const colors: Record<number, StatusItem['color']> = { 0: 'warning', 1: 'success', 2: 'processing', 3: 'orange', 4: 'error' };
    return { text: badge?.text || '-', color: colors[Number(biz.kyc_status)] || 'default' };
  }
  const statuses = ['locked', 'draft', 'submitted', 'under_review', 'resubmit_required', 'approved', 'rejected'];
  return KYC_STATUS_MAP.value[statuses[Number(biz.kyc_status)]] || { text: '-', color: 'default' };
}

const progressLabels = computed(() => ['progressRegistration', 'progressDocuments', 'progressReview', 'progressFinal']
  .map((key) => t(`merchant.onboardingPage.${key}`)));
function onboardingProgress(row: TableRow, scopes?: string[], finalResult?: TableRow | null): { step: number; status: StatusItem } {
  if (Number(row.state_model_version ?? 0) === 0) {
    return { step: 0, status: STAGE_MAP.value[Number(row.stage)] || { text: '-', color: 'default' } };
  }
  const progress = (step: number, key: string, color: StatusItem['color']) => ({
    step, status: { text: t(`merchant.onboardingPage.${key}`), color },
  });
  if (finalResult || Number(row.merchant_id) > 0 || Number(row.account_status) > 0) {
    const accountStatus = Number(row.account_status);
    const key = accountStatus === 3 || accountStatus === 4 ? 'progressApproved'
      : accountStatus === 2 || (accountStatus === 0 && finalResult?.accountStatus === 'active')
        ? 'progressActivated' : 'progressPendingActivation';
    return progress(5, key, 'success');
  }
  if (Number(row.registration_status) !== 3) {
    return { step: 1, status: REGISTRATION_STATUS_MAP.value[Number(row.registration_status)] || { text: '-', color: 'default' } };
  }
  const names = ['locked', 'draft', 'submitted', 'under_review', 'resubmit_required', 'approved', 'rejected'];
  const statuses = scopes ?? [row.merchant_kyc_status, ...(row.initial_property_kyc_statuses || [])]
    .map((status) => names[Number(status)] || 'locked');
  if (statuses.includes('resubmit_required')) return progress(2, 'progressCorrection', 'orange');
  if (statuses.includes('rejected')) return progress(3, 'progressRejected', 'error');
  if (statuses.length < 2 || statuses.some((status) => ['locked', 'draft'].includes(status))) {
    return progress(2, 'progressPreparingDocuments', 'cyan');
  }
  if (statuses.every((status) => status === 'approved')) return progress(4, 'progressAwaitingFinal', 'processing');
  return progress(3, 'progressReviewing', 'warning');
}
const currentProgress = computed(() => onboardingProgress(app.value || {}, kyc.value
  ? [kyc.value.merchantKyc?.status, ...(kyc.value.initialProperties || []).map((p: TableRow) => p.kycStatus)]
  : undefined, finalApprovalResult.value));
const registrationProgress = computed(() => currentProgress.value.step);

const currentProperty = computed<TableRow | null>(() => (kyc.value?.initialProperties || [])
  .find((property: TableRow) => Number(property.applicationBusinessId) === Number(kycBizId.value)) ?? null);
async function refreshPropertyTemplate(applicationId: number): Promise<void> {
  if (Number(app.value?.id) !== applicationId) return;
  scopedKycBusy.value = true;
  try {
    await loadDetail(applicationId, true);
  } finally {
    scopedKycBusy.value = false;
  }
}
const propertyOptions = computed(() => (kyc.value?.initialProperties || []).map((property: TableRow) => ({
  value: property.applicationBusinessId,
  label: property.businessName,
})));

function openScopedAssist(): void {
  if (canAssistNewKyc.value) scopedAssistOpen.value = true;
}

function selectBusinessId(id: number): void {
  const business = businesses.value.find((item) => item.id === id);
  if (business) void selectBiz(business);
}

/**
 * 时间线事件来源(对齐原型 §6 Activity Timeline:`oi` 映射)——
 * system 灰 / admin 蓝 / merchant 绿;actor_type: 1系统 2管理员 3商户
 */
function tlSource(actorType: unknown): { label: string; color: string; dot: string } {
  switch (Number(actorType)) {
    case 3:
      return { label: t('merchant.onboardingPage.timelineSourceMerchant'), color: '#059669', dot: '#059669' };
    case 2:
      return { label: t('merchant.onboardingPage.timelineSourceAdmin'), color: '#1664FF', dot: '#1664FF' };
    default:
      return { label: t('merchant.onboardingPage.system'), color: '#94A3B8', dot: '#E3E8F0' };
  }
}

/** 对齐原型:事件展示为 date/type标签/action/by 四要素,date 取日期部分(`YYYY-MM-DD`) */
function tlDate(datetime: unknown): string {
  return String(datetime || '').slice(0, 10);
}

/** 注册企业手风琴展开行 */
const openBizId = ref(0);
function toggleBiz(id: number, biz: TableRow): void {
  if (openBizId.value === id) {
    openBizId.value = 0;
    return;
  }
  openBizId.value = id;
  void selectBiz(biz);
}

async function openDetail(row: TableRow): Promise<void> {
  timelineExpanded.value = false;
  scopedAssistOpen.value = false;
  requirementsOpen.value = false;
  merchantKycOpen.value = false;
  openBizId.value = 0;
  noteText.value = '';
  drawerOpen.value = true;
  detailLoading.value = true;
  try {
    await loadDetail(row.id);
    // 抽屉内表单与库内数据同步
    assessment.businessTypes = parsedTypes.value;
    assessment.numBusinesses = app.value?.num_businesses || 1;
    assessment.operatorType = app.value?.operator_type || undefined;
    assessment.expectedLaunchDate = app.value?.expected_launch_date || undefined;
    assessment.operationsNotes = app.value?.operations_notes || '';
    kycSetup.submissionMethod = app.value?.submission_method || 1;
    // KYC Management 默认选中第一个业务单元(无业务单元时回退申请级配置)
    const firstB = businesses.value[0];
    kycBizId.value = firstB?.id ?? 0;
    openBizId.value = firstB?.id ?? 0;
    kycSetup.templateId = Number(app.value?.kyc_template_id) || undefined;
    if (!isLegacy.value) return;
    await loadTemplates();
    if (!kycSetup.templateId) {
      kycSetup.templateId = templates.value[0]?.id;
    }
    selectedTemplate.value = templates.value.find((x) => x.id === kycSetup.templateId) ?? null;
  } finally {
    detailLoading.value = false;
  }
}

async function loadDetail(id: number, onlyIfCurrent = false): Promise<void> {
  const data = await apiOnboardingDetail(id);
  if (onlyIfCurrent && Number(app.value?.id) !== id) return;
  app.value = data.application;
  businesses.value = data.businesses;
  documents.value = data.documents;
  timeline.value = data.timeline;
  notes.value = data.notes;
  kyc.value = data.kyc;
  finalApprovalResult.value = data.finalApproval;
  // Opening or refreshing a detail also refreshes that visible row's progress snapshot.
  list.value = list.value.map((row) => Number(row.id) === Number(app.value?.id) ? {
    ...row,
    ...data.application,
    initial_property_kyc_statuses: data.businesses.map((business: TableRow) => Number(business.kyc_status)),
  } : row);
}

const isLegacy = computed(() => Number(app.value?.state_model_version ?? 0) === 0);
const scopedKycBusy = ref(false);
const testAgreementOpen = ref(false);
const testAgreementForm = reactive({ id: 0, agreementId: 0, version: '', reason: '' });
const canAssistNewKyc = computed(() => !isLegacy.value && !!kyc.value && Number(app.value?.merchant_id ?? 0) === 0);
const canSubmitNewKyc = computed(() => canAssistNewKyc.value && kyc.value?.agreement?.satisfied === true
  && [kyc.value?.merchantKyc?.status, ...(kyc.value?.initialProperties || []).map((p: TableRow) => p.kycStatus)]
    .some((status) => ['draft', 'resubmit_required'].includes(status)));

function canUploadScopedDoc(status: string, doc: TableRow): boolean {
  return canAssistNewKyc.value && (status === 'draft' || (status === 'resubmit_required' && ['missing', 'rejected', 'expired', 'resubmit_required'].includes(doc.status)));
}

function canReviewScopedDoc(status: string, doc: TableRow): boolean {
  return canAssistNewKyc.value && Number(app.value?.registration_status) === 3 && !scopedKycBusy.value
    && ['submitted', 'under_review'].includes(status) && doc.status === 'pending_review'
    && !!doc.hasFile && Number(doc.id) > 0 && Number(doc.documentVersion) > 0;
}

function reviewDocumentScope(docId: number): { doc: TableRow; status: string; label: string } | undefined {
  const scopes = [
    { status: kyc.value?.merchantKyc?.status, label: t('merchant.onboardingPage.merchantKycScope'), documents: kyc.value?.merchantKyc?.documents },
    ...(kyc.value?.initialProperties || []).map((property: TableRow) => ({ status: property.kycStatus, label: property.businessName, documents: property.documents })),
  ];
  for (const scope of scopes) {
    const doc = scope.documents?.find((item: TableRow) => item.id === docId);
    if (doc) return { doc, status: scope.status, label: scope.label };
  }
}

type KycReviewTarget = { id: number; applicationId: number; documentVersion: number; name: string; scope: string };
const kycRejectOpen = ref(false);
const kycRejectReason = ref('');
const kycReviewTarget = ref<KycReviewTarget | null>(null);

function openKycReview(doc: TableRow, action: 'verify' | 'reject'): void {
  const scope = reviewDocumentScope(doc.id);
  if (!scope || !canReviewScopedDoc(scope.status, scope.doc)) return;
  const target = { id: doc.id, applicationId: Number(app.value?.id), documentVersion: scope.doc.documentVersion, name: scope.doc.name, scope: scope.label };
  if (action === 'reject') {
    kycReviewTarget.value = target;
    kycRejectReason.value = '';
    kycRejectOpen.value = true;
    return;
  }
  Modal.confirm({
    zIndex: 1200,
    title: t('merchant.documentsPage.verify'),
    content: `${target.scope} · ${t('merchant.documentsPage.verifyConfirm', { doc: target.name })}`,
    okText: t('merchant.documentsPage.verify'),
    cancelText: t('common.cancel'),
    onOk: () => reviewScopedDocument(target, 'verify'),
  });
}

async function reviewScopedDocument(target: KycReviewTarget, action: 'verify' | 'reject', reason?: string): Promise<boolean> {
  const current = reviewDocumentScope(target.id);
  if (Number(app.value?.id) !== target.applicationId || !current || !canReviewScopedDoc(current.status, current.doc)
    || current.doc.documentVersion !== target.documentVersion) {
    message.warning(t('merchant.onboardingPage.reviewChangedHint'));
    return false;
  }
  scopedKycBusy.value = true;
  try {
    await apiVerifyDocReview({ docId: target.id, action, expectedVersion: target.documentVersion, ...(reason ? { reason } : {}) });
    message.success(t(action === 'verify' ? 'merchant.documentsPage.verifySuccess' : 'merchant.verifyPage.docRejectSuccess'));
    return true;
  } finally {
    try {
      if (Number(app.value?.id) === target.applicationId) await loadDetail(target.applicationId);
    } finally {
      scopedKycBusy.value = false;
    }
  }
}

async function rejectScopedDocument(): Promise<void> {
  const reason = kycRejectReason.value.trim();
  if (!reason) {
    message.warning(t('merchant.verifyPage.docRejectRequiredWarn'));
    return;
  }
  if (kycReviewTarget.value && await reviewScopedDocument(kycReviewTarget.value, 'reject', reason)) kycRejectOpen.value = false;
}

function uploadScopedDoc(file: File, scope: string, businessId: number, doc: TableRow): false {
  if (!app.value || scopedKycBusy.value) return false;
  const id = app.value.id;
  scopedKycBusy.value = true;
  void (async () => {
    try {
      await apiOnboardingKycUpload(file, id, doc.docType, undefined, scope, businessId);
      await loadDetail(id);
      message.success(t('merchant.onboardingPage.assistUploadSuccess'));
    } finally {
      scopedKycBusy.value = false;
    }
  })().catch(() => undefined);
  return false;
}

function submitNewKyc(): void {
  if (!app.value) return;
  const id = app.value.id;
  Modal.confirm({
    title: t('merchant.onboardingPage.assistSubmitConfirmTitle'),
    content: t('merchant.onboardingPage.assistNewSubmitHint'),
    zIndex: 1200,
    async onOk() {
      scopedKycBusy.value = true;
      try {
        await apiOnboardingSubmitVerification(id);
        await loadDetail(id);
        message.success(t('merchant.onboardingPage.assistSubmitSuccess'));
      } finally {
        scopedKycBusy.value = false;
      }
    },
  });
}

function openTestAgreement(): void {
  if (!app.value || !kyc.value) return;
  Object.assign(testAgreementForm, { id: app.value.id, agreementId: kyc.value.agreement.agreementId, version: kyc.value.agreement.version, reason: '' });
  testAgreementOpen.value = true;
}

async function confirmTestAgreement(): Promise<void> {
  if (!testAgreementForm.reason.trim()) {
    message.warning(t('merchant.onboardingPage.testAgreementReason'));
    return;
  }
  scopedKycBusy.value = true;
  try {
    await apiOnboardingTestConfirmAgreement({ ...testAgreementForm });
    await loadDetail(testAgreementForm.id);
    testAgreementOpen.value = false;
    message.success(t('merchant.onboardingPage.testAgreementConfirmed'));
  } finally {
    scopedKycBusy.value = false;
  }
}
const editable = computed(() => app.value !== null && (isLegacy.value ? app.value.stage < 5 : [1, 2, 4].includes(Number(app.value.registration_status))));
const registrationReviewable = computed(() => !isLegacy.value && Number(app.value?.registration_status) === 1);
const registrationDecisionable = computed(() => !isLegacy.value && Number(app.value?.registration_status) === 2);
const finalApprovable = computed(() => isSuper.value
  && !isLegacy.value
  && Number(app.value?.account_status ?? 0) === 0
  && Number(app.value?.merchant_id ?? 0) === 0);
const finalApprovalBlockReasons = computed(() => (kyc.value?.finalApproval?.reasons || []).map((reason: string) => {
  const [key, propertyId] = reason.split(':');
  return t(`merchant.onboardingPage.finalBlockReasons.${key}`, { id: propertyId || '' });
}).join(' / '));
const credentialChannel = computed(() => app.value?.registration_channel === 'admin' ? (app.value?.auth_test_mode ? 'email' : 'sms') : String(app.value?.registration_channel || ''));
const parsedTypes = computed<string[]>(() =>
  String(app.value?.business_types || '')
    .split(',')
    .filter(Boolean),
);

// ---------- §1 阶段调整 / 指派运营 ----------
async function changeStage(stage: number): Promise<void> {
  if (!app.value || stage === app.value.stage) return;
  // 原型 Change: 下拉含终态;选中「得到正式认可」(5)/「已拒绝」(6)走对应审核弹窗
  if (stage === 5) {
    openApprove(app.value);
    return;
  }
  if (stage === 6) {
    openReject(app.value);
    return;
  }
  await apiOnboardingUpdateStage(app.value.id, stage);
  message.success(t('merchant.onboardingPage.stageUpdated'));
  await loadDetail(app.value.id);
  await load();
}

async function changeOps(value: number): Promise<void> {
  if (!app.value) return;
  const opt = opsOptions.value.find((x) => x.value === value);
  await apiOnboardingAssignOps(app.value.id, value || 0, opt?.label ?? '');
  message.success(value ? t('merchant.onboardingPage.opsAssigned') : t('merchant.onboardingPage.opsUnassigned'));
  await loadDetail(app.value.id);
  await load();
}

// ---------- §4 运营评估 ----------
const assessment = reactive<{ businessTypes: string[]; operatorType?: string; numBusinesses: number; expectedLaunchDate?: string; operationsNotes: string }>({
  businessTypes: [],
  operatorType: undefined,
  numBusinesses: 1,
  expectedLaunchDate: undefined,
  operationsNotes: '',
});
const assessmentSaving = ref(false);
async function saveAssessment(): Promise<void> {
  if (!app.value) return;
  assessmentSaving.value = true;
  try {
    await apiOnboardingSaveAssessment({
      id: app.value.id,
      businessTypes: assessment.businessTypes.join(','),
      operatorType: assessment.operatorType ?? '',
      numBusinesses: Math.max(1, assessment.numBusinesses),
      expectedLaunchDate: assessment.expectedLaunchDate ?? '',
      operationsNotes: assessment.operationsNotes,
    });
    message.success(t('merchant.onboardingPage.assessmentSaved'));
    await loadDetail(app.value.id);
  } finally {
    assessmentSaving.value = false;
  }
}

// ---------- §5 KYC Setup & Access ----------
const kycSetup = reactive<{ templateId?: number; submissionMethod: number }>({
  templateId: undefined,
  submissionMethod: 1,
});
const templates = ref<TableRow[]>([]);
const selectedTemplate = ref<TableRow | null>(null);
const kycSending = ref(false);
const previewOpen = ref(false);

// 注册企业表格当前展开的业务单元(点击展开行时联动 KYC 配置)
const kycBizId = ref(0);
const currentBiz = computed<TableRow | null>(() => businesses.value.find((b) => b.id === kycBizId.value) ?? null);
/** 协助商户 KYC 当前关联的注册商户(点开协助抽屉那一瞬选中的商家) */
const assistBiz = ref<TableRow | null>(null);
const assistKycDocs = computed(() => {
  const tpl = assistBiz.value?.kyc_template_id
    ? templates.value.find((x) => Number(x.id) === Number(assistBiz.value?.kyc_template_id)) ?? selectedTemplate.value
    : selectedTemplate.value;
  const docs = templateDocs(tpl);
  return docs.length ? docs : [
    { name: t('merchant.onboardingPage.assistDefaultDocRegistration'), doc_type: 'business_registration', required: true },
    { name: t('merchant.onboardingPage.assistDefaultDocLicense'), doc_type: 'operating_license', required: true },
  ];
});

function openAssistKyc(): void {
  kycSetup.submissionMethod = 2;
  // 关联当前选中的注册商户,后续上传按该商家(biz_unit)隔离
  assistBiz.value = currentBiz.value;
  // 已上传文件按当前商家的 doc_type 归位(仅该 biz_unit 下的文档)
  assistUploads.value = {};
  const bizId = assistBiz.value ? String(assistBiz.value.id) : '';
  for (const doc of documents.value) {
    if (!doc.file_url) continue;
    const dt = String(doc.doc_type || '');
    if (!dt) continue;
    if (bizId && String(doc.biz_unit || '') !== bizId) continue;
    assistUploads.value[dt] = { ...doc };
  }
  assistOpen.value = true;
}

// ---------- 协助商户 KYC:文件上传/删除/提交核验 ----------
/** 各 doc_type 已上传文件(docType → 文档记录) */
const assistUploads = ref<Record<string, TableRow>>({});
/** 上传进行中的 doc_type 集合 */
const assistUploading = ref<Record<string, boolean>>({});
/** 隐藏的原生文件选择 input(ref forEach) */
const assistFileInputs = ref<Record<string, HTMLInputElement | null>>({});

/** 已上传文件数(标题计数联动) */
const assistUploadedCount = computed(() => Object.keys(assistUploads.value).length);

function assistSelectFile(doc: TableRow): void {
  assistFileInputs.value[doc.doc_type]?.click();
}

/** 存储原生 file input 引用(ref 回调,模板 :ref 使用) */
function assignFileInput(docType: string, el: unknown): void {
  assistFileInputs.value[docType] = (el as HTMLInputElement | null) ?? null;
}

function assistFileChanged(e: Event, doc: TableRow): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!app.value) return;
  void uploadAssistDoc(file, doc);
}

async function uploadAssistDoc(file: File, doc: TableRow): Promise<void> {
  if (!app.value) return;
  const dt = doc.doc_type;
  assistUploading.value = { ...assistUploading.value, [dt]: true };
  try {
    const res = await apiOnboardingKycUpload(file, app.value.id, dt, assistBiz.value ? String(assistBiz.value.id) : undefined);
    assistUploads.value = { ...assistUploads.value, [dt]: res };
    // 同步到 documents,关闭抽屉再打开时能按商家(biz_unit)重新归位
    const bizId = assistBiz.value ? String(assistBiz.value.id) : '';
    const merged = { ...res, biz_unit: bizId, name: res.file_name || res.name };
    const idx = documents.value.findIndex((d) => String(d.doc_type || '') === dt && String(d.biz_unit || '') === bizId);
    documents.value = idx >= 0
      ? documents.value.map((d, i) => (i === idx ? { ...merged, id: d.id } : d))
      : [...documents.value, merged];
    if (assistBiz.value) {
      businesses.value = businesses.value.map((biz) =>
        biz.id === assistBiz.value?.id
          ? { ...biz, kyc_status: 0, kyc_submitted_at: null, kyc_submitted_by: 0 }
          : biz,
      );
    }
    message.success(t('merchant.onboardingPage.assistUploadSuccess'));
  } catch {
    // 拦截器已提示错误
  } finally {
    assistUploading.value = { ...assistUploading.value, [dt]: false };
  }
}

function removeAssistDoc(doc: TableRow): void {
  const dt = doc.doc_type;
  if (!assistUploads.value[dt]) return;
  const next = { ...assistUploads.value };
  delete next[dt];
  assistUploads.value = next;
  message.info(t('merchant.onboardingPage.assistUploadRemoved'));
}

function submitAssistVerification(): void {
  if (!app.value || !assistBiz.value) return;
  const applicationId = app.value.id;
  const businessId = assistBiz.value.id;
  Modal.confirm({
    title: t('merchant.onboardingPage.assistSubmitConfirmTitle'),
    content: t('merchant.onboardingPage.assistSubmitConfirmText'),
    okText: t('merchant.onboardingPage.assistSubmitVerification'),
    cancelText: t('common.cancel'),
    onOk: async () => {
      await apiOnboardingSubmitVerification(applicationId, businessId);
      message.success(t('merchant.onboardingPage.assistSubmitSuccess'));
      await loadDetail(applicationId);
      await load();
    },
  });
}

/** Legacy assistant flow still selects one registration business at a time. */
async function selectBiz(biz: TableRow): Promise<void> {
  kycBizId.value = biz.id;
  openBizId.value = biz.id;
  if (!isLegacy.value) return;
  await loadTemplates();
  kycSetup.templateId = Number(app.value?.kyc_template_id) || templates.value[0]?.id || undefined;
  selectedTemplate.value = templates.value.find((x) => x.id === kycSetup.templateId) ?? templates.value[0] ?? null;
}

async function loadTemplates(): Promise<void> {
  templates.value = await apiOnboardingKycTemplates();
  selectedTemplate.value = templates.value.find((x) => x.id === kycSetup.templateId) ?? null;
}


function templateDocs(tpl: TableRow | null): { name: string; doc_type: string; required: boolean }[] {
  if (!tpl) return [];
  try {
    return JSON.parse(String(tpl.docs || '[]'));
  } catch {
    return [];
  }
}

// 公共模板统一在平台配置中管理，避免旧入口覆盖申请正在引用的版本。
const router = useRouter();
function openEditTemplate(): void {
  if (!user.hasPerm('config:kyc:edit')) return;
  void router.push({ path: '/config/overview', query: { section: 'onboarding' } });
}

async function sendKyc(): Promise<void> {
  if (!app.value) return;
  kycSending.value = true;
  try {
    await apiOnboardingSendKyc({ id: app.value.id, submissionMethod: kycSetup.submissionMethod });
    message.success(t('merchant.onboardingPage.kycSent'));
    await loadDetail(app.value.id);
    kycSetup.templateId = Number(app.value.kyc_template_id) || templates.value[0]?.id;
    await loadTemplates();
    selectedTemplate.value = templates.value.find((x) => x.id === kycSetup.templateId) ?? templates.value[0] ?? null;
    await load();
  } finally {
    kycSending.value = false;
  }
}

async function sendReminder(): Promise<void> {
  if (!app.value) return;
  await apiOnboardingSendReminder(app.value.id);
  message.success(t('merchant.onboardingPage.reminderSent'));
  await loadDetail(app.value.id);
}

// ---------- §7 内部备注 ----------
const noteText = ref('');
const noteSaving = ref(false);
/** 有输入内容且可编辑时才允许提交(按钮禁用联动) */
const canAddNote = computed(() => editable.value && noteText.value.trim().length > 0);
async function addNote(): Promise<void> {
  if (!app.value) return;
  if (!noteText.value.trim()) {
    message.warning(t('merchant.onboardingPage.noteRequired'));
    return;
  }
  noteSaving.value = true;
  try {
    await apiOnboardingAddNote(app.value.id, noteText.value);
    noteText.value = '';
    await loadDetail(app.value.id);
  } finally {
    noteSaving.value = false;
  }
}

// ---------- 通过 / 驳回 ----------
const approveOpen = ref(false);
const approveTarget = ref<TableRow | null>(null);
const approveSaving = ref(false);
function openApprove(row: TableRow): void {
  approveTarget.value = row;
  approveOpen.value = true;
}
async function doApprove(): Promise<void> {
  if (!approveTarget.value) return;
  approveSaving.value = true;
  try {
    await apiOnboardingApprove(approveTarget.value.id);
    message.success(t('merchant.onboardingPage.approveSuccess'));
    approveOpen.value = false;
    drawerOpen.value = false;
    await load();
  } finally {
    approveSaving.value = false;
  }
}

const finalApproveOpen = ref(false);
const finalApproveSaving = ref(false);
const finalChannels = ref<string[]>([]);
const testCredentialsOpen = ref(false);
const testCredentialsLoading = ref(false);
const testCredentials = ref<TableRow | null>(null);
async function showTestCredentials(): Promise<void> {
  if (!app.value) return;
  testCredentialsLoading.value = true;
  testCredentials.value = null;
  try {
    testCredentials.value = await apiOnboardingTestCredentials(app.value.id);
    testCredentialsOpen.value = true;
  } finally {
    testCredentialsLoading.value = false;
  }
}
function openFinalApprove(): void {
  const verified = credentialChannel.value;
  finalChannels.value = [verified, 'inapp'].filter(Boolean);
  finalApproveOpen.value = true;
}
async function doFinalApprove(): Promise<void> {
  if (!app.value) return;
  const verified = credentialChannel.value;
  if (!finalChannels.value.includes(verified)) {
    message.warning(t('merchant.onboardingPage.finalVerifiedChannelRequired'));
    return;
  }
  finalApproveSaving.value = true;
  try {
    const requestId = `final-${app.value.id}-${genUUID().replace(/-/g, '')}`;
    finalApprovalResult.value = await apiOnboardingFinalApprove({ id: app.value.id, requestId, channels: finalChannels.value });
    message.success(t('merchant.onboardingPage.finalApproveSuccess'));
    finalApproveOpen.value = false;
    await loadDetail(app.value.id);
    await load();
    if (finalApprovalResult.value?.testMode) await showTestCredentials();
  } finally {
    finalApproveSaving.value = false;
  }
}
async function retryCredential(deliveryId: number): Promise<void> {
  await apiOnboardingCredentialRetry(deliveryId);
  message.success(t('merchant.onboardingPage.credentialRetryComplete'));
  if (app.value) await loadDetail(app.value.id);
}

async function startRegistrationReview(): Promise<void> {
  if (!app.value) return;
  await apiOnboardingRegistrationReviewStart(app.value.id);
  message.success(t('merchant.onboardingPage.reviewStarted'));
  await loadDetail(app.value.id);
  await load();
}

const resubmitOpen = ref(false);
const resubmitReason = ref('');
const resubmitSaving = ref(false);
async function doRequestResubmit(): Promise<void> {
  if (!app.value || !resubmitReason.value.trim()) {
    message.warning(t('merchant.onboardingPage.resubmitReasonRequired'));
    return;
  }
  resubmitSaving.value = true;
  try {
    await apiOnboardingRegistrationResubmit(app.value.id, resubmitReason.value.trim());
    message.success(t('merchant.onboardingPage.resubmitSuccess'));
    resubmitOpen.value = false;
    drawerOpen.value = false;
    await load();
  } finally {
    resubmitSaving.value = false;
  }
}

const rejectOpen = ref(false);
const rejectTarget = ref<TableRow | null>(null);
const rejectReasonCode = ref<number | undefined>(undefined);
const rejectNote = ref('');
const rejectSaving = ref(false);
function openReject(row: TableRow): void {
  rejectTarget.value = row;
  rejectReasonCode.value = undefined;
  rejectNote.value = '';
  rejectOpen.value = true;
}
async function doReject(): Promise<void> {
  if (!rejectTarget.value) return;
  if (!rejectReasonCode.value) {
    message.warning(t('merchant.onboardingPage.selectReasonWarning'));
    return;
  }
  rejectSaving.value = true;
  try {
    await apiOnboardingReject(rejectTarget.value.id, rejectReasonCode.value, rejectNote.value);
    message.success(t('merchant.onboardingPage.rejectSuccess'));
    rejectOpen.value = false;
    drawerOpen.value = false;
    await load();
  } finally {
    rejectSaving.value = false;
  }
}

// ---------- 录入线索 ----------
const createOpen = ref(false);
const createSaving = ref(false);
const createForm = reactive({
  siteId: 0,
  registrationPhone: '',
  registrationEmail: '',
  companyName: '',
  companyGroupName: '',
  regNumber: '',
  country: '',
  businessTypes: [] as string[],
  numBusinesses: 1,
  businesses: [] as {
    businessName: string;
    businessType: string;
    city: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
  }[],
});
function openCreate(): void {
  createForm.siteId = user.profile?.siteId || 0;
  createForm.registrationPhone = '';
  createForm.registrationEmail = '';
  createForm.companyName = '';
  createForm.companyGroupName = '';
  createForm.regNumber = '';
  createForm.country = '';
  createForm.businessTypes = [];
  createForm.numBusinesses = 1;
  createForm.businesses = [{ businessName: '', businessType: '', city: '', contactName: '', contactPhone: '', contactEmail: '' }];
  createOpen.value = true;
}

function addBusinessRow(): void {
  createForm.businesses.push({ businessName: '', businessType: '', city: '', contactName: '', contactPhone: '', contactEmail: '' });
}

function removeBusinessRow(index: number): void {
  createForm.businesses.splice(index, 1);
}

async function doCreate(): Promise<void> {
  if (isSuper.value && createForm.siteId <= 0) {
    message.warning(t('merchant.onboardingPage.siteRequired'));
    return;
  }
  if (!createForm.companyName.trim()) {
    message.warning(t('merchant.onboardingPage.companyNameRequired'));
    return;
  }
  if (!createForm.registrationPhone.trim() || !createForm.registrationEmail.trim()) {
    message.warning(t('merchant.onboardingPage.registrationContactsRequired'));
    return;
  }
  const validBusinesses = createForm.businesses.filter((b) => b.businessName.trim());
  if (validBusinesses.length === 0) {
    message.warning(t('merchant.onboardingPage.businessRequired'));
    return;
  }
  createSaving.value = true;
  try {
    await apiOnboardingAdd({
      siteId: createForm.siteId,
      registrationPhone: createForm.registrationPhone,
      registrationEmail: createForm.registrationEmail,
      companyName: createForm.companyName,
      companyGroupName: createForm.companyGroupName,
      regNumber: createForm.regNumber,
      country: createForm.country,
      businessTypes: createForm.businessTypes.join(','),
      numBusinesses: Math.max(1, createForm.numBusinesses, validBusinesses.length),
      businesses: validBusinesses,
    });
    message.success(t('merchant.onboardingPage.leadCreated'));
    createOpen.value = false;
    await load();
  } finally {
    createSaving.value = false;
  }
}

// 运营指派下拉首项(未指派)
const unassignedOpsOption = computed(() => [{ value: 0, label: t('merchant.onboardingPage.unassigned') }]);

onMounted(() => {
  void load();
  void loadOps();
});
</script>

<template>
  <PageContainer class="onboarding-page">
    <!-- 页面标题区(eyebrow + 主标题 + 描述) -->
    <div class="ob-header">
      <div>
        <div class="ob-eyebrow">{{ t('merchant.onboardingPage.subtitle') }}</div>
        <h1 class="ob-title">{{ t('merchant.onboardingPage.title') }}</h1>
        <div class="ob-desc">{{ t('merchant.onboardingPage.pageDesc') }}</div>
      </div>
      <a-space>
        <a-button class="ob-export-btn" @click="exportList">
          <template #icon><DownloadOutlined /></template>{{ t('common.export') }}
        </a-button>
        <a-button v-perm="'merchant:onboarding:create'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('merchant.onboardingPage.newLead') }}
        </a-button>
      </a-space>
    </div>
    <!-- 五状态卡片导航(原型:Onboarding/Pending Verification/Approved/Rejected/Resubmission) -->
    <MerchantVerifyNav class="ob-queue-nav" :active="'onboarding'" />
    <!-- 搜索筛选条(SearchFilterBar:关键词 + 业态/国家筛选 + 结果数摘要) -->
    <SearchFilterBar
      v-model="query.keyword"
      :filter-values="sfbFilters"
      @update:filter-values="Object.assign(sfbFilters, $event)"
      :filters="SEARCH_FILTERS"
      :placeholder="t('merchant.onboardingPage.keywordPlaceholder')"
      :total="pagination.total"
      :result-label="t('merchant.onboardingPage.resultCount')"
      @search="handleSfbSearch"
    />

    <a-table
      class="ob-pagination"
      :columns="columns"
      :data-source="list"
      :loading="loading"
      :pagination="tablePagination"
      row-key="id"
      size="middle"
      :scroll="{ x: 1152 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'app_no'">
          <a href="#" class="ob-lead-link" :title="record.app_no" @click.prevent="openDetail(record)">{{ record.app_no }}</a>
        </template>
        <template v-else-if="column.dataIndex === 'merchant_name'">
          <div class="ob-merchant-name" :title="record.merchant_name || record.company_name">{{ record.merchant_name || record.company_name || '-' }}</div>
          <div class="ob-merchant-city">{{ record.business_city || '-' }}</div>
        </template>
        <template v-else-if="column.dataIndex === 'business_names'">{{ record.business_names || '-' }}</template>
        <template v-else-if="column.dataIndex === 'reg_number'"><span class="ob-mono-value">{{ record.reg_number || '-' }}</span></template>
        <template v-else-if="column.dataIndex === 'submitted_at'">{{ formatDate(record.submitted_at) }}</template>
        <template v-else-if="column.key === 'progress'">
          <div class="ob-progress-badge"><StatusTag :value="0" :map="{ 0: onboardingProgress(record).status }" /></div>
        </template>
        <template v-else-if="column.dataIndex === 'assigned_ops_name'">
          <span :style="{ color: record.assigned_ops_name ? undefined : 'var(--sap-muted)' }">{{ record.assigned_ops_name || t('merchant.onboardingPage.unassigned') }}</span>
        </template>
        <template v-else-if="column.key === 'action_col'">
          <a-tooltip :title="t('common.detail')">
            <a-button type="link" size="small" @click="openDetail(record)">
              <EyeOutlined />
            </a-button>
          </a-tooltip>
        </template>
      </template>
    </a-table>

    <!-- 详情抽屉:7 分区审核工作台 -->
    <a-drawer v-model:open="drawerOpen" root-class-name="onboarding-drawer" width="760" :closable="false" :mask-closable="!scopedKycBusy" :keyboard="!scopedKycBusy">
      <template #title>
        <div class="ob-drawer-heading ob-detail-heading">
          <div><strong>{{ t('merchant.onboardingPage.drawerTitle') }}</strong><span v-if="app">{{ app.app_no }} · {{ app.merchant_name || app.company_name }}</span></div>
          <a-button type="text" :disabled="scopedKycBusy" :aria-label="t('common.close')" @click="drawerOpen = false"><CloseOutlined /></a-button>
        </div>
      </template>
      <a-spin :spinning="detailLoading">
        <template v-if="app">
          <!-- §1 入驻状态卡(原型三段式:状态行随阶段配色 + 步骤条/拒绝提示 + 信息行) -->
          <div class="onboarding-stage-card">
            <div class="stage-card__status" :style="stageCardStyle">
              <StatusTag :value="0" :map="{ 0: currentProgress.status }" />
              <span class="stage-card__stage-text">{{ t('merchant.onboardingPage.colProgress') }}</span>
              <div v-if="editable && isLegacy" class="stage-card__change">
                <span class="stage-card__change-label">{{ t('merchant.onboardingPage.change') }}</span>
                <a-select
                  v-perm="'merchant:onboarding:update'"
                  :value="app.stage"
                  class="stage-change-select"
                  style="width: 145px"
                  :options="STAGE_OPTIONS"
                  @change="changeStage"
                />
              </div>
            </div>
            <div v-if="!isLegacy && [4, 5].includes(Number(app.registration_status))" class="stage-card__rejected">
              <CloseCircleOutlined />
              <span>{{ app.registration_review_reason || t('merchant.onboardingPage.rejectedNotice') }}</span>
            </div>
            <div v-else-if="isLegacy && app.stage === 6" class="stage-card__rejected">
              <CloseCircleOutlined />
              <span>{{ t('merchant.onboardingPage.rejectedNotice') }}</span>
            </div>
            <div v-else-if="isLegacy" class="stage-card__steps">
              <StageSteps :stage="app.stage" />
            </div>
            <div v-if="!isLegacy" class="ob-progress" :aria-label="t('merchant.onboardingPage.progressTitle')">
              <div v-for="(label, index) in progressLabels" :key="label" class="ob-progress__item" :class="{ 'is-active': registrationProgress === index + 1, 'is-done': registrationProgress > index + 1 }" :aria-current="registrationProgress === index + 1 ? 'step' : undefined">
                <div class="ob-progress__step">
                  <span class="ob-progress__node"><CheckCircleOutlined v-if="registrationProgress > index + 1" /><span v-else /></span>
                  <span>{{ label }}</span>
                </div>
                <span v-if="index < progressLabels.length - 1" class="ob-progress__connector" />
              </div>
            </div>
            <div class="stage-card__info">
              <div><div class="stage-card__info-label">{{ t('merchant.onboardingPage.leadId') }}</div><div class="stage-card__info-value" style="font-family: monospace">{{ app.app_no }}</div></div>
              <div><div class="stage-card__info-label">{{ t('merchant.onboardingPage.registrationDate') }}</div><div class="stage-card__info-value">{{ formatDate(app.created_at) }}</div></div>
              <div>
                <div class="stage-card__info-label">{{ t('merchant.onboardingPage.assignedOps') }}</div>
                <a-select
                  v-if="editable"
                  v-perm="'merchant:onboarding:assign'"
                  :value="app.assigned_ops_id || 0"
                  class="stage-card__ops-select"
                  size="small"
                  :options="[...unassignedOpsOption, ...opsOptions]"
                  @change="changeOps"
                />
                <div v-else class="stage-card__info-value">{{ app.assigned_ops_name || t('merchant.onboardingPage.unassigned') }}</div>
              </div>
              <div><div class="stage-card__info-label">{{ t('merchant.onboardingPage.lastUpdated') }}</div><div class="stage-card__info-value" :title="app.last_updated_at">{{ formatDate(app.last_updated_at) }}</div></div>
            </div>
          </div>

          <!-- §2 公司信息(公司/集团名称、注册号、注册国家/地区、提交时间、企业数量、企业类型、商户 ID) -->
          <div class="co-info-section">
            <div class="co-section-heading">
              <BankOutlined class="co-heading-icon" />
              <h4 class="co-heading-text">{{ t('merchant.onboardingPage.companyInfo') }}</h4>
              <div class="co-heading-line" />
            </div>
            <div class="co-grid-stack">
              <div class="co-grid co-grid--2col">
                <div class="co-cell">
                  <div class="co-cell-label">{{ t('merchant.onboardingPage.labelCompanyGroupName') }}</div>
                  <div class="co-cell-value">{{ app.company_name }}</div>
                </div>
                <div class="co-cell">
                  <div class="co-cell-label">{{ t('merchant.onboardingPage.labelRegNumber') }}</div>
                  <div class="co-cell-value">{{ app.reg_number || '-' }}</div>
                </div>
                <div class="co-cell">
                  <div class="co-cell-label">{{ t('merchant.onboardingPage.labelCountry') }}</div>
                  <div class="co-cell-value">{{ app.country || '-' }}</div>
                </div>
                <div class="co-cell">
                  <div class="co-cell-label">{{ t('merchant.onboardingPage.labelSubmitted') }}</div>
                  <div class="co-cell-value" :title="app.submitted_at">{{ formatDate(app.submitted_at) }}</div>
                </div>
              </div>
              <div class="co-grid co-grid--3col">
                <div class="co-cell">
                  <div class="co-cell-label">{{ t('merchant.onboardingPage.labelNumBusinesses') }}</div>
                  <div class="co-cell-value">{{ app.num_businesses }}</div>
                </div>
                <div class="co-cell">
                  <div class="co-cell-label">{{ t('merchant.onboardingPage.labelBusinessTypes') }}</div>
                  <div class="co-cell-value">{{ parsedTypes.map(bizTypeText).join(', ') || '-' }}</div>
                </div>
                <div class="co-cell">
                  <div class="co-cell-label">{{ t('merchant.onboardingPage.labelMerchantId') }}</div>
                  <div class="co-cell-value">{{ app.merchant_code || '-' }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="app.contact_verification?.length" class="co-info-section ob-contacts">
            <div class="co-section-heading"><SafetyCertificateOutlined class="co-heading-icon" /><h4 class="co-heading-text">{{ t('merchant.onboardingPage.contactVerification') }}</h4><div class="co-heading-line" /></div>
            <div class="ob-contacts__grid">
              <div v-for="contact in app.contact_verification" :key="contact.channel" class="co-cell">
                <div class="ob-contacts__label"><span>{{ t(`merchant.onboardingPage.contactChannels.${contact.channel}`) }}</span><span class="ob-contact-state" :class="{ 'is-verified': contact.status === 'verified' }">{{ t(`merchant.onboardingPage.contactStates.${contact.status}`) }}</span></div>
                <div class="co-cell-value">{{ contact.recipient }}</div>
                <div class="ob-contact-source">{{ t(`merchant.onboardingPage.contactSources.${contact.source}`, contact.source) }}<span v-if="contact.verifiedAt"> · {{ formatDate(contact.verifiedAt) }}</span></div>
              </div>
            </div>
          </div>

          <section v-if="!isLegacy && kyc" class="ob-merchant-kyc">
            <button type="button" class="ob-merchant-kyc__toggle" :aria-expanded="merchantKycOpen" aria-controls="merchant-kyc-documents" @click="merchantKycOpen = !merchantKycOpen">
              <SafetyCertificateOutlined class="co-heading-icon" />
              <span class="ob-merchant-kyc__title"><strong>{{ t('merchant.onboardingPage.merchantKycScope') }}</strong><span>{{ t('merchant.onboardingPage.merchantKycSharedHint') }}</span></span>
              <span class="ob-merchant-kyc__count">{{ t('merchant.onboardingPage.uploadedCount', { done: merchantUploadedCount, total: (kyc.merchantKyc.documents || []).length }) }}</span>
              <StatusTag :value="kyc.merchantKyc.status" :map="KYC_STATUS_MAP" />
              <DownOutlined class="rb-chevron" :class="{ 'is-open': merchantKycOpen }" />
            </button>
            <div v-if="merchantKycOpen" id="merchant-kyc-documents" class="ob-merchant-kyc__body">
              <KycScopeDocuments :title="t('merchant.onboardingPage.merchantKycScope')" :subtitle="app.company_name || ''" :status="kyc.merchantKyc.status" :documents="kyc.merchantKyc.documents || []" scope-type="merchant" :business-id="0" :formal-merchant="!!app.merchant_id" :busy="scopedKycBusy" :can-review="canReviewScopedDoc" @review="openKycReview" @preview="openDocumentPreview" />
              <div v-if="kyc.merchantKyc.reviewReason" class="kyc-scope-reason">{{ kyc.merchantKyc.reviewReason }}</div>
              <a-button v-if="canAssistNewKyc" v-perm="'merchant:onboarding:kyc'" class="ob-merchant-kyc__assist" @click="openScopedAssist"><SafetyCertificateOutlined />{{ t('merchant.onboardingPage.methodAssist') }}</a-button>
            </div>
          </section>

          <!-- §3 注册企业(手风琴表格:点击行展开业务提交详情) -->
          <div class="co-info-section">
            <div class="co-section-heading">
              <MenuOutlined class="co-heading-icon" />
              <h4 class="co-heading-text">{{ t('merchant.onboardingPage.registeredBusinesses') }} ({{ businesses.length }})</h4>
              <div class="co-heading-line" />
            </div>
            <div v-if="businesses.length" class="rb-table">
              <div class="rb-head">
                <span class="rb-th rb-c-index">#</span>
                <span class="rb-th rb-c-name">{{ t('merchant.onboardingPage.labelRegisteredBusinessName') }}</span>
                <span class="rb-th rb-c-type">{{ t('merchant.onboardingPage.bizDetailBusinessType') }}</span>
                <span class="rb-th rb-c-city">{{ t('merchant.onboardingPage.bizColCity') }}</span>
                <span class="rb-th rb-c-kyc">{{ t('merchant.onboardingPage.bizColKyc') }}</span>
                <span class="rb-th rb-c-exp" />
              </div>
              <template v-for="(biz, idx) in businesses" :key="biz.id">
                <div class="rb-row" role="button" tabindex="0" :aria-expanded="openBizId === biz.id" :class="{ 'is-open': openBizId === biz.id, 'is-selected': kycBizId === biz.id }" @click="toggleBiz(biz.id, biz)" @keydown.enter.prevent="toggleBiz(biz.id, biz)" @keydown.space.prevent="toggleBiz(biz.id, biz)">
                  <span class="rb-td rb-c-index">{{ idx + 1 }}</span>
                  <span class="rb-td rb-c-name">
                    <span class="rb-emoji">{{ BIZ_TYPE_EMOJI[biz.business_type] || '🏢' }}</span>
                    <span class="rb-name">{{ biz.business_name || '-' }}</span>
                  </span>
                  <span class="rb-td rb-c-type">{{ bizTypeText(biz.business_type) || '-' }}</span>
                  <span class="rb-td rb-c-city">{{ biz.city || '-' }}</span>
                  <span class="rb-td rb-c-kyc">
                    <StatusTag :value="0" :map="{ 0: businessKycBadge(biz) }" />
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
            <a-empty v-else :description="t('merchant.onboardingPage.noBusinesses')" :image="undefined" style="margin: 12px 0" />
          </div>

          <!-- §4 Operations Assessment(原型:同 §2 标题行 + 斜体副标题;保留:操作类型/预计发布日期/操作笔记;保存按钮在操作笔记下方) -->
          <div class="oa-section">
            <div class="co-section-heading">
              <SafetyCertificateOutlined class="co-heading-icon" />
              <h4 class="co-heading-text">{{ t('merchant.onboardingPage.opsAssessment') }}</h4>
              <div class="co-heading-line" />
            </div>
            <div class="oa-subtitle">{{ t('merchant.onboardingPage.opsAssessmentSubtitle') }}</div>
            <div class="oa-grid">
              <div class="oa-field">
                <div class="oa-label">{{ t('merchant.onboardingPage.operatorType') }}</div>
                <a-select v-model:value="assessment.operatorType" :disabled="!editable" allow-clear :placeholder="t('merchant.onboardingPage.selectPlaceholder')" :options="OPERATOR_TYPES" style="width: 100%" />
              </div>
              <div class="oa-field">
                <div class="oa-label">{{ t('merchant.onboardingPage.expectedLaunchDate') }}</div>
                <a-date-picker v-model:value="assessment.expectedLaunchDate" value-format="YYYY-MM-DD" :disabled="!editable" style="width: 100%" />
              </div>
            </div>
            <div class="oa-field oa-notes">
              <div class="oa-label">{{ t('merchant.onboardingPage.operationsNotes') }}</div>
              <a-textarea v-model:value="assessment.operationsNotes" :disabled="!editable" :rows="3" :placeholder="t('merchant.onboardingPage.operationsNotesPlaceholder')" />
            </div>
            <div class="oa-save-row">
              <a-button v-perm="'merchant:onboarding:update'" :disabled="!editable" :loading="assessmentSaving" type="default" size="small" class="oa-save-btn" @click="saveAssessment">{{ t('merchant.onboardingPage.saveAssessment') }}</a-button>
            </div>
          </div>

          <template v-if="isLegacy">
          <!-- §5 KYC 设置与访问(旧流程兼容展示) -->
          <div class="kyc-heading">
            <SafetyCertificateOutlined class="kyc-heading-icon" />
            <span>{{ t('merchant.onboardingPage.kycSetup') }}</span>
          </div>
          <!-- §5 KYC 主体仅在存在注册商户时展示,否则提示暂无注册商户 -->
          <template v-if="currentBiz">
          <!-- 当前选中企业(点击上方注册企业表格切换) -->
          <div class="kyc-rb-subheader">
            <div class="kyc-rb-card kyc-rb-card--active" @click="openBizId = currentBiz.id">
              <div class="kyc-rb-icon">{{ BIZ_TYPE_EMOJI[currentBiz.business_type] || '🏢' }}</div>
              <div class="kyc-rb-main">
                <div class="kyc-rb-name">{{ currentBiz.business_name }}</div>
                <div class="kyc-rb-sub">{{ bizTypeText(currentBiz.business_type) }} · {{ t('merchant.onboardingPage.kycSwitchHint') }}</div>
              </div>
              <span
                v-if="RB_KYC_BADGE[currentBiz.kyc_status]"
                class="rb-badge"
                :style="{ background: RB_KYC_BADGE[currentBiz.kyc_status].bg, color: RB_KYC_BADGE[currentBiz.kyc_status].color, borderColor: RB_KYC_BADGE[currentBiz.kyc_status].border }"
              >{{ RB_KYC_BADGE[currentBiz.kyc_status].text }}</span>
            </div>
          </div>
          <div class="kyc-grid">
            <div class="kyc-field kyc-field--template">
              <div class="kyc-label">Unified KYC checklist</div>
              <div class="kyc-doc-card__title">{{ selectedTemplate?.name || 'Unified Merchant KYC' }}</div>
              <div class="oa-subtitle">The same checklist is sent for every application and is not based on business type.</div>
            </div>
          </div>
          <template v-if="templateDocs(selectedTemplate).length">
            <div class="kyc-doc-card">
              <div class="kyc-doc-card__head">
                <span class="kyc-doc-card__title">{{ t('merchant.onboardingPage.requiredDocuments') }}<template v-if="selectedTemplate"> — {{ selectedTemplate.name }}</template></span>
                <span class="kyc-doc-card__count">{{ t('merchant.onboardingPage.docCount', { n: templateDocs(selectedTemplate).length }) }}</span>
              </div>
              <ul class="kyc-doc-card__list">
                <li v-for="doc in templateDocs(selectedTemplate)" :key="doc.doc_type" class="kyc-doc-card__item">
                  <CheckCircleOutlined class="kyc-doc-card__icon" />
                  <span>{{ doc.name }}</span>
                </li>
              </ul>
            </div>
          </template>
          <!-- 动作按钮(原型:Preview Requirements / Edit Template / Send KYC Request) -->
          <div class="kyc-action-row">
            <button type="button" class="kyc-btn kyc-btn--preview" :disabled="!selectedTemplate" @click="previewOpen = true">
              <EyeOutlined />{{ t('merchant.onboardingPage.previewRequirements') }}
            </button>
            <button v-perm="'config:kyc:edit'" type="button" class="kyc-btn kyc-btn--edit" @click="openEditTemplate">
              <EditOutlined />{{ t('kycTemplate.title') }}
            </button>
            <a-button
              v-perm="'merchant:onboarding:kyc'"
              :disabled="!editable"
              :loading="kycSending"
              type="primary"
              class="kyc-send-btn"
              @click="sendKyc"
            ><template #icon><SendOutlined /></template>{{ t('merchant.onboardingPage.sendKycRequest') }}</a-button>
          </div>
          <!-- KYC 提交方法卡片(原型 KYC SUBMISSION METHOD) -->
          <div class="kyc-submit-card">
            <div class="kyc-submit-card__method">
              <div>
                <div class="kyc-submit-card__title">{{ t('merchant.onboardingPage.kycSubmissionMethod') }}</div>
                <button
                  type="button"
                  class="kyc-submit-card__tag"
                  :class="{ 'is-active': kycSetup.submissionMethod === 1 }"
                  :disabled="!editable"
                  @click="kycSetup.submissionMethod = 1"
                >{{ t('merchant.onboardingPage.methodSelfService') }}</button>
              </div>
              <button
                type="button"
                class="kyc-submit-card__assist"
                :class="{ 'is-active': kycSetup.submissionMethod === 2 }"
                :disabled="!editable"
                @click="openAssistKyc"
              ><SafetyCertificateOutlined />{{ t('merchant.onboardingPage.methodAssistAction') }}</button>
            </div>
          </div>
          </template>
          <!-- 无注册商户空态提示 -->
          <div v-else class="kyc-empty">
            <InfoCircleOutlined class="kyc-empty__icon" />
            <span>{{ t('merchant.onboardingPage.noRegisteredBusiness') }}</span>
          </div>
          <!-- 预览弹窗(Preview Requirements) -->
          <a-modal
            v-model:open="previewOpen"
            :title="selectedTemplate ? `${t('merchant.onboardingPage.requiredDocuments')} — ${selectedTemplate.name}` : t('merchant.onboardingPage.requiredDocuments')"
            :footer="null"
            width="520px"
          >
            <div class="kyc-doc-card">
              <ul class="kyc-doc-card__list">
                <li v-for="doc in templateDocs(selectedTemplate)" :key="doc.doc_type" class="kyc-doc-card__item">
                  <CheckCircleOutlined class="kyc-doc-card__icon" />
                  <span>{{ doc.name }}</span>
                </li>
              </ul>
            </div>
          </a-modal>
          </template>

          <template v-if="!isLegacy">
            <div class="co-section-heading"><SafetyCertificateOutlined class="co-heading-icon" /><h4 class="co-heading-text">{{ t('merchant.onboardingPage.kycSetup') }}</h4><div class="co-heading-line" /></div>
            <a-alert v-if="!kyc" class="ob-kyc-locked-hint" type="info" show-icon :message="t('merchant.onboardingPage.kycLockedHint')" />
            <template v-else>
              <div v-if="currentBiz" class="ob-business-kyc-summary">
                <span class="ob-business-kyc-summary__icon">{{ BIZ_TYPE_EMOJI[currentBiz.business_type] || '🏢' }}</span>
                <div><strong>{{ currentBiz.business_name }}</strong><p>{{ t('merchant.onboardingPage.businessKycSwitchHint') }}</p></div>
                <StatusTag v-if="currentProperty" :value="currentProperty.kycStatus" :map="KYC_STATUS_MAP" />
              </div>
            <p v-if="canAssistNewKyc" class="ob-helper">{{ t('merchant.onboardingPage.reviewScopeHint') }}</p>
            <div v-if="currentBiz" class="ob-business-kyc-context">
              <div><span class="kyc-label">{{ t('merchant.onboardingPage.verificationScope') }}</span><a-tag color="blue">{{ t('merchant.onboardingPage.propertyKycScope') }}</a-tag></div>
              <div><span class="kyc-label">{{ t('merchant.onboardingPage.businessType') }}</span><a-tag>{{ bizTypeText(currentBiz.business_type) }}</a-tag></div>
            </div>
            <PropertyKycTemplate v-if="currentProperty" :key="`${app.id}:${currentProperty.applicationBusinessId}`" :application-id="Number(app.id)" :property="currentProperty" :busy="scopedKycBusy" @saved="refreshPropertyTemplate">
              <KycScopeDocuments v-if="currentProperty" :title="t('merchant.onboardingPage.propertyKycScope')" :subtitle="currentProperty.businessName" :status="currentProperty.kycStatus" :documents="currentProperty.documents || []" scope-type="property" :business-id="currentProperty.applicationBusinessId" :formal-merchant="!!app?.merchant_id"  :busy="scopedKycBusy" :can-review="canReviewScopedDoc" @review="openKycReview" @preview="openDocumentPreview" />
              <div v-if="currentProperty?.reviewReason" class="kyc-scope-reason">{{ currentProperty.reviewReason }}</div>
              <template #actions>
                <a-button class="ob-preview-requirements" @click="requirementsOpen = true"><EyeOutlined />{{ t('merchant.onboardingPage.previewRequirements') }}</a-button>
              </template>
            </PropertyKycTemplate>
            <div class="kyc-submit-card">
              <div class="kyc-submit-card__method">
                <div><div class="kyc-submit-card__title">{{ t('merchant.onboardingPage.kycSubmissionMethod') }}</div><span class="kyc-submit-card__tag">{{ t(Number(app.submission_method) === 2 ? 'merchant.onboardingPage.methodAssist' : 'merchant.onboardingPage.methodSelfService') }}</span></div>
                <button v-if="canAssistNewKyc" v-perm="'merchant:onboarding:kyc'" type="button" class="kyc-submit-card__assist" @click="openScopedAssist"><SafetyCertificateOutlined />{{ t('merchant.onboardingPage.methodAssist') }}</button>
                <span v-else class="ob-helper">{{ t('merchant.onboardingPage.assistCompletedHint') }}</span>
              </div>
            </div>
            <div class="kyc-agreement-row">
              <span>{{ t('merchant.onboardingPage.currentAgreement') }}</span>
              <strong>{{ kyc.agreement?.title }} · v{{ kyc.agreement?.version }}</strong>
              <StatusTag :value="kyc.agreement?.status" :map="{
                signed: { text: t('merchant.onboardingPage.agreementSigned'), color: 'success' },
                test_confirmed: { text: t('merchant.onboardingPage.testAgreementConfirmed'), color: 'orange' },
                unsigned: { text: t('merchant.onboardingPage.agreementUnsigned'), color: 'warning' },
                resign_required: { text: t('merchant.onboardingPage.agreementResign'), color: 'orange' },
              }" />
            </div>
            <a-alert v-if="!finalApprovalResult" :type="kyc.finalApproval?.ready ? 'success' : 'info'" :message="t(kyc.finalApproval?.ready ? 'merchant.onboardingPage.finalApprovalReady' : 'merchant.onboardingPage.finalApprovalBlocked')" :description="kyc.finalApproval?.ready ? t('merchant.onboardingPage.finalApprovalReadyDesc') : finalApprovalBlockReasons" show-icon class="kyc-readiness" />
            <div v-if="finalApprovalResult" class="kyc-scope-card">
              <div class="kyc-scope-card__head">
                <div>
                  <strong>{{ t('merchant.onboardingPage.finalApprovedTitle') }}</strong>
                  <span>{{ finalApprovalResult.accessCode }} · {{ t(finalApprovalResult.accountStatus === 'active' ? 'merchant.onboardingPage.accountActivated' : 'merchant.onboardingPage.pendingActivation') }}</span>
                </div>
                <a-tag color="success">{{ finalApprovalResult.finalApprovedAt }}</a-tag>
              </div>
              <a-alert v-if="finalApprovalResult.testMode" type="warning" show-icon :message="t('merchant.onboardingPage.testDeliverySkipped')" style="margin-bottom: 12px" />
              <a-button
                v-if="isSuper && finalApprovalResult.testMode && finalApprovalResult.accountStatus === 'pending_activation'"
                v-perm="'merchant:onboarding:final-approve'"
                type="primary"
                :loading="testCredentialsLoading"
                @click="showTestCredentials"
              >{{ t('merchant.onboardingPage.showTestCredentials') }}</a-button>
              <template v-if="!finalApprovalResult.testMode">
              <div v-for="delivery in finalApprovalResult.deliveries || []" :key="delivery.id" class="kyc-scope-doc">
                <span>{{ delivery.channel }} · {{ delivery.recipient }} · {{ t(`merchant.onboardingPage.credentialStatus.${delivery.status}`) }} ({{ delivery.attempts }}/{{ delivery.maxAttempts }})<br v-if="delivery.lastError" />{{ delivery.lastError ? t(`merchant.onboardingPage.credentialErrors.${delivery.lastError}`, delivery.lastError) : '' }}</span>
                <a-button
                  v-if="!['delivered', 'accepted'].includes(delivery.status)"
                  v-perm="'merchant:onboarding:credential-retry'"
                  type="link"
                  size="small"
                  @click="retryCredential(delivery.id)"
                >{{ t('merchant.onboardingPage.retryCredential') }}</a-button>
              </div>
              </template>
            </div>
            </template>
          </template>

          <!-- §6 Activity Timeline(标题复用 co-section-heading:灰色图标 + 大写标题 + 右侧延伸线;时间线本体对齐原型左边框竖线/圆点/日期/type标签/action/by) -->
          <button type="button" class="co-section-heading timeline-toggle" :aria-expanded="timelineExpanded" aria-controls="onboarding-timeline" @click="timelineExpanded = !timelineExpanded">
            <ClockCircleOutlined class="co-heading-icon" />
            <span class="co-heading-text">{{ t('merchant.onboardingPage.activityTimeline') }} ({{ timeline.length }})</span>
            <span class="co-heading-line" />
            <span class="timeline-toggle-label">{{ t(timelineExpanded ? 'common.collapse' : 'common.expand') }}</span>
            <DownOutlined class="timeline-toggle-arrow" :class="{ 'is-expanded': timelineExpanded }" />
          </button>
          <div id="onboarding-timeline" v-show="timelineExpanded" class="timeline-scroll">
          <div v-if="timeline.length" class="onb-tl">
            <div v-for="ev in timeline" :key="ev.id" class="onb-tl-item">
              <div class="onb-tl-dot" :style="{ background: tlSource(ev.actor_type).dot, boxShadow: `0 0 0 2px ${tlSource(ev.actor_type).dot}` }" />
              <div class="onb-tl-row">
                <span class="onb-tl-date">{{ tlDate(ev.created_at) }}</span>
                <span class="onb-tl-tag" :style="{ color: tlSource(ev.actor_type).color, background: `${tlSource(ev.actor_type).dot}15` }">{{ tlSource(ev.actor_type).label }}</span>
              </div>
              <div class="onb-tl-action" :style="ev.is_exception === 1 ? 'color:#dc2626' : ''">{{ ev.note || ev.action }}</div>
              <div class="onb-tl-by">by {{ ev.operator_name || t('merchant.onboardingPage.system') }}</div>
            </div>
          </div>
          <a-empty v-else :description="t('merchant.onboardingPage.noTimeline')" :image="undefined" style="margin: 12px 0" />
          </div>

          <!-- §7 Internal Notes -->
          <!-- §7 内部笔记(标题复用 co-section-heading + 图标;列表卡片与多行输入对齐原型 ci 组件) -->
          <div class="co-section-heading internal-notes-heading">
            <EditOutlined class="co-heading-icon" />
            <h4 class="co-heading-text">{{ t('merchant.onboardingPage.internalNotes') }}</h4>
            <div class="co-heading-line" />
          </div>
          <div v-if="notes.length" class="onb-notes">
            <div v-for="note in notes" :key="note.id" class="onb-note">
              <div class="onb-note__head">
                <div class="onb-note__avatar">{{ (note.author_name || '?').slice(0, 2).toUpperCase() }}</div>
                <span class="onb-note__by">{{ note.author_name }}</span>
                <span class="onb-note__date">{{ note.created_at }}</span>
              </div>
              <div class="onb-note__text">{{ note.note }}</div>
            </div>
          </div>
          <a-empty v-else :description="t('merchant.onboardingPage.noNotes')" :image="undefined" style="margin: 12px 0" />
          <a-textarea
            v-model:value="noteText"
            :disabled="!editable"
            :rows="3"
            class="onb-note-input"
            :placeholder="t('merchant.onboardingPage.notePlaceholder')"
          />
          <div class="onb-note-actions">
            <a-button v-perm="'merchant:onboarding:update'" type="primary" :disabled="!canAddNote" :loading="noteSaving" class="kyc-note-btn" @click="addNote"><template #icon><PlusOutlined /></template>{{ t('merchant.onboardingPage.addNote') }}</a-button>
          </div>

        </template>
      </a-spin>
      <template #footer>
        <div v-if="app && (editable || (!isLegacy && kyc))" class="drawer-footer">
          <template v-if="isLegacy">
            <a-button v-perm="'merchant:onboarding:kyc'" class="drawer-footer-btn drawer-footer-btn--ghost" @click="sendReminder">{{ t('merchant.onboardingPage.sendReminder') }}</a-button>
            <a-button v-perm="'merchant:onboarding:registration-approve'" class="drawer-footer-btn drawer-footer-btn--primary" @click="openApprove(app)">{{ t('merchant.onboardingPage.approveOnboarding') }}</a-button>
            <a-button v-perm="'merchant:onboarding:reject'" class="drawer-footer-btn drawer-footer-btn--danger" @click="openReject(app)">{{ t('merchant.onboardingPage.rejectLead') }}</a-button>
          </template>
          <a-button v-if="registrationReviewable" v-perm="'merchant:onboarding:update'" class="drawer-footer-btn drawer-footer-btn--primary" @click="startRegistrationReview">{{ t('merchant.onboardingPage.startReview') }}</a-button>
          <template v-if="registrationDecisionable">
            <a-button v-perm="'merchant:onboarding:registration-approve'" class="drawer-footer-btn drawer-footer-btn--primary" @click="openApprove(app)">{{ t('merchant.onboardingPage.approveRegistration') }}</a-button>
            <a-button v-perm="'merchant:onboarding:update'" class="drawer-footer-btn drawer-footer-btn--ghost" @click="resubmitReason = ''; resubmitOpen = true">{{ t('merchant.onboardingPage.requestCorrection') }}</a-button>
            <a-button v-perm="'merchant:onboarding:reject'" class="drawer-footer-btn drawer-footer-btn--danger" @click="openReject(app)">{{ t('merchant.onboardingPage.rejectRegistration') }}</a-button>
          </template>
          <template v-if="!isLegacy && kyc">
            <a-button v-if="canAssistNewKyc" v-perm="'merchant:onboarding:kyc'" class="drawer-footer-btn drawer-footer-btn--ghost" @click="openScopedAssist">{{ t('merchant.onboardingPage.methodAssist') }}</a-button>
            <a-button v-if="!finalApprovalResult && finalApprovable" v-perm="'merchant:onboarding:final-approve'" class="drawer-footer-btn drawer-footer-btn--primary" :disabled="!kyc.finalApproval?.ready" @click="openFinalApprove"><CheckCircleOutlined />{{ t('merchant.onboardingPage.finalApproveAction') }}</a-button>
          </template>
        </div>
      </template>
    </a-drawer>

    <a-modal v-model:open="requirementsOpen" :title="t('merchant.onboardingPage.previewRequirements')" :footer="null" width="720">
      <template v-if="kyc">
        <p class="ob-helper">{{ t('merchant.onboardingPage.scopeReadOnlyHint') }}</p>
            <KycScopeDocuments :title="t('merchant.onboardingPage.merchantKycScope')" :subtitle="app?.company_name || ''" :status="kyc.merchantKyc.status" :documents="kyc.merchantKyc.documents || []" scope-type="merchant" :business-id="0" :formal-merchant="!!app?.merchant_id"  @preview="openDocumentPreview" />
            <div v-if="kyc.merchantKyc.reviewReason" class="kyc-scope-reason">{{ kyc.merchantKyc.reviewReason }}</div>
            <div class="ob-scope-toolbar">
              <label>{{ t('merchant.onboardingPage.selectedProperty') }}</label>
              <a-select :value="kycBizId" :options="propertyOptions" :disabled="scopedKycBusy" @change="selectBusinessId" />
              <StatusTag v-if="currentProperty" :value="currentProperty.kycStatus" :map="KYC_STATUS_MAP" />
            </div>
            <KycScopeDocuments v-if="currentProperty" :title="t('merchant.onboardingPage.propertyKycScope')" :subtitle="currentProperty.businessName" :status="currentProperty.kycStatus" :documents="currentProperty.documents || []" scope-type="property" :business-id="currentProperty.applicationBusinessId" :formal-merchant="!!app?.merchant_id"  @preview="openDocumentPreview" />
            <div v-if="currentProperty?.reviewReason" class="kyc-scope-reason">{{ currentProperty.reviewReason }}</div>
      </template>
    </a-modal>
    <a-drawer v-model:open="scopedAssistOpen" root-class-name="onboarding-assist-drawer" width="720" :z-index="1100" :closable="false" :mask-closable="!scopedKycBusy" :keyboard="!scopedKycBusy">
      <template #title>
        <div class="ob-drawer-heading ob-detail-heading"><div><strong>{{ t('merchant.onboardingPage.assistDrawerTitle') }}</strong><span>{{ t('merchant.onboardingPage.assistDrawerSubtitle', { name: currentBiz?.business_name || app?.company_name, operator: user.profile?.realName || user.profile?.username || '-' }) }}</span></div><a-button type="text" :disabled="scopedKycBusy" :aria-label="t('common.close')" @click="scopedAssistOpen = false"><CloseOutlined /></a-button></div>
      </template>
      <template v-if="kyc">
        <p class="ob-assist-guidance">{{ t('merchant.onboardingPage.assistSavedHint') }}</p>
        <div class="assist-kyc-notice"><SafetyCertificateOutlined class="assist-kyc-notice__icon" /><div><div class="assist-kyc-notice__title">{{ t('merchant.onboardingPage.assistNoticeTitle') }}</div><div class="assist-kyc-notice__text">{{ t('merchant.onboardingPage.assistNoticeText') }}</div></div></div>
        <div v-if="currentBiz" class="ob-assist-business">
          <div class="co-section-heading"><UserOutlined class="co-heading-icon" /><h4 class="co-heading-text">{{ t('merchant.onboardingPage.assistBusinessInfo') }}</h4><div class="co-heading-line" /></div>
          <div class="co-grid co-grid--2col">
            <div class="co-cell"><div class="co-cell-label">{{ t('merchant.onboardingPage.assistBusinessName') }}</div><div class="co-cell-value">{{ currentBiz.business_name }}</div></div>
            <div class="co-cell"><div class="co-cell-label">{{ t('merchant.onboardingPage.assistContactPerson') }}</div><div class="co-cell-value">{{ currentBiz.contact_name || '-' }}</div></div>
            <div class="co-cell"><div class="co-cell-label">{{ t('merchant.onboardingPage.assistPhone') }}</div><div class="co-cell-value">{{ currentBiz.contact_phone || '-' }}</div></div>
            <div class="co-cell"><div class="co-cell-label">{{ t('merchant.onboardingPage.assistEmail') }}</div><div class="co-cell-value">{{ currentBiz.contact_email || '-' }}</div></div>
          </div>
        </div>
            <KycScopeDocuments :title="t('merchant.onboardingPage.merchantKycScope')" :subtitle="app?.company_name || ''" :status="kyc.merchantKyc.status" :documents="kyc.merchantKyc.documents || []" scope-type="merchant" :business-id="0" :formal-merchant="!!app?.merchant_id" :busy="scopedKycBusy" :can-upload="canUploadScopedDoc" @upload="uploadScopedDoc" @preview="openDocumentPreview" />
            <div v-if="kyc.merchantKyc.reviewReason" class="kyc-scope-reason">{{ kyc.merchantKyc.reviewReason }}</div>
            <div class="ob-scope-toolbar">
              <label>{{ t('merchant.onboardingPage.selectedProperty') }}</label>
              <a-select :value="kycBizId" :options="propertyOptions" :disabled="scopedKycBusy" @change="selectBusinessId" />
              <StatusTag v-if="currentProperty" :value="currentProperty.kycStatus" :map="KYC_STATUS_MAP" />
            </div>
            <KycScopeDocuments v-if="currentProperty" :title="t('merchant.onboardingPage.propertyKycScope')" :subtitle="currentProperty.businessName" :status="currentProperty.kycStatus" :documents="currentProperty.documents || []" scope-type="property" :business-id="currentProperty.applicationBusinessId" :formal-merchant="!!app?.merchant_id" :busy="scopedKycBusy" :can-upload="canUploadScopedDoc" @upload="uploadScopedDoc" @preview="openDocumentPreview" />
            <div v-if="currentProperty?.reviewReason" class="kyc-scope-reason">{{ currentProperty.reviewReason }}</div>
            <div class="kyc-agreement-row ob-assist-agreement">
              <span>{{ t('merchant.onboardingPage.currentAgreement') }}</span>
              <strong>{{ kyc.agreement?.title }} · v{{ kyc.agreement?.version }}</strong>
              <StatusTag :value="kyc.agreement?.status" :map="{
                signed: { text: t('merchant.onboardingPage.agreementSigned'), color: 'success' },
                test_confirmed: { text: t('merchant.onboardingPage.testAgreementConfirmed'), color: 'orange' },
                unsigned: { text: t('merchant.onboardingPage.agreementUnsigned'), color: 'warning' },
                resign_required: { text: t('merchant.onboardingPage.agreementResign'), color: 'orange' },
              }" />
            </div>
        <p class="ob-helper">{{ t('merchant.onboardingPage.assistNewSubmitHint') }}</p>
        <a-button v-if="canAssistNewKyc && kyc.testAgreementAvailable && !kyc.agreement?.satisfied" v-perm="'merchant:onboarding:kyc'" :disabled="scopedKycBusy" @click="openTestAgreement">{{ t('merchant.onboardingPage.testAgreementAction') }}</a-button>
      </template>
      <template #footer>
        <div class="ob-assist-footer"><a-button :disabled="scopedKycBusy" @click="scopedAssistOpen = false">{{ t('merchant.onboardingPage.assistContinueLater') }}</a-button><a-button v-perm="'merchant:onboarding:kyc'" type="primary" :disabled="!canSubmitNewKyc" :loading="scopedKycBusy" @click="submitNewKyc">{{ t('merchant.onboardingPage.assistSubmitVerification') }}</a-button></div>
      </template>
    </a-drawer>

    <!-- 旧流程协助入口保留原交互。 -->
    <a-modal v-model:open="testAgreementOpen" :z-index="1200" :title="t('merchant.onboardingPage.testAgreementAction')" :confirm-loading="scopedKycBusy" @ok="confirmTestAgreement">
      <a-alert type="warning" show-icon :message="t('merchant.onboardingPage.testAgreementWarning')" style="margin-bottom: 16px" />
      <a-form layout="vertical">
        <a-form-item :label="t('merchant.onboardingPage.testAgreementReason')" required>
          <a-textarea v-model:value="testAgreementForm.reason" :maxlength="400" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
    <a-drawer v-model:open="assistOpen" class="assist-kyc-drawer" width="720" :z-index="1100">
      <template #title>
        <div class="assist-kyc-drawer__title">
          <span class="assist-kyc-drawer__title-icon"><SafetyCertificateOutlined /></span>
          <div>
            <div class="assist-kyc-drawer__title-main">{{ t('merchant.onboardingPage.assistDrawerTitle') }}</div>
            <div class="assist-kyc-drawer__title-sub">{{ t('merchant.onboardingPage.assistDrawerSubtitle', { name: assistBiz?.business_name || app?.company_name || '-', operator: app?.assigned_ops_name || t('merchant.onboardingPage.unassigned') }) }}</div>
          </div>
        </div>
      </template>

      <div class="assist-kyc-notice">
        <SafetyCertificateOutlined class="assist-kyc-notice__icon" />
        <div>
          <div class="assist-kyc-notice__title">{{ t('merchant.onboardingPage.assistNoticeTitle') }}</div>
          <div class="assist-kyc-notice__text">{{ t('merchant.onboardingPage.assistNoticeText') }}</div>
        </div>
      </div>

      <div class="assist-kyc-section-title"><BankOutlined />{{ t('merchant.onboardingPage.assistBusinessInfo') }}</div>
      <div class="assist-kyc-form-grid">
        <div class="assist-kyc-field">
          <label>{{ t('merchant.onboardingPage.assistBusinessName') }}</label>
          <a-input :value="assistBiz?.business_name || app?.company_name" readonly />
        </div>
        <div class="assist-kyc-field">
          <label>{{ t('merchant.onboardingPage.assistContactPerson') }}</label>
          <a-input :placeholder="t('merchant.onboardingPage.assistContactPlaceholder')" />
        </div>
        <div class="assist-kyc-field">
          <label>{{ t('merchant.onboardingPage.assistPhone') }}</label>
          <a-input :placeholder="t('merchant.onboardingPage.assistPhonePlaceholder')" />
        </div>
        <div class="assist-kyc-field">
          <label>{{ t('merchant.onboardingPage.assistEmail') }}</label>
          <a-input :placeholder="t('merchant.onboardingPage.assistEmailPlaceholder')" />
        </div>
      </div>
      <div class="assist-kyc-field assist-kyc-field--full">
        <label>{{ t('merchant.onboardingPage.assistAddress') }}</label>
        <a-input :placeholder="t('merchant.onboardingPage.assistAddressPlaceholder')" />
      </div>
      <div class="assist-kyc-field assist-kyc-field--full">
        <label>{{ t('merchant.onboardingPage.assistOpsNotes') }}</label>
        <a-textarea :rows="2" :placeholder="t('merchant.onboardingPage.assistOpsNotesPlaceholder')" />
      </div>

      <div class="assist-kyc-section-title assist-kyc-section-title--docs"><FileTextOutlined />{{ t('merchant.onboardingPage.assistDocumentUpload') }}<span>{{ t('merchant.onboardingPage.assistUploadedCount', { count: assistUploadedCount, total: assistKycDocs.length }) }}</span></div>
      <div v-for="doc in assistKycDocs" :key="doc.doc_type" class="assist-kyc-document">
        <div class="assist-kyc-document__head">
          <span class="assist-kyc-document__icon"><FileTextOutlined /></span>
          <div>
            <div class="assist-kyc-document__name">{{ doc.name }}</div>
            <div class="assist-kyc-document__required">{{ doc.required ? t('merchant.onboardingPage.tplDocRequiredLabel') : t('merchant.onboardingPage.assistOptional') }}</div>
          </div>
        </div>
        <div class="assist-kyc-document__controls">
          <div>
            <div class="assist-kyc-document__label">{{ t('merchant.onboardingPage.assistUploadDocument') }}</div>
            <a-button
              size="small"
              class="assist-kyc-document__upload"
              :loading="assistUploading[doc.doc_type]"
              @click="assistSelectFile(doc)"
            ><template #icon><UploadOutlined /></template>{{ t('merchant.onboardingPage.assistChooseFile') }}</a-button>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              class="assist-kyc-document__file-input"
              :ref="(el) => assignFileInput(doc.doc_type, el)"
              @change="assistFileChanged($event, doc)"
            />
          </div>
          <div>
            <div class="assist-kyc-document__label">{{ t('merchant.onboardingPage.assistSource') }}</div>
            <a-select :value="'ops'" size="small" class="assist-kyc-document__source" :options="[{ value: 'ops', label: t('merchant.onboardingPage.assistSourceOps') }]" />
          </div>
        </div>
        <template v-if="assistUploads[doc.doc_type]">
          <div class="assist-kyc-document__uploaded">
            <div class="assist-kyc-document__uploaded-name">
              <FilePdfOutlined v-if="(assistUploads[doc.doc_type].file_url || '').toLowerCase().endsWith('.pdf')" />
              <FileImageOutlined v-else />
              <span>{{ assistUploads[doc.doc_type].file_name || assistUploads[doc.doc_type].name }}</span>
            </div>
            <a-space :size="4">
              <a-button v-if="assistUploads[doc.doc_type].file_url" size="small" type="link" @click="openDocumentPreview(assistUploads[doc.doc_type].id)">
                <template #icon><EyeOutlined /></template>{{ t('merchant.documentsPage.preview') }}
              </a-button>
              <a-button size="small" type="link" danger class="assist-kyc-document__remove" @click="removeAssistDoc(doc)">
                <template #icon><DeleteOutlined /></template>{{ t('common.delete') }}
              </a-button>
            </a-space>
          </div>
        </template>
        <div v-else class="assist-kyc-document__empty"><InfoCircleOutlined />{{ t('merchant.onboardingPage.assistNoDocument') }}</div>
      </div>

      <div class="assist-kyc-section-title assist-kyc-section-title--confirmation"><UserOutlined />{{ t('merchant.onboardingPage.assistMerchantConfirmation') }}</div>
      <div class="assist-kyc-confirmation">
        <div class="assist-kyc-confirmation__head">
          <span>{{ t('merchant.onboardingPage.assistConfirmationStatus') }}</span>
          <span class="assist-kyc-confirmation__pending"><ClockCircleOutlined />{{ t('merchant.onboardingPage.assistConfirmationPending') }}</span>
        </div>
        <div class="assist-kyc-confirmation__notice">
          <div>{{ t('merchant.onboardingPage.assistConfirmationText') }}</div>
          <div class="assist-kyc-confirmation__notice-warning">{{ t('merchant.onboardingPage.assistConfirmationWarning') }}</div>
        </div>
        <a-button type="primary" class="assist-kyc-confirmation__send"><template #icon><SendOutlined /></template>{{ t('merchant.onboardingPage.assistSendConfirmation') }}</a-button>
      </div>

      <template #footer>
        <div class="assist-kyc-footer">
          <span>{{ t('merchant.onboardingPage.assistingAs', { name: app?.assigned_ops_name || t('merchant.onboardingPage.unassigned') }) }}</span>
          <div>
            <a-button>{{ t('merchant.onboardingPage.assistSaveDraft') }}</a-button>
            <a-button type="primary" class="assist-kyc-footer__submit" @click="submitAssistVerification"><template #icon><SendOutlined /></template>{{ t('merchant.onboardingPage.assistSubmitVerification') }}</a-button>
          </div>
        </div>
      </template>
    </a-drawer>

    <!-- 录入线索 -->
    <a-modal v-model:open="createOpen" :title="t('merchant.onboardingPage.createTitle')" :confirm-loading="createSaving" :ok-text="t('merchant.onboardingPage.createOkText')" @ok="doCreate">
      <a-form layout="vertical">
        <a-alert type="info" show-icon :message="t('merchant.onboardingPage.adminContactsHint')" style="margin-bottom: 12px" />
        <a-form-item v-if="isSuper" :label="t('common.site')" required>
          <SiteTreeSelect v-model:value="createForm.siteId" :placeholder="t('merchant.onboardingPage.siteRequired')" style="width: 100%" />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item :label="t('merchant.onboardingPage.registrationPhone')" required>
              <a-input v-model:value="createForm.registrationPhone" placeholder="+959123456789" :maxlength="30" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.onboardingPage.registrationEmail')" required>
              <a-input v-model:value="createForm.registrationEmail" type="email" :maxlength="100" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item :label="t('merchant.onboardingPage.labelCompanyName')" required>
              <a-input v-model:value="createForm.companyName" :placeholder="t('merchant.onboardingPage.companyPlaceholder')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.onboardingPage.labelCompanyGroupName')">
              <a-input v-model:value="createForm.companyGroupName" :placeholder="t('merchant.onboardingPage.groupPlaceholder')" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item :label="t('merchant.onboardingPage.labelRegNumber')">
              <a-input v-model:value="createForm.regNumber" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.onboardingPage.labelCountry')">
              <a-input v-model:value="createForm.country" :placeholder="t('merchant.onboardingPage.countryPlaceholder')" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="16">
            <a-form-item :label="t('merchant.onboardingPage.labelBusinessTypes')">
              <a-select v-model:value="createForm.businessTypes" mode="multiple" :placeholder="t('merchant.onboardingPage.businessTypesPlaceholder')" :options="BUSINESS_TYPES" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item :label="t('merchant.onboardingPage.labelNumBusinesses')">
              <a-input-number v-model:value="createForm.numBusinesses" :min="1" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 业务单元明细(PRD:公司级一次,业务级各自维护) -->
        <a-divider orientation="left" style="margin: 8px 0 12px">{{ t('merchant.onboardingPage.registeredBusinesses') }}</a-divider>
        <div v-for="(biz, idx) in createForm.businesses" :key="idx" style="border: 1px solid var(--sap-border, #e2e8f0); border-radius: 8px; padding: 10px; margin-bottom: 10px">
          <a-row :gutter="8">
            <a-col :span="12">
              <a-form-item :label="`${t('merchant.onboardingPage.labelRegisteredBusinessName')} *`" style="margin-bottom: 8px">
                <a-input v-model:value="biz.businessName" :placeholder="t('merchant.onboardingPage.bizNamePlaceholder')" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('merchant.onboardingPage.labelRegisteredBusinessType')" style="margin-bottom: 8px">
                <a-select v-model:value="biz.businessType" allow-clear :placeholder="t('common.all')" :options="BUSINESS_TYPES" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('merchant.onboardingPage.bizColCity')" style="margin-bottom: 8px">
                <a-input v-model:value="biz.city" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('merchant.onboardingPage.labelRegisteredBusinessContact')" style="margin-bottom: 8px">
                <a-input v-model:value="biz.contactName" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('merchant.onboardingPage.labelRegisteredBusinessPhone')" style="margin-bottom: 8px">
                <a-input v-model:value="biz.contactPhone" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('merchant.onboardingPage.labelRegisteredBusinessEmail')" style="margin-bottom: 8px">
                <a-input v-model:value="biz.contactEmail" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-button type="link" danger size="small" @click="removeBusinessRow(idx)">{{ t('merchant.onboardingPage.removeBusiness') }}</a-button>
        </div>
        <a-button type="dashed" block @click="addBusinessRow">
          <template #icon><PlusOutlined /></template>{{ t('merchant.onboardingPage.addBusiness') }}
        </a-button>
      </a-form>
    </a-modal>

    <a-modal v-model:open="testCredentialsOpen" :title="t('merchant.onboardingPage.testCredentialsTitle')" :footer="null" :destroy-on-close="true" @after-close="testCredentials = null">
      <a-alert type="warning" show-icon :message="t('merchant.onboardingPage.testCredentialsHint')" style="margin-bottom: 16px" />
      <a-descriptions v-if="testCredentials" :column="1" bordered size="small">
        <a-descriptions-item :label="t('merchant.onboardingPage.testAccessCode')">{{ testCredentials.accessCode }}</a-descriptions-item>
        <a-descriptions-item :label="t('merchant.onboardingPage.testUsername')">{{ testCredentials.username }}</a-descriptions-item>
        <a-descriptions-item :label="t('merchant.onboardingPage.testTemporaryPassword')">{{ testCredentials.temporaryPassword }}</a-descriptions-item>
        <a-descriptions-item :label="t('merchant.onboardingPage.registrationEmail')">{{ testCredentials.email }}</a-descriptions-item>
        <a-descriptions-item :label="t('merchant.onboardingPage.registrationPhone')">{{ testCredentials.phone }}</a-descriptions-item>
        <a-descriptions-item :label="t('merchant.onboardingPage.testOtp')">{{ testCredentials.testOtpCode }}</a-descriptions-item>
      </a-descriptions>
      <p style="margin-top: 16px">{{ t('merchant.onboardingPage.testActivationSteps') }}</p>
    </a-modal>

    <!-- 入驻通过 -->
    <a-modal v-model:open="approveOpen" :title="t('merchant.onboardingPage.approveModalTitle')" :confirm-loading="approveSaving" :ok-text="t('merchant.onboardingPage.approve')" @ok="doApprove">
      <p style="margin: 8px 0">
        {{ t('merchant.onboardingPage.approveConfirm', { name: approveTarget?.company_name }) }}
      </p>
    </a-modal>

    <a-modal
      v-model:open="finalApproveOpen"
      :title="t('merchant.onboardingPage.finalApproveTitle')"
      :confirm-loading="finalApproveSaving"
      :ok-text="t('merchant.onboardingPage.finalApproveAction')"
      @ok="doFinalApprove"
    >
      <a-alert type="warning" :message="t('merchant.onboardingPage.finalApproveWarning')" show-icon style="margin-bottom: 16px" />
      <a-form layout="vertical">
        <a-form-item :label="t('merchant.onboardingPage.deliveryChannels')">
          <a-checkbox-group v-model:value="finalChannels">
            <a-checkbox :value="credentialChannel" disabled>{{ credentialChannel }}</a-checkbox>
            <a-checkbox value="inapp">{{ t('merchant.onboardingPage.inappChannel') }}</a-checkbox>
          </a-checkbox-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="resubmitOpen" :title="t('merchant.onboardingPage.resubmitModalTitle')" :confirm-loading="resubmitSaving" :ok-text="t('merchant.onboardingPage.requestCorrection')" @ok="doRequestResubmit">
      <a-form layout="vertical">
        <a-form-item :label="t('merchant.onboardingPage.resubmitReason')" required>
          <a-textarea v-model:value="resubmitReason" :rows="4" :placeholder="t('merchant.onboardingPage.resubmitReasonPlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 入驻驳回 -->
    <a-modal v-model:open="rejectOpen" :title="t('merchant.onboardingPage.rejectModalTitle')" :confirm-loading="rejectSaving" :ok-text="t('merchant.onboardingPage.rejectOkText')" :ok-button-props="{ danger: true }" @ok="doReject">
      <a-form layout="vertical">
        <a-form-item :label="t('merchant.onboardingPage.rejectionReason')" required>
          <a-select v-model:value="rejectReasonCode" :placeholder="t('merchant.onboardingPage.selectReasonPlaceholder')" :options="REJECT_REASONS.map((r) => ({ value: r.code, label: r.label }))" />
        </a-form-item>
        <a-form-item :label="t('merchant.onboardingPage.additionalNotes')">
          <a-textarea v-model:value="rejectNote" :rows="3" :placeholder="t('merchant.onboardingPage.additionalNotesPlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>
    <a-modal v-model:open="kycRejectOpen" :z-index="1200" :title="t('merchant.verifyPage.docRejectModalTitle')" :ok-text="t('common.confirm')" :cancel-text="t('common.cancel')" :confirm-loading="scopedKycBusy" :closable="!scopedKycBusy" :mask-closable="!scopedKycBusy" :keyboard="!scopedKycBusy" :cancel-button-props="{ disabled: scopedKycBusy }" @ok="rejectScopedDocument">
      <p class="ob-review-document">{{ kycReviewTarget?.scope }} · {{ kycReviewTarget?.name }}</p>
      <a-form layout="vertical">
        <a-form-item :label="t('merchant.verifyPage.rejectReasonLabel')" required>
          <a-textarea v-model:value="kycRejectReason" :rows="3" :maxlength="500" show-count :placeholder="t('merchant.verifyPage.docRejectPlaceholder')" :disabled="scopedKycBusy" />
        </a-form-item>
      </a-form>
    </a-modal>
    <MerchantDocumentPreview ref="documentPreview" />
  </PageContainer>
</template>

<style scoped>
.ob-header { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 20px; }
.ob-lead-link { white-space: nowrap; font-weight: 500; font-family: monospace; color: #2563eb; }
.ob-mono-value { font-family: monospace; font-size: 12px; }
.ob-merchant-name { font-weight: 500; color: #1a2332; }
.ob-progress-badge :deep(.ant-tag) { max-width: 100%; white-space: normal; }
.ob-kyc-locked-hint { margin: 12px 0 16px; }
.ob-drawer-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ob-drawer-heading strong { display: block; font-size: 16px; color: #1a2332; }
.ob-drawer-heading > div > span { display: block; margin-top: 4px; font-size: 11px; color: #94a3b8; font-weight: 400; overflow-wrap: anywhere; }
.ob-drawer-heading > .ant-btn { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 32px; width: 32px; height: 32px; padding: 0; border-radius: 6px; }
.ob-drawer-heading > .ant-btn :deep(.anticon) { margin: 0; font-size: 14px; }
.ob-detail-heading strong { font-size: 15px; line-height: 20px; }
.ob-detail-heading > div > span { margin-top: 2px; line-height: 16px; }
.ob-progress { display: flex; align-items: center; gap: 0; padding: 14px 16px 10px; }
.ob-progress__item { flex: 1 1 0; min-width: 0; display: flex; align-items: center; color: #94a3b8; font-size: 9px; font-weight: 500; letter-spacing: 0.01em; white-space: nowrap; }
.ob-progress__item:last-child { flex: none; }
.ob-progress__step { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
.ob-progress__node { width: 24px; height: 24px; flex-shrink: 0; border: 2px solid #cbd5e1; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 12px; }
.ob-progress__node > span:empty { width: 6px; height: 6px; border-radius: 50%; background: #cbd5e1; }
.ob-progress__connector { flex: 1; height: 2px; margin: 0 2px 14px; background: #e3e8f0; }
.ob-progress__item.is-active { color: #1664ff; font-weight: 700; }
.ob-progress__item.is-active .ob-progress__node { border-color: #1664ff; background: #1664ff; }
.ob-progress__item.is-active .ob-progress__node > span:empty { width: 8px; height: 8px; background: #fff; }
.ob-progress__item.is-done { color: #059669; }
.ob-progress__item.is-done .ob-progress__node { background: #059669; border-color: #059669; color: white; }
.ob-progress__item.is-done .ob-progress__connector { background: #059669; }
.timeline-toggle { width: 100%; padding: 8px 0; border: 0; background: transparent; font: inherit; text-align: left; cursor: pointer; }
.timeline-toggle:focus-visible { outline: 2px solid #1664ff; outline-offset: 2px; border-radius: 4px; }
.timeline-toggle-label, .timeline-toggle-arrow { flex-shrink: 0; color: #64748b; font-size: 12px; }
.timeline-toggle-arrow.is-expanded { transform: rotate(180deg); }
.timeline-scroll { max-height: 320px; overflow-y: auto; overscroll-behavior: contain; margin-top: 8px; padding: 4px 8px 12px 2px; }
.internal-notes-heading { margin: 24px 0 12px; }
.ob-contacts__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid #e3e8f0; border-radius: 8px; overflow: hidden; }
.ob-contacts__grid .co-cell { padding: 12px; background: #fafbfc; min-width: 0; overflow-wrap: anywhere; }
.ob-contacts__label { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #64748b; font-size: 11px; }
.ob-contact-state { font-size: 10px; color: #b54708; }
.ob-contact-state.is-verified { color: #059669; }
.ob-contact-source { color: #94a3b8; font-size: 10px; margin-top: 4px; }
.ob-merchant-kyc { margin: 18px 0 20px; border: 1px solid #e3e8f0; border-radius: 8px; overflow: hidden; }
.ob-merchant-kyc__toggle { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; padding: 12px 14px; background: #f8fafc; text-align: left; cursor: pointer; }
.ob-merchant-kyc__title { flex: 1; min-width: 0; }
.ob-merchant-kyc__title strong { display: block; color: #334155; font-size: 12px; }
.ob-merchant-kyc__title > span { display: block; margin-top: 3px; font-size: 10px; color: #94a3b8; }
.ob-merchant-kyc__count { color: #64748b; font-size: 11px; white-space: nowrap; }
.ob-merchant-kyc__body { padding: 0 12px 12px; }
.ob-merchant-kyc__assist { margin-top: 12px; }
.ob-business-kyc-summary { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f0f6ff; border: 1px solid #bfdbfe; border-radius: 7px; margin: 10px 0; }
.ob-business-kyc-summary > div { flex: 1; min-width: 0; }
.ob-business-kyc-summary__icon { font-size: 20px; }
.ob-business-kyc-summary strong { color: #1a2332; font-size: 12px; }
.ob-business-kyc-summary p { color: #1664ff; font-size: 10px; margin: 3px 0 0; }
.ob-business-kyc-context { display: flex; gap: 24px; margin: 14px 0; }
.ob-business-kyc-context .kyc-label { display: block; font-size: 10px; color: #94a3b8; }
.ob-preview-requirements { margin-top: 12px; }
.ob-assist-business { margin: 20px 0; }
.ob-helper { font-size: 11px; color: #64748b; line-height: 1.7; margin: 5px 0 0; }
.ob-scope-toolbar { display: flex; align-items: center; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
.ob-scope-toolbar label { font-size: 11px; color: #64748b; }
.ob-scope-toolbar :deep(.ant-select) { flex: 1; min-width: 140px; }
.ob-assist-guidance { margin: 0 0 12px; color: #64748b; font-size: 11px; line-height: 1.7; }
.ob-assist-agreement { margin-top: 16px; flex-wrap: wrap; font-size: 12px; }
.ob-review-document { font-size: 12px; color: #64748b; overflow-wrap: anywhere; }
:global(.onboarding-assist-drawer .ant-drawer-footer) { padding: 14px 24px calc(16px + env(safe-area-inset-bottom, 0px)); }
.ob-assist-footer { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
.ob-assist-footer :deep(.ant-btn) { height: 34px; padding: 0 14px; border-radius: 7px; font-size: 12px; }
.drawer-footer-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.rb-row.is-selected { background: #f0f9ff; }
.rb-row:focus-visible { outline: 2px solid #1664ff; outline-offset: -2px; }
:global(.onboarding-drawer .ant-drawer-content-wrapper), :global(.onboarding-assist-drawer .ant-drawer-content-wrapper) { max-width: 100vw; }
:global(.onboarding-drawer .ant-drawer-header), :global(.onboarding-assist-drawer .ant-drawer-header) { padding: 10px 24px; min-height: 60px; border-color: #e3e8f0; }
:global(.onboarding-drawer .ant-drawer-body), :global(.onboarding-assist-drawer .ant-drawer-body) { padding: 20px 24px; }

/* §1 入驻状态卡(实测值对齐原型 stir-long:1px #E3E8F0 边框 + 10px 圆角,三段各自 padding) */
.onboarding-stage-card {
  border: 1px solid #e3e8f0;
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
  margin-bottom: 16px;
}
/* 状态行:底色随阶段变化(由 :style 注入) */
.stage-card__status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
}
.stage-card__stage-text {
  font-size: 12px;
  font-weight: 500;
  color: #475569;
}
.stage-card__change {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.stage-card__change-label {
  font-size: 11px;
  color: #94a3b8;
}
/* Change 下拉:灰底细边 6px 圆角(对齐原型) */
.stage-card__change :deep(.ant-select-selector) {
  background: #f1f5f9 !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 6px !important;
  color: #475569;
}
/* 步骤条区 */
.stage-card__steps {
  padding: 14px 16px 10px;
}
/* 已拒绝提示框(申请已拒绝——入驻流程已结束) */
.stage-card__rejected {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 16px 10px;
  padding: 10px 12px;
  border: 1px solid #fecdd3;
  border-radius: 8px;
  background: #fff1f3;
  color: #c01048;
  font-size: 13px;
  font-weight: 500;
}
/* 信息行:4 列 grid gap 10px + 上边框 */
.stage-card__info {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 10px 16px;
  border-top: 1px solid #f1f5f9;
}
.stage-card__info-label {
  margin-bottom: 2px;
  font-size: 10px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.stage-card__info-value {
  font-size: 12px;
  font-weight: 600;
  color: #1a2332;
}
/* 指派运营下拉:撑满列宽,细边 5px 圆角 */
.stage-card__ops-select {
  width: 100%;
}
.stage-card__ops-select :deep(.ant-select-selector) {
  border: 1px solid #e3e8f0 !important;
  border-radius: 5px !important;
}
.stage-card__ops-select :deep(.ant-select-selection-item) {
  font-size: 12px;
  font-weight: 500;
  color: #1a2332;
}
/* §2 公司信息(原型实测值:标题行 图标 13px #94A3B8 + 12px/700/字距 0.84px 大写 #64748B + 尾部 1px #F1F5F9 装饰线;
   网格间距 8px;单元格 灰底 #F8FAFC + 1px #F1F5F9 边 + 6px 圆角 + padding 8px 12px;
   标签 11px/400 #94A3B8 下距 2px,值 13px/500 #1A2332) */
.co-info-section {
  margin: 20px 0;
}
.co-section-heading {
  display: flex;
  align-items: center;
  gap: 8px;
}
.co-heading-icon {
  font-size: 13px;
  color: #94a3b8;
  flex-shrink: 0;
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
.co-grid-stack {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.co-grid {
  display: grid;
  gap: 8px;
}
.co-grid--2col {
  grid-template-columns: repeat(2, 1fr);
}
.co-grid--3col {
  grid-template-columns: repeat(3, 1fr);
}
.co-cell {
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 6px;
}
.co-cell-label {
  margin-bottom: 2px;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  color: #94a3b8;
}
.co-cell-value {
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  color: #1a2332;
  word-break: break-all;
}

/* KYC 状态徽章(高度 20/10px/600/圆角 4,颜色由 RB_KYC_BADGE 内联注入) */
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

/* ===== 注册企业手风琴表格(点击行展开业务提交详情) ===== */
.rb-table {
  margin-top: 10px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.rb-head,
.rb-row {
  display: grid;
  grid-template-columns: 24px 1fr 110px 100px 96px 40px;
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

.rb-chevron {
  transition: transform 0.2s ease;
  color: #94a3b8;
}
.rb-c-exp { display: flex; align-items: center; justify-content: center; padding: 8px 12px; }

.rb-chevron.is-open {
  transform: rotate(180deg);
}

.rb-expand {
  background: #f8fafc;
  padding: 10px 12px;
  border-top: 1px solid #f1f5f9;
}

.rb-expand-title {
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}

/* 展开区 KYC 联动(企业类型 / 验证模板 / 所需文件) */
.rb-kyc-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 8px 12px;
  margin-bottom: 10px;
}

.rb-kyc-label {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 5px;
}

.rb-kyc-value {
  font-size: 12px;
  font-weight: 500;
  color: #1a2332;
  padding: 3px 0;
}

.rb-kyc-count {
  margin-left: 6px;
  font-size: 10px;
  font-weight: 400;
  color: #94a3b8;
}

.rb-kyc-docs {
  margin: 0 0 4px;
  padding-left: 16px;
  font-size: 12px;
  color: #1a2332;
}

/* §4 运营评估(原型实测:斜体副标题 + 两列 grid gap 10px + 灰底控件) */
.oa-section {
  margin: 20px 0;
}
.oa-save-btn {
  flex-shrink: 0;
}
.oa-subtitle {
  margin: 10px 0;
  font-size: 11px;
  font-style: italic;
  color: #94a3b8;
}
.oa-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.oa-notes {
  margin-top: 10px;
}
.oa-save-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.oa-save-row .oa-save-btn {
  min-width: 96px;
}
.oa-label {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  color: #94a3b8;
}
.oa-section :deep(.ant-select-selector),
.oa-section :deep(.ant-picker),
.oa-section :deep(.ant-input) {
  background: #ffffff;
  border: 1px solid #e3e8f0;
  border-radius: 6px;
  font-size: 12px;
  color: #1a2332;
}

/* 四队列统计卡(原型实测 localhost:8443:白底 1px #E3E8F0 边 + 8px 圆角 + 12px 内边距;
   标签 11px/500 #94A3B8 + 数字 26px/700 主题色 + 迷你进度条 32x3;当前队列卡浅色底 + 0 0 0 1px 描边阴影 + 6px 圆点) */
.qc-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.qc-card {
  padding: 12px;
  background: #fff;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.qc-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.qc-label {
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
  color: #94a3b8;
}
.qc-card.is-active .qc-label {
  font-weight: 600;
  color: inherit;
}
.qc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.qc-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 39px;
}
.qc-bar {
  width: 32px;
  height: 3px;
  margin-top: 6px;
  background: #e3e8f0;
  border-radius: 2px;
  overflow: hidden;
}
.qc-bar-fill {
  height: 100%;
  border-radius: 2px;
}
@media (max-width: 767px) {
  .qc-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 575px) {
  .qc-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 页面标题区(原型 2026-08-25 figma.site 实测:eyebrow 11px/500/字距 0.05em 大写 #94A3B8 → 4px → 主标题 18px/700 行高 27px #1A2332 → 2px → 描述 13px/400 行高 19.5px #94A3B8) */
.ob-eyebrow {
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #94a3b8;
}
.ob-title {
  margin-bottom: 2px;
  font-size: 18px;
  font-weight: 700;
  line-height: 27px;
  color: #1a2332;
}
.ob-desc {
  font-size: 13px;
  line-height: 19.5px;
  color: #94a3b8;
}
/* 导出按钮(原型:34px 高 / 1px #E3E8F0 边 / 6px 圆角 / 13px #475569 白底) */
.ob-export-btn.ant-btn {
  height: 34px;
  padding: 0 12px;
  border: 1px solid #e3e8f0;
  border-radius: 6px;
  background: #fff;
  color: #475569;
  font-size: 13px;
  box-shadow: none;
}
.ob-export-btn.ant-btn:hover {
  color: #1664ff;
  border-color: #1664ff;
}
.ob-export-btn.ant-btn .anticon {
  font-size: 13px;
}

/* 分页栏(原型实测:灰底 #FAFBFC + 上边框 1px #F1F5F9 + 12px 16px,左文案 12px #94A3B8;按钮 28x28 无边框 4px 圆角,当前页 #1664FF 白字,禁用 #CBD5E1) */
.ob-pagination :deep(.ant-pagination) {
  display: flex;
  align-items: center;
  width: 100%;
  margin: 0;
  padding: 12px 16px;
  background: #fafbfc;
  border-top: 1px solid #f1f5f9;
}
.ob-pagination :deep(.ant-pagination-total-text) {
  margin-right: auto;
  font-size: 12px;
  line-height: 25px;
  color: #94a3b8;
}
.ob-pagination :deep(.ant-pagination-prev),
.ob-pagination :deep(.ant-pagination-next) {
  min-width: 28px;
  height: 28px;
  line-height: 28px;
}
.ob-pagination :deep(.ant-pagination-prev .ant-pagination-item-link),
.ob-pagination :deep(.ant-pagination-next .ant-pagination-item-link) {
  min-width: 28px;
  height: 28px;
  line-height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-size: 12px;
  color: #94a3b8;
}
.ob-pagination :deep(.ant-pagination-prev.ant-pagination-disabled .ant-pagination-item-link),
.ob-pagination :deep(.ant-pagination-next.ant-pagination-disabled .ant-pagination-item-link) {
  color: #cbd5e1;
}
.ob-pagination :deep(.ant-pagination-item) {
  min-width: 28px;
  height: 28px;
  line-height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-size: 12px;
}
.ob-pagination :deep(.ant-pagination-item a) {
  color: #1a2332;
}
.ob-pagination :deep(.ant-pagination-item-active) {
  background: #1664ff;
}
.ob-pagination :deep(.ant-pagination-item-active a) {
  color: #fff;
  font-weight: 600;
}

.row-action-btn--approve:hover {
  color: #059669;
  background: rgba(5, 150, 105, 0.08);
  border-color: rgba(5, 150, 105, 0.28);
}

.row-action-btn--reject:hover {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.08);
  border-color: rgba(220, 38, 38, 0.28);
}

.kyc-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0 10px;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  letter-spacing: 0.84px;
  text-transform: uppercase;
  color: #64748b;
}

.kyc-heading-icon {
  font-size: 13px;
  color: #94a3b8;
}

/* 无注册商户时 KYC 设置与访问的空态提示 */
.kyc-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 10px;
  margin-bottom: 15px;
  padding: 22px 12px;
  border: 1px dashed #e3e8f0;
  border-radius: 8px;
  background: #f8fafc;
  color: #94a3b8;
  font-size: 12px;
}

.kyc-empty__icon {
  font-size: 15px;
}

/* Registered Businesses 子标题(原型实测:11px/600/字距 0.55px 大写 #475569) */
.kyc-rb-subheader {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  letter-spacing: 0.55px;
  text-transform: uppercase;
  color: #475569;
}

/* 注册企业卡片列表(原型实测:左 3px 高亮边 / 选中 #EEF4FF+#1664FF / 卡间距 5px / 距下方 14px) */
.kyc-rb-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 14px;
}

.kyc-rb-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid #e3e8f0;
  border-left: 3px solid #e3e8f0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
}

.kyc-rb-card.is-active {
  background: #eef4ff;
  border-color: #1664ff;
  border-left-color: #1664ff;
}

.kyc-rb-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  background: #f1f5f9;
  font-size: 14px;
}

.kyc-rb-card.is-active .kyc-rb-icon {
  background: #dbeafe;
}

.kyc-rb-main {
  flex: 1;
  min-width: 0;
}

.kyc-rb-name {
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  color: #1a2332;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kyc-rb-card.is-active .kyc-rb-name {
  color: #1664ff;
}

.kyc-rb-sub {
  font-size: 10px;
  line-height: 15px;
  color: #94a3b8;
}

/* 字段布局(原型实测:每字段独占一行纵向堆叠,字段间距 12px,控件 100% 宽) */
.kyc-grid {
  display: block;
}

.kyc-field {
  min-width: 0;
  margin-bottom: 12px;
}

.kyc-label {
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  letter-spacing: 0.55px;
  text-transform: uppercase;
  color: #475569;
  margin-bottom: 6px;
}

.kyc-field--template .kyc-label {
  margin-bottom: 4px;
}

/* 验证范围:分段控件(原型实测:外层 1px #E3E8F0 圆角 6 包裹 + 中间 1px 分隔线 + 按钮 flex:1 高 32) */
.kyc-seg {
  display: flex;
  border: 1px solid #e3e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.kyc-seg__item {
  flex: 1;
  height: 32px;
  border: none;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.15s ease;
}

.kyc-seg__item + .kyc-seg__item {
  border-left: 1px solid #e3e8f0;
}

.kyc-seg__item.is-active {
  background: #eef4ff;
  color: #1664ff;
  font-weight: 600;
}

.kyc-seg__item:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* 企业类型:胶囊按钮行(原型 BUSINESS TYPE 图标行) */
.kyc-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.kyc-pill {
  height: 28px;
  padding: 0 10px;
  border: 1px solid #e3e8f0;
  border-radius: 20px;
  background: #fff;
  color: #64748b;
  font-size: 11px;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.15s ease;
}

.kyc-pill.is-active {
  background: #eef4ff;
  border-color: #1664ff;
  color: #1664ff;
  font-weight: 600;
}

.kyc-pill:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* 验证模板下拉(原型实测:高 36.8/13px/400 #1A2332,边框 #E3E8F0,圆角 6,padding 8px 32px 8px 10px) */
.kyc-select :deep(.ant-select-selector) {
  padding: 8px 32px 8px 10px !important;
  border-color: #e3e8f0 !important;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 400;
  color: #1a2332;
}

.kyc-select :deep(.ant-select-selection-item),
.kyc-select :deep(.ant-select-selection-placeholder) {
  line-height: 19px;
}

/* 所需文件标题/计数/清单 */
.kyc-doc-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}

.kyc-doc-title__text {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
}

.kyc-doc-title__count {
  font-size: 10px;
  font-weight: 400;
  color: #94a3b8;
}

/* 所需文件卡片(原型实测:1px #E3E8F0 边 + 8px 圆角 + #F8FAFC 底;标题行 #F1F5F9 底 8px 12px;条目 8px 12px + 绿色勾 13px #059669 + 分隔线 #F1F5F9) */
.kyc-doc-card {
  margin-bottom: 12px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  background: #f8fafc;
  overflow: hidden;
}

.kyc-doc-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f1f5f9;
  border-bottom: 1px solid #e3e8f0;
}

.kyc-doc-card__title {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
}

.kyc-doc-card__count {
  font-size: 10px;
  font-weight: 400;
  color: #94a3b8;
}

.kyc-doc-card__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.kyc-doc-card__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 12px;
  line-height: 18px;
  color: #1a2332;
}

.kyc-doc-card__item:last-child {
  border-bottom: none;
}

.kyc-doc-card__icon {
  flex-shrink: 0;
  font-size: 13px;
  color: #059669;
}

/* 底部动作条(原型实测:三按钮 32px 高 / gap 8px;Preview 白底灰边 / Edit 浅紫 / Send 蓝底白字 600) */
.kyc-action-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 6px;
}

.kyc-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.kyc-btn .anticon {
  font-size: 12px;
}

.kyc-btn--preview {
  background: #fff;
  border: 1px solid #e3e8f0;
  color: #475569;
}

.kyc-btn--preview:hover:not(:disabled) {
  border-color: #1664ff;
  color: #1664ff;
}

.kyc-btn--preview:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.kyc-btn--edit {
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  color: #6d28d9;
}

.kyc-btn--edit:hover {
  background: #ede9fe;
}

/* KYC 提交方法卡片(原型 KYC SUBMISSION METHOD) */
.kyc-submit-card {
  margin-top: 12px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.kyc-submit-card__method {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.kyc-submit-card__title {
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
  color: #94a3b8;
  margin-bottom: 4px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.kyc-submit-card__tag,
.kyc-submit-card__assist {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.kyc-submit-card__tag {
  min-height: 20px;
  padding: 0 7px;
  border-radius: 4px;
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
  font-size: 10px;
  line-height: 18px;
}

.kyc-submit-card__assist {
  min-height: 36px;
  padding: 0 13px;
  gap: 6px;
  border-color: #fde68a;
  background: #fffbeb;
  color: #b45309;
  font-size: 12px;
  line-height: 18px;
}

.kyc-submit-card__assist .anticon {
  font-size: 14px;
}

.kyc-submit-card__tag:hover:not(:disabled),
.kyc-submit-card__tag.is-active {
  border-color: #1664ff;
  background: #eff6ff;
}

.kyc-submit-card__assist:hover:not(:disabled),
.kyc-submit-card__assist.is-active {
  border-color: #f59e0b;
  background: #fef3c7;
}

.kyc-submit-card__tag:disabled,
.kyc-submit-card__assist:disabled {
  color: #94a3b8;
  cursor: not-allowed;
  opacity: 0.65;
}

@media (max-width: 560px) {
  .kyc-submit-card__method {
    align-items: stretch;
    flex-direction: column;
  }

  .kyc-submit-card__assist {
    width: 100%;
  }
}

/* 协助 KYC 嵌套侧边栏（原型 Assist Merchant with KYC） */
.assist-kyc-drawer :deep(.ant-drawer-header) {
  min-height: 60px;
  padding: 12px 20px;
  border-bottom-color: #eef2f6;
}

.assist-kyc-drawer :deep(.ant-drawer-header-title) {
  align-items: flex-start;
}

.assist-kyc-drawer :deep(.ant-drawer-close) {
  margin-top: 2px;
  color: #94a3b8;
}

.assist-kyc-drawer :deep(.ant-drawer-body) {
  padding: 16px 20px 24px;
  background: #fff;
}

.assist-kyc-drawer :deep(.ant-drawer-footer) {
  padding: 14px 20px;
  border-top-color: #eef2f6;
}

.assist-kyc-drawer__title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.assist-kyc-drawer__title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid #fde68a;
  border-radius: 7px;
  background: #fffbeb;
  color: #b45309;
  font-size: 15px;
}

.assist-kyc-drawer__title-main {
  color: #1a2332;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
}

.assist-kyc-drawer__title-sub {
  margin-top: 1px;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.assist-kyc-notice {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
  padding: 14px 16px;
  border: 1px solid #fde68a;
  border-radius: 8px;
  background: #fffbeb;
}

.assist-kyc-notice__icon {
  flex: 0 0 auto;
  margin-top: 1px;
  color: #b45309;
  font-size: 14px;
}

.assist-kyc-notice__title {
  color: #92400e;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.assist-kyc-notice__text {
  margin-top: 2px;
  color: #92400e;
  font-size: 11px;
  line-height: 17px;
}

.assist-kyc-section-title {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eef2f6;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.assist-kyc-section-title > .anticon {
  color: #94a3b8;
  font-size: 13px;
}

.assist-kyc-section-title > span {
  color: #94a3b8;
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}

.assist-kyc-section-title--docs {
  margin-top: 20px;
}

.assist-kyc-section-title--confirmation {
  margin-top: 20px;
}

.assist-kyc-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.assist-kyc-field {
  min-width: 0;
}

.assist-kyc-field--full {
  margin-top: 10px;
}

.assist-kyc-field label,
.assist-kyc-document__label {
  display: block;
  margin-bottom: 5px;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 500;
  line-height: 14px;
}

.assist-kyc-field :deep(.ant-input),
.assist-kyc-field :deep(.ant-input-affix-wrapper) {
  min-height: 34px;
  border-color: #e3e8f0;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  font-size: 12px;
}

.assist-kyc-field :deep(textarea.ant-input) {
  min-height: 56px;
  padding-top: 8px;
  resize: vertical;
}

.assist-kyc-document {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid #eef2f6;
  border-radius: 8px;
  background: #fff;
}

.assist-kyc-document__head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.assist-kyc-document__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 14px;
}

.assist-kyc-document__name {
  color: #1a2332;
  font-size: 12px;
  font-weight: 700;
  line-height: 17px;
}

.assist-kyc-document__required {
  color: #94a3b8;
  font-size: 10px;
  line-height: 14px;
}

.assist-kyc-document__controls {
  display: grid;
  grid-template-columns: 1fr 160px;
  gap: 12px;
  margin-top: 12px;
}

.assist-kyc-document__upload {
  border-color: #e3e8f0;
  border-radius: 5px;
  color: #475569;
  font-size: 11px;
}

.assist-kyc-document__source {
  width: 100%;
}

.assist-kyc-document__source :deep(.ant-select-selector) {
  border-color: #e3e8f0 !important;
  border-radius: 5px !important;
  font-size: 11px;
}

.assist-kyc-document__empty {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 6px 8px;
  border: 1px solid #fde68a;
  border-radius: 5px;
  background: #fffbeb;
  color: #a16207;
  font-size: 10px;
  line-height: 14px;
}

/* 隐藏原生 file input,由「选择文件」按钮代触发 */
.assist-kyc-document__file-input {
  display: none;
}

.assist-kyc-document__uploaded {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  padding: 8px 10px;
  border: 1px solid #d9f99d;
  border-radius: 5px;
  background: #f7fee7;
}

.assist-kyc-document__uploaded-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: #166534;
  font-size: 11px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assist-kyc-confirmation {
  margin-top: 12px;
  padding: 16px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  background: #fff;
}

.assist-kyc-confirmation__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
  line-height: 20px;
}

.assist-kyc-confirmation__pending {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border: 1px solid #fde68a;
  border-radius: 999px;
  background: #fffbeb;
  color: #b45309;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
}

.assist-kyc-confirmation__notice {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid #eef2f6;
  border-radius: 7px;
  background: #f8fafc;
  color: #475569;
  font-size: 11px;
  line-height: 19px;
}

.assist-kyc-confirmation__notice-warning {
  margin-top: 7px;
  color: #c2410c;
  font-style: italic;
}

.assist-kyc-confirmation__send {
  height: 34px;
  margin-top: 14px;
  border-radius: 6px;
  background: #1664ff !important;
  border-color: #1664ff !important;
  font-size: 12px;
  font-weight: 600;
}

.assist-kyc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #94a3b8;
  font-size: 10px;
}

.assist-kyc-footer > div {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
}

.assist-kyc-footer :deep(.ant-btn) {
  height: 34px;
  border-radius: 6px;
  font-size: 12px;
}

.assist-kyc-footer__submit {
  background: #1664ff !important;
  border-color: #1664ff !important;
  font-weight: 600;
}

@media (max-width: 680px) {
  .assist-kyc-form-grid,
  .assist-kyc-document__controls {
    grid-template-columns: 1fr;
  }

  .assist-kyc-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}

.kyc-send-btn {
  height: 32px;
  padding: 0 14px;
  border-radius: 6px;
  background: #1664ff !important;
  border-color: #1664ff !important;
  font-size: 12px;
  font-weight: 600;
}

/* 提交文件表(原型 SUBMITTED DOCUMENTS) */
.kyc-doc-table :deep(.ant-table-thead > tr > th) {
  padding: 8px 12px !important;
  background: #fff !important;
  border-bottom: 1px solid #f1f5f9 !important;
  font-size: 10px !important;
  font-weight: 700 !important;
  color: #64748b !important;
  white-space: nowrap;
}

.kyc-doc-table :deep(.ant-table-tbody > tr > td) {
  padding: 10px 12px !important;
  border-bottom: 1px solid #f1f5f9;
}

.kyc-doc-name {
  font-size: 12px;
  font-weight: 500;
  color: #1a2332;
}

.kyc-doc-sub {
  font-size: 10px;
  color: #94a3b8;
}

.kyc-doc-status {
  display: inline-flex;
  padding: 0 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  line-height: 18px;
}

.kyc-doc-status--1 {
  color: #059669;
  background: #ecfdf3;
}

.kyc-doc-status--2 {
  color: #b54708;
  background: #fffbeb;
}

.kyc-doc-status--3 {
  color: #c01048;
  background: #fff1f3;
}

.kyc-doc-awaiting {
  font-size: 9px;
  font-weight: 600;
  color: #d97706;
  margin-top: 2px;
}

.kyc-doc-reject {
  font-size: 9px;
  font-weight: 600;
  color: #c01048;
  margin-top: 2px;
}

.kyc-doc-uploaded {
  font-size: 11px;
  color: #64748b;
}

/* 提交文件操作小按钮(原型 View / Approve / Reject) */
.doc-action-btn {
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 11px;
  font-weight: 400;
  line-height: 22px;
}

.doc-action-btn--view {
  color: #1664ff;
  background: #eef4ff;
  border-color: #bfdbfe;
}

.doc-action-btn--approve {
  color: #059669;
  background: #ecfdf3;
  border-color: #a7f3d0;
}

.doc-action-btn--reject {
  color: #c01048;
  background: #fff1f3;
  border-color: #fecdd3;
}

.doc-action-btn:hover {
  opacity: 0.85;
}

.doc-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 底部动作条(原型 Assign Merchant Operations / Reject Lead) */
.drawer-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drawer-footer-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
}

.drawer-footer-btn--primary {
  background: #1664ff !important;
  border-color: #1664ff !important;
  color: #fff !important;
}

.drawer-footer-btn--danger {
  background: #fff1f3 !important;
  border-color: #fecdd3 !important;
  color: #c01048 !important;
}

.drawer-footer-btn--ghost {
  background: #fff !important;
  border-color: #e3e8f0 !important;
  color: #475569 !important;
  font-weight: 400;
}

/* 阶段调整下拉(原型 Change: 灰底 11px/600 #475569、边框 #CBD5E1、圆角 6、高 24) */
.stage-change-select :deep(.ant-select-selector) {
  height: 24px !important;
  min-height: 24px !important;
  padding: 3px 6px !important;
  background: #f1f5f9 !important;
  border-color: #cbd5e1 !important;
  border-radius: 6px !important;
}

.stage-change-select :deep(.ant-select-selection-item) {
  line-height: 16px !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  color: #475569 !important;
}

/* 添加笔记按钮(原型 Add Note):enabled 主题蓝主按钮,disabled 走 antd 灰 */
.kyc-note-btn {
  height: 30px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.kyc-note-btn:not(:disabled) {
  background: #1664ff !important;
  border-color: #1664ff !important;
  color: #fff !important;
}

/* §6 Activity Timeline(对齐原型 si 组件:左侧 2px 竖线 + 彩色圆点白光环 + monospace 时间 + type标签 + action + by) */
.onb-tl {
  position: relative;
  margin-top: 10px;
  margin-left: 5px;
  margin-bottom: 20px;
  padding-left: 20px;
  border-left: 2px solid #e3e8f0;
}

.onb-tl-item {
  position: relative;
  margin-bottom: 18px;
}

.onb-tl-item:last-child {
  margin-bottom: 0;
}

.onb-tl-dot {
  position: absolute;
  left: -25px;
  top: 3px;
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

/* §7 内部笔记(对齐原型 ci 组件:卡片列表 + 头像圆首字母 + 多行 textarea 输入) */
.onb-notes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  margin-bottom: 12px;
}

.onb-note {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 10px 12px;
}

.onb-note__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.onb-note__avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #d97706;
  color: #fff;
  font-size: 8px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.onb-note__by {
  font-size: 11px;
  font-weight: 600;
  color: #92400e;
}

.onb-note__date {
  font-size: 10px;
  color: #94a3b8;
  font-family: monospace;
  white-space: nowrap;
}

.onb-note__text {
  font-size: 12px;
  color: #78350f;
  line-height: 1.6;
}

.onb-note-input {
  width: 100%;
  font-size: 12px;
}

.onb-note-input :deep(textarea) {
  border: 1px solid #e3e8f0 !important;
  border-radius: 6px !important;
  padding: 8px 10px !important;
  box-sizing: border-box;
  font-family: inherit;
  line-height: 1.6;
  color: #1a2332;
  resize: vertical;
}

.onb-note-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.onb-note-actions .kyc-note-btn {
  min-width: 88px;
}

.kyc-readiness {
  margin: 12px 0;
}

.kyc-agreement-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
  color: #64748b;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.kyc-agreement-row strong {
  margin-right: auto;
  color: #1a2332;
}

.kyc-scope-card {
  padding: 14px;
  margin-bottom: 10px;
  background: #fff;
  border: 1px solid #e3e8f0;
  border-radius: 9px;
}

.kyc-scope-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.kyc-scope-card__head div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kyc-scope-card__head span,
.kyc-scope-doc {
  color: #64748b;
  font-size: 12px;
}

.kyc-scope-doc {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  overflow-wrap: anywhere;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 0;
  border-top: 1px solid #f1f5f9;
}

.kyc-scope-reason {
  padding: 8px 10px;
  margin-bottom: 8px;
  color: #b42318;
  font-size: 12px;
  background: #fff1f3;
  border-radius: 6px;
}
@media (max-width: 700px) {
  .ob-queue-nav.mv-nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ob-header { align-items: flex-start; flex-direction: column; gap: 12px; }
  .ob-contacts__grid { grid-template-columns: 1fr; }
  .rb-table { overflow-x: auto; }
  .rb-head, .rb-row, .rb-expand { min-width: 590px; }
  .stage-card__info { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .co-grid--3col, .co-grid--2col { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .co-cell-value { word-break: normal; overflow-wrap: anywhere; }
  .drawer-footer { flex-wrap: wrap; }
  :global(.onboarding-drawer .ant-drawer-body), :global(.onboarding-assist-drawer .ant-drawer-body) { padding: 16px; }
}
</style>
