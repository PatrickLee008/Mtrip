<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { DollarOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import {
  apiAffiliateWithdraws,
  apiAffiliateWithdrawPay,
  apiAffiliateCommissionLog,
  apiAffiliateWalletAdjust,
} from '@/api/affiliate';

/** 达人奖励钱包:提现审批 + 佣金流水 + 人工调整(Super Admin Portal 模块 06) */
const { t } = useI18n();

const activeTab = ref('withdraws');

const WD_STATUS: Record<number, StatusItem> = {
  1: { text: 'Pending', color: 'warning' },
  2: { text: 'Approved', color: 'processing' },
  3: { text: 'Paid', color: 'success' },
  4: { text: 'Rejected', color: 'error' },
};
const CL_STATUS: Record<number, StatusItem> = {
  1: { text: 'Pending', color: 'warning' },
  2: { text: 'Settled', color: 'success' },
  3: { text: 'Void', color: 'default' },
};

// 提现(destructure 以便模板自动解包 ref)
const {
  loading: wdLoading, list: wdList, query: wdQuery, load: wdLoad,
  search: wdSearch, reset: wdReset, pagination: wdPagination,
} = useTable(apiAffiliateWithdraws, { status: undefined, partnerId: undefined });
const wdColumns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: 'Partner', dataIndex: 'partner_id', width: 100 },
  { title: 'Amount', dataIndex: 'amount', width: 120 },
  { title: 'Status', dataIndex: 'status', width: 110 },
  { title: 'Requested', dataIndex: 'created_at', width: 170 },
  { title: 'Paid At', dataIndex: 'paid_at', width: 170 },
  { title: t('common.action'), key: 'action_col', width: 100, fixed: 'right' as const },
]);
async function pay(row: TableRow): Promise<void> {
  await apiAffiliateWithdrawPay(row.id);
  message.success('Marked as paid');
  await wdLoad();
}

// 佣金流水
const {
  loading: clLoading, list: clList, query: clQuery, load: clLoad,
  search: clSearch, reset: clReset, pagination: clPagination,
} = useTable(apiAffiliateCommissionLog, { status: undefined, partnerId: undefined });
const clColumns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: 'Partner', dataIndex: 'partner_id', width: 100 },
  { title: 'Amount', dataIndex: 'amount', width: 120 },
  { title: 'Rate', dataIndex: 'commission_rate', width: 90 },
  { title: 'Order', dataIndex: 'order_id', width: 110 },
  { title: 'Status', dataIndex: 'status', width: 110 },
  { title: 'Time', dataIndex: 'created_at', width: 170 },
]);

// 人工调整
const adjustOpen = ref(false);
const adjustSaving = ref(false);
const adjustForm = reactive({ partnerId: undefined as number | undefined, amount: 0 });
function openAdjust(): void {
  Object.assign(adjustForm, { partnerId: undefined, amount: 0 });
  adjustOpen.value = true;
}
async function doAdjust(): Promise<void> {
  if (!adjustForm.partnerId || adjustForm.amount === 0) {
    message.warning('Partner ID and non-zero amount required');
    return;
  }
  adjustSaving.value = true;
  try {
    await apiAffiliateWalletAdjust(adjustForm.partnerId, adjustForm.amount);
    message.success('Wallet adjusted');
    adjustOpen.value = false;
    await clLoad();
  } finally {
    adjustSaving.value = false;
  }
}

onMounted(() => {
  void wdLoad();
  void clLoad();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #extra>
        <a-button v-perm="'affiliate:wallet:adjust'" @click="openAdjust">
          <template #icon><DollarOutlined /></template>Manual Adjust
        </a-button>
      </template>
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="withdraws" tab="Withdrawals">
          <div style="margin-bottom: 12px">
            <a-space>
              <a-select v-model:value="wdQuery.status" allow-clear placeholder="All status" style="width: 150px">
                <a-select-option :value="1">Pending</a-select-option>
                <a-select-option :value="2">Approved</a-select-option>
                <a-select-option :value="3">Paid</a-select-option>
                <a-select-option :value="4">Rejected</a-select-option>
              </a-select>
              <a-button type="primary" @click="wdSearch">{{ t('common.search') }}</a-button>
              <a-button @click="wdReset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
            </a-space>
          </div>
          <a-table :columns="wdColumns" :data-source="wdList" :loading="wdLoading" :pagination="wdPagination" row-key="id" size="middle" :scroll="{ x: 900 }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'status'">
                <StatusTag :value="record.status" :map="WD_STATUS" />
              </template>
              <template v-else-if="column.dataIndex === 'paid_at'">{{ record.paid_at || '-' }}</template>
              <template v-else-if="column.key === 'action_col'">
                <a-popconfirm v-if="record.status === 1 || record.status === 2" title="Mark this withdrawal as paid?" @confirm="pay(record)">
                  <a-button v-perm="'affiliate:withdraw:pay'" type="link" size="small" style="color: var(--sap-success)">Pay</a-button>
                </a-popconfirm>
                <span v-else style="color: var(--sap-muted)">-</span>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="commission" tab="Commission Log">
          <div style="margin-bottom: 12px">
            <a-space>
              <a-select v-model:value="clQuery.status" allow-clear placeholder="All status" style="width: 150px">
                <a-select-option :value="1">Pending</a-select-option>
                <a-select-option :value="2">Settled</a-select-option>
                <a-select-option :value="3">Void</a-select-option>
              </a-select>
              <a-button type="primary" @click="clSearch">{{ t('common.search') }}</a-button>
              <a-button @click="clReset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
            </a-space>
          </div>
          <a-table :columns="clColumns" :data-source="clList" :loading="clLoading" :pagination="clPagination" row-key="id" size="middle" :scroll="{ x: 900 }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'commission_rate'">{{ record.commission_rate }}%</template>
              <template v-else-if="column.dataIndex === 'order_id'">{{ record.order_id || '-' }}</template>
              <template v-else-if="column.dataIndex === 'status'">
                <StatusTag :value="record.status" :map="CL_STATUS" />
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <a-modal v-model:open="adjustOpen" title="Manual Wallet Adjust" :confirm-loading="adjustSaving" @ok="doAdjust">
      <a-form :label-col="{ style: { width: '120px' } }" style="margin-top: 12px">
        <a-form-item label="Partner ID" required>
          <a-input-number v-model:value="adjustForm.partnerId" :min="1" style="width: 100%" />
        </a-form-item>
        <a-form-item label="Amount">
          <a-input-number v-model:value="adjustForm.amount" style="width: 100%" placeholder="Positive credit / negative deduct" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
