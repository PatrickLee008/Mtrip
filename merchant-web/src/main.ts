import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import App from './App.vue';
import { pinia } from '@/stores';
import { router } from '@/router';
import { setupRouterGuard } from '@/router/guard';
import { setupDirectives } from '@/directives/perm';
import { i18n } from '@/locales';
import 'ant-design-vue/dist/reset.css';
import '@/styles/index.less';

// 开发环境统一使用 IPv4 Origin，避免 localhost 与 127.0.0.1 的登录态相互隔离。
if (import.meta.env.DEV && window.location.hostname === 'localhost') {
  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.hostname = '127.0.0.1';
  window.location.replace(canonicalUrl);
} else {
  const app = createApp(App);

  app.use(Antd);
  app.use(pinia);
  setupRouterGuard(router);
  app.use(router);
  app.use(i18n);
  setupDirectives(app);

  app.mount('#app');
}
