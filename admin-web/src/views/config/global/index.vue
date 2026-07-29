<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import { apiConfigList, apiConfigReset, apiConfigSave, type GroupedConfigs, type Row } from '@/api/config';

/** 全局参数:按分组 Tab 展示,按 value_type 渲染控件,仅提交变更项;支持按组恢复默认 */
const { t } = useI18n();

const GROUP_TABS = computed(() => [
  { key: 'base', label: t('config.global.sectionBase') },
  { key: 'security', label: t('config.global.sectionSecurity') },
  { key: 'upload', label: t('config.global.sectionUpload') },
  { key: 'client', label: t('config.global.sectionClient') },
]);

const VALUE_TYPE_TEXT = computed<Record<number, string>>(() => ({
  1: t('config.global.valueTypeString'),
  2: t('config.global.valueTypeNumber'),
  3: t('config.global.valueTypeBoolean'),
  4: t('config.global.valueTypeJSON'),
}));

const loading = ref(false);
const saving = ref(false);
const activeGroup = ref('base');
const groups = ref<GroupedConfigs>({});
/** 编辑值(key=config_key):布尔转 boolean、数字转 number,其余保持字符串 */
const model = reactive<Record<string, string | number | boolean>>({});
/** 原始字符串值,保存时 diff 用 */
const original: Record<string, string> = {};

function parseValue(row: Row): string | number | boolean {
  const raw = String(row.config_value ?? '');
  if (row.value_type === 2) {
    return raw === '' ? 0 : Number(raw);
  }
  if (row.value_type === 3) {
    return raw === '1';
  }
  return raw;
}

function toStr(value: string | number | boolean): string {
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  return String(value ?? '');
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    groups.value = await apiConfigList();
    Object.keys(model).forEach((key) => delete model[key]);
    Object.values(groups.value).forEach((rows) => {
      rows.forEach((row) => {
        model[row.config_key] = parseValue(row);
        original[row.config_key] = toStr(parseValue(row));
      });
    });
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  // 仅提交有变更的配置项(value 统一转字符串)
  const changed: { key: string; value: string }[] = [];
  for (const rows of Object.values(groups.value)) {
    for (const row of rows) {
      const current = toStr(model[row.config_key]);
      if (current === original[row.config_key]) {
        continue;
      }
      // JSON 类型先做本地校验,避免脏数据入库
      if (row.value_type === 4 && current !== '') {
        try {
          JSON.parse(current);
        } catch {
          message.error(`「${row.config_name}」${t('config.global.valueTypeJSON')}`);
          return;
        }
      }
      changed.push({ key: row.config_key, value: current });
    }
  }
  if (!changed.length) {
    message.info(t('common.info'));
    return;
  }
  saving.value = true;
  try {
    const result = await apiConfigSave(changed);
    message.success(`${t('config.global.saved')} ${result.updated}`);
    await load();
  } finally {
    saving.value = false;
  }
}

async function resetGroup(): Promise<void> {
  const result = await apiConfigReset({ group: activeGroup.value });
  message.success(`${t('config.global.saved')} ${result.reset}`);
  await load();
}

function isLogoKey(key: string): boolean {
  return key.includes('logo');
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>{{ t('config.global.title') }}</template>
      <template #extra>
        <a-space>
          <a-popconfirm
            :title="`${GROUP_TABS.find((tab) => tab.key === activeGroup)?.label} - ${t('common.confirm')}?`"
            :ok-text="t('common.confirm')"
            :ok-button-props="{ danger: true }"
            @confirm="resetGroup"
          >
            <a-button v-perm="'config:global:reset'" danger>
              <template #icon><ReloadOutlined /></template>{{ t('common.refresh') }}
            </a-button>
          </a-popconfirm>
          <a-button v-perm="'config:global:edit'" type="primary" :loading="saving" @click="save">
            <template #icon><SaveOutlined /></template>{{ t('config.global.actions.save') }}
          </a-button>
        </a-space>
      </template>

      <a-spin :spinning="loading">
        <a-tabs v-model:active-key="activeGroup">
          <a-tab-pane v-for="tab in GROUP_TABS" :key="tab.key" :tab="tab.label">
            <a-form :label-col="{ style: { width: '200px' } }" style="max-width: 760px; margin-top: 8px">
              <a-form-item v-for="row in groups[tab.key] ?? []" :key="row.config_key" :label="row.config_name">
                <!-- 布尔:开关 -->
                <a-switch
                  v-if="row.value_type === 3"
                  v-model:checked="model[row.config_key]"
                  :checked-children="t('common.enable')"
                  :un-checked-children="t('common.disable')"
                />
                <!-- 数字 -->
                <a-input-number
                  v-else-if="row.value_type === 2"
                  v-model:value="model[row.config_key]"
                  style="width: 220px"
                />
                <!-- JSON:多行文本 -->
                <a-textarea
                  v-else-if="row.value_type === 4"
                  v-model:value="model[row.config_key]"
                  :rows="4"
                  :placeholder="t('config.global.valueTypeJSON')"
                />
                <!-- 字符串(Logo 类附带图片预览) -->
                <template v-else>
                  <a-input v-model:value="model[row.config_key]" :placeholder="row.remark || undefined" />
                  <div v-if="isLogoKey(row.config_key) && model[row.config_key]" class="logo-preview">
                    <a-image :src="String(model[row.config_key])" :height="48" />
                  </div>
                </template>
                <div class="cfg-meta">
                  <span>{{ t('config.global.configKey') }}:{{ row.config_key }}</span>
                  <span>{{ t('config.global.valueType') }}:{{ VALUE_TYPE_TEXT[row.value_type] ?? row.value_type }}</span>
                  <span v-if="row.remark">{{ t('common.remark') }}:{{ row.remark }}</span>
                </div>
              </a-form-item>
            </a-form>
          </a-tab-pane>
        </a-tabs>
      </a-spin>
    </a-card>
  </PageContainer>
</template>

<style scoped lang="less">
.cfg-meta {
  display: flex;
  gap: 16px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--mtrip-text-aux);
}

.logo-preview {
  margin-top: 8px;
  padding: 8px;
  display: inline-block;
  border-radius: 4px;
  background: var(--mtrip-bg-page);
}
</style>
