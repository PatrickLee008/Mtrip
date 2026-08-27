<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';
import { clearAuth } from '@/utils/auth';

const user = useUserStore();
const { t } = useI18n();
let timer: ReturnType<typeof setInterval> | undefined;
async function end(): Promise<void> { await user.logout(); window.location.replace('/support-session'); }
onMounted(() => {
  timer = setInterval(() => {
    if (user.profile?.impersonation && Date.now() >= Date.parse(user.profile.impersonation.expiresAt)) {
      clearAuth(); window.location.replace('/support-session');
    }
  }, 1000);
});
onBeforeUnmount(() => { if (timer) clearInterval(timer); });
</script>
<template>
  <a-alert v-if="user.profile?.impersonation" type="warning" show-icon
    :message="t('security.supportBanner', { actor: user.profile.impersonation.actorName, account: user.profile.username })"
    :description="t('security.supportReadOnly')">
    <template #action><a-button danger @click="end">{{ t('security.endSupport') }}</a-button></template>
  </a-alert>
</template>
