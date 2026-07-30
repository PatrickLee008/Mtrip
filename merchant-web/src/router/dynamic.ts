import { defineAsyncComponent, defineComponent, h, type Component } from 'vue';
import type { Router, RouteRecordRaw } from 'vue-router';
import type { MenuNode } from '@/api/types';
import { resolveMenuI18nKey } from '@/locales/menuI18n';

/** views 下全部页面组件(懒加载),key 形如 ../views/account/index.vue */
const viewModules = import.meta.glob('../views/**/*.vue');

/**
 * 把懒加载页面包成唯一具名组件(名字=路由 name):
 * 页面文件全是 index.vue,<script setup> 推断名相同,KeepAlive include 无法区分,必须包一层才能按页签精确缓存
 */
function wrapView(viewKey: string, name: string): Component {
  const loader = (viewModules[viewKey] ?? viewModules['../views/wip/index.vue']) as () => Promise<{ default: Component }>;
  const Page = defineAsyncComponent(loader);
  return defineComponent({
    name,
    setup() {
      return () => h(Page);
    },
  });
}

/** 组件标识(如 account/index)→ 唯一具名懒加载组件;未实现页面回退到 WIP 占位 */
function resolveComponent(component: string, name: string): Component {
  return wrapView(`../views/${component}.vue`, name);
}

/** 菜单树(目录+页面)拍平为二级页面路由,挂到 BasicLayout 之下 */
export function buildRoutes(menus: MenuNode[]): RouteRecordRaw {
  const children: RouteRecordRaw[] = [
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: wrapView('../views/dashboard/index.vue', 'Dashboard'),
      meta: { title: 'menu.dashboard', keepAlive: true },
    },
  ];

  const walk = (nodes: MenuNode[]): void => {
    for (const node of nodes) {
      if (node.menu_type === 2 && node.route_path) {
        const name = `menu-${node.id}`;
        children.push({
          path: node.route_path,
          name,
          component: resolveComponent(node.component, name),
          // 多语言:title 存词条 key(i18n_key 优先,旧数据用中文名映射兜底);原始中/英文名存 rawTitle/rawTitleEn 供回退
          meta: {
            title: node.i18n_key || resolveMenuI18nKey(node.menu_name) || '',
            rawTitle: node.menu_name,
            rawTitleEn: node.menu_name_en || '',
            permKey: node.perm_key,
            menuId: node.id,
            // 页面缓存开关(merchant_menu.is_cache,默认缓存),配合多页签 KeepAlive
            keepAlive: node.is_cache !== 2,
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
