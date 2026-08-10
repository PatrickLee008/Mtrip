<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiAffiliateFraud, apiAffiliateFraudHandle } from '@/api/affiliate';

/** 达人反欺诈案件(Super Admin Portal 模块 06) */
const { t } = useI18n();

const INV_STATUS: Record<number, StatusItem> = {
  1: { text: 'Investigating', color: 'processing' },
  2: { text: 'Under Review', color: 'warning' },
  3: { text: 'Resolved', color: 'success' },
  4: { text: 'Dismissed', color: 'default' },
};
const RISK: Record<number, StatusItem> = {
  1: { text: 'High', color: 'error' },
  2: { text: 'Medium', color: 'warning' },
  3: { text: 'Low', color: 'success' },
};

const { loading, list, query, load, search, reset, pagination } = useTable(apiAffiliateFraud, {
  status: undefined,
  riskLevel: undefined,
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: 'Partner', dataIndex: 'partner_name', width: 160, ellipsis: true },
  { title: 'Handle', dataIndex: 'handle', width: 140 },
  { title: 'Fraud', dataIndex: 'fraud_score', width: 80 },
  { title: 'Risk', dataIndex: 'risk_level', width: 90 },
  { title: 'Activity', dataIndex: 'suspicious_activity', width: 180, ellipsis: true },
  { title: 'Status', dataIndex: 'investigation_status', width: 140 },
  { title: 'Detected', dataIndex: 'detection_date', width: 120 },
  { title: t('common.action'), key: 'action_col', width: 110, fixed: 'right' as const },
]);

const handleOpen = ref(false);
const handleSaving = ref(false);
const target = ref<TableRow | null>(null);
const handleForm = reactive({ investigationStatus: 3, suspend: false });
function openHandle(row: TableRow): void {
  target.value = row;
  Object.assign(handleForm, { investigationStatus: Number(row.investigation_status) || 3, suspend: false });
  handleOpen.value = true;
}
async function doHandle(): Promise<void> {
  if (!target.value) return;
  handleSaving.value = true;
  try {
    await apiAffiliateFraudHandle({
      id: target.value.id,
      investigationStatus: handleForm.investigationStatus,
      suspend: handleForm.suspend ? 1 : 0,
    });
    message.success('Case updated');
    handleOpen.value = false;
    await load();
  } finally {
    handleSaving.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Status">
          <a-select v-model:value="query.status" allow-clear placeholder="All" style="width: 150px">
            <a-select-option :value="1">Investigating</a-select-option>
            <a-select-option :value="2">Under Review</a-select-option>
            <a-select-option :value="3">Resolved</a-select-option>
            <a-select-option :value="4">Dismissed</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Risk">
          <a-select v-model:value="query.riskLevel" allow-clear placeholder="All" style="width: 120px">
            <a-select-option :value="1">High</a-select-option>
            <a-select-option :value="2">Medium</a-select-option>
            <a-select-option :value="3">Low</a-select-option>
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
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1180 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'risk_level'">
            <StatusTag :value="record.risk_level" :map="RISK" />
          </template>
          <template v-else-if="column.dataIndex === 'investigation_status'">
            <StatusTag :value="record.investigation_status" :map="INV_STATUS" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-button v-perm="'affiliate:fraud:handle'" type="link" size="small" @click="openHandle(record)">Handle</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="handleOpen" title="Handle Fraud Case" :confirm-loading="handleSaving" @ok="doHandle">
      <a-form :label-col="{ style: { width: '120px' } }" style="margin-top: 12px">
        <a-form-item label="Status">
          <a-select v-model:value="handleForm.investigationStatus">
            <a-select-option :value="1">Investigating</a-select-option>
            <a-select-option :value="2">Under Review</a-select-option>
            <a-select-option :value="3">Resolved</a-select-option>
            <a-select-option :value="4">Dismissed</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Suspend Partner">
          <a-switch v-model:checked="handleForm.suspend" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
