<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue';
import { apiConfigList, apiConfigSave } from '@/api/config';
import { useUserStore } from '@/stores/user';

const { t } = useI18n();
const user = useUserStore();
const text = (key: string) => t(`platformConfig.${key}`);
const keys = ['platform_name', 'platform_logo', 'default_currency', 'default_language', 'default_timezone', 'customer_service_email'];
const form = reactive<Record<string, string>>({});
const original = ref<Record<string, string>>({});
const loading = ref(false);
const saving = ref(false);
const failed = ref(false);
const ready = ref(false);
const dirty = computed(() => keys.some(key => key in original.value && form[key] !== original.value[key]));
const languages = computed(() => {
  const options = [{ value: 'en-US', label: 'English' }, { value: 'zh-CN', label: '简体中文' }];
  if (form.default_language && !options.some(option => option.value === form.default_language)) {
    options.push({ value: form.default_language, label: form.default_language });
  }
  return options;
});

async function load(): Promise<void> {
  loading.value = true;
  failed.value = false;
  ready.value = false;
  try {
    const groups = await apiConfigList('base');
    original.value = {};
    keys.forEach(key => delete form[key]);
    for (const row of groups.base ?? []) {
      if (!keys.includes(row.config_key)) continue;
      form[row.config_key] = String(row.config_value ?? '');
      original.value[row.config_key] = form[row.config_key];
    }
    ready.value = true;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  if (!ready.value || loading.value || saving.value || !user.hasPerm('config:global:edit')) return;
  const changed = keys.filter(key => key in original.value && form[key] !== original.value[key])
    .map(key => ({ key, value: form[key].trim() }));
  if (!changed.length) return;
  for (const { key, value } of changed) {
    let valid = true;
    if (key === 'platform_name' || key === 'default_language') valid = value !== '';
    if (key === 'default_currency') valid = /^[A-Z]{3}$/.test(value);
    if (key === 'customer_service_email') valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (key === 'default_timezone') {
      try { new Intl.DateTimeFormat('en-US', { timeZone: value }); } catch { valid = false; }
    }
    if (key === 'platform_logo' && value !== '') {
      try { valid = ['https:', 'http:'].includes(new URL(value, 'http://localhost').protocol); } catch { valid = false; }
    }
    if (!valid) { message.warning(text(`validation.${key}`)); return; }
  }
  saving.value = true;
  try {
    await apiConfigSave(changed);
    for (const item of changed) {
      original.value[item.key] = item.value;
      form[item.key] = item.value;
    }
    message.success(t('tip.saveSuccess'));
  } catch {
    // 全局 HTTP 层已提示错误，保留草稿以便重试。
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <a-card :bordered="false" class="mtrip-card-shadow platform-settings">
    <template #title>{{ text('sections.platform.title') }}</template>
    <template #extra>
      <a-space wrap>
        <a-button :loading="loading" :disabled="saving" @click="load"><ReloadOutlined />{{ t('common.refresh') }}</a-button>
        <a-button v-perm="'config:global:edit'" type="primary" :loading="saving" :disabled="!ready || loading || !dirty" @click="save"><SaveOutlined />{{ t('common.save') }}</a-button>
      </a-space>
    </template>
    <a-alert v-if="failed" type="error" show-icon :message="text('loadFailed')">
      <template #action><a-button size="small" @click="load">{{ text('retry') }}</a-button></template>
    </a-alert>
    <a-spin v-else :spinning="loading">
      <a-form layout="vertical" :disabled="loading || saving || !user.hasPerm('config:global:edit')">
        <div v-for="key in keys" :key="key" class="setting-row">
          <div><label :for="`platform-${key}`">{{ t(`config.global.item.${key}`) }}</label><p>{{ text(`help.${key}`) }}</p></div>
          <a-select v-if="key === 'default_language'" :id="`platform-${key}`" v-model:value="form[key]" :options="languages" :disabled="!(key in original) || loading || saving || !user.hasPerm('config:global:edit')" />
          <a-input v-else :id="`platform-${key}`" v-model:value="form[key]" :disabled="!(key in original) || loading || saving || !user.hasPerm('config:global:edit')" :placeholder="text('notConfigured')" :maxlength="key === 'default_currency' ? 3 : undefined" />
        </div>
        <div v-for="field in ['maxBookingAdvance', 'supportedLanguages', 'maxHotelStays']" :key="field" class="setting-row unavailable-setting">
          <div><label :for="`platform-${field}`">{{ text(`fields.${field}`) }} <a-tag>{{ text('pending') }}</a-tag></label><p>{{ text(`help.${field}`) }}</p></div>
          <a-input :id="`platform-${field}`" disabled :placeholder="text('notConfigured')" />
        </div>
      </a-form>
    </a-spin>
  </a-card>
</template>

<style scoped lang="less">
.setting-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(200px, 40%); align-items: center; gap: 28px; padding: 20px 0; border-bottom: 1px solid #f1f2f6; &:last-child { border-bottom: 0; } label { font-size: 14px; font-weight: 500; color: var(--mtrip-text-main); } p { margin: 5px 0 0; color: var(--mtrip-text-aux); font-size: 12px; line-height: 19px; } }
.unavailable-setting :deep(.ant-tag) { margin-left: 6px; font-size: 11px; }
@media (max-width: 600px) { .setting-row { grid-template-columns: 1fr; gap: 12px; } .platform-settings :deep(.ant-card-head-wrapper) { flex-wrap: wrap; gap: 12px; padding: 12px 0; } }
</style>
