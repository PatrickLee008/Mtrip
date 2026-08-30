<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import {
  DeleteOutlined,
  FileImageOutlined,
  FileOutlined,
  FileTextOutlined,
  FolderOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SoundOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue';
import {
  apiFileDelete,
  apiFileDirDelete,
  apiFileDirSave,
  apiFileList,
  apiFileTree,
  apiFileUpload,
  type Row,
} from '@/api/config';
import { useTable, type TableRow } from '@/composables/useTable';

type SelectionMode = 'single' | 'multiple';
type TreeNode = Row & { key: string; title: string; managed?: boolean; children?: TreeNode[] };

const props = withDefaults(
  defineProps<{
    selectable?: boolean;
    selectionMode?: SelectionMode;
    fileType?: number;
    fileTypes?: number[] | string;
    bizType?: string;
    accept?: string;
    uploadPerm?: string;
    deletePerm?: string;
    siteId?: number;
    height?: number;
    maxSelected?: number;
    showConfirmBar?: boolean;
  }>(),
  {
    selectable: true,
    selectionMode: 'single',
    fileType: undefined,
    fileTypes: undefined,
    bizType: 'public_resource',
    accept: '',
    uploadPerm: 'config:storage:upload',
    deletePerm: 'config:storage:delete',
    siteId: 0,
    height: 620,
    maxSelected: 0,
    showConfirmBar: false,
  },
);

const emit = defineEmits<{
  select: [row: Row];
  'select-multiple': [rows: Row[]];
  confirm: [rows: Row[]];
  change: [];
}>();

const FILE_TYPES = [
  { value: 1, label: '图片', accept: 'image/*', exts: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'] },
  { value: 2, label: '文档', accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv', exts: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'] },
  { value: 3, label: '视频', accept: 'video/*', exts: ['mp4', 'mov', 'webm', 'm4v'] },
  { value: 5, label: '音频', accept: 'audio/*', exts: ['mp3', 'wav', 'aac', 'm4a', 'ogg'] },
  { value: 4, label: '其他', accept: '', exts: [] },
];
const FILE_TYPE_TEXT: Record<number, string> = Object.fromEntries(FILE_TYPES.map((item) => [item.value, item.label]));

function normalizeFileTypes(value: number | number[] | string | undefined): number[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  const raw = Array.isArray(value) ? value : String(value).split(/[,\s]+/);
  const allowed = FILE_TYPES.map((item) => item.value);
  return raw.map((item) => Number(item)).filter((item, index, arr) => allowed.includes(item) && arr.indexOf(item) === index);
}

function serializeFileTypes(types: number[]): string {
  return types.length > 0 ? types.join(',') : '';
}

const fixedFileTypes = computed(() => normalizeFileTypes(props.fileTypes ?? props.fileType));
const selectableTypeOptions = computed(() => {
  const fixed = fixedFileTypes.value;
  return fixed.length > 0 ? FILE_TYPES.filter((item) => fixed.includes(item.value)) : FILE_TYPES;
});
const filterFileTypes = ref<number[]>(normalizeFileTypes(props.fileTypes ?? props.fileType));
const effectiveFileTypes = computed(() => {
  if (fixedFileTypes.value.length > 0 && filterFileTypes.value.length === 0) {
    return fixedFileTypes.value;
  }
  return filterFileTypes.value;
});
const acceptAttr = computed(() => {
  if (props.accept) {
    return props.accept;
  }
  const types = fixedFileTypes.value.length > 0 ? fixedFileTypes.value : FILE_TYPES.map((item) => item.value);
  return FILE_TYPES.filter((item) => types.includes(item.value)).map((item) => item.accept).filter(Boolean).join(',');
});

const treeData = ref<TreeNode[]>([]);
const selectedKeys = ref<string[]>(['']);
const selectedRowKeys = ref<(string | number)[]>([]);
const selectedRows = ref<Row[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const dirModalOpen = ref(false);
const dirSaving = ref(false);
const dirForm = reactive({ parentDir: '', dirName: '' });

const files = useTable(apiFileList, {
  fileName: '',
  fileTypes: serializeFileTypes(effectiveFileTypes.value),
  bizType: props.bizType,
  dir: '',
  siteId: props.siteId,
  pageSize: 12,
});

const fileColumns = [
  { title: '预览', key: 'preview_col', width: 78 },
  { title: '文件名', dataIndex: 'file_name', ellipsis: true },
  { title: '类型', dataIndex: 'file_type', width: 86 },
  { title: '大小', dataIndex: 'file_size', width: 96 },
  { title: '上传时间', dataIndex: 'created_at', width: 160 },
  { title: '操作', key: 'action_col', width: 150, fixed: 'right' as const },
];

const managerStyle = computed(() => ({ height: `${props.height}px` }));
const currentDir = computed(() => selectedKeys.value[0] || '');
const rowSelection = computed(() => {
  if (!props.selectable) {
    return undefined;
  }
  return {
    type: props.selectionMode === 'multiple' ? 'checkbox' : 'radio',
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: (string | number)[], rows: Row[]) => {
      if (props.selectionMode === 'multiple' && props.maxSelected > 0 && keys.length > props.maxSelected) {
        message.warning(`最多选择 ${props.maxSelected} 个文件`);
        return;
      }
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  };
});

function isImage(row: TableRow): boolean {
  return row.file_type === 1 && !!row.file_url;
}

function iconType(row: TableRow): string {
  if (row.file_type === 1) return 'image';
  if (row.file_type === 2) return 'document';
  if (row.file_type === 3) return 'video';
  if (row.file_type === 5) return 'audio';
  return 'other';
}

function formatSize(bytes: number | string | undefined): string {
  const size = Number(bytes || 0);
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(size / 1024).toFixed(1)} KB`;
}

function openUrl(row: TableRow): void {
  if (row.file_url) {
    window.open(String(row.file_url), '_blank');
  }
}

function choose(row: Row): void {
  if (!props.selectable) {
    return;
  }
  if (props.selectionMode === 'single') {
    selectedRowKeys.value = [row.id];
    selectedRows.value = [row];
    emit('select', row);
    emit('confirm', [row]);
    return;
  }
  const exists = selectedRowKeys.value.includes(row.id);
  if (exists) {
    selectedRowKeys.value = selectedRowKeys.value.filter((key) => key !== row.id);
    selectedRows.value = selectedRows.value.filter((item) => item.id !== row.id);
    return;
  }
  if (props.maxSelected > 0 && selectedRowKeys.value.length >= props.maxSelected) {
    message.warning(`最多选择 ${props.maxSelected} 个文件`);
    return;
  }
  selectedRowKeys.value = [...selectedRowKeys.value, row.id];
  selectedRows.value = [...selectedRows.value, row];
}

function confirmSelection(): void {
  if (selectedRows.value.length === 0) {
    message.warning('请先选择文件');
    return;
  }
  if (props.selectionMode === 'single') {
    emit('select', selectedRows.value[0]);
  } else {
    emit('select-multiple', selectedRows.value);
  }
  emit('confirm', selectedRows.value);
}

function clearSelection(): void {
  selectedRowKeys.value = [];
  selectedRows.value = [];
}

function triggerUpload(): void {
  fileInputRef.value?.click();
}

function applyTypeQuery(): void {
  files.query.fileTypes = serializeFileTypes(effectiveFileTypes.value);
  files.query.fileType = undefined;
}

async function loadTree(): Promise<void> {
  treeData.value = (await apiFileTree({
    fileTypes: serializeFileTypes(effectiveFileTypes.value),
    bizType: props.bizType,
    siteId: props.siteId,
  })) as TreeNode[];
}

async function reload(): Promise<void> {
  applyTypeQuery();
  await Promise.all([loadTree(), files.load()]);
}

async function search(): Promise<void> {
  applyTypeQuery();
  await files.search();
  await loadTree();
}

function onTreeSelect(keys: unknown[]): void {
  const key = keys.length > 0 ? String(keys[0]) : '';
  selectedKeys.value = [key];
  files.query.dir = key;
  clearSelection();
  void files.search();
}

function openRootDirModal(): void {
  dirForm.parentDir = '';
  dirForm.dirName = '';
  dirModalOpen.value = true;
}

function openChildDirModal(): void {
  if (!currentDir.value) {
    message.warning('请先选择父目录');
    return;
  }
  dirForm.parentDir = currentDir.value;
  dirForm.dirName = '';
  dirModalOpen.value = true;
}

async function saveDir(): Promise<void> {
  if (!dirForm.dirName.trim()) {
    message.error('请输入目录名称');
    return;
  }
  dirSaving.value = true;
  try {
    const row = await apiFileDirSave({
      parentDir: dirForm.parentDir,
      dirName: dirForm.dirName,
      bizType: props.bizType,
      siteId: props.siteId,
    });
    const dirPath = String(row.dirPath || '');
    selectedKeys.value = [dirPath];
    files.query.dir = dirPath;
    message.success('目录已创建');
    dirModalOpen.value = false;
    await reload();
    emit('change');
  } finally {
    dirSaving.value = false;
  }
}

async function removeDir(): Promise<void> {
  if (!currentDir.value) {
    return;
  }
  await apiFileDirDelete({ dir: currentDir.value, bizType: props.bizType, siteId: props.siteId });
  message.success('目录已删除');
  selectedKeys.value = [''];
  files.query.dir = '';
  await reload();
  emit('change');
}

function inferFileType(name: string): number {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const matched = FILE_TYPES.find((item) => item.exts.includes(ext));
  return matched?.value ?? 4;
}

function checkUploadFile(file: File): boolean {
  const fixed = fixedFileTypes.value;
  if (fixed.length === 0) {
    return true;
  }
  return fixed.includes(inferFileType(file.name));
}

async function handleUploadChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const pickedFiles = Array.from(input.files ?? []);
  if (pickedFiles.length === 0) {
    return;
  }
  const invalid = pickedFiles.find((file) => !checkUploadFile(file));
  if (invalid) {
    message.error(`文件 ${invalid.name} 不符合当前选择器允许的类型`);
    input.value = '';
    return;
  }
  uploading.value = true;
  try {
    for (const file of pickedFiles) {
      await apiFileUpload(file, {
        dir: files.query.dir || 'resources',
        bizType: props.bizType,
        siteId: props.siteId,
      });
    }
    message.success('上传成功');
    input.value = '';
    await reload();
    emit('change');
  } finally {
    uploading.value = false;
  }
}

async function remove(row: TableRow): Promise<void> {
  await apiFileDelete(row.id);
  message.success('已删除');
  clearSelection();
  await reload();
  emit('change');
}

onMounted(() => {
  void reload();
});

defineExpose({ reload, clearSelection });
</script>

<template>
  <div class="resource-manager-shell">
    <div class="resource-manager" :style="managerStyle">
      <aside class="resource-tree">
        <div class="tree-title"><FolderOutlined />资源目录</div>
        <div class="tree-actions">
          <a-button v-perm="props.uploadPerm" size="small" block @click="openRootDirModal"><template #icon><PlusOutlined /></template>根目录</a-button>
          <a-button v-perm="props.uploadPerm" size="small" block :disabled="!currentDir" @click="openChildDirModal">子目录</a-button>
          <a-popconfirm title="确认删除该空目录?" @confirm="removeDir">
            <a-button v-perm="props.deletePerm" size="small" block danger :disabled="!currentDir"><template #icon><DeleteOutlined /></template>删目录</a-button>
          </a-popconfirm>
        </div>
        <a-tree :tree-data="treeData" :selected-keys="selectedKeys" default-expand-all block-node @select="onTreeSelect" />
      </aside>
      <section class="resource-main">
        <div class="resource-toolbar">
          <a-space wrap>
            <a-input v-model:value="files.query.fileName" allow-clear placeholder="搜索文件名" style="width: 190px" @press-enter="search" />
            <a-input v-model:value="files.query.dir" allow-clear placeholder="目录,如 resources/theme" style="width: 220px" @press-enter="search" />
            <a-select
              v-model:value="filterFileTypes"
              mode="multiple"
              allow-clear
              placeholder="文件类型"
              style="width: 220px"
              :max-tag-count="2"
              @change="search"
            >
              <a-select-option v-for="item in selectableTypeOptions" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
            </a-select>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="reload"><template #icon><ReloadOutlined /></template>刷新</a-button>
          </a-space>
          <div>
            <input ref="fileInputRef" class="hidden-file-input" type="file" :accept="acceptAttr" multiple @change="handleUploadChange" />
            <a-button v-perm="props.uploadPerm" type="primary" :loading="uploading" @click="triggerUpload">
              <template #icon><UploadOutlined /></template>上传文件
            </a-button>
          </div>
        </div>

        <a-table
          :columns="fileColumns"
          :data-source="files.list.value"
          :loading="files.loading.value || uploading"
          :pagination="files.pagination.value"
          :row-selection="rowSelection"
          row-key="id"
          size="middle"
          :scroll="{ x: 920 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'preview_col'">
              <a-image v-if="isImage(record)" :src="record.file_url" :width="44" :height="44" class="resource-thumb" />
              <div v-else class="resource-file-icon">
                <FileImageOutlined v-if="iconType(record) === 'image'" />
                <FileTextOutlined v-else-if="iconType(record) === 'document'" />
                <PlayCircleOutlined v-else-if="iconType(record) === 'video'" />
                <SoundOutlined v-else-if="iconType(record) === 'audio'" />
                <FileOutlined v-else />
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'file_type'">
              <a-tag>{{ FILE_TYPE_TEXT[record.file_type] ?? '其他' }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'file_size'">
              {{ formatSize(record.file_size) }}
            </template>
            <template v-else-if="column.key === 'action_col'">
              <a-space :size="2">
                <a-button type="link" size="small" @click="openUrl(record)">查看</a-button>
                <a-button v-if="selectable" type="link" size="small" @click="choose(record)">{{ selectionMode === 'single' ? '选择' : '切换' }}</a-button>
                <a-popconfirm title="确认删除该文件?" @confirm="remove(record)">
                  <a-button v-perm="props.deletePerm" type="link" size="small" danger><DeleteOutlined /></a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </section>
    </div>

    <div v-if="showConfirmBar && selectable" class="selection-footer">
      <span>已选择 {{ selectedRows.length }} 个文件</span>
      <a-space>
        <a-button @click="clearSelection">清空</a-button>
        <a-button type="primary" @click="confirmSelection">确认选择</a-button>
      </a-space>
    </div>

    <a-modal v-model:open="dirModalOpen" title="新增目录" :confirm-loading="dirSaving" @ok="saveDir">
      <a-form layout="vertical">
        <a-form-item label="父目录">
          <a-input :value="dirForm.parentDir || '根目录'" disabled />
        </a-form-item>
        <a-form-item label="目录名称" required>
          <a-input v-model:value="dirForm.dirName" placeholder="仅支持字母、数字、点、下划线、中划线" @press-enter="saveDir" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.resource-manager-shell {
  min-width: 0;
}

.resource-manager {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  min-height: 520px;
}

.resource-tree {
  overflow: auto;
  border: 1px solid #e3e8f0;
  border-radius: 12px;
  background: #fbfcfe;
}

.tree-title {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #e3e8f0;
  color: #1a2332;
  font-weight: 700;
}

.tree-actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
  padding: 10px;
  border-bottom: 1px solid #e3e8f0;
}

.resource-tree :deep(.ant-tree) {
  padding: 10px 8px;
  background: transparent;
}

.resource-main {
  min-width: 0;
  overflow: hidden;
}

.resource-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.hidden-file-input {
  display: none;
}

.resource-thumb {
  overflow: hidden;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  object-fit: cover;
}

.resource-file-icon {
  display: inline-flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  color: #64748b;
  background: #f8fafc;
  font-size: 20px;
}

.selection-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e3e8f0;
  color: #64748b;
}

@media (max-width: 900px) {
  .resource-manager {
    grid-template-columns: 1fr;
    height: auto !important;
  }

  .resource-toolbar {
    flex-direction: column;
  }
}
</style>
