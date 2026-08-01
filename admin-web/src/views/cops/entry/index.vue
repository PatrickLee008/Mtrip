<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { Dayjs } from 'dayjs';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { formatAmount } from '@/utils/format';
import { apiEntryList, apiEntrySummary } from '@/api/cops';

/** 结算分账报表:出资分账明细 + 汇总(只读,数据来自支付时写入) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const { loading, list, query, load, search, reset, pagination } = useTable(apiEntryList, {
  merchantId: undefined,
  startDate: '',
  endDate: '',
  siteId: 0,
});

const dateRange = ref<[Dayjs, Dayjs] | undefined>();
function onRangeChange(): void {
  query.startDate = dateRange.value?.[0] ? dateRange.value[0].format('YYYY-MM-DD') : '';
  query.endDate = dateRange.value?.[1] ? dateRange.value[1].format('YYYY-MM-DD') : '';
}

const summary = ref<TableRow | null>(null);
async function loadAll(): Promise<void> {
  void load();
  summary.value = await apiEntrySummary({ ...query });
}

const FUNDING: Record<number, string> = { 1: '平台', 2: '商户', 3: '合作方', 4: '共担' };

const columns = [
  { title: '订单号', dataIndex: 'order_no', width: 190, ellipsis: true },
  { title: '商户ID', dataIndex: 'merchant_id', width: 90 },
  { title: '订单额', dataIndex: 'order_amount', width: 100 },
  { title: '佣金', dataIndex: 'commission', width: 90 },
  { title: '折扣', dataIndex: 'discount_amount', width: 90 },
  { title: '出资方', dataIndex: 'funding_source', width: 90 },
  { title: 'mTrip', dataIndex: 'mtrip_pays', width: 90 },
  { title: '商户', dataIndex: 'merchant_pays', width: 90 },
  { title: '合作方', dataIndex: 'partner_pays', width: 90 },
  { title: '应结商户', dataIndex: 'merchant_settlement', width: 110 },
  { title: '平台净收', dataIndex: 'platform_revenue', width: 110 },
  { title: '时间', dataIndex: 'created_at', width: 170 },
];
const AMT = ['order_amount', 'commission', 'discount_amount', 'mtrip_pays', 'merchant_pays', 'partner_pays', 'merchant_settlement', 'platform_revenue'];
function isAmt(d: unknown): boolean {
  return typeof d === 'string' && AMT.includes(d);
}
function fmt(record: TableRow, d: unknown): string {
  return typeof d === 'string' ? formatAmount(record[d]) : '';
}

function onSearch(): void {
  search();
  void loadAll();
}

onMounted(() => void loadAll());
</script>

<template>
  <PageContainer>
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="4"><a-card :bordered="false" class="mtrip-card-shadow"><a-statistic title="订单数" :value="summary?.order_count ?? 0" /></a-card></a-col>
      <a-col :span="5"><a-card :bordered="false" class="mtrip-card-shadow"><a-statistic title="订单额" :value="Number(summary?.order_amount ?? 0)" :precision="2" /></a-card></a-col>
      <a-col :span="5"><a-card :bordered="false" class="mtrip-card-shadow"><a-statistic title="平台佣金" :value="Number(summary?.commission ?? 0)" :precision="2" /></a-card></a-col>
      <a-col :span="5"><a-card :bordered="false" class="mtrip-card-shadow"><a-statistic title="应结商户" :value="Number(summary?.merchant_settlement ?? 0)" :precision="2" /></a-card></a-col>
      <a-col :span="5"><a-card :bordered="false" class="mtrip-card-shadow"><a-statistic title="平台净收入" :value="Number(summary?.platform_revenue ?? 0)" :precision="2" /></a-card></a-col>
    </a-row>

    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="商户ID">
          <a-input-number v-model:value="query.merchantId" placeholder="商户ID" style="width: 120px" />
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item label="日期">
          <a-range-picker v-model:value="dateRange" style="width: 240px" @change="onRangeChange" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="onSearch"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" title="分账明细">
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1400 }">
        <template #bodyCell="{ column, record }">
          <template v-if="isAmt(column.dataIndex)">{{ fmt(record, column.dataIndex) }}</template>
          <template v-else-if="column.dataIndex === 'funding_source'">
            <a-tag>{{ FUNDING[record.funding_source] ?? record.funding_source }}</a-tag>
          </template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
