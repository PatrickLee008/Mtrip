<script setup lang="ts">
import GoodsManage from '@/views/goods/components/GoodsManage.vue';

/** 门票商品管理(goods_type=2) */
</script>

<template>
  <GoodsManage :goods-type="2" perm-prefix="goods:ticket" sku-perm="goods:ticket:type" />
</template>
