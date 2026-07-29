<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { formatAmount } from '@/utils/format';
import { exportCsv } from '@/utils/export';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiMerchantList } from '@/api/merchant';
import {
  apiOrderCancel,
  apiOrderDetail,
  apiOrderList,
  apiOrderModifyPrice,
  apiOrderRemark,
} from '@/api/order';

/**
 * 订单管理通用页(全部 orderType=0 / 酒店=1 / 门票=2 复用)
 * 状态机:0待支付 1已支付 2已核销/入住 3已完成 4已取消 5退款中 6已退款 7已过期
 * 管理端仅可:待支付改价/取消;备注任意状态;退款、核销走专属页面
 */
const props = defineProps<{
  orderType: number;
  permPrefix: string; // order:all / order:hotel / order:ticket
}>();

const { t } = useI18n();

const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('order.orderStatus.pending'), color: 'warning' },
  1: { text: t('order.orderStatus.paid'), color: 'processing' },
  2: { text: t('order.orderStatus.verified'), color: 'cyan' },
  3: { text: t('order.orderStatus.done'), color: 'success' },
  4: { text: t('order.orderStatus.cancelled'), color: 'default' },
  5: { text: t('order.orderStatus.refunding'), color: 'orange' },
  6: { text: t('order.orderStatus.refunded'), color: 'purple' },
  7: { text: t('order.orderStatus.expired'), color: 'default' },
}));
const REFUND_STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('order.refundStatus.applying', 'Pending Merchant Review'), color: 'warning' },
  1: { text: t('order.refundStatus.applying', 'Pending Platform Review'), color: 'orange' },
  2: { text: t('order.refundStatus.applying'), color: 'processing' },
  3: { text: t('order.refundStatus.completed'), color: 'success' },
  4: { text: t('order.refundStatus.rejected'), color: 'error' },
  5: { text: t('common.none', 'Revoked'), color: 'default' },
}));
const ORDER_TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('goods.common.typeHotel'),
  2: t('goods.common.typeTicket'),
}));
const PAY_METHOD_TEXT = computed<Record<number, string>>(() => ({
  0: t('common.none', 'Unpaid'),
  1: t('order.payMethod.stripe'),
  2: t('order.payMethod.paypal'),
  3: t('order.payMethod.balance'),
  4: t('order.payMethod.other', 'Mock Pay'),
}));
const VERIFY_TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('order.verifyType.qrcode', 'Device Verify'),
  2: t('order.verifyType.manual', 'Merchant Verify'),
  3: t('order.verifyType.manual', 'Admin Manual'),
}));

// 下单日期区间(string[] 绑 range-picker,fetcher 拆 startDate/endDate)
const createdRange = ref<string[]>([]);

const { loading, list, query, load, search, reset, pagination } = useTable(
  (params) => apiOrderList({
    ...params,
    orderType: props.orderType > 0 ? props.orderType : undefined,
    startDate: createdRange.value?.[0],
    endDate: createdRange.value?.[1],
  }),
  { orderNo: '', orderStatus: undefined, merchantId: undefined, contactName: '', useDate: undefined, siteId: 0 },
);

function doReset(): void {
  createdRange.value = [];
  reset();
}

const columns = [
  { title: t('order.orderNo'), dataIndex: 'order_no', width: 200 },
  ...(props.orderType === 0 ? [{ title: t('order.goodsType'), dataIndex: 'order_type', width: 70 }] : []),
  { title: t('order.goods'), dataIndex: 'goods_name', width: 200, ellipsis: true },
  { title: t('goods.common.sku', 'Spec'), dataIndex: 'sku_name', width: 120, ellipsis: true },
  { title: t('order.quantity'), dataIndex: 'quantity', width: 60 },
  { title: t('order.amount', 'Pay Amount'), dataIndex: 'pay_amount', width: 100 },
  { title: t('order.contact'), dataIndex: 'contact_name', width: 100, ellipsis: true },
  { title: t('order.contactMobile'), dataIndex: 'contact_phone', width: 120 },
  { title: t('order.useDate', 'Use Date'), dataIndex: 'use_date', width: 105 },
  { title: t('order.status'), dataIndex: 'order_status', width: 90 },
  { title: t('order.createTime'), dataIndex: 'created_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 200, fixed: 'right' as const },
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

// ---------- 详情抽屉(含退款单与核销日志) ----------
const drawerOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);
const detailRefunds = ref<TableRow[]>([]);
const detailVerifyLogs = ref<TableRow[]>([]);

async function openDetail(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  detailLoading.value = true;
  try {
    const data = await apiOrderDetail(row.id);
    detail.value = data.order;
    detailRefunds.value = data.refunds;
    detailVerifyLogs.value = data.verifyLogs;
  } finally {
    detailLoading.value = false;
  }
}

// ---------- 改价(仅待支付) ----------
const priceOpen = ref(false);
const priceSubmitting = ref(false);
const priceForm = reactive({ id: 0, orderNo: '', totalAmount: 0, payAmount: 0, reason: '' });

function openPrice(row: TableRow): void {
  priceForm.id = row.id;
  priceForm.orderNo = row.order_no;
  priceForm.totalAmount = Number(row.total_amount);
  priceForm.payAmount = Number(row.pay_amount);
  priceForm.reason = '';
  priceOpen.value = true;
}

async function submitPrice(): Promise<void> {
  if (priceForm.payAmount < 0 || priceForm.payAmount > priceForm.totalAmount) {
    message.warning(t('order.priceModify.warningRange', 'Pay amount must be between 0 and total'));
    return;
  }
  if (!priceForm.reason.trim()) {
    message.warning(t('order.priceModify.inputReason'));
    return;
  }
  priceSubmitting.value = true;
  try {
    await apiOrderModifyPrice({ id: priceForm.id, payAmount: priceForm.payAmount, reason: priceForm.reason.trim() });
    message.success(t('order.priceModify.success'));
    priceOpen.value = false;
    void load();
  } finally {
    priceSubmitting.value = false;
  }
}

// ---------- 取消(仅待支付,必填原因) ----------
const cancelOpen = ref(false);
const cancelSubmitting = ref(false);
const cancelForm = reactive({ id: 0, orderNo: '', reason: '' });

function openCancel(row: TableRow): void {
  cancelForm.id = row.id;
  cancelForm.orderNo = row.order_no;
  cancelForm.reason = '';
  cancelOpen.value = true;
}

async function submitCancel(): Promise<void> {
  if (!cancelForm.reason.trim()) {
    message.warning(t('order.cancelModal.inputReason'));
    return;
  }
  cancelSubmitting.value = true;
  try {
    await apiOrderCancel({ id: cancelForm.id, reason: cancelForm.reason.trim() });
    message.success(t('order.cancelModal.successStockReleased', 'Order cancelled, stock released'));
    cancelOpen.value = false;
    void load();
  } finally {
    cancelSubmitting.value = false;
  }
}

// ---------- 备注(任意状态) ----------
const remarkOpen = ref(false);
const remarkSubmitting = ref(false);
const remarkForm = reactive({ id: 0, orderNo: '', remark: '' });

function openRemark(row: TableRow): void {
  remarkForm.id = row.id;
  remarkForm.orderNo = row.order_no;
  remarkForm.remark = String(row.remark ?? '');
  remarkOpen.value = true;
}

async function submitRemark(): Promise<void> {
  if (!remarkForm.remark.trim()) {
    message.warning(t('order.remarkModal.inputContent'));
    return;
  }
  remarkSubmitting.value = true;
  try {
    await apiOrderRemark({ id: remarkForm.id, remark: remarkForm.remark.trim() });
    message.success(t('order.remarkModal.success'));
    remarkOpen.value = false;
    void load();
  } finally {
    remarkSubmitting.value = false;
  }
}

// ---------- CSV 导出(当前筛选结果,前端导出) ----------
const exporting = ref(false);

async function exportOrders(): Promise<void> {
  exporting.value = true;
  try {
    const data = await apiOrderList({
      ...query,
      orderType: props.orderType > 0 ? props.orderType : undefined,
      startDate: createdRange.value?.[0],
      endDate: createdRange.value?.[1],
      page: 1,
      pageSize: 2000,
    });
    if (!data.list.length) {
      message.warning(t('order.exportEmpty', 'No orders to export under current filter'));
      return;
    }
    const statusMap = STATUS_MAP.value;
    const orderTypeMap = ORDER_TYPE_TEXT.value;
    const payMethodMap = PAY_METHOD_TEXT.value;
    exportCsv(t('order.exportFilename', `orders_${new Date().toISOString().slice(0, 10)}`), [
      { title: t('order.orderNo'), key: 'order_no' },
      { title: t('order.goodsType'), key: 'order_type', format: (row) => orderTypeMap[row.order_type] ?? String(row.order_type) },
      { title: t('order.goods'), key: 'goods_name' },
      { title: t('goods.common.sku', 'Spec'), key: 'sku_name' },
      { title: t('order.quantity'), key: 'quantity' },
      { title: t('order.totalAmount', 'Total Amount'), key: 'total_amount' },
      { title: t('order.amount', 'Pay Amount'), key: 'pay_amount' },
      { title: t('order.platformCommission', 'Platform Commission'), key: 'platform_commission' },
      { title: t('order.contact'), key: 'contact_name' },
      { title: t('order.contactMobile'), key: 'contact_phone' },
      { title: t('order.useDate', 'Use Date'), key: 'use_date' },
      { title: t('order.status'), key: 'order_status', format: (row) => statusMap[row.order_status]?.text ?? String(row.order_status) },
      { title: t('order.filter.payMethod'), key: 'pay_method', format: (row) => payMethodMap[row.pay_method] ?? '-' },
      { title: t('order.createTime'), key: 'created_at' },
    ], data.list);
    message.success(t('order.exportSuccess', `Exported ${data.list.length} orders`).replace('{count}', String(data.list.length)));
  } finally {
    exporting.value = false;
  }
}

const pageTitle = computed(() => {
  if (props.orderType === 1) return t('menu.orderHotel');
  if (props.orderType === 2) return t('menu.orderTicket');
  return t('menu.orderAll');
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('order.filter.orderNo')">
          <a-input v-model:value="query.orderNo" allow-clear :placeholder="t('common.pleaseInput', 'Exact match')" style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('order.status')">
          <a-select v-model:value="query.orderStatus" allow-clear :placeholder="t('common.all')" style="width: 110px">
            <a-select-option v-for="(item, key) in STATUS_MAP" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
          </a-select>
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
        <a-form-item :label="t('order.contact')">
          <a-input v-model:value="query.contactName" allow-clear :placeholder="t('common.pleaseInput', 'Fuzzy match')" style="width: 130px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('order.createTimeRange', 'Create Date')">
          <a-range-picker v-model:value="createdRange" value-format="YYYY-MM-DD" style="width: 240px" />
        </a-form-item>
        <a-form-item :label="t('order.useDate', 'Use Date')">
          <a-date-picker v-model:value="query.useDate" value-format="YYYY-MM-DD" style="width: 130px" />
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

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>{{ pageTitle }}</template>
      <template #extra>
        <a-button v-perm="'order:all:export'" :loading="exporting" @click="exportOrders">
          <template #icon><DownloadOutlined /></template>{{ t('common.export') }} CSV
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1600 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'order_type'">
            <a-tag :color="record.order_type === 1 ? 'blue' : 'green'">{{ ORDER_TYPE_TEXT[record.order_type] ?? '-' }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'pay_amount'">{{ formatAmount(record.pay_amount) }}</template>
          <template v-else-if="column.dataIndex === 'order_status'">
            <StatusTag :value="record.order_status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">{{ t('order.actions.detail') }}</a-button>
              <a-button
                v-if="record.order_status === 0"
                v-perm="'order:all:cancel'"
                type="link"
                size="small"
                @click="openPrice(record)"
              >{{ t('order.actions.modifyPrice') }}</a-button>
              <a-button
                v-if="record.order_status === 0"
                v-perm="'order:all:cancel'"
                type="link"
                size="small"
                danger
                @click="openCancel(record)"
              >{{ t('order.actions.cancel') }}</a-button>
              <a-button type="link" size="small" @click="openRemark(record)">{{ t('order.actions.remark') }}</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" :title="t('order.title', 'Order Detail')" width="760">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item :label="t('order.orderNo')" :span="2">{{ detail.order_no }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.status')"><StatusTag :value="detail.order_status" :map="STATUS_MAP" /></a-descriptions-item>
            <a-descriptions-item :label="t('order.goodsType')">{{ ORDER_TYPE_TEXT[detail.order_type] ?? '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.goods')" :span="2">{{ detail.goods_name }} / {{ detail.sku_name }} × {{ detail.quantity }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.totalAmount', 'Total Amount')">{{ formatAmount(detail.total_amount) }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.amount', 'Pay Amount')">{{ formatAmount(detail.pay_amount) }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.discountAmount', 'Discount Amount')">{{ formatAmount(detail.discount_amount) }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.platformCommission', 'Platform Commission')">{{ formatAmount(detail.platform_commission) }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.contact')">{{ detail.contact_name }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.contactMobile')">{{ detail.contact_phone }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.useDate', 'Use Date')">{{ detail.use_date || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.endDate', 'Check-out Date')">{{ detail.end_date || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.filter.payMethod')">{{ PAY_METHOD_TEXT[detail.pay_method] ?? '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.payTime')">{{ detail.pay_time || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.verify.code')">{{ detail.verify_code || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.createTime')">{{ detail.created_at }}</a-descriptions-item>
            <a-descriptions-item v-if="detail.cancel_reason" :label="t('order.cancelModal.reason')" :span="2">{{ detail.cancel_reason }}</a-descriptions-item>
            <a-descriptions-item v-if="detail.remark" :label="t('order.remark')" :span="2">{{ detail.remark }}</a-descriptions-item>
          </a-descriptions>
          <a-divider orientation="left">{{ t('order.refund.title') }}({{ detailRefunds.length }})</a-divider>
          <a-table
            :columns="[
              { title: t('order.refund.refundNo'), dataIndex: 'refund_no', width: 190 },
              { title: t('order.refund.applyAmount', 'Apply Amount'), dataIndex: 'apply_amount', width: 100 },
              { title: t('order.refund.amount'), dataIndex: 'refund_amount', width: 100 },
              { title: t('order.status'), dataIndex: 'status', width: 110 },
              { title: t('order.refund.applyTime'), dataIndex: 'created_at', width: 160 },
            ]"
            :data-source="detailRefunds"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'apply_amount'">{{ formatAmount(record.apply_amount) }}</template>
              <template v-else-if="column.dataIndex === 'refund_amount'">{{ formatAmount(record.refund_amount) }}</template>
              <template v-else-if="column.dataIndex === 'status'">
                <StatusTag :value="record.status" :map="REFUND_STATUS_MAP" />
              </template>
            </template>
          </a-table>
          <a-divider orientation="left">{{ t('order.verifyLog.title') }}({{ detailVerifyLogs.length }})</a-divider>
          <a-table
            :columns="[
              { title: t('order.verifyLog.verifyType'), dataIndex: 'verify_type', width: 100 },
              { title: t('order.verifyLog.operator'), dataIndex: 'operator_name', width: 120 },
              { title: t('order.status'), dataIndex: 'status', width: 90 },
              { title: t('order.verifyLog.revokeReason', 'Revoke Reason'), dataIndex: 'revoke_reason', ellipsis: true },
              { title: t('order.verifyLog.time'), dataIndex: 'created_at', width: 160 },
            ]"
            :data-source="detailVerifyLogs"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'verify_type'">{{ VERIFY_TYPE_TEXT[record.verify_type] ?? '-' }}</template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? t('common.success') : t('order.verifyLog.revoked', 'Revoked') }}</a-tag>
              </template>
            </template>
          </a-table>
        </template>
      </a-spin>
    </a-drawer>

    <!-- 改价 Modal -->
    <a-modal v-model:open="priceOpen" :title="t('order.priceModify.title')" :confirm-loading="priceSubmitting" @ok="submitPrice">
      <a-alert type="warning" show-icon :message="t('order.priceModify.notice')" style="margin-bottom: 16px" />
      <a-form :label-col="{ span: 6 }">
        <a-form-item :label="t('order.orderNo')">{{ priceForm.orderNo }}</a-form-item>
        <a-form-item :label="t('order.totalAmount', 'Total Amount')">{{ formatAmount(priceForm.totalAmount) }}</a-form-item>
        <a-form-item :label="t('order.newPayAmount', 'New Pay Amount')" required>
          <a-input-number v-model:value="priceForm.payAmount" :min="0" :max="priceForm.totalAmount" :precision="2" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('order.priceModify.reason')" required>
          <a-textarea v-model:value="priceForm.reason" :rows="3" :maxlength="200" :placeholder="t('order.priceModify.requiredPlaceholder', 'Required, recorded in order remark')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 取消 Modal -->
    <a-modal
      v-model:open="cancelOpen"
      :title="t('order.cancelModal.title')"
      :confirm-loading="cancelSubmitting"
      :ok-button-props="{ danger: true }"
      :ok-text="t('order.cancelModal.confirm')"
      @ok="submitCancel"
    >
      <a-alert type="warning" show-icon :message="t('order.cancelModal.notice')" style="margin-bottom: 16px" />
      <a-form :label-col="{ span: 6 }">
        <a-form-item :label="t('order.orderNo')">{{ cancelForm.orderNo }}</a-form-item>
        <a-form-item :label="t('order.cancelModal.reason')" required>
          <a-textarea v-model:value="cancelForm.reason" :rows="3" :maxlength="200" :placeholder="t('common.required', 'Required')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 备注 Modal -->
    <a-modal v-model:open="remarkOpen" :title="t('order.remarkModal.title')" :confirm-loading="remarkSubmitting" @ok="submitRemark">
      <a-form :label-col="{ span: 5 }">
        <a-form-item :label="t('order.orderNo')">{{ remarkForm.orderNo }}</a-form-item>
        <a-form-item :label="t('order.remarkModal.content')" required>
          <a-textarea v-model:value="remarkForm.remark" :rows="4" :maxlength="500" show-count />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
