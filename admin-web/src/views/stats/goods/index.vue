<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import StatsReport from '@/views/stats/components/StatsReport.vue';

const { t } = useI18n();
const title = computed(() => t('stats.goodsPage.title'));
</script>

<template>
  <StatsReport dim="goods" perm-prefix="stats:goods" :title="title" />
</template>
