<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiThemeDelete, apiThemeList, apiThemeSave } from '@/api/cops';

/** 动态主题:草稿/排期/优先级,C 端按生效主题自动切换(PRD 模块15) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const { loading, list, query, load, search, reset, pagination } = useTable(apiThemeList, { siteId: 0 });

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '主题名称', dataIndex: 'theme_name', width: 180 },
  { title: '默认', dataIndex: 'is_default', width: 80 },
  { title: '优先级', dataIndex: 'priority', width: 90 },
  { title: '生效开始', dataIndex: 'start_time', width: 170 },
  { title: '生效结束', dataIndex: 'end_time', width: 170 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '操作', key: 'action_col', width: 140, fixed: 'right' as const },
];

const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref(0);
const assetsText = ref('');
const form = reactive<{ themeName: string; description: string; thumbnail: string; isDefault: number; priority: number; startTime: string; endTime: string; status: number }>({
  themeName: '',
  description: '',
  thumbnail: '',
  isDefault: 0,
  priority: 0,
  startTime: '',
  endTime: '',
  status: 2,
});

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { themeName: '', description: '', thumbnail: '', isDefault: 0, priority: 0, startTime: '', endTime: '', status: 2 });
  assetsText.value = '{\n  "splash": "",\n  "logo": "",\n  "homeHeader": "",\n  "navAccent": "#1677ff"\n}';
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    themeName: row.theme_name,
    description: row.description,
    thumbnail: row.thumbnail,
    isDefault: row.is_default,
    priority: row.priority,
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    status: row.status,
  });
  assetsText.value = JSON.stringify(row.assets || {}, null, 2);
  modalOpen.value = true;
}

async function submit(): Promise<void> {
  let assets: Record<string, unknown> = {};
  if (assetsText.value.trim()) {
    try {
      assets = JSON.parse(assetsText.value);
    } catch {
      message.error('主题资源必须是合法 JSON');
      return;
    }
  }
  submitting.value = true;
  try {
    await apiThemeSave({ id: editingId.value || undefined, ...form, assets });
    message.success('已保存');
    modalOpen.value = false;
    void load();
  } finally {
    submitting.value = false;
  }
}

async function remove(row: TableRow): Promise<void> {
  await apiThemeDelete({ id: row.id });
  message.success('已删除');
  void load();
}

function onDefaultChange(checked: boolean | string | number): void {
  form.isDefault = checked ? 1 : 0;
}

onMounted(() => void load());
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
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

    <a-card :bordered="false" class="mtrip-card-shadow" title="主题列表">
      <template #extra>
        <a-button v-perm="'config:theme:save'" type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>新增主题</a-button>
      </template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1000 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'is_default'">
            <a-tag v-if="record.is_default === 1" color="blue">默认</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? '启用' : '停用' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space>
              <a-button v-perm="'config:theme:save'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-popconfirm title="确认删除该主题?" @confirm="remove(record)">
                <a-button v-perm="'config:theme:delete'" type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" :title="editingId ? '编辑主题' : '新增主题'" width="640px" :confirm-loading="submitting" @ok="submit">
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
        <a-form-item label="主题名称" required>
          <a-input v-model:value="form.themeName" placeholder="如 Thingyan Festival" />
        </a-form-item>
        <a-form-item label="描述">
          <a-input v-model:value="form.description" />
        </a-form-item>
        <a-form-item label="缩略图URL">
          <a-input v-model:value="form.thumbnail" />
        </a-form-item>
        <a-form-item label="默认主题">
          <a-switch :checked="form.isDefault === 1" @change="onDefaultChange" />
        </a-form-item>
        <a-form-item label="优先级">
          <a-input-number v-model:value="form.priority" :min="0" style="width: 140px" />
        </a-form-item>
        <a-form-item label="生效开始">
          <a-input v-model:value="form.startTime" placeholder="YYYY-MM-DD HH:mm:ss,留空即刻" />
        </a-form-item>
        <a-form-item label="生效结束">
          <a-input v-model:value="form.endTime" placeholder="YYYY-MM-DD HH:mm:ss,留空长期" />
        </a-form-item>
        <a-form-item label="状态">
          <a-radio-group v-model:value="form.status">
            <a-radio :value="1">启用</a-radio>
            <a-radio :value="2">停用</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="主题资源">
          <a-textarea v-model:value="assetsText" :rows="6" placeholder="JSON:splash/logo/homeHeader/navAccent 等" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
