<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiMerchantDocuments } from '@/api/merchant';

/** 商户资质文档库(Super Admin Portal 模块 03 Merchant Documents) */
const { t } = useI18n();

const DOC_STATUS: Record<number, StatusItem> = {
  1: { text: 'Verified', color: 'success' },
  2: { text: 'Pending', color: 'warning' },
  3: { text: 'Rejected', color: 'error' },
  4: { text: 'Expired', color: 'error' },
  5: { text: 'Resubmission', color: 'processing' },
};

const { loading, list, query, search, reset, pagination, load } = useTable(apiMerchantDocuments, {
  keyword: '',
  status: undefined,
  docType: '',
});

const columns = computed(() => [
  { title: 'Merchant', dataIndex: 'merchant_id', width: 100 },
  { title: 'Document', dataIndex: 'name', ellipsis: true },
  { title: 'Type', dataIndex: 'doc_type', width: 160 },
  { title: 'Status', dataIndex: 'status', width: 130 },
  { title: 'Expiry', dataIndex: 'expiry_date', width: 120 },
  { title: 'Last Verified', dataIndex: 'last_verified_at', width: 165 },
  { title: 'Reviewer', dataIndex: 'reviewer_name', width: 120 },
  { title: 'Uploaded', dataIndex: 'uploaded_at', width: 165 },
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
          <a-input v-model:value="query.keyword" allow-clear placeholder="Document name" style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="Status">
          <a-select v-model:value="query.status" allow-clear placeholder="All" style="width: 150px">
            <a-select-option :value="1">Verified</a-select-option>
            <a-select-option :value="2">Pending</a-select-option>
            <a-select-option :value="3">Rejected</a-select-option>
            <a-select-option :value="4">Expired</a-select-option>
            <a-select-option :value="5">Resubmission</a-select-option>
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
        :scroll="{ x: 1160 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'name'">
            <div>{{ record.name || record.doc_type }}</div>
            <div style="font-size: 12px; color: var(--sap-muted)">{{ record.file_size }}</div>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="DOC_STATUS" />
          </template>
          <template v-else-if="column.dataIndex === 'expiry_date'">{{ record.expiry_date || '-' }}</template>
          <template v-else-if="column.dataIndex === 'last_verified_at'">{{ record.last_verified_at || '-' }}</template>
          <template v-else-if="column.dataIndex === 'reviewer_name'">{{ record.reviewer_name || '-' }}</template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
