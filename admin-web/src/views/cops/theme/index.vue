<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { FolderOpenOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import FileResourcePicker from '@/components/FileResourcePicker.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { apiThemeDelete, apiThemeList, apiThemeSave } from '@/api/cops';

/** 动态主题:草稿/排期/优先级,C 端按生效主题自动切换(PRD 模块15) */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const { loading, list, query, load, search, reset, pagination } = useTable(apiThemeList, { siteId: 0 });

type AssetFieldKey = 'splash' | 'logo' | 'homeHeader' | 'navAccent' | 'primaryColor' | 'backgroundColor';
type AssetField = {
  key: AssetFieldKey;
  label: string;
  placeholder: string;
  hint: string;
  kind: 'url' | 'color';
};
type ExtraAssetRow = {
  uid: number;
  key: string;
  value: string;
};

const COMMON_ASSET_FIELDS: AssetField[] = [
  { key: 'splash', label: '启动页图', placeholder: 'https://cdn.example.com/theme/splash.png', hint: 'App 启动页封面或背景图 URL', kind: 'url' },
  { key: 'logo', label: '品牌 Logo', placeholder: 'https://cdn.example.com/theme/logo.png', hint: '首页、登录态等位置使用的品牌标识', kind: 'url' },
  { key: 'homeHeader', label: '首页头图', placeholder: 'https://cdn.example.com/theme/home-header.png', hint: 'C 端首页顶部主题背景图', kind: 'url' },
  { key: 'navAccent', label: '导航强调色', placeholder: '#1677ff', hint: '底部导航、选中态和关键按钮强调色', kind: 'color' },
  { key: 'primaryColor', label: '主品牌色', placeholder: '#2563eb', hint: '活动主题的主视觉颜色', kind: 'color' },
  { key: 'backgroundColor', label: '页面背景色', placeholder: '#f4f6fb', hint: '主题页面或卡片区域背景色', kind: 'color' },
];
const COMMON_ASSET_KEYS = COMMON_ASSET_FIELDS.map((field) => field.key);
const DEFAULT_ASSETS: Record<AssetFieldKey, string> = {
  splash: '',
  logo: '',
  homeHeader: '',
  navAccent: '#1677ff',
  primaryColor: '#2563eb',
  backgroundColor: '#f4f6fb',
};

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '主题名称', dataIndex: 'theme_name', width: 180 },
  { title: '主题资源', key: 'assets_col', width: 220 },
  { title: '默认', dataIndex: 'is_default', width: 80 },
  { title: '优先级', dataIndex: 'priority', width: 90 },
  { title: '生效开始', dataIndex: 'start_time', width: 170 },
  { title: '生效结束', dataIndex: 'end_time', width: 170 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '操作', key: 'action_col', width: 140, fixed: 'right' as const },
];

const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref(0);
const resourceModalOpen = ref(false);
const form = reactive<{ themeName: string; description: string; thumbnail: string; isDefault: number; priority: number; startTime: string; endTime: string; status: number }>({
  themeName: '',
  description: '',
  thumbnail: '',
  isDefault: 0,
  priority: 0,
  startTime: '',
  endTime: '',
  status: 2,
});
const assetForm = reactive<Record<AssetFieldKey, string>>({ ...DEFAULT_ASSETS });
const extraAssets = ref<ExtraAssetRow[]>([]);
let extraAssetUid = 0;

function scalarToString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function normalizeAssets(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function resetAssetEditor(raw: unknown = DEFAULT_ASSETS): void {
  const assets = normalizeAssets(raw);
  COMMON_ASSET_FIELDS.forEach((field) => {
    assetForm[field.key] = scalarToString(assets[field.key] ?? DEFAULT_ASSETS[field.key]);
  });
  extraAssets.value = Object.entries(assets)
    .filter(([key]) => !COMMON_ASSET_KEYS.includes(key as AssetFieldKey))
    .map(([key, value]) => ({ uid: ++extraAssetUid, key, value: scalarToString(value) }));
}

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { themeName: '', description: '', thumbnail: '', isDefault: 0, priority: 0, startTime: '', endTime: '', status: 2 });
  resetAssetEditor(DEFAULT_ASSETS);
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    themeName: row.theme_name,
    description: row.description,
    thumbnail: row.thumbnail,
    isDefault: row.is_default,
    priority: row.priority,
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    status: row.status,
  });
  resetAssetEditor(row.assets);
  modalOpen.value = true;
}

function openThumbnailManager(): void {
  resourceModalOpen.value = true;
}

function selectThumbnail(row: TableRow): void {
  form.thumbnail = String(row.file_url || '');
}

function addExtraAsset(): void {
  extraAssets.value.push({ uid: ++extraAssetUid, key: '', value: '' });
}

function removeExtraAsset(uid: number): void {
  extraAssets.value = extraAssets.value.filter((item) => item.uid !== uid);
}

function colorPickerValue(key: AssetFieldKey): string {
  return /^#[0-9a-f]{6}$/i.test(assetForm[key]) ? assetForm[key] : '#1677ff';
}

function handleColorInput(key: AssetFieldKey, event: Event): void {
  assetForm[key] = (event.target as HTMLInputElement).value;
}

function buildAssets(): Record<string, unknown> | null {
  const assets: Record<string, unknown> = {};
  COMMON_ASSET_FIELDS.forEach((field) => {
    const value = assetForm[field.key].trim();
    if (value) {
      assets[field.key] = value;
    }
  });

  const seenKeys = new Set<string>();
  for (const item of extraAssets.value) {
    const key = item.key.trim();
    if (!key && !item.value.trim()) {
      continue;
    }
    if (!key) {
      message.error('扩展资源名称不能为空');
      return null;
    }
    if (COMMON_ASSET_KEYS.includes(key as AssetFieldKey)) {
      message.error(`扩展资源「${key}」已在常用资源中配置`);
      return null;
    }
    if (seenKeys.has(key)) {
      message.error(`扩展资源「${key}」重复`);
      return null;
    }
    seenKeys.add(key);
    assets[key] = item.value.trim();
  }

  return assets;
}

function assetCount(row: TableRow): number {
  return Object.keys(normalizeAssets(row.assets)).length;
}

async function submit(): Promise<void> {
  if (!form.themeName.trim()) {
    message.error('请输入主题名称');
    return;
  }
  const assets = buildAssets();
  if (assets === null) {
    return;
  }
  submitting.value = true;
  try {
    await apiThemeSave({ id: editingId.value || undefined, ...form, assets });
    message.success('已保存');
    modalOpen.value = false;
    void load();
  } finally {
    submitting.value = false;
  }
}

async function remove(row: TableRow): Promise<void> {
  await apiThemeDelete({ id: row.id });
  message.success('已删除');
  void load();
}

function onDefaultChange(checked: boolean | string | number): void {
  form.isDefault = checked ? 1 : 0;
}

onMounted(() => void load());
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item v-if="isSuper" label="站点">
          <SiteTreeSelect v-model:value="query.siteId" allow-all style="width: 160px" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" title="主题列表">
      <template #extra>
        <a-button v-perm="'config:theme:save'" type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>新增主题</a-button>
      </template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1120 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'is_default'">
            <a-tag v-if="record.is_default === 1" color="blue">默认</a-tag>
          </template>
          <template v-else-if="column.key === 'assets_col'">
            <a-space wrap>
              <a-tag color="blue">{{ assetCount(record) }} 项</a-tag>
              <a-tag v-if="record.assets?.navAccent" :style="{ color: record.assets.navAccent, borderColor: record.assets.navAccent }">导航色</a-tag>
              <a-tag v-if="record.assets?.primaryColor" :style="{ color: record.assets.primaryColor, borderColor: record.assets.primaryColor }">主色</a-tag>
            </a-space>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? '启用' : '停用' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space>
              <a-button v-perm="'config:theme:save'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-popconfirm title="确认删除该主题?" @confirm="remove(record)">
                <a-button v-perm="'config:theme:delete'" type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" :title="editingId ? '编辑主题' : '新增主题'" width="1180px" wrap-class-name="theme-edit-modal" :confirm-loading="submitting" @ok="submit">
      <a-form layout="vertical" class="theme-form">
        <div class="theme-section">
          <div class="section-title">基础信息</div>
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="主题名称" required>
                <a-input v-model:value="form.themeName" placeholder="如 Thingyan Festival" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="缩略图URL">
                <div class="thumbnail-control">
                  <a-input v-model:value="form.thumbnail" placeholder="https://cdn.example.com/theme/thumb.png" />
                  <a-button @click="openThumbnailManager"><template #icon><FolderOpenOutlined /></template>资源库</a-button>
                </div>
                <div v-if="form.thumbnail" class="thumbnail-preview">
                  <img :src="form.thumbnail" alt="" />
                </div>
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="描述">
                <a-input v-model:value="form.description" placeholder="展示给运营识别的主题说明" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="默认主题">
                <a-switch :checked="form.isDefault === 1" @change="onDefaultChange" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="优先级">
                <a-input-number v-model:value="form.priority" :min="0" style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="状态">
                <a-radio-group v-model:value="form.status">
                  <a-radio :value="1">启用</a-radio>
                  <a-radio :value="2">停用</a-radio>
                </a-radio-group>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="生效开始">
                <a-input v-model:value="form.startTime" placeholder="YYYY-MM-DD HH:mm:ss,留空即刻" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="生效结束">
                <a-input v-model:value="form.endTime" placeholder="YYYY-MM-DD HH:mm:ss,留空长期" />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="theme-section">
          <div class="section-title">
            <span>主题资源</span>
            <span class="section-subtitle">常用资源使用控件编辑，保存时仍按 assets JSON 提交给接口。</span>
          </div>
          <div class="asset-grid">
            <div v-for="field in COMMON_ASSET_FIELDS" :key="field.key" class="asset-card">
              <div class="asset-card-head">
                <div>
                  <div class="asset-label">{{ field.label }}</div>
                  <div class="asset-hint">{{ field.hint }}</div>
                </div>
                <div v-if="field.kind === 'color'" class="asset-swatch" :style="{ backgroundColor: colorPickerValue(field.key) }"></div>
              </div>
              <template v-if="field.kind === 'color'">
                <div class="color-control">
                  <input class="color-native" type="color" :value="colorPickerValue(field.key)" @input="handleColorInput(field.key, $event)" />
                  <a-input v-model:value="assetForm[field.key]" :placeholder="field.placeholder" />
                </div>
              </template>
              <template v-else>
                <a-input v-model:value="assetForm[field.key]" :placeholder="field.placeholder" />
                <div v-if="assetForm[field.key]" class="asset-preview">
                  <img :src="assetForm[field.key]" alt="" />
                </div>
              </template>
            </div>
          </div>
        </div>

        <div class="theme-section">
          <div class="section-title with-action">
            <span>扩展资源</span>
            <a-button size="small" @click="addExtraAsset">添加资源</a-button>
          </div>
          <div v-if="extraAssets.length === 0" class="empty-extra">暂无扩展资源。常用资源无法覆盖的键，可在这里用控件补充。</div>
          <div v-else class="extra-list">
            <div v-for="item in extraAssets" :key="item.uid" class="extra-row">
              <a-input v-model:value="item.key" placeholder="资源键,如 navIcons" />
              <a-input v-model:value="item.value" placeholder="资源值或 URL" />
              <a-button danger @click="removeExtraAsset(item.uid)">删除</a-button>
            </div>
          </div>
        </div>
      </a-form>
    </a-modal>

    <FileResourcePicker
      v-model:open="resourceModalOpen"
      title="选择主题缩略图"
      biz-type="theme_resource"
      :file-types="[1]"
      selection-mode="single"
      upload-perm="config:theme:save"
      width="1280px"
      :height="660"
      @select="selectThumbnail"
    />
  </PageContainer>
</template>

<style scoped>
.theme-form {
  padding-top: 4px;
}

.theme-section {
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid #e3e8f0;
  border-radius: 12px;
  background: #fbfcfe;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  color: #1f2937;
  font-size: 15px;
  font-weight: 700;
}

.section-title.with-action {
  margin-bottom: 12px;
}

.section-subtitle {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 400;
}

.thumbnail-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px;
  gap: 8px;
}

.thumbnail-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 74px;
  margin-top: 8px;
  overflow: hidden;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: linear-gradient(135deg, #f8fafc, #eef4ff);
}

.thumbnail-preview img {
  max-width: 100%;
  max-height: 74px;
  object-fit: contain;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.asset-card {
  min-height: 150px;
  padding: 14px;
  border: 1px solid #e3e8f0;
  border-radius: 10px;
  background: #fff;
}

.asset-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.asset-label {
  color: #1a2332;
  font-size: 13px;
  font-weight: 700;
}

.asset-hint {
  margin-top: 3px;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.5;
}

.asset-swatch {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
}

.color-control {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.color-native {
  width: 44px;
  height: 32px;
  padding: 0;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}

.asset-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64px;
  margin-top: 10px;
  overflow: hidden;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: linear-gradient(135deg, #f8fafc, #eef4ff);
}

.asset-preview img {
  max-width: 100%;
  max-height: 64px;
  object-fit: contain;
}

.empty-extra {
  padding: 14px;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  color: #94a3b8;
  background: #fff;
}

.extra-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.extra-row {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 70px;
  gap: 10px;
  align-items: center;
}

:global(.theme-edit-modal .ant-modal-body) {
  max-height: calc(100vh - 180px);
  overflow-y: auto;
}
</style>
