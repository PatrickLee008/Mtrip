<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { DownloadOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { exportCsv } from '@/utils/export';
import { formatAmount } from '@/utils/format';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiMerchantList } from '@/api/merchant';
import { apiFlowAdjust, apiFlowList } from '@/api/finance';

/**
 * 资金流水(文档 6.4.5):流水查询 + 手动调账 + CSV 导出
 * flow_type 1收入 2支出 3转账 4冻结 5解冻;biz_type 5=手动调账
 */
const { t } = useI18n();
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const FLOW_TYPE_MAP = computed<Record<number, StatusItem>>(() => ({
  1: { text: t('finance.flowPage.typeIncome'), color: 'success' },
  2: { text: t('finance.flowPage.typeExpense'), color: 'error' },
  3: { text: t('finance.flowPage.typeTransfer'), color: 'processing' },
  4: { text: t('finance.flowPage.typeFreeze'), color: 'warning' },
  5: { text: t('finance.flowPage.typeUnfreeze'), color: 'cyan' },
}));
const BIZ_TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('finance.flowPage.bizTypeOrder'),
  2: t('finance.flowPage.bizTypeRefund'),
  3: t('finance.flowPage.bizTypeWithdraw'),
  4: t('finance.flowPage.bizTypeSettle'),
  5: t('finance.flowPage.bizTypeAdjust'),
}));
const FLOW_STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  1: { text: t('status.success'), color: 'success' },
  2: { text: t('status.processing'), color: 'processing' },
  3: { text: t('status.failed'), color: 'error' },
}));

const createdRange = ref<string[]>([]);

const { loading, list, query, load, search, reset, pagination } = useTable(
  (params) => apiFlowList({
    ...params,
    startDate: createdRange.value?.[0],
    endDate: createdRange.value?.[1],
  }),
  { flowNo: '', flowType: undefined, bizType: undefined, flowStatus: undefined, merchantId: undefined, siteId: 0 },
);

function doReset(): void {
  createdRange.value = [];
  reset();
}

const columns = computed(() => [
  { title: t('finance.flowPage.flowNo'), dataIndex: 'flow_no', width: 190 },
  { title: t('finance.flowPage.type'), dataIndex: 'flow_type', width: 80 },
  { title: t('finance.flowPage.bizType'), dataIndex: 'biz_type', width: 100 },
  { title: t('finance.flowPage.amount'), dataIndex: 'amount', width: 110 },
  { title: t('finance.msettlePage.merchant'), dataIndex: 'merchant_id', width: 90 },
  { title: t('common.id'), dataIndex: 'order_id', width: 90 },
  { title: t('finance.flowPage.flowNo'), dataIndex: 'trade_no', width: 180, ellipsis: true },
  { title: t('common.status'), dataIndex: 'flow_status', width: 80 },
  { title: t('common.remark'), dataIndex: 'remark', ellipsis: true },
  { title: t('finance.flowPage.time'), dataIndex: 'created_at', width: 165 },
]);

// ---------- 商户远程搜索 ----------
const merchantOptions = ref<{ label: string; value: number }[]>([]);
const merchantSearching = ref(false);

async function searchMerchant(keyword: string): Promise<void> {
  merchantSearching.value = true;
  try {
    const data = await apiMerchantList({ merchantName: keyword, page: 1, pageSize: 20 });
    merchantOptions.value = data.list.map((row: TableRow) => ({
      label: `#${row.id} ${row.merchant_name}`,
      value: row.id,
    }));
  } finally {
    merchantSearching.value = false;
  }
}

// ---------- 手动调账 Modal ----------
const adjustOpen = ref(false);
const adjustSubmitting = ref(false);
const adjustForm = reactive({ flowType: 1, amount: 0, merchantId: undefined as number | undefined, siteId: 0, remark: '' });

function openAdjust(): void {
  adjustForm.flowType = 1;
  adjustForm.amount = 0;
  adjustForm.merchantId = undefined;
  adjustForm.siteId = 0;
  adjustForm.remark = '';
  adjustOpen.value = true;
}

async function submitAdjust(): Promise<void> {
  if (adjustForm.amount <= 0) {
    message.warning(t('finance.flowPage.adjustModal.inputReason'));
    return;
  }
  if (!adjustForm.remark.trim()) {
    message.warning(t('finance.flowPage.adjustModal.inputReason'));
    return;
  }
  if (isSuper && adjustForm.siteId <= 0) {
    message.warning(t('common.pleaseSelect'));
    return;
  }
  adjustSubmitting.value = true;
  try {
    await apiFlowAdjust({
      flowType: adjustForm.flowType,
      amount: adjustForm.amount,
      remark: adjustForm.remark.trim(),
      merchantId: adjustForm.merchantId,
      siteId: isSuper ? adjustForm.siteId : undefined,
    });
    message.success(t('finance.flowPage.adjustModal.success'));
    adjustOpen.value = false;
    void load();
  } finally {
    adjustSubmitting.value = false;
  }
}

// ---------- CSV 导出(当前筛选前 2000 条) ----------
const exporting = ref(false);

async function exportFlows(): Promise<void> {
  exporting.value = true;
  try {
    const data = await apiFlowList({
      ...query,
      startDate: createdRange.value?.[0],
      endDate: createdRange.value?.[1],
      page: 1,
      pageSize: 2000,
    });
    if (data.list.length === 0) {
      message.info(t('common.noData'));
      return;
    }
    exportCsv(
      `${t('finance.flowPage.title')}_${new Date().toISOString().slice(0, 10)}`,
      [
        { title: t('finance.flowPage.flowNo'), key: 'flow_no' },
        { title: t('finance.flowPage.type'), key: 'flow_type', format: (row: TableRow) => FLOW_TYPE_MAP.value[row.flow_type]?.text ?? row.flow_type },
        { title: t('finance.flowPage.bizType'), key: 'biz_type', format: (row: TableRow) => BIZ_TYPE_TEXT.value[row.biz_type] ?? row.biz_type },
        { title: t('finance.flowPage.amount'), key: 'amount' },
        { title: t('finance.msettlePage.merchant'), key: 'merchant_id' },
        { title: t('common.id'), key: 'order_id' },
        { title: t('finance.flowPage.flowNo'), key: 'trade_no' },
        { title: t('common.status'), key: 'flow_status', format: (row: TableRow) => FLOW_STATUS_MAP.value[row.flow_status]?.text ?? row.flow_status },
        { title: t('common.remark'), key: 'remark' },
        { title: t('finance.flowPage.time'), key: 'created_at' },
      ],
      data.list,
    );
    message.success(`${t('common.export')}: ${data.list.length}`);
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('finance.flowPage.flowNo')">
          <a-input v-model:value="query.flowNo" allow-clear :placeholder="t('common.pleaseInput')" style="width: 190px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('finance.flowPage.type')">
          <a-select v-model:value="query.flowType" allow-clear :placeholder="t('common.all')" style="width: 90px">
            <a-select-option v-for="(item, key) in FLOW_TYPE_MAP" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('finance.flowPage.bizType')">
          <a-select v-model:value="query.bizType" allow-clear :placeholder="t('common.all')" style="width: 120px">
            <a-select-option v-for="(text, key) in BIZ_TYPE_TEXT" :key="key" :value="Number(key)">{{ text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select v-model:value="query.flowStatus" allow-clear :placeholder="t('common.all')" style="width: 100px">
            <a-select-option v-for="(item, key) in FLOW_STATUS_MAP" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('finance.msettlePage.merchant')">
          <a-select
            v-model:value="query.merchantId"
            show-search
            allow-clear
            :placeholder="t('common.pleaseInput')"
            style="width: 180px"
            :filter-option="false"
            :options="merchantOptions"
            :loading="merchantSearching"
            @search="searchMerchant"
          />
        </a-form-item>
        <a-form-item :label="t('finance.flowPage.filter.timeRange')">
          <a-range-picker v-model:value="createdRange" value-format="YYYY-MM-DD" style="width: 240px" />
        </a-form-item>
        <a-form-item v-if="isSuper" :label="t('common.site')">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="doReset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" :title="t('finance.flowPage.title')">
      <template #extra>
        <a-space>
          <a-button v-perm="'finance:flow:adjust'" type="primary" @click="openAdjust">
            <template #icon><PlusOutlined /></template>{{ t('finance.flowPage.actions.adjust') }}
          </a-button>
          <a-button v-perm="'finance:flow:export'" :loading="exporting" @click="exportFlows">
            <template #icon><DownloadOutlined /></template>{{ t('common.export') }}CSV
          </a-button>
        </a-space>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1500 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'flow_type'">
            <StatusTag :value="record.flow_type" :map="FLOW_TYPE_MAP" />
          </template>
          <template v-else-if="column.dataIndex === 'biz_type'">{{ BIZ_TYPE_TEXT[record.biz_type] ?? '-' }}</template>
          <template v-else-if="column.dataIndex === 'amount'">
            <span :style="{ color: record.flow_type === 2 ? 'var(--mtrip-error, #ff4d4f)' : 'var(--mtrip-success, #52c41a)', fontWeight: 600 }">
              {{ record.flow_type === 2 ? '-' : '+' }}{{ formatAmount(record.amount) }}
            </span>
          </template>
          <template v-else-if="column.dataIndex === 'merchant_id'">{{ record.merchant_id || '-' }}</template>
          <template v-else-if="column.dataIndex === 'order_id'">{{ record.order_id || '-' }}</template>
          <template v-else-if="column.dataIndex === 'trade_no'">{{ record.trade_no || '-' }}</template>
          <template v-else-if="column.dataIndex === 'flow_status'">
            <StatusTag :value="record.flow_status" :map="FLOW_STATUS_MAP" />
          </template>
          <template v-else-if="column.dataIndex === 'remark'">{{ record.remark || '-' }}</template>
        </template>
      </a-table>
    </a-card>

    <!-- 手动调账 Modal -->
    <a-modal v-model:open="adjustOpen" :title="t('finance.flowPage.adjustModal.title')" :confirm-loading="adjustSubmitting" @ok="submitAdjust">
      <a-alert type="warning" show-icon :message="t('finance.flowPage.adjustModal.notice')" style="margin-bottom: 16px" />
      <a-form :label-col="{ span: 6 }">
        <a-form-item :label="t('finance.flowPage.adjustModal.type')" required>
          <a-radio-group v-model:value="adjustForm.flowType">
            <a-radio :value="1">{{ t('finance.flowPage.typeIncome') }}</a-radio>
            <a-radio :value="2">{{ t('finance.flowPage.typeExpense') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('finance.flowPage.amount')" required>
          <a-input-number v-model:value="adjustForm.amount" :min="0.01" :precision="2" style="width: 200px" />
        </a-form-item>
        <a-form-item :label="t('finance.flowPage.adjustModal.target')">
          <a-select
            v-model:value="adjustForm.merchantId"
            show-search
            allow-clear
            :placeholder="t('common.pleaseSelect')"
            style="width: 240px"
            :filter-option="false"
            :options="merchantOptions"
            :loading="merchantSearching"
            @search="searchMerchant"
          />
        </a-form-item>
        <a-form-item v-if="isSuper" :label="t('common.site')" required>
          <SiteTreeSelect v-model:value="adjustForm.siteId" style="width: 240px" />
        </a-form-item>
        <a-form-item :label="t('finance.flowPage.adjustModal.reason')" required>
          <a-textarea v-model:value="adjustForm.remark" :rows="3" :maxlength="500" :placeholder="t('common.required')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
