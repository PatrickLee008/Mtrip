<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import type { TableRow } from '@/composables/useTable';
import { apiHelpCategories, apiHelpCategorySave, apiHelpCategoryDelete } from '@/api/help';

/** 帮助中心分类(Super Admin Portal 模块 12) */
const { t } = useI18n();

const loading = ref(false);
const list = ref<TableRow[]>([]);
const columns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: 'Icon', dataIndex: 'icon', width: 70 },
  { title: 'Name', dataIndex: 'name', width: 160 },
  { title: 'Description', dataIndex: 'description', ellipsis: true },
  { title: 'Articles', dataIndex: 'article_count', width: 90 },
  { title: 'Sort', dataIndex: 'sort', width: 80 },
  { title: 'Visible', dataIndex: 'visible', width: 90 },
  { title: t('common.action'), key: 'action_col', width: 140 },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    list.value = await apiHelpCategories();
  } finally {
    loading.value = false;
  }
}

const modalOpen = ref(false);
const saving = ref(false);
const editingId = ref(0);
const form = reactive({ name: '', icon: '', description: '', sort: 0, visible: 1 });

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { name: '', icon: '', description: '', sort: 0, visible: 1 });
  modalOpen.value = true;
}
function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    name: row.name, icon: row.icon ?? '', description: row.description ?? '',
    sort: Number(row.sort) || 0, visible: Number(row.visible),
  });
  modalOpen.value = true;
}
async function save(): Promise<void> {
  if (!form.name.trim()) {
    message.warning('Name is required');
    return;
  }
  saving.value = true;
  try {
    await apiHelpCategorySave({ id: editingId.value || undefined, ...form });
    message.success(t('tip.saveSuccess'));
    modalOpen.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}
async function toggleVisible(row: TableRow): Promise<void> {
  await apiHelpCategorySave({
    id: row.id, name: row.name, icon: row.icon, description: row.description,
    sort: row.sort, visible: row.visible === 1 ? 0 : 1,
  });
  await load();
}
async function remove(row: TableRow): Promise<void> {
  await apiHelpCategoryDelete(row.id);
  message.success(t('common.delete'));
  await load();
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>Categories</template>
      <template #extra>
        <a-space>
          <a-button @click="load"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          <a-button v-perm="'help:category:save'" type="primary" @click="openCreate">
            <template #icon><PlusOutlined /></template>New Category
          </a-button>
        </a-space>
      </template>
      <a-table :columns="columns" :data-source="list" :loading="loading" row-key="id" size="middle" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'visible'">
            <a-switch :checked="record.visible === 1" size="small" @change="toggleVisible(record)" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'help:category:save'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-popconfirm title="Delete this category?" @confirm="remove(record)">
                <a-button v-perm="'help:category:save'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" :title="editingId ? t('common.edit') : 'New Category'" :confirm-loading="saving" @ok="save">
      <a-form :label-col="{ style: { width: '100px' } }" style="margin-top: 12px">
        <a-form-item label="Name" required><a-input v-model:value="form.name" /></a-form-item>
        <a-form-item label="Icon"><a-input v-model:value="form.icon" placeholder="emoji e.g. 📅" /></a-form-item>
        <a-form-item label="Description"><a-input v-model:value="form.description" /></a-form-item>
        <a-form-item label="Sort"><a-input-number v-model:value="form.sort" :min="0" style="width: 100%" /></a-form-item>
        <a-form-item label="Visible">
          <a-switch :checked="form.visible === 1" @change="(v) => (form.visible = v ? 1 : 0)" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
