<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { CheckCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
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
const { t } = useI18n();

const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const VERIFY_TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('order.verifyType.qrcode'),
  2: t('order.verifyType.manual'),
  3: t('order.verifyType.manual'),
}));

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
  { title: t('order.orderNo'), dataIndex: 'order_no', width: 200 },
  { title: t('order.verify.code'), dataIndex: 'verify_code', width: 140 },
  { title: t('order.verifyLog.verifyType'), dataIndex: 'verify_type', width: 100 },
  { title: t('order.verifyLog.operator'), dataIndex: 'operator_name', width: 120, ellipsis: true },
  { title: t('order.status'), dataIndex: 'status', width: 90 },
  { title: t('order.verifyLog.revokeReason'), dataIndex: 'revoke_reason', width: 200, ellipsis: true },
  { title: t('order.verifyLog.time'), dataIndex: 'created_at', width: 165 },
  { title: t('common.action'), key: 'action_col', width: 100, fixed: 'right' as const },
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
    message.warning(t('order.verify.verifyModal.codePlaceholder'));
    return;
  }
  verifying.value = true;
  try {
    await apiVerify({ verifyCode: code });
    message.success(t('order.verify.verifyModal.success'));
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
    message.warning(t('order.verify.revokeReasonRequired'));
    return;
  }
  revokeSubmitting.value = true;
  try {
    await apiVerifyCancel({ id: revokeForm.orderId, reason: revokeForm.reason.trim() });
    message.success(t('order.verify.revokeSuccess'));
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
    <a-card :bordered="false" class="mtrip-card-shadow" :title="t('order.verify.manualVerify')" style="margin-bottom: 16px">
      <a-space>
        <a-input
          v-model:value="verifyCode"
          allow-clear
          :placeholder="t('order.verify.codeInputPlaceholder')"
          style="width: 360px"
          @press-enter="doVerify"
        />
        <a-button v-perm="'order:verify:list'" type="primary" :loading="verifying" @click="doVerify">
          <template #icon><CheckCircleOutlined /></template>{{ t('order.verify.actions.verify') }}
        </a-button>
      </a-space>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('order.orderNo')">
          <a-input v-model:value="query.orderNo" allow-clear :placeholder="t('common.pleaseInput')" style="width: 200px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('merchant.list')">
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
            <a-select-option :value="1">{{ t('order.verifyType.qrcode') }}</a-select-option>
            <a-select-option :value="2">{{ t('order.verifyType.manual') }}</a-select-option>
            <a-select-option :value="3">{{ t('order.verifyType.manual') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('order.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 100px">
            <a-select-option :value="1">{{ t('common.success') }}</a-select-option>
            <a-select-option :value="3">{{ t('order.verifyLog.revoked') }}</a-select-option>
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
            <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? t('common.success') : t('order.verifyLog.revoked') }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-button
              v-if="record.status === 1"
              v-perm="'order:verify:revoke'"
              type="link"
              size="small"
              danger
              @click="openRevoke(record)"
            >{{ t('order.verify.actions.cancel') }}</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 撤销核销 Modal -->
    <a-modal
      v-model:open="revokeOpen"
      :title="t('order.verify.actions.cancel')"
      :confirm-loading="revokeSubmitting"
      :ok-button-props="{ danger: true }"
      :ok-text="t('order.verify.confirmRevoke')"
      @ok="submitRevoke"
    >
      <a-alert type="warning" show-icon :message="t('order.verify.revokeNotice')" style="margin-bottom: 16px" />
      <a-form :label-col="{ span: 6 }">
        <a-form-item :label="t('order.orderNo')">{{ revokeForm.orderNo }}</a-form-item>
        <a-form-item :label="t('order.verifyLog.revokeReason')" required>
          <a-textarea v-model:value="revokeForm.reason" :rows="3" :maxlength="500" :placeholder="t('common.required')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
