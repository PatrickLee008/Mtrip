<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import {
  apiFileDelete,
  apiFileList,
  apiStorageAdd,
  apiStorageDelete,
  apiStorageList,
  apiStorageToggleStatus,
  apiStorageUpdate,
} from '@/api/config';

/** 文件存储:存储配置(S3/R2/本地,密钥掩码回显、留空保留原值)+ 文件库 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const activeTab = ref('storage');

const DRIVER_TEXT: Record<string, string> = { s3: 'AWS S3', r2: 'Cloudflare R2', local: '本地存储' };

// ---------- Tab1 存储配置 ----------
const storage = useTable(apiStorageList, { storageName: '', driver: undefined, status: undefined });

const storageColumns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '存储名称', dataIndex: 'storage_name', width: 150 },
  { title: '驱动', dataIndex: 'driver', width: 130 },
  { title: 'Bucket', dataIndex: 'bucket', width: 140, ellipsis: true },
  { title: '区域', dataIndex: 'region', width: 110 },
  { title: 'CDN 域名', dataIndex: 'cdn_domain', ellipsis: true },
  { title: '默认', dataIndex: 'is_default', width: 70 },
  { title: '状态', dataIndex: 'status', width: 80 },
  { title: '操作', key: 'action_col', width: 230, fixed: 'right' as const },
];

const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref(0);
const form = reactive({
  storageName: '',
  driver: 's3',
  bucket: '',
  region: '',
  accessKey: '',
  secretKey: '',
  cdnDomain: '',
  pathPrefix: '',
  expireDays: 0,
  isDefault: 0,
  remark: '',
  siteId: 0,
});

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, {
    storageName: '',
    driver: 's3',
    bucket: '',
    region: '',
    accessKey: '',
    secretKey: '',
    cdnDomain: '',
    pathPrefix: '',
    expireDays: 0,
    isDefault: 0,
    remark: '',
    siteId: 0,
  });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    storageName: row.storage_name ?? '',
    driver: row.driver ?? 's3',
    bucket: row.bucket ?? '',
    region: row.region ?? '',
    // 密钥后端掩码回显,编辑时留空表示保留原值
    accessKey: '',
    secretKey: '',
    cdnDomain: row.cdn_domain ?? '',
    pathPrefix: row.path_prefix ?? '',
    expireDays: row.expire_days ?? 0,
    isDefault: row.is_default ?? 0,
    remark: row.remark ?? '',
    siteId: row.site_id ?? 0,
  });
  modalOpen.value = true;
}

async function saveStorage(): Promise<void> {
  if (!form.storageName.trim()) {
    message.warning('请输入存储名称');
    return;
  }
  modalSaving.value = true;
  try {
    if (editingId.value) {
      await apiStorageUpdate({ id: editingId.value, ...form });
      message.success('存储配置已更新');
    } else {
      await apiStorageAdd({ ...form });
      message.success('存储配置已创建');
    }
    modalOpen.value = false;
    await storage.load();
  } finally {
    modalSaving.value = false;
  }
}

async function toggleStorage(row: TableRow): Promise<void> {
  // 后端校验:默认存储不可停用
  const result = await apiStorageToggleStatus(row.id);
  message.success(result.status === 1 ? '已启用' : '已停用');
  await storage.load();
}

async function removeStorage(row: TableRow): Promise<void> {
  // 后端校验:默认存储不可删除
  await apiStorageDelete(row.id);
  message.success('存储配置已删除');
  await storage.load();
}

// ---------- Tab2 文件库 ----------
const files = useTable(apiFileList, { fileName: '', fileType: undefined, bizType: '', siteId: 0 });

const fileColumns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '预览', key: 'preview_col', width: 80 },
  { title: '文件名', dataIndex: 'file_name', ellipsis: true },
  { title: '类型', dataIndex: 'file_type', width: 90 },
  { title: '大小(KB)', dataIndex: 'file_size', width: 100 },
  { title: '业务来源', dataIndex: 'biz_type', width: 110 },
  { title: '上传人', dataIndex: 'creator_name', width: 110 },
  { title: '上传时间', dataIndex: 'created_at', width: 160 },
  { title: '操作', key: 'action_col', width: 80, fixed: 'right' as const },
];

const FILE_TYPE: Record<number, string> = { 1: '图片', 2: '文档', 3: '视频', 4: '其他' };

async function removeFile(row: TableRow): Promise<void> {
  await apiFileDelete(row.id);
  message.success('文件已删除');
  await files.load();
}

function isImage(row: TableRow): boolean {
  return row.file_type === 1 && !!row.file_url;
}

function onDefaultChange(checked: boolean | string | number): void {
  form.isDefault = checked ? 1 : 0;
}

onMounted(() => {
  void storage.load();
  void files.load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-tabs v-model:active-key="activeTab">
        <!-- ========== 存储配置 ========== -->
        <a-tab-pane key="storage" tab="存储配置">
          <div class="tab-toolbar">
            <a-form layout="inline">
              <a-form-item label="名称">
                <a-input
                  v-model:value="storage.query.storageName"
                  placeholder="模糊搜索"
                  allow-clear
                  style="width: 160px"
                  @press-enter="storage.search"
                />
              </a-form-item>
              <a-form-item label="驱动">
                <a-select v-model:value="storage.query.driver" allow-clear placeholder="全部" style="width: 150px">
                  <a-select-option value="s3">AWS S3</a-select-option>
                  <a-select-option value="r2">Cloudflare R2</a-select-option>
                  <a-select-option value="local">本地存储</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="状态">
                <a-select v-model:value="storage.query.status" allow-clear placeholder="全部" style="width: 100px">
                  <a-select-option :value="1">启用</a-select-option>
                  <a-select-option :value="2">禁用</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item>
                <a-space>
                  <a-button type="primary" @click="storage.search"><template #icon><SearchOutlined /></template>查询</a-button>
                  <a-button @click="storage.reset"><template #icon><ReloadOutlined /></template>重置</a-button>
                </a-space>
              </a-form-item>
            </a-form>
            <a-button v-perm="'config:storage:add'" type="primary" @click="openCreate">
              <template #icon><PlusOutlined /></template>新增存储
            </a-button>
          </div>

          <a-table
            :columns="storageColumns"
            :data-source="storage.list.value"
            :loading="storage.loading.value"
            :pagination="storage.pagination.value"
            row-key="id"
            size="middle"
            :scroll="{ x: 1200 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'driver'">
                <a-tag :color="record.driver === 'local' ? 'default' : 'blue'">{{ DRIVER_TEXT[record.driver] ?? record.driver }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'is_default'">
                <a-tag v-if="record.is_default === 1" color="processing">默认</a-tag>
                <span v-else>-</span>
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <StatusTag :value="record.status" />
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-space :size="0">
                  <a-button v-perm="'config:storage:edit'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
                  <a-tooltip title="联调阶段开放(模块08)">
                    <a-button type="link" size="small" disabled>连通测试</a-button>
                  </a-tooltip>
                  <a-popconfirm
                    :title="record.status === 1 ? '确认停用该存储?默认存储不可停用' : '确认启用该存储?'"
                    @confirm="toggleStorage(record)"
                  >
                    <a-button v-perm="'config:storage:status'" type="link" size="small" :danger="record.status === 1">
                      {{ record.status === 1 ? '停用' : '启用' }}
                    </a-button>
                  </a-popconfirm>
                  <a-popconfirm title="确认删除该存储配置?默认存储不可删除" @confirm="removeStorage(record)">
                    <a-button v-perm="'config:storage:delete'" type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- ========== 文件库 ========== -->
        <a-tab-pane key="files" tab="文件库">
          <div class="tab-toolbar">
            <a-form layout="inline">
              <a-form-item label="文件名">
                <a-input
                  v-model:value="files.query.fileName"
                  placeholder="模糊搜索"
                  allow-clear
                  style="width: 160px"
                  @press-enter="files.search"
                />
              </a-form-item>
              <a-form-item label="类型">
                <a-select v-model:value="files.query.fileType" allow-clear placeholder="全部" style="width: 100px">
                  <a-select-option :value="1">图片</a-select-option>
                  <a-select-option :value="2">文档</a-select-option>
                  <a-select-option :value="3">视频</a-select-option>
                  <a-select-option :value="4">其他</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="业务来源">
                <a-input v-model:value="files.query.bizType" placeholder="如 hotel" allow-clear style="width: 120px" @press-enter="files.search" />
              </a-form-item>
              <a-form-item v-if="isSuper" label="站点">
                <SiteTreeSelect v-model:value="files.query.siteId" allow-all style="width: 150px" />
              </a-form-item>
              <a-form-item>
                <a-space>
                  <a-button type="primary" @click="files.search"><template #icon><SearchOutlined /></template>查询</a-button>
                  <a-button @click="files.reset"><template #icon><ReloadOutlined /></template>重置</a-button>
                </a-space>
              </a-form-item>
            </a-form>
          </div>

          <a-table
            :columns="fileColumns"
            :data-source="files.list.value"
            :loading="files.loading.value"
            :pagination="files.pagination.value"
            row-key="id"
            size="middle"
            :scroll="{ x: 1100 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'preview_col'">
                <a-image v-if="isImage(record)" :src="record.file_url" :width="40" :height="40" style="object-fit: cover" />
                <span v-else>-</span>
              </template>
              <template v-else-if="column.dataIndex === 'file_type'">
                <a-tag>{{ FILE_TYPE[record.file_type] ?? record.file_type }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'file_size'">
                {{ ((record.file_size ?? 0) / 1024).toFixed(1) }}
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-popconfirm title="确认删除该文件?已被业务引用的文件删除后将无法显示" @confirm="removeFile(record)">
                  <a-button v-perm="'config:storage:delete'" type="link" size="small" danger>删除</a-button>
                </a-popconfirm>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 新增/编辑存储 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑存储配置' : '新增存储配置'"
      width="620px"
      :confirm-loading="modalSaving"
      @ok="saveStorage"
    >
      <a-form :label-col="{ style: { width: '110px' } }" style="margin-top: 16px">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="存储名称" required>
              <a-input v-model:value="form.storageName" placeholder="如:主存储-S3" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="驱动" required>
              <a-select v-model:value="form.driver">
                <a-select-option value="s3">AWS S3</a-select-option>
                <a-select-option value="r2">Cloudflare R2</a-select-option>
                <a-select-option value="local">本地存储</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <template v-if="form.driver !== 'local'">
            <a-col :span="12">
              <a-form-item label="Bucket">
                <a-input v-model:value="form.bucket" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="区域">
                <a-input v-model:value="form.region" placeholder="如 eu-west-3" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="AccessKey">
                <a-input
                  v-model:value="form.accessKey"
                  :placeholder="editingId ? '留空保留原值' : ''"
                  autocomplete="off"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="SecretKey">
                <a-input-password
                  v-model:value="form.secretKey"
                  :placeholder="editingId ? '留空保留原值' : ''"
                  autocomplete="new-password"
                />
              </a-form-item>
            </a-col>
          </template>
          <a-col :span="12">
            <a-form-item label="CDN 域名">
              <a-input v-model:value="form.cdnDomain" placeholder="https://cdn.mtrip.com" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="路径前缀">
              <a-input v-model:value="form.pathPrefix" placeholder="如 mtrip/" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="过期天数">
              <a-input-number v-model:value="form.expireDays" :min="0" style="width: 100%" placeholder="0=永不过期" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="设为默认">
              <a-switch :checked="form.isDefault === 1" @change="onDefaultChange" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="归属站点">
              <SiteTreeSelect v-model:value="form.siteId" allow-all :disabled="!isSuper" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="备注">
              <a-input v-model:value="form.remark" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.tab-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;
}
</style>
