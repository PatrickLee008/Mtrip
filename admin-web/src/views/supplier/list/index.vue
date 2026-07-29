<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import type { StatusItem } from '@/components/StatusTag.vue';
import {
  apiSupplierAdd,
  apiSupplierAudit,
  apiSupplierDetail,
  apiSupplierList,
  apiSupplierTerminate,
  apiSupplierToggleStatus,
  apiSupplierUpdate,
} from '@/api/merchant';

/**
 * 供应商列表(文档 6.4.3)
 * 状态机:0待审核 →(通过)1已合作 /(驳回)3已终止;1已合作 ⇄ 2已暂停;3已终止(终态)
 * 联系电话/结算账号密文存储,编辑留空=保留原值
 */
const { t } = useI18n();
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('supplier.listPage.statusPending'), color: 'warning' },
  1: { text: t('supplier.listPage.statusActive'), color: 'success' },
  2: { text: t('supplier.listPage.statusPaused'), color: 'orange' },
  3: { text: t('supplier.listPage.statusTerminated'), color: 'default' },
}));
const TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('supplier.listPage.typeHotel'),
  2: t('supplier.listPage.typeScenic'),
  3: t('supplier.listPage.typeComposite'),
}));
const SETTLE_TEXT = computed<Record<number, string>>(() => ({
  1: t('supplier.listPage.settlePrepay'),
  2: t('supplier.listPage.settleMonthly'),
  3: t('supplier.listPage.settleQuarterly'),
}));

const { loading, list, query, load, search, reset, pagination } = useTable(apiSupplierList, {
  supplierName: '',
  supplierType: undefined,
  settleType: undefined,
  status: undefined,
  siteId: 0,
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('supplier.listPage.name'), dataIndex: 'supplier_name', width: 200, ellipsis: true },
  { title: t('supplier.listPage.type'), dataIndex: 'supplier_type', width: 110 },
  { title: t('supplier.listPage.contact'), dataIndex: 'contact_name', width: 100, ellipsis: true },
  { title: t('supplier.listPage.phone'), dataIndex: 'contact_phone', width: 130 },
  { title: t('supplier.listPage.shareRate'), dataIndex: 'share_rate', width: 90 },
  { title: t('supplier.listPage.settleType'), dataIndex: 'settle_type', width: 90 },
  { title: t('supplier.listPage.status'), dataIndex: 'status', width: 90 },
  { title: t('supplier.listPage.coopStartAt'), dataIndex: 'coop_start_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 240, fixed: 'right' as const },
]);

// ---------- 详情抽屉 ----------
const drawerOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);

async function openDetail(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  detailLoading.value = true;
  try {
    detail.value = await apiSupplierDetail(row.id);
  } finally {
    detailLoading.value = false;
  }
}

// ---------- 新增/编辑 ----------
const editOpen = ref(false);
const editSubmitting = ref(false);
const editingId = ref(0);
const form = reactive({
  siteId: undefined as number | undefined,
  supplierName: '',
  supplierShortName: '',
  supplierType: 1,
  creditCode: '',
  businessLicense: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  shareRate: 0,
  settleType: 2,
  bankName: '',
  accountName: '',
  accountNo: '',
  contractFile: '',
  remark: '',
});

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, {
    siteId: undefined,
    supplierName: '',
    supplierShortName: '',
    supplierType: 1,
    creditCode: '',
    businessLicense: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    shareRate: 0,
    settleType: 2,
    bankName: '',
    accountName: '',
    accountNo: '',
    contractFile: '',
    remark: '',
  });
  editOpen.value = true;
}

async function openEdit(row: TableRow): Promise<void> {
  const data = await apiSupplierDetail(row.id);
  const supplier = data.supplier as TableRow;
  editingId.value = row.id;
  Object.assign(form, {
    siteId: supplier.site_id,
    supplierName: supplier.supplier_name,
    supplierShortName: supplier.supplier_short_name,
    supplierType: supplier.supplier_type,
    creditCode: supplier.credit_code,
    businessLicense: supplier.business_license,
    contactName: supplier.contact_name,
    contactPhone: '', // 密文字段编辑留空=保留原值
    contactEmail: supplier.contact_email,
    shareRate: Number(supplier.share_rate),
    settleType: supplier.settle_type,
    bankName: supplier.bank_name,
    accountName: supplier.account_name,
    accountNo: '', // 密文字段编辑留空=保留原值
    contractFile: supplier.contract_file,
    remark: supplier.remark,
  });
  editOpen.value = true;
}

async function submitEdit(): Promise<void> {
  if (!form.supplierName.trim() || !form.contactName.trim()) {
    message.warning(t('supplier.listPage.warnNameContact'));
    return;
  }
  if (editingId.value === 0 && (!form.creditCode.trim() || !form.contactPhone.trim())) {
    message.warning(t('supplier.listPage.warnCreditPhone'));
    return;
  }
  if (editingId.value === 0 && isSuper && !form.siteId) {
    message.warning(t('supplier.listPage.warnSite'));
    return;
  }
  editSubmitting.value = true;
  try {
    const payload: Record<string, unknown> = {
      supplierName: form.supplierName.trim(),
      supplierShortName: form.supplierShortName.trim(),
      supplierType: form.supplierType,
      businessLicense: form.businessLicense.trim(),
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      shareRate: form.shareRate,
      settleType: form.settleType,
      bankName: form.bankName.trim(),
      accountName: form.accountName.trim(),
      contractFile: form.contractFile.trim(),
      remark: form.remark.trim(),
    };
    if (form.contactPhone.trim()) {
      payload.contactPhone = form.contactPhone.trim();
    }
    if (form.accountNo.trim()) {
      payload.accountNo = form.accountNo.trim();
    }
    if (editingId.value === 0) {
      payload.creditCode = form.creditCode.trim();
      if (isSuper) {
        payload.siteId = form.siteId;
      }
      await apiSupplierAdd(payload);
      message.success(t('supplier.listPage.createSuccess'));
    } else {
      payload.id = editingId.value;
      await apiSupplierUpdate(payload);
      message.success(t('supplier.listPage.updateSuccess'));
    }
    editOpen.value = false;
    void load();
  } finally {
    editSubmitting.value = false;
  }
}

// ---------- 审核 Modal ----------
const auditOpen = ref(false);
const auditSubmitting = ref(false);
const auditForm = reactive({ id: 0, supplierName: '', auditStatus: 1, auditRemark: '' });

function openAudit(row: TableRow): void {
  auditForm.id = row.id;
  auditForm.supplierName = row.supplier_name;
  auditForm.auditStatus = 1;
  auditForm.auditRemark = '';
  auditOpen.value = true;
}

async function submitAudit(): Promise<void> {
  if (auditForm.auditStatus === 2 && !auditForm.auditRemark.trim()) {
    message.warning(t('supplier.listPage.rejectReasonRequired'));
    return;
  }
  auditSubmitting.value = true;
  try {
    await apiSupplierAudit({
      id: auditForm.id,
      auditStatus: auditForm.auditStatus,
      auditRemark: auditForm.auditRemark.trim() || undefined,
    });
    message.success(auditForm.auditStatus === 1 ? t('supplier.listPage.auditPassSuccess') : t('supplier.listPage.auditRejectSuccess'));
    auditOpen.value = false;
    void load();
  } finally {
    auditSubmitting.value = false;
  }
}

// ---------- 暂停/恢复 ----------
async function toggleStatus(row: TableRow): Promise<void> {
  const data = await apiSupplierToggleStatus(row.id);
  message.success(data.status === 2 ? t('supplier.listPage.pauseSuccess') : t('supplier.listPage.resumeSuccess'));
  void load();
}

// ---------- 终止合作(高危,必填备注) ----------
const terminateOpen = ref(false);
const terminateSubmitting = ref(false);
const terminateForm = reactive({ id: 0, supplierName: '', remark: '' });

function openTerminate(row: TableRow): void {
  terminateForm.id = row.id;
  terminateForm.supplierName = row.supplier_name;
  terminateForm.remark = '';
  terminateOpen.value = true;
}

async function submitTerminate(): Promise<void> {
  if (!terminateForm.remark.trim()) {
    message.warning(t('supplier.listPage.warnTerminateReason'));
    return;
  }
  terminateSubmitting.value = true;
  try {
    await apiSupplierTerminate(terminateForm.id, terminateForm.remark.trim());
    message.success(t('supplier.listPage.terminateSuccess'));
    terminateOpen.value = false;
    void load();
  } finally {
    terminateSubmitting.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('supplier.listPage.name')">
          <a-input v-model:value="query.supplierName" allow-clear :placeholder="t('supplier.listPage.fuzzyMatch')" style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('supplier.listPage.type')">
          <a-select v-model:value="query.supplierType" allow-clear :placeholder="t('common.all')" style="width: 130px">
            <a-select-option :value="1">{{ t('supplier.listPage.typeHotel') }}</a-select-option>
            <a-select-option :value="2">{{ t('supplier.listPage.typeScenic') }}</a-select-option>
            <a-select-option :value="3">{{ t('supplier.listPage.typeComposite') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('supplier.listPage.settleType')">
          <a-select v-model:value="query.settleType" allow-clear :placeholder="t('common.all')" style="width: 100px">
            <a-select-option :value="1">{{ t('supplier.listPage.settlePrepay') }}</a-select-option>
            <a-select-option :value="2">{{ t('supplier.listPage.settleMonthly') }}</a-select-option>
            <a-select-option :value="3">{{ t('supplier.listPage.settleQuarterly') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('supplier.listPage.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 100px">
            <a-select-option v-for="(item, key) in STATUS_MAP" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
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

    <a-card :bordered="false" class="mtrip-card-shadow" :title="t('supplier.listPage.title')">
      <template #extra>
        <a-button v-perm="'supplier:list:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('supplier.listPage.addSupplier') }}
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
          <template v-if="column.dataIndex === 'supplier_type'">{{ TYPE_TEXT[record.supplier_type] ?? '-' }}</template>
          <template v-else-if="column.dataIndex === 'share_rate'">{{ record.share_rate }}%</template>
          <template v-else-if="column.dataIndex === 'settle_type'">{{ SETTLE_TEXT[record.settle_type] ?? '-' }}</template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
              <a-button
                v-if="record.status !== 3"
                v-perm="'supplier:list:edit'"
                type="link"
                size="small"
                @click="openEdit(record)"
              >{{ t('common.edit') }}</a-button>
              <a-button
                v-if="record.status === 0"
                v-perm="'supplier:list:edit'"
                type="link"
                size="small"
                style="color: var(--mtrip-warning, #faad14)"
                @click="openAudit(record)"
              >{{ t('supplier.listPage.audit') }}</a-button>
              <a-popconfirm
                v-if="record.status === 1 || record.status === 2"
                :title="record.status === 1 ? t('supplier.listPage.confirmPause') : t('supplier.listPage.confirmResume')"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'supplier:list:status'" type="link" size="small" :danger="record.status === 1">
                  {{ record.status === 1 ? t('supplier.listPage.pause') : t('supplier.listPage.resume') }}
                </a-button>
              </a-popconfirm>
              <a-button
                v-if="record.status !== 3"
                v-perm="'supplier:list:delete'"
                type="link"
                size="small"
                danger
                @click="openTerminate(record)"
              >{{ t('supplier.listPage.terminate') }}</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" :title="t('supplier.listPage.detailTitle')" width="680">
      <a-spin :spinning="detailLoading">
        <template v-if="detail && detail.supplier">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item :label="t('supplier.listPage.name')" :span="2">{{ detail.supplier.supplier_name }}</a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.shortName')">{{ detail.supplier.supplier_short_name || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.status')"><StatusTag :value="detail.supplier.status" :map="STATUS_MAP" /></a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.type')">{{ TYPE_TEXT[detail.supplier.supplier_type] ?? '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.creditCode')">{{ detail.supplier.credit_code }}</a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.contact')">{{ detail.supplier.contact_name }}</a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.phone')">{{ detail.supplier.contact_phone }}</a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.email')">{{ detail.supplier.contact_email || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.shareRate')">{{ detail.supplier.share_rate }}%</a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.settleType')">{{ SETTLE_TEXT[detail.supplier.settle_type] ?? '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.bankName')">{{ detail.supplier.bank_name || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.accountName')">{{ detail.supplier.account_name || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.accountNo')">{{ detail.supplier.account_no || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.goodsCount')">{{ detail.goodsCount }}({{ t('supplier.listPage.supplying') }} {{ detail.supplyingCount }})</a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.coopStartAt')">{{ detail.supplier.coop_start_at || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('supplier.listPage.coopEndAt')">{{ detail.supplier.coop_end_at || '-' }}</a-descriptions-item>
            <a-descriptions-item v-if="detail.supplier.remark" :label="t('supplier.listPage.remark')" :span="2">{{ detail.supplier.remark }}</a-descriptions-item>
          </a-descriptions>
          <template v-if="detail.supplier.business_license">
            <a-divider orientation="left">{{ t('supplier.listPage.businessLicense') }}</a-divider>
            <a-image :src="detail.supplier.business_license" :width="160" />
          </template>
        </template>
      </a-spin>
    </a-drawer>

    <!-- 新增/编辑 Modal -->
    <a-modal
      v-model:open="editOpen"
      :title="editingId === 0 ? t('supplier.listPage.addSupplier') : t('supplier.listPage.editSupplier')"
      :confirm-loading="editSubmitting"
      width="720px"
      @ok="submitEdit"
    >
      <a-form :label-col="{ span: 6 }" style="max-height: 60vh; overflow-y: auto">
        <a-row :gutter="8">
          <a-col :span="12">
            <a-form-item v-if="editingId === 0 && isSuper" :label="t('supplier.listPage.site')" required>
              <SiteTreeSelect v-model:value="form.siteId" />
            </a-form-item>
            <a-form-item :label="t('supplier.listPage.name')" required>
              <a-input v-model:value="form.supplierName" :maxlength="100" />
            </a-form-item>
            <a-form-item :label="t('supplier.listPage.shortName')">
              <a-input v-model:value="form.supplierShortName" :maxlength="50" />
            </a-form-item>
            <a-form-item :label="t('supplier.listPage.type')">
              <a-select v-model:value="form.supplierType">
                <a-select-option :value="1">{{ t('supplier.listPage.typeHotel') }}</a-select-option>
                <a-select-option :value="2">{{ t('supplier.listPage.typeScenic') }}</a-select-option>
                <a-select-option :value="3">{{ t('supplier.listPage.typeComposite') }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item :label="t('supplier.listPage.creditCode')" :required="editingId === 0">
              <a-input v-model:value="form.creditCode" :maxlength="50" :disabled="editingId !== 0" :placeholder="t('supplier.listPage.creditCodePlaceholder')" />
            </a-form-item>
            <a-form-item :label="t('supplier.listPage.contact')" required>
              <a-input v-model:value="form.contactName" :maxlength="50" />
            </a-form-item>
            <a-form-item :label="t('supplier.listPage.phone')" :required="editingId === 0">
              <a-input v-model:value="form.contactPhone" :maxlength="20" :placeholder="editingId === 0 ? '' : t('supplier.listPage.placeholderKeepEmpty')" />
            </a-form-item>
            <a-form-item :label="t('supplier.listPage.email')">
              <a-input v-model:value="form.contactEmail" :maxlength="100" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('supplier.listPage.shareRatePct')">
              <a-input-number v-model:value="form.shareRate" :min="0" :max="100" :precision="2" style="width: 100%" />
            </a-form-item>
            <a-form-item :label="t('supplier.listPage.settleType')">
              <a-select v-model:value="form.settleType">
                <a-select-option :value="1">{{ t('supplier.listPage.settlePrepay') }}</a-select-option>
                <a-select-option :value="2">{{ t('supplier.listPage.settleMonthly') }}</a-select-option>
                <a-select-option :value="3">{{ t('supplier.listPage.settleQuarterly') }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item :label="t('supplier.listPage.bankName')">
              <a-input v-model:value="form.bankName" :maxlength="100" />
            </a-form-item>
            <a-form-item :label="t('supplier.listPage.accountName')">
              <a-input v-model:value="form.accountName" :maxlength="100" />
            </a-form-item>
            <a-form-item :label="t('supplier.listPage.accountNo')">
              <a-input v-model:value="form.accountNo" :maxlength="30" :placeholder="editingId === 0 ? '' : t('supplier.listPage.placeholderKeepEmpty')" />
            </a-form-item>
            <a-form-item :label="t('supplier.listPage.businessLicenseUrl')">
              <a-input v-model:value="form.businessLicense" :maxlength="255" />
            </a-form-item>
            <a-form-item :label="t('supplier.listPage.contractFileUrl')">
              <a-input v-model:value="form.contractFile" :maxlength="255" />
            </a-form-item>
            <a-form-item :label="t('supplier.listPage.remark')">
              <a-textarea v-model:value="form.remark" :rows="2" :maxlength="500" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 审核 Modal -->
    <a-modal v-model:open="auditOpen" :title="t('supplier.listPage.auditTitle')" :confirm-loading="auditSubmitting" @ok="submitAudit">
      <a-form :label-col="{ span: 6 }">
        <a-form-item :label="t('supplier.listPage.name')">{{ auditForm.supplierName }}</a-form-item>
        <a-form-item :label="t('supplier.listPage.auditResult')" required>
          <a-radio-group v-model:value="auditForm.auditStatus">
            <a-radio :value="1">{{ t('supplier.listPage.auditPassCoop') }}</a-radio>
            <a-radio :value="2">{{ t('supplier.listPage.auditRejectTerminate') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('supplier.listPage.auditRemark')" :required="auditForm.auditStatus === 2">
          <a-textarea v-model:value="auditForm.auditRemark" :rows="3" :maxlength="500" :placeholder="t('supplier.listPage.auditRemarkPlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 终止合作 Modal -->
    <a-modal
      v-model:open="terminateOpen"
      :title="t('supplier.listPage.terminateTitle')"
      :confirm-loading="terminateSubmitting"
      :ok-button-props="{ danger: true }"
      :ok-text="t('supplier.listPage.confirmTerminate')"
      @ok="submitTerminate"
    >
      <a-alert type="error" show-icon :message="t('supplier.listPage.terminateNotice')" style="margin-bottom: 16px" />
      <a-form :label-col="{ span: 6 }">
        <a-form-item :label="t('supplier.listPage.name')">{{ terminateForm.supplierName }}</a-form-item>
        <a-form-item :label="t('supplier.listPage.terminateReason')" required>
          <a-textarea v-model:value="terminateForm.remark" :rows="3" :maxlength="500" :placeholder="t('common.required')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
