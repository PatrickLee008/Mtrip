<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
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

const { loading, list, query, load, search, reset, pagination } = useTable(apiPermTplList, {
  templateName: '',
  status: undefined,
  siteId: 0,
});

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '模板名称', dataIndex: 'template_name', width: 160 },
  { title: '规则模式', dataIndex: 'rule_mode', width: 100 },
  { title: '接口数', dataIndex: 'api_count', width: 80 },
  { title: '绑定客户端', dataIndex: 'client_count', width: 100 },
  { title: '描述', dataIndex: 'description', ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 80 },
  { title: '操作', key: 'action_col', width: 240, fixed: 'right' as const },
];

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
    message.warning('请输入模板名称');
    return;
  }
  const apiList = form.apiListText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!apiList.length) {
    message.warning('请至少填写一条接口规则');
    return;
  }
  if (apiList.some((path) => !path.startsWith('/'))) {
    message.warning('接口路径必须以 / 开头');
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
      message.success('权限模板已更新');
    } else {
      await apiPermTplAdd(data);
      message.success('权限模板已创建');
    }
    modalOpen.value = false;
    await load();
  } finally {
    modalSaving.value = false;
  }
}

async function toggleStatus(row: TableRow): Promise<void> {
  const result = await apiPermTplToggleStatus(row.id);
  message.success(result.status === 1 ? '模板已启用' : '模板已停用');
  await load();
}

async function removeTpl(row: TableRow): Promise<void> {
  // 后端校验:存在绑定客户端时拒绝删除
  await apiPermTplDelete(row.id);
  message.success('权限模板已删除');
  await load();
}

// ---------- 绑定客户端抽屉 ----------
const clientsOpen = ref(false);
const clientsLoading = ref(false);
const clientsTpl = ref<TableRow | null>(null);
const clients = ref<Row[]>([]);

const CLIENT_TYPE: Record<number, string> = { 1: 'Android', 2: 'iOS', 3: 'H5' };

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
        <a-form-item label="模板名称">
          <a-input v-model:value="query.templateName" placeholder="模糊搜索" allow-clear style="width: 170px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 100px">
            <a-select-option :value="1">启用</a-select-option>
            <a-select-option :value="2">停用</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
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
      <template #title>接口权限模板</template>
      <template #extra>
        <a-button v-perm="'config:permtpl:add'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>新增模板
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
              {{ record.rule_mode === 1 ? '白名单' : '黑名单' }}
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
              <a-button v-perm="'config:permtpl:edit'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button type="link" size="small" @click="openClients(record)">绑定客户端</a-button>
              <a-popconfirm
                :title="record.rule_mode === 1 && record.status === 1
                  ? '确认停用?停用后绑定该模板的客户端将不再受接口限制'
                  : (record.status === 1 ? '确认停用该模板?' : '确认启用该模板?')"
                @confirm="toggleStatus(record)"
              >
                <a-button v-perm="'config:permtpl:edit'" type="link" size="small" :danger="record.status === 1">
                  {{ record.status === 1 ? '停用' : '启用' }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm title="确认删除该模板?存在绑定客户端时需先解绑" @confirm="removeTpl(record)">
                <a-button v-perm="'config:permtpl:delete'" type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑权限模板' : '新增权限模板'"
      width="560px"
      :confirm-loading="modalSaving"
      @ok="saveTpl"
    >
      <a-form :label-col="{ style: { width: '100px' } }" style="margin-top: 16px">
        <a-form-item label="模板名称" required>
          <a-input v-model:value="form.templateName" placeholder="如:App 基础接口" />
        </a-form-item>
        <a-form-item label="规则模式" required>
          <a-radio-group v-model:value="form.ruleMode">
            <a-radio :value="1">白名单(仅允许列表内接口)</a-radio>
            <a-radio :value="2">黑名单(禁止列表内接口)</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="接口列表" required>
          <a-textarea
            v-model:value="form.apiListText"
            :rows="8"
            placeholder="每行一条接口路径,须以 / 开头,支持 * 通配&#10;/api/hotel/list&#10;/api/hotel/detail&#10;/api/order/*"
          />
        </a-form-item>
        <a-form-item label="归属站点">
          <SiteTreeSelect v-model:value="form.siteId" allow-all :disabled="!isSuper" />
        </a-form-item>
        <a-form-item label="描述">
          <a-input v-model:value="form.description" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 绑定客户端抽屉 -->
    <a-drawer v-model:open="clientsOpen" :title="`绑定客户端 — ${clientsTpl?.template_name ?? ''}`" width="520px">
      <a-spin :spinning="clientsLoading">
        <a-table
          :columns="[
            { title: 'ID', dataIndex: 'id', width: 70 },
            { title: '客户端名称', dataIndex: 'client_name' },
            { title: '类型', dataIndex: 'client_type', width: 90 },
            { title: '状态', dataIndex: 'status', width: 80 },
          ]"
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
        <a-empty v-if="!clientsLoading && !clients.length" description="暂无客户端绑定该模板" style="margin-top: 24px" />
      </a-spin>
    </a-drawer>
  </PageContainer>
</template>
