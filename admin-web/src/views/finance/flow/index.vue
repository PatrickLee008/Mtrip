<script setup lang="ts">
import { reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { DownloadOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { exportCsv } from '@/utils/export';
import { formatAmount } from '@/utils/format';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiMerchantList } from '@/api/merchant';
import { apiFlowAdjust, apiFlowList } from '@/api/finance';

/**
 * 资金流水(文档 6.4.5):流水查询 + 手动调账 + CSV 导出
 * flow_type 1收入 2支出 3转账 4冻结 5解冻;biz_type 5=手动调账
 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const FLOW_TYPE_MAP: Record<number, StatusItem> = {
  1: { text: '收入', color: 'success' },
  2: { text: '支出', color: 'error' },
  3: { text: '转账', color: 'processing' },
  4: { text: '冻结', color: 'warning' },
  5: { text: '解冻', color: 'cyan' },
};
const BIZ_TYPE_TEXT: Record<number, string> = {
  1: '订单支付',
  2: '订单退款',
  3: '商户提现',
  4: '供应商回款',
  5: '手动调账',
};
const FLOW_STATUS_MAP: Record<number, StatusItem> = {
  1: { text: '成功', color: 'success' },
  2: { text: '处理中', color: 'processing' },
  3: { text: '失败', color: 'error' },
};

const createdRange = ref<string[]>([]);

const { loading, list, query, load, search, reset, pagination } = useTable(
  (params) => apiFlowList({
    ...params,
    startDate: createdRange.value?.[0],
    endDate: createdRange.value?.[1],
  }),
  { flowNo: '', flowType: undefined, bizType: undefined, flowStatus: undefined, merchantId: undefined, siteId: 0 },
);

function doReset(): void {
  createdRange.value = [];
  reset();
}

const columns = [
  { title: '流水号', dataIndex: 'flow_no', width: 190 },
  { title: '类型', dataIndex: 'flow_type', width: 80 },
  { title: '业务类型', dataIndex: 'biz_type', width: 100 },
  { title: '金额', dataIndex: 'amount', width: 110 },
  { title: '商户ID', dataIndex: 'merchant_id', width: 90 },
  { title: '订单ID', dataIndex: 'order_id', width: 90 },
  { title: '第三方流水号', dataIndex: 'trade_no', width: 180, ellipsis: true },
  { title: '状态', dataIndex: 'flow_status', width: 80 },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
  { title: '时间', dataIndex: 'created_at', width: 165 },
];

// ---------- 商户远程搜索 ----------
const merchantOptions = ref<{ label: string; value: number }[]>([]);
const merchantSearching = ref(false);

async function searchMerchant(keyword: string): Promise<void> {
  merchantSearching.value = true;
  try {
    const data = await apiMerchantList({ merchantName: keyword, page: 1, pageSize: 20 });
    merchantOptions.value = data.list.map((row: TableRow) => ({
      label: `#${row.id} ${row.merchant_name}`,
      value: row.id,
    }));
  } finally {
    merchantSearching.value = false;
  }
}

// ---------- 手动调账 Modal ----------
const adjustOpen = ref(false);
const adjustSubmitting = ref(false);
const adjustForm = reactive({ flowType: 1, amount: 0, merchantId: undefined as number | undefined, siteId: 0, remark: '' });

function openAdjust(): void {
  adjustForm.flowType = 1;
  adjustForm.amount = 0;
  adjustForm.merchantId = undefined;
  adjustForm.siteId = 0;
  adjustForm.remark = '';
  adjustOpen.value = true;
}

async function submitAdjust(): Promise<void> {
  if (adjustForm.amount <= 0) {
    message.warning('调账金额须大于0');
    return;
  }
  if (!adjustForm.remark.trim()) {
    message.warning('请填写调账原因');
    return;
  }
  if (isSuper && adjustForm.siteId <= 0) {
    message.warning('请选择所属站点');
    return;
  }
  adjustSubmitting.value = true;
  try {
    await apiFlowAdjust({
      flowType: adjustForm.flowType,
      amount: adjustForm.amount,
      remark: adjustForm.remark.trim(),
      merchantId: adjustForm.merchantId,
      siteId: isSuper ? adjustForm.siteId : undefined,
    });
    message.success('调账流水已记录');
    adjustOpen.value = false;
    void load();
  } finally {
    adjustSubmitting.value = false;
  }
}

// ---------- CSV 导出(当前筛选前 2000 条) ----------
const exporting = ref(false);

async function exportFlows(): Promise<void> {
  exporting.value = true;
  try {
    const data = await apiFlowList({
      ...query,
      startDate: createdRange.value?.[0],
      endDate: createdRange.value?.[1],
      page: 1,
      pageSize: 2000,
    });
    if (data.list.length === 0) {
      message.info('当前筛选条件下没有可导出的流水');
      return;
    }
    exportCsv(
      `资金流水_${new Date().toISOString().slice(0, 10)}`,
      [
        { title: '流水号', key: 'flow_no' },
        { title: '类型', key: 'flow_type', format: (row: TableRow) => FLOW_TYPE_MAP[row.flow_type]?.text ?? row.flow_type },
        { title: '业务类型', key: 'biz_type', format: (row: TableRow) => BIZ_TYPE_TEXT[row.biz_type] ?? row.biz_type },
        { title: '金额', key: 'amount' },
        { title: '商户ID', key: 'merchant_id' },
        { title: '订单ID', key: 'order_id' },
        { title: '第三方流水号', key: 'trade_no' },
        { title: '状态', key: 'flow_status', format: (row: TableRow) => FLOW_STATUS_MAP[row.flow_status]?.text ?? row.flow_status },
        { title: '备注', key: 'remark' },
        { title: '时间', key: 'created_at' },
      ],
      data.list,
    );
    message.success(`已导出 ${data.list.length} 条流水`);
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="流水号">
          <a-input v-model:value="query.flowNo" allow-clear placeholder="精确匹配" style="width: 190px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="类型">
          <a-select v-model:value="query.flowType" allow-clear placeholder="全部" style="width: 90px">
            <a-select-option v-for="(item, key) in FLOW_TYPE_MAP" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="业务类型">
          <a-select v-model:value="query.bizType" allow-clear placeholder="全部" style="width: 120px">
            <a-select-option v-for="(text, key) in BIZ_TYPE_TEXT" :key="key" :value="Number(key)">{{ text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.flowStatus" allow-clear placeholder="全部" style="width: 100px">
            <a-select-option v-for="(item, key) in FLOW_STATUS_MAP" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="商户">
          <a-select
            v-model:value="query.merchantId"
            show-search
            allow-clear
            placeholder="输入名称搜索"
            style="width: 180px"
            :filter-option="false"
            :options="merchantOptions"
            :loading="merchantSearching"
            @search="searchMerchant"
          />
        </a-form-item>
        <a-form-item label="日期">
          <a-range-picker v-model:value="createdRange" value-format="YYYY-MM-DD" style="width: 240px" />
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="doReset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" title="资金流水">
      <template #extra>
        <a-space>
          <a-button v-perm="'finance:flow:adjust'" type="primary" @click="openAdjust">
            <template #icon><PlusOutlined /></template>手动调账
          </a-button>
          <a-button v-perm="'finance:flow:export'" :loading="exporting" @click="exportFlows">
            <template #icon><DownloadOutlined /></template>导出CSV
          </a-button>
        </a-space>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1500 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'flow_type'">
            <StatusTag :value="record.flow_type" :map="FLOW_TYPE_MAP" />
          </template>
          <template v-else-if="column.dataIndex === 'biz_type'">{{ BIZ_TYPE_TEXT[record.biz_type] ?? '-' }}</template>
          <template v-else-if="column.dataIndex === 'amount'">
            <span :style="{ color: record.flow_type === 2 ? 'var(--mtrip-error, #ff4d4f)' : 'var(--mtrip-success, #52c41a)', fontWeight: 600 }">
              {{ record.flow_type === 2 ? '-' : '+' }}{{ formatAmount(record.amount) }}
            </span>
          </template>
          <template v-else-if="column.dataIndex === 'merchant_id'">{{ record.merchant_id || '-' }}</template>
          <template v-else-if="column.dataIndex === 'order_id'">{{ record.order_id || '-' }}</template>
          <template v-else-if="column.dataIndex === 'trade_no'">{{ record.trade_no || '-' }}</template>
          <template v-else-if="column.dataIndex === 'flow_status'">
            <StatusTag :value="record.flow_status" :map="FLOW_STATUS_MAP" />
          </template>
          <template v-else-if="column.dataIndex === 'remark'">{{ record.remark || '-' }}</template>
        </template>
      </a-table>
    </a-card>

    <!-- 手动调账 Modal -->
    <a-modal v-model:open="adjustOpen" title="手动调账" :confirm-loading="adjustSubmitting" @ok="submitAdjust">
      <a-alert type="warning" show-icon message="调账将直接生成资金流水且不可删除,请谨慎操作" style="margin-bottom: 16px" />
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="调账方向" required>
          <a-radio-group v-model:value="adjustForm.flowType">
            <a-radio :value="1">收入</a-radio>
            <a-radio :value="2">支出</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="金额" required>
          <a-input-number v-model:value="adjustForm.amount" :min="0.01" :precision="2" style="width: 200px" />
        </a-form-item>
        <a-form-item label="关联商户">
          <a-select
            v-model:value="adjustForm.merchantId"
            show-search
            allow-clear
            placeholder="选填,输入名称搜索"
            style="width: 240px"
            :filter-option="false"
            :options="merchantOptions"
            :loading="merchantSearching"
            @search="searchMerchant"
          />
        </a-form-item>
        <a-form-item v-if="isSuper" label="所属站点" required>
          <SiteTreeSelect v-model:value="adjustForm.siteId" style="width: 240px" />
        </a-form-item>
        <a-form-item label="调账原因" required>
          <a-textarea v-model:value="adjustForm.remark" :rows="3" :maxlength="500" placeholder="必填" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
