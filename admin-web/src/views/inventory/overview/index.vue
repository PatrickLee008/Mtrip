<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { useTable } from '@/composables/useTable';
import { apiInventoryOverview } from '@/api/inventory';

/** 库存总览(Super Admin Portal 模块 04b),按上架商品聚合未来 N 天库存 */
const { t } = useI18n();

const TYPE_TEXT: Record<number, string> = { 1: 'Hotel', 2: 'Ticket' };

const { loading, list, query, load, search, reset, pagination } = useTable(apiInventoryOverview, {
  goodsName: '',
  goodsType: undefined,
  daysAhead: 30,
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 80 },
  { title: 'Product', dataIndex: 'goods_name', ellipsis: true },
  { title: 'Type', dataIndex: 'goods_type', width: 100 },
  { title: 'Total', dataIndex: 'stock_total', width: 100 },
  { title: 'Sold', dataIndex: 'stock_sold', width: 100 },
  { title: 'Locked', dataIndex: 'stock_locked', width: 100 },
  { title: 'Available', dataIndex: 'stock_left', width: 110 },
]);

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Product">
          <a-input v-model:value="query.goodsName" allow-clear style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="Type">
          <a-select v-model:value="query.goodsType" allow-clear placeholder="All" style="width: 120px">
            <a-select-option :value="1">Hotel</a-select-option>
            <a-select-option :value="2">Ticket</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Days Ahead">
          <a-input-number v-model:value="query.daysAhead" :min="1" :max="90" style="width: 100px" />
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
          <template v-if="column.dataIndex === 'goods_type'">{{ TYPE_TEXT[record.goods_type] ?? record.goods_type }}</template>
          <template v-else-if="column.dataIndex === 'stock_left'">
            <span :style="{ color: record.stock_left <= 5 ? 'var(--sap-danger)' : 'var(--sap-success)', fontWeight: 600 }">{{ record.stock_left }}</span>
          </template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
