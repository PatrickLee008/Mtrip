<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { EditOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import StatusTag from '@/components/StatusTag.vue';
import type { TableRow } from '@/composables/useTable';
import { apiMapList, apiMapSave, type Row } from '@/api/config';

/** 地图服务(Google Maps):按站点差异化配置,列表非分页,保存即按站点 upsert */
const { t } = useI18n();
const loading = ref(false);
const list = ref<Row[]>([]);

const columns = [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: t('common.site'), dataIndex: 'site_name', width: 140 },
  { title: t('config.map.apiKey'), dataIndex: 'api_key', width: 220, ellipsis: true },
  { title: t('config.map.language'), dataIndex: 'map_language', width: 100 },
  { title: t('config.map.defaultZoom'), dataIndex: 'default_zoom', width: 90 },
  { title: t('config.map.geocoding'), dataIndex: 'geocode_enabled', width: 90 },
  { title: t('config.map.locate'), dataIndex: 'locate_enabled', width: 70 },
  { title: t('config.map.regionLimit'), dataIndex: 'region_limit', ellipsis: true },
  { title: t('config.map.status'), dataIndex: 'status', width: 80 },
  { title: t('common.action'), key: 'action_col', width: 160, fixed: 'right' as const },
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
    message.warning(t('config.map.apiKey'));
    return;
  }
  modalSaving.value = true;
  try {
    await apiMapSave({ ...form });
    message.success(t('config.map.saved'));
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
      <template #title>{{ t('config.map.title') }} ({{ t('config.map.providerGoogle') }})</template>
      <template #extra>
        <a-space>
          <a-button @click="load"><template #icon><ReloadOutlined /></template>{{ t('common.refresh') }}</a-button>
          <a-button v-perm="'config:map:edit'" type="primary" @click="openCreate">
            <template #icon><EditOutlined /></template>{{ t('common.add') }}
          </a-button>
        </a-space>
      </template>

      <a-alert
        :message="t('config.map.geocodingTip')"
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
            {{ record.site_id === 0 ? t('app.allSites') : (record.site_name ?? record.site_id) }}
          </template>
          <template v-else-if="column.dataIndex === 'geocode_enabled'">
            {{ record.geocode_enabled === 1 ? t('common.enable') : t('common.disable') }}
          </template>
          <template v-else-if="column.dataIndex === 'locate_enabled'">
            {{ record.locate_enabled === 1 ? t('common.enable') : t('common.disable') }}
          </template>
          <template v-else-if="column.dataIndex === 'region_limit'">
            {{ record.region_limit || t('common.none') }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" />
          </template>
          <template v-else-if="column.key === 'action_col'">
            <a-space :size="0">
              <a-button v-perm="'config:map:edit'" type="link" size="small" @click="openEdit(record)">{{ t('common.edit') }}</a-button>
              <a-tooltip :title="t('config.map.actions.test')">
                <a-button type="link" size="small" disabled>{{ t('config.map.actions.test') }}</a-button>
              </a-tooltip>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑(按站点 upsert) -->
    <a-modal
      v-model:open="modalOpen"
      :title="editing ? t('common.edit') : t('common.add')"
      width="560px"
      :confirm-loading="modalSaving"
      @ok="saveMap"
    >
      <a-form :label-col="{ style: { width: '120px' } }" style="margin-top: 16px">
        <a-form-item :label="t('common.site')" required>
          <SiteTreeSelect v-model:value="form.siteId" allow-all :disabled="editing" :placeholder="t('app.allSites')" />
        </a-form-item>
        <a-form-item :label="t('config.map.apiKey')" :required="!editing">
          <a-input-password
            v-model:value="form.apiKey"
            :placeholder="editing ? t('common.pleaseInput') : t('config.map.apiKey')"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item :label="t('config.map.language')">
          <a-select v-model:value="form.mapLanguage">
            <a-select-option value="en">English</a-select-option>
            <a-select-option value="fr">Français</a-select-option>
            <a-select-option value="de">Deutsch</a-select-option>
            <a-select-option value="es">Español</a-select-option>
            <a-select-option value="it">Italiano</a-select-option>
            <a-select-option value="zh-CN">简体中文</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('config.map.defaultZoom')">
          <a-input-number v-model:value="form.defaultZoom" :min="1" :max="20" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="t('config.map.geocoding')">
          <a-radio-group v-model:value="form.geocodeEnabled">
            <a-radio :value="1">{{ t('common.enable') }}</a-radio>
            <a-radio :value="0">{{ t('common.disable') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('config.map.locate')">
          <a-radio-group v-model:value="form.locateEnabled">
            <a-radio :value="1">{{ t('common.enable') }}</a-radio>
            <a-radio :value="0">{{ t('common.disable') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('config.map.regionLimit')">
          <a-select
            v-model:value="form.regionLimit"
            mode="tags"
            :placeholder="t('config.map.regionPlaceholder')"
            :token-separators="[',']"
          />
        </a-form-item>
        <a-form-item :label="t('config.map.status')">
          <a-radio-group v-model:value="form.status">
            <a-radio :value="1">{{ t('status.enabled') }}</a-radio>
            <a-radio :value="2">{{ t('status.disabled') }}</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
