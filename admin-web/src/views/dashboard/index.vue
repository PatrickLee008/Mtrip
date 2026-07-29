<script setup lang="ts">
import { computed } from 'vue';
import { useUserStore } from '@/stores/user';
import PageContainer from '@/components/PageContainer.vue';
import AmountText from '@/components/AmountText.vue';

/**
 * 数据大屏首页占位:KPI 卡片骨架(完整图表大屏在模块07实现)
 */
const userStore = useUserStore();
const welcome = computed(() => userStore.profile?.realName || userStore.profile?.username || '');

const kpis = [
  { title: '总营收', value: 0, type: 'income' as const },
  { title: '今日订单', value: 0, type: 'plain' as const },
  { title: '待结算资金', value: 0, type: 'expense' as const },
  { title: '平台总佣金', value: 0, type: 'commission' as const },
];
</script>

<template>
  <PageContainer title="数据大屏">
    <a-alert type="info" show-icon :message="`欢迎回来,${welcome}!完整数据大屏(趋势图表/排行/实时监控)将在业务模块上线后开放。`" style="margin-bottom: 16px" />
    <a-row :gutter="16">
      <a-col v-for="kpi in kpis" :key="kpi.title" :span="6">
        <a-card class="mtrip-card-shadow" :bordered="false">
          <div class="kpi-title">{{ kpi.title }}</div>
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
