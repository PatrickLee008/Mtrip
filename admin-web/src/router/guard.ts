import type { Router } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { apiMe } from '@/api/auth';
import { installDynamicRoutes } from './dynamic';

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
        // 接口失败(如 token 失效已被拦截器处理),放行到登录
        return { path: '/login' };
      }
    }

    return true;
  });

  router.afterEach((to) => {
    const title = (to.meta.title as string) || '';
    document.title = title ? `${title} - ${import.meta.env.VITE_APP_TITLE}` : import.meta.env.VITE_APP_TITLE;
  });
}
