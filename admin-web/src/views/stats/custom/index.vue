<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { useTable } from '@/composables/useTable';
import { apiCustomReport } from '@/api/reports';

/** 自定义报表构建器(Super Admin Portal 模块 10 Custom Reports) */
const { t } = useI18n();

const TYPE_TEXT: Record<number, string> = { 1: 'Hotel', 2: 'Ticket' };
const ORDER_STATUS: Record<number, string> = {
  0: 'Unpaid', 1: 'Paid', 2: 'Checked-in', 3: 'Completed', 4: 'Cancelled', 5: 'Refunding', 6: 'Refunded', 7: 'Expired',
};

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const { loading, list, query, search, pagination } = useTable(apiCustomReport, {
  reportType: 'bookings',
  startDate: todayPlus(-30),
  endDate: todayPlus(0),
  merchantId: undefined,
});

const columns = computed(() => [
  { title: 'Order No', dataIndex: 'order_no', width: 180 },
  { title: 'Type', dataIndex: 'order_type', width: 90 },
  { title: 'Merchant', dataIndex: 'merchant_id', width: 100 },
  { title: 'Product', dataIndex: 'goods_name', ellipsis: true },
  { title: 'SKU', dataIndex: 'sku_name', width: 140, ellipsis: true },
  { title: 'Qty', dataIndex: 'quantity', width: 70 },
  { title: 'Pay Amount', dataIndex: 'pay_amount', width: 120 },
  { title: 'Commission', dataIndex: 'platform_commission', width: 120 },
  { title: 'Status', dataIndex: 'order_status', width: 120 },
]);

function exportCsv(): void {
  if (!list.value.length) {
    message.warning('No data to export');
    return;
  }
  const cols = ['order_no', 'order_type', 'merchant_id', 'goods_name', 'sku_name', 'quantity', 'pay_amount', 'platform_commission', 'order_status'];
  const header = cols.join(',');
  const lines = list.value.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','));
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `custom-report-${query.reportType}-${query.startDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Report Type">
          <a-select v-model:value="query.reportType" style="width: 150px">
            <a-select-option value="bookings">Booking Report</a-select-option>
            <a-select-option value="revenue">Revenue Report</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="From"><a-input v-model:value="query.startDate" placeholder="YYYY-MM-DD" style="width: 130px" /></a-form-item>
        <a-form-item label="To"><a-input v-model:value="query.endDate" placeholder="YYYY-MM-DD" style="width: 130px" /></a-form-item>
        <a-form-item label="Merchant ID"><a-input-number v-model:value="query.merchantId" :min="1" style="width: 120px" /></a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>Generate</a-button>
            <a-button @click="exportCsv"><template #icon><DownloadOutlined /></template>Export CSV</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1150 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'order_type'">{{ TYPE_TEXT[record.order_type] ?? record.order_type }}</template>
          <template v-else-if="column.dataIndex === 'order_status'">{{ ORDER_STATUS[record.order_status] ?? record.order_status }}</template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
