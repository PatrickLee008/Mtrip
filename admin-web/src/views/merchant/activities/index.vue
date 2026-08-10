<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiMerchantActivities } from '@/api/merchant';

/** 商户活动审计日志(Super Admin Portal 模块 03 Merchant Activities) */
const { t } = useI18n();

const ACT_STATUS: Record<number, StatusItem> = {
  1: { text: 'Success', color: 'success' },
  2: { text: 'Failed', color: 'error' },
  3: { text: 'Pending', color: 'warning' },
};

const ACT_TYPES = [
  'login', 'profile_update', 'suspension', 'reactivation', 'document_upload',
  'verification', 'warning', 'impersonation', 'booking', 'blacklist',
];

const { loading, list, query, search, reset, pagination, load } = useTable(apiMerchantActivities, {
  keyword: '',
  activityType: '',
});

const columns = computed(() => [
  { title: 'Time', dataIndex: 'created_at', width: 170 },
  { title: 'Merchant', dataIndex: 'merchant_id', width: 100 },
  { title: 'Type', dataIndex: 'activity_type', width: 140 },
  { title: 'Description', dataIndex: 'description', ellipsis: true },
  { title: 'Performed By', dataIndex: 'performed_by', width: 140 },
  { title: 'IP', dataIndex: 'ip_address', width: 130 },
  { title: 'Status', dataIndex: 'status', width: 100 },
]);

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Keyword">
          <a-input v-model:value="query.keyword" allow-clear placeholder="Description" style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="Type">
          <a-select v-model:value="query.activityType" allow-clear placeholder="All" style="width: 170px">
            <a-select-option v-for="tp in ACT_TYPES" :key="tp" :value="tp">{{ tp }}</a-select-option>
          </a-select>
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
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1050 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="ACT_STATUS" />
          </template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
