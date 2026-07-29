<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { formatAmount } from '@/utils/format';
import type { StatusItem } from '@/components/StatusTag.vue';
import {
  apiSupplierList,
  apiSupplierSettleAudit,
  apiSupplierSettleConfirmPay,
  apiSupplierSettleList,
} from '@/api/merchant';

/**
 * 供应商对账结算共享组件:供应商菜单(supplier:settle:*)与财务菜单(finance:ssettle:*)复用
 * 结算单状态机:0待审核 →(通过)1已审核(待回款)→(确认回款)2已回款;0 →(驳回)3已驳回
 */
const { t } = useI18n();

const props = defineProps<{
  /** 按钮权限键前缀:supplier:settle 或 finance:ssettle */
  permPrefix: string;
}>();

const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('supplier.settlePage.statusPending'), color: 'warning' },
  1: { text: t('supplier.settlePage.statusProcessing'), color: 'processing' },
  2: { text: t('supplier.settlePage.statusCompleted'), color: 'success' },
  3: { text: t('supplier.settlePage.statusFailed'), color: 'error' },
}));

const { loading, list, query, load, search, reset, pagination } = useTable(apiSupplierSettleList, {
  settleNo: '',
  supplierId: undefined,
  settleMonth: undefined,
  status: undefined,
  siteId: 0,
});

const columns = computed(() => [
  { title: t('supplier.settlePage.settleNo'), dataIndex: 'settle_no', width: 190 },
  { title: t('supplier.settlePage.supplier'), dataIndex: 'supplier_name', width: 180, ellipsis: true },
  { title: t('supplier.settlePage.period'), dataIndex: 'settle_month', width: 100 },
  { title: t('supplier.settlePage.orderCount'), dataIndex: 'order_count', width: 80 },
  { title: t('supplier.settlePage.settleAmount'), dataIndex: 'settle_amount', width: 110 },
  { title: t('supplier.settlePage.status'), dataIndex: 'status', width: 90 },
  { title: t('supplier.settlePage.auditTime'), dataIndex: 'audit_time', width: 165 },
  { title: t('supplier.settlePage.payTime'), dataIndex: 'pay_time', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 170, fixed: 'right' as const },
]);

// ---------- 供应商远程搜索 ----------
const supplierOptions = ref<{ label: string; value: number }[]>([]);
const supplierSearching = ref(false);

async function searchSupplier(keyword: string): Promise<void> {
  supplierSearching.value = true;
  try {
    const data = await apiSupplierList({ supplierName: keyword, page: 1, pageSize: 20 });
    supplierOptions.value = data.list.map((row: TableRow) => ({
      label: `#${row.id} ${row.supplier_name}`,
      value: row.id,
    }));
  } finally {
    supplierSearching.value = false;
  }
}

// ---------- 审核 Modal(确认对账) ----------
const auditOpen = ref(false);
const auditSubmitting = ref(false);
const auditForm = reactive({ id: 0, settleNo: '', settleAmount: 0, auditStatus: 1, auditRemark: '' });

function openAudit(row: TableRow): void {
  auditForm.id = row.id;
  auditForm.settleNo = row.settle_no;
  auditForm.settleAmount = Number(row.settle_amount);
  auditForm.auditStatus = 1;
  auditForm.auditRemark = '';
  auditOpen.value = true;
}

async function submitAudit(): Promise<void> {
  if (auditForm.auditStatus === 2 && !auditForm.auditRemark.trim()) {
    message.warning(t('supplier.settlePage.rejectReasonRequired'));
    return;
  }
  auditSubmitting.value = true;
  try {
    await apiSupplierSettleAudit({
      id: auditForm.id,
      auditStatus: auditForm.auditStatus,
      auditRemark: auditForm.auditRemark.trim() || undefined,
    });
    message.success(auditForm.auditStatus === 1 ? t('supplier.settlePage.auditPassSuccess') : t('supplier.settlePage.auditRejectSuccess'));
    auditOpen.value = false;
    void load();
  } finally {
    auditSubmitting.value = false;
  }
}

// ---------- 标记打款(确认回款) ----------
const payOpen = ref(false);
const paySubmitting = ref(false);
const payForm = reactive({ id: 0, settleNo: '', settleAmount: 0, payVoucher: '' });

function openPay(row: TableRow): void {
  payForm.id = row.id;
  payForm.settleNo = row.settle_no;
  payForm.settleAmount = Number(row.settle_amount);
  payForm.payVoucher = '';
  payOpen.value = true;
}

async function submitPay(): Promise<void> {
  paySubmitting.value = true;
  try {
    await apiSupplierSettleConfirmPay({ id: payForm.id, payVoucher: payForm.payVoucher.trim() });
    message.success(t('supplier.settlePage.paySuccess'));
    payOpen.value = false;
    void load();
  } finally {
    paySubmitting.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('supplier.settlePage.settleNo')">
          <a-input v-model:value="query.settleNo" allow-clear :placeholder="t('supplier.settlePage.settleNoExactPlaceholder')" style="width: 190px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('supplier.settlePage.supplier')">
          <a-select
            v-model:value="query.supplierId"
            show-search
            allow-clear
            :placeholder="t('supplier.settlePage.searchSupplierPlaceholder')"
            style="width: 200px"
            :filter-option="false"
            :options="supplierOptions"
            :loading="supplierSearching"
            @search="searchSupplier"
          />
        </a-form-item>
        <a-form-item :label="t('supplier.settlePage.period')">
          <a-date-picker v-model:value="query.settleMonth" picker="month" value-format="YYYY-MM" style="width: 120px" />
        </a-form-item>
        <a-form-item :label="t('supplier.settlePage.status')">
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

    <a-card :bordered="false" class="mtrip-card-shadow" :title="t('supplier.settlePage.title')">
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
          <template v-if="column.dataIndex === 'settle_amount'">
            <span style="font-weight: 600">{{ formatAmount(record.settle_amount) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tooltip v-if="record.status === 3 && record.remark" :title="`${t('supplier.settlePage.rejectReason')}:${record.remark}`">
              <span><StatusTag :value="record.status" :map="STATUS_MAP" /></span>
            </a-tooltip>
            <StatusTag v-else :value="record.status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.dataIndex === 'audit_time'">{{ record.audit_time || '-' }}</template>
          <template v-else-if="column.dataIndex === 'pay_time'">{{ record.pay_time || '-' }}</template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button
                v-if="record.status === 0"
                v-perm="`${props.permPrefix}:confirm`"
                type="link"
                size="small"
                @click="openAudit(record)"
              >{{ t('supplier.settlePage.confirmAudit') }}</a-button>
              <a-button
                v-if="record.status === 1"
                v-perm="`${props.permPrefix}:pay`"
                type="link"
                size="small"
                @click="openPay(record)"
              >{{ t('supplier.settlePage.markPay') }}</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 审核 Modal -->
    <a-modal v-model:open="auditOpen" :title="t('supplier.settlePage.auditTitle')" :confirm-loading="auditSubmitting" @ok="submitAudit">
      <a-form :label-col="{ span: 6 }">
        <a-form-item :label="t('supplier.settlePage.settleNo')">{{ auditForm.settleNo }}</a-form-item>
        <a-form-item :label="t('supplier.settlePage.settleAmount')">
          <span style="color: var(--mtrip-error, #ff4d4f); font-weight: 600">{{ formatAmount(auditForm.settleAmount) }}</span>
        </a-form-item>
        <a-form-item :label="t('supplier.settlePage.auditResult')" required>
          <a-radio-group v-model:value="auditForm.auditStatus">
            <a-radio :value="1">{{ t('supplier.settlePage.auditPass') }}</a-radio>
            <a-radio :value="2">{{ t('supplier.settlePage.auditReject') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('supplier.settlePage.auditRemark')" :required="auditForm.auditStatus === 2">
          <a-textarea v-model:value="auditForm.auditRemark" :rows="3" :maxlength="500" :placeholder="t('supplier.settlePage.auditRemarkPlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 标记打款 Modal -->
    <a-modal v-model:open="payOpen" :title="t('supplier.settlePage.payTitle')" :confirm-loading="paySubmitting" @ok="submitPay">
      <a-alert type="warning" show-icon :message="t('supplier.settlePage.payNotice')" style="margin-bottom: 16px" />
      <a-form :label-col="{ span: 6 }">
        <a-form-item :label="t('supplier.settlePage.settleNo')">{{ payForm.settleNo }}</a-form-item>
        <a-form-item :label="t('supplier.settlePage.settleAmount')">
          <span style="color: var(--mtrip-error, #ff4d4f); font-weight: 600">{{ formatAmount(payForm.settleAmount) }}</span>
        </a-form-item>
        <a-form-item :label="t('supplier.settlePage.payVoucher')">
          <a-input v-model:value="payForm.payVoucher" :maxlength="255" :placeholder="t('supplier.settlePage.payVoucherPlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
