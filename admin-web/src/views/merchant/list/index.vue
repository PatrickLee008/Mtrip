<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Modal, message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
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
  apiMerchantToggleStatus,
  apiMerchantUpdate,
} from '@/api/merchant';

const { t } = useI18n();

/** 商户列表:入驻审核/费率配置/启停/注销(文档 6.4.2;状态机 0→3/2,3⇄4,5终态) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('status.pending'), color: 'warning' },
  2: { text: t('common.failed'), color: 'error' },
  3: { text: t('status.enabled'), color: 'success' },
  4: { text: t('status.disabled'), color: 'default' },
  5: { text: t('common.delete'), color: 'default' },
}));
const TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('goods.common.typeHotel'),
  2: t('goods.common.typeTicket'),
  3: t('merchant.title'),
}));

const { loading, list, query, load, search, reset, pagination } = useTable(apiMerchantList, {
  merchantName: '',
  merchantType: undefined,
  status: undefined,
  siteId: 0,
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('merchant.listPage.name'), dataIndex: 'merchant_name', width: 200, ellipsis: true },
  { title: t('common.type'), dataIndex: 'merchant_type', width: 100 },
  { title: t('merchant.listPage.contact'), dataIndex: 'contact_name', width: 100 },
  { title: t('merchant.listPage.phone'), dataIndex: 'contact_phone', width: 130 },
  { title: t('merchant.title') + '(%)', dataIndex: 'commission_rate', width: 90 },
  { title: t('merchant.listPage.code'), dataIndex: 'settlement_cycle', width: 90 },
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

async function openDetail(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  detailLoading.value = true;
  try {
    const data = await apiMerchantDetail(row.id);
    detail.value = data.merchant;
    detailAccounts.value = data.accounts;
    detailAdmins.value = data.admins;
  } finally {
    detailLoading.value = false;
  }
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

function resetForm(): void {
  Object.assign(form, {
    merchantName: '',
    merchantType: 1,
    creditCode: '',
    legalPerson: '',
    legalIdCard: '',
    legalIdImages: [],
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    address: '',
    remark: '',
    siteId: 0,
  });
}

function openCreate(): void {
  editingId.value = 0;
  resetForm();
  modalOpen.value = true;
}

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

// ---------- 启停 / 注销 ----------
async function toggleStatus(row: TableRow): Promise<void> {
  const result = await apiMerchantToggleStatus(row.id);
  message.success(result.status === 3 ? t('common.enable') : t('common.disable'));
  await load();
}

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
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('merchant.listPage.name')">
          <a-input v-model:value="query.merchantName" allow-clear :placeholder="t('common.pleaseInput')" style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('common.type')">
          <a-select v-model:value="query.merchantType" allow-clear :placeholder="t('common.all')" style="width: 120px">
            <a-select-option :value="1">{{ TYPE_TEXT[1] }}</a-select-option>
            <a-select-option :value="2">{{ TYPE_TEXT[2] }}</a-select-option>
            <a-select-option :value="3">{{ TYPE_TEXT[3] }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('merchant.listPage.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 120px">
            <a-select-option :value="0">{{ STATUS_MAP[0].text }}</a-select-option>
            <a-select-option :value="2">{{ STATUS_MAP[2].text }}</a-select-option>
            <a-select-option :value="3">{{ STATUS_MAP[3].text }}</a-select-option>
            <a-select-option :value="4">{{ STATUS_MAP[4].text }}</a-select-option>
            <a-select-option :value="5">{{ STATUS_MAP[5].text }}</a-select-option>
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

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>{{ t('merchant.listPage.title') }}</template>
      <template #extra>
        <a-button v-perm="'merchant:list:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('merchant.listPage.name') }}
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1400 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'merchant_type'">
            {{ TYPE_TEXT[record.merchant_type] ?? record.merchant_type }}
          </template>
          <template v-else-if="column.dataIndex === 'settlement_cycle'">
            {{ record.settlement_cycle === 30 ? t('common.all') : `T+${record.settlement_cycle}` }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
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
              <a-popconfirm
                v-if="record.status === 3 || record.status === 4"
                :title="record.status === 3 ? t('common.disable') : t('common.enable')"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'merchant:list:status'" type="link" size="small" :danger="record.status === 3">
                  {{ record.status === 3 ? t('common.disable') : t('common.enable') }}
                </a-button>
              </a-popconfirm>
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
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" :title="t('common.detail')" width="720">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item :label="t('merchant.listPage.name')" :span="2">{{ detail.merchant_name }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.type')">{{ TYPE_TEXT[detail.merchant_type] ?? detail.merchant_type }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.status')"><StatusTag :value="detail.status" :map="STATUS_MAP" /></a-descriptions-item>
            <a-descriptions-item :label="t('merchant.listPage.code')" :span="2">{{ detail.credit_code }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.name')">{{ detail.legal_person }}</a-descriptions-item>
            <a-descriptions-item :label="t('system.admin.mobile')">{{ detail.legal_id_card || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.listPage.contact')">{{ detail.contact_name }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.listPage.phone')">{{ detail.contact_phone }}</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.listPage.email')" :span="2">{{ detail.contact_email || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.address')" :span="2">{{ detail.address || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('config.pay.feeRate')">{{ detail.commission_rate }}%</a-descriptions-item>
            <a-descriptions-item :label="t('merchant.listPage.code')">{{ detail.settlement_cycle === 30 ? t('common.all') : `T+${detail.settlement_cycle}` }}</a-descriptions-item>
            <a-descriptions-item :label="t('goods.audit.auditModal.opinion')" :span="2">{{ detail.audit_remark || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.remark')" :span="2">{{ detail.remark || '-' }}</a-descriptions-item>
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
  </PageContainer>
</template>
