<script setup lang="ts">
import { reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { type TableRow } from '@/composables/useTable';
import { apiMerchantAccounts, apiMerchantAccountSave, apiMerchantList } from '@/api/merchant';

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

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '开户行', dataIndex: 'bank_name' },
  { title: '户名', dataIndex: 'account_name' },
  { title: '账号(脱敏)', dataIndex: 'account_no' },
  { title: 'SWIFT', dataIndex: 'swift_code', width: 110 },
  { title: '币种', dataIndex: 'currency', width: 80 },
  { title: '默认', dataIndex: 'is_default', width: 70 },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
  { title: '操作', key: 'action_col', width: 90 },
];

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
    message.warning('请先选择商户');
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
    message.warning('请填写开户行与户名');
    return;
  }
  if (!editingId.value && !form.accountNo.trim()) {
    message.warning('新增账户必须填写账号');
    return;
  }
  modalSaving.value = true;
  try {
    await apiMerchantAccountSave({ merchantId: merchantId.value, id: editingId.value || undefined, ...form });
    message.success('结算账户已保存');
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
        <a-form-item label="选择商户">
          <a-select
            v-model:value="merchantId"
            show-search
            :filter-option="false"
            :options="merchantOptions"
            :loading="searching"
            placeholder="输入商户名称搜索"
            style="width: 320px"
            @search="searchMerchant"
            @change="loadAccounts"
          />
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>结算账户</template>
      <template #extra>
        <a-button v-perm="'merchant:account:edit'" type="primary" :disabled="!merchantId" @click="openCreate">
          <template #icon><PlusOutlined /></template>新增账户
        </a-button>
      </template>
      <a-table :columns="columns" :data-source="accounts" :loading="loading" row-key="id" size="middle" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'is_default'">
            <a-tag v-if="record.is_default === 1" color="success">默认</a-tag>
            <span v-else>-</span>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-button v-perm="'merchant:account:edit'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
          </template>
        </template>
      </a-table>
      <a-empty v-if="!merchantId" description="请先选择商户" style="margin: 40px 0" />
    </a-card>

    <!-- 新增/编辑账户 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑结算账户' : '新增结算账户'"
      width="520px"
      :confirm-loading="modalSaving"
      @ok="saveAccount"
    >
      <a-form :label-col="{ style: { width: '90px' } }" style="margin-top: 16px">
        <a-form-item label="开户行" required>
          <a-input v-model:value="form.bankName" />
        </a-form-item>
        <a-form-item label="户名" required>
          <a-input v-model:value="form.accountName" />
        </a-form-item>
        <a-form-item label="账号" :required="!editingId">
          <a-input v-model:value="form.accountNo" :placeholder="editingId ? '留空保留原值' : ''" />
        </a-form-item>
        <a-form-item label="SWIFT">
          <a-input v-model:value="form.swiftCode" placeholder="国际汇款代码" />
        </a-form-item>
        <a-form-item label="币种">
          <a-select v-model:value="form.currency">
            <a-select-option v-for="code in ['EUR', 'USD', 'GBP', 'CHF', 'CNY']" :key="code" :value="code">{{ code }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="设为默认">
          <a-radio-group v-model:value="form.isDefault">
            <a-radio :value="0">否</a-radio>
            <a-radio :value="1">是(互斥,其余账户自动取消默认)</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="form.remark" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
