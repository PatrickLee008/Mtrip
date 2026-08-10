<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiAffiliatePartners, apiAffiliatePartnerToggle } from '@/api/affiliate';

/** 合作方/达人名录(Super Admin Portal 模块 06) */
const { t } = useI18n();

const P_STATUS: Record<number, StatusItem> = {
  1: { text: 'Active', color: 'success' },
  2: { text: 'Pending', color: 'warning' },
  3: { text: 'Suspended', color: 'error' },
  4: { text: 'Rejected', color: 'default' },
};
const TYPES = ['influencer', 'blogger', 'kol', 'ota_partner', 'corporate'];

const { loading, list, query, load, search, reset, pagination } = useTable(apiAffiliatePartners, {
  keyword: '',
  status: undefined,
  type: '',
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: 'Name', dataIndex: 'name', width: 170, ellipsis: true },
  { title: 'Handle', dataIndex: 'handle', width: 140 },
  { title: 'Type', dataIndex: 'type', width: 110 },
  { title: 'Followers', dataIndex: 'followers', width: 100 },
  { title: 'Rate', dataIndex: 'commission_rate', width: 80 },
  { title: 'Withdrawable', dataIndex: 'withdrawable', width: 120 },
  { title: 'Fraud', dataIndex: 'fraud_score', width: 80 },
  { title: 'Status', dataIndex: 'status', width: 110 },
  { title: t('common.action'), key: 'action_col', width: 130, fixed: 'right' as const },
]);

async function toggle(row: TableRow): Promise<void> {
  const r = await apiAffiliatePartnerToggle(row.id);
  message.success(r.status === 1 ? 'Reactivated' : 'Suspended');
  await load();
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
            <a-select-option :value="1">Active</a-select-option>
            <a-select-option :value="2">Pending</a-select-option>
            <a-select-option :value="3">Suspended</a-select-option>
            <a-select-option :value="4">Rejected</a-select-option>
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
          <template v-if="column.dataIndex === 'commission_rate'">{{ record.commission_rate }}%</template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="P_STATUS" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-popconfirm
              v-if="record.status === 1 || record.status === 3"
              :title="record.status === 1 ? 'Suspend this partner?' : 'Reactivate this partner?'"
              @confirm="toggle(record)"
            >
              <a-button v-perm="'affiliate:partner:list'" type="link" size="small" :danger="record.status === 1">
                {{ record.status === 1 ? 'Suspend' : 'Reactivate' }}
              </a-button>
            </a-popconfirm>
            <span v-else style="color: var(--sap-muted)">-</span>
          </template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
