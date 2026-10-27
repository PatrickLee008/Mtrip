<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { formatAmount } from '@/utils/format';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiMerchantList } from '@/api/merchant';
import { apiRefundAudit, apiRefundConfirm, apiRefundDetail, apiRefundList } from '@/api/order';

/**
 * 退款审核(文档 6.4.1)
 * 状态机:0待商户审核 →(通过)1待平台审核 →(通过)2退款中(可核定金额)→(到账确认)3已退款
 *        0/1驳回→4已驳回(订单恢复已支付);5已撤销(用户侧)
 * 平台后台可代商户审核;到账确认后全额退款关闭订单并回补库存
 */
const { t } = useI18n();

const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('order.refundStatus.applying', 'Pending Merchant Review'), color: 'warning' },
  1: { text: t('order.refundStatus.applying', 'Pending Platform Review'), color: 'orange' },
  2: { text: t('order.refundStatus.applying'), color: 'processing' },
  3: { text: t('order.refundStatus.completed'), color: 'success' },
  4: { text: t('order.refundStatus.rejected'), color: 'error' },
  5: { text: t('common.none', 'Revoked'), color: 'default' },
}));
const ORDER_STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('order.orderStatus.pending'), color: 'warning' },
  1: { text: t('order.orderStatus.paid'), color: 'processing' },
  2: { text: t('order.orderStatus.verified'), color: 'cyan' },
  3: { text: t('order.orderStatus.done'), color: 'success' },
  4: { text: t('order.orderStatus.cancelled'), color: 'default' },
  5: { text: t('order.orderStatus.refunding'), color: 'orange' },
  6: { text: t('order.orderStatus.refunded'), color: 'purple' },
  7: { text: t('order.orderStatus.expired'), color: 'default' },
}));

// 申请日期区间
const createdRange = ref<string[]>([]);

const { loading, list, query, load, search, reset, pagination } = useTable(
  (params) => apiRefundList({
    ...params,
    startDate: createdRange.value?.[0],
    endDate: createdRange.value?.[1],
  }),
  { refundNo: '', orderNo: '', status: undefined, merchantId: undefined, siteId: 0 },
);

function doReset(): void {
  createdRange.value = [];
  reset();
}

const columns = [
  { title: t('order.refund.refundNo'), dataIndex: 'refund_no', width: 200 },
  { title: t('order.orderNo'), dataIndex: 'order_no', width: 200 },
  { title: t('order.refund.applyAmount', 'Apply Amount'), dataIndex: 'apply_amount', width: 100 },
  { title: t('order.refund.amount'), dataIndex: 'refund_amount', width: 100 },
  { title: t('order.refund.channel'), dataIndex: 'refund_channel', width: 150 },
  { title: t('order.refund.reason'), dataIndex: 'reason', width: 180, ellipsis: true },
  { title: t('order.status'), dataIndex: 'status', width: 110 },
  { title: t('order.refund.applyTime'), dataIndex: 'created_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 180, fixed: 'right' as const },
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

// ---------- 详情抽屉(退款单 + 订单快照 + 凭证图) ----------
const drawerOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<TableRow | null>(null);
const detailOrder = ref<TableRow | null>(null);

async function openDetail(row: TableRow): Promise<void> {
  drawerOpen.value = true;
  detailLoading.value = true;
  try {
    const data = await apiRefundDetail(row.id);
    detail.value = data.refund;
    detailOrder.value = data.order;
  } finally {
    detailLoading.value = false;
  }
}

// ---------- 审核 Modal(通过/驳回;平台环节可核定金额) ----------
const auditOpen = ref(false);
const auditSubmitting = ref(false);
const auditForm = reactive({
  id: 0,
  refundNo: '',
  stage: 0, // 当前环节:0商户 1平台
  applyAmount: 0,
  auditStatus: 1,
  refundAmount: 0,
  auditRemark: '',
});

function openAudit(row: TableRow): void {
  auditForm.id = row.id;
  auditForm.refundNo = row.refund_no;
  auditForm.stage = Number(row.status);
  auditForm.applyAmount = Number(row.apply_amount);
  auditForm.auditStatus = 1;
  auditForm.refundAmount = Number(row.apply_amount);
  auditForm.auditRemark = '';
  auditOpen.value = true;
}

async function submitAudit(): Promise<void> {
  if (auditForm.auditStatus === 2 && !auditForm.auditRemark.trim()) {
    message.warning(t('order.refund.rejectModal.inputReason'));
    return;
  }
  if (auditForm.auditStatus === 1 && auditForm.stage === 1
    && (auditForm.refundAmount <= 0 || auditForm.refundAmount > auditForm.applyAmount)) {
    message.warning(t('order.refund.warningAmountRange', 'Refund amount must be > 0 and ≤ apply amount'));
    return;
  }
  auditSubmitting.value = true;
  try {
    await apiRefundAudit({
      id: auditForm.id,
      auditStatus: auditForm.auditStatus,
      auditRemark: auditForm.auditRemark.trim() || undefined,
      refundAmount: auditForm.auditStatus === 1 && auditForm.stage === 1 ? auditForm.refundAmount : undefined,
    });
    message.success(auditForm.auditStatus === 2 ? t('order.refund.rejectSuccess', 'Refund rejected, order back to paid') : t('common.success'));
    auditOpen.value = false;
    void load();
  } finally {
    auditSubmitting.value = false;
  }
}

// ---------- 退款渠道 / KBZPay 原路退款(方案 22 §9.1 遗留 3) ----------
/** 订单支付方式:5 = KBZPay MMQR(与 order-service BookingConst::PAY_METHOD_KBZ_MMQR 一致) */
const PAY_METHOD_KBZ_MMQR = 5;
/**
 * 是否 KBZPay 原路退款单(与后端 RefundSettleService::isKbzRefund 同口径):
 * 迟到支付自动退款单(order_refund.late_pay=1),或 refund_channel=2 且订单 pay_method=5。
 * 列表 / 详情行均带 pay_method;缺失时用 channel_submit_status(>0 仅 KBZ 单会写)兜底;
 * 传入订单快照(详情接口)时以订单为准。
 */
function isKbzRefund(row: TableRow | null, order?: TableRow | null): boolean {
  if (!row) return false;
  if (Number(row.late_pay ?? 0) === 1) return true;
  if (Number(row.refund_channel ?? 1) !== 2) return false;
  if (order) return Number(order.pay_method) === PAY_METHOD_KBZ_MMQR;
  if (row.pay_method !== undefined && row.pay_method !== null) return Number(row.pay_method) === PAY_METHOD_KBZ_MMQR;
  return Number(row.channel_submit_status ?? 0) > 0;
}

/** 退款渠道:1 mTrip 钱包 / 2 原路退回(KBZ 单显示「KBZPay 原路退回」) */
function channelText(row: TableRow | null, order?: TableRow | null): string {
  if (!row) return '-';
  if (isKbzRefund(row, order)) return t('order.refund.channelText.kbz');
  const channel = Number(row.refund_channel ?? 1);
  return channel === 2 ? t('order.refund.channelText.original') : t('order.refund.channelText.wallet');
}

/** 渠道提交状态(order_refund.channel_submit_status):0 不适用 1 排队待提交 2 已提交支付中心 3 已转钱包 */
const SUBMIT_STATUS_MAP = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('order.refund.submitStatus.none'), color: 'default' },
  1: { text: t('order.refund.submitStatus.queued'), color: 'warning' },
  2: { text: t('order.refund.submitStatus.submitted'), color: 'processing' },
  3: { text: t('order.refund.submitStatus.wallet'), color: 'purple' },
}));

/** 列表 / 详情是否带有 channel_submit_status(后端迁移未上线时不展示) */
function hasSubmitStatus(row: TableRow | null): boolean {
  return !!row && row.channel_submit_status !== undefined && row.channel_submit_status !== null;
}

// ---------- 到账确认 Modal(KBZ 单为「提交原路退款 / 重试」) ----------
const confirmOpen = ref(false);
const confirmSubmitting = ref(false);
const confirmLoading = ref(false);
const confirmForm = reactive({
  id: 0,
  refundNo: '',
  refundAmount: 0,
  refundTradeNo: '',
  /** 原路退回(refund_channel=2)且非 KBZ:需人工填写第三方退款流水号 */
  needTradeNo: false,
  /** KBZPay 原路退款:提交 / 重试支付中心,不填流水号 */
  kbz: false,
  /** 支付中心退款号(order_refund.refund_trade_no,KBZ 单只读) */
  centerRefundNo: '',
  submitStatus: null as number | null,
});

async function openConfirm(row: TableRow): Promise<void> {
  confirmForm.id = row.id;
  confirmForm.refundNo = row.refund_no;
  confirmForm.refundAmount = Number(row.refund_amount);
  confirmForm.refundTradeNo = '';
  confirmForm.kbz = isKbzRefund(row);
  confirmForm.needTradeNo = !confirmForm.kbz && Number(row.refund_channel ?? 1) === 2;
  confirmForm.centerRefundNo = String(row.refund_trade_no ?? '');
  confirmForm.submitStatus = hasSubmitStatus(row) ? Number(row.channel_submit_status) : null;
  confirmOpen.value = true;
  // 列表没有订单支付方式:原路退回单取详情里的订单快照确认是否 KBZ 单
  if (Number(row.refund_channel ?? 1) !== 2) return;
  confirmLoading.value = true;
  try {
    const data = await apiRefundDetail(row.id);
    confirmForm.kbz = isKbzRefund(data.refund, data.order);
    confirmForm.needTradeNo = !confirmForm.kbz;
    confirmForm.centerRefundNo = String(data.refund?.refund_trade_no ?? '');
    confirmForm.submitStatus = hasSubmitStatus(data.refund) ? Number(data.refund.channel_submit_status) : null;
  } finally {
    confirmLoading.value = false;
  }
}

async function submitConfirm(): Promise<void> {
  if (confirmForm.needTradeNo && !confirmForm.refundTradeNo.trim()) {
    message.warning(t('order.refund.tradeNoRequired'));
    return;
  }
  confirmSubmitting.value = true;
  try {
    const res = await apiRefundConfirm({
      id: confirmForm.id,
      refundTradeNo: confirmForm.kbz ? undefined : confirmForm.refundTradeNo.trim() || undefined,
    });
    if (confirmForm.kbz) {
      // 后端返回 {status: processing|succeeded|failed, refundNo}
      const status = String(res?.status ?? 'processing');
      if (status === 'succeeded') message.success(t('order.refund.kbzResult.succeeded'));
      else if (status === 'failed') message.warning(t('order.refund.kbzResult.failed'));
      else message.info(t('order.refund.kbzResult.processing'));
    } else {
      message.success(t('order.refund.confirmArrived', 'Refund arrival confirmed'));
    }
    confirmOpen.value = false;
    void load();
  } finally {
    confirmSubmitting.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('order.refund.refundNo')">
          <a-input v-model:value="query.refundNo" allow-clear :placeholder="t('common.pleaseInput', 'Exact match')" style="width: 190px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('order.orderNo')">
          <a-input v-model:value="query.orderNo" allow-clear :placeholder="t('common.pleaseInput', 'Exact match')" style="width: 190px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('order.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 130px">
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
        <a-form-item :label="t('order.refund.applyTime')">
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

    <a-card :bordered="false" class="mtrip-card-shadow" :title="t('order.refund.title', 'Refund Audit')">
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1450 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'apply_amount'">{{ formatAmount(record.apply_amount) }}</template>
          <template v-else-if="column.dataIndex === 'refund_amount'">
            {{ record.status >= 2 && record.status <= 3 ? formatAmount(record.refund_amount) : '-' }}
          </template>
          <template v-else-if="column.dataIndex === 'refund_channel'">
            <div>{{ channelText(record) }}</div>
            <StatusTag v-if="hasSubmitStatus(record) && record.channel_submit_status > 0" :value="Number(record.channel_submit_status)" :map="SUBMIT_STATUS_MAP" />
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tooltip v-if="record.status === 4 && record.audit_remark" :title="`${t('order.refund.rejectModal.reason')}:${record.audit_remark}`">
              <span><StatusTag :value="record.status" :map="STATUS_MAP" /></span>
            </a-tooltip>
            <StatusTag v-else :value="record.status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">{{ t('order.actions.detail') }}</a-button>
              <a-button
                v-if="record.status === 0 || record.status === 1"
                v-perm="'order:refund:audit'"
                type="link"
                size="small"
                @click="openAudit(record)"
              >{{ t('order.refund.actions.approve', 'Audit') }}</a-button>
              <a-button
                v-if="record.status === 2"
                v-perm="'order:refund:audit'"
                type="link"
                size="small"
                @click="openConfirm(record)"
              >{{ isKbzRefund(record) ? t('order.refund.kbzSubmit') : t('order.refund.confirmArrived', 'Confirm Arrival') }}</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" :title="t('order.refund.detailTitle', 'Refund Detail')" width="720">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item :label="t('order.refund.refundNo')" :span="2">{{ detail.refund_no }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.status')"><StatusTag :value="detail.status" :map="STATUS_MAP" /></a-descriptions-item>
            <a-descriptions-item :label="t('order.refund.applyAmount', 'Apply Amount')">{{ formatAmount(detail.apply_amount) }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.refund.amount')">{{ detail.status >= 2 ? formatAmount(detail.refund_amount) : '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.refund.deductAmount', 'Deduct Amount')">{{ detail.status >= 2 ? formatAmount(detail.deduct_amount) : '-' }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.refund.reason')" :span="2">{{ detail.reason || '-' }}</a-descriptions-item>
            <a-descriptions-item v-if="detail.audit_remark" :label="t('order.refund.auditOpinion', 'Audit Opinion')" :span="2">{{ detail.audit_remark }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.refund.channel')" :span="hasSubmitStatus(detail) ? 1 : 2">{{ channelText(detail, detailOrder) }}</a-descriptions-item>
            <a-descriptions-item v-if="hasSubmitStatus(detail)" :label="t('order.refund.submitStatusLabel')">
              <StatusTag :value="Number(detail.channel_submit_status)" :map="SUBMIT_STATUS_MAP" />
            </a-descriptions-item>
            <a-descriptions-item
              v-if="detail.refund_trade_no"
              :label="isKbzRefund(detail, detailOrder) ? t('order.refund.centerRefundNo') : t('order.refund.tradeNo', 'Refund Trade No.')"
              :span="2"
            >{{ detail.refund_trade_no }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.refund.applyTime')">{{ detail.created_at }}</a-descriptions-item>
            <a-descriptions-item :label="t('order.refund.refundTime', 'Refund Time')">{{ detail.refund_time || '-' }}</a-descriptions-item>
          </a-descriptions>
          <template v-if="Array.isArray(detail.images) && detail.images.length">
            <a-divider orientation="left">{{ t('order.refund.images') }}</a-divider>
            <a-image-preview-group>
              <a-space wrap>
                <a-image v-for="(img, idx) in detail.images" :key="idx" :src="img" :width="88" :height="66" style="object-fit: cover; border-radius: 4px" />
              </a-space>
            </a-image-preview-group>
          </template>
          <template v-if="detailOrder">
            <a-divider orientation="left">{{ t('order.refund.orderSnapshot', 'Order Snapshot') }}</a-divider>
            <a-descriptions :column="2" size="small" bordered>
              <a-descriptions-item :label="t('order.orderNo')" :span="2">{{ detailOrder.order_no }}</a-descriptions-item>
              <a-descriptions-item :label="t('order.status')"><StatusTag :value="detailOrder.order_status" :map="ORDER_STATUS_MAP" /></a-descriptions-item>
              <a-descriptions-item :label="t('order.contact')">{{ detailOrder.contact_name }}</a-descriptions-item>
              <a-descriptions-item :label="t('order.goods')" :span="2">{{ detailOrder.goods_name }} / {{ detailOrder.sku_name }} × {{ detailOrder.quantity }}</a-descriptions-item>
              <a-descriptions-item :label="t('order.totalAmount', 'Total Amount')">{{ formatAmount(detailOrder.total_amount) }}</a-descriptions-item>
              <a-descriptions-item :label="t('order.amount', 'Pay Amount')">{{ formatAmount(detailOrder.pay_amount) }}</a-descriptions-item>
              <a-descriptions-item :label="t('order.useDate', 'Use Date')">{{ detailOrder.use_date || '-' }}</a-descriptions-item>
              <a-descriptions-item :label="t('order.payTime')">{{ detailOrder.pay_time || '-' }}</a-descriptions-item>
            </a-descriptions>
          </template>
        </template>
      </a-spin>
    </a-drawer>

    <!-- 审核 Modal -->
    <a-modal v-model:open="auditOpen" :title="t('order.refund.auditTitle', 'Refund Audit')" :confirm-loading="auditSubmitting" @ok="submitAudit">
      <a-alert
        type="info"
        show-icon
        :message="auditForm.stage === 0 ? t('order.refund.auditStageMerchant', 'Current stage: Merchant Review (pass to enter platform review)') : t('order.refund.auditStagePlatform', 'Current stage: Platform Review (pass to enter refunding, can set final refund amount)')"
        style="margin-bottom: 16px"
      />
      <a-form :label-col="{ span: 6 }">
        <a-form-item :label="t('order.refund.refundNo')">{{ auditForm.refundNo }}</a-form-item>
        <a-form-item :label="t('order.refund.applyAmount', 'Apply Amount')">
          <span style="color: var(--mtrip-error, #ff4d4f); font-weight: 600">{{ formatAmount(auditForm.applyAmount) }}</span>
        </a-form-item>
        <a-form-item :label="t('order.refund.auditResult', 'Audit Result')" required>
          <a-radio-group v-model:value="auditForm.auditStatus">
            <a-radio :value="1">{{ t('order.refund.actions.approve', 'Pass') }}</a-radio>
            <a-radio :value="2">{{ t('order.refund.actions.reject') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="auditForm.auditStatus === 1 && auditForm.stage === 1" :label="t('order.refund.approveModal.refundAmount')" required>
          <a-input-number
            v-model:value="auditForm.refundAmount"
            :min="0.01"
            :max="auditForm.applyAmount"
            :precision="2"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item :label="t('order.refund.auditOpinion', 'Audit Opinion')" :required="auditForm.auditStatus === 2">
          <a-textarea v-model:value="auditForm.auditRemark" :rows="3" :maxlength="500" :placeholder="t('order.refund.rejectModal.inputReason')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 到账确认 Modal -->
    <a-modal
      v-model:open="confirmOpen"
      :title="confirmForm.kbz ? t('order.refund.kbzSubmitTitle') : t('order.refund.confirmArrivedTitle', 'Confirm Refund Arrival')"
      :ok-text="confirmForm.kbz ? t('order.refund.kbzSubmit') : undefined"
      :confirm-loading="confirmSubmitting"
      :ok-button-props="{ disabled: confirmLoading }"
      @ok="submitConfirm"
    >
      <a-spin :spinning="confirmLoading">
        <a-alert
          v-if="confirmForm.kbz"
          type="info"
          show-icon
          :message="t('order.refund.kbzSubmitNotice')"
          style="margin-bottom: 16px"
        />
        <a-alert v-else type="warning" show-icon :message="t('order.refund.confirmArrivedNotice', 'After confirmation, refund will be completed; full refund closes order and returns stock, partial refund keeps order valid')" style="margin-bottom: 16px" />
        <a-form :label-col="{ span: 7 }">
          <a-form-item :label="t('order.refund.refundNo')">{{ confirmForm.refundNo }}</a-form-item>
          <a-form-item :label="t('order.refund.amount')">
            <span style="color: var(--mtrip-error, #ff4d4f); font-weight: 600">{{ formatAmount(confirmForm.refundAmount) }}</span>
          </a-form-item>
          <template v-if="confirmForm.kbz">
            <a-form-item :label="t('order.refund.channel')">{{ t('order.refund.channelText.kbz') }}</a-form-item>
            <a-form-item v-if="confirmForm.submitStatus !== null" :label="t('order.refund.submitStatusLabel')">
              <StatusTag :value="confirmForm.submitStatus" :map="SUBMIT_STATUS_MAP" />
            </a-form-item>
            <a-form-item :label="t('order.refund.centerRefundNo')">
              <a-input :value="confirmForm.centerRefundNo || t('order.refund.centerRefundNoEmpty')" readonly />
            </a-form-item>
          </template>
          <a-form-item v-else :label="t('order.refund.tradeNo', 'Refund Trade No.')" :required="confirmForm.needTradeNo">
            <a-input
              v-model:value="confirmForm.refundTradeNo"
              :maxlength="64"
              :placeholder="confirmForm.needTradeNo ? t('order.refund.tradeNoRequired') : t('common.optional', 'Optional, third-party refund trade no.')"
            />
          </a-form-item>
        </a-form>
      </a-spin>
    </a-modal>
  </PageContainer>
</template>
