<script setup lang="ts">
import OrderManage from '@/views/order/components/OrderManage.vue';

/** 酒店订单(order_type=1) */
</script>

<template>
  <OrderManage :order-type="1" perm-prefix="order:hotel" />
</template>
