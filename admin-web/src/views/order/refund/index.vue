<script setup lang="ts">
import { reactive, ref } from 'vue';
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
import { apiRefundAudit, apiRefundConfirm, apiRefundDetail, apiRefundList } from '@/api/order';

/**
 * 退款审核(文档 6.4.1)
 * 状态机:0待商户审核 →(通过)1待平台审核 →(通过)2退款中(可核定金额)→(到账确认)3已退款
 *        0/1驳回→4已驳回(订单恢复已支付);5已撤销(用户侧)
 * 平台后台可代商户审核;到账确认后全额退款关闭订单并回补库存
 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const STATUS_MAP: Record<number, StatusItem> = {
  0: { text: '待商户审核', color: 'warning' },
  1: { text: '待平台审核', color: 'orange' },
  2: { text: '退款中', color: 'processing' },
  3: { text: '已退款', color: 'success' },
  4: { text: '已驳回', color: 'error' },
  5: { text: '已撤销', color: 'default' },
};
const ORDER_STATUS_MAP: Record<number, StatusItem> = {
  0: { text: '待支付', color: 'warning' },
  1: { text: '已支付', color: 'processing' },
  2: { text: '已核销', color: 'cyan' },
  3: { text: '已完成', color: 'success' },
  4: { text: '已取消', color: 'default' },
  5: { text: '退款中', color: 'orange' },
  6: { text: '已退款', color: 'purple' },
  7: { text: '已过期', color: 'default' },
};

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
  { title: '退款单号', dataIndex: 'refund_no', width: 200 },
  { title: '订单号', dataIndex: 'order_no', width: 200 },
  { title: '申请金额', dataIndex: 'apply_amount', width: 100 },
  { title: '实退金额', dataIndex: 'refund_amount', width: 100 },
  { title: '退款原因', dataIndex: 'reason', width: 180, ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 110 },
  { title: '申请时间', dataIndex: 'created_at', width: 165 },
  { title: '操作', key: 'action_col', width: 180, fixed: 'right' as const },
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
    message.warning('驳回必须填写原因');
    return;
  }
  if (auditForm.auditStatus === 1 && auditForm.stage === 1
    && (auditForm.refundAmount <= 0 || auditForm.refundAmount > auditForm.applyAmount)) {
    message.warning('核定退款金额须大于0且不超过申请金额');
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
    message.success(auditForm.auditStatus === 2 ? '退款已驳回,订单恢复已支付' : '审核通过');
    auditOpen.value = false;
    void load();
  } finally {
    auditSubmitting.value = false;
  }
}

// ---------- 到账确认 Modal ----------
const confirmOpen = ref(false);
const confirmSubmitting = ref(false);
const confirmForm = reactive({ id: 0, refundNo: '', refundAmount: 0, refundTradeNo: '' });

function openConfirm(row: TableRow): void {
  confirmForm.id = row.id;
  confirmForm.refundNo = row.refund_no;
  confirmForm.refundAmount = Number(row.refund_amount);
  confirmForm.refundTradeNo = '';
  confirmOpen.value = true;
}

async function submitConfirm(): Promise<void> {
  confirmSubmitting.value = true;
  try {
    await apiRefundConfirm({
      id: confirmForm.id,
      refundTradeNo: confirmForm.refundTradeNo.trim() || undefined,
    });
    message.success('退款到账已确认');
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
        <a-form-item label="退款单号">
          <a-input v-model:value="query.refundNo" allow-clear placeholder="精确匹配" style="width: 190px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="订单号">
          <a-input v-model:value="query.orderNo" allow-clear placeholder="精确匹配" style="width: 190px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 130px">
            <a-select-option v-for="(item, key) in STATUS_MAP" :key="key" :value="Number(key)">{{ item.text }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="商户">
          <a-select
            v-model:value="query.merchantId"
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
        <a-form-item label="申请日期">
          <a-range-picker v-model:value="createdRange" value-format="YYYY-MM-DD" style="width: 240px" />
        </a-form-item>
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="doReset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" title="退款审核">
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
          <template v-if="column.dataIndex === 'apply_amount'">{{ formatAmount(record.apply_amount) }}</template>
          <template v-else-if="column.dataIndex === 'refund_amount'">
            {{ record.status >= 2 && record.status <= 3 ? formatAmount(record.refund_amount) : '-' }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tooltip v-if="record.status === 4 && record.audit_remark" :title="`驳回原因:${record.audit_remark}`">
              <span><StatusTag :value="record.status" :map="STATUS_MAP" /></span>
            </a-tooltip>
            <StatusTag v-else :value="record.status" :map="STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
              <a-button
                v-if="record.status === 0 || record.status === 1"
                v-perm="'order:refund:audit'"
                type="link"
                size="small"
                @click="openAudit(record)"
              >审核</a-button>
              <a-button
                v-if="record.status === 2"
                v-perm="'order:refund:audit'"
                type="link"
                size="small"
                @click="openConfirm(record)"
              >到账确认</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" title="退款单详情" width="720">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item label="退款单号" :span="2">{{ detail.refund_no }}</a-descriptions-item>
            <a-descriptions-item label="状态"><StatusTag :value="detail.status" :map="STATUS_MAP" /></a-descriptions-item>
            <a-descriptions-item label="申请金额">{{ formatAmount(detail.apply_amount) }}</a-descriptions-item>
            <a-descriptions-item label="实退金额">{{ detail.status >= 2 ? formatAmount(detail.refund_amount) : '-' }}</a-descriptions-item>
            <a-descriptions-item label="扣减金额">{{ detail.status >= 2 ? formatAmount(detail.deduct_amount) : '-' }}</a-descriptions-item>
            <a-descriptions-item label="退款原因" :span="2">{{ detail.reason || '-' }}</a-descriptions-item>
            <a-descriptions-item v-if="detail.audit_remark" label="审核意见" :span="2">{{ detail.audit_remark }}</a-descriptions-item>
            <a-descriptions-item v-if="detail.refund_trade_no" label="退款流水号" :span="2">{{ detail.refund_trade_no }}</a-descriptions-item>
            <a-descriptions-item label="申请时间">{{ detail.created_at }}</a-descriptions-item>
            <a-descriptions-item label="退款时间">{{ detail.refund_time || '-' }}</a-descriptions-item>
          </a-descriptions>
          <template v-if="Array.isArray(detail.images) && detail.images.length">
            <a-divider orientation="left">凭证图片</a-divider>
            <a-image-preview-group>
              <a-space wrap>
                <a-image v-for="(img, idx) in detail.images" :key="idx" :src="img" :width="88" :height="66" style="object-fit: cover; border-radius: 4px" />
              </a-space>
            </a-image-preview-group>
          </template>
          <template v-if="detailOrder">
            <a-divider orientation="left">订单快照</a-divider>
            <a-descriptions :column="2" size="small" bordered>
              <a-descriptions-item label="订单号" :span="2">{{ detailOrder.order_no }}</a-descriptions-item>
              <a-descriptions-item label="订单状态"><StatusTag :value="detailOrder.order_status" :map="ORDER_STATUS_MAP" /></a-descriptions-item>
              <a-descriptions-item label="联系人">{{ detailOrder.contact_name }}</a-descriptions-item>
              <a-descriptions-item label="商品" :span="2">{{ detailOrder.goods_name }} / {{ detailOrder.sku_name }} × {{ detailOrder.quantity }}</a-descriptions-item>
              <a-descriptions-item label="订单总额">{{ formatAmount(detailOrder.total_amount) }}</a-descriptions-item>
              <a-descriptions-item label="实付金额">{{ formatAmount(detailOrder.pay_amount) }}</a-descriptions-item>
              <a-descriptions-item label="使用日期">{{ detailOrder.use_date || '-' }}</a-descriptions-item>
              <a-descriptions-item label="支付时间">{{ detailOrder.pay_time || '-' }}</a-descriptions-item>
            </a-descriptions>
          </template>
        </template>
      </a-spin>
    </a-drawer>

    <!-- 审核 Modal -->
    <a-modal v-model:open="auditOpen" title="退款审核" :confirm-loading="auditSubmitting" @ok="submitAudit">
      <a-alert
        type="info"
        show-icon
        :message="auditForm.stage === 0 ? '当前环节:商户审核(通过后进入平台审核)' : '当前环节:平台审核(通过后进入退款中,可核定实退金额)'"
        style="margin-bottom: 16px"
      />
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="退款单号">{{ auditForm.refundNo }}</a-form-item>
        <a-form-item label="申请金额">
          <span style="color: var(--mtrip-error, #ff4d4f); font-weight: 600">{{ formatAmount(auditForm.applyAmount) }}</span>
        </a-form-item>
        <a-form-item label="审核结果" required>
          <a-radio-group v-model:value="auditForm.auditStatus">
            <a-radio :value="1">通过</a-radio>
            <a-radio :value="2">驳回</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="auditForm.auditStatus === 1 && auditForm.stage === 1" label="核定退款金额" required>
          <a-input-number
            v-model:value="auditForm.refundAmount"
            :min="0.01"
            :max="auditForm.applyAmount"
            :precision="2"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="审核意见" :required="auditForm.auditStatus === 2">
          <a-textarea v-model:value="auditForm.auditRemark" :rows="3" :maxlength="500" placeholder="驳回必填" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 到账确认 Modal -->
    <a-modal v-model:open="confirmOpen" title="确认退款到账" :confirm-loading="confirmSubmitting" @ok="submitConfirm">
      <a-alert type="warning" show-icon message="确认后退款单完结;全额退款将关闭订单并回补库存,部分退款订单继续有效" style="margin-bottom: 16px" />
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="退款单号">{{ confirmForm.refundNo }}</a-form-item>
        <a-form-item label="实退金额">
          <span style="color: var(--mtrip-error, #ff4d4f); font-weight: 600">{{ formatAmount(confirmForm.refundAmount) }}</span>
        </a-form-item>
        <a-form-item label="退款流水号">
          <a-input v-model:value="confirmForm.refundTradeNo" :maxlength="64" placeholder="选填,第三方渠道退款流水号" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
