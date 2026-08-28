<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Modal, message } from 'ant-design-vue';
import { BellOutlined, LoginOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
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

/** 导出当前筛选结果(整改 D2) */
async function exportList(): Promise<void> {
  const data = await apiMerchantList({ ...query, page: 1, pageSize: 200 });
  exportCsv(`merchants-${Date.now()}.csv`, [
    { key: 'id', label: 'ID' },
    { key: 'merchant_name', label: 'Merchant' },
    { key: 'merchant_type', label: 'Type' },
    { key: 'contact_name', label: 'Contact' },
    { key: 'contact_phone', label: 'Phone' },
    { key: 'commission_rate', label: 'Commission %' },
    { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Created At' },
  ], data.list.map((row) => ({
    ...row,
    merchant_type: TYPE_TEXT.value[row.merchant_type] ?? row.merchant_type,
    status: STATUS_MAP.value[row.status]?.text ?? row.status,
  })));
}

const STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('status.pending'), color: 'warning' },
  2: { text: t('common.failed'), color: 'error' },
  3: { text: t('status.enabled'), color: 'success' },
  4: { text: t('status.disabled'), color: 'default' },
  5: { text: t('common.delete'), color: 'default' },
  6: { text: t('merchantDirectory.kycResubmit'), color: 'warning' },
}));
const TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('goods.common.typeHotel'),
  2: t('goods.common.typeTicket'),
  3: t('merchant.title'),
}));

const { loading, list, query, load, search, reset, pagination } = useTable(apiMerchantList, {
  keyword: '', category: undefined, status: undefined, siteId: 0,
  country: '', city: '', registeredFrom: '', registeredTo: '', sortField: 'registeredAt', sortOrder: 'desc',
});

const columns = computed(() => [
  { title: t('merchant.profile.merchantId'), dataIndex: 'merchant_code', width: 125 },
  { title: t('merchant.listPage.name'), dataIndex: 'merchant_name', width: 200, ellipsis: true },
  { title: t('common.type'), dataIndex: 'merchant_type', width: 100 },
  { title: t('merchant.listPage.contact'), dataIndex: 'contact_name', width: 100 },
  { title: t('merchant.listPage.phone'), dataIndex: 'contact_phone', width: 130 },
  { title: t('merchantDirectory.commission'), dataIndex: 'commission_rate', width: 100 },
  { title: t('merchantDirectory.settlement'), dataIndex: 'settlement_cycle', width: 100 },
  { title: t('merchant.listPage.status'), dataIndex: 'status', width: 90 },
  { title: t('common.createdAt'), dataIndex: 'created_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 300, fixed: 'right' as const },
]);

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
  } finally {
    detailLoading.value = false;
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
    await load();
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
    await load();
  } finally {
    auditSaving.value = false;
  }
}

// ---------- 费率配置 ----------
const commissionOpen = ref(false);
const commissionSaving = ref(false);
const commissionTarget = ref<TableRow | null>(null);
const commissionForm = reactive({ commissionRate: 0, settlementCycle: 15 });

function openCommission(row: TableRow): void {
  commissionTarget.value = row;
  Object.assign(commissionForm, {
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
    await load();
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
    await load();
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
      <div><h1>{{ t('merchantDirectory.title') }}</h1><p>{{ t('merchantDirectory.subtitle') }}</p></div>
      <a-button @click="exportList">{{ t('common.export') }}</a-button>
    </div>
    <a-alert type="info" show-icon :message="t('merchantDirectory.filterHint')" style="margin-bottom: 12px" />
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('common.search')">
          <a-input v-model:value="query.keyword" allow-clear :maxlength="100" :placeholder="t('merchantDirectory.keyword')" style="width: 300px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('common.type')">
          <a-select v-model:value="query.category" allow-clear :placeholder="t('common.all')" style="width: 120px">
            <a-select-option value="hotel">{{ TYPE_TEXT[1] }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('merchantDirectory.country')"><a-input v-model:value="query.country" allow-clear :maxlength="2" placeholder="MM" style="width: 90px" /></a-form-item>
        <a-form-item :label="t('merchantDirectory.city')"><a-input v-model:value="query.city" allow-clear style="width: 150px" /></a-form-item>
        <a-form-item :label="t('merchantDirectory.registeredFrom')"><a-date-picker v-model:value="query.registeredFrom" value-format="YYYY-MM-DD" /></a-form-item>
        <a-form-item :label="t('merchantDirectory.registeredTo')"><a-date-picker v-model:value="query.registeredTo" value-format="YYYY-MM-DD" /></a-form-item>
        <a-form-item :label="t('merchantDirectory.sort')">
          <a-select v-model:value="query.sortField" style="width: 140px">
            <a-select-option value="registeredAt">{{ t('common.createdAt') }}</a-select-option>
            <a-select-option value="merchantName">{{ t('merchant.listPage.name') }}</a-select-option>
            <a-select-option value="lastLoginAt">{{ t('merchant.profile.lastLogin') }}</a-select-option>
            <a-select-option value="id">ID</a-select-option>
          </a-select>
          <a-select v-model:value="query.sortOrder" style="width: 90px">
            <a-select-option value="desc">{{ t('merchantDirectory.desc') }}</a-select-option>
            <a-select-option value="asc">{{ t('merchantDirectory.asc') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('merchant.listPage.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 120px">
            <a-select-option :value="0">{{ STATUS_MAP[0].text }}</a-select-option>
            <a-select-option :value="2">{{ STATUS_MAP[2].text }}</a-select-option>
            <a-select-option :value="3">{{ STATUS_MAP[3].text }}</a-select-option>
            <a-select-option :value="4">{{ STATUS_MAP[4].text }}</a-select-option>
            <a-select-option :value="5">{{ STATUS_MAP[5].text }}</a-select-option>
            <a-select-option :value="6">{{ STATUS_MAP[6].text }}</a-select-option>
            <a-select-option value="blacklisted">{{ t('merchantStatus.blacklisted') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="isSuper" :label="t('common.site')">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-table
      :columns="columns"
      :data-source="list"
      :pagination="pagination"
      :loading="loading"
      row-key="id"
      size="middle"
      :scroll="{ x: 1400 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'merchant_code'">{{ record.merchant_code || '#' + record.id }}</template>
        <template v-else-if="column.dataIndex === 'merchant_type'">
          {{ TYPE_TEXT[record.merchant_type] ?? record.merchant_type }}
        </template>
        <template v-else-if="column.dataIndex === 'settlement_cycle'">
          {{ record.settlement_cycle === 30 ? t('merchantDirectory.monthly') : 'T+' + record.settlement_cycle }}
        </template>
        <template v-else-if="column.dataIndex === 'status'">
          <a-tag v-if="record.is_blacklisted" color="error">{{ t('merchantStatus.blacklisted') }}</a-tag>
          <StatusTag v-else :value="record.status" :map="STATUS_MAP" />
        </template>
        <template v-else-if="column.key === 'action_col'">
          <a-space :size="0" wrap>
            <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
            <a-button
              v-if="record.status !== 5"
              v-perm="'merchant:list:edit'"
              type="link"
              size="small"
              @click="openEdit(record)"
            >{{ t('common.edit') }}</a-button>
            <a-button
              v-if="record.status === 0"
              v-perm="'merchant:list:audit'"
              type="link"
              size="small"
              style="color: var(--mtrip-warning, #faad14)"
              @click="openAudit(record)"
            >{{ t('goods.audit.columns.pass') }}</a-button>
            <a-button
              v-if="record.status === 3 || record.status === 4"
              v-perm="'merchant:list:edit'"
              type="link"
              size="small"
              @click="openCommission(record)"
            >{{ t('config.pay.feeRate') }}</a-button>
            <MerchantStatusActions :merchant="record" @changed="statusChanged" />
            <a-tooltip :title="t('merchant.notifyPage.title')">
              <a-button
                v-perm="'merchant:list:notify'"
                type="link"
                size="small"
                @click="openNotify(record)"
              ><template #icon><BellOutlined /></template></a-button>
            </a-tooltip>
            <a-tooltip :title="t('merchant.impersonate.title')">
              <a-button
                v-if="isSuper"
                v-perm="'merchant:list:impersonate'"
                type="link"
                size="small"
                @click="openImpersonate(record)"
              ><template #icon><LoginOutlined /></template></a-button>
            </a-tooltip>
            <a-button
              v-if="record.status !== 5"
              v-perm="'merchant:list:delete'"
              type="link"
              size="small"
              danger
              @click="openClose(record)"
            >{{ t('common.delete') }}</a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" :title="detail ? `${t('merchant.profile.merchantId')}: ${detail.merchant_name}` : t('common.detail')" width="720">
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
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px">{{ TYPE_TEXT[detail.merchant_type] ?? detail.merchant_type }}</div>
            </div>
          </div>

          <!-- 字段网格 -->
          <a-descriptions :column="2" size="small" bordered style="margin-bottom: 16px">
            <a-descriptions-item :label="t('merchant.profile.merchantId')">{{ detail.merchant_code || '#' + detail.id }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.profile.regNo')">{{ detail.credit_code || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.profile.owner')">{{ detail.legal_person || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.profile.commissionPlan')">
              {{ detail.commission_rate != null ? `${detail.commission_rate}%` : '-' }}
            </a-descriptions-item>
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

          <!-- 底部动作(整改 A4) -->
          <div style="display: flex; gap: 8px; margin-top: 16px">
            <MerchantStatusActions :merchant="detail" @changed="statusChanged" />
            <a-button v-perm="'merchant:list:notify'" @click="openNotify(detail)">{{ t('merchant.notifyPage.title') }}</a-button>
            <a-button v-if="isSuper" v-perm="'merchant:list:impersonate'" @click="openImpersonate(detail)">{{ t('merchant.impersonate.start') }}</a-button>
          </div>

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
      :title="`${t('config.pay.feeRate')}:${commissionTarget?.merchant_name ?? ''}`"
      width="420px"
      :confirm-loading="commissionSaving"
      @ok="saveCommission"
    >
      <a-form :label-col="{ style: { width: '90px' } }" style="margin-top: 16px">
        <a-form-item :label="t('config.pay.feeRate')" required>
          <a-input-number v-model:value="commissionForm.commissionRate" :min="0" :max="100" :step="0.1" addon-after="%" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('merchant.listPage.code')" required>
          <a-radio-group v-model:value="commissionForm.settlementCycle">
            <a-radio :value="7">T+7</a-radio>
            <a-radio :value="15">T+15</a-radio>
            <a-radio :value="30">{{ t('common.all') }}</a-radio>
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
.directory-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.directory-heading h1 { font-size: 18px; line-height: 27px; color: #1a2332; font-weight: 700; margin: 0 0 2px; }
.directory-heading p { font-size: 13px; color: #94a3b8; margin: 0; }
:deep(.ant-form-inline) { row-gap: 12px; }
</style>
