<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { formatAmount } from '@/utils/format';
import { apiTripDetail, apiTripList } from '@/api/cops';

/** 多酒店 Trip 管理:列表 + 详情(含各预订) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const { loading, list, query, load, search, reset, pagination } = useTable(apiTripList, {
  tripNo: '',
  payStatus: undefined,
  siteId: 0,
});

const PAY_STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '待支付', color: 'warning' },
  1: { text: '已支付', color: 'success' },
  2: { text: '已取消', color: 'default' },
};

const columns = [
  { title: 'Trip号', dataIndex: 'trip_no', width: 200, ellipsis: true },
  { title: '用户ID', dataIndex: 'user_id', width: 90 },
  { title: '预订数', dataIndex: 'booking_count', width: 80 },
  { title: '合计', dataIndex: 'total_amount', width: 110 },
  { title: '券抵扣', dataIndex: 'coupon_discount', width: 100 },
  { title: '实付', dataIndex: 'pay_amount', width: 110 },
  { title: '支付状态', dataIndex: 'pay_status', width: 100 },
  { title: '创建时间', dataIndex: 'created_at', width: 170 },
  { title: '操作', key: 'action_col', width: 90, fixed: 'right' as const },
];

const detailOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);

async function openDetail(row: TableRow): Promise<void> {
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    detail.value = await apiTripDetail(row.id);
  } finally {
    detailLoading.value = false;
  }
}

const bookingColumns = [
  { title: '订单号', dataIndex: 'order_no', ellipsis: true },
  { title: '酒店', dataIndex: 'goods_name', ellipsis: true },
  { title: '房型', dataIndex: 'sku_name', width: 120 },
  { title: '入住', dataIndex: 'use_date', width: 110 },
  { title: '离店', dataIndex: 'end_date', width: 110 },
  { title: '分摊券', dataIndex: 'alloc_coupon_discount', width: 90 },
  { title: '实付', dataIndex: 'pay_amount', width: 100 },
  { title: '状态', dataIndex: 'order_status', width: 80 },
];

const MAIN_AMT = ['total_amount', 'coupon_discount', 'pay_amount'];
const BOOKING_AMT = ['alloc_coupon_discount', 'pay_amount'];
function isMainAmt(d: unknown): boolean {
  return typeof d === 'string' && MAIN_AMT.includes(d);
}
function isBookingAmt(d: unknown): boolean {
  return typeof d === 'string' && BOOKING_AMT.includes(d);
}
function fmt(record: TableRow, d: unknown): string {
  return typeof d === 'string' ? formatAmount(record[d]) : '';
}

onMounted(() => void load());
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Trip号">
          <a-input v-model:value="query.tripNo" placeholder="Trip 单号" allow-clear style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="支付状态">
          <a-select v-model:value="query.payStatus" placeholder="全部" allow-clear style="width: 130px">
            <a-select-option :value="0">待支付</a-select-option>
            <a-select-option :value="1">已支付</a-select-option>
            <a-select-option :value="2">已取消</a-select-option>
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

    <a-card :bordered="false" class="mtrip-card-shadow" title="Trip 列表">
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1100 }">
        <template #bodyCell="{ column, record }">
          <template v-if="isMainAmt(column.dataIndex)">
            {{ fmt(record, column.dataIndex) }}
          </template>
          <template v-else-if="column.dataIndex === 'pay_status'">
            <a-tag :color="PAY_STATUS[record.pay_status]?.color">{{ PAY_STATUS[record.pay_status]?.text ?? record.pay_status }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="detailOpen" title="Trip 详情" width="900px" :footer="null">
      <a-spin :spinning="detailLoading">
        <a-descriptions v-if="detail" :column="3" size="small" bordered style="margin: 8px 0 16px">
          <a-descriptions-item label="Trip号" :span="3">{{ detail.trip_no }}</a-descriptions-item>
          <a-descriptions-item label="预订数">{{ detail.booking_count }}</a-descriptions-item>
          <a-descriptions-item label="合计">{{ formatAmount(detail.total_amount) }}</a-descriptions-item>
          <a-descriptions-item label="实付">{{ formatAmount(detail.pay_amount) }}</a-descriptions-item>
        </a-descriptions>
        <a-table v-if="detail" :columns="bookingColumns" :data-source="detail.bookings || []" row-key="id" size="small" :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="isBookingAmt(column.dataIndex)">
              {{ fmt(record, column.dataIndex) }}
            </template>
          </template>
        </a-table>
      </a-spin>
    </a-modal>
  </PageContainer>
</template>
