<script setup lang="ts">
import OrderManage from '@/views/order/components/OrderManage.vue';

/** 门票订单(order_type=2) */
</script>

<template>
  <OrderManage :order-type="2" perm-prefix="order:ticket" />
</template>
