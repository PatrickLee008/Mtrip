<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ReloadOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import type { TableRow } from '@/composables/useTable';
import { apiHelpAnalytics } from '@/api/help';

/** 帮助中心搜索分析(Super Admin Portal 模块 12):热搜词 + 无结果词 */
const { t } = useI18n();

const loading = ref(false);
const topKeywords = ref<TableRow[]>([]);
const noResultKeywords = ref<TableRow[]>([]);

const topCols = [
  { title: 'Keyword', dataIndex: 'keyword' },
  { title: 'Searches', dataIndex: 'cnt', width: 120 },
  { title: 'Avg Results', dataIndex: 'avg_result', width: 130 },
];
const noResCols = [
  { title: 'Keyword (no result)', dataIndex: 'keyword' },
  { title: 'Searches', dataIndex: 'cnt', width: 120 },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    const res = await apiHelpAnalytics();
    topKeywords.value = res.topKeywords;
    noResultKeywords.value = res.noResultKeywords;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <div style="margin-bottom: 16px">
      <a-button @click="load"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
    </div>
    <a-row :gutter="16">
      <a-col :span="12">
        <a-card :bordered="false" class="mtrip-card-shadow" title="Top Keywords" :loading="loading">
          <a-table :columns="topCols" :data-source="topKeywords" row-key="keyword" size="small" :pagination="false" />
        </a-card>
      </a-col>
      <a-col :span="12">
        <a-card :bordered="false" class="mtrip-card-shadow" title="No-Result Keywords" :loading="loading">
          <a-table :columns="noResCols" :data-source="noResultKeywords" row-key="keyword" size="small" :pagination="false" />
        </a-card>
      </a-col>
    </a-row>
  </PageContainer>
</template>
