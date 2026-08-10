<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiAffiliateCodes, apiAffiliateCodeSave, apiAffiliateCodeDelete } from '@/api/affiliate';

/** 联盟折扣码(Super Admin Portal 模块 06) */
const { t } = useI18n();

const C_STATUS: Record<number, StatusItem> = {
  1: { text: 'Active', color: 'success' },
  2: { text: 'Paused', color: 'warning' },
  3: { text: 'Expired', color: 'default' },
  4: { text: 'Draft', color: 'processing' },
};
const PROMO_TYPES = ['percentage', 'fixed', 'free_night', 'cashback'];

const { loading, list, query, load, search, reset, pagination } = useTable(apiAffiliateCodes, {
  keyword: '',
  status: undefined,
  partnerId: undefined,
});

const columns = computed(() => [
  { title: 'Code', dataIndex: 'code', width: 130 },
  { title: 'Partner', dataIndex: 'partner_name', width: 170, ellipsis: true },
  { title: 'Type', dataIndex: 'promotion_type', width: 110 },
  { title: 'Discount', dataIndex: 'discount_display', width: 120 },
  { title: 'Usage', dataIndex: 'usage_count', width: 120 },
  { title: 'Revenue', dataIndex: 'revenue', width: 110 },
  { title: 'Status', dataIndex: 'status', width: 100 },
  { title: t('common.action'), key: 'action_col', width: 140, fixed: 'right' as const },
]);

const modalOpen = ref(false);
const saving = ref(false);
const editingId = ref(0);
const form = reactive({
  partnerId: undefined as number | undefined,
  code: '',
  promotionType: 'percentage',
  discountValue: 0,
  discountDisplay: '',
  startDate: '',
  endDate: '',
  usageLimit: 0,
  perUserLimit: 0,
  minSpend: 0,
  eligibleMerchants: 'all',
  merchantCount: 0,
  commissionRate: 5,
  status: 1,
});

function resetForm(): void {
  Object.assign(form, {
    partnerId: undefined, code: '', promotionType: 'percentage', discountValue: 0, discountDisplay: '',
    startDate: '', endDate: '', usageLimit: 0, perUserLimit: 0, minSpend: 0,
    eligibleMerchants: 'all', merchantCount: 0, commissionRate: 5, status: 1,
  });
}
function openCreate(): void {
  editingId.value = 0;
  resetForm();
  modalOpen.value = true;
}
function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    partnerId: row.partner_id,
    code: row.code,
    promotionType: row.promotion_type,
    discountValue: Number(row.discount_value ?? 0),
    discountDisplay: row.discount_display ?? '',
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? '',
    usageLimit: Number(row.usage_limit ?? 0),
    perUserLimit: Number(row.per_user_limit ?? 0),
    minSpend: Number(row.min_spend ?? 0),
    eligibleMerchants: row.eligible_merchants ?? 'all',
    merchantCount: Number(row.merchant_count ?? 0),
    commissionRate: Number(row.commission_rate ?? 5),
    status: Number(row.status ?? 1),
  });
  modalOpen.value = true;
}
async function save(): Promise<void> {
  if (!form.partnerId) {
    message.warning('Partner ID is required');
    return;
  }
  if (!editingId.value && !form.code.trim()) {
    message.warning('Code is required');
    return;
  }
  saving.value = true;
  try {
    await apiAffiliateCodeSave({ id: editingId.value || undefined, ...form });
    message.success(t('tip.saveSuccess'));
    modalOpen.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}
async function remove(row: TableRow): Promise<void> {
  await apiAffiliateCodeDelete(row.id);
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
        <a-form-item label="Keyword">
          <a-input v-model:value="query.keyword" allow-clear placeholder="Code / partner" style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="Status">
          <a-select v-model:value="query.status" allow-clear placeholder="All" style="width: 130px">
            <a-select-option :value="1">Active</a-select-option>
            <a-select-option :value="2">Paused</a-select-option>
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
        <a-button v-perm="'affiliate:code:save'" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>New Code
        </a-button>
      </template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1100 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'usage_count'">{{ record.usage_count }} / {{ record.usage_limit || '∞' }}</template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="C_STATUS" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'affiliate:code:save'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-popconfirm title="Delete this code?" @confirm="remove(record)">
                <a-button v-perm="'affiliate:code:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" :title="editingId ? t('common.edit') : 'New Affiliate Code'" width="640px" :confirm-loading="saving" @ok="save">
      <a-form :label-col="{ style: { width: '120px' } }" style="margin-top: 12px">
        <a-row :gutter="12">
          <a-col :span="12"><a-form-item label="Partner ID" required><a-input-number v-model:value="form.partnerId" :min="1" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Code" :required="!editingId"><a-input v-model:value="form.code" :disabled="!!editingId" /></a-form-item></a-col>
          <a-col :span="12">
            <a-form-item label="Type">
              <a-select v-model:value="form.promotionType">
                <a-select-option v-for="p in PROMO_TYPES" :key="p" :value="p">{{ p }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12"><a-form-item label="Discount Value"><a-input-number v-model:value="form.discountValue" :min="0" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Display"><a-input v-model:value="form.discountDisplay" placeholder="e.g. 20% OFF" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Commission %"><a-input-number v-model:value="form.commissionRate" :min="0" :max="100" :step="0.5" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Start Date"><a-input v-model:value="form.startDate" placeholder="YYYY-MM-DD" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="End Date"><a-input v-model:value="form.endDate" placeholder="YYYY-MM-DD" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Usage Limit"><a-input-number v-model:value="form.usageLimit" :min="0" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Per User Limit"><a-input-number v-model:value="form.perUserLimit" :min="0" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Min Spend"><a-input-number v-model:value="form.minSpend" :min="0" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12">
            <a-form-item label="Merchants">
              <a-select v-model:value="form.eligibleMerchants">
                <a-select-option value="all">All</a-select-option>
                <a-select-option value="selected">Selected</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Status">
              <a-select v-model:value="form.status">
                <a-select-option :value="1">Active</a-select-option>
                <a-select-option :value="2">Paused</a-select-option>
                <a-select-option :value="4">Draft</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
