<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiVouchers, apiVoucherSave, apiVoucherDelete } from '@/api/promotion';

/** 代金券(Super Admin Portal 模块 05) */
const { t } = useI18n();

const V_STATUS: Record<number, StatusItem> = {
  1: { text: 'Active', color: 'success' }, 2: { text: 'Paused', color: 'warning' },
  3: { text: 'Expired', color: 'default' }, 4: { text: 'Scheduled', color: 'processing' },
  5: { text: 'Draft', color: 'default' },
};
const TYPES = ['fixed', 'percentage', 'free_night', 'upgrade'];

const { loading, list, query, load, search, reset, pagination } = useTable(apiVouchers, {
  keyword: '', status: undefined,
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: 'Name', dataIndex: 'name', ellipsis: true },
  { title: 'Type', dataIndex: 'voucher_type', width: 110 },
  { title: 'Value', dataIndex: 'value_display', width: 110 },
  { title: 'Qty', dataIndex: 'quantity', width: 90 },
  { title: 'Claimed', dataIndex: 'claimed', width: 90 },
  { title: 'Redeemed', dataIndex: 'redeemed', width: 90 },
  { title: 'Status', dataIndex: 'status', width: 110 },
  { title: t('common.action'), key: 'action_col', width: 130, fixed: 'right' as const },
]);

const modalOpen = ref(false);
const saving = ref(false);
const editingId = ref(0);
const form = reactive({
  name: '', voucherType: 'fixed', value: 0, valueDisplay: '', status: 1,
  startDate: '', endDate: '', quantity: 0, minSpend: 0, perUserLimit: 0, totalRedemptionLimit: 0,
  merchantScope: 'all', merchantCount: 0,
});
function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { name: '', voucherType: 'fixed', value: 0, valueDisplay: '', status: 1, startDate: '', endDate: '', quantity: 0, minSpend: 0, perUserLimit: 0, totalRedemptionLimit: 0, merchantScope: 'all', merchantCount: 0 });
  modalOpen.value = true;
}
function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    name: row.name, voucherType: row.voucher_type, value: Number(row.value ?? 0), valueDisplay: row.value_display ?? '',
    status: Number(row.status) || 1, startDate: row.start_date ?? '', endDate: row.end_date ?? '',
    quantity: Number(row.quantity ?? 0), minSpend: Number(row.min_spend ?? 0), perUserLimit: Number(row.per_user_limit ?? 0),
    totalRedemptionLimit: Number(row.total_redemption_limit ?? 0), merchantScope: row.merchant_scope ?? 'all', merchantCount: Number(row.merchant_count ?? 0),
  });
  modalOpen.value = true;
}
async function save(): Promise<void> {
  if (!form.name.trim()) { message.warning('Name is required'); return; }
  saving.value = true;
  try {
    await apiVoucherSave({ id: editingId.value || undefined, ...form });
    message.success(t('tip.saveSuccess'));
    modalOpen.value = false;
    await load();
  } finally { saving.value = false; }
}
async function remove(row: TableRow): Promise<void> {
  await apiVoucherDelete(row.id);
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
            <a-select-option :value="4">Scheduled</a-select-option>
            <a-select-option :value="5">Draft</a-select-option>
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
        <a-button v-perm="'marketing:voucher:save'" type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>New Voucher</a-button>
      </template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1050 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status'"><StatusTag :value="record.status" :map="V_STATUS" /></template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'marketing:voucher:save'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-popconfirm title="Delete this voucher?" @confirm="remove(record)">
                <a-button v-perm="'marketing:voucher:save'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" :title="editingId ? t('common.edit') : 'New Voucher'" width="640px" :confirm-loading="saving" @ok="save">
      <a-form :label-col="{ style: { width: '120px' } }" style="margin-top: 12px">
        <a-row :gutter="12">
          <a-col :span="12"><a-form-item label="Name" required><a-input v-model:value="form.name" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Type"><a-select v-model:value="form.voucherType"><a-select-option v-for="tp in TYPES" :key="tp" :value="tp">{{ tp }}</a-select-option></a-select></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Value"><a-input-number v-model:value="form.value" :min="0" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Display"><a-input v-model:value="form.valueDisplay" placeholder="e.g. MMK 100 OFF" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Start"><a-input v-model:value="form.startDate" placeholder="YYYY-MM-DD" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="End"><a-input v-model:value="form.endDate" placeholder="YYYY-MM-DD" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Quantity"><a-input-number v-model:value="form.quantity" :min="0" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Min Spend"><a-input-number v-model:value="form.minSpend" :min="0" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Per User Limit"><a-input-number v-model:value="form.perUserLimit" :min="0" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Total Redeem Limit"><a-input-number v-model:value="form.totalRedemptionLimit" :min="0" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12">
            <a-form-item label="Merchants">
              <a-select v-model:value="form.merchantScope"><a-select-option value="all">All</a-select-option><a-select-option value="selected">Selected</a-select-option></a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Status">
              <a-select v-model:value="form.status">
                <a-select-option :value="1">Active</a-select-option>
                <a-select-option :value="2">Paused</a-select-option>
                <a-select-option :value="4">Scheduled</a-select-option>
                <a-select-option :value="5">Draft</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
