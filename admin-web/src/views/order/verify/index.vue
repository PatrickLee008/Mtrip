<script setup lang="ts">
import { reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { CheckCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiMerchantList } from '@/api/merchant';
import { apiVerify, apiVerifyCancel, apiVerifyLogs } from '@/api/order';

/**
 * 核销记录:后台手工核销 / 撤销核销(需审批备注) / 核销日志
 * 核销:仅已支付且使用日期已到,订单 1→2,日志 verify_type=3 后台手工
 * 撤销:订单 2→1,原成功日志置 3已撤销(永久留痕)
 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const VERIFY_TYPE_TEXT: Record<number, string> = { 1: '设备核销', 2: '商户核销', 3: '后台手工' };

// 核销日期区间
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

const columns = [
  { title: '订单号', dataIndex: 'order_no', width: 200 },
  { title: '核销码', dataIndex: 'verify_code', width: 140 },
  { title: '方式', dataIndex: 'verify_type', width: 100 },
  { title: '操作人', dataIndex: 'operator_name', width: 120, ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '撤销原因', dataIndex: 'revoke_reason', width: 200, ellipsis: true },
  { title: '核销时间', dataIndex: 'created_at', width: 165 },
  { title: '操作', key: 'action_col', width: 100, fixed: 'right' as const },
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

// ---------- 手工核销(按核销码) ----------
const verifyCode = ref('');
const verifying = ref(false);

async function doVerify(): Promise<void> {
  const code = verifyCode.value.trim();
  if (!code) {
    message.warning('请输入核销码');
    return;
  }
  verifying.value = true;
  try {
    await apiVerify({ verifyCode: code });
    message.success('核销成功');
    verifyCode.value = '';
    void load();
  } finally {
    verifying.value = false;
  }
}

// ---------- 撤销核销(必填原因) ----------
const revokeOpen = ref(false);
const revokeSubmitting = ref(false);
const revokeForm = reactive({ orderId: 0, orderNo: '', reason: '' });

function openRevoke(row: TableRow): void {
  revokeForm.orderId = row.order_id;
  revokeForm.orderNo = row.order_no;
  revokeForm.reason = '';
  revokeOpen.value = true;
}

async function submitRevoke(): Promise<void> {
  if (!revokeForm.reason.trim()) {
    message.warning('请填写撤销原因(审批备注)');
    return;
  }
  revokeSubmitting.value = true;
  try {
    await apiVerifyCancel({ id: revokeForm.orderId, reason: revokeForm.reason.trim() });
    message.success('核销已撤销,订单恢复已支付');
    revokeOpen.value = false;
    void load();
  } finally {
    revokeSubmitting.value = false;
  }
}
</script>

<template>
  <PageContainer>
    <!-- 手工核销 -->
    <a-card :bordered="false" class="mtrip-card-shadow" title="手工核销" style="margin-bottom: 16px">
      <a-space>
        <a-input
          v-model:value="verifyCode"
          allow-clear
          placeholder="输入核销码(仅已支付且使用日期已到的订单)"
          style="width: 360px"
          @press-enter="doVerify"
        />
        <a-button v-perm="'order:verify:list'" type="primary" :loading="verifying" @click="doVerify">
          <template #icon><CheckCircleOutlined /></template>核销
        </a-button>
      </a-space>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="订单号">
          <a-input v-model:value="query.orderNo" allow-clear placeholder="精确匹配" style="width: 200px" @press-enter="search" />
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
        <a-form-item label="核销方式">
          <a-select v-model:value="query.verifyType" allow-clear placeholder="全部" style="width: 120px">
            <a-select-option :value="1">设备核销</a-select-option>
            <a-select-option :value="2">商户核销</a-select-option>
            <a-select-option :value="3">后台手工</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 100px">
            <a-select-option :value="1">成功</a-select-option>
            <a-select-option :value="3">已撤销</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="核销日期">
          <a-range-picker v-model:value="dateRange" value-format="YYYY-MM-DD" style="width: 240px" />
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

    <a-card :bordered="false" class="mtrip-card-shadow" title="核销日志">
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
            <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? '成功' : '已撤销' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-button
              v-if="record.status === 1"
              v-perm="'order:verify:revoke'"
              type="link"
              size="small"
              danger
              @click="openRevoke(record)"
            >撤销</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 撤销核销 Modal -->
    <a-modal
      v-model:open="revokeOpen"
      title="撤销核销"
      :confirm-loading="revokeSubmitting"
      :ok-button-props="{ danger: true }"
      ok-text="确认撤销"
      @ok="submitRevoke"
    >
      <a-alert type="warning" show-icon message="撤销后订单恢复已支付,原核销日志置为已撤销永久留痕" style="margin-bottom: 16px" />
      <a-form :label-col="{ span: 6 }">
        <a-form-item label="订单号">{{ revokeForm.orderNo }}</a-form-item>
        <a-form-item label="撤销原因" required>
          <a-textarea v-model:value="revokeForm.reason" :rows="3" :maxlength="500" placeholder="必填,审批备注" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
