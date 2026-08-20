<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { apiVerifyQueues } from '@/api/merchant';

/**
 * 商户验证五状态卡片导航(原型 stir-long:页面顶部 Onboarding / Pending Verification /
 * Approved / Rejected / Resubmission 卡片,点击切换,当前状态浅色底+主题描边)
 */
const props = defineProps<{ active: string }>();
const { t } = useI18n();
const router = useRouter();

const CARDS = computed(() => [
  { key: 'onboarding', label: t('merchant.onboardingPage.title'), color: '#0E7490' },
  { key: 'pending', label: t('merchant.verifyPage.queuePending'), color: '#D97706' },
  { key: 'approved', label: t('merchant.verifyPage.queueApproved'), color: '#059669' },
  { key: 'rejected', label: t('merchant.verifyPage.queueRejected'), color: '#DC2626' },
  { key: 'resubmission', label: t('merchant.verifyPage.queueResubmission'), color: '#2563EB' },
]);

const counts = ref<Record<string, number>>({});
let timer: number | undefined;
async function loadCounts(): Promise<void> {
  try {
    counts.value = await apiVerifyQueues();
  } catch {
    counts.value = {};
  }
}
onMounted(() => {
  void loadCounts();
  timer = window.setInterval(() => void loadCounts(), 60000);
});
onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});

const total = computed(() =>
  CARDS.value.reduce((s, c) => s + (counts.value[c.key] ?? 0), 0) || 1,
);

function percent(key: string): number {
  return Math.min(100, Math.round(((counts.value[key] ?? 0) / total.value) * 100));
}

function go(key: string): void {
  if (key !== props.active) {
    void router.push(`/merchant-verify/${key}`);
  }
}
</script>

<template>
  <div class="mv-nav">
    <div
      v-for="card in CARDS"
      :key="card.key"
      class="mv-card"
      :class="{ 'is-active': active === card.key }"
      :style="active === card.key ? { background: card.color + '14', borderColor: card.color + '55', boxShadow: `0 0 0 1px ${card.color}55` } : undefined"
      @click="go(card.key)"
    >
      <div class="mv-card__label">{{ card.label }}</div>
      <div class="mv-card__value" :style="{ color: card.color }">{{ counts[card.key] ?? 0 }}</div>
      <div class="mv-card__bar">
        <div class="mv-card__bar-fill" :style="{ width: percent(card.key) + '%', background: card.color }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.mv-nav {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.mv-card {
  padding: 12px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mv-card:hover {
  box-shadow: 0 2px 8px rgba(26, 35, 50, 0.06);
}

.mv-card__label {
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
  margin-bottom: 2px;
}

.mv-card__value {
  font-size: 26px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  line-height: 1.2;
}

.mv-card__bar {
  width: 32px;
  height: 3px;
  background: #e3e8f0;
  border-radius: 2px;
  margin-top: 6px;
}

.mv-card__bar-fill {
  height: 100%;
  border-radius: 2px;
}
</style>
