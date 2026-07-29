<script setup lang="ts">
import GoodsManage from '@/views/goods/components/GoodsManage.vue';

/** 酒店商品管理(goods_type=1) */
</script>

<template>
  <GoodsManage :goods-type="1" perm-prefix="goods:hotel" sku-perm="goods:hotel:room" />
</template>
