import type { App, Directive } from 'vue';
import { useUserStore } from '@/stores/user';

/**
 * 按钮权限指令 v-perm="'sys:admin:add'"(支持数组=任一命中)
 * 无权限直接从 DOM 移除,杜绝调试越权(UI 方案安全约束)
 */
const perm: Directive<HTMLElement, string | string[]> = {
  mounted(el, binding) {
    const userStore = useUserStore();
    const keys = Array.isArray(binding.value) ? binding.value : [binding.value];
    const pass = keys.some((key) => userStore.hasPerm(key));
    if (!pass) {
      el.parentNode?.removeChild(el);
    }
  },
};

export function setupDirectives(app: App): void {
  app.directive('perm', perm);
}
