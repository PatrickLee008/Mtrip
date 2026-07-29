<script setup lang="ts">
import SettleManage from '@/views/supplier/components/SettleManage.vue';

/** 财务菜单下的供应商结算(按钮权限 finance:ssettle:*,接口与供应商菜单共用) */
</script>

<template>
  <SettleManage perm-prefix="finance:ssettle" />
</template>
