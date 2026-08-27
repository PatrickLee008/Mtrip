<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
const route = useRoute();
import { message } from 'ant-design-vue';
import { CheckCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag, { type StatusItem } from '@/components/StatusTag.vue';
import AmountText from '@/components/AmountText.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { apiOrderDetail, apiOrderList, apiOrderVerify } from '@/api/order';

/** 订单核销:列表筛选 / 详情(含核销日志) / 手工核销(按核销码或订单);数据范围由后端按主体裁剪 */
const { t } = useI18n();

const dateRange = ref<string[]>([]);

const { loading, list, query, load, search, reset, pagination } = useTable(
  (params) => apiOrderList({ ...params, startDate: dateRange.value?.[0], endDate: dateRange.value?.[1] }),
  { orderNo: '', orderType: undefined, orderStatus: undefined, contactName: '' },
);

function doReset(): void {
  dateRange.value = [];
  reset();
}

const ORDER_STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('order.statusMap.unpaid'), color: 'warning' },
  1: { text: t('order.statusMap.paid'), color: 'processing' },
  2: { text: t('order.statusMap.used'), color: 'success' },
  3: { text: t('order.statusMap.completed'), color: 'success' },
  4: { text: t('order.statusMap.cancelled'), color: 'default' },
  5: { text: t('order.statusMap.refunding'), color: 'warning' },
  6: { text: t('order.statusMap.refunded'), color: 'error' },
  7: { text: t('order.statusMap.expired'), color: 'default' },
}));

const columns = [
  { title: t('order.orderNo'), dataIndex: 'order_no', width: 200 },
  { title: t('order.goodsName'), dataIndex: 'goods_name', width: 180, ellipsis: true },
  { title: t('order.buyer'), dataIndex: 'contact_name', width: 110 },
  { title: t('order.phone'), dataIndex: 'contact_phone', width: 130 },
  { title: t('order.amount'), dataIndex: 'pay_amount', width: 110 },
  { title: t('order.orderStatus'), dataIndex: 'order_status', width: 100 },
  { title: t('order.verifyCode'), dataIndex: 'verify_code', width: 140 },
  { title: t('order.createdAt'), dataIndex: 'created_at', width: 160 },
  { title: t('common.operation'), key: 'action', width: 160, fixed: 'right' as const },
];

// ---------- 手工核销(按核销码) ----------
const verifyCode = ref('');
const verifying = ref(false);

async function verifyByCode(): Promise<void> {
  const code = verifyCode.value.trim();
  if (!code) {
    message.warning(t('order.verifyCode') + t('common.required'));
    return;
  }
  verifying.value = true;
  try {
    await apiOrderVerify({ verifyCode: code });
    message.success(t('common.opSuccess'));
    verifyCode.value = '';
    void load();
  } finally {
    verifying.value = false;
  }
}

async function verifyByRow(row: TableRow): Promise<void> {
  await apiOrderVerify({ id: row.id });
  message.success(t('common.opSuccess'));
  void load();
}

// ---------- 详情 ----------
const detailOpen = ref(false);
const detailLoading = ref(false);
const detailOrder = ref<TableRow | null>(null);
const verifyLogs = ref<TableRow[]>([]);
const logColumns = [
  { title: t('order.verifyLogTime'), dataIndex: 'created_at', width: 160 },
  { title: t('order.verifyOperator'), dataIndex: 'operator_name', ellipsis: true },
];

async function openDetail(row: TableRow): Promise<void> {
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    const data = await apiOrderDetail(row.id);
    detailOrder.value = data.order;
    verifyLogs.value = data.verifyLogs ?? [];
  } finally {
    detailLoading.value = false;
  }
}

watch(() => route.query.notificationTarget, (value) => {
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) void openDetail({ id: Number(value) });
}, { immediate: true });
onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <!-- 手工核销 -->
    <a-card :bordered="false" class="mtrip-card-shadow" :title="t('order.verify')" style="margin-bottom: 16px">
      <a-space>
        <a-input
          v-model:value="verifyCode"
          allow-clear
          :placeholder="t('order.verifyCode')"
          style="width: 360px"
          @press-enter="verifyByCode"
        />
        <a-button v-perm="'mch:order:verify'" type="primary" :loading="verifying" @click="verifyByCode">
          <template #icon><CheckCircleOutlined /></template>{{ t('order.verify') }}
        </a-button>
      </a-space>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('order.orderNo')">
          <a-input v-model:value="query.orderNo" allow-clear :placeholder="t('common.pleaseInput')" style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('goods.goodsType')">
          <a-select v-model:value="query.orderType" allow-clear :placeholder="t('common.all')" style="width: 120px">
            <a-select-option :value="1">{{ t('goods.hotel') }}</a-select-option>
            <a-select-option :value="2">{{ t('goods.ticket') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('order.buyer')">
          <a-input v-model:value="query.contactName" allow-clear :placeholder="t('common.pleaseInput')" style="width: 140px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('order.orderStatus')">
          <a-select v-model:value="query.orderStatus" allow-clear :placeholder="t('common.all')" style="width: 120px">
            <a-select-option :value="1">{{ t('order.statusMap.paid') }}</a-select-option>
            <a-select-option :value="2">{{ t('order.statusMap.used') }}</a-select-option>
            <a-select-option :value="3">{{ t('order.statusMap.completed') }}</a-select-option>
            <a-select-option :value="4">{{ t('order.statusMap.cancelled') }}</a-select-option>
            <a-select-option :value="5">{{ t('order.statusMap.refunding') }}</a-select-option>
            <a-select-option :value="6">{{ t('order.statusMap.refunded') }}</a-select-option>
            <a-select-option :value="7">{{ t('order.statusMap.expired') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('order.createdAt')">
          <a-range-picker v-model:value="dateRange" value-format="YYYY-MM-DD" style="width: 240px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="doReset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>{{ t('menu.order') }}</template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1300 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'pay_amount'">
            <AmountText :value="record.pay_amount" type="income" />
          </template>
          <template v-else-if="column.dataIndex === 'order_status'">
            <StatusTag :value="record.order_status" :map="ORDER_STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0" wrap>
              <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
              <a-popconfirm v-if="record.order_status === 1" :title="t('order.verifyConfirm')" @confirm="verifyByRow(record)">
                <a-button v-perm="'mch:order:verify'" type="link" size="small">{{ t('order.verify') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情 -->
    <a-drawer v-model:open="detailOpen" :title="t('common.detail')" width="560">
      <a-spin :spinning="detailLoading">
        <a-descriptions v-if="detailOrder" :column="1" bordered size="small" style="margin-bottom: 16px">
          <a-descriptions-item :label="t('order.orderNo')">{{ detailOrder.order_no }}</a-descriptions-item>
          <a-descriptions-item :label="t('order.goodsName')">{{ detailOrder.goods_name }}</a-descriptions-item>
          <a-descriptions-item :label="t('order.buyer')">{{ detailOrder.contact_name }}</a-descriptions-item>
          <a-descriptions-item :label="t('order.phone')">{{ detailOrder.contact_phone }}</a-descriptions-item>
          <a-descriptions-item :label="t('order.amount')">
            <AmountText :value="detailOrder.pay_amount" type="income" />
          </a-descriptions-item>
          <a-descriptions-item :label="t('order.orderStatus')">
            <StatusTag :value="detailOrder.order_status" :map="ORDER_STATUS_MAP" />
          </a-descriptions-item>
          <a-descriptions-item :label="t('order.verifyCode')">{{ detailOrder.verify_code }}</a-descriptions-item>
        </a-descriptions>
        <a-divider orientation="left">{{ t('order.verifyLogTitle') }}</a-divider>
        <a-table
          :columns="logColumns"
          :data-source="verifyLogs"
          :pagination="false"
          row-key="id"
          size="small"
        />
      </a-spin>
    </a-drawer>
  </PageContainer>
</template>
