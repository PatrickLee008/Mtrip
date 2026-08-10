<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiAffiliateApplications, apiAffiliateAppApprove, apiAffiliateAppReject } from '@/api/affiliate';

/** 达人入驻申请审核(Super Admin Portal 模块 06) */
const { t } = useI18n();

const APP_STATUS: Record<number, StatusItem> = {
  1: { text: 'Pending', color: 'warning' },
  2: { text: 'Approved', color: 'success' },
  3: { text: 'Rejected', color: 'error' },
};
const TYPES = ['influencer', 'blogger', 'kol', 'ota_partner', 'corporate'];

const { loading, list, query, load, search, reset, pagination } = useTable(apiAffiliateApplications, {
  keyword: '',
  status: undefined,
  type: '',
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: 'Name', dataIndex: 'name', width: 180, ellipsis: true },
  { title: 'Handle', dataIndex: 'handle', width: 150 },
  { title: 'Type', dataIndex: 'type', width: 120 },
  { title: 'Platform', dataIndex: 'platform', width: 120 },
  { title: 'Followers', dataIndex: 'followers', width: 110 },
  { title: 'Status', dataIndex: 'status', width: 110 },
  { title: t('common.action'), key: 'action_col', width: 200, fixed: 'right' as const },
]);

// 通过
const approveOpen = ref(false);
const approveSaving = ref(false);
const target = ref<TableRow | null>(null);
const approveRate = ref(5);
function openApprove(row: TableRow): void {
  target.value = row;
  approveRate.value = 5;
  approveOpen.value = true;
}
async function doApprove(): Promise<void> {
  if (!target.value) return;
  approveSaving.value = true;
  try {
    await apiAffiliateAppApprove(target.value.id, approveRate.value);
    message.success('Application approved, partner created');
    approveOpen.value = false;
    await load();
  } finally {
    approveSaving.value = false;
  }
}

// 驳回
const rejectOpen = ref(false);
const rejectSaving = ref(false);
const rejectReason = ref('');
function openReject(row: TableRow): void {
  target.value = row;
  rejectReason.value = '';
  rejectOpen.value = true;
}
async function doReject(): Promise<void> {
  if (!target.value) return;
  if (!rejectReason.value.trim()) {
    message.warning('Reason is required');
    return;
  }
  rejectSaving.value = true;
  try {
    await apiAffiliateAppReject(target.value.id, rejectReason.value);
    message.success('Application rejected');
    rejectOpen.value = false;
    await load();
  } finally {
    rejectSaving.value = false;
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
        <a-form-item label="Keyword">
          <a-input v-model:value="query.keyword" allow-clear placeholder="Name / handle" style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="Type">
          <a-select v-model:value="query.type" allow-clear placeholder="All" style="width: 150px">
            <a-select-option v-for="tp in TYPES" :key="tp" :value="tp">{{ tp }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Status">
          <a-select v-model:value="query.status" allow-clear placeholder="All" style="width: 130px">
            <a-select-option :value="1">Pending</a-select-option>
            <a-select-option :value="2">Approved</a-select-option>
            <a-select-option :value="3">Rejected</a-select-option>
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
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1100 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="APP_STATUS" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0" v-if="record.status === 1">
              <a-button v-perm="'affiliate:application:approve'" type="link" size="small" style="color: var(--sap-success)" @click="openApprove(record)">Approve</a-button>
              <a-button v-perm="'affiliate:application:reject'" type="link" size="small" danger @click="openReject(record)">Reject</a-button>
            </a-space>
            <span v-else style="color: var(--sap-muted)">-</span>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="approveOpen" title="Approve Application" :confirm-loading="approveSaving" ok-text="Approve" @ok="doApprove">
      <a-form :label-col="{ style: { width: '140px' } }" style="margin-top: 12px">
        <a-form-item label="Commission Rate">
          <a-input-number v-model:value="approveRate" :min="0" :max="100" :step="0.5" addon-after="%" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="rejectOpen" title="Reject Application" :confirm-loading="rejectSaving" ok-text="Reject" :ok-button-props="{ danger: true }" @ok="doReject">
      <a-textarea v-model:value="rejectReason" :rows="3" placeholder="Rejection reason (required)" />
    </a-modal>
  </PageContainer>
</template>
