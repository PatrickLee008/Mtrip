<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { type TableRow } from '@/composables/useTable';
import { apiMerchantAccounts, apiMerchantAccountSave, apiMerchantList } from '@/api/merchant';

const { t } = useI18n();

/** 商户账户:按商户查看/维护结算账户(账号加密存储,列表脱敏) */
const merchantOptions = ref<{ label: string; value: number }[]>([]);
const merchantId = ref<number>();
const searching = ref(false);

async function searchMerchant(keyword: string): Promise<void> {
  searching.value = true;
  try {
    const data = await apiMerchantList({ merchantName: keyword, page: 1, pageSize: 20 });
    merchantOptions.value = data.list.map((row: TableRow) => ({
      label: `#${row.id} ${row.merchant_name}`,
      value: row.id,
    }));
  } finally {
    searching.value = false;
  }
}

// ---------- 账户列表 ----------
const loading = ref(false);
const accounts = ref<TableRow[]>([]);

async function loadAccounts(): Promise<void> {
  if (!merchantId.value) {
    accounts.value = [];
    return;
  }
  loading.value = true;
  try {
    accounts.value = await apiMerchantAccounts(merchantId.value);
  } finally {
    loading.value = false;
  }
}

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('common.name'), dataIndex: 'bank_name' },
  { title: t('user.realName'), dataIndex: 'account_name' },
  { title: t('common.masked'), dataIndex: 'account_no' },
  { title: 'SWIFT', dataIndex: 'swift_code', width: 110 },
  { title: t('common.type'), dataIndex: 'currency', width: 80 },
  { title: t('common.all'), dataIndex: 'is_default', width: 70 },
  { title: t('common.remark'), dataIndex: 'remark', ellipsis: true },
  { title: t('common.action'), key: 'action_col', width: 90 },
]);

// ---------- 新增/编辑 ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  bankName: '',
  accountName: '',
  accountNo: '',
  swiftCode: '',
  currency: 'EUR',
  isDefault: 0,
  remark: '',
});

function openCreate(): void {
  if (!merchantId.value) {
    message.warning(t('merchant.accountPage.merchant'));
    return;
  }
  editingId.value = 0;
  Object.assign(form, { bankName: '', accountName: '', accountNo: '', swiftCode: '', currency: 'EUR', isDefault: 0, remark: '' });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    bankName: row.bank_name ?? '',
    accountName: row.account_name ?? '',
    // 账号加密存储,留空表示保留原值
    accountNo: '',
    swiftCode: row.swift_code ?? '',
    currency: row.currency ?? 'EUR',
    isDefault: row.is_default ?? 0,
    remark: row.remark ?? '',
  });
  modalOpen.value = true;
}

async function saveAccount(): Promise<void> {
  if (!form.bankName.trim() || !form.accountName.trim()) {
    message.warning(t('common.required'));
    return;
  }
  if (!editingId.value && !form.accountNo.trim()) {
    message.warning(t('common.required'));
    return;
  }
  modalSaving.value = true;
  try {
    await apiMerchantAccountSave({ merchantId: merchantId.value, id: editingId.value || undefined, ...form });
    message.success(t('tip.saveSuccess'));
    modalOpen.value = false;
    await loadAccounts();
  } finally {
    modalSaving.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('merchant.accountPage.merchant')">
          <a-select
            v-model:value="merchantId"
            show-search
            :filter-option="false"
            :options="merchantOptions"
            :loading="searching"
            :placeholder="t('common.pleaseInput')"
            style="width: 320px"
            @search="searchMerchant"
            @change="loadAccounts"
          />
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>{{ t('merchant.accountPage.title') }}</template>
      <template #extra>
        <a-button v-perm="'merchant:account:edit'" type="primary" :disabled="!merchantId" @click="openCreate">
          <template #icon><PlusOutlined /></template>{{ t('common.add') }}
        </a-button>
      </template>
      <a-table :columns="columns" :data-source="accounts" :loading="loading" row-key="id" size="middle" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'is_default'">
            <a-tag v-if="record.is_default === 1" color="success">{{ t('common.confirm') }}</a-tag>
            <span v-else>-</span>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-button v-perm="'merchant:account:edit'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
          </template>
        </template>
      </a-table>
      <a-empty v-if="!merchantId" :description="t('common.pleaseSelect')" style="margin: 40px 0" />
    </a-card>

    <!-- 新增/编辑账户 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('common.edit') : t('common.add')"
      width="520px"
      :confirm-loading="modalSaving"
      @ok="saveAccount"
    >
      <a-form :label-col="{ style: { width: '90px' } }" style="margin-top: 16px">
        <a-form-item :label="t('common.name')" required>
          <a-input v-model:value="form.bankName" />
        </a-form-item>
        <a-form-item :label="t('user.realName')" required>
          <a-input v-model:value="form.accountName" />
        </a-form-item>
        <a-form-item :label="t('common.code')" :required="!editingId">
          <a-input v-model:value="form.accountNo" :placeholder="editingId ? t('common.optional') : ''" />
        </a-form-item>
        <a-form-item label="SWIFT">
          <a-input v-model:value="form.swiftCode" :placeholder="t('common.pleaseInput')" />
        </a-form-item>
        <a-form-item :label="t('common.type')">
          <a-select v-model:value="form.currency">
            <a-select-option v-for="code in ['EUR', 'USD', 'GBP', 'CHF', 'CNY']" :key="code" :value="code">{{ code }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('common.confirm')">
          <a-radio-group v-model:value="form.isDefault">
            <a-radio :value="0">{{ t('common.no') }}</a-radio>
            <a-radio :value="1">{{ t('common.yes') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('common.remark')">
          <a-input v-model:value="form.remark" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
