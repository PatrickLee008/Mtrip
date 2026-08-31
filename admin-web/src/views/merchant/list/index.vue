<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Modal, message } from 'ant-design-vue';
import { BellOutlined, LoginOutlined, EyeOutlined, DownloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons-vue';
import SearchFilterBar, { type FilterConfig } from '@/components/SearchFilterBar.vue';
import AccountSecurityPanel from '@/components/merchant/AccountSecurityPanel.vue';
import ComplianceLinks from '@/components/merchant/ComplianceLinks.vue';
import MerchantPropertyPanel from '@/components/merchant/MerchantPropertyPanel.vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import NotifyDrawer from '@/components/merchant/NotifyDrawer.vue';
import ImpersonateModal from '@/components/merchant/ImpersonateModal.vue';
import MerchantStatusActions from '@/components/merchant/MerchantStatusActions.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import type { StatusItem } from '@/components/StatusTag.vue';
import {
  apiMerchantAdd,

  apiMerchantAudit,
  apiMerchantClose,
  apiMerchantCommission,
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
const STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('merchantDirectory.pending'), color: 'warning' },
  1: { text: t('merchantDirectory.inactive'), color: 'default' },
  2: { text: t('merchantDirectory.rejected'), color: 'error' },
  3: { text: t('merchantDirectory.active'), color: 'success' },
  4: { text: t('merchantDirectory.suspended'), color: 'error' },
  5: { text: t('merchantDirectory.closed'), color: 'default' },
  6: { text: t('merchantDirectory.resubmission'), color: 'processing' },
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

async function openDetail(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  detailLoading.value = true;
  try {
    const data = await apiMerchantDetail(row.id);
    detail.value = data.merchant;
    detailAccounts.value = data.accounts;
    detailAdmins.value = data.admins;
    detailApplications.value = data.applications;
    detailBusinesses.value = data.businesses;
    detailProperties.value = data.properties;
    detailGroup.value = data.group;
    detailModules.value = data.modules ?? [];
  } finally {
    detailLoading.value = false;
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
  siteId: 0,
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
      await apiMerchantAdd({ ...form });
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

// ---------- 费率配置 ----------
const commissionOpen = ref(false);
const commissionSaving = ref(false);
const commissionTarget = ref<TableRow | null>(null);
const commissionForm = reactive({ commissionRate: 0, settlementCycle: 15, commissionPlan: 'standard' });

function openCommission(row: TableRow): void {
  commissionTarget.value = row;
  Object.assign(commissionForm, {
    commissionPlan: row.commission_plan || 'standard',
    commissionRate: Number(row.commission_rate ?? 0),
    settlementCycle: Number(row.settlement_cycle ?? 15),
  });
  commissionOpen.value = true;
}

async function saveCommission(): Promise<void> {
  if (!commissionTarget.value) {
    return;
  }
  commissionSaving.value = true;
  try {
    await apiMerchantCommission({ id: commissionTarget.value.id, ...commissionForm });
    message.success(t('tip.saveSuccess'));
    commissionOpen.value = false;
    await statusChanged();
  } finally {
    commissionSaving.value = false;
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
    <a-drawer v-model:open="drawerOpen" :title="detail ? `${t('merchant.profile.merchantId')}: ${detail.merchant_name}` : t('common.detail')" width="1100">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <!-- 头部卡(整改 A3,原型 §3.5.5) -->
          <div style="display: flex; gap: 14px; padding: 14px; border: 1px solid #e3e8f0; border-radius: 10px; margin-bottom: 16px; background: #fff">
            <div style="width: 48px; height: 48px; border-radius: 8px; background: #1664ff; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; flex-shrink: 0">
              {{ (detail.merchant_name || 'M').slice(0, 1) }}
            </div>
            <div style="flex: 1; min-width: 0">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
                <span style="font-size: 16px; font-weight: 700; color: #1a2332">{{ detail.merchant_name }}</span>
                <a-tag v-if="detail.is_vip === 1" color="gold">VIP</a-tag>
                <a-tag v-if="detail.is_blacklisted" color="error">{{ t('merchantStatus.blacklisted') }}</a-tag>
                <StatusTag v-else :value="detail.status" :map="STATUS_MAP" />
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px">{{ detail.merchant_short_name || detail.credit_code }}</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px">{{ businessText(detail) }}</div>
            </div>
          </div>

          <!-- 字段网格 -->
          <a-descriptions :column="3" size="small" bordered style="margin-bottom: 16px">
            <a-descriptions-item :label="t('merchant.profile.merchantId')">{{ detail.merchant_code || '#' + detail.id }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.profile.regNo')">{{ detail.credit_code || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.profile.owner')">{{ detail.legal_person || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.profile.commissionPlan')">
              {{ planText(detail.commission_plan) }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('merchantDirectory.commission')">{{ detail.commission_rate }}%</a-descriptions-item>
            <a-descriptions-item :label="t('merchantDirectory.verification')">{{ t(`merchantDirectory.${detail.verification_status}`) }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchantDirectory.accountStatus')">{{ t(`merchantDirectory.${detail.account_status}`) }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.listPage.email')">{{ detail.contact_email || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.listPage.phone')">{{ detail.contact_phone || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.profile.bankName')">{{ detailAccounts[0]?.bank_name || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.profile.bankAccount')">{{ detailAccounts[0]?.account_no || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.profile.joinDate')">{{ detail.created_at || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.profile.lastLogin')">{{ detail.last_login_at || '-' }}</a-descriptions-item>
          </a-descriptions>

          <MerchantPropertyPanel :merchant="detail" :applications="detailApplications" :businesses="detailBusinesses"
            :properties="detailProperties" :group="detailGroup" @changed="statusChanged" />

          <AccountSecurityPanel :merchant-id="detail.id" :access-configured="!!detail.access_code_configured" />
          <ComplianceLinks :merchant-id="detail.id" />

          <!-- 月度绩效(整改 A3) -->
          <a-divider orientation="left">{{ t('merchant.profile.monthlyPerformance') }}</a-divider>
          <a-row :gutter="12">
            <a-col :span="12">
              <div style="border: 1px solid #e3e8f0; border-radius: 8px; padding: 12px 14px; background: #f8fafc">
                <div style="font-size: 11px; color: #94a3b8">{{ t('merchant.profile.revenueMtd') }}</div>
                <div style="font-size: 18px; font-weight: 700; color: #1a2332; margin-top: 2px">
                  {{ detail.revenue_mtd != null ? `¥${Number(detail.revenue_mtd).toLocaleString()}` : '-' }}
                </div>
              </div>
            </a-col>
            <a-col :span="12">
              <div style="border: 1px solid #e3e8f0; border-radius: 8px; padding: 12px 14px; background: #f8fafc">
                <div style="font-size: 11px; color: #94a3b8">{{ t('merchant.profile.bookingsMtd') }}</div>
                <div style="font-size: 18px; font-weight: 700; color: #1a2332; margin-top: 2px">{{ detail.bookings_mtd ?? '-' }}</div>
              </div>
            </a-col>
          </a-row>

          <!-- 完整操作放在详情中；列表仅保留四个图标入口。 -->
          <div class="directory-detail-actions">
            <a-button v-if="detail.status !== 5" v-perm="'merchant:list:edit'" @click="openEdit(detail)">{{ t('common.edit') }}</a-button>
            <a-button v-if="detail.status === 0" v-perm="'merchant:list:audit'" @click="openAudit(detail)">{{ t('goods.audit.columns.pass') }}</a-button>
            <a-button v-if="[3, 4].includes(detail.status)" v-perm="'merchant:list:edit'" @click="openCommission(detail)">{{ t('merchant.profile.commissionPlan') }}</a-button>
            <a-button v-if="detail.status !== 5" v-perm="'merchant:list:delete'" danger @click="openClose(detail)">{{ t('common.delete') }}</a-button>
            <MerchantStatusActions :merchant="detail" @changed="statusChanged" />
            <a-button v-perm="'merchant:list:notify'" @click="openNotify(detail)">{{ t('merchant.notifyPage.title') }}</a-button>
            <a-button v-if="isSuper" v-perm="'merchant:list:impersonate'" @click="openImpersonate(detail)">{{ t('merchant.impersonate.start') }}</a-button>
            <a-button v-perm="'merchant:list:module'" @click="openModules(detail)">{{ t('merchant.modulePage.title') }}</a-button>
          </div>

          <a-divider orientation="left">{{ t('merchant.modulePage.title') }}</a-divider>
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item :label="t('merchant.modulePage.granted')">
              <a-space v-if="detailModules.length" wrap>
                <a-tag v-for="key in detailModules" :key="key" color="processing">{{ moduleLabel(key) }}</a-tag>
              </a-space>
              <a-tag v-else color="default">{{ t('merchant.modulePage.unmanaged') }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item :label="t('merchant.listPage.subAccountLimit')">
              {{ detail.sub_account_limit ?? 3 }}
            </a-descriptions-item>
          </a-descriptions>

          <template v-if="detail.legal_id_images?.length">
            <a-divider orientation="left">{{ t('goods.common.images') }}</a-divider>
            <a-image-preview-group>
              <a-space wrap>
                <a-image v-for="(img, idx) in detail.legal_id_images" :key="idx" :src="img" :width="96" />
              </a-space>
            </a-image-preview-group>
          </template>

          <a-divider orientation="left">{{ t('finance.msettlePage.withdraw.account') }}</a-divider>
          <a-table :columns="accountColumns" :data-source="detailAccounts" row-key="id" size="small" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'is_default'">
                <a-tag v-if="record.is_default === 1" color="success">{{ t('common.confirm') }}</a-tag>
                <span v-else>-</span>
              </template>
            </template>
          </a-table>

          <a-divider orientation="left">{{ t('system.admin.title') }}</a-divider>
          <a-table :columns="adminColumns" :data-source="detailAdmins" row-key="id" size="small" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'is_owner'">{{ record.is_owner === 1 ? t('common.yes') : t('common.no') }}</template>
              <template v-else-if="column.dataIndex === 'account_type'">{{ t(`merchant.accountType.t${record.account_type}`) }}</template>
              <template v-else-if="column.dataIndex === 'status'"><StatusTag :value="record.status" /></template>
            </template>
          </a-table>
        </template>
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
              <SiteTreeSelect v-model:value="form.siteId" />
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

    <!-- 费率配置 -->
    <a-modal
      v-model:open="commissionOpen"
      :title="`${t('merchant.profile.commissionPlan')}:${commissionTarget?.merchant_name ?? ''}`"
      width="420px"
      :confirm-loading="commissionSaving"
      @ok="saveCommission"
    >
      <a-form :label-col="{ style: { width: '90px' } }" style="margin-top: 16px">
        <a-form-item :label="t('merchant.profile.commissionPlan')" required>
          <a-select v-model:value="commissionForm.commissionPlan">
            <a-select-option v-for="plan in ['vip', 'premium', 'standard']" :key="plan" :value="plan">{{ planText(plan) }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('config.pay.feeRate')" required>
          <a-input-number v-model:value="commissionForm.commissionRate" :min="0" :max="100" :step="0.1" addon-after="%" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('merchantDirectory.settlement')" required>
          <a-radio-group v-model:value="commissionForm.settlementCycle">
            <a-radio :value="7">T+7</a-radio>
            <a-radio :value="15">T+15</a-radio>
            <a-radio :value="30">{{ t('merchantDirectory.monthly') }}</a-radio>
          </a-radio-group>
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
.directory-table :deep(.ant-table) { border: 1px solid #e3e8f0; border-radius: 8px; overflow: hidden; }
.directory-table :deep(.ant-table-thead > tr > th) { font-size: 12px; color: #64748b; background: #f8fafc; }
.directory-table :deep(.ant-tag) { border: none; font-size: 11px; }
.directory-table :deep(.ant-pagination-total-text) { margin-right: auto; color: #94a3b8; }
@media (max-width: 900px) { .directory-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
