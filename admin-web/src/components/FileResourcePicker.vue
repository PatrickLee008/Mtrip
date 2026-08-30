<script setup lang="ts">
import { computed } from 'vue';
import FileResourceManager from '@/components/FileResourceManager.vue';
import type { Row } from '@/api/config';

type SelectionMode = 'single' | 'multiple';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    selectionMode?: SelectionMode;
    fileType?: number;
    fileTypes?: number[] | string;
    bizType?: string;
    accept?: string;
    uploadPerm?: string;
    deletePerm?: string;
    siteId?: number;
    width?: string | number;
    height?: number;
    maxSelected?: number;
  }>(),
  {
    title: '选择文件资源',
    selectionMode: 'single',
    fileType: undefined,
    fileTypes: undefined,
    bizType: 'public_resource',
    accept: '',
    uploadPerm: 'config:storage:upload',
    deletePerm: 'config:storage:delete',
    siteId: 0,
    width: '1280px',
    height: 660,
    maxSelected: 0,
  },
);

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [row: Row];
  'select-multiple': [rows: Row[]];
  confirm: [rows: Row[]];
}>();

const modalOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

function handleConfirm(rows: Row[]): void {
  if (rows.length === 0) {
    return;
  }
  if (props.selectionMode === 'single') {
    emit('select', rows[0]);
  } else {
    emit('select-multiple', rows);
  }
  emit('confirm', rows);
  emit('update:open', false);
}
</script>

<template>
  <a-modal v-model:open="modalOpen" :title="title" :width="width" :footer="null" destroy-on-close>
    <FileResourceManager
      :selection-mode="selectionMode"
      :file-type="fileType"
      :file-types="fileTypes"
      :biz-type="bizType"
      :accept="accept"
      :upload-perm="uploadPerm"
      :delete-perm="deletePerm"
      :site-id="siteId"
      :height="height"
      :max-selected="maxSelected"
      show-confirm-bar
      @confirm="handleConfirm"
    />
  </a-modal>
</template>
