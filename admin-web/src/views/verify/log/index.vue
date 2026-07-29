<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { exportCsv } from '@/utils/export';
import { apiMerchantList } from '@/api/merchant';
import { apiVerifyLogs } from '@/api/order';

/**
 * 核销日志(核销管理菜单,只读):与订单菜单的核销记录同接口
 * 撤销核销操作在 订单管理→核销记录 页(perm order:verify:revoke)
 */
const { t } = useI18n();

const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const VERIFY_TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('order.verifyType.qrcode'),
  2: t('order.verifyType.manual'),
  3: t('order.verifyType.manual'),
}));
const STATUS_TEXT = computed<Record<number, string>>(() => ({
  1: t('common.success'),
  3: t('order.verifyLog.revoked'),
}));

const dateRange = ref<string[]>([]);

const { loading, list, query, load, search, reset, pagination } = useTable(
  (params) => apiVerifyLogs({
    ...params,
    startDate: dateRange.value?.[0],
    endDate: dateRange.value?.[1],
  }),
  { orderNo: '', merchantId: undefined, verifyType: undefined, status: undefined, siteId: 0 },
);

function doReset(): void {
  dateRange.value = [];
  reset();
}

onMounted(() => {
  void load();
});

const columns = [
  { title: t('order.orderNo'), dataIndex: 'order_no', width: 200 },
  { title: t('order.verify.code'), dataIndex: 'verify_code', width: 140 },
  { title: t('order.verifyLog.verifyType'), dataIndex: 'verify_type', width: 100 },
  { title: t('order.verifyLog.merchantId', 'Merchant ID'), dataIndex: 'merchant_id', width: 90 },
  { title: t('order.verifyLog.operator'), dataIndex: 'operator_name', width: 120, ellipsis: true },
  { title: t('order.status'), dataIndex: 'status', width: 90 },
  { title: t('order.verifyLog.revokeReason', 'Revoke Reason'), dataIndex: 'revoke_reason', ellipsis: true },
  { title: t('order.verifyLog.time'), dataIndex: 'created_at', width: 165 },
];

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

// ---------- CSV 导出(当前筛选前 2000 条) ----------
const exporting = ref(false);

async function exportLogs(): Promise<void> {
  exporting.value = true;
  try {
    const data = await apiVerifyLogs({
      ...query,
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
      page: 1,
      pageSize: 2000,
    });
    if (data.list.length === 0) {
      message.info(t('order.verifyLog.exportEmpty', 'No logs to export under current filter'));
      return;
    }
    const verifyTypeMap = VERIFY_TYPE_TEXT.value;
    const statusMap = STATUS_TEXT.value;
    exportCsv(
      t('order.verifyLog.exportFilename', `verify_logs_${new Date().toISOString().slice(0, 10)}`),
      [
        { title: t('order.orderNo'), key: 'order_no' },
        { title: t('order.verify.code'), key: 'verify_code' },
        { title: t('order.verifyLog.verifyType'), key: 'verify_type', format: (row: TableRow) => verifyTypeMap[row.verify_type] ?? row.verify_type },
        { title: t('order.verifyLog.merchantId', 'Merchant ID'), key: 'merchant_id' },
        { title: t('order.verifyLog.operator'), key: 'operator_name' },
        { title: t('order.status'), key: 'status', format: (row: TableRow) => statusMap[row.status] ?? row.status },
        { title: t('order.verifyLog.revokeReason', 'Revoke Reason'), key: 'revoke_reason' },
        { title: t('order.verifyLog.time'), key: 'created_at' },
      ],
      data.list,
    );
    message.success(t('order.verifyLog.exportSuccess', `Exported ${data.list.length} logs`).replace('{count}', String(data.list.length)));
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('order.orderNo')">
          <a-input v-model:value="query.orderNo" allow-clear :placeholder="t('common.pleaseInput', 'Exact match')" style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('merchant.list', 'Merchant')">
          <a-select
            v-model:value="query.merchantId"
            show-search
            allow-clear
            :placeholder="t('goods.common.searchMerchantPlaceholder')"
            style="width: 200px"
            :filter-option="false"
            :options="merchantOptions"
            :loading="merchantSearching"
            @search="searchMerchant"
          />
        </a-form-item>
        <a-form-item :label="t('order.verifyLog.verifyType')">
          <a-select v-model:value="query.verifyType" allow-clear :placeholder="t('common.all')" style="width: 120px">
            <a-select-option v-for="(text, key) in VERIFY_TYPE_TEXT" :key="key" :value="Number(key)">{{ text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('order.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 100px">
            <a-select-option :value="1">{{ t('common.success') }}</a-select-option>
            <a-select-option :value="3">{{ t('order.verifyLog.revoked', 'Revoked') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('order.verifyLog.time')">
          <a-range-picker v-model:value="dateRange" value-format="YYYY-MM-DD" style="width: 240px" />
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

    <a-card :bordered="false" class="mtrip-card-shadow" :title="t('order.verifyLog.title')">
      <template #extra>
        <a-button v-perm="'verify:log:export'" :loading="exporting" @click="exportLogs">
          <template #icon><DownloadOutlined /></template>{{ t('common.export') }}CSV
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1200 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'verify_type'">
            <a-tag :color="record.verify_type === 3 ? 'blue' : 'default'">{{ VERIFY_TYPE_TEXT[record.verify_type] ?? '-' }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ STATUS_TEXT[record.status] ?? '-' }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'revoke_reason'">{{ record.revoke_reason || '-' }}</template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
