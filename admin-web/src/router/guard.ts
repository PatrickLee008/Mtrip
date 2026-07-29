import type { Router } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { useTabsStore } from '@/stores/tabs';
import { apiMe } from '@/api/auth';
import { clearAuth } from '@/utils/auth';
import { installDynamicRoutes } from './dynamic';
import { resolveMenuTitle } from '@/locales/menuI18n';

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
        // 恢复页签状态
        const tabsStore = useTabsStore();
        tabsStore.restore();
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
    // 统一解析:meta.title 为词条 key 时翻译;未命中按语言回退 rawTitle/rawTitleEn,纯文本标题原样显示
    const display = resolveMenuTitle(
      (to.meta.title as string) || '',
      (to.meta.rawTitle as string) || '',
      (to.meta.rawTitleEn as string) || '',
    );
    document.title = display
      ? `${display} - ${import.meta.env.VITE_APP_TITLE}`
      : (import.meta.env.VITE_APP_TITLE as string);

    // 自动添加页签（非公开路由）
    if (!to.meta.public && to.path !== '/' && to.path !== '/login') {
      const tabsStore = useTabsStore();
      tabsStore.addTab({
        key: to.path,
        title: display || to.path,
        i18nKey: (to.meta.title as string) || undefined,
        fullPath: to.fullPath,
        closable: to.path !== '/dashboard',
        name: typeof to.name === 'string' ? to.name : undefined,
        keepAlive: to.meta.keepAlive !== false,
      });
    }
  });
}
