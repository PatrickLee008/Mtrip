<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { apiVerifyQueues } from '@/api/merchant';
import { useUserStore } from '@/stores/user';

/**
 * 入驻、已通过、已拒绝三项导航；旧流程仅在存在待办时保留历史入口。
 */
const props = defineProps<{ active: string }>();
const { t } = useI18n();
const router = useRouter();
const userStore = useUserStore();

const CARDS = computed(() => [
  { key: 'onboarding', label: t('merchant.onboardingPage.title'), color: '#0E7490' },
  { key: 'approved', label: t('merchant.verifyPage.queueApproved'), color: '#059669' },
  { key: 'rejected', label: t('merchant.verifyPage.queueRejected'), color: '#DC2626' },
]);

const counts = ref<Record<string, number>>({});
const legacyQueues = computed(() => [
  { key: 'pending', label: t('merchant.verifyPage.queuePending') },
  { key: 'resubmission', label: t('merchant.verifyPage.queueResubmission') },
].filter(queue => (counts.value[queue.key] ?? 0) > 0 && userStore.menus.some(menu =>
  menu.route_path === `/merchant-verify/${queue.key}`
  || menu.children?.some(child => child.route_path === `/merchant-verify/${queue.key}`),
)));
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
  window.addEventListener('mtrip:onboarding-changed', loadCounts);
  timer = window.setInterval(() => void loadCounts(), 60000);
});
onUnmounted(() => {
  window.removeEventListener('mtrip:onboarding-changed', loadCounts);
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
    <div v-if="legacyQueues.length" class="mv-legacy" role="status">
      <span>{{ t('merchant.verifyPage.legacyQueueTasks') }}</span>
      <button v-for="queue in legacyQueues" :key="queue.key" type="button" :class="{ 'is-active': active === queue.key }" @click="go(queue.key)">
        {{ queue.label }} ({{ counts[queue.key] }})
      </button>
    </div>
  </div>
</template>

<style scoped>
.mv-nav {
  display: grid;
  grid-template-columns: repeat(3, minmax(96px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
  padding: 1px;
  overflow-x: auto;
}

.mv-legacy {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  padding: 8px 12px;
  border: 1px solid #fde68a;
  border-radius: 8px;
  background: #fffbeb;
  color: #92400e;
  font-size: 12px;
}

.mv-legacy button {
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: #92400e;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.mv-legacy button.is-active { font-weight: 600; }

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
