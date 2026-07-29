<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { formatAmount } from '@/utils/format';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiMerchantList } from '@/api/merchant';
import {
  apiMerchantSettleConfirm,
  apiMerchantSettleDispute,
  apiMerchantSettleList,
  apiMerchantSettleMarkPaid,
  apiWithdrawAudit,
  apiWithdrawConfirmPay,
  apiWithdrawDetail,
  apiWithdrawList,
} from '@/api/finance';

/**
 * 商户结算(文档 6.4.5):结算单 + 提现申请双 Tab
 * 结算单:0待确认 →(确认)1已确认 →(打款)2已打款;0⇄3有争议
 * 提现:0待审核 →(通过)1打款中 →(成功)2已打款;0→3已驳回;1→(失败)4
 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const activeTab = ref('settle');

const SETTLE_STATUS: Record<number, StatusItem> = {
  0: { text: '待确认', color: 'warning' },
  1: { text: '已确认', color: 'processing' },
  2: { text: '已打款', color: 'success' },
  3: { text: '有争议', color: 'error' },
};
const WITHDRAW_STATUS: Record<number, StatusItem> = {
  0: { text: '待审核', color: 'warning' },
  1: { text: '打款中', color: 'processing' },
  2: { text: '已打款', color: 'success' },
  3: { text: '已驳回', color: 'error' },
  4: { text: '打款失败', color: 'orange' },
};
const ACCOUNT_TYPE_TEXT: Record<number, string> = { 1: '银行卡', 2: 'Stripe', 3: 'PayPal' };

// ---------- 商户远程搜索(两 Tab 共用) ----------
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

// ---------- Tab1 结算单 ----------
const settle = useTable(apiMerchantSettleList, {
  settleNo: '',
  merchantId: undefined,
  settleCycle: '',
  status: undefined,
  siteId: 0,
});

const settleColumns = [
  { title: '结算单号', dataIndex: 'settle_no', width: 190 },
  { title: '商户ID', dataIndex: 'merchant_id', width: 90 },
  { title: '结算周期', dataIndex: 'settle_cycle', width: 120 },
  { title: '订单数', dataIndex: 'order_count', width: 80 },
  { title: '订单金额', dataIndex: 'order_amount', width: 110 },
  { title: '退款金额', dataIndex: 'refund_amount', width: 110 },
  { title: '佣金', dataIndex: 'commission', width: 100 },
  { title: '应结算', dataIndex: 'settle_amount', width: 110 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '操作', key: 'action_col', width: 220, fixed: 'right' as const },
];

// 结算单详情抽屉
const settleDrawerOpen = ref(false);
const settleDetail = ref<TableRow | null>(null);

function openSettleDetail(row: TableRow): void {
  settleDetail.value = row;
  settleDrawerOpen.value = true;
}

// 确认结算
async function confirmSettle(row: TableRow): Promise<void> {
  await apiMerchantSettleConfirm({ id: row.id });
  message.success('结算单已确认');
  void settle.load();
}

// 标记打款 Modal
const payOpen = ref(false);
const paySubmitting = ref(false);
const payForm = reactive({ id: 0, settleNo: '', settleAmount: 0, payVoucher: '' });

function openPay(row: TableRow): void {
  payForm.id = row.id;
  payForm.settleNo = row.settle_no;
  payForm.settleAmount = Number(row.settle_amount);
  payForm.payVoucher = '';
  payOpen.value = true;
}

async function submitPay(): Promise<void> {
  paySubmitting.value = true;
  try {
    await apiMerchantSettleMarkPaid({ id: payForm.id, payVoucher: payForm.payVoucher.trim() || undefined });
    message.success('结算单已标记打款');
    payOpen.value = false;
    void settle.load();
  } finally {
    paySubmitting.value = false;
  }
}

// 争议 Modal(0→3 标记必填说明;3→0 解除)
const disputeOpen = ref(false);
const disputeSubmitting = ref(false);
const disputeForm = reactive({ id: 0, settleNo: '', mark: true, remark: '' });

function openDispute(row: TableRow): void {
  disputeForm.id = row.id;
  disputeForm.settleNo = row.settle_no;
  disputeForm.mark = row.status === 0;
  disputeForm.remark = '';
  disputeOpen.value = true;
}

async function submitDispute(): Promise<void> {
  if (disputeForm.mark && !disputeForm.remark.trim()) {
    message.warning('标记争议必须填写说明');
    return;
  }
  disputeSubmitting.value = true;
  try {
    await apiMerchantSettleDispute({ id: disputeForm.id, remark: disputeForm.remark.trim() || undefined });
    message.success(disputeForm.mark ? '结算单已标记争议' : '争议已解除,重新待确认');
    disputeOpen.value = false;
    void settle.load();
  } finally {
    disputeSubmitting.value = false;
  }
}

// ---------- Tab2 提现申请 ----------
const withdrawRange = ref<string[]>([]);
const withdraw = useTable(
  (params) => apiWithdrawList({
    ...params,
    startDate: withdrawRange.value?.[0],
    endDate: withdrawRange.value?.[1],
  }),
  { withdrawNo: '', merchantId: undefined, status: undefined, siteId: 0 },
);

function withdrawReset(): void {
  withdrawRange.value = [];
  withdraw.reset();
}

const withdrawColumns = [
  { title: '提现单号', dataIndex: 'withdraw_no', width: 190 },
  { title: '商户ID', dataIndex: 'merchant_id', width: 90 },
  { title: '提现金额', dataIndex: 'amount', width: 110 },
  { title: '手续费', dataIndex: 'fee', width: 90 },
  { title: '实际到账', dataIndex: 'actual_amount', width: 110 },
  { title: '收款方式', dataIndex: 'account_type', width: 90 },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '申请时间', dataIndex: 'created_at', width: 165 },
  { title: '操作', key: 'action_col', width: 190, fixed: 'right' as const },
];

// 提现详情抽屉(收款账户解密)
const withdrawDrawerOpen = ref(false);
const withdrawDetailLoading = ref(false);
const withdrawDetail = ref<TableRow | null>(null);

async function openWithdrawDetail(row: TableRow): Promise<void> {
  withdrawDrawerOpen.value = true;
  withdrawDetailLoading.value = true;
  try {
    withdrawDetail.value = await apiWithdrawDetail(row.id);
  } finally {
    withdrawDetailLoading.value = false;
  }
}

// 提现审核 Modal
const auditOpen = ref(false);
const auditSubmitting = ref(false);
const auditForm = reactive({ id: 0, withdrawNo: '', actualAmount: 0, auditStatus: 1, auditRemark: '' });

function openAudit(row: TableRow): void {
  auditForm.id = row.id;
  auditForm.withdrawNo = row.withdraw_no;
  auditForm.actualAmount = Number(row.actual_amount);
  auditForm.auditStatus = 1;
  auditForm.auditRemark = '';
  auditOpen.value = true;
}

async function submitAudit(): Promise<void> {
  if (auditForm.auditStatus === 2 && !auditForm.auditRemark.trim()) {
    message.warning('驳回必须填写原因');
    return;
  }
  auditSubmitting.value = true;
  try {
    await apiWithdrawAudit({
      id: auditForm.id,
      auditStatus: auditForm.auditStatus,
      auditRemark: auditForm.auditRemark.trim() || undefined,
    });
    message.success(auditForm.auditStatus === 1 ? '审核通过,进入打款中' : '提现申请已驳回');
    auditOpen.value = false;
    void withdraw.load();
  } finally {
    auditSubmitting.value = false;
  }
}

// 打款结果确认 Modal
const payResultOpen = ref(false);
const payResultSubmitting = ref(false);
const payResultForm = reactive({ id: 0, withdrawNo: '', actualAmount: 0, payStatus: 1, tradeNo: '', failReason: '' });

function openPayResult(row: TableRow): void {
  payResultForm.id = row.id;
  payResultForm.withdrawNo = row.withdraw_no;
  payResultForm.actualAmount = Number(row.actual_amount);
  payResultForm.payStatus = 1;
  payResultForm.tradeNo = '';
  payResultForm.failReason = '';
  payResultOpen.value = true;
}

async function submitPayResult(): Promise<void> {
  if (payResultForm.payStatus === 2 && !payResultForm.failReason.trim()) {
    message.warning('打款失败必须填写原因');
    return;
  }
  payResultSubmitting.value = true;
  try {
    await apiWithdrawConfirmPay({
      id: payResultForm.id,
      payStatus: payResultForm.payStatus,
      tradeNo: payResultForm.tradeNo.trim() || undefined,
      failReason: payResultForm.failReason.trim() || undefined,
    });
    message.success(payResultForm.payStatus === 1 ? '打款完成,支出流水已记录' : '已标记打款失败');
    payResultOpen.value = false;
    void withdraw.load();
  } finally {
    payResultSubmitting.value = false;
  }
}

// 非顶层 useTable 不自动加载:结算单立即加载,提现 Tab 首次切换时加载
onMounted(() => {
  void settle.load();
});
let withdrawLoaded = false;
watch(activeTab, (tab) => {
  if (tab === 'withdraw' && !withdrawLoaded) {
    withdrawLoaded = true;
    void withdraw.load();
  }
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-tabs v-model:active-key="activeTab">
        <!-- ========== 结算单 ========== -->
        <a-tab-pane key="settle" tab="结算单">
          <a-form layout="inline" class="tab-toolbar">
            <a-form-item label="结算单号">
              <a-input v-model:value="settle.query.settleNo" allow-clear placeholder="精确匹配" style="width: 190px" @press-enter="settle.search" />
            </a-form-item>
            <a-form-item label="商户">
              <a-select
                v-model:value="settle.query.merchantId"
                show-search
                allow-clear
                placeholder="输入名称搜索"
                style="width: 200px"
                :filter-option="false"
                :options="merchantOptions"
                :loading="merchantSearching"
                @search="searchMerchant"
              />
            </a-form-item>
            <a-form-item label="结算周期">
              <a-input v-model:value="settle.query.settleCycle" allow-clear placeholder="如 2026-07" style="width: 130px" @press-enter="settle.search" />
            </a-form-item>
            <a-form-item label="状态">
              <a-select v-model:value="settle.query.status" allow-clear placeholder="全部" style="width: 100px">
                <a-select-option v-for="(item, key) in SETTLE_STATUS" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item v-if="isSuper" label="站点">
              <SiteTreeSelect v-model:value="settle.query.siteId" allow-all style="width: 160px" />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="settle.search"><template #icon><SearchOutlined /></template>查询</a-button>
                <a-button @click="settle.reset"><template #icon><ReloadOutlined /></template>重置</a-button>
              </a-space>
            </a-form-item>
          </a-form>
          <a-table
            :columns="settleColumns"
            :data-source="settle.list.value"
            :loading="settle.loading.value"
            :pagination="settle.pagination.value"
            row-key="id"
            size="middle"
            :scroll="{ x: 1500 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'order_amount'">{{ formatAmount(record.order_amount) }}</template>
              <template v-else-if="column.dataIndex === 'refund_amount'">{{ formatAmount(record.refund_amount) }}</template>
              <template v-else-if="column.dataIndex === 'commission'">{{ formatAmount(record.commission) }}</template>
              <template v-else-if="column.dataIndex === 'settle_amount'">
                <span style="font-weight: 600">{{ formatAmount(record.settle_amount) }}</span>
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tooltip v-if="record.status === 3 && record.remark" :title="`争议说明:${record.remark}`">
                  <span><StatusTag :value="record.status" :map="SETTLE_STATUS" /></span>
                </a-tooltip>
                <StatusTag v-else :value="record.status" :map="SETTLE_STATUS" />
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-space :size="0">
                  <a-button type="link" size="small" @click="openSettleDetail(record)">详情</a-button>
                  <a-popconfirm
                    v-if="record.status === 0"
                    title="确认该结算单金额无误?"
                    @confirm="confirmSettle(record)"
                  >
                    <a-button v-perm="'finance:msettle:confirm'" type="link" size="small">确认结算</a-button>
                  </a-popconfirm>
                  <a-button
                    v-if="record.status === 1"
                    v-perm="'finance:msettle:pay'"
                    type="link"
                    size="small"
                    @click="openPay(record)"
                  >标记打款</a-button>
                  <a-button
                    v-if="record.status === 0"
                    v-perm="'finance:msettle:confirm'"
                    type="link"
                    size="small"
                    danger
                    @click="openDispute(record)"
                  >标记争议</a-button>
                  <a-button
                    v-if="record.status === 3"
                    v-perm="'finance:msettle:confirm'"
                    type="link"
                    size="small"
                    @click="openDispute(record)"
                  >解除争议</a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- ========== 提现申请 ========== -->
        <a-tab-pane key="withdraw" tab="提现申请">
          <a-form layout="inline" class="tab-toolbar">
            <a-form-item label="提现单号">
              <a-input v-model:value="withdraw.query.withdrawNo" allow-clear placeholder="精确匹配" style="width: 190px" @press-enter="withdraw.search" />
            </a-form-item>
            <a-form-item label="商户">
              <a-select
                v-model:value="withdraw.query.merchantId"
                show-search
                allow-clear
                placeholder="输入名称搜索"
                style="width: 200px"
                :filter-option="false"
                :options="merchantOptions"
                :loading="merchantSearching"
                @search="searchMerchant"
              />
            </a-form-item>
            <a-form-item label="状态">
              <a-select v-model:value="withdraw.query.status" allow-clear placeholder="全部" style="width: 110px">
                <a-select-option v-for="(item, key) in WITHDRAW_STATUS" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="申请日期">
              <a-range-picker v-model:value="withdrawRange" value-format="YYYY-MM-DD" style="width: 240px" />
            </a-form-item>
            <a-form-item v-if="isSuper" label="站点">
              <SiteTreeSelect v-model:value="withdraw.query.siteId" allow-all style="width: 160px" />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="withdraw.search"><template #icon><SearchOutlined /></template>查询</a-button>
                <a-button @click="withdrawReset"><template #icon><ReloadOutlined /></template>重置</a-button>
              </a-space>
            </a-form-item>
          </a-form>
          <a-table
            :columns="withdrawColumns"
            :data-source="withdraw.list.value"
            :loading="withdraw.loading.value"
            :pagination="withdraw.pagination.value"
            row-key="id"
            size="middle"
            :scroll="{ x: 1400 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'amount'">{{ formatAmount(record.amount) }}</template>
              <template v-else-if="column.dataIndex === 'fee'">{{ formatAmount(record.fee) }}</template>
              <template v-else-if="column.dataIndex === 'actual_amount'">
                <span style="font-weight: 600">{{ formatAmount(record.actual_amount) }}</span>
              </template>
              <template v-else-if="column.dataIndex === 'account_type'">{{ ACCOUNT_TYPE_TEXT[record.account_type] ?? '-' }}</template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tooltip v-if="(record.status === 3 || record.status === 4) && record.audit_remark" :title="record.audit_remark">
                  <span><StatusTag :value="record.status" :map="WITHDRAW_STATUS" /></span>
                </a-tooltip>
                <StatusTag v-else :value="record.status" :map="WITHDRAW_STATUS" />
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-space :size="0">
                  <a-button type="link" size="small" @click="openWithdrawDetail(record)">详情</a-button>
                  <a-button
                    v-if="record.status === 0"
                    v-perm="'finance:msettle:confirm'"
                    type="link"
                    size="small"
                    @click="openAudit(record)"
                  >审核</a-button>
                  <a-button
                    v-if="record.status === 1"
                    v-perm="'finance:msettle:pay'"
                    type="link"
                    size="small"
                    @click="openPayResult(record)"
                  >打款结果</a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 结算单详情抽屉 -->
    <a-drawer v-model:open="settleDrawerOpen" title="结算单详情" width="560">
      <a-descriptions v-if="settleDetail" :column="2" size="small" bordered>
        <a-descriptions-item label="结算单号" :span="2">{{ settleDetail.settle_no }}</a-descriptions-item>
        <a-descriptions-item label="商户ID">{{ settleDetail.merchant_id }}</a-descriptions-item>
        <a-descriptions-item label="结算周期">{{ settleDetail.settle_cycle }}</a-descriptions-item>
        <a-descriptions-item label="订单数">{{ settleDetail.order_count }}</a-descriptions-item>
        <a-descriptions-item label="订单金额">{{ formatAmount(settleDetail.order_amount) }}</a-descriptions-item>
        <a-descriptions-item label="退款金额">{{ formatAmount(settleDetail.refund_amount) }}</a-descriptions-item>
        <a-descriptions-item label="平台佣金">{{ formatAmount(settleDetail.commission) }}</a-descriptions-item>
        <a-descriptions-item label="税费">{{ formatAmount(settleDetail.tax_amount) }}</a-descriptions-item>
        <a-descriptions-item label="应结算金额">
          <span style="color: var(--mtrip-error, #ff4d4f); font-weight: 600">{{ formatAmount(settleDetail.settle_amount) }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="状态"><StatusTag :value="settleDetail.status" :map="SETTLE_STATUS" /></a-descriptions-item>
        <a-descriptions-item label="确认时间">{{ settleDetail.confirm_time || '-' }}</a-descriptions-item>
        <a-descriptions-item label="打款时间">{{ settleDetail.pay_time || '-' }}</a-descriptions-item>
        <a-descriptions-item label="打款凭证">
          <a v-if="settleDetail.pay_voucher" :href="settleDetail.pay_voucher" target="_blank">查看凭证</a>
          <span v-else>-</span>
        </a-descriptions-item>
        <a-descriptions-item v-if="settleDetail.remark" label="备注/争议说明" :span="2">{{ settleDetail.remark }}</a-descriptions-item>
      </a-descriptions>
    </a-drawer>

    <!-- 提现详情抽屉 -->
    <a-drawer v-model:open="withdrawDrawerOpen" title="提现详情" width="560">
      <a-spin :spinning="withdrawDetailLoading">
        <a-descriptions v-if="withdrawDetail" :column="2" size="small" bordered>
          <a-descriptions-item label="提现单号" :span="2">{{ withdrawDetail.withdraw_no }}</a-descriptions-item>
          <a-descriptions-item label="商户ID">{{ withdrawDetail.merchant_id }}</a-descriptions-item>
          <a-descriptions-item label="状态"><StatusTag :value="withdrawDetail.status" :map="WITHDRAW_STATUS" /></a-descriptions-item>
          <a-descriptions-item label="提现金额">{{ formatAmount(withdrawDetail.amount) }}</a-descriptions-item>
          <a-descriptions-item label="手续费">{{ formatAmount(withdrawDetail.fee) }}</a-descriptions-item>
          <a-descriptions-item label="实际到账" :span="2">
            <span style="color: var(--mtrip-error, #ff4d4f); font-weight: 600">{{ formatAmount(withdrawDetail.actual_amount) }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="收款方式">{{ ACCOUNT_TYPE_TEXT[withdrawDetail.account_type] ?? '-' }}</a-descriptions-item>
          <a-descriptions-item label="打款流水号">{{ withdrawDetail.trade_no || '-' }}</a-descriptions-item>
          <a-descriptions-item label="收款账户信息" :span="2">{{ withdrawDetail.account_info || '-' }}</a-descriptions-item>
          <a-descriptions-item label="申请时间">{{ withdrawDetail.created_at }}</a-descriptions-item>
          <a-descriptions-item label="审核时间">{{ withdrawDetail.audit_time || '-' }}</a-descriptions-item>
          <a-descriptions-item label="打款时间">{{ withdrawDetail.pay_time || '-' }}</a-descriptions-item>
          <a-descriptions-item v-if="withdrawDetail.audit_remark" label="审核备注" :span="2">{{ withdrawDetail.audit_remark }}</a-descriptions-item>
        </a-descriptions>
      </a-spin>
    </a-drawer>

    <!-- 标记打款 Modal(结算单) -->
    <a-modal v-model:open="payOpen" title="标记打款" :confirm-loading="paySubmitting" @ok="submitPay">
      <a-alert type="warning" show-icon message="确认后结算单完结不可撤销,请核实打款已完成" style="margin-bottom: 16px" />
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="结算单号">{{ payForm.settleNo }}</a-form-item>
        <a-form-item label="结算金额">
          <span style="color: var(--mtrip-error, #ff4d4f); font-weight: 600">{{ formatAmount(payForm.settleAmount) }}</span>
        </a-form-item>
        <a-form-item label="打款凭证URL">
          <a-input v-model:value="payForm.payVoucher" :maxlength="255" placeholder="选填,凭证图片/文件地址" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 争议 Modal -->
    <a-modal
      v-model:open="disputeOpen"
      :title="disputeForm.mark ? '标记争议' : '解除争议'"
      :confirm-loading="disputeSubmitting"
      :ok-button-props="disputeForm.mark ? { danger: true } : undefined"
      @ok="submitDispute"
    >
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="结算单号">{{ disputeForm.settleNo }}</a-form-item>
        <a-form-item :label="disputeForm.mark ? '争议说明' : '处理说明'" :required="disputeForm.mark">
          <a-textarea v-model:value="disputeForm.remark" :rows="3" :maxlength="500" :placeholder="disputeForm.mark ? '必填,说明争议原因' : '选填'" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 提现审核 Modal -->
    <a-modal v-model:open="auditOpen" title="提现审核" :confirm-loading="auditSubmitting" @ok="submitAudit">
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="提现单号">{{ auditForm.withdrawNo }}</a-form-item>
        <a-form-item label="实际到账">
          <span style="color: var(--mtrip-error, #ff4d4f); font-weight: 600">{{ formatAmount(auditForm.actualAmount) }}</span>
        </a-form-item>
        <a-form-item label="审核结果" required>
          <a-radio-group v-model:value="auditForm.auditStatus">
            <a-radio :value="1">通过(进入打款中)</a-radio>
            <a-radio :value="2">驳回</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="审核意见" :required="auditForm.auditStatus === 2">
          <a-textarea v-model:value="auditForm.auditRemark" :rows="3" :maxlength="500" placeholder="驳回必填" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 打款结果 Modal -->
    <a-modal v-model:open="payResultOpen" title="确认打款结果" :confirm-loading="payResultSubmitting" @ok="submitPayResult">
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="提现单号">{{ payResultForm.withdrawNo }}</a-form-item>
        <a-form-item label="实际到账">
          <span style="color: var(--mtrip-error, #ff4d4f); font-weight: 600">{{ formatAmount(payResultForm.actualAmount) }}</span>
        </a-form-item>
        <a-form-item label="打款结果" required>
          <a-radio-group v-model:value="payResultForm.payStatus">
            <a-radio :value="1">打款成功</a-radio>
            <a-radio :value="2">打款失败</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="payResultForm.payStatus === 1" label="打款流水号">
          <a-input v-model:value="payResultForm.tradeNo" :maxlength="64" placeholder="选填,第三方流水号" />
        </a-form-item>
        <a-form-item v-if="payResultForm.payStatus === 2" label="失败原因" required>
          <a-textarea v-model:value="payResultForm.failReason" :rows="3" :maxlength="400" placeholder="必填" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped>
.tab-toolbar {
  margin-bottom: 16px;
}
</style>
