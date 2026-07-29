<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { exportCsv } from '@/utils/export';
import { formatAmount } from '@/utils/format';
import type { SiteNode } from '@/api/types';
import { apiSiteTree } from '@/api/site';
import { apiMerchantList } from '@/api/merchant';
import { apiStatsReport } from '@/api/stats';

/**
 * 维度报表共享组件:站点/商户/商品统计三页复用
 * dim=site|merchant|goods;导出按钮权限 `${permPrefix}:export`
 */
const props = defineProps<{
  dim: 'site' | 'merchant' | 'goods';
  permPrefix: string;
  title: string;
}>();

const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const dateRange = ref<string[]>([]);

const { loading, list, query, load, search, reset, pagination } = useTable(
  (params) => apiStatsReport({
    ...params,
    dim: props.dim,
    startDate: dateRange.value?.[0],
    endDate: dateRange.value?.[1],
  }),
  { merchantId: undefined, siteId: 0 },
);

function doReset(): void {
  dateRange.value = [];
  reset();
}

// ---------- 站点名映射(dim=site 时名称列用) ----------
const siteNameMap = ref<Record<number, string>>({});

function flattenSites(nodes: SiteNode[], map: Record<number, string>): void {
  nodes.forEach((node) => {
    map[node.id] = node.site_name;
    if (node.children?.length) {
      flattenSites(node.children, map);
    }
  });
}

/** 维度名称列:站点查映射,商户/商品用后端 dim_name */
function dimName(row: TableRow): string {
  if (props.dim === 'site') {
    return siteNameMap.value[row.dim_id] ?? `站点 #${row.dim_id}`;
  }
  return row.dim_name || `#${row.dim_id}`;
}

onMounted(() => {
  void load();
  if (props.dim === 'site') {
    void (async () => {
      const map: Record<number, string> = {};
      flattenSites(await apiSiteTree(), map);
      siteNameMap.value = map;
    })();
  }
});

const DIM_LABEL: Record<string, string> = { site: '站点', merchant: '商户', goods: '商品' };

const columns = [
  { title: 'ID', dataIndex: 'dim_id', width: 90 },
  { title: `${DIM_LABEL[props.dim]}名称`, key: 'name_col', ellipsis: true },
  { title: '订单数', dataIndex: 'order_count', width: 100 },
  { title: '已支付', dataIndex: 'paid_count', width: 100 },
  { title: '销售额', dataIndex: 'sales_amount', width: 130 },
  { title: '平台佣金', dataIndex: 'commission', width: 130 },
  { title: '退款额', dataIndex: 'refund_amount', width: 130 },
];

// ---------- 商户远程搜索(商品维度可按商户过滤) ----------
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

async function exportReport(): Promise<void> {
  exporting.value = true;
  try {
    const data = await apiStatsReport({
      ...query,
      dim: props.dim,
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
      page: 1,
      pageSize: 2000,
    });
    if (data.list.length === 0) {
      message.info('当前筛选条件下没有可导出的数据');
      return;
    }
    exportCsv(
      `${props.title}_${new Date().toISOString().slice(0, 10)}`,
      [
        { title: 'ID', key: 'dim_id' },
        { title: `${DIM_LABEL[props.dim]}名称`, key: 'dim_name', format: (row: TableRow) => dimName(row) },
        { title: '订单数', key: 'order_count' },
        { title: '已支付', key: 'paid_count' },
        { title: '销售额', key: 'sales_amount' },
        { title: '平台佣金', key: 'commission' },
        { title: '退款额', key: 'refund_amount' },
      ],
      data.list,
    );
    message.success(`已导出 ${data.list.length} 条统计`);
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="统计区间">
          <a-range-picker v-model:value="dateRange" value-format="YYYY-MM-DD" style="width: 240px" />
        </a-form-item>
        <a-form-item v-if="props.dim === 'goods'" label="商户">
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
        <a-form-item v-if="isSuper && props.dim !== 'site'" label="站点">
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

    <a-card :bordered="false" class="mtrip-card-shadow" :title="props.title">
      <template #extra>
        <a-button v-perm="`${props.permPrefix}:export`" :loading="exporting" @click="exportReport">
          <template #icon><DownloadOutlined /></template>导出CSV
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="dim_id"
        size="middle"
        :scroll="{ x: 900 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name_col'">{{ dimName(record) }}</template>
          <template v-else-if="column.dataIndex === 'sales_amount'">
            <span style="color: var(--mtrip-success, #52c41a); font-weight: 600">{{ formatAmount(record.sales_amount) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'commission'">{{ formatAmount(record.commission) }}</template>
          <template v-else-if="column.dataIndex === 'refund_amount'">
            <span :style="{ color: Number(record.refund_amount) > 0 ? 'var(--mtrip-error, #ff4d4f)' : undefined }">
              {{ formatAmount(record.refund_amount) }}
            </span>
          </template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
