<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiSupportExchange } from '@/api/auth';
import { useUserStore } from '@/stores/user';

const { t } = useI18n();
const loading = ref(false);
const failed = ref(false);
onMounted(async () => {
  // Fragment is never sent to the HTTP server; discard it before the exchange request.
  const code = window.location.hash.slice(1);
  window.history.replaceState(null, '', '/support-session');
  if (!/^[a-f0-9]{64}$/.test(code)) { failed.value = true; return; }
  loading.value = true;
  try {
    const result = await apiSupportExchange(code);
    useUserStore().acceptSession(result, true);
    window.location.replace('/');
  } catch { failed.value = true; }
  finally { loading.value = false; }
});
</script>
<template>
  <a-result :status="failed ? 'info' : 'success'" :title="t(failed ? 'security.supportEnded' : 'security.supportStarting')" :sub-title="t('security.supportReturn')">
    <template #extra><a-spin v-if="loading" /></template>
  </a-result>
</template>
