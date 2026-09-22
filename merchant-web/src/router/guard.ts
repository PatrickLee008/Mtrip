import type { Router } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { apiMe } from '@/api/auth';
import { clearAuth, isSupportSession } from '@/utils/auth';
import { installDynamicRoutes } from './dynamic';
import { resolveMenuTitle } from '@/locales/menuI18n';

/**
 * 路由守卫:登录态校验 → 动态路由注入(刷新恢复) → 页面标题
 * (多页签已取消:不再维护页签状态,随 docs/redesign 原型改造移除)
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
      return isSupportSession() ? { path: '/support-session' } : { path: '/login', query: { redirect: to.fullPath } };
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
        const support = isSupportSession();
        clearAuth();
        userStore.$reset();
        return { path: support ? '/support-session' : '/login' };
      }
    }

    // 物业专属入口自带物业 id(「所有物业」列表点 Manage、深链、刷新都算):直接对齐全局选中物业,
    // 效果与在左上角下拉里选同一家酒店一致 —— 下拉读 selectedProperty,左侧物业专属菜单读 visibleMenus,
    // 两者都挂在 selectedPropertyId 上,所以这一句就能让下拉与侧边栏一起联动。
    // ⚠️ 只有 PropertyProfile 的 :id 才是物业 id;`/rooms/:id` 是**房型** id,绝不能拿来选物业。
    const pathPropertyId = to.name === 'PropertyProfile' ? Number(to.params.id) || 0 : 0;
    const queryPropertyId = Number(to.query.propertyId) || 0;
    const routePropertyId = pathPropertyId || queryPropertyId;
    if (routePropertyId > 0) {
      userStore.selectProperty(routePropertyId);
    }

    // 「所有物业」列表页就是全局的 **All Properties 模式**:进入时必须清掉选中物业。
    // 否则左上角下拉仍停在某家酒店,而且列表接口会带上 X-Mtrip-Property-Id,
    // 被后端 scopePropertyIds() 收窄成只剩那一家(用户报的两半问题)。
    // 放在守卫里(而不是页面 onMounted)是为了在页面挂载前就清干净,列表只按无 header 拉一次。
    if (to.name === 'AllProperties') {
      userStore.selectProperty(null);
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
  });
}
