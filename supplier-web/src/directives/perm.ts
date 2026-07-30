import type { App, Directive } from 'vue';
import { useUserStore } from '@/stores/user';

/**
 * 按钮权限指令 v-perm="'sup:account:add'"(支持数组=任一命中)
 * 无权限直接从 DOM 移除,与后端 #[Permission] 同一把钥匙(perm_key)
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
