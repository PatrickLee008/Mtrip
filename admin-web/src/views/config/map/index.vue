<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { EditOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import type { TableRow } from '@/composables/useTable';
import { apiMapList, apiMapSave, type Row } from '@/api/config';

/** 地图服务(Google Maps):按站点差异化配置,列表非分页,保存即按站点 upsert */
const loading = ref(false);
const list = ref<Row[]>([]);

const columns = [
  { title: 'ID', dataIndex: 'id', width: 70 },
  { title: '站点', dataIndex: 'site_name', width: 140 },
  { title: 'API Key(脱敏)', dataIndex: 'api_key', width: 220, ellipsis: true },
  { title: '地图语言', dataIndex: 'map_language', width: 100 },
  { title: '默认缩放', dataIndex: 'default_zoom', width: 90 },
  { title: '地理编码', dataIndex: 'geocode_enabled', width: 90 },
  { title: '定位', dataIndex: 'locate_enabled', width: 70 },
  { title: '区域限制', dataIndex: 'region_limit', ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 80 },
  { title: '操作', key: 'action_col', width: 160, fixed: 'right' as const },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    list.value = await apiMapList();
  } finally {
    loading.value = false;
  }
}

// ---------- 新增/编辑(按站点 upsert) ----------
const modalOpen = ref(false);
const modalSaving = ref(false);
const editing = ref(false);
const form = reactive({
  siteId: 0,
  apiKey: '',
  mapLanguage: 'en',
  defaultZoom: 12,
  geocodeEnabled: 1,
  locateEnabled: 1,
  regionLimit: [] as string[],
  status: 1,
});

function openCreate(): void {
  editing.value = false;
  Object.assign(form, {
    siteId: 0,
    apiKey: '',
    mapLanguage: 'en',
    defaultZoom: 12,
    geocodeEnabled: 1,
    locateEnabled: 1,
    regionLimit: [],
    status: 1,
  });
  modalOpen.value = true;
}

function openEdit(row: TableRow): void {
  editing.value = true;
  Object.assign(form, {
    siteId: row.site_id ?? 0,
    // API Key 掩码回显,留空保留原值
    apiKey: '',
    mapLanguage: row.map_language ?? 'en',
    defaultZoom: row.default_zoom ?? 12,
    geocodeEnabled: row.geocode_enabled ?? 1,
    locateEnabled: row.locate_enabled ?? 1,
    regionLimit: String(row.region_limit ?? '').split(',').filter(Boolean),
    status: row.status ?? 1,
  });
  modalOpen.value = true;
}

async function saveMap(): Promise<void> {
  if (!editing.value && !form.apiKey.trim()) {
    message.warning('请填写 Google Maps API Key');
    return;
  }
  modalSaving.value = true;
  try {
    await apiMapSave({ ...form });
    message.success('地图配置已保存');
    modalOpen.value = false;
    await load();
  } finally {
    modalSaving.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>地图服务(Google Maps)</template>
      <template #extra>
        <a-space>
          <a-button @click="load"><template #icon><ReloadOutlined /></template>刷新</a-button>
          <a-button v-perm="'config:map:edit'" type="primary" @click="openCreate">
            <template #icon><EditOutlined /></template>新增站点配置
          </a-button>
        </a-space>
      </template>

      <a-alert
        message="每个站点维护一份地图配置(按站点覆盖保存);API Key 展示为脱敏形式,编辑时留空表示保留原值"
        type="info"
        show-icon
        style="margin-bottom: 12px"
      />

      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
        :scroll="{ x: 1200 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'site_name'">
            {{ record.site_id === 0 ? '全平台(默认)' : (record.site_name ?? record.site_id) }}
          </template>
          <template v-else-if="column.dataIndex === 'geocode_enabled'">
            {{ record.geocode_enabled === 1 ? '开启' : '关闭' }}
          </template>
          <template v-else-if="column.dataIndex === 'locate_enabled'">
            {{ record.locate_enabled === 1 ? '开启' : '关闭' }}
          </template>
          <template v-else-if="column.dataIndex === 'region_limit'">
            {{ record.region_limit || '不限' }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'config:map:edit'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-tooltip title="联调阶段开放(模块08)">
                <a-button type="link" size="small" disabled>接口测试</a-button>
              </a-tooltip>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑(按站点 upsert) -->
    <a-modal
      v-model:open="modalOpen"
      :title="editing ? '编辑地图配置' : '新增站点地图配置'"
      width="560px"
      :confirm-loading="modalSaving"
      @ok="saveMap"
    >
      <a-form :label-col="{ style: { width: '120px' } }" style="margin-top: 16px">
        <a-form-item label="站点" required>
          <SiteTreeSelect v-model:value="form.siteId" allow-all :disabled="editing" placeholder="选择站点(0=全平台默认)" />
        </a-form-item>
        <a-form-item label="API Key" :required="!editing">
          <a-input-password
            v-model:value="form.apiKey"
            :placeholder="editing ? '留空保留原值' : 'Google Maps API Key'"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item label="地图语言">
          <a-select v-model:value="form.mapLanguage">
            <a-select-option value="en">English</a-select-option>
            <a-select-option value="fr">Français</a-select-option>
            <a-select-option value="de">Deutsch</a-select-option>
            <a-select-option value="es">Español</a-select-option>
            <a-select-option value="it">Italiano</a-select-option>
            <a-select-option value="zh-CN">简体中文</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="默认缩放级别">
          <a-input-number v-model:value="form.defaultZoom" :min="1" :max="20" style="width: 100%" />
        </a-form-item>
        <a-form-item label="地理编码">
          <a-radio-group v-model:value="form.geocodeEnabled">
            <a-radio :value="1">开启</a-radio>
            <a-radio :value="0">关闭</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="定位能力">
          <a-radio-group v-model:value="form.locateEnabled">
            <a-radio :value="1">开启</a-radio>
            <a-radio :value="0">关闭</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="区域限制">
          <a-select
            v-model:value="form.regionLimit"
            mode="tags"
            placeholder="国家码,如 FR、DE;留空不限制"
            :token-separators="[',']"
          />
        </a-form-item>
        <a-form-item label="状态">
          <a-radio-group v-model:value="form.status">
            <a-radio :value="1">启用</a-radio>
            <a-radio :value="2">停用</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
