<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
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

/** 文件存储:存储配置(S3/R2/本地/阿里云OSS,密钥掩码回显、留空保留原值)+ 文件库 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;
const { t } = useI18n();
const activeTab = ref('storage');

const DRIVER_TEXT = computed<Record<string, string>>(() => ({
  s3: t('config.storage.typeS3'),
  r2: t('config.storage.typeR2'),
  aliyun: t('config.storage.typeAliyun'),
  local: t('config.storage.typeLocal'),
}));

// ---------- Tab1 存储配置 ----------
const storage = useTable(apiStorageList, { storageName: '', driver: undefined, status: undefined });

const storageColumns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('config.storage.channelName'), dataIndex: 'storage_name', width: 150 },
  { title: t('config.storage.channelType'), dataIndex: 'driver', width: 130 },
  { title: t('config.storage.bucket'), dataIndex: 'bucket', width: 140, ellipsis: true },
  { title: t('config.storage.region'), dataIndex: 'region', width: 110 },
  { title: t('config.storage.endpoint'), dataIndex: 'endpoint', width: 180, ellipsis: true },
  { title: t('config.storage.cdnDomain'), dataIndex: 'cdn_domain', ellipsis: true },
  { title: t('config.storage.publicRead'), dataIndex: 'is_default', width: 70 },
  { title: t('common.status'), dataIndex: 'status', width: 80 },
  { title: t('common.action'), key: 'action_col', width: 230, fixed: 'right' as const },
]);

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
  endpoint: '',
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
    endpoint: '',
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
    endpoint: row.endpoint ?? '',
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
    message.warning(t('common.pleaseInput'));
    return;
  }
  modalSaving.value = true;
  try {
    if (editingId.value) {
      await apiStorageUpdate({ id: editingId.value, ...form });
      message.success(t('tip.saveSuccess'));
    } else {
      await apiStorageAdd({ ...form });
      message.success(t('tip.saveSuccess'));
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
  message.success(result.status === 1 ? t('status.enabled') : t('status.disabled'));
  await storage.load();
}

async function removeStorage(row: TableRow): Promise<void> {
  // 后端校验:默认存储不可删除
  await apiStorageDelete(row.id);
  message.success(t('tip.deleteSuccess'));
  await storage.load();
}

// ---------- Tab2 文件库 ----------
const files = useTable(apiFileList, { fileName: '', fileType: undefined, bizType: '', siteId: 0 });

const fileColumns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('common.name'), key: 'preview_col', width: 80 },
  { title: t('config.storage.library.fileName'), dataIndex: 'file_name', ellipsis: true },
  { title: t('config.storage.library.fileType'), dataIndex: 'file_type', width: 90 },
  { title: t('config.storage.library.fileSize'), dataIndex: 'file_size', width: 100 },
  { title: t('config.storage.library.channel'), dataIndex: 'biz_type', width: 110 },
  { title: t('config.storage.library.uploader'), dataIndex: 'creator_name', width: 110 },
  { title: t('config.storage.library.uploadTime'), dataIndex: 'created_at', width: 160 },
  { title: t('common.action'), key: 'action_col', width: 80, fixed: 'right' as const },
]);

const FILE_TYPE = computed<Record<number, string>>(() => ({
  1: t('config.storage.library.fileType1'),
  2: t('config.storage.library.fileType2'),
  3: t('config.storage.library.fileType3'),
  4: t('config.storage.library.fileType4'),
  5: t('config.storage.library.fileType5'),
}));

async function removeFile(row: TableRow): Promise<void> {
  await apiFileDelete(row.id);
  message.success(t('tip.deleteSuccess'));
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
        <a-tab-pane key="storage" :tab="t('config.storage.title')">
          <div class="tab-toolbar">
            <a-form layout="inline">
              <a-form-item :label="t('common.name')">
                <a-input
                  v-model:value="storage.query.storageName"
                  :placeholder="t('common.pleaseInput')"
                  allow-clear
                  style="width: 160px"
                  @press-enter="storage.search"
                />
              </a-form-item>
              <a-form-item :label="t('config.storage.channelType')">
                <a-select v-model:value="storage.query.driver" allow-clear :placeholder="t('common.all')" style="width: 150px">
                  <a-select-option value="s3">{{ t('config.storage.typeS3') }}</a-select-option>
                  <a-select-option value="r2">{{ t('config.storage.typeR2') }}</a-select-option>
                  <a-select-option value="aliyun">{{ t('config.storage.typeAliyun') }}</a-select-option>
                  <a-select-option value="local">{{ t('config.storage.typeLocal') }}</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item :label="t('common.status')">
                <a-select v-model:value="storage.query.status" allow-clear :placeholder="t('common.all')" style="width: 100px">
                  <a-select-option :value="1">{{ t('status.enabled') }}</a-select-option>
                  <a-select-option :value="2">{{ t('status.disabled') }}</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item>
                <a-space>
                  <a-button type="primary" @click="storage.search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
                  <a-button @click="storage.reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
                </a-space>
              </a-form-item>
            </a-form>
            <a-button v-perm="'config:storage:add'" type="primary" @click="openCreate">
              <template #icon><PlusOutlined /></template>{{ t('config.storage.actions.add') }}
            </a-button>
          </div>

          <a-table
            :columns="storageColumns"
            :data-source="storage.list.value"
            :loading="storage.loading.value"
            :pagination="storage.pagination.value"
            row-key="id"
            size="middle"
            :scroll="{ x: 1380 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'driver'">
                <a-tag :color="record.driver === 'local' ? 'default' : 'blue'">{{ DRIVER_TEXT[record.driver] ?? record.driver }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'is_default'">
                <a-tag v-if="record.is_default === 1" color="processing">{{ t('config.storage.isDefault') }}</a-tag>
                <span v-else>-</span>
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <StatusTag :value="record.status" />
              </template>
              <template v-else-if="column.key === 'action_col'">
                <a-space :size="0">
                  <a-button v-perm="'config:storage:edit'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
                  <a-tooltip :title="t('tip.comingSoon')">
                    <a-button type="link" size="small" disabled>{{ t('config.storage.actions.test') }}</a-button>
                  </a-tooltip>
                  <a-popconfirm
                    :title="record.status === 1 ? t('common.disable') : t('common.enable')"
                    @confirm="toggleStorage(record)"
                  >
                    <a-button v-perm="'config:storage:status'" type="link" size="small" :danger="record.status === 1">
                      {{ record.status === 1 ? t('status.disabled') : t('status.enabled') }}
                    </a-button>
                  </a-popconfirm>
                  <a-popconfirm :title="t('tip.confirmDelete')" @confirm="removeStorage(record)">
                    <a-button v-perm="'config:storage:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- ========== 文件库 ========== -->
        <a-tab-pane key="files" :tab="t('config.storage.library.title')">
          <div class="tab-toolbar">
            <a-form layout="inline">
              <a-form-item :label="t('config.storage.library.fileName')">
                <a-input
                  v-model:value="files.query.fileName"
                  :placeholder="t('common.pleaseInput')"
                  allow-clear
                  style="width: 160px"
                  @press-enter="files.search"
                />
              </a-form-item>
              <a-form-item :label="t('config.storage.library.fileType')">
                <a-select v-model:value="files.query.fileType" allow-clear :placeholder="t('common.all')" style="width: 100px">
                  <a-select-option :value="1">{{ FILE_TYPE[1] }}</a-select-option>
                  <a-select-option :value="2">{{ FILE_TYPE[2] }}</a-select-option>
                  <a-select-option :value="3">{{ FILE_TYPE[3] }}</a-select-option>
                  <a-select-option :value="5">{{ FILE_TYPE[5] }}</a-select-option>
                  <a-select-option :value="4">{{ FILE_TYPE[4] }}</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item :label="t('config.storage.library.channel')">
                <a-input v-model:value="files.query.bizType" :placeholder="t('common.pleaseInput')" allow-clear style="width: 120px" @press-enter="files.search" />
              </a-form-item>
              <a-form-item v-if="isSuper" :label="t('common.site')">
                <SiteTreeSelect v-model:value="files.query.siteId" allow-all style="width: 150px" />
              </a-form-item>
              <a-form-item>
                <a-space>
                  <a-button type="primary" @click="files.search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
                  <a-button @click="files.reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
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
                <a-popconfirm :title="t('config.storage.library.confirmDelete')" @confirm="removeFile(record)">
                  <a-button v-perm="'config:storage:delete'" type="link" size="small" danger>{{ t('common.delete') }}</a-button>
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
      :title="editingId ? t('common.edit') + ' ' + t('config.storage.title') : t('config.storage.actions.add')"
      width="620px"
      :confirm-loading="modalSaving"
      @ok="saveStorage"
    >
      <a-form :label-col="{ style: { width: '110px' } }" style="margin-top: 16px">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item :label="t('config.storage.channelName')" required>
              <a-input v-model:value="form.storageName" :placeholder="t('common.pleaseInput')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.storage.channelType')" required>
              <a-select v-model:value="form.driver">
                <a-select-option value="s3">{{ t('config.storage.typeS3') }}</a-select-option>
                <a-select-option value="r2">{{ t('config.storage.typeR2') }}</a-select-option>
                <a-select-option value="aliyun">{{ t('config.storage.typeAliyun') }}</a-select-option>
                <a-select-option value="local">{{ t('config.storage.typeLocal') }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <template v-if="form.driver !== 'local'">
            <a-col :span="12">
              <a-form-item :label="t('config.storage.bucket')">
                <a-input v-model:value="form.bucket" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('config.storage.region')">
                <a-input v-model:value="form.region" :placeholder="t('config.storage.regionPlaceholder')" />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item :label="t('config.storage.endpoint')">
                <a-input v-model:value="form.endpoint" :placeholder="form.driver === 'aliyun' ? 'oss-cn-hangzhou.aliyuncs.com' : t('config.storage.endpointPlaceholder')" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('config.storage.accessKey')">
                <a-input
                  v-model:value="form.accessKey"
                  :placeholder="editingId ? t('common.optional') : ''"
                  autocomplete="off"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('config.storage.secretKey')">
                <a-input-password
                  v-model:value="form.secretKey"
                  :placeholder="editingId ? t('common.optional') : ''"
                  autocomplete="new-password"
                />
              </a-form-item>
            </a-col>
          </template>
          <a-col :span="12">
            <a-form-item :label="t('config.storage.cdnDomain')">
              <a-input v-model:value="form.cdnDomain" :placeholder="t('config.storage.cdnDomainPlaceholder')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.storage.pathPrefix')">
              <a-input v-model:value="form.pathPrefix" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.storage.expireDays')">
              <a-input-number v-model:value="form.expireDays" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('config.storage.isDefault')">
              <a-switch :checked="form.isDefault === 1" @change="onDefaultChange" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('common.site')">
              <SiteTreeSelect v-model:value="form.siteId" allow-all :disabled="!isSuper" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('common.remark')">
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
