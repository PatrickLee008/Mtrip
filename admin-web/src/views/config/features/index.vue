<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import type { TableRow } from '@/composables/useTable';
import { apiFeatureList, apiFeatureSave } from '@/api/feature';

/** 平台特性开关(Super Admin Portal 模块 11 · Feature Toggles) */
const { t } = useI18n();

const loading = ref(false);
const list = ref<TableRow[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    list.value = await apiFeatureList();
  } finally {
    loading.value = false;
  }
}
async function toggle(row: TableRow, checked: boolean): Promise<void> {
  await apiFeatureSave(row.id, checked ? 1 : 0);
  row.enabled = checked ? 1 : 0;
  message.success(t('tip.saveSuccess'));
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" :loading="loading">
      <template #title>Feature Toggles</template>
      <template #extra>
        <a-button @click="load"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
      </template>
      <a-list :data-source="list" item-layout="horizontal">
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta :title="item.label" :description="item.description" />
            <template #actions>
              <a-switch
                v-perm="'config:feature:save'"
                :checked="item.enabled === 1"
                @change="(checked: boolean | string) => toggle(item, !!checked)"
              />
            </template>
          </a-list-item>
        </template>
      </a-list>
    </a-card>
  </PageContainer>
</template>
