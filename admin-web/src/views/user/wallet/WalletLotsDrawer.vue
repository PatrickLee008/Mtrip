<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatAmount } from '@/utils/format';
import type { TableRow } from '@/composables/useTable';
import { apiWalletLots } from '@/api/user';

/**
 * 某用户的钱包额度批次(Super Admin PRD 模块 25「查看用户钱包余额及各笔退款额度的到期信息」):
 * 每笔入账一行(来源、入账金额、剩余、到期时间、状态),顶部汇总当前余额 / 可用 / 累计已过期。
 */
const props = defineProps<{ open: boolean; userId: number; title?: string }>();
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>();
const { t } = useI18n();

const loading = ref(false);
const summary = ref({ balance: '0.00', activeAmount: '0.00', expiredAmount: '0.00' });
const lots = ref<TableRow[]>([]);
const STATUS_COLORS: Record<number, string> = { 1: 'success', 2: 'default', 3: 'error' };

function onOpenChange(v: boolean): void {
  emit('update:open', v);
}

const columns = computed(() => [
  { title: t('user.walletPage.lotSource'), dataIndex: 'change_type', width: 130 },
  { title: t('user.walletPage.lotAmount'), dataIndex: 'amount', width: 120, align: 'right' as const },
  { title: t('user.walletPage.lotRemaining'), dataIndex: 'remaining', width: 120, align: 'right' as const },
  { title: t('user.walletPage.expiresAt'), dataIndex: 'expires_at', width: 165 },
  { title: t('user.walletPage.lotStatus'), dataIndex: 'status', width: 90 },
  { title: t('user.walletPage.time'), dataIndex: 'created_at', width: 165 },
]);

watch(
  () => [props.open, props.userId],
  async ([open]) => {
    if (!open || !props.userId) return;
    loading.value = true;
    try {
      const data = await apiWalletLots(props.userId);
      summary.value = { balance: data.balance, activeAmount: data.activeAmount, expiredAmount: data.expiredAmount };
      lots.value = data.lots;
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <a-drawer :open="open" :title="title || t('user.walletPage.lotsTitle')" width="820" @update:open="onOpenChange">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="8"><a-statistic :title="t('merchant.accountPage.balance')" :value="formatAmount(summary.balance)" /></a-col>
        <a-col :span="8"><a-statistic :title="t('user.walletPage.activeAmount')" :value="formatAmount(summary.activeAmount)" :value-style="{ color: '#00A66F' }" /></a-col>
        <a-col :span="8"><a-statistic :title="t('user.walletPage.expiredAmount')" :value="formatAmount(summary.expiredAmount)" /></a-col>
      </a-row>
      <a-table :columns="columns" :data-source="lots" row-key="id" size="small" :pagination="false" :scroll="{ x: 780 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'change_type'">{{ t(`user.walletPage.lotSources.${record.change_type}`) }}</template>
          <template v-else-if="column.dataIndex === 'amount'">{{ formatAmount(record.amount) }}</template>
          <template v-else-if="column.dataIndex === 'remaining'">{{ formatAmount(record.remaining) }}</template>
          <template v-else-if="column.dataIndex === 'expires_at'">{{ record.expires_at || t('user.walletPage.neverExpires') }}</template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="STATUS_COLORS[record.status] || 'default'">{{ t(`user.walletPage.lotStatuses.${record.status}`) }}</a-tag>
          </template>
        </template>
      </a-table>
    </a-spin>
  </a-drawer>
</template>
