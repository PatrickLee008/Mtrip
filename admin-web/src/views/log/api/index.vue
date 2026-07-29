<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import dayjs, { type Dayjs } from 'dayjs';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiApiLogDetail, apiApiLogList, apiApiLogStats } from '@/api/client';
import { exportCsv } from '@/utils/export';

/** 接口调用日志:统计卡片(近7天) + 多条件筛选列表 + 脱敏详情;只读永久留存 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const { t } = useI18n();

const { loading, list, query, load, search, reset, pagination } = useTable(apiApiLogList, {
  clientId: '',
  apiPath: '',
  responseCode: undefined,
  siteId: 0,
  startTime: '',
  endTime: '',
});

const dateRange = ref<[Dayjs, Dayjs] | undefined>();

function onRangeChange(): void {
  query.startTime = dateRange.value?.[0] ? dateRange.value[0].format('YYYY-MM-DD 00:00:00') : '';
  query.endTime = dateRange.value?.[1] ? dateRange.value[1].format('YYYY-MM-DD 23:59:59') : '';
}

// ---------- 统计 ----------
const stats = ref<{ total: number; failCount: number; avgCostMs: number; daily: TableRow[]; topApis: TableRow[] } | null>(null);
const statsLoading = ref(false);

async function loadStats(): Promise<void> {
  statsLoading.value = true;
  try {
    stats.value = await apiApiLogStats({ days: 7 });
  } finally {
    statsLoading.value = false;
  }
}

const CLIENT_TYPE = computed<Record<number, string>>(() => ({
  1: t('log.apiPage.clientTypeAndroid'),
  2: t('log.apiPage.clientTypeIos'),
  3: t('log.apiPage.clientTypeH5'),
}));

const columns = [
  { title: t('common.id'), dataIndex: 'id', width: 80 },
  { title: t('log.apiPage.clientId'), dataIndex: 'client_id', width: 200, ellipsis: true },
  { title: t('log.apiPage.clientType'), dataIndex: 'client_name', width: 120 },
  { title: t('common.type'), dataIndex: 'client_type', width: 90 },
  { title: t('log.apiPage.path'), dataIndex: 'api_path', ellipsis: true },
  { title: t('log.apiPage.method'), dataIndex: 'request_method', width: 70 },
  { title: t('log.apiPage.statusCode'), dataIndex: 'response_code', width: 80 },
  { title: t('log.apiPage.duration'), dataIndex: 'cost_ms', width: 90 },
  { title: t('log.apiPage.ip'), dataIndex: 'client_ip', width: 130 },
  { title: t('log.apiPage.time'), dataIndex: 'created_at', width: 160 },
  { title: t('common.action'), key: 'action_col', width: 80, fixed: 'right' as const },
];

// ---------- 详情(入参出参写入时已脱敏) ----------
const detailOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);

function pretty(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') {
    return t('oplog.empty');
  }
  try {
    return JSON.stringify(JSON.parse(String(raw)), null, 2);
  } catch {
    return String(raw);
  }
}

async function openDetail(row: TableRow): Promise<void> {
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    detail.value = await apiApiLogDetail(row.id);
  } finally {
    detailLoading.value = false;
  }
}

function doExport(): void {
  exportCsv(`${t('log.apiPage.title')}_${dayjs().format('YYYYMMDD_HHmmss')}`, [
    { title: t('common.id'), key: 'id' },
    { title: t('log.apiPage.clientId'), key: 'client_id' },
    { title: t('log.apiPage.clientType'), key: 'client_name' },
    { title: t('common.type'), key: 'client_type', format: (row) => CLIENT_TYPE.value[row.client_type as number] ?? row.client_type },
    { title: t('log.apiPage.path'), key: 'api_path' },
    { title: t('log.apiPage.method'), key: 'request_method' },
    { title: t('log.apiPage.statusCode'), key: 'response_code' },
    { title: t('log.apiPage.duration'), key: 'cost_ms' },
    { title: t('log.apiPage.ip'), key: 'client_ip' },
    { title: t('log.apiPage.time'), key: 'created_at' },
  ], list.value);
}

onMounted(() => {
  void load();
  void loadStats();
});
</script>

<template>
  <PageContainer>
    <!-- 统计卡片 -->
    <a-spin :spinning="statsLoading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow">
            <a-statistic :title="t('log.apiPage.statsTotal')" :value="stats?.total ?? 0" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow">
            <a-statistic :title="t('log.apiPage.statsFail')" :value="stats?.failCount ?? 0" :value-style="{ color: 'var(--mtrip-danger)' }" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow">
            <a-statistic :title="t('log.apiPage.statsAvgDuration')" :value="stats?.avgCostMs ?? 0" :precision="1" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow" :body-style="{ padding: '12px 16px' }">
            <div class="top-api-title">{{ t('log.apiPage.statsTopApi') }}</div>
            <div v-for="api in (stats?.topApis ?? []).slice(0, 3)" :key="api.api_path" class="top-api-row">
              <span class="path">{{ api.api_path }}</span>
              <span class="cnt">{{ api.cnt }}</span>
            </div>
            <a-empty v-if="!stats?.topApis?.length" :image-style="{ height: '28px' }" description="" />
          </a-card>
        </a-col>
      </a-row>
    </a-spin>

    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('log.apiPage.clientId')">
          <a-input v-model:value="query.clientId" :placeholder="t('log.apiPage.clientIdPlaceholder')" allow-clear style="width: 190px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('log.apiPage.path')">
          <a-input v-model:value="query.apiPath" :placeholder="t('log.apiPage.filter.pathPlaceholder')" allow-clear style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('log.apiPage.statusCode')">
          <a-input-number v-model:value="query.responseCode" :placeholder="t('log.apiPage.statusCode')" style="width: 100px" />
        </a-form-item>
        <a-form-item v-if="isSuper" :label="t('common.site')">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item :label="t('log.apiPage.time')">
          <a-range-picker v-model:value="dateRange" style="width: 240px" @change="onRangeChange" />
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
      <template #title>{{ t('log.apiPage.title') }}</template>
      <template #extra>
        <a-button v-perm="'log:api:export'" @click="doExport">
          <template #icon><DownloadOutlined /></template>{{ t('oplog.export') }}
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1400 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'client_type'">
            <a-tag>{{ CLIENT_TYPE[record.client_type] ?? record.client_type }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'response_code'">
            <a-tag :color="record.response_code >= 200 && record.response_code < 300 ? 'success' : 'error'">
              {{ record.response_code }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'cost_ms'">
            <span :style="record.cost_ms > 1000 ? 'color: var(--mtrip-danger)' : ''">{{ record.cost_ms }}</span>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情 -->
    <a-modal v-model:open="detailOpen" :title="t('log.apiPage.detailModal.title')" width="720px" :footer="null">
      <a-spin :spinning="detailLoading">
        <a-descriptions v-if="detail" :column="2" size="small" bordered style="margin-top: 12px">
          <a-descriptions-item :label="t('log.apiPage.clientId')" :span="2">{{ detail.client_id }}</a-descriptions-item>
          <a-descriptions-item :label="t('log.apiPage.clientType')">{{ detail.client_name }}({{ CLIENT_TYPE[detail.client_type] ?? detail.client_type }})</a-descriptions-item>
          <a-descriptions-item :label="t('common.site')">{{ detail.site_id === 0 ? t('app.allSites') : detail.site_id }}</a-descriptions-item>
          <a-descriptions-item :label="t('log.apiPage.path')" :span="2">{{ detail.request_method }} {{ detail.api_path }}</a-descriptions-item>
          <a-descriptions-item :label="t('log.apiPage.statusCode')">{{ detail.response_code }}</a-descriptions-item>
          <a-descriptions-item :label="t('log.apiPage.duration')">{{ detail.cost_ms }} ms</a-descriptions-item>
          <a-descriptions-item :label="t('log.apiPage.ip')">{{ detail.client_ip }}</a-descriptions-item>
          <a-descriptions-item :label="t('log.apiPage.time')">{{ detail.created_at }}</a-descriptions-item>
        </a-descriptions>
        <template v-if="detail">
          <div class="io-title">{{ t('log.apiPage.detailModal.sectionParams') }}</div>
          <pre class="io-content">{{ pretty(detail.request_params) }}</pre>
          <div class="io-title">{{ t('log.apiPage.detailModal.sectionResponse') }}</div>
          <pre class="io-content">{{ pretty(detail.response_body) }}</pre>
        </template>
      </a-spin>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.top-api-title {
  font-size: 12px;
  color: var(--mtrip-text-aux);
  margin-bottom: 6px;
}

.top-api-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  line-height: 20px;

  .path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cnt {
    font-weight: 600;
    color: var(--mtrip-primary);
  }
}

.io-title {
  font-weight: 600;
  margin: 16px 0 8px;
}

.io-content {
  max-height: 240px;
  overflow: auto;
  padding: 12px;
  border-radius: 4px;
  background: var(--mtrip-bg-page);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
