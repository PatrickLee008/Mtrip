<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { exportCsv } from '@/utils/export';
import { apiMerchantList } from '@/api/merchant';
import { apiVerifyLogs } from '@/api/order';

/**
 * 核销日志(核销管理菜单,只读):与订单菜单的核销记录同接口
 * 撤销核销操作在 订单管理→核销记录 页(perm order:verify:revoke)
 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const VERIFY_TYPE_TEXT: Record<number, string> = { 1: '设备核销', 2: '商户核销', 3: '后台手工' };
const STATUS_TEXT: Record<number, string> = { 1: '成功', 3: '已撤销' };

const dateRange = ref<string[]>([]);

const { loading, list, query, load, search, reset, pagination } = useTable(
  (params) => apiVerifyLogs({
    ...params,
    startDate: dateRange.value?.[0],
    endDate: dateRange.value?.[1],
  }),
  { orderNo: '', merchantId: undefined, verifyType: undefined, status: undefined, siteId: 0 },
);

function doReset(): void {
  dateRange.value = [];
  reset();
}

onMounted(() => {
  void load();
});

const columns = [
  { title: '订单号', dataIndex: 'order_no', width: 200 },
  { title: '核销码', dataIndex: 'verify_code', width: 140 },
  { title: '方式', dataIndex: 'verify_type', width: 100 },
  { title: '商户ID', dataIndex: 'merchant_id', width: 90 },
  { title: '操作人', dataIndex: 'operator_name', width: 120, ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '撤销原因', dataIndex: 'revoke_reason', ellipsis: true },
  { title: '核销时间', dataIndex: 'created_at', width: 165 },
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

// ---------- CSV 导出(当前筛选前 2000 条) ----------
const exporting = ref(false);

async function exportLogs(): Promise<void> {
  exporting.value = true;
  try {
    const data = await apiVerifyLogs({
      ...query,
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
      page: 1,
      pageSize: 2000,
    });
    if (data.list.length === 0) {
      message.info('当前筛选条件下没有可导出的日志');
      return;
    }
    exportCsv(
      `核销日志_${new Date().toISOString().slice(0, 10)}`,
      [
        { title: '订单号', key: 'order_no' },
        { title: '核销码', key: 'verify_code' },
        { title: '方式', key: 'verify_type', format: (row: TableRow) => VERIFY_TYPE_TEXT[row.verify_type] ?? row.verify_type },
        { title: '商户ID', key: 'merchant_id' },
        { title: '操作人', key: 'operator_name' },
        { title: '状态', key: 'status', format: (row: TableRow) => STATUS_TEXT[row.status] ?? row.status },
        { title: '撤销原因', key: 'revoke_reason' },
        { title: '核销时间', key: 'created_at' },
      ],
      data.list,
    );
    message.success(`已导出 ${data.list.length} 条日志`);
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="订单号">
          <a-input v-model:value="query.orderNo" allow-clear placeholder="精确匹配" style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="商户">
          <a-select
            v-model:value="query.merchantId"
            show-search
            allow-clear
            placeholder="输入名称搜索"
            style="width: 200px"
            :filter-option="false"
            :options="merchantOptions"
            :loading="merchantSearching"
            @search="searchMerchant"
          />
        </a-form-item>
        <a-form-item label="核销方式">
          <a-select v-model:value="query.verifyType" allow-clear placeholder="全部" style="width: 120px">
            <a-select-option v-for="(text, key) in VERIFY_TYPE_TEXT" :key="key" :value="Number(key)">{{ text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 100px">
            <a-select-option :value="1">成功</a-select-option>
            <a-select-option :value="3">已撤销</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="核销日期">
          <a-range-picker v-model:value="dateRange" value-format="YYYY-MM-DD" style="width: 240px" />
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

    <a-card :bordered="false" class="mtrip-card-shadow" title="核销日志">
      <template #extra>
        <a-button v-perm="'verify:log:export'" :loading="exporting" @click="exportLogs">
          <template #icon><DownloadOutlined /></template>导出CSV
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1200 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'verify_type'">
            <a-tag :color="record.verify_type === 3 ? 'blue' : 'default'">{{ VERIFY_TYPE_TEXT[record.verify_type] ?? '-' }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ STATUS_TEXT[record.status] ?? '-' }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'revoke_reason'">{{ record.revoke_reason || '-' }}</template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
