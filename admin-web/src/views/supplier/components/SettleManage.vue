<script setup lang="ts">
import { reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
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
const props = defineProps<{
  /** 按钮权限键前缀:supplier:settle 或 finance:ssettle */
  permPrefix: string;
}>();

const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const STATUS_MAP: Record<number, StatusItem> = {
  0: { text: '待审核', color: 'warning' },
  1: { text: '待回款', color: 'processing' },
  2: { text: '已回款', color: 'success' },
  3: { text: '已驳回', color: 'error' },
};

const { loading, list, query, load, search, reset, pagination } = useTable(apiSupplierSettleList, {
  settleNo: '',
  supplierId: undefined,
  settleMonth: undefined,
  status: undefined,
  siteId: 0,
});

const columns = [
  { title: '账单号', dataIndex: 'settle_no', width: 190 },
  { title: '供应商', dataIndex: 'supplier_name', width: 180, ellipsis: true },
  { title: '账期', dataIndex: 'settle_month', width: 100 },
  { title: '订单数', dataIndex: 'order_count', width: 80 },
  { title: '结算金额', dataIndex: 'settle_amount', width: 110 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '审核时间', dataIndex: 'audit_time', width: 165 },
  { title: '回款时间', dataIndex: 'pay_time', width: 165 },
  { title: '操作', key: 'action_col', width: 170, fixed: 'right' as const },
];

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
    message.warning('驳回必须填写原因');
    return;
  }
  auditSubmitting.value = true;
  try {
    await apiSupplierSettleAudit({
      id: auditForm.id,
      auditStatus: auditForm.auditStatus,
      auditRemark: auditForm.auditRemark.trim() || undefined,
    });
    message.success(auditForm.auditStatus === 1 ? '账单审核通过,待回款' : '账单已驳回');
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
    message.success('已确认回款');
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
        <a-form-item label="账单号">
          <a-input v-model:value="query.settleNo" allow-clear placeholder="精确匹配" style="width: 190px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="供应商">
          <a-select
            v-model:value="query.supplierId"
            show-search
            allow-clear
            placeholder="输入名称搜索"
            style="width: 200px"
            :filter-option="false"
            :options="supplierOptions"
            :loading="supplierSearching"
            @search="searchSupplier"
          />
        </a-form-item>
        <a-form-item label="账期">
          <a-date-picker v-model:value="query.settleMonth" picker="month" value-format="YYYY-MM" style="width: 120px" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 100px">
            <a-select-option v-for="(item, key) in STATUS_MAP" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" title="结算账单">
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
            <a-tooltip v-if="record.status === 3 && record.remark" :title="`驳回原因:${record.remark}`">
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
              >确认对账</a-button>
              <a-button
                v-if="record.status === 1"
                v-perm="`${props.permPrefix}:pay`"
                type="link"
                size="small"
                @click="openPay(record)"
              >标记打款</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 审核 Modal -->
    <a-modal v-model:open="auditOpen" title="对账审核" :confirm-loading="auditSubmitting" @ok="submitAudit">
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="账单号">{{ auditForm.settleNo }}</a-form-item>
        <a-form-item label="结算金额">
          <span style="color: var(--mtrip-error, #ff4d4f); font-weight: 600">{{ formatAmount(auditForm.settleAmount) }}</span>
        </a-form-item>
        <a-form-item label="审核结果" required>
          <a-radio-group v-model:value="auditForm.auditStatus">
            <a-radio :value="1">通过(待回款)</a-radio>
            <a-radio :value="2">驳回</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="审核意见" :required="auditForm.auditStatus === 2">
          <a-textarea v-model:value="auditForm.auditRemark" :rows="3" :maxlength="500" placeholder="驳回必填" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 标记打款 Modal -->
    <a-modal v-model:open="payOpen" title="确认回款" :confirm-loading="paySubmitting" @ok="submitPay">
      <a-alert type="warning" show-icon message="确认后账单完结不可撤销,请核实打款已完成" style="margin-bottom: 16px" />
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="账单号">{{ payForm.settleNo }}</a-form-item>
        <a-form-item label="结算金额">
          <span style="color: var(--mtrip-error, #ff4d4f); font-weight: 600">{{ formatAmount(payForm.settleAmount) }}</span>
        </a-form-item>
        <a-form-item label="打款凭证URL">
          <a-input v-model:value="payForm.payVoucher" :maxlength="255" placeholder="选填,凭证图片/文件地址" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
