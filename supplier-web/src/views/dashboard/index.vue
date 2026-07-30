<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { GoldOutlined, CheckCircleOutlined, StopOutlined, AccountBookOutlined } from '@ant-design/icons-vue';
import { useUserStore } from '@/stores/user';
import PageContainer from '@/components/PageContainer.vue';

/**
 * 工作台首页占位:欢迎信息 + 供应商主体信息 + KPI 卡片骨架
 * 供应商单层主体:展示供货商品/供货中/已停供/待对账结算,接入真实统计留后续
 */
const userStore = useUserStore();
const { t } = useI18n();

const welcome = computed(() => userStore.profile?.realName || userStore.profile?.username || '');
const subjectName = computed(() => userStore.profile?.subjectName || '-');
const ownerLabel = computed(() => t(userStore.isOwner ? 'header.ownerTag' : 'header.subTag'));

interface Kpi {
  key: string;
  labelKey: string;
  value: number;
  icon: unknown;
  color: string;
}

/** 供应商工作台:供货商品/供货中/已停供/待对账结算 */
const kpis = computed<Kpi[]>(() => [
  { key: 'goods', labelKey: 'dashboard.goodsCount', value: 0, icon: GoldOutlined, color: '#1677ff' },
  { key: 'onSupply', labelKey: 'dashboard.onSupplyCount', value: 0, icon: CheckCircleOutlined, color: '#52c41a' },
  { key: 'offSupply', labelKey: 'dashboard.offSupplyCount', value: 0, icon: StopOutlined, color: '#fa8c16' },
  { key: 'settle', labelKey: 'dashboard.pendingSettle', value: 0, icon: AccountBookOutlined, color: '#eb2f96' },
]);
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow welcome-card">
      <div class="welcome-line">
        <span class="welcome-text">{{ t('dashboard.welcome') }}, {{ welcome }}</span>
      </div>
      <a-descriptions :column="2" size="small" style="margin-top: 8px">
        <a-descriptions-item :label="t('dashboard.subjectLabel')">{{ subjectName }}</a-descriptions-item>
        <a-descriptions-item :label="t('dashboard.accountLabel')">{{ ownerLabel }}</a-descriptions-item>
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
