<script setup lang="ts">
// PageContainer: pure content wrapper.
// The old per-page breadcrumb/title bar was moved to the top navigation header.
</script>

<template>
  <div class="page-container">
    <div class="page-body">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="less">
.page-container {
  height: 100%;
}

.page-body {
  padding: 16px;
  background: var(--mtrip-bg-page);
  min-height: 100%;
}
</style>