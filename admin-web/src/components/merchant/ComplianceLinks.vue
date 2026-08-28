<script setup lang="ts">
import { useI18n } from 'vue-i18n';
defineProps<{ merchantId?: number }>();
const { t } = useI18n();
</script>
<template>
  <a-space wrap style="margin-bottom: 16px">
    <router-link v-perm="'platform:rule:list'" to="/compliance/rules">{{ t('complianceS6.rules') }}</router-link>
    <router-link v-perm="'platform:violation:list'" :to="{ path: '/compliance/violations', query: { merchantId } }">{{ t('complianceS6.violations') }}</router-link>
    <router-link v-perm="'platform:warning:list'" :to="{ path: '/compliance/warnings', query: { merchantId } }">{{ t('complianceS6.warnings') }}</router-link>
    <router-link v-perm="'platform:compliance:list'" :to="{ path: '/compliance/history', query: { merchantId } }">{{ t('complianceS6.history') }}</router-link>
  </a-space>
</template>
