<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { CopyOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import {
  apiClientAdd,
  apiClientDelete,
  apiClientList,
  apiClientResetSecret,
  apiClientStats,
  apiClientToggleStatus,
  apiClientUpdate,
  apiPermTplAll,
  type ClientSecretResult,
  type Row,
} from '@/api/client';

/** 客户端密钥:创建/重置返回的明文 Secret 仅展示一次;重置为高危操作,必填备注留痕 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const { t } = useI18n();

const CLIENT_TYPE = computed<Record<number, string>>(() => ({ 1: 'Android', 2: 'iOS', 3: t('config.client.typeH5') }));

const { loading, list, query, load, search, reset, pagination } = useTable(apiClientList, {
  clientName: '',
  clientType: undefined,
  status: undefined,
  siteId: 0,
});

const columns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('config.client.name'), dataIndex: 'client_name', width: 140 },
  { title: t('common.type'), dataIndex: 'client_type', width: 90 },
  { title: 'ClientId', dataIndex: 'client_id', width: 210, ellipsis: true },
  { title: t('config.client.secret'), dataIndex: 'client_secret', width: 140 },
  { title: t('config.client.bindPermTpl'), dataIndex: 'perm_template_name', width: 130 },
  { title: t('config.client.qps'), dataIndex: 'qps_limit', width: 70 },
  { title: t('config.client.expireAt'), dataIndex: 'expire_at', width: 120 },
  { title: t('config.client.status'), dataIndex: 'status', width: 80 },
  { title: t('common.action'), key: 'action_col', width: 300, fixed: 'right' as const },
];

// 权限模板下拉
const tplOptions = ref<Row[]>([]);

async function loadTplOptions(): Promise<void> {
  tplOptions.value = await apiPermTplAll();
}

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  clientName: '',
  clientType: 1,
  permTemplateId: undefined as number | undefined,
  qpsLimit: 50,
  ipWhitelist: '',
  expireAt: undefined as Dayjs | undefined,
  remark: '',
  siteId: 0,
});

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, {
    clientName: '',
    clientType: 1,
    permTemplateId: undefined,
    qpsLimit: 50,
    ipWhitelist: '',
    expireAt: undefined,
    remark: '',
    siteId: 0,
  });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    clientName: row.client_name ?? '',
    clientType: row.client_type ?? 1,
    permTemplateId: row.perm_template_id || undefined,
    qpsLimit: row.qps_limit ?? 50,
    ipWhitelist: row.ip_whitelist ?? '',
    expireAt: row.expire_at ? dayjs(row.expire_at) : undefined,
    remark: row.remark ?? '',
    siteId: row.site_id ?? 0,
  });
  modalOpen.value = true;
}

async function saveClient(): Promise<void> {
  if (!form.clientName.trim()) {
    message.warning(t('common.pleaseInput'));
    return;
  }
  modalSaving.value = true;
  try {
    const data = { ...form, expireAt: form.expireAt ? form.expireAt.format('YYYY-MM-DD 23:59:59') : '' };
    if (editingId.value) {
      await apiClientUpdate({ id: editingId.value, ...data });
      message.success(t('tip.saveSuccess'));
    } else {
      const result = await apiClientAdd(data);
      showSecret(result, t('tip.saveSuccess'));
    }
    modalOpen.value = false;
    await load();
  } finally {
    modalSaving.value = false;
  }
}

// ---------- Secret 明文展示(仅此一次) ----------
const secretOpen = ref(false);
const secretTitle = ref('');
const secretData = ref<ClientSecretResult | null>(null);

function showSecret(result: ClientSecretResult, title: string): void {
  secretData.value = result;
  secretTitle.value = title;
  secretOpen.value = true;
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  message.success(t('config.client.copied'));
}

// ---------- 重置密钥(高危:必填备注留痕) ----------
const resetOpen = ref(false);
const resetSaving = ref(false);
const resetTarget = ref<TableRow | null>(null);
const resetRemark = ref('');

function openReset(row: TableRow): void {
  resetTarget.value = row;
  resetRemark.value = '';
  resetOpen.value = true;
}

async function doResetSecret(): Promise<void> {
  if (!resetTarget.value) {
    return;
  }
  if (!resetRemark.value.trim()) {
    message.warning(t('config.client.resetSecretConfirm'));
    return;
  }
  resetSaving.value = true;
  try {
    const result = await apiClientResetSecret(resetTarget.value.id, resetRemark.value.trim());
    resetOpen.value = false;
    showSecret(result, `${t('config.client.actions.resetSecret')} — ${resetTarget.value.client_name}`);
    await load();
  } finally {
    resetSaving.value = false;
  }
}

async function toggleStatus(row: TableRow): Promise<void> {
  const result = await apiClientToggleStatus(row.id);
  message.success(result.status === 1 ? t('status.enabled') : t('status.disabled'));
  await load();
}

async function removeClient(row: TableRow): Promise<void> {
  // 后端校验:启用中的客户端需先禁用
  await apiClientDelete(row.id);
  message.success(t('tip.deleteSuccess'));
  await load();
}

// ---------- 调用统计抽屉 ----------
const statsOpen = ref(false);
const statsLoading = ref(false);
const statsClient = ref<TableRow | null>(null);
const stats = ref<{ total: number; successCount: number; failCount: number; avgCostMs: number; daily: Row[] } | null>(null);

async function openStats(row: TableRow): Promise<void> {
  statsClient.value = row;
  statsOpen.value = true;
  statsLoading.value = true;
  try {
    stats.value = await apiClientStats(row.id);
  } finally {
    statsLoading.value = false;
  }
}

onMounted(() => {
  void load();
  void loadTplOptions();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('config.client.name')">
          <a-input v-model:value="query.clientName" :placeholder="t('common.search')" allow-clear style="width: 170px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('common.type')">
          <a-select v-model:value="query.clientType" allow-clear :placeholder="t('common.all')" style="width: 110px">
            <a-select-option :value="1">Android</a-select-option>
            <a-select-option :value="2">iOS</a-select-option>
            <a-select-option :value="3">{{ t('config.client.typeH5') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('config.client.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 100px">
            <a-select-option :value="1">{{ t('status.enabled') }}</a-select-option>
            <a-select-option :value="2">{{ t('status.disabled') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="isSuper" :label="t('common.site')">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
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
      <template #title>{{ t('config.client.title') }}</template>
      <template #extra>
        <a-button v-perm="'config:client:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('config.client.actions.add') }}
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1450 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'client_type'">
            <a-tag>{{ CLIENT_TYPE[record.client_type] ?? record.client_type }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'client_secret'">
            <span class="secret-mask">{{ record.client_secret }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'perm_template_name'">
            {{ record.perm_template_name || '-' }}
          </template>
          <template v-else-if="column.dataIndex === 'expire_at'">
            {{ record.expire_at || t('config.client.neverExpire') }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'config:client:edit'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-button type="link" size="small" @click="openStats(record)">{{ t('config.client.bindPermTpl') }}</a-button>
              <a-button v-perm="'config:client:reset-secret'" type="link" size="small" danger @click="openReset(record)">
                {{ t('config.client.actions.resetSecret') }}
              </a-button>
              <a-popconfirm
                :title="record.status === 1 ? `${t('common.disable')}?` : `${t('common.enable')}?`"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'config:client:status'" type="link" size="small" :danger="record.status === 1">
                  {{ record.status === 1 ? t('common.disable') : t('common.enable') }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm :title="t('config.client.confirmDelete')" @confirm="removeClient(record)">
                <a-button v-perm="'config:client:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('common.edit') : t('config.client.actions.add')"
      width="600px"
      :confirm-loading="modalSaving"
      @ok="saveClient"
    >
      <a-form :label-col="{ style: { width: '110px' } }" style="margin-top: 16px">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item :label="t('config.client.name')" required>
              <a-input v-model:value="form.clientName" :placeholder="t('config.client.namePlaceholder')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.client.type')" required>
              <a-select v-model:value="form.clientType">
                <a-select-option :value="1">Android</a-select-option>
                <a-select-option :value="2">iOS</a-select-option>
                <a-select-option :value="3">{{ t('config.client.typeH5') }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.client.bindPermTpl')">
              <a-select
                v-model:value="form.permTemplateId"
                allow-clear
                :placeholder="t('config.client.permTplNone')"
                :options="tplOptions.map((row) => ({ value: row.id, label: row.template_name }))"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.client.qps')">
              <a-input-number v-model:value="form.qpsLimit" :min="1" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.client.expireAt')">
              <a-date-picker v-model:value="form.expireAt" style="width: 100%" :placeholder="t('config.client.neverExpire')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('common.site')">
              <SiteTreeSelect v-model:value="form.siteId" allow-all :disabled="!isSuper" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('config.client.ipWhitelist')">
              <a-textarea v-model:value="form.ipWhitelist" :rows="2" :placeholder="t('config.client.ipPlaceholder')" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('common.remark')">
              <a-input v-model:value="form.remark" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- Secret 明文(仅展示一次) -->
    <a-modal v-model:open="secretOpen" :title="secretTitle" width="520px" :footer="null" :mask-closable="false">
      <a-alert
        :message="t('config.client.regenerated')"
        type="warning"
        show-icon
        style="margin: 12px 0 16px"
      />
      <a-descriptions :column="1" size="small" bordered>
        <a-descriptions-item label="ClientId">
          <a-space>
            <span class="mono">{{ secretData?.clientId }}</span>
            <a-button type="link" size="small" @click="copyText(secretData?.clientId ?? '')"><CopyOutlined />{{ t('config.client.copy') }}</a-button>
          </a-space>
        </a-descriptions-item>
        <a-descriptions-item label="ClientSecret">
          <a-space>
            <span class="mono secret-plain">{{ secretData?.clientSecret }}</span>
            <a-button type="link" size="small" @click="copyText(secretData?.clientSecret ?? '')"><CopyOutlined />{{ t('config.client.copy') }}</a-button>
          </a-space>
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>

    <!-- 重置密钥(高危,必填备注) -->
    <a-modal
      v-model:open="resetOpen"
      :title="`${t('config.client.actions.resetSecret')} — ${resetTarget?.client_name ?? ''}`"
      width="480px"
      :confirm-loading="resetSaving"
      :ok-button-props="{ danger: true }"
      :ok-text="t('common.confirm')"
      @ok="doResetSecret"
    >
      <a-alert
        :message="t('config.client.resetSecretConfirm')"
        type="error"
        show-icon
        style="margin: 12px 0 16px"
      />
      <a-form layout="vertical">
        <a-form-item :label="t('common.remark')" required>
          <a-textarea v-model:value="resetRemark" :rows="3" :placeholder="t('common.remark')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 调用统计抽屉 -->
    <a-drawer v-model:open="statsOpen" :title="`${t('config.client.title')} — ${statsClient?.client_name ?? ''}`" width="560px">
      <a-spin :spinning="statsLoading">
        <a-row :gutter="12" style="margin-bottom: 16px">
          <a-col :span="6"><a-statistic :title="t('log.apiPage.title')" :value="stats?.total ?? 0" /></a-col>
          <a-col :span="6"><a-statistic :title="t('status.success')" :value="stats?.successCount ?? 0" /></a-col>
          <a-col :span="6">
            <a-statistic :title="t('status.failed')" :value="stats?.failCount ?? 0" :value-style="{ color: 'var(--mtrip-danger)' }" />
          </a-col>
          <a-col :span="6"><a-statistic :title="t('log.apiPage.duration')" :value="stats?.avgCostMs ?? 0" :precision="1" /></a-col>
        </a-row>
        <a-table
          :columns="[
            { title: t('oplog.time'), dataIndex: 'day' },
            { title: t('log.apiPage.title'), dataIndex: 'cnt' },
          ]"
          :data-source="stats?.daily ?? []"
          :pagination="false"
          row-key="day"
          size="small"
        />
      </a-spin>
    </a-drawer>
  </PageContainer>
</template>

<style scoped lang="less">
.secret-mask {
  font-family: monospace;
  color: var(--mtrip-text-aux);
}

.mono {
  font-family: monospace;
  word-break: break-all;
}

.secret-plain {
  color: var(--mtrip-danger);
  font-weight: 600;
}
</style>
