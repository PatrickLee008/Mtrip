<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { useTable } from '@/composables/useTable';
import { apiInventoryAlerts } from '@/api/inventory';

/** 库存告警(Super Admin Portal 模块 04b):未来 N 天剩余 ≤ 阈值的分时库存 */
const { t } = useI18n();

const SKU_TYPE: Record<number, string> = { 1: 'Room', 2: 'Ticket' };

const { loading, list, query, load, search, reset, pagination } = useTable(apiInventoryAlerts, {
  daysAhead: 30,
  threshold: 5,
  goodsId: undefined,
});

const columns = computed(() => [
  { title: 'Product', dataIndex: 'goods_name', ellipsis: true },
  { title: 'SKU Type', dataIndex: 'sku_type', width: 100 },
  { title: 'SKU ID', dataIndex: 'sku_id', width: 90 },
  { title: 'Date', dataIndex: 'stock_date', width: 120 },
  { title: 'Available', dataIndex: 'stock_left', width: 110 },
  { title: 'Total', dataIndex: 'stock_total', width: 90 },
  { title: 'Sold', dataIndex: 'stock_sold', width: 90 },
  { title: 'Price', dataIndex: 'price', width: 100 },
]);

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Days Ahead">
          <a-input-number v-model:value="query.daysAhead" :min="1" :max="90" style="width: 100px" />
        </a-form-item>
        <a-form-item label="Threshold">
          <a-input-number v-model:value="query.threshold" :min="0" style="width: 100px" />
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
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 900 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'sku_type'">{{ SKU_TYPE[record.sku_type] ?? record.sku_type }}</template>
          <template v-else-if="column.dataIndex === 'stock_left'">
            <a-tag :color="record.stock_left <= 0 ? 'error' : 'warning'">{{ record.stock_left }}</a-tag>
          </template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
