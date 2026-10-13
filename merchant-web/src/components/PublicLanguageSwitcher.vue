<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { SUPPORTED_LOCALES } from '@/locales/preferences';
import { useAppStore } from '@/stores/app';

const { t } = useI18n();
const appStore = useAppStore();
</script>

<template>
  <div class="language-switcher" role="group" :aria-label="t('header.switchLanguage')">
    <button
      v-for="item in SUPPORTED_LOCALES" :key="item.key" type="button"
      :lang="item.key" :aria-pressed="appStore.locale === item.key"
      :class="{ active: appStore.locale === item.key }" @click="appStore.setLocale(item.key)"
    >{{ item.label }}</button>
  </div>
</template>

<style scoped>
.language-switcher { display: inline-flex; flex-shrink: 0; gap: 4px; padding: 3px; border: 1px solid #dbe4f0; border-radius: 8px; background: #fff; }
.language-switcher button { min-height: 30px; padding: 0 10px; border: 0; border-radius: 5px; background: transparent; color: #64748b; cursor: pointer; font-size: 12px; }
.language-switcher button:hover { background: #f1f5f9; }
.language-switcher button.active { background: #eef4ff; color: #1747b9; font-weight: 650; }
.language-switcher button:focus-visible { outline: 2px solid #2463eb; outline-offset: 1px; }
</style>
