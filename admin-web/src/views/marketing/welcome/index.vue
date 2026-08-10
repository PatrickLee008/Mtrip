<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiWelcomes, apiWelcomeSave, apiWelcomeDelete } from '@/api/promotion';

/** 新客欢迎奖励(Super Admin Portal 模块 05) */
const { t } = useI18n();

const W_STATUS: Record<number, StatusItem> = {
  1: { text: 'Active', color: 'success' }, 2: { text: 'Paused', color: 'warning' }, 3: { text: 'Draft', color: 'default' },
};
const REWARD_TYPES = ['new_user', 'first_booking', 'registration'];
const DISCOUNT_TYPES = ['percentage', 'fixed', 'free_night', 'cashback'];

const { loading, list, query, load, search, reset, pagination } = useTable(apiWelcomes, {
  keyword: '', status: undefined,
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: 'Name', dataIndex: 'name', ellipsis: true },
  { title: 'Reward Type', dataIndex: 'reward_type', width: 130 },
  { title: 'Discount', dataIndex: 'discount_display', width: 120 },
  { title: 'Validity', dataIndex: 'validity_days', width: 100 },
  { title: 'Used', dataIndex: 'usage_count', width: 90 },
  { title: 'Converted', dataIndex: 'new_users_converted', width: 110 },
  { title: 'Status', dataIndex: 'status', width: 100 },
  { title: t('common.action'), key: 'action_col', width: 130, fixed: 'right' as const },
]);

const modalOpen = ref(false);
const saving = ref(false);
const editingId = ref(0);
const form = reactive({
  name: '', rewardType: 'new_user', discountType: 'fixed', discountValue: 0, discountDisplay: '',
  status: 1, validityDays: 30, usageLimit: 0, minSpend: 0,
});
function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { name: '', rewardType: 'new_user', discountType: 'fixed', discountValue: 0, discountDisplay: '', status: 1, validityDays: 30, usageLimit: 0, minSpend: 0 });
  modalOpen.value = true;
}
function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    name: row.name, rewardType: row.reward_type, discountType: row.discount_type, discountValue: Number(row.discount_value ?? 0),
    discountDisplay: row.discount_display ?? '', status: Number(row.status) || 1, validityDays: Number(row.validity_days ?? 30),
    usageLimit: Number(row.usage_limit ?? 0), minSpend: Number(row.min_spend ?? 0),
  });
  modalOpen.value = true;
}
async function save(): Promise<void> {
  if (!form.name.trim()) { message.warning('Name is required'); return; }
  saving.value = true;
  try {
    await apiWelcomeSave({ id: editingId.value || undefined, ...form });
    message.success(t('tip.saveSuccess'));
    modalOpen.value = false;
    await load();
  } finally { saving.value = false; }
}
async function remove(row: TableRow): Promise<void> {
  await apiWelcomeDelete(row.id);
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
        <a-form-item label="Status">
          <a-select v-model:value="query.status" allow-clear placeholder="All" style="width: 130px">
            <a-select-option :value="1">Active</a-select-option>
            <a-select-option :value="2">Paused</a-select-option>
            <a-select-option :value="3">Draft</a-select-option>
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
        <a-button v-perm="'marketing:welcome:save'" type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>New Reward</a-button>
      </template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1050 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status'"><StatusTag :value="record.status" :map="W_STATUS" /></template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'marketing:welcome:save'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-popconfirm title="Delete this reward?" @confirm="remove(record)">
                <a-button v-perm="'marketing:welcome:save'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" :title="editingId ? t('common.edit') : 'New Welcome Reward'" width="600px" :confirm-loading="saving" @ok="save">
      <a-form :label-col="{ style: { width: '110px' } }" style="margin-top: 12px">
        <a-form-item label="Name" required><a-input v-model:value="form.name" /></a-form-item>
        <a-row :gutter="12">
          <a-col :span="12"><a-form-item label="Reward Type"><a-select v-model:value="form.rewardType"><a-select-option v-for="r in REWARD_TYPES" :key="r" :value="r">{{ r }}</a-select-option></a-select></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Discount Type"><a-select v-model:value="form.discountType"><a-select-option v-for="d in DISCOUNT_TYPES" :key="d" :value="d">{{ d }}</a-select-option></a-select></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Value"><a-input-number v-model:value="form.discountValue" :min="0" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Display"><a-input v-model:value="form.discountDisplay" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Validity Days"><a-input-number v-model:value="form.validityDays" :min="0" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Usage Limit"><a-input-number v-model:value="form.usageLimit" :min="0" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Min Spend"><a-input-number v-model:value="form.minSpend" :min="0" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12">
            <a-form-item label="Status">
              <a-select v-model:value="form.status">
                <a-select-option :value="1">Active</a-select-option>
                <a-select-option :value="2">Paused</a-select-option>
                <a-select-option :value="3">Draft</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
