<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';
import PageContainer from '@/components/PageContainer.vue';
import AmountText from '@/components/AmountText.vue';

/**
 * 数据大屏首页占位:KPI 卡片骨架(完整图表大屏在模块07实现)
 */
const userStore = useUserStore();
const { t } = useI18n();
const welcome = computed(() => userStore.profile?.realName || userStore.profile?.username || '');

const kpis = [
  { titleKey: 'app.kpi.totalRevenue', value: 0, type: 'income' as const },
  { titleKey: 'app.kpi.todayOrders', value: 0, type: 'plain' as const },
  { titleKey: 'app.kpi.pendingSettle', value: 0, type: 'expense' as const },
  { titleKey: 'app.kpi.platformCommission', value: 0, type: 'commission' as const },
];
</script>

<template>
  <PageContainer>
    <a-alert
      type="info"
      show-icon
      :message="t('app.welcomeTip', { name: welcome })"
      style="margin-bottom: 16px"
    />
    <a-row :gutter="16">
      <a-col v-for="kpi in kpis" :key="kpi.titleKey" :span="6">
        <a-card class="mtrip-card-shadow" :bordered="false">
          <div class="kpi-title">{{ t(kpi.titleKey) }}</div>
          <div class="kpi-value">
            <AmountText :value="kpi.value" currency="USD" :type="kpi.type" />
          </div>
        </a-card>
      </a-col>
    </a-row>
  </PageContainer>
</template>

<style scoped>
.kpi-title {
  color: var(--mtrip-text-secondary);
  font-size: 14px;
  margin-bottom: 8px;
}

.kpi-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
}
</style>
