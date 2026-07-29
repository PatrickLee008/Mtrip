import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

/** 静态路由:登录、错误页;'/' 由动态路由注入后重定向 */
export const staticRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/403.vue'),
    meta: { title: '403', public: true },
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '404', public: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes: staticRoutes,
});
