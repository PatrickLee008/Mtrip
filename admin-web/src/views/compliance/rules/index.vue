<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiRules, apiRuleSave, apiRulePublish, apiRuleDelete } from '@/api/compliance';

/** 平台规则库(Super Admin Portal 模块 08) */
const { t } = useI18n();

const SEVERITY: Record<number, StatusItem> = {
  1: { text: 'Critical', color: 'error' },
  2: { text: 'High', color: 'orange' },
  3: { text: 'Medium', color: 'warning' },
  4: { text: 'Low', color: 'processing' },
};
const R_STATUS: Record<number, StatusItem> = {
  1: { text: 'Active', color: 'success' },
  2: { text: 'Draft', color: 'default' },
  3: { text: 'Archived', color: 'default' },
};
const CATEGORIES = ['Booking', 'Listing', 'Operations', 'Pricing', 'Reviews', 'Finance', 'Compliance', 'Marketing'];

const { loading, list, query, load, search, reset, pagination } = useTable(apiRules, {
  keyword: '', status: undefined, category: '',
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: 'Title', dataIndex: 'title', ellipsis: true },
  { title: 'Category', dataIndex: 'category', width: 120 },
  { title: 'Severity', dataIndex: 'severity', width: 110 },
  { title: 'Applies', dataIndex: 'applies', width: 140 },
  { title: 'Status', dataIndex: 'status', width: 110 },
  { title: t('common.action'), key: 'action_col', width: 220, fixed: 'right' as const },
]);

const modalOpen = ref(false);
const saving = ref(false);
const editingId = ref(0);
const form = reactive({ title: '', category: 'Booking', severity: 3, applies: 'All Merchants', status: 2 });
function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { title: '', category: 'Booking', severity: 3, applies: 'All Merchants', status: 2 });
  modalOpen.value = true;
}
function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, { title: row.title, category: row.category || 'Booking', severity: Number(row.severity) || 3, applies: row.applies || 'All Merchants', status: Number(row.status) || 2 });
  modalOpen.value = true;
}
async function save(): Promise<void> {
  if (!form.title.trim()) { message.warning('Title is required'); return; }
  saving.value = true;
  try {
    await apiRuleSave({ id: editingId.value || undefined, ...form });
    message.success(t('tip.saveSuccess'));
    modalOpen.value = false;
    await load();
  } finally { saving.value = false; }
}
async function publish(row: TableRow, action: string): Promise<void> {
  await apiRulePublish(row.id, action);
  message.success(t('tip.saveSuccess'));
  await load();
}
async function remove(row: TableRow): Promise<void> {
  await apiRuleDelete(row.id);
  message.success(t('common.delete'));
  await load();
}

onMounted(() => { void load(); });
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Keyword"><a-input v-model:value="query.keyword" allow-clear style="width: 180px" @press-enter="search" /></a-form-item>
        <a-form-item label="Category">
          <a-select v-model:value="query.category" allow-clear placeholder="All" style="width: 140px">
            <a-select-option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Status">
          <a-select v-model:value="query.status" allow-clear placeholder="All" style="width: 120px">
            <a-select-option :value="1">Active</a-select-option>
            <a-select-option :value="2">Draft</a-select-option>
            <a-select-option :value="3">Archived</a-select-option>
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
        <a-button v-perm="'platform:rule:save'" type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>New Rule</a-button>
      </template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1050 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'severity'"><StatusTag :value="record.severity" :map="SEVERITY" /></template>
          <template v-else-if="column.dataIndex === 'status'"><StatusTag :value="record.status" :map="R_STATUS" /></template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'platform:rule:save'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-button v-if="record.status !== 1" v-perm="'platform:rule:publish'" type="link" size="small" style="color: var(--sap-success)" @click="publish(record, 'publish')">Publish</a-button>
              <a-button v-if="record.status === 1" v-perm="'platform:rule:publish'" type="link" size="small" @click="publish(record, 'unpublish')">Unpublish</a-button>
              <a-popconfirm title="Delete this rule?" @confirm="remove(record)">
                <a-button v-perm="'platform:rule:save'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" :title="editingId ? t('common.edit') : 'New Rule'" width="600px" :confirm-loading="saving" @ok="save">
      <a-form :label-col="{ style: { width: '90px' } }" style="margin-top: 12px">
        <a-form-item label="Title" required><a-input v-model:value="form.title" /></a-form-item>
        <a-form-item label="Category">
          <a-select v-model:value="form.category"><a-select-option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</a-select-option></a-select>
        </a-form-item>
        <a-form-item label="Severity">
          <a-select v-model:value="form.severity">
            <a-select-option :value="1">Critical</a-select-option>
            <a-select-option :value="2">High</a-select-option>
            <a-select-option :value="3">Medium</a-select-option>
            <a-select-option :value="4">Low</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Applies"><a-input v-model:value="form.applies" /></a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
