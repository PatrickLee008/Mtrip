<script setup lang="ts">
import { onMounted, ref } from 'vue';
import dayjs, { type Dayjs } from 'dayjs';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiOplogDetail, apiOplogList } from '@/api/system';
import { exportCsv } from '@/utils/export';

/**
 * 系统操作日志面板:系统管理/操作日志 与 系统日志/后台操作日志 两个菜单复用
 * 只读,禁止删改;导出基于当前页数据由前端生成 CSV
 */
const props = defineProps<{
  /** 导出按钮权限标识(两个入口的 perm_key 不同) */
  permExport: string;
}>();

const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const { t } = useI18n();

const { loading, list, query, load, search, reset, pagination } = useTable(apiOplogList, {
  adminName: '',
  module: '',
  action: '',
  siteId: 0,
  startTime: '',
  endTime: '',
});

const dateRange = ref<[Dayjs, Dayjs] | undefined>();

function onRangeChange(): void {
  query.startTime = dateRange.value?.[0] ? dateRange.value[0].format('YYYY-MM-DD 00:00:00') : '';
  query.endTime = dateRange.value?.[1] ? dateRange.value[1].format('YYYY-MM-DD 23:59:59') : '';
}

const columns = [
  { title: t('common.id'), dataIndex: 'id', width: 80 },
  { title: t('oplog.operator'), dataIndex: 'admin_name', width: 110 },
  { title: t('common.site'), dataIndex: 'site_id', width: 80 },
  { title: t('oplog.module'), dataIndex: 'module', width: 110 },
  { title: t('oplog.action'), dataIndex: 'action', width: 100 },
  { title: t('oplog.requestUrl'), dataIndex: 'request_url', ellipsis: true },
  { title: t('oplog.requestMethod'), dataIndex: 'request_method', width: 80 },
  { title: t('oplog.clientIp'), dataIndex: 'client_ip', width: 130 },
  { title: t('oplog.statusCode'), dataIndex: 'status_code', width: 80 },
  { title: t('oplog.time'), dataIndex: 'created_at', width: 160 },
  { title: t('common.action'), key: 'action_col', width: 80, fixed: 'right' as const },
];

// ---------- 详情弹窗(含修改前后数据) ----------
const detailOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);

/** content 为中间件记录的脱敏 JSON,格式化便于对比修改前后数据 */
function prettyContent(raw: unknown): string {
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
    detail.value = await apiOplogDetail(row.id);
  } finally {
    detailLoading.value = false;
  }
}

function doExport(): void {
  exportCsv(`${t('oplog.title')}_${dayjs().format('YYYYMMDD_HHmmss')}`, [
    { title: t('common.id'), key: 'id' },
    { title: t('oplog.operator'), key: 'admin_name' },
    { title: t('common.site'), key: 'site_id' },
    { title: t('oplog.module'), key: 'module' },
    { title: t('oplog.action'), key: 'action' },
    { title: t('oplog.requestUrl'), key: 'request_url' },
    { title: t('oplog.requestMethod'), key: 'request_method' },
    { title: t('oplog.clientIp'), key: 'client_ip' },
    { title: t('oplog.statusCode'), key: 'status_code' },
    { title: t('oplog.time'), key: 'created_at' },
  ], list.value);
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-alert
      type="info"
      show-icon
      :message="t('oplog.alert')"
      style="margin-bottom: 16px"
    />
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('oplog.filterAdmin')">
          <a-input v-model:value="query.adminName" :placeholder="t('oplog.filterAdminPlaceholder')" allow-clear style="width: 140px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('oplog.filterModule')">
          <a-input v-model:value="query.module" :placeholder="t('oplog.filterModulePlaceholder')" allow-clear style="width: 120px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('oplog.filterAction')">
          <a-input v-model:value="query.action" :placeholder="t('oplog.filterActionPlaceholder')" allow-clear style="width: 110px" @press-enter="search" />
        </a-form-item>
        <a-form-item v-if="isSuper" :label="t('common.site')">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item :label="t('oplog.filterTime')">
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
      <template #title>{{ t('oplog.title') }}</template>
      <template #extra>
        <a-button v-perm="props.permExport" @click="doExport">
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
        :scroll="{ x: 1300 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status_code'">
            <a-tag :color="record.status_code >= 200 && record.status_code < 300 ? 'success' : 'error'">
              {{ record.status_code }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情 -->
    <a-modal v-model:open="detailOpen" :title="t('oplog.detailTitle')" width="720px" :footer="null">
      <a-spin :spinning="detailLoading">
        <a-descriptions v-if="detail" :column="2" size="small" bordered style="margin-top: 12px">
          <a-descriptions-item :label="t('oplog.operator')">{{ detail.admin_name }}(ID:{{ detail.admin_id }})</a-descriptions-item>
          <a-descriptions-item :label="t('common.site')">{{ detail.site_id === 0 ? t('app.allSites') : detail.site_id }}</a-descriptions-item>
          <a-descriptions-item :label="t('oplog.module')">{{ detail.module }}</a-descriptions-item>
          <a-descriptions-item :label="t('oplog.action')">{{ detail.action }}</a-descriptions-item>
          <a-descriptions-item :label="t('oplog.requestUrl')" :span="2">{{ detail.request_method }} {{ detail.request_url }}</a-descriptions-item>
          <a-descriptions-item :label="t('oplog.clientIp')">{{ detail.client_ip }}</a-descriptions-item>
          <a-descriptions-item :label="t('oplog.statusCode')">{{ detail.status_code }}</a-descriptions-item>
          <a-descriptions-item :label="t('oplog.device')" :span="2">{{ detail.user_agent }}</a-descriptions-item>
          <a-descriptions-item :label="t('oplog.time')" :span="2">{{ detail.created_at }}</a-descriptions-item>
        </a-descriptions>
        <div v-if="detail" style="margin-top: 16px">
          <div style="font-weight: 600; margin-bottom: 8px">{{ t('oplog.content') }}</div>
          <pre class="oplog-content">{{ prettyContent(detail.content) }}</pre>
        </div>
      </a-spin>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.oplog-content {
  max-height: 320px;
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
