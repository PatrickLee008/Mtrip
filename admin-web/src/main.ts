import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import App from './App.vue';
import { pinia } from '@/stores';
import { router } from '@/router';
import { setupRouterGuard } from '@/router/guard';
import { setupDirectives } from '@/directives/perm';
import { i18n } from '@/locales';
import '@/styles/index.less';
import 'ant-design-vue/dist/reset.css';

const app = createApp(App);

app.use(Antd);
app.use(pinia);
setupRouterGuard(router);
app.use(router);
app.use(i18n);
setupDirectives(app);

app.mount('#app');
