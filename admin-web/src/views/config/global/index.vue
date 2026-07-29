<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { apiConfigList, apiConfigReset, apiConfigSave, type GroupedConfigs, type Row } from '@/api/config';

/** 全局参数:按分组 Tab 展示,按 value_type 渲染控件,仅提交变更项;支持按组恢复默认 */
const GROUP_TABS = [
  { key: 'base', label: '平台基础' },
  { key: 'security', label: '安全策略' },
  { key: 'upload', label: '上传限制' },
  { key: 'client', label: '客户端与日志' },
];

const VALUE_TYPE_TEXT: Record<number, string> = { 1: '字符串', 2: '数字', 3: '布尔', 4: 'JSON' };

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
          message.error(`「${row.config_name}」不是合法 JSON`);
          return;
        }
      }
      changed.push({ key: row.config_key, value: current });
    }
  }
  if (!changed.length) {
    message.info('没有需要保存的变更');
    return;
  }
  saving.value = true;
  try {
    const result = await apiConfigSave(changed);
    message.success(`已保存 ${result.updated} 项配置`);
    await load();
  } finally {
    saving.value = false;
  }
}

async function resetGroup(): Promise<void> {
  const result = await apiConfigReset({ group: activeGroup.value });
  message.success(`已恢复 ${result.reset} 项为系统默认值`);
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
      <template #title>全局参数</template>
      <template #extra>
        <a-space>
          <a-popconfirm
            :title="`确认将「${GROUP_TABS.find((t) => t.key === activeGroup)?.label}」分组恢复为系统默认值?`"
            ok-text="恢复默认"
            :ok-button-props="{ danger: true }"
            @confirm="resetGroup"
          >
            <a-button v-perm="'config:global:reset'" danger>
              <template #icon><ReloadOutlined /></template>恢复本组默认
            </a-button>
          </a-popconfirm>
          <a-button v-perm="'config:global:edit'" type="primary" :loading="saving" @click="save">
            <template #icon><SaveOutlined /></template>保存变更
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
                  checked-children="开"
                  un-checked-children="关"
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
                  placeholder="JSON 格式"
                />
                <!-- 字符串(Logo 类附带图片预览) -->
                <template v-else>
                  <a-input v-model:value="model[row.config_key]" :placeholder="row.remark || undefined" />
                  <div v-if="isLogoKey(row.config_key) && model[row.config_key]" class="logo-preview">
                    <a-image :src="String(model[row.config_key])" :height="48" />
                  </div>
                </template>
                <div class="cfg-meta">
                  <span>键:{{ row.config_key }}</span>
                  <span>类型:{{ VALUE_TYPE_TEXT[row.value_type] ?? row.value_type }}</span>
                  <span v-if="row.remark">说明:{{ row.remark }}</span>
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
