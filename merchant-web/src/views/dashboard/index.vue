<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ShopOutlined, ProfileOutlined, GoldOutlined, CheckCircleOutlined } from '@ant-design/icons-vue';
import { useUserStore } from '@/stores/user';
import PageContainer from '@/components/PageContainer.vue';

/**
 * 工作台首页占位:欢迎信息 + 主体信息 + KPI 卡片骨架
 * 指标按 account_type 展示(集团/商户看门店+订单+商品,门店看订单+核销),接入真实统计留后续
 */
const userStore = useUserStore();
const { t } = useI18n();

const welcome = computed(() => userStore.profile?.realName || userStore.profile?.username || '');
const subjectName = computed(() => userStore.profile?.subjectName || '-');

const ACCOUNT_TYPE_KEY: Record<number, string> = {
  1: 'accountType.group',
  2: 'accountType.merchant',
  3: 'accountType.store',
};
const accountTypeLabel = computed(() => {
  const key = ACCOUNT_TYPE_KEY[userStore.accountType];
  return key ? t(key) : '-';
});

interface Kpi {
  key: string;
  labelKey: string;
  value: number;
  icon: unknown;
  color: string;
}

/** 门店(type3)只看订单与核销;集团/商户看门店/订单/商品 */
const kpis = computed<Kpi[]>(() => {
  const isStore = userStore.accountType === 3;
  const base: Kpi[] = [
    { key: 'store', labelKey: 'dashboard.storeCount', value: 0, icon: ShopOutlined, color: '#1677ff' },
    { key: 'order', labelKey: 'dashboard.orderCount', value: 0, icon: ProfileOutlined, color: '#52c41a' },
    { key: 'goods', labelKey: 'dashboard.goodsCount', value: 0, icon: GoldOutlined, color: '#fa8c16' },
    { key: 'verify', labelKey: 'dashboard.todoVerify', value: 0, icon: CheckCircleOutlined, color: '#eb2f96' },
  ];
  return isStore ? base.filter((k) => k.key === 'order' || k.key === 'verify') : base;
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow welcome-card">
      <div class="welcome-line">
        <span class="welcome-text">{{ t('dashboard.welcome') }}, {{ welcome }}</span>
      </div>
      <a-descriptions :column="2" size="small" style="margin-top: 8px">
        <a-descriptions-item :label="t('dashboard.subjectLabel')">{{ subjectName }}</a-descriptions-item>
        <a-descriptions-item :label="t('dashboard.accountTypeLabel')">{{ accountTypeLabel }}</a-descriptions-item>
      </a-descriptions>
    </a-card>

    <a-row :gutter="16" style="margin-top: 16px">
      <a-col v-for="kpi in kpis" :key="kpi.key" :span="6">
        <a-card class="mtrip-card-shadow" :bordered="false">
          <div class="kpi-body">
            <component :is="kpi.icon" class="kpi-icon" :style="{ color: kpi.color }" />
            <div>
              <div class="kpi-title">{{ t(kpi.labelKey) }}</div>
              <div class="kpi-value">{{ kpi.value }}</div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <a-alert type="info" show-icon :message="t('dashboard.tip')" style="margin-top: 16px" />
  </PageContainer>
</template>

<style scoped>
.welcome-text {
  font-size: 18px;
  font-weight: 600;
}

.kpi-body {
  display: flex;
  align-items: center;
  gap: 16px;
}

.kpi-icon {
  font-size: 36px;
}

.kpi-title {
  color: var(--mtrip-text-secondary);
  font-size: 14px;
  margin-bottom: 4px;
}

.kpi-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
}
</style>
