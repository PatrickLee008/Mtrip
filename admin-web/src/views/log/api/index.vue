<script setup lang="ts">
import { onMounted, ref } from 'vue';
import dayjs, { type Dayjs } from 'dayjs';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiApiLogDetail, apiApiLogList, apiApiLogStats } from '@/api/client';
import { exportCsv } from '@/utils/export';

/** 接口调用日志:统计卡片(近7天) + 多条件筛选列表 + 脱敏详情;只读永久留存 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

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

const CLIENT_TYPE: Record<number, string> = { 1: 'Android', 2: 'iOS', 3: 'H5' };

const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: 'ClientId', dataIndex: 'client_id', width: 200, ellipsis: true },
  { title: '客户端', dataIndex: 'client_name', width: 120 },
  { title: '类型', dataIndex: 'client_type', width: 90 },
  { title: '接口路径', dataIndex: 'api_path', ellipsis: true },
  { title: '方式', dataIndex: 'request_method', width: 70 },
  { title: '响应码', dataIndex: 'response_code', width: 80 },
  { title: '耗时(ms)', dataIndex: 'cost_ms', width: 90 },
  { title: 'IP', dataIndex: 'client_ip', width: 130 },
  { title: '时间', dataIndex: 'created_at', width: 160 },
  { title: '操作', key: 'action_col', width: 80, fixed: 'right' as const },
];

// ---------- 详情(入参出参写入时已脱敏) ----------
const detailOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);

function pretty(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') {
    return '(无)';
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
  exportCsv(`接口调用日志_${dayjs().format('YYYYMMDD_HHmmss')}`, [
    { title: 'ID', key: 'id' },
    { title: 'ClientId', key: 'client_id' },
    { title: '客户端', key: 'client_name' },
    { title: '类型', key: 'client_type', format: (row) => CLIENT_TYPE[row.client_type as number] ?? row.client_type },
    { title: '接口路径', key: 'api_path' },
    { title: '方式', key: 'request_method' },
    { title: '响应码', key: 'response_code' },
    { title: '耗时ms', key: 'cost_ms' },
    { title: 'IP', key: 'client_ip' },
    { title: '时间', key: 'created_at' },
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
            <a-statistic title="近7天调用总量" :value="stats?.total ?? 0" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow">
            <a-statistic title="近7天异常调用" :value="stats?.failCount ?? 0" :value-style="{ color: 'var(--mtrip-danger)' }" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow">
            <a-statistic title="平均耗时(ms)" :value="stats?.avgCostMs ?? 0" :precision="1" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow" :body-style="{ padding: '12px 16px' }">
            <div class="top-api-title">调用量 TOP 接口</div>
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
        <a-form-item label="ClientId">
          <a-input v-model:value="query.clientId" placeholder="精确匹配" allow-clear style="width: 190px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="接口路径">
          <a-input v-model:value="query.apiPath" placeholder="模糊搜索" allow-clear style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="响应码">
          <a-input-number v-model:value="query.responseCode" placeholder="如 500" style="width: 100px" />
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item label="时间">
          <a-range-picker v-model:value="dateRange" style="width: 240px" @change="onRangeChange" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>接口调用日志(只读,永久留存)</template>
      <template #extra>
        <a-button v-perm="'log:api:export'" @click="doExport">
          <template #icon><DownloadOutlined /></template>导出当前页
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
            <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情 -->
    <a-modal v-model:open="detailOpen" title="接口调用详情(敏感字段已脱敏)" width="720px" :footer="null">
      <a-spin :spinning="detailLoading">
        <a-descriptions v-if="detail" :column="2" size="small" bordered style="margin-top: 12px">
          <a-descriptions-item label="ClientId" :span="2">{{ detail.client_id }}</a-descriptions-item>
          <a-descriptions-item label="客户端">{{ detail.client_name }}({{ CLIENT_TYPE[detail.client_type] ?? detail.client_type }})</a-descriptions-item>
          <a-descriptions-item label="站点">{{ detail.site_id === 0 ? '全平台' : detail.site_id }}</a-descriptions-item>
          <a-descriptions-item label="接口" :span="2">{{ detail.request_method }} {{ detail.api_path }}</a-descriptions-item>
          <a-descriptions-item label="响应码">{{ detail.response_code }}</a-descriptions-item>
          <a-descriptions-item label="耗时">{{ detail.cost_ms }} ms</a-descriptions-item>
          <a-descriptions-item label="IP">{{ detail.client_ip }}</a-descriptions-item>
          <a-descriptions-item label="时间">{{ detail.created_at }}</a-descriptions-item>
        </a-descriptions>
        <template v-if="detail">
          <div class="io-title">请求参数</div>
          <pre class="io-content">{{ pretty(detail.request_params) }}</pre>
          <div class="io-title">响应数据</div>
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
