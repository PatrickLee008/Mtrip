import type { Router } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { apiMe } from '@/api/auth';
import { clearAuth } from '@/utils/auth';
import { installDynamicRoutes } from './dynamic';
import { i18n } from '@/locales';
import { resolveMenuI18nKey } from '@/locales/menuI18n';

/**
 * 路由守卫:登录态校验 → 动态路由注入(刷新恢复) → 页面标题
 */
export function setupRouterGuard(router: Router): void {
  router.beforeEach(async (to) => {
    const userStore = useUserStore();

    if (to.meta.public) {
      // 已登录访问登录页,回首页
      if (to.path === '/login' && userStore.isLogin) {
        return { path: '/' };
      }
      return true;
    }

    if (!userStore.isLogin) {
      return { path: '/login', query: { redirect: to.fullPath } };
    }

    // 刷新页面后恢复用户信息与动态路由
    if (!userStore.routesLoaded) {
      try {
        if (!userStore.profile) {
          userStore.profile = await apiMe();
        }
        const { menus } = await userStore.loadMenus();
        installDynamicRoutes(router, menus);
        userStore.routesLoaded = true;
        // 重新进入目标路由(此时动态路由已注册)
        return { ...to, replace: true };
      } catch {
        // 接口失败(如 token 失效/限流):必须清除本地登录态后再去登录页,
        // 否则 /login 会因 isLogin 仍为 true 被弹回首页,形成导航死循环狂刷接口
        clearAuth();
        userStore.$reset();
        return { path: '/login' };
      }
    }

    return true;
  });

  router.afterEach((to) => {
    const raw = (to.meta.title as string) || '';
    const i18nKey = resolveMenuI18nKey(raw);
    // 守卫在非 setup 上下文,使用 i18n.global.t
    const display = i18nKey ? (i18n.global.t(i18nKey) as string) : raw;
    document.title = display
      ? `${display} - ${import.meta.env.VITE_APP_TITLE}`
      : (import.meta.env.VITE_APP_TITLE as string);
  });
}
