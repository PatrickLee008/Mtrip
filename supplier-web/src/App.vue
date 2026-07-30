<script setup lang="ts">
import { computed, watch } from 'vue';
import { ConfigProvider, theme as antdTheme } from 'ant-design-vue';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import enUS from 'ant-design-vue/es/locale/en_US';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/stores/app';
import { baseToken, darkComponents, lightComponents } from '@/config/theme';

const appStore = useAppStore();
const { locale } = useI18n();

const antdLocale = computed(() => (appStore.locale === 'zh-CN' ? zhCN : enUS));

const themeConfig = computed(() => ({
  algorithm: appStore.theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: baseToken,
  components: appStore.theme === 'dark' ? darkComponents : lightComponents,
}));

// 语言联动:vue-i18n + dayjs
watch(
  () => appStore.locale,
  (value) => {
    locale.value = value;
    dayjs.locale(value === 'zh-CN' ? 'zh-cn' : 'en');
  },
  { immediate: true },
);

// 暗色模式给 body 加标记,便于全局样式覆盖
watch(
  () => appStore.theme,
  (value) => {
    document.documentElement.setAttribute('data-theme', value);
  },
  { immediate: true },
);
</script>

<template>
  <ConfigProvider :locale="antdLocale" :theme="themeConfig">
    <router-view />
  </ConfigProvider>
</template>
