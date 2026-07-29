<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import {
  apiPermTplAdd,
  apiPermTplClients,
  apiPermTplDelete,
  apiPermTplList,
  apiPermTplToggleStatus,
  apiPermTplUpdate,
  type Row,
} from '@/api/client';

/** 接口权限模板:白/黑名单规则,apiList 每行一条(以 / 开头);删除需无客户端绑定 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const { t } = useI18n();

const { loading, list, query, load, search, reset, pagination } = useTable(apiPermTplList, {
  templateName: '',
  status: undefined,
  siteId: 0,
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('config.permtpl.name'), dataIndex: 'template_name', width: 160 },
  { title: t('config.permtpl.type'), dataIndex: 'rule_mode', width: 100 },
  { title: t('config.permtpl.apiCount'), dataIndex: 'api_count', width: 80 },
  { title: t('config.permtpl.boundClients'), dataIndex: 'client_count', width: 100 },
  { title: t('common.description'), dataIndex: 'description', ellipsis: true },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
  { title: t('common.action'), key: 'action_col', width: 240, fixed: 'right' as const },
]);

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  templateName: '',
  description: '',
  ruleMode: 1,
  apiListText: '',
  siteId: 0,
});

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { templateName: '', description: '', ruleMode: 1, apiListText: '', siteId: 0 });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  const apiList: string[] = Array.isArray(row.api_list) ? row.api_list : [];
  Object.assign(form, {
    templateName: row.template_name ?? '',
    description: row.description ?? '',
    ruleMode: row.rule_mode ?? 1,
    apiListText: apiList.join('\n'),
    siteId: row.site_id ?? 0,
  });
  modalOpen.value = true;
}

async function saveTpl(): Promise<void> {
  if (!form.templateName.trim()) {
    message.warning(t('common.pleaseInput'));
    return;
  }
  const apiList = form.apiListText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!apiList.length) {
    message.warning(t('common.pleaseInput'));
    return;
  }
  if (apiList.some((path) => !path.startsWith('/'))) {
    message.warning(t('common.pleaseInput'));
    return;
  }
  modalSaving.value = true;
  try {
    const data = {
      templateName: form.templateName,
      description: form.description,
      ruleMode: form.ruleMode,
      apiList,
      siteId: form.siteId,
    };
    if (editingId.value) {
      await apiPermTplUpdate({ id: editingId.value, ...data });
      message.success(t('tip.saveSuccess'));
    } else {
      await apiPermTplAdd(data);
      message.success(t('tip.saveSuccess'));
    }
    modalOpen.value = false;
    await load();
  } finally {
    modalSaving.value = false;
  }
}

async function toggleStatus(row: TableRow): Promise<void> {
  const result = await apiPermTplToggleStatus(row.id);
  message.success(result.status === 1 ? t('status.enabled') : t('status.disabled'));
  await load();
}

async function removeTpl(row: TableRow): Promise<void> {
  // 后端校验:存在绑定客户端时拒绝删除
  await apiPermTplDelete(row.id);
  message.success(t('tip.deleteSuccess'));
  await load();
}

// ---------- 绑定客户端抽屉 ----------
const clientsOpen = ref(false);
const clientsLoading = ref(false);
const clientsTpl = ref<TableRow | null>(null);
const clients = ref<Row[]>([]);

const CLIENT_TYPE: Record<number, string> = {
  1: 'Android',
  2: 'iOS',
  3: t('config.client.typeH5'),
};

const clientColumns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('common.name'), dataIndex: 'client_name' },
  { title: t('common.type'), dataIndex: 'client_type', width: 90 },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
]);

async function openClients(row: TableRow): Promise<void> {
  clientsTpl.value = row;
  clientsOpen.value = true;
  clientsLoading.value = true;
  try {
    clients.value = await apiPermTplClients(row.id);
  } finally {
    clientsLoading.value = false;
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
        <a-form-item :label="t('config.permtpl.name')">
          <a-input v-model:value="query.templateName" :placeholder="t('common.pleaseInput')" allow-clear style="width: 170px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('common.status')">
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
      <template #title>{{ t('config.permtpl.title') }}</template>
      <template #extra>
        <a-button v-perm="'config:permtpl:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('config.permtpl.actions.add') }}
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1100 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'rule_mode'">
            <a-tag :color="record.rule_mode === 1 ? 'green' : 'orange'">
              {{ record.rule_mode === 1 ? t('config.permtpl.typeWhitelist') : t('config.permtpl.typeBlacklist') }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'api_count'">
            {{ Array.isArray(record.api_list) ? record.api_list.length : (record.api_count ?? '-') }}
          </template>
          <template v-else-if="column.dataIndex === 'client_count'">
            <a-button type="link" size="small" @click="openClients(record)">{{ record.client_count ?? 0 }}</a-button>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'config:permtpl:edit'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-button type="link" size="small" @click="openClients(record)">{{ t('config.permtpl.actions.bindClient') }}</a-button>
              <a-popconfirm
                :title="record.status === 1 ? t('common.disable') : t('common.enable')"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'config:permtpl:edit'" type="link" size="small" :danger="record.status === 1">
                  {{ record.status === 1 ? t('status.disabled') : t('status.enabled') }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm :title="t('tip.confirmDelete')" @confirm="removeTpl(record)">
                <a-button v-perm="'config:permtpl:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('common.edit') + ' ' + t('config.permtpl.title') : t('config.permtpl.actions.add')"
      width="560px"
      :confirm-loading="modalSaving"
      @ok="saveTpl"
    >
      <a-form :label-col="{ style: { width: '100px' } }" style="margin-top: 16px">
        <a-form-item :label="t('config.permtpl.name')" required>
          <a-input v-model:value="form.templateName" :placeholder="t('common.pleaseInput')" />
        </a-form-item>
        <a-form-item :label="t('config.permtpl.type')" required>
          <a-radio-group v-model:value="form.ruleMode">
            <a-radio :value="1">{{ t('config.permtpl.typeWhitelist') }}</a-radio>
            <a-radio :value="2">{{ t('config.permtpl.typeBlacklist') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('config.permtpl.apiList.title')" required>
          <a-textarea
            v-model:value="form.apiListText"
            :rows="8"
            :placeholder="t('common.pleaseInput')"
          />
        </a-form-item>
        <a-form-item :label="t('common.site')">
          <SiteTreeSelect v-model:value="form.siteId" allow-all :disabled="!isSuper" />
        </a-form-item>
        <a-form-item :label="t('common.description')">
          <a-input v-model:value="form.description" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 绑定客户端抽屉 -->
    <a-drawer v-model:open="clientsOpen" :title="t('config.permtpl.bindClientModal.title', { name: clientsTpl?.template_name ?? '' })" width="520px">
      <a-spin :spinning="clientsLoading">
        <a-table
          :columns="clientColumns"
          :data-source="clients"
          :pagination="false"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'client_type'">
              <a-tag>{{ CLIENT_TYPE[record.client_type] ?? record.client_type }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <StatusTag :value="record.status" />
            </template>
          </template>
        </a-table>
        <a-empty v-if="!clientsLoading && !clients.length" :description="t('common.noData')" style="margin-top: 24px" />
      </a-spin>
    </a-drawer>
  </PageContainer>
</template>
