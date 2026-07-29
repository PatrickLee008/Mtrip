<script setup lang="ts">
import OplogPanel from '@/components/OplogPanel.vue';

/** 系统管理/操作日志(与 系统日志/后台操作日志 复用同一面板) */
</script>

<template>
  <OplogPanel perm-export="sys:oplog:export" />
</template>
