<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiMerchantActivities } from '@/api/merchant';
import { exportCsv } from '@/utils/exportCsv';
import { get } from '@/utils/http';
const exporting = ref(false);

/**
 * 商户活动审计(Super Admin Portal 模块 03 Merchant Activities)
 * 需求源:docs/redesign/需求分析-商户管理模块.md §3.8
 * 活动类型 chip 计数条(可点击过滤) + 关键词/类型/日期/管理员/商户筛选 + 详情抽屉
 */
const { t } = useI18n();

const ACT_STATUS = computed<Record<number, StatusItem>>(() => ({
  1: { text: t('merchant.activitiesPage.statusSuccess'), color: 'success' },
  2: { text: t('merchant.activitiesPage.statusFailed'), color: 'error' },
  3: { text: t('merchant.activitiesPage.statusPending'), color: 'warning' },
}));

const ACT_TYPES = [
  'login',
  'profile_update',
  'account_change',
  'operation',
  'suspension',
  'reactivation',
  'document_upload',
  'verification',
  'warning',
  'impersonation',
  'booking',
  'blacklist',
  'notification',
] as const;

function typeLabel(type: string): string {
  if (['status', 'compliance', 'verification', 'warning'].includes(type)) return t(`merchant.s3.sources.${type}`);
  const key = `merchant.activitiesPage.type${type.replace(/(^|_)(\w)/g, (_m, _p, c) => c.toUpperCase())}`;
  const label = t(key);
  return label === key ? type : label;
}

// 列表 + 类型计数条(计数仅站点口径,由同一接口返回)
const stats = ref<Record<string, number>>({});

async function fetchActivities(params: Record<string, unknown>): Promise<{ list: TableRow[]; total: number; page: number; pageSize: number }> {
  const data = params.source && params.source !== 'activity'
    ? await get<{ list: TableRow[]; total: number; page: number; pageSize: number; stats?: Record<string, number> }>('/admin/merchant/activities/history', params)
    : await apiMerchantActivities(params);
  if (data.stats) {
    stats.value = data.stats;
  }
  return data;
}

const { loading, list, query, search, reset, pagination, load } = useTable(fetchActivities, {
  source: 'activity',
  keyword: '',
  activityType: '',
  dateRange: '',
  admin: '',
  merchant: '',
});

const CHIP_TYPES = computed(() => [
  { key: '', label: t('merchant.activitiesPage.statAll'), count: stats.value.total ?? 0 },
  { key: 'login', label: t('merchant.activitiesPage.typeLogin'), count: stats.value.login ?? 0 },
  { key: 'suspension', label: t('merchant.activitiesPage.typeSuspension'), count: stats.value.suspension ?? 0 },
  { key: 'verification', label: t('merchant.activitiesPage.typeVerification'), count: stats.value.verification ?? 0 },
  { key: 'warning', label: t('merchant.activitiesPage.typeWarning'), count: stats.value.warning ?? 0 },
  { key: 'document_upload', label: t('merchant.activitiesPage.typeDocumentUpload'), count: stats.value.document_upload ?? 0 },
  { key: 'profile_update', label: t('merchant.activitiesPage.typeProfileUpdate'), count: stats.value.profile_update ?? 0 },
]);

const activeChip = ref<string>('');

function filterByChip(key: string): void {
  activeChip.value = key;
  query.activityType = key;
  search();
}

const columns = computed(() => [
  { title: t('merchant.activitiesPage.colTime'), dataIndex: 'created_at', width: 170 },
  { title: t('merchant.activitiesPage.colMerchant'), dataIndex: 'merchant_name', width: 200 },
  { title: t('merchant.activitiesPage.colType'), dataIndex: 'activity_type', width: 150 },
  { title: t('merchant.activitiesPage.colDescription'), dataIndex: 'description', ellipsis: true },
  { title: t('merchant.activitiesPage.colPerformedBy'), dataIndex: 'performed_by', width: 150 },
  { title: t('merchant.activitiesPage.colIp'), dataIndex: 'ip_address', width: 140 },
  { title: t('merchant.activitiesPage.colStatus'), dataIndex: 'status', width: 100 },
  { title: t('common.action'), key: 'action_col', width: 80, fixed: 'right' as const },
]);

// ---------- 详情抽屉 ----------
const drawerOpen = ref(false);
const drawerRow = ref<TableRow | null>(null);

function openDetail(row: TableRow): void {
  drawerRow.value = row;
  drawerOpen.value = true;
}

/** 导出当前筛选结果(整改 D2) */
async function exportList(): Promise<void> {
  if (exporting.value) return;
  exporting.value = true;
  const data: { list: TableRow[] } = { list: [] };
  const filters = { ...query };
  let snapshotId = 0;
  let beforeId: number | null = null;
  try {
    do {
      const batch: { list: TableRow[]; snapshotId: number; nextBeforeId: number | null } = await get(filters.source === 'activity' ? '/admin/merchant/activities' : '/admin/merchant/activities/history', { ...filters, export: 1, pageSize: 200, snapshotId, beforeId });
      data.list.push(...batch.list);
      snapshotId = batch.snapshotId; beforeId = batch.nextBeforeId;
    } while (beforeId !== null);
  exportCsv(`merchant-activities-${Date.now()}.csv`, [
    { key: 'created_at', label: 'Activity Time' },
    { key: 'merchant_name', label: 'Merchant' },
    { key: 'activity_type', label: 'Type' },
    { key: 'description', label: 'Description' },
    { key: 'performed_by', label: 'Performed By' },
    { key: 'ip_address', label: 'IP Address' },
    { key: 'status', label: 'Status' },
  ], data.list.map((row) => ({
    ...Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? `'${value}` : value])),
    activity_type: typeLabel(row.activity_type),
    status: ACT_STATUS.value[row.status]?.text ?? row.status,
  })));
  } finally { exporting.value = false; }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <div style="font-size: 12px; color: var(--sap-muted, #94a3b8); margin-bottom: 4px">
      {{ t('merchant.activitiesPage.subtitle') }}
    </div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px">
      <div>
        <div style="font-size: 18px; font-weight: 700; color: #1a2332">{{ t('merchant.activitiesPage.title') }}</div>
        <div style="font-size: 12px; color: #64748b">{{ t('merchant.activitiesPage.pageDesc') }}</div>
      </div>
      <a-button v-perm="'merchant:activity:export'" :loading="exporting" type="link" style="color: #1664ff" @click="exportList">
        <template #icon><ReloadOutlined /></template>{{ t('common.export') }}
      </a-button>
    </div>

    <a-select v-model:value="query.source" style="width: 240px; margin-bottom: 16px" @change="search">
      <a-select-option v-for="source in ['activity', 'status', 'verification', 'warning', 'compliance']" :key="source" :value="source">{{ t(`merchant.s3.sources.${source}`) }}</a-select-option>
    </a-select>
    <a-alert v-if="query.source !== 'activity'" :message="t('merchant.s3.historySourceNotice')" type="info" style="margin-bottom: 16px" />
    <!-- 活动类型 chip 计数条 -->
    <div v-if="query.source === 'activity'" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px">
      <div
        v-for="chip in CHIP_TYPES"
        :key="chip.key"
        class="activity-chip"
        :class="{ active: activeChip === chip.key }"
        style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 16px; border: 1px solid #e3e8f0; background: #fff; font-size: 12px; color: #475569; transition: all 0.2s"
        @click="filterByChip(chip.key)"
      >
        <span>{{ chip.label }}</span>
        <span style="font-weight: 700">{{ chip.count }}</span>
      </div>
    </div>

    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('merchant.activitiesPage.keyword')">
          <a-input v-model:value="query.keyword" allow-clear :placeholder="t('merchant.activitiesPage.keywordPlaceholder')" style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('merchant.activitiesPage.typeLabel')">
          <a-select v-model:value="query.activityType" allow-clear :placeholder="t('common.all')" style="width: 160px" @change="search">
            <a-select-option v-for="tp in ACT_TYPES" :key="tp" :value="tp">{{ typeLabel(tp) }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('merchant.activitiesPage.dateLabel')">
          <a-select v-model:value="query.dateRange" allow-clear :placeholder="t('common.all')" style="width: 140px" @change="search">
            <a-select-option value="today">{{ t('merchant.activitiesPage.dateToday') }}</a-select-option>
            <a-select-option value="7d">{{ t('merchant.activitiesPage.date7d') }}</a-select-option>
            <a-select-option value="30d">{{ t('merchant.activitiesPage.date30d') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('merchant.activitiesPage.adminLabel')">
          <a-input v-model:value="query.admin" allow-clear :placeholder="t('merchant.activitiesPage.colPerformedBy')" style="width: 140px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('merchant.activitiesPage.merchantLabel')">
          <a-input v-model:value="query.merchant" allow-clear :placeholder="t('merchant.activitiesPage.colMerchant')" style="width: 160px" @press-enter="search" />
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
        :scroll="{ x: 1150 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'merchant_name'">
            <div style="font-weight: 600">{{ record.merchant_name || '-' }}</div>
            <div style="font-size: 11px; color: #94a3b8">#{{ record.merchant_id }}</div>
          </template>
          <template v-else-if="column.dataIndex === 'activity_type'">
            <a-tag color="processing" style="margin-right: 0">{{ typeLabel(record.activity_type) }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="ACT_STATUS" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-tooltip :title="t('merchant.activitiesPage.detailTitle')">
              <a-button type="link" size="small" @click="openDetail(record)"><template #icon><EyeOutlined /></template></a-button>
            </a-tooltip>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 活动详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" :width="480" :title="t('merchant.activitiesPage.detailTitle')">
      <template v-if="drawerRow">
        <a-alert
          :type="drawerRow.status === 1 ? 'success' : drawerRow.status === 2 ? 'error' : 'warning'"
          show-icon
          :message="`${typeLabel(drawerRow.activity_type)} · ${drawerRow.status === null ? '-' : ACT_STATUS[drawerRow.status]?.text ?? '-'}`"
          style="margin-bottom: 16px"
        />
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item :label="t('merchant.activitiesPage.logId')">{{ drawerRow.id }}</a-descriptions-item>
          <a-descriptions-item :label="t('merchant.activitiesPage.colTime')">{{ drawerRow.created_at }}</a-descriptions-item>
          <a-descriptions-item :label="t('merchant.activitiesPage.colMerchant')">{{ drawerRow.merchant_name }} (#{{ drawerRow.merchant_id }})</a-descriptions-item>
          <a-descriptions-item :label="t('merchant.activitiesPage.colType')">{{ typeLabel(drawerRow.activity_type) }}</a-descriptions-item>
          <a-descriptions-item :label="t('merchant.activitiesPage.colDescription')">{{ drawerRow.description || '-' }}</a-descriptions-item>
          <a-descriptions-item :label="t('merchant.activitiesPage.colPerformedBy')">{{ drawerRow.performed_by || '-' }} · {{ drawerRow.actor_type }} #{{ drawerRow.performed_by_id ?? '-' }}</a-descriptions-item>
          <a-descriptions-item :label="t('merchant.s3.target')">{{ drawerRow.entity_type || drawerRow.source || '-' }} #{{ drawerRow.entity_id ?? drawerRow.id }}</a-descriptions-item>
          <a-descriptions-item :label="t('merchant.activitiesPage.colIp')">{{ drawerRow.ip_address || '-' }}</a-descriptions-item>
          <a-descriptions-item :label="t('merchant.activitiesPage.colStatus')">
            <StatusTag :value="drawerRow.status" :map="ACT_STATUS" />
          </a-descriptions-item>
        </a-descriptions>
        <a-alert
          v-if="drawerRow.activity_type === 'impersonation'"
          type="warning"
          show-icon
          :message="t('merchant.activitiesPage.typeImpersonation')"
          :description="t('merchant.activitiesPage.impersonationHint')"
          style="margin-top: 16px"
        />
      </template>
    </a-drawer>
  </PageContainer>
</template>

<style scoped lang="less">
.activity-chip {
  &:hover {
    border-color: #1664ff;
    color: #1664ff;
  }
  &.active {
    border-color: #1664ff;
    background: rgba(22, 100, 255, 0.08);
    color: #1664ff;
    font-weight: 600;
  }
}
</style>
