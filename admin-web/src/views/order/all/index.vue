<script setup lang="ts">
import OrderManage from '@/views/order/components/OrderManage.vue';

/** 全部订单(不限类型) */
</script>

<template>
  <OrderManage :order-type="0" perm-prefix="order:all" />
</template>
