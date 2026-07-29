import type { Router, RouteRecordRaw } from 'vue-router';
import type { MenuNode } from '@/api/types';
import { resolveMenuI18nKey } from '@/locales/menuI18n';

/** views 下全部页面组件(懒加载),key 形如 ../views/system/admin/index.vue */
const viewModules = import.meta.glob('../views/**/*.vue');

/** 组件标识(如 system/admin/index)→ 懒加载组件;未实现页面回退到 WIP 占位 */
function resolveComponent(component: string) {
  const key = `../views/${component}.vue`;
  return viewModules[key] ?? viewModules['../views/wip/index.vue'];
}

/** 菜单树(目录+页面)拍平为二级页面路由,挂到 BasicLayout 之下 */
export function buildRoutes(menus: MenuNode[]): RouteRecordRaw {
  const children: RouteRecordRaw[] = [
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: viewModules['../views/dashboard/index.vue'],
      meta: { title: 'menu.dashboard' },
    },
  ];

  const walk = (nodes: MenuNode[]): void => {
    for (const node of nodes) {
      if (node.menu_type === 2 && node.route_path) {
        children.push({
          path: node.route_path,
          name: `menu-${node.id}`,
          component: resolveComponent(node.component),
          // 优先用 i18n key;未知菜单回退到原 menu_name,PageContainer 仍会原样显示
          meta: {
            title: resolveMenuI18nKey(node.menu_name) || node.menu_name,
            rawTitle: node.menu_name,
            permKey: node.perm_key,
            menuId: node.id,
          },
        });
      }
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };
  walk(menus);

  return {
    path: '/',
    name: 'Layout',
    component: () => import('@/layouts/BasicLayout.vue'),
    redirect: '/dashboard',
    children,
  };
}

/** 注入动态路由 + 兜底 404 */
export function installDynamicRoutes(router: Router, menus: MenuNode[]): void {
  router.addRoute(buildRoutes(menus));
  router.addRoute({ path: '/:pathMatch(.*)*', redirect: '/404' });
}
