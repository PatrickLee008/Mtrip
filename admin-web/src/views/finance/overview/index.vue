<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ReloadOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { formatAmount } from '@/utils/format';
import { apiFinanceOverview, type FinanceOverview } from '@/api/finance';

/**
 * 资金总览(文档 6.4.5):今日/本月/累计 收支三卡片 + 待办数量
 * finance_flow 月分表路由归模块08,本期数据来自模板表
 */
const { t } = useI18n();
const loading = ref(false);
const overview = ref<FinanceOverview | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  try {
    overview.value = await apiFinanceOverview();
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

const CARDS: { key: 'today' | 'month' | 'total'; title: string }[] = [
  { key: 'today', title: t('finance.overviewPage.todayIncome') },
  { key: 'month', title: t('finance.overviewPage.monthIncome') },
  { key: 'total', title: t('finance.overviewPage.totalIncome') },
];
</script>

<template>
  <PageContainer>
    <a-spin :spinning="loading">
      <a-row :gutter="16">
        <a-col v-for="card in CARDS" :key="card.key" :xs="24" :md="8">
          <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
            <template #title>{{ card.title }}</template>
            <a-row>
              <a-col :span="12">
                <a-statistic
                  :title="t('finance.overviewPage.todayIncome')"
                  :value="formatAmount(overview?.[card.key]?.income ?? 0)"
                  :value-style="{ color: 'var(--mtrip-success, #52c41a)' }"
                />
              </a-col>
              <a-col :span="12">
                <a-statistic
                  :title="t('finance.overviewPage.todayExpense')"
                  :value="formatAmount(overview?.[card.key]?.expense ?? 0)"
                  :value-style="{ color: 'var(--mtrip-error, #ff4d4f)' }"
                />
              </a-col>
            </a-row>
            <a-divider style="margin: 12px 0" />
            <a-statistic
              :title="t('finance.overviewPage.balance')"
              :value="formatAmount((overview?.[card.key]?.income ?? 0) - (overview?.[card.key]?.expense ?? 0))"
            />
          </a-card>
        </a-col>
      </a-row>

      <a-card :bordered="false" class="mtrip-card-shadow" :title="t('finance.overviewPage.pendingWithdraw')">
        <template #extra>
          <a-button size="small" @click="load"><template #icon><ReloadOutlined /></template>{{ t('common.refresh') }}</a-button>
        </template>
        <a-row :gutter="16">
          <a-col :xs="24" :md="8">
            <a-statistic :title="t('finance.overviewPage.pendingWithdraw')" :value="overview?.pendingWithdrawCount ?? 0">
              <template #suffix>{{ t('common.id') }}</template>
            </a-statistic>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-statistic :title="t('finance.overviewPage.pendingSettle')" :value="overview?.pendingSettleCount ?? 0">
              <template #suffix>{{ t('common.id') }}</template>
            </a-statistic>
          </a-col>
        </a-row>
      </a-card>
    </a-spin>
  </PageContainer>
</template>
