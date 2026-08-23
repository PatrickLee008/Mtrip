<script setup lang="ts">
/**
 * PageContainer:页面内容容器
 * 面包屑已上移至顶部 Header(mTrip › 当前页),此处仅承载页面主体
 */
defineProps<{
  /** 兼容旧页面传参(标题现由 Header 面包屑统一展示) */
  title?: string;
}>();
</script>

<template>
  <div class="page-container">
    <div class="page-body">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="less">
.page-body {
  padding: 24px 28px;
  background:
    radial-gradient(circle at 8% 0%, rgba(37, 99, 235, 0.06), transparent 28%),
    var(--mtrip-bg-page);
  min-height: calc(100vh - 56px); // 减去 header(56)
}

@media (max-width: 900px) {
  .page-body {
    padding: 16px;
  }
}
</style>
