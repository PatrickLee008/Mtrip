<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { FolderOpenOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import FileResourcePicker from '@/components/FileResourcePicker.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { apiTutorialDelete, apiTutorialList, apiTutorialSave } from '@/api/cops';

/** App「使用指南 → 视频教程」内容管理:视频上传到我们自己的存储;语言可选「通用」(所有语言都显示);本期不区分站点 */
const { loading, list, query, load, search, reset, pagination } = useTable(apiTutorialList, { category: undefined, lang: undefined, status: undefined, keyword: '' });

const CATEGORY_OPTIONS = [
  { value: 'hotel', label: '酒店' },
  { value: 'food', label: '餐饮' },
  { value: 'other', label: '其他' },
];
const LANG_OPTIONS = [
  { value: 'all', label: '通用(所有语言)' },
  { value: 'en-US', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'my-MM', label: 'မြန်မာ' },
];

function categoryLabel(value: string): string {
  return CATEGORY_OPTIONS.find((item) => item.value === value)?.label || value;
}
function langLabel(value: string): string {
  return LANG_OPTIONS.find((item) => item.value === value)?.label || value;
}
function durationText(sec: number): string {
  const total = Number(sec) || 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '封面', key: 'cover_col', width: 100 },
  { title: '标题', dataIndex: 'title', width: 240 },
  { title: '分类', dataIndex: 'category', width: 90 },
  { title: '语言', dataIndex: 'lang', width: 140 },
  { title: '时长', dataIndex: 'duration_sec', width: 80 },
  { title: '排序', dataIndex: 'sort', width: 80 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '更新时间', dataIndex: 'updated_at', width: 170 },
  { title: '操作', key: 'action_col', width: 140, fixed: 'right' as const },
];

const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref(0);
const coverPickerOpen = ref(false);
const videoPickerOpen = ref(false);
const form = reactive({
  category: 'hotel',
  lang: 'all',
  title: '',
  description: '',
  coverUrl: '',
  videoUrl: '',
  durationSec: 0,
  sort: 0,
  status: 1,
});

function openCreate(): void {
  editingId.value = 0;
  Object.assign(form, { category: 'hotel', lang: 'all', title: '', description: '', coverUrl: '', videoUrl: '', durationSec: 0, sort: 0, status: 1 });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editingId.value = row.id;
  Object.assign(form, {
    category: row.category,
    lang: row.lang,
    title: row.title,
    description: row.description || '',
    coverUrl: row.cover_url || '',
    videoUrl: row.video_url || '',
    durationSec: row.duration_sec || 0,
    sort: row.sort || 0,
    status: row.status,
  });
  modalOpen.value = true;
}

function selectCover(row: TableRow): void {
  form.coverUrl = String(row.file_url || '');
}

/** 读视频元数据自动回填时长(外部链接可能受跨域限制,失败就保持手填) */
function probeDuration(url: string): void {
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.onloadedmetadata = () => {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      form.durationSec = Math.round(video.duration);
    }
  };
  video.src = url;
}

function selectVideo(row: TableRow): void {
  form.videoUrl = String(row.file_url || '');
  if (!form.title.trim()) {
    form.title = String(row.original_name || row.file_name || '').replace(/\.[^.]+$/, '');
  }
  probeDuration(form.videoUrl);
}

async function submit(): Promise<void> {
  if (!form.title.trim()) {
    message.error('请输入标题');
    return;
  }
  if (!form.videoUrl.trim()) {
    message.error('请上传或填写视频');
    return;
  }
  submitting.value = true;
  try {
    await apiTutorialSave({ id: editingId.value || undefined, ...form });
    message.success('已保存');
    modalOpen.value = false;
    void load();
  } finally {
    submitting.value = false;
  }
}

async function remove(row: TableRow): Promise<void> {
  await apiTutorialDelete({ id: row.id });
  message.success('已删除');
  void load();
}

onMounted(() => void load());
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="关键字">
          <a-input v-model:value="query.keyword" placeholder="标题" allow-clear style="width: 160px" @press-enter="search" />
        </a-form-item>
        <a-form-item label="分类">
          <a-select v-model:value="query.category" :options="CATEGORY_OPTIONS" allow-clear placeholder="全部" style="width: 110px" />
        </a-form-item>
        <a-form-item label="语言">
          <a-select v-model:value="query.lang" :options="LANG_OPTIONS" allow-clear placeholder="全部" style="width: 160px" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 100px">
            <a-select-option :value="1">上架</a-select-option>
            <a-select-option :value="2">下架</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" title="教程列表">
      <template #extra>
        <a-button v-perm="'config:tutorial:save'" type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>新增教程</a-button>
      </template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1100 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'cover_col'">
            <img v-if="record.cover_url" :src="record.cover_url" alt="" class="cover-thumb" />
            <span v-else class="muted">默认封面</span>
          </template>
          <template v-else-if="column.dataIndex === 'category'">{{ categoryLabel(record.category) }}</template>
          <template v-else-if="column.dataIndex === 'lang'">
            <a-tag :color="record.lang === 'all' ? 'blue' : 'default'">{{ langLabel(record.lang) }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'duration_sec'">{{ durationText(record.duration_sec) }}</template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="record.status === 1 ? 'success' : 'default'">{{ record.status === 1 ? '上架' : '下架' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space>
              <a-button v-perm="'config:tutorial:save'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-popconfirm title="确认删除该教程?" @confirm="remove(record)">
                <a-button v-perm="'config:tutorial:delete'" type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" :title="editingId ? '编辑教程' : '新增教程'" width="720px" :confirm-loading="submitting" @ok="submit">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="分类" required>
              <a-select v-model:value="form.category" :options="CATEGORY_OPTIONS" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="语言" required extra="选「通用」则所有语言的 App 都显示">
              <a-select v-model:value="form.lang" :options="LANG_OPTIONS" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="标题" required>
              <a-input v-model:value="form.title" :maxlength="150" placeholder="如 How to book a hotel" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="简介">
              <a-textarea v-model:value="form.description" :maxlength="300" :rows="2" placeholder="一句话说明视频内容" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="视频" required extra="从文件库上传(≤100MB,mp4/mov/webm/m4v),也可直接粘贴外部链接">
              <div class="picker-row">
                <a-input v-model:value="form.videoUrl" placeholder="上传后自动回填,或粘贴 https:// 链接" />
                <a-button @click="videoPickerOpen = true"><template #icon><FolderOpenOutlined /></template>上传 / 选择</a-button>
              </div>
              <video v-if="form.videoUrl" :src="form.videoUrl" controls preload="metadata" class="video-preview"></video>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="封面图" extra="留空则 App 使用默认封面">
              <div class="picker-row">
                <a-input v-model:value="form.coverUrl" placeholder="上传后自动回填" />
                <a-button @click="coverPickerOpen = true"><template #icon><FolderOpenOutlined /></template>资源库</a-button>
              </div>
              <img v-if="form.coverUrl" :src="form.coverUrl" alt="" class="cover-preview" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="时长(秒)">
              <a-input-number v-model:value="form.durationSec" :min="0" :max="86400" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="排序" extra="越小越靠前">
              <a-input-number v-model:value="form.sort" :min="-9999" :max="9999" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="状态">
              <a-radio-group v-model:value="form.status">
                <a-radio :value="1">上架</a-radio>
                <a-radio :value="2">下架</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <FileResourcePicker
      v-model:open="videoPickerOpen"
      title="选择教程视频"
      biz-type="tutorial_video"
      :file-types="[3]"
      accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
      selection-mode="single"
      upload-perm="config:tutorial:save"
      width="1280px"
      :height="660"
      @select="selectVideo"
    />
    <FileResourcePicker
      v-model:open="coverPickerOpen"
      title="选择教程封面"
      biz-type="tutorial_cover"
      :file-types="[1]"
      selection-mode="single"
      upload-perm="config:tutorial:save"
      width="1280px"
      :height="660"
      @select="selectCover"
    />
  </PageContainer>
</template>

<style scoped>
.picker-row {
  display: flex;
  gap: 8px;
}

.cover-thumb {
  width: 72px;
  height: 44px;
  object-fit: cover;
  border-radius: 6px;
}

.muted {
  color: #94a3b8;
  font-size: 12px;
}

.video-preview {
  width: 100%;
  max-height: 220px;
  margin-top: 10px;
  border-radius: 8px;
  background: #000;
}

.cover-preview {
  width: 160px;
  margin-top: 10px;
  border-radius: 8px;
}
</style>
