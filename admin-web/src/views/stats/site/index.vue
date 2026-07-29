<script setup lang="ts">
import StatsReport from '@/views/stats/components/StatsReport.vue';

/** 站点统计(按钮权限 stats:site:*) */
</script>

<template>
  <StatsReport dim="site" perm-prefix="stats:site" title="站点统计" />
</template>
