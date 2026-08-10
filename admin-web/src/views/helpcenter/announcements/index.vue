<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiHelpAnnouncements, apiHelpAnnouncementSave, apiHelpAnnouncementDelete } from '@/api/help';

/** 帮助中心公告(Super Admin Portal 模块 12) */
const { t } = useI18n();

const ANN_STATUS: Record<number, StatusItem> = {
  1: { text: 'Active', color: 'success' },
  2: { text: 'Scheduled', color: 'processing' },
  3: { text: 'Expired', color: 'default' },
  4: { text: 'Draft', color: 'warning' },
};
const PRIORITY: Record<number, StatusItem> = {
  1: { text: 'High', color: 'error' },
  2: { text: 'Normal', color: 'default' },
  3: { text: 'Low', color: 'success' },
};
const AUDIENCES = ['customer', 'merchant', 'affiliate', 'influencer', 'all'];

const { loading, list, query, load, search, reset, pagination } = useTable(apiHelpAnnouncements, {
  status: undefined,
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: 'Title', dataIndex: 'title', ellipsis: true },
  { title: 'Audience', dataIndex: 'audience', width: 110 },
  { title: 'Priority', dataIndex: 'priority', width: 100 },
  { title: 'Start', dataIndex: 'start_time', width: 170 },
  { title: 'End', dataIndex: 'end_time', width: 170 },
  { title: 'Status', dataIndex: 'status', width: 110 },
  { title: t('common.action'), key: 'action_col', width: 140, fixed: 'right' as const },
]);

const modalOpen = ref(false);
const saving = ref(false);
const editingId = ref(0);
const form = reactive({ title: '', audience: 'all', content: '', priority: 2, startTime: '', endTime: '', status: 4 });

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { title: '', audience: 'all', content: '', priority: 2, startTime: '', endTime: '', status: 4 });
  modalOpen.value = true;
}
function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    title: row.title, audience: row.audience || 'all', content: row.content ?? '',
    priority: Number(row.priority) || 2, startTime: row.start_time ?? '', endTime: row.end_time ?? '',
    status: Number(row.status) || 4,
  });
  modalOpen.value = true;
}
async function save(): Promise<void> {
  if (!form.title.trim()) {
    message.warning('Title is required');
    return;
  }
  saving.value = true;
  try {
    await apiHelpAnnouncementSave({ id: editingId.value || undefined, ...form });
    message.success(t('tip.saveSuccess'));
    modalOpen.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}
async function remove(row: TableRow): Promise<void> {
  await apiHelpAnnouncementDelete(row.id);
  message.success(t('common.delete'));
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
        <a-form-item label="Status">
          <a-select v-model:value="query.status" allow-clear placeholder="All" style="width: 140px">
            <a-select-option :value="1">Active</a-select-option>
            <a-select-option :value="2">Scheduled</a-select-option>
            <a-select-option :value="3">Expired</a-select-option>
            <a-select-option :value="4">Draft</a-select-option>
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
      <template #extra>
        <a-button v-perm="'help:announcement:publish'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>New Announcement
        </a-button>
      </template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1050 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'priority'">
            <StatusTag :value="record.priority" :map="PRIORITY" />
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="ANN_STATUS" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'help:announcement:publish'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-popconfirm title="Delete this announcement?" @confirm="remove(record)">
                <a-button v-perm="'help:announcement:publish'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" :title="editingId ? t('common.edit') : 'New Announcement'" width="640px" :confirm-loading="saving" @ok="save">
      <a-form :label-col="{ style: { width: '90px' } }" style="margin-top: 12px">
        <a-form-item label="Title" required><a-input v-model:value="form.title" /></a-form-item>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="Audience">
              <a-select v-model:value="form.audience">
                <a-select-option v-for="a in AUDIENCES" :key="a" :value="a">{{ a }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Priority">
              <a-select v-model:value="form.priority">
                <a-select-option :value="1">High</a-select-option>
                <a-select-option :value="2">Normal</a-select-option>
                <a-select-option :value="3">Low</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12"><a-form-item label="Start"><a-input v-model:value="form.startTime" placeholder="YYYY-MM-DD HH:mm" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="End"><a-input v-model:value="form.endTime" placeholder="YYYY-MM-DD HH:mm" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="Content"><a-textarea v-model:value="form.content" :rows="4" /></a-form-item>
        <a-form-item label="Status">
          <a-radio-group v-model:value="form.status">
            <a-radio :value="4">Draft</a-radio>
            <a-radio :value="2">Scheduled</a-radio>
            <a-radio :value="1">Active</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
