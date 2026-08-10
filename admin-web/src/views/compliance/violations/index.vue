<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiViolations, apiViolationHandle } from '@/api/compliance';

/** 商户违规工单(Super Admin Portal 模块 08) */
const { t } = useI18n();

const SEVERITY: Record<number, StatusItem> = {
  1: { text: 'Critical', color: 'error' }, 2: { text: 'High', color: 'orange' },
  3: { text: 'Medium', color: 'warning' }, 4: { text: 'Low', color: 'processing' },
};
const V_STATUS: Record<number, StatusItem> = {
  1: { text: 'Open', color: 'error' }, 2: { text: 'Resolved', color: 'success' },
};

const { loading, list, query, load, search, reset, pagination } = useTable(apiViolations, {
  status: undefined, merchantId: undefined,
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: 'Merchant', dataIndex: 'merchant_name', width: 180, ellipsis: true },
  { title: 'Rule', dataIndex: 'rule_title', ellipsis: true },
  { title: 'Severity', dataIndex: 'severity', width: 110 },
  { title: 'Status', dataIndex: 'status', width: 100 },
  { title: 'Action', dataIndex: 'action', width: 160, ellipsis: true },
  { title: 'Assigned', dataIndex: 'assigned_to', width: 120 },
  { title: t('common.action'), key: 'action_col', width: 120, fixed: 'right' as const },
]);

async function resolve(row: TableRow): Promise<void> {
  await apiViolationHandle({ id: row.id, status: 2, action: 'Resolved by admin' });
  message.success(t('tip.saveSuccess'));
  await load();
}

onMounted(() => { void load(); });
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Status">
          <a-select v-model:value="query.status" allow-clear placeholder="All" style="width: 130px">
            <a-select-option :value="1">Open</a-select-option>
            <a-select-option :value="2">Resolved</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Merchant ID">
          <a-input-number v-model:value="query.merchantId" :min="1" style="width: 130px" />
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
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1120 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'severity'"><StatusTag :value="record.severity" :map="SEVERITY" /></template>
          <template v-else-if="column.dataIndex === 'status'"><StatusTag :value="record.status" :map="V_STATUS" /></template>
          <template v-else-if="column.key === 'action_col'">
            <a-popconfirm v-if="record.status === 1" title="Mark as resolved?" @confirm="resolve(record)">
              <a-button v-perm="'platform:violation:handle'" type="link" size="small" style="color: var(--sap-success)">Resolve</a-button>
            </a-popconfirm>
            <span v-else style="color: var(--sap-muted)">-</span>
          </template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
