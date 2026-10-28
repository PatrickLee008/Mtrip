<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { apiMe } from '@/api/auth';
import { useUserStore } from '@/stores/user';
import { getToken } from '@/utils/auth';
import { sameAccount, sessionState } from '@/utils/session';

const router = useRouter();
const route = useRoute();
const user = useUserStore();
const { t } = useI18n({ messages: {
  'en-US': { session: { title: 'Sign in to continue', hint: 'Your page stays open. Sign in with the same account to continue editing.', failed: 'Unable to restore this page. Please check your connection and retry.', retry: 'Retry' } },
  'zh-CN': { session: { title: '重新登录后继续', hint: '当前页面已保留，请使用原账号登录后继续编辑。', failed: '暂时无法恢复页面，请检查网络后重试。', retry: '重试' } },
} });
const frame = ref<HTMLIFrameElement>();
const restoring = ref(false);
const retrying = ref(false);
let suspendedToken = '';
const embedded = computed(() => window.parent !== window && route.query.reauth === '1');
watch(() => sessionState.expired, (expired) => { if (expired) suspendedToken = getToken(); }, { immediate: true });

async function retry(): Promise<void> {
  if (!user.routesLoaded) {
    sessionState.recoveryFailed = false;
    await router.replace(sessionState.recoveryPath);
    return;
  }
  retrying.value = true;
  try {
    user.profile = await apiMe();
    await user.loadMenus();
    sessionState.recoveryFailed = false;
  } catch {
    sessionState.recoveryFailed = true;
  } finally { retrying.value = false; }
}

function refreshed(event: Event): void {
  const result = (event as CustomEvent).detail;
  if (user.profile && !sameAccount(user.token, result.token)) { window.location.reload(); return; }
  user.token = result.token;
  user.profile = result.admin;
  user.perms = result.admin.permissions;
}

async function signedIn(event: MessageEvent): Promise<void> {
  if (event.origin !== window.location.origin || event.source !== frame.value?.contentWindow || event.data?.type !== 'mtrip:reauth') return;
  if (!sameAccount(suspendedToken, getToken())) { window.location.replace('/'); return; }
  sessionState.expired = false;
  restoring.value = true;
  try {
    user.token = getToken();
    user.profile = await apiMe();
    await user.loadMenus();
    sessionState.recoveryFailed = false;
    if (!user.routesLoaded) await router.replace(sessionState.recoveryPath);
  } catch {
    sessionState.recoveryFailed = true;
    if (user.routesLoaded) sessionState.recoveryPath = route.fullPath;
  } finally { restoring.value = false; }
}

onMounted(() => {
  window.addEventListener('mtrip:session-refreshed', refreshed);
  window.addEventListener('message', signedIn);
});
onBeforeUnmount(() => {
  window.removeEventListener('mtrip:session-refreshed', refreshed);
  window.removeEventListener('message', signedIn);
});
</script>

<template>
  <a-modal v-if="!embedded" :open="sessionState.expired || restoring" :title="t('session.title')" :closable="false" :mask-closable="false" :footer="null" :width="800" :keyboard="false" destroy-on-close>
    <p>{{ t('session.hint') }}</p>
    <a-spin :spinning="restoring">
      <iframe ref="frame" src="/login?reauth=1" :title="t('session.title')" class="session-login" />
    </a-spin>
  </a-modal>
  <a-modal v-if="!embedded" :open="sessionState.recoveryFailed && !sessionState.expired" :closable="false" :mask-closable="false" :footer="null" :keyboard="false">
    <a-result status="warning" :title="t('session.failed')">
      <template #extra><a-button type="primary" :loading="retrying" @click="retry">{{ t('session.retry') }}</a-button></template>
    </a-result>
  </a-modal>
</template>

<style scoped>
.session-login { width: 100%; height: min(72vh, 700px); border: 0; }
</style>
