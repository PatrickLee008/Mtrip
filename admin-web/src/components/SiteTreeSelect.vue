<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TreeSelectProps } from 'ant-design-vue';
import { apiSiteTree } from '@/api/site';
import type { SiteNode } from '@/api/types';

/**
 * 站点树形选择器(SaaS 多站点核心组件)
 * allowAll=true 时附加「全平台」(value=0)选项,仅超管使用
 */
const props = withDefaults(
  defineProps<{
    value?: number;
    disabled?: boolean;
    allowAll?: boolean;
    placeholder?: string;
  }>(),
  { value: 0, disabled: false, allowAll: false, placeholder: '' },
);

const emit = defineEmits<{
  (e: 'update:value', value: number): void;
  (e: 'change', value: number): void;
}>();

const { t } = useI18n();
const treeData = ref<TreeSelectProps['treeData']>([]);
const loading = ref(false);

function toTree(nodes: SiteNode[]): TreeSelectProps['treeData'] {
  return nodes.map((node) => ({
    value: node.id,
    label: node.site_name,
    disabled: node.status !== 1,
    children: node.children?.length ? toTree(node.children) : undefined,
  }));
}

onMounted(async () => {
  loading.value = true;
  try {
    const tree = await apiSiteTree();
    const data = toTree(tree) ?? [];
    treeData.value = props.allowAll ? [{ value: 0, label: t('app.allSites') }, ...data] : data;
  } finally {
    loading.value = false;
  }
});

const innerValue = computed({
  get: () => props.value,
  set: (val: number) => {
    emit('update:value', val);
    emit('change', val);
  },
});
</script>

<template>
  <a-tree-select
    v-model:value="innerValue"
    :tree-data="treeData"
    :disabled="disabled"
    :loading="loading"
    :placeholder="placeholder || t('common.all')"
    tree-default-expand-all
    :dropdown-style="{ maxHeight: '400px', overflow: 'auto' }"
    show-search
    tree-node-filter-prop="label"
  />
</template>
