<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiWarnings, apiWarningIssue, apiWarningRevoke } from '@/api/compliance';

/** 商户警告(Super Admin Portal 模块 08) */
const { t } = useI18n();

const LEVEL: Record<number, string> = { 1: '1st Warning', 2: '2nd Warning', 3: '3rd Warning' };
const W_STATUS: Record<number, StatusItem> = {
  1: { text: 'Active', color: 'success' }, 2: { text: 'Revoked', color: 'default' },
};

const { loading, list, query, load, search, reset, pagination } = useTable(apiWarnings, {
  merchantId: undefined,
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: 'Merchant', dataIndex: 'merchant_name', width: 180, ellipsis: true },
  { title: 'Reason', dataIndex: 'reason', ellipsis: true },
  { title: 'Level', dataIndex: 'level', width: 120 },
  { title: 'Issued By', dataIndex: 'issued_by', width: 120 },
  { title: 'Expires', dataIndex: 'expires_at', width: 120 },
  { title: 'Status', dataIndex: 'status', width: 100 },
  { title: t('common.action'), key: 'action_col', width: 100, fixed: 'right' as const },
]);

const modalOpen = ref(false);
const saving = ref(false);
const form = reactive({ merchantId: undefined as number | undefined, reason: '', level: 1, expiresAt: '' });
function openIssue(): void {
  Object.assign(form, { merchantId: undefined, reason: '', level: 1, expiresAt: '' });
  modalOpen.value = true;
}
async function issue(): Promise<void> {
  if (!form.merchantId || !form.reason.trim()) { message.warning('Merchant ID and reason are required'); return; }
  saving.value = true;
  try {
    await apiWarningIssue({ ...form });
    message.success('Warning issued');
    modalOpen.value = false;
    await load();
  } finally { saving.value = false; }
}
async function revoke(row: TableRow): Promise<void> {
  await apiWarningRevoke(row.id);
  message.success(t('tip.saveSuccess'));
  await load();
}

onMounted(() => { void load(); });
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Merchant ID"><a-input-number v-model:value="query.merchantId" :min="1" style="width: 130px" /></a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #extra>
        <a-button v-perm="'platform:warning:issue'" type="primary" @click="openIssue"><template #icon><PlusOutlined /></template>Issue Warning</a-button>
      </template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1000 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'level'">{{ LEVEL[record.level] ?? record.level }}</template>
          <template v-else-if="column.dataIndex === 'status'"><StatusTag :value="record.status" :map="W_STATUS" /></template>
          <template v-else-if="column.key === 'action_col'">
            <a-popconfirm v-if="record.status === 1" title="Revoke this warning?" @confirm="revoke(record)">
              <a-button v-perm="'platform:warning:revoke'" type="link" size="small" danger>Revoke</a-button>
            </a-popconfirm>
            <span v-else style="color: var(--sap-muted)">-</span>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" title="Issue Warning" :confirm-loading="saving" @ok="issue">
      <a-form :label-col="{ style: { width: '110px' } }" style="margin-top: 12px">
        <a-form-item label="Merchant ID" required><a-input-number v-model:value="form.merchantId" :min="1" style="width: 100%" /></a-form-item>
        <a-form-item label="Reason" required><a-textarea v-model:value="form.reason" :rows="3" /></a-form-item>
        <a-form-item label="Level">
          <a-select v-model:value="form.level">
            <a-select-option :value="1">1st Warning</a-select-option>
            <a-select-option :value="2">2nd Warning</a-select-option>
            <a-select-option :value="3">3rd Warning</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Expires"><a-input v-model:value="form.expiresAt" placeholder="YYYY-MM-DD" /></a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
