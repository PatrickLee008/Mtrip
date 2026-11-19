<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Modal, message } from 'ant-design-vue';
import { BellOutlined, LoginOutlined, EyeOutlined, DownloadOutlined, ExclamationCircleOutlined, CloseOutlined } from '@ant-design/icons-vue';
import SearchFilterBar, { type FilterConfig } from '@/components/SearchFilterBar.vue';
import AccountSecurityPanel from '@/components/merchant/AccountSecurityPanel.vue';
import CommercialSettingsDrawer from '@/components/merchant/CommercialSettingsDrawer.vue';
import ComplianceLinks from '@/components/merchant/ComplianceLinks.vue';
import MerchantPropertyPanel from '@/components/merchant/MerchantPropertyPanel.vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { NEW_MERCHANT_SITE_ID } from '@/config/merchant';
import StatusTag from '@/components/StatusTag.vue';
import NotifyDrawer from '@/components/merchant/NotifyDrawer.vue';
import ImpersonateModal from '@/components/merchant/ImpersonateModal.vue';
import MerchantStatusActions from '@/components/merchant/MerchantStatusActions.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import {
  apiMerchantAdd,

  apiMerchantAudit,
  apiMerchantClose,
  apiMerchantDetail,
  apiMerchantList,
  apiMerchantModuleGrant,
  apiMerchantModules,
  apiMerchantUpdate,
} from '@/api/merchant';
import { exportCsv } from '@/utils/exportCsv';

const { t } = useI18n();
const route = useRoute();
function openLinkedMerchant() {
  const id = Number(route.query.merchantId);
  if (Number.isSafeInteger(id) && id > 0) void openDetail({ id });
}
watch(() => route.query.merchantId, openLinkedMerchant);

/** 商户列表:入驻审核/费率配置/启停/注销(文档 6.4.2;状态机 0→3/2,3⇄4,5终态) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('goods.common.typeHotel'), 2: t('goods.common.typeTicket'), 3: t('merchant.title'),
}));
const businessOptions = computed(() => [
  { value: 'hotel', label: t('merchant.onboardingPage.bizHotel') },
  { value: 'restaurant', label: t('merchant.onboardingPage.bizRestaurant') },
  { value: 'airline', label: t('merchant.onboardingPage.bizAirline') },
  { value: 'car_rental', label: t('merchant.onboardingPage.bizCarRental') },
  { value: 'attraction', label: t('merchant.onboardingPage.bizAttraction') },
]);
function businessText(row: TableRow): string {
  return (row.business_types ?? []).map((type: string) => businessOptions.value.find((x) => x.value === type)?.label ?? type).join(' / ') || '—';
}
function planText(plan: string | null): string {
  return t(`merchantDirectory.${plan || 'unconfigured'}`);
}
const planColors: Record<string, string> = { vip: 'gold', premium: 'purple', standard: 'default' };
const statusColors: Record<string, string> = {
  active: 'success', suspended: 'error', blacklisted: 'error', approved: 'success',
  pending: 'warning', rejected: 'error', resubmission: 'processing',
};
const counts = ref<Record<string, number>>({});
const { loading, list, query, load, search, pagination } = useTable(async (params) => {
  const data = await apiMerchantList(params);
  counts.value = data.stats;
  return data;
}, { keyword: '', category: '', status: '', sortField: 'registeredAt', sortOrder: 'desc' });
const filterValues = ref<Record<string, string | number | undefined>>({ category: undefined, status: undefined });
const filterKey = ref(0);
const cards = computed(() => [
  { key: 'total', label: t('merchantDirectory.allMerchants'), status: '' },
  { key: 'active', label: t('merchantDirectory.active'), status: '3' },
  { key: 'suspended', label: t('merchantDirectory.suspended'), status: '4' },
  { key: 'blacklisted', label: t('merchantDirectory.blacklisted'), status: 'blacklisted' },
]);
const filters = computed<FilterConfig[]>(() => [
  { key: 'status', label: t('merchantDirectory.accountStatus'), allLabel: t('merchantDirectory.allStatuses'),
    options: cards.value.slice(1).map((card) => ({ value: card.status, label: card.label })) },
  { key: 'category', label: t('common.type'), allLabel: t('merchantDirectory.allTypes'), options: businessOptions.value },
]);
function searchFilters(): void {
  query.status = filterValues.value.status ?? '';
  query.category = filterValues.value.category ?? '';
  search();
}
function selectCard(status: string): void {
  filterValues.value = { ...filterValues.value, status: status || undefined };
  // SearchFilterBar keeps a local draft; a card change refreshes the external filter selection.
  filterKey.value += 1;
  searchFilters();
}
const tablePagination = computed(() => ({
  ...pagination.value, showQuickJumper: false, showSizeChanger: false,
  showTotal: (total: number, range: [number, number]) => t('merchant.verifyPage.paginationInfo', { from: range[0], to: range[1], total }),
}));
const columns = computed(() => [
  { title: t('merchant.profile.merchantId'), dataIndex: 'merchant_code', width: 125 },
  { title: t('merchantDirectory.merchantName'), dataIndex: 'merchant_name', width: 220 },
  { title: t('common.type'), dataIndex: 'business_types', width: 150 },
  { title: t('merchant.profile.commissionPlan'), dataIndex: 'commission_plan', width: 125 },
  { title: t('merchantDirectory.verification'), dataIndex: 'verification_status', width: 130 },
  { title: t('merchantDirectory.accountStatus'), dataIndex: 'account_status', width: 125 },
  { title: t('merchant.profile.lastLogin'), dataIndex: 'last_login_at', width: 170 },
  { title: t('common.action'), key: 'action_col', width: 150, fixed: 'right' as const },
]);
async function exportList(): Promise<void> {
  const data = await apiMerchantList({ ...query, page: 1, pageSize: 200 });
  exportCsv(`merchants-${Date.now()}.csv`, columns.value.filter((col) => col.dataIndex).map((col) => ({
    key: col.dataIndex!, label: col.title,
  })), data.list.map((row) => ({
    ...row, business_types: businessText(row), commission_plan: planText(row.commission_plan),
    verification_status: t(`merchantDirectory.${row.verification_status}`),
    account_status: t(`merchantDirectory.${row.account_status}`),
  })));
}

// ---------- 详情抽屉 ----------
const drawerOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);
const detailAccounts = ref<TableRow[]>([]);
const detailAdmins = ref<TableRow[]>([]);
const detailApplications = ref<TableRow[]>([]);
const detailBusinesses = ref<TableRow[]>([]);
const detailProperties = ref<TableRow[]>([]);
const detailGroup = ref<TableRow | null>(null);
const detailModules = ref<string[]>([]);
const profileFields = computed(() => {
  const merchant = detail.value;
  if (!merchant) return [];
  return [
    { key: 'merchantId', label: t('merchant.profile.merchantId'), value: merchant.merchant_code || '#' + merchant.id, mono: true },
    { key: 'regNo', label: t('merchant.profile.regNo'), value: merchant.credit_code || '—', mono: true },
    { key: 'owner', label: t('merchant.profile.owner'), value: merchant.legal_person || '—' },
    { key: 'commissionPlan', label: t('merchant.profile.commissionPlan'), value: `${planText(merchant.commission_plan)} (${merchant.commission_rate ?? '—'}%)` },
    { key: 'email', label: t('merchant.listPage.email'), value: merchant.contact_email || '—' },
    { key: 'phone', label: t('merchant.listPage.phone'), value: merchant.contact_phone || '—', mono: true },
    { key: 'bankName', label: t('merchant.profile.bankName'), value: detailAccounts.value[0]?.bank_name || '—' },
    { key: 'bankAccount', label: t('merchant.profile.bankAccount'), value: detailAccounts.value[0]?.account_no || '—', mono: true },
    { key: 'joinDate', label: t('merchant.profile.joinDate'), value: merchant.created_at?.slice(0, 10) || '—', mono: true },
    { key: 'lastLogin', label: t('merchant.profile.lastLogin'), value: merchant.last_login_at || '—', mono: true },
  ];
});
const profileCompany = computed(() => detailApplications.value[0]?.company_name || detail.value?.merchant_short_name);
function performanceValue(value: number | string | null | undefined, money = false): string {
  return value == null ? '—' : `${money ? '¥' : ''}${Number(value).toLocaleString()}`;
}
let detailRequest = 0;

async function openDetail(row: TableRow): Promise<void> {
  const request = ++detailRequest;
  drawerOpen.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    const data = await apiMerchantDetail(row.id);
    if (request !== detailRequest) return;
    detail.value = data.merchant;
    detailAccounts.value = data.accounts;
    detailAdmins.value = data.admins;
    detailApplications.value = data.applications;
    detailBusinesses.value = data.businesses;
    detailProperties.value = data.properties;
    detailGroup.value = data.group;
    detailModules.value = data.modules ?? [];
  } finally {
    if (request === detailRequest) detailLoading.value = false;
  }
}

// ---------- 功能模块授权 ----------
const moduleOpen = ref(false);
const moduleSaving = ref(false);
const moduleTarget = ref<TableRow | null>(null);
const moduleAvailable = ref<{ key: string; name: string }[]>([]);
const moduleChecked = ref<string[]>([]);
const moduleUnmanaged = ref(false);

/** 模块名优先走词条,缺词条时回落后端返回的中文名,再回落 key */
function moduleLabel(key: string): string {
  const entry = t(`merchant.modulePage.modules.${key}`);
  if (entry !== `merchant.modulePage.modules.${key}`) return entry;
  return moduleAvailable.value.find((m) => m.key === key)?.name ?? key;
}

async function openModules(row: TableRow): Promise<void> {
  moduleTarget.value = row;
  moduleOpen.value = true;
  const data = await apiMerchantModules(row.id);
  moduleAvailable.value = data.available;
  moduleChecked.value = [...data.granted];
  moduleUnmanaged.value = data.unmanaged;
}

async function saveModules(): Promise<void> {
  if (!moduleTarget.value) return;
  moduleSaving.value = true;
  try {
    await apiMerchantModuleGrant(moduleTarget.value.id, moduleChecked.value);
    message.success(t('merchant.modulePage.saved'));
    moduleOpen.value = false;
    await statusChanged();
  } finally {
    moduleSaving.value = false;
  }
}



async function statusChanged(): Promise<void> {
  await load();
  if (drawerOpen.value && detail.value) await openDetail(detail.value);
}

// ---------- 发送通知 / 代入(整改 B1/B2) ----------
const notifyOpen = ref(false);
const notifyTarget = ref<TableRow | null>(null);

function openNotify(row: TableRow): void {
  notifyTarget.value = row;
  notifyOpen.value = true;
}

const impersonateOpen = ref(false);
const impersonateTarget = ref<TableRow | null>(null);

function openImpersonate(row: TableRow): void {
  impersonateTarget.value = row;
  impersonateOpen.value = true;
}





const accountColumns = computed(() => [
  { title: t('common.name'), dataIndex: 'bank_name' },
  { title: t('user.realName'), dataIndex: 'account_name' },
  { title: t('common.code'), dataIndex: 'account_no' },
  { title: t('common.type'), dataIndex: 'currency', width: 70 },
  { title: t('common.all'), dataIndex: 'is_default', width: 60 },
]);
const adminColumns = computed(() => [
  { title: t('login.username'), dataIndex: 'username' },
  { title: t('user.realName'), dataIndex: 'real_name' },
  { title: t('merchant.accountType.label'), dataIndex: 'account_type', width: 80 },
  { title: t('merchant.listPage.name'), dataIndex: 'is_owner', width: 70 },
  { title: t('merchant.listPage.status'), dataIndex: 'status', width: 80 },
  { title: t('system.admin.lastLogin'), dataIndex: 'last_login_at', width: 160 },
]);

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  merchantName: '',
  merchantType: 1,
  creditCode: '',
  legalPerson: '',
  legalIdCard: '',
  legalIdImages: [] as string[],
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  address: '',
  remark: '',
  siteId: NEW_MERCHANT_SITE_ID,
  subAccountLimit: 3,
});

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    merchantName: row.merchant_name ?? '',
    merchantType: row.merchant_type ?? 1,
    creditCode: row.credit_code ?? '',
    legalPerson: row.legal_person ?? '',
    // 身份证号加密存储,留空表示保留原值
    legalIdCard: '',
    legalIdImages: [],
    contactName: row.contact_name ?? '',
    // 联系电话列表为脱敏值,留空保留原值
    contactPhone: '',
    contactEmail: row.contact_email ?? '',
    address: row.address ?? '',
    remark: row.remark ?? '',
    siteId: row.site_id ?? 0,
    subAccountLimit: row.sub_account_limit ?? 3,
  });
  modalOpen.value = true;
}

async function saveMerchant(): Promise<void> {
  if (!form.merchantName.trim()) {
    message.warning(t('merchant.listPage.name'));
    return;
  }
  modalSaving.value = true;
  try {
    if (editingId.value) {
      await apiMerchantUpdate({ id: editingId.value, ...form });
      message.success(t('tip.saveSuccess'));
    } else {
      if (!form.creditCode.trim() || !form.legalPerson.trim() || !form.contactName.trim() || !form.contactPhone.trim()) {
        message.warning(t('merchant.listPage.name'));
        return;
      }
      await apiMerchantAdd({ ...form, siteId: NEW_MERCHANT_SITE_ID });
      message.success(t('tip.saveSuccess'));
    }
    modalOpen.value = false;
    await statusChanged();
  } finally {
    modalSaving.value = false;
  }
}

// ---------- 入驻审核 ----------
const auditOpen = ref(false);
const auditSaving = ref(false);
const auditTarget = ref<TableRow | null>(null);
const auditForm = reactive({ auditStatus: 1, auditRemark: '' });

function openAudit(row: TableRow): void {
  auditTarget.value = row;
  Object.assign(auditForm, { auditStatus: 1, auditRemark: '' });
  auditOpen.value = true;
}

async function doAudit(): Promise<void> {
  if (!auditTarget.value) {
    return;
  }
  if (auditForm.auditStatus === 2 && !auditForm.auditRemark.trim()) {
    message.warning(t('goods.audit.auditModal.warningRejectReasonRequired'));
    return;
  }
  auditSaving.value = true;
  try {
    const account = await apiMerchantAudit({ id: auditTarget.value.id, ...auditForm });
    auditOpen.value = false;
    if (auditForm.auditStatus === 1 && account) {
      Modal.success({
        title: t('goods.audit.auditModal.successPass'),
        content: `${t('login.username')}:${account.username}  ${t('system.admin.initialPwd')}:${account.password}`,
        width: 520,
      });
    } else {
      message.success(t('goods.audit.auditModal.successReject'));
    }
    await statusChanged();
  } finally {
    auditSaving.value = false;
  }
}

// ---------- 注销 ----------

const closeOpen = ref(false);
const closeSaving = ref(false);
const closeTarget = ref<TableRow | null>(null);
const closeRemark = ref('');

function openClose(row: TableRow): void {
  closeTarget.value = row;
  closeRemark.value = '';
  closeOpen.value = true;
}

async function doClose(): Promise<void> {
  if (!closeTarget.value) {
    return;
  }
  if (!closeRemark.value.trim()) {
    message.warning(t('common.required'));
    return;
  }
  closeSaving.value = true;
  try {
    await apiMerchantClose(closeTarget.value.id, closeRemark.value);
    message.success(t('common.delete'));
    closeOpen.value = false;
    await statusChanged();
  } finally {
    closeSaving.value = false;
  }
}

onMounted(() => {
  void load();
  openLinkedMerchant();
});
</script>

<template>
  <PageContainer>
    <div class="directory-heading">
      <div>
        <div class="directory-eyebrow">{{ t('menu.merchant') }}</div>
        <h1>{{ t('merchantDirectory.title') }}</h1>
        <p>{{ t('merchantDirectory.subtitle') }}</p>
      </div>
      <a-button class="directory-export" @click="exportList"><template #icon><DownloadOutlined /></template>{{ t('common.export') }}</a-button>
    </div>
    <div class="directory-cards">
      <button v-for="card in cards" :key="card.key" type="button" class="directory-card"
        :class="{ 'is-selected': query.status === card.status, 'is-blacklisted': card.key === 'blacklisted' }"
        :aria-pressed="query.status === card.status" @click="selectCard(card.status)">
        <span><ExclamationCircleOutlined v-if="card.key === 'blacklisted'" /> {{ card.label }}</span>
        <strong>{{ counts[card.key] ?? '—' }}</strong>
      </button>
    </div>
    <SearchFilterBar :key="filterKey" v-model="query.keyword" v-model:filter-values="filterValues"
      :filters="filters" :placeholder="t('merchantDirectory.keyword')" :total="pagination.total"
      :result-label="t('merchant.verifyPage.resultCount')" @search="searchFilters" />
    <a-table class="directory-table" :columns="columns" :data-source="list" :pagination="tablePagination"
      :loading="loading" row-key="id" size="middle" :scroll="{ x: 1195 }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'merchant_code'">
          <a class="directory-code" @click="openDetail(record)">{{ record.merchant_code || '#' + record.id }}</a>
        </template>
        <template v-else-if="column.dataIndex === 'merchant_name'">
          <div class="directory-name">{{ record.merchant_name }}</div>
          <div v-if="record.merchant_short_name" class="directory-secondary">{{ record.merchant_short_name }}</div>
        </template>
        <template v-else-if="column.dataIndex === 'business_types'">{{ businessText(record) }}</template>
        <template v-else-if="column.dataIndex === 'commission_plan'">
          <a-tag :color="planColors[record.commission_plan]">{{ planText(record.commission_plan) }}</a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'verification_status' || column.dataIndex === 'account_status'">
          <a-tag :color="statusColors[record[column.dataIndex]]">{{ t(`merchantDirectory.${record[column.dataIndex]}`) }}</a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'last_login_at'"><span class="directory-secondary">{{ record.last_login_at || '—' }}</span></template>
        <template v-else-if="column.key === 'action_col'">
          <a-space :size="4" class="directory-actions">
            <a-tooltip :title="t('common.detail')"><a-button type="text" size="small" :aria-label="t('common.detail')" @click="openDetail(record)"><template #icon><EyeOutlined /></template></a-button></a-tooltip>
            <a-tooltip :title="t('merchant.notifyPage.title')"><a-button v-perm="'merchant:list:notify'" type="text" size="small" :aria-label="t('merchant.notifyPage.title')" @click="openNotify(record)"><template #icon><BellOutlined /></template></a-button></a-tooltip>
            <a-tooltip :title="t('merchant.impersonate.start')"><a-button v-if="isSuper" v-perm="'merchant:list:impersonate'" type="text" size="small" :aria-label="t('merchant.impersonate.start')" @click="openImpersonate(record)"><template #icon><LoginOutlined /></template></a-button></a-tooltip>
            <MerchantStatusActions :merchant="record" suspend-icon-only @changed="statusChanged" />
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" root-class-name="merchant-profile-drawer" :width="600" :closable="false" :destroy-on-close="true">
      <template #title>
        <div class="profile-heading">
          <div>
            <h2>{{ detail?.merchant_name || t('common.detail') }}</h2>
            <p>{{ detail ? `${detail.merchant_code || '#' + detail.id} · ${businessText(detail)}` : '—' }}</p>
          </div>
          <a-button type="text" :aria-label="t('common.close')" @click="drawerOpen = false"><CloseOutlined /></a-button>
        </div>
      </template>
      <a-spin :spinning="detailLoading">
        <div v-if="detail" class="profile-content">
          <div class="profile-summary">
            <div class="profile-summary-main">
              <div class="profile-name">
                <h3>{{ detail.merchant_name }}</h3>
                <a-tag v-if="detail.commission_plan" :color="planColors[detail.commission_plan]">{{ planText(detail.commission_plan) }}</a-tag>
              </div>
              <p v-if="profileCompany && profileCompany !== detail.merchant_name">{{ profileCompany }}</p>
              <div class="profile-summary-meta">{{ businessText(detail) }}</div>
              <div v-if="detail.address" class="profile-summary-meta">{{ detail.address }}</div>
            </div>
            <div class="profile-statuses">
              <a-tag :color="statusColors[detail.account_status] || 'default'">{{ t(`merchantDirectory.${detail.account_status}`) }}</a-tag>
              <a-tag :color="statusColors[detail.verification_status] || 'default'">{{ t(`merchantDirectory.${detail.verification_status}`) }}</a-tag>
            </div>
          </div>

          <dl class="profile-fields">
            <div v-for="field in profileFields" :key="field.key" class="profile-field">
              <dt>{{ field.label }}</dt>
              <dd :class="{ 'profile-mono': field.mono }">{{ field.value }}</dd>
            </div>
          </dl>

          <CommercialSettingsDrawer :key="detail.id" :merchant="detail" @changed="statusChanged" />

          <AccountSecurityPanel :key="detail.id" :merchant-id="detail.id" :access-configured="!!detail.access_code_configured" />

          <section>
            <h4 class="profile-section-title">{{ t('merchant.profile.monthlyPerformance') }}</h4>
            <div class="profile-performance">
              <div class="profile-metric profile-metric-revenue">
                <div>{{ t('merchant.profile.revenueMtd') }}</div>
                <strong>{{ performanceValue(detail.revenue_mtd, true) }}</strong>
              </div>
              <div class="profile-metric profile-metric-bookings">
                <div>{{ t('merchant.profile.bookingsMtd') }}</div>
                <strong>{{ performanceValue(detail.bookings_mtd) }}</strong>
              </div>
            </div>
          </section>

          <div class="profile-actions">
            <a-button v-if="isSuper" v-perm="'merchant:list:impersonate'" class="profile-action-impersonate" @click="openImpersonate(detail)"><LoginOutlined />{{ t('merchant.impersonate.start') }}</a-button>
            <a-button v-perm="'merchant:list:notify'" class="profile-action-notify" @click="openNotify(detail)"><BellOutlined />{{ t('merchant.notifyPage.title') }}</a-button>
            <MerchantStatusActions :merchant="detail" @changed="statusChanged" />
          </div>

          <MerchantPropertyPanel :key="detail.id" :merchant="detail" :applications="detailApplications" :businesses="detailBusinesses"
            :properties="detailProperties" :group="detailGroup" @changed="statusChanged" />

          <details class="profile-more">
            <summary>{{ t('merchant.profile.moreManagement') }}</summary>
            <div class="profile-more-body">
              <div class="directory-detail-actions">
                <a-button v-if="detail.status !== 5" v-perm="'merchant:list:edit'" @click="openEdit(detail)">{{ t('common.edit') }}</a-button>
                <a-button v-if="detail.status === 0" v-perm="'merchant:list:audit'" @click="openAudit(detail)">{{ t('goods.audit.columns.pass') }}</a-button>
                <a-button v-if="detail.status !== 5" v-perm="'merchant:list:delete'" danger @click="openClose(detail)">{{ t('common.delete') }}</a-button>
                <a-button v-perm="'merchant:list:module'" @click="openModules(detail)">{{ t('merchant.modulePage.title') }}</a-button>
              </div>
              <ComplianceLinks :merchant-id="detail.id" />
              <h4 class="profile-section-title">{{ t('merchant.modulePage.title') }}</h4>
              <a-space v-if="detailModules.length" wrap>
                <a-tag v-for="key in detailModules" :key="key" color="processing">{{ moduleLabel(key) }}</a-tag>
              </a-space>
              <a-tag v-else color="default">{{ t('merchant.modulePage.unmanaged') }}</a-tag>
              <p class="profile-summary-meta">{{ t('merchant.listPage.subAccountLimit') }}: {{ detail.sub_account_limit ?? 3 }}</p>
              <template v-if="detail.legal_id_images?.length">
                <h4 class="profile-section-title">{{ t('goods.common.images') }}</h4>
                <a-image-preview-group>
                  <a-space wrap>
                    <a-image v-for="(img, idx) in detail.legal_id_images" :key="idx" :src="img" :width="96" />
                  </a-space>
                </a-image-preview-group>
              </template>
              <h4 class="profile-section-title">{{ t('finance.msettlePage.withdraw.account') }}</h4>
              <a-table :columns="accountColumns" :data-source="detailAccounts" row-key="id" size="small" :pagination="false" :scroll="{ x: 500 }">
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'is_default'">
                    <a-tag v-if="record.is_default === 1" color="success">{{ t('common.confirm') }}</a-tag>
                    <span v-else>—</span>
                  </template>
                </template>
              </a-table>
              <h4 class="profile-section-title">{{ t('system.admin.title') }}</h4>
              <a-table :columns="adminColumns" :data-source="detailAdmins" row-key="id" size="small" :pagination="false" :scroll="{ x: 650 }">
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'is_owner'">{{ record.is_owner === 1 ? t('common.yes') : t('common.no') }}</template>
                  <template v-else-if="column.dataIndex === 'account_type'">{{ t(`merchant.accountType.t${record.account_type}`) }}</template>
                  <template v-else-if="column.dataIndex === 'status'"><StatusTag :value="record.status" /></template>
                </template>
              </a-table>
            </div>
          </details>
        </div>
      </a-spin>
    </a-drawer>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('common.edit') : t('common.add')"
      width="680px"
      :confirm-loading="modalSaving"
      @ok="saveMerchant"
    >
      <a-form :label-col="{ style: { width: '110px' } }" style="margin-top: 16px">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item :label="t('merchant.listPage.name')" required>
              <a-input v-model:value="form.merchantName" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('common.type')" required>
              <a-select v-model:value="form.merchantType">
                <a-select-option :value="1">{{ TYPE_TEXT[1] }}</a-select-option>
                <a-select-option :value="2">{{ TYPE_TEXT[2] }}</a-select-option>
                <a-select-option :value="3">{{ TYPE_TEXT[3] }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.listPage.code')" :required="!editingId">
              <a-input v-model:value="form.creditCode" :disabled="!!editingId" :placeholder="t('common.pleaseInput')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('user.realName')" :required="!editingId">
              <a-input v-model:value="form.legalPerson" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('system.admin.mobile')">
              <a-input v-model:value="form.legalIdCard" :placeholder="editingId ? t('common.optional') : ''" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('goods.common.coverImage')">
              <a-select v-model:value="form.legalIdImages" mode="tags" :placeholder="t('common.pleaseInput')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.listPage.contact')" :required="!editingId">
              <a-input v-model:value="form.contactName" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.listPage.phone')" :required="!editingId">
              <a-input v-model:value="form.contactPhone" :placeholder="editingId ? t('common.optional') : ''" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.listPage.email')">
              <a-input v-model:value="form.contactEmail" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item v-if="isSuper && !editingId" :label="t('common.site')" required>
              <SiteTreeSelect :value="NEW_MERCHANT_SITE_ID" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('merchant.listPage.subAccountLimit')" :help="t('merchant.listPage.subAccountLimitHelp')">
              <a-input-number v-model:value="form.subAccountLimit" :min="0" :max="50" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('common.address')">
              <a-input v-model:value="form.address" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('common.remark')">
              <a-input v-model:value="form.remark" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 功能模块授权 -->
    <a-modal
      v-model:open="moduleOpen"
      :title="t('merchant.modulePage.title')"
      width="520px"
      :confirm-loading="moduleSaving"
      @ok="saveModules"
    >
      <a-alert
        v-if="moduleUnmanaged"
        type="info"
        show-icon
        :message="t('merchant.modulePage.unmanagedTip')"
        style="margin-bottom: 16px"
      />
      <a-checkbox-group v-model:value="moduleChecked" style="width: 100%">
        <a-space direction="vertical" style="width: 100%">
          <a-checkbox v-for="mod in moduleAvailable" :key="mod.key" :value="mod.key">
            {{ moduleLabel(mod.key) }}
          </a-checkbox>
        </a-space>
      </a-checkbox-group>
      <a-alert type="warning" show-icon :message="t('merchant.modulePage.relogin')" style="margin-top: 16px" />
    </a-modal>

    <!-- 入驻审核 -->
    <a-modal
      v-model:open="auditOpen"
      :title="`${t('goods.audit.title')}:${auditTarget?.merchant_name ?? ''}`"
      width="480px"
      :confirm-loading="auditSaving"
      @ok="doAudit"
    >
      <a-form layout="vertical" style="margin-top: 16px">
        <a-form-item :label="t('goods.audit.auditResult')" required>
          <a-radio-group v-model:value="auditForm.auditStatus">
            <a-radio :value="1"><span style="color: #52c41a">{{ t('goods.audit.auditPass') }}</span></a-radio>
            <a-radio :value="2"><span style="color: #fa8c16">{{ t('goods.audit.auditReject') }}</span></a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('goods.audit.auditModal.opinion')" :required="auditForm.auditStatus === 2">
          <a-textarea v-model:value="auditForm.auditRemark" :rows="3" :placeholder="auditForm.auditStatus === 2 ? t('goods.audit.auditModal.requiredPlaceholder') : t('common.optional')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 注销(高危) -->
    <a-modal
      v-model:open="closeOpen"
      :title="`${t('common.delete')}:${closeTarget?.merchant_name ?? ''}`"
      width="480px"
      :confirm-loading="closeSaving"
      :ok-text="t('common.confirm')"
      :ok-button-props="{ danger: true }"
      @ok="doClose"
    >
      <a-alert
        :message="t('tip.deleteFailed')"
        type="error"
        show-icon
        style="margin: 12px 0 16px"
      />
      <a-textarea v-model:value="closeRemark" :rows="3" :placeholder="t('common.required')" />
    </a-modal>



    <!-- 发送通知抽屉 / 代入弹窗(整改 B1/B2) -->
    <NotifyDrawer v-model:open="notifyOpen" :merchant="notifyTarget" @sent="load" />
    <ImpersonateModal v-model:open="impersonateOpen" :merchant="impersonateTarget" />
  </PageContainer>
</template>

<style scoped>
.directory-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.directory-heading h1 { font-size: 18px; line-height: 27px; color: #1a2332; font-weight: 700; margin: 0 0 2px; }
.directory-heading p { font-size: 13px; color: #94a3b8; margin: 0; }
.directory-eyebrow { margin-bottom: 4px; font-size: 11px; font-weight: 500; line-height: 16.5px; letter-spacing: .05em; text-transform: uppercase; color: #94a3b8; }
.directory-heading p { line-height: 19.5px; }
.directory-export { height: 34px; font-size: 13px; color: #475569; border-color: #e3e8f0; }
.directory-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
.directory-card { text-align: left; padding: 14px 16px; background: #fff; border: 1px solid #e3e8f0; border-radius: 8px; cursor: pointer; color: #94a3b8; font-size: 12px; }
.directory-card strong { display: block; margin-top: 8px; font-size: 24px; line-height: 30px; font-weight: 600; color: #1a2332; }
.directory-card.is-blacklisted { color: #ef4444; background: #fff7f7; border-color: #fecaca; }
.directory-card.is-blacklisted strong { color: #ef4444; }
.directory-card.is-selected { border-color: #2563eb; box-shadow: 0 0 0 1px #2563eb; }
.directory-card:focus-visible { outline: 2px solid #2563eb; outline-offset: 3px; }
.directory-code { font-family: monospace; color: #2563eb; }
.directory-name { font-weight: 600; color: #1a2332; }
.directory-secondary { color: #94a3b8; font-size: 12px; }
.directory-actions :deep(.ant-btn) { color: #94a3b8; width: 26px; height: 26px; padding: 0; }
.directory-actions :deep(.ant-btn:hover:not(:disabled)) { color: #2563eb; background: #eff6ff; }
.directory-actions :deep(.ant-btn:disabled) { color: #cbd5e1; }
.directory-detail-actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
.profile-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.profile-heading > div { min-width: 0; }
.profile-heading h2 { margin: 0; color: #1a2332; font-size: 15px; line-height: 21px; font-weight: 700; overflow-wrap: anywhere; }
.profile-heading p { margin: 1px 0 0; color: #94a3b8; font-size: 12px; line-height: 18px; font-weight: 400; overflow-wrap: anywhere; }
.profile-heading > .ant-btn { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 32px; width: 32px; height: 32px; padding: 0; color: #64748b; }
.profile-heading > .ant-btn :deep(.anticon) { font-size: 14px; }
.profile-content { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.profile-summary { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px; border: 1px solid #e3e8f0; border-radius: 8px; background: #f8fafc; }
.profile-summary-main { min-width: 0; }
.profile-name { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.profile-name h3 { margin: 0; color: #1a2332; font-size: 16px; line-height: 24px; font-weight: 700; overflow-wrap: anywhere; }
.profile-summary p { margin: 4px 0 0; font-size: 13px; color: #64748b; overflow-wrap: anywhere; }
.profile-summary-meta { margin-top: 4px; color: #94a3b8; font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
.profile-statuses { display: flex; align-items: flex-end; flex-direction: column; gap: 8px; flex-shrink: 0; }
.profile-summary :deep(.ant-tag) { margin: 0; font-size: 11px; line-height: 20px; border: 0; }
.profile-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; }
.profile-field { padding: 8px 12px; border: 1px solid #f1f5f9; border-radius: 6px; background: #f8fafc; min-width: 0; }
.profile-field dt { margin-bottom: 2px; font-size: 11px; line-height: 17px; color: #94a3b8; }
.profile-field dd { margin: 0; font-size: 13px; line-height: 20px; font-weight: 500; color: #1a2332; overflow-wrap: anywhere; }
.profile-mono { font-family: monospace; }
.profile-section-title { margin: 0 0 10px; color: #64748b; font-size: 12px; line-height: 18px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.profile-performance { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.profile-metric { padding: 12px; border: 1px solid; border-radius: 8px; text-align: center; min-width: 0; }
.profile-metric > div { font-size: 11px; margin-bottom: 4px; }
.profile-metric strong { display: block; font: 700 20px/28px monospace; overflow-wrap: anywhere; }
.profile-metric-revenue { background: #eef4ff; border-color: #bfdbfe; color: #2563eb; }
.profile-metric-revenue strong { color: #1e40af; }
.profile-metric-bookings { background: #ecfdf3; border-color: #a7f3d0; color: #059669; }
.profile-metric-bookings strong { color: #065f46; }
.profile-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding-top: 2px; }
.profile-actions > .ant-btn { height: 36px; font-size: 13px; font-weight: 500; border-radius: 6px; }
.profile-action-impersonate { border-color: #fde68a; background: #fef3c7; color: #92400e; }
.profile-action-notify { border-color: #c7d2fe; background: #eef2ff; color: #4f46e5; }
.profile-more { border: 1px solid #e3e8f0; border-radius: 8px; }
.profile-more > summary { padding: 12px 14px; font-size: 12px; font-weight: 600; color: #64748b; cursor: pointer; }
.profile-more-body { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 0 14px 14px; }
.profile-more-body .directory-detail-actions { margin-top: 0; }
.profile-more-body .profile-section-title { margin: 4px 0 0; }
:global(.merchant-profile-drawer .ant-drawer-content-wrapper) { max-width: 100vw; }
:global(.merchant-profile-drawer .ant-drawer-header) { padding: 10px 24px; min-height: 60px; border-color: #e3e8f0; }
:global(.merchant-profile-drawer .ant-drawer-body) { padding: 20px 24px; }
.directory-table :deep(.ant-table) { border: 1px solid #e3e8f0; border-radius: 8px; overflow: hidden; }
.directory-table :deep(.ant-table-thead > tr > th) { font-size: 12px; color: #64748b; background: #f8fafc; }
.directory-table :deep(.ant-pagination-total-text) { margin-right: auto; color: #94a3b8; font-size: 12px; }
@media (max-width: 900px) { .directory-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px) {
  :global(.merchant-profile-drawer .ant-drawer-header) { padding: 10px 16px; }
  :global(.merchant-profile-drawer .ant-drawer-body) { padding: 16px; }
  .profile-summary { padding: 12px; }
  .profile-name h3 { font-size: 15px; }
}
</style>
