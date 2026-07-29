<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
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

const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const STATUS_MAP: Record<number, StatusItem> = {
  0: { text: '待支付', color: 'warning' },
  1: { text: '已支付', color: 'processing' },
  2: { text: '已核销', color: 'cyan' },
  3: { text: '已完成', color: 'success' },
  4: { text: '已取消', color: 'default' },
  5: { text: '退款中', color: 'orange' },
  6: { text: '已退款', color: 'purple' },
  7: { text: '已过期', color: 'default' },
};
const REFUND_STATUS_MAP: Record<number, StatusItem> = {
  0: { text: '待商户审核', color: 'warning' },
  1: { text: '待平台审核', color: 'orange' },
  2: { text: '退款中', color: 'processing' },
  3: { text: '已退款', color: 'success' },
  4: { text: '已驳回', color: 'error' },
  5: { text: '已撤销', color: 'default' },
};
const ORDER_TYPE_TEXT: Record<number, string> = { 1: '酒店', 2: '门票' };
const PAY_METHOD_TEXT: Record<number, string> = { 0: '未支付', 1: 'Stripe', 2: 'PayPal', 3: '余额', 4: '模拟支付' };
const VERIFY_TYPE_TEXT: Record<number, string> = { 1: '设备核销', 2: '商户核销', 3: '后台手工' };

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
  { title: '订单号', dataIndex: 'order_no', width: 200 },
  ...(props.orderType === 0 ? [{ title: '类型', dataIndex: 'order_type', width: 70 }] : []),
  { title: '商品', dataIndex: 'goods_name', width: 200, ellipsis: true },
  { title: '规格', dataIndex: 'sku_name', width: 120, ellipsis: true },
  { title: '数量', dataIndex: 'quantity', width: 60 },
  { title: '实付', dataIndex: 'pay_amount', width: 100 },
  { title: '联系人', dataIndex: 'contact_name', width: 100, ellipsis: true },
  { title: '手机号', dataIndex: 'contact_phone', width: 120 },
  { title: '使用日期', dataIndex: 'use_date', width: 105 },
  { title: '状态', dataIndex: 'order_status', width: 90 },
  { title: '下单时间', dataIndex: 'created_at', width: 165 },
  { title: '操作', key: 'action_col', width: 200, fixed: 'right' as const },
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
    message.warning('实付金额须在 0 与订单总额之间');
    return;
  }
  if (!priceForm.reason.trim()) {
    message.warning('请填写改价原因');
    return;
  }
  priceSubmitting.value = true;
  try {
    await apiOrderModifyPrice({ id: priceForm.id, payAmount: priceForm.payAmount, reason: priceForm.reason.trim() });
    message.success('订单已改价');
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
    message.warning('请填写取消原因');
    return;
  }
  cancelSubmitting.value = true;
  try {
    await apiOrderCancel({ id: cancelForm.id, reason: cancelForm.reason.trim() });
    message.success('订单已取消,库存已释放');
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
    message.warning('请填写备注内容');
    return;
  }
  remarkSubmitting.value = true;
  try {
    await apiOrderRemark({ id: remarkForm.id, remark: remarkForm.remark.trim() });
    message.success('备注已更新');
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
      message.warning('当前筛选条件下没有可导出的订单');
      return;
    }
    exportCsv(`订单导出_${new Date().toISOString().slice(0, 10)}`, [
      { title: '订单号', key: 'order_no' },
      { title: '类型', key: 'order_type', format: (row) => ORDER_TYPE_TEXT[row.order_type] ?? String(row.order_type) },
      { title: '商品', key: 'goods_name' },
      { title: '规格', key: 'sku_name' },
      { title: '数量', key: 'quantity' },
      { title: '订单总额', key: 'total_amount' },
      { title: '实付金额', key: 'pay_amount' },
      { title: '平台佣金', key: 'platform_commission' },
      { title: '联系人', key: 'contact_name' },
      { title: '手机号', key: 'contact_phone' },
      { title: '使用日期', key: 'use_date' },
      { title: '状态', key: 'order_status', format: (row) => STATUS_MAP[row.order_status]?.text ?? String(row.order_status) },
      { title: '支付方式', key: 'pay_method', format: (row) => PAY_METHOD_TEXT[row.pay_method] ?? '-' },
      { title: '下单时间', key: 'created_at' },
    ], data.list);
    message.success(`已导出 ${data.list.length} 条订单`);
  } finally {
    exporting.value = false;
  }
}

const pageTitle = computed(() => (props.orderType === 1 ? '酒店订单' : props.orderType === 2 ? '门票订单' : '全部订单'));
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="订单号">
          <a-input v-model:value="query.orderNo" allow-clear placeholder="精确匹配" style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.orderStatus" allow-clear placeholder="全部" style="width: 110px">
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
        <a-form-item label="联系人">
          <a-input v-model:value="query.contactName" allow-clear placeholder="模糊匹配" style="width: 130px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="下单日期">
          <a-range-picker v-model:value="createdRange" value-format="YYYY-MM-DD" style="width: 240px" />
        </a-form-item>
        <a-form-item label="使用日期">
          <a-date-picker v-model:value="query.useDate" value-format="YYYY-MM-DD" style="width: 130px" />
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

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>{{ pageTitle }}</template>
      <template #extra>
        <a-button v-perm="'order:all:export'" :loading="exporting" @click="exportOrders">
          <template #icon><DownloadOutlined /></template>导出 CSV
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
              <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
              <a-button
                v-if="record.order_status === 0"
                v-perm="'order:all:cancel'"
                type="link"
                size="small"
                @click="openPrice(record)"
              >改价</a-button>
              <a-button
                v-if="record.order_status === 0"
                v-perm="'order:all:cancel'"
                type="link"
                size="small"
                danger
                @click="openCancel(record)"
              >取消</a-button>
              <a-button type="link" size="small" @click="openRemark(record)">备注</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawerOpen" title="订单详情" width="760">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item label="订单号" :span="2">{{ detail.order_no }}</a-descriptions-item>
            <a-descriptions-item label="状态"><StatusTag :value="detail.order_status" :map="STATUS_MAP" /></a-descriptions-item>
            <a-descriptions-item label="类型">{{ ORDER_TYPE_TEXT[detail.order_type] ?? '-' }}</a-descriptions-item>
            <a-descriptions-item label="商品" :span="2">{{ detail.goods_name }} / {{ detail.sku_name }} × {{ detail.quantity }}</a-descriptions-item>
            <a-descriptions-item label="订单总额">{{ formatAmount(detail.total_amount) }}</a-descriptions-item>
            <a-descriptions-item label="实付金额">{{ formatAmount(detail.pay_amount) }}</a-descriptions-item>
            <a-descriptions-item label="优惠金额">{{ formatAmount(detail.discount_amount) }}</a-descriptions-item>
            <a-descriptions-item label="平台佣金">{{ formatAmount(detail.platform_commission) }}</a-descriptions-item>
            <a-descriptions-item label="联系人">{{ detail.contact_name }}</a-descriptions-item>
            <a-descriptions-item label="手机号">{{ detail.contact_phone }}</a-descriptions-item>
            <a-descriptions-item label="使用日期">{{ detail.use_date || '-' }}</a-descriptions-item>
            <a-descriptions-item label="离店日期">{{ detail.end_date || '-' }}</a-descriptions-item>
            <a-descriptions-item label="支付方式">{{ PAY_METHOD_TEXT[detail.pay_method] ?? '-' }}</a-descriptions-item>
            <a-descriptions-item label="支付时间">{{ detail.pay_time || '-' }}</a-descriptions-item>
            <a-descriptions-item label="核销码">{{ detail.verify_code || '-' }}</a-descriptions-item>
            <a-descriptions-item label="下单时间">{{ detail.created_at }}</a-descriptions-item>
            <a-descriptions-item v-if="detail.cancel_reason" label="取消原因" :span="2">{{ detail.cancel_reason }}</a-descriptions-item>
            <a-descriptions-item v-if="detail.remark" label="备注" :span="2">{{ detail.remark }}</a-descriptions-item>
          </a-descriptions>
          <a-divider orientation="left">退款单({{ detailRefunds.length }})</a-divider>
          <a-table
            :columns="[
              { title: '退款单号', dataIndex: 'refund_no', width: 190 },
              { title: '申请金额', dataIndex: 'apply_amount', width: 100 },
              { title: '实退金额', dataIndex: 'refund_amount', width: 100 },
              { title: '状态', dataIndex: 'status', width: 110 },
              { title: '申请时间', dataIndex: 'created_at', width: 160 },
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
          <a-divider orientation="left">核销日志({{ detailVerifyLogs.length }})</a-divider>
          <a-table
            :columns="[
              { title: '方式', dataIndex: 'verify_type', width: 100 },
              { title: '操作人', dataIndex: 'operator_name', width: 120 },
              { title: '状态', dataIndex: 'status', width: 90 },
              { title: '撤销原因', dataIndex: 'revoke_reason', ellipsis: true },
              { title: '时间', dataIndex: 'created_at', width: 160 },
            ]"
            :data-source="detailVerifyLogs"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'verify_type'">{{ VERIFY_TYPE_TEXT[record.verify_type] ?? '-' }}</template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? '成功' : '已撤销' }}</a-tag>
              </template>
            </template>
          </a-table>
        </template>
      </a-spin>
    </a-drawer>

    <!-- 改价 Modal -->
    <a-modal v-model:open="priceOpen" title="订单改价" :confirm-loading="priceSubmitting" @ok="submitPrice">
      <a-alert type="warning" show-icon message="仅待支付订单可改价,新实付不得高于订单总额,差额记入优惠" style="margin-bottom: 16px" />
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="订单号">{{ priceForm.orderNo }}</a-form-item>
        <a-form-item label="订单总额">{{ formatAmount(priceForm.totalAmount) }}</a-form-item>
        <a-form-item label="新实付金额" required>
          <a-input-number v-model:value="priceForm.payAmount" :min="0" :max="priceForm.totalAmount" :precision="2" style="width: 100%" />
        </a-form-item>
        <a-form-item label="改价原因" required>
          <a-textarea v-model:value="priceForm.reason" :rows="3" :maxlength="200" placeholder="必填,记入订单备注" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 取消 Modal -->
    <a-modal
      v-model:open="cancelOpen"
      title="取消订单"
      :confirm-loading="cancelSubmitting"
      :ok-button-props="{ danger: true }"
      ok-text="确认取消"
      @ok="submitCancel"
    >
      <a-alert type="warning" show-icon message="仅待支付订单可直接取消(释放锁定库存),已支付请走退款流程" style="margin-bottom: 16px" />
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="订单号">{{ cancelForm.orderNo }}</a-form-item>
        <a-form-item label="取消原因" required>
          <a-textarea v-model:value="cancelForm.reason" :rows="3" :maxlength="200" placeholder="必填" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 备注 Modal -->
    <a-modal v-model:open="remarkOpen" title="订单备注" :confirm-loading="remarkSubmitting" @ok="submitRemark">
      <a-form :label-col="{ span: 5 }">
        <a-form-item label="订单号">{{ remarkForm.orderNo }}</a-form-item>
        <a-form-item label="备注内容" required>
          <a-textarea v-model:value="remarkForm.remark" :rows="4" :maxlength="500" show-count />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
