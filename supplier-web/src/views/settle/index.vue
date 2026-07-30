<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag, { type StatusItem } from '@/components/StatusTag.vue';
import AmountText from '@/components/AmountText.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { apiSettleDetail, apiSettleList } from '@/api/settle';

/** 对账结算(只读):账单由平台生成/审核/回款,供应商仅查看进度与明细 */
const { t } = useI18n();

const { loading, list, query, load, search, reset, pagination } = useTable(apiSettleList, {
  settleMonth: '',
  settleNo: '',
  status: undefined,
});

/** 结算状态:0待审核 1已审核 2已回款 3已驳回 */
const SETTLE_STATUS_MAP: Record<number, StatusItem> = {
  0: { text: t('settle.status.pending'), color: 'processing' },
  1: { text: t('settle.status.audited'), color: 'cyan' },
  2: { text: t('settle.status.paid'), color: 'success' },
  3: { text: t('settle.status.rejected'), color: 'error' },
};

const columns = [
  { title: t('settle.settleNo'), dataIndex: 'settle_no', width: 190 },
  { title: t('settle.settleMonth'), dataIndex: 'settle_month', width: 110 },
  { title: t('settle.orderCount'), dataIndex: 'order_count', width: 100 },
  { title: t('settle.supplyAmount'), dataIndex: 'supply_amount', width: 130 },
  { title: t('settle.shareAmount'), dataIndex: 'share_amount', width: 130 },
  { title: t('settle.settleAmount'), dataIndex: 'settle_amount', width: 130 },
  { title: t('common.status'), dataIndex: 'status', width: 100 },
  { title: t('common.action'), key: 'action', width: 90, fixed: 'right' as const },
];

// ---------- 详情 ----------
const detailOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<Record<string, unknown>>({});

async function openDetail(row: TableRow): Promise<void> {
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    const res = await apiSettleDetail(row.id);
    detail.value = res.settle ?? {};
  } finally {
    detailLoading.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('settle.settleMonth')">
          <a-input v-model:value="query.settleMonth" placeholder="YYYY-MM" allow-clear style="width: 140px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('settle.settleNo')">
          <a-input v-model:value="query.settleNo" :placeholder="t('common.pleaseInput')" allow-clear style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 130px">
            <a-select-option :value="0">{{ t('settle.status.pending') }}</a-select-option>
            <a-select-option :value="1">{{ t('settle.status.audited') }}</a-select-option>
            <a-select-option :value="2">{{ t('settle.status.paid') }}</a-select-option>
            <a-select-option :value="3">{{ t('settle.status.rejected') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>{{ t('menu.settle') }}</template>
      <a-alert type="info" show-icon :message="t('settle.readonlyTip')" style="margin-bottom: 12px" />
      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :scroll="{ x: 1080 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'supply_amount'">
            <AmountText :value="record.supply_amount" />
          </template>
          <template v-else-if="column.dataIndex === 'share_amount'">
            <AmountText :value="record.share_amount" type="commission" />
          </template>
          <template v-else-if="column.dataIndex === 'settle_amount'">
            <AmountText :value="record.settle_amount" type="income" />
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="SETTLE_STATUS_MAP" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情 -->
    <a-drawer v-model:open="detailOpen" :title="t('settle.detailTitle')" width="480">
      <a-spin :spinning="detailLoading">
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item :label="t('settle.settleNo')">{{ detail.settle_no }}</a-descriptions-item>
          <a-descriptions-item :label="t('settle.settleMonth')">{{ detail.settle_month }}</a-descriptions-item>
          <a-descriptions-item :label="t('settle.orderCount')">{{ detail.order_count }}</a-descriptions-item>
          <a-descriptions-item :label="t('settle.supplyAmount')"><AmountText :value="(detail.supply_amount as number) ?? 0" /></a-descriptions-item>
          <a-descriptions-item :label="t('settle.shareAmount')"><AmountText :value="(detail.share_amount as number) ?? 0" type="commission" /></a-descriptions-item>
          <a-descriptions-item :label="t('settle.settleAmount')"><AmountText :value="(detail.settle_amount as number) ?? 0" type="income" /></a-descriptions-item>
          <a-descriptions-item :label="t('common.status')"><StatusTag :value="(detail.status as number) ?? 0" :map="SETTLE_STATUS_MAP" /></a-descriptions-item>
          <a-descriptions-item :label="t('settle.auditTime')">{{ detail.audit_time || '-' }}</a-descriptions-item>
          <a-descriptions-item :label="t('settle.payTime')">{{ detail.pay_time || '-' }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.remark')">{{ detail.remark || '-' }}</a-descriptions-item>
        </a-descriptions>
      </a-spin>
    </a-drawer>
  </PageContainer>
</template>
