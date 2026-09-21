import { onBeforeUnmount, watch, type Ref } from 'vue';

/**
 * 弹出层关闭:点击组件根节点之外、或按 Esc 时关闭。
 * 用于图稿里自定义的下拉/浮层(稿面不是 antd 控件形态)。
 *
 * 2026-09-22 从 `views/availability/useDismiss.ts` 提到 `composables/`,
 * 供 availability 与 earnings 两页共用(两页都要自绘下拉)。
 */
export function useDismiss(root: Ref<HTMLElement | null>, active: Ref<boolean>, close: () => void): void {
  function onPointerDown(event: MouseEvent): void {
    const el = root.value;
    if (el && !el.contains(event.target as Node)) close();
  }
  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') close();
  }

  watch(active, (open) => {
    if (open) {
      document.addEventListener('mousedown', onPointerDown);
      document.addEventListener('keydown', onKeydown);
    } else {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeydown);
    }
  });

  onBeforeUnmount(() => {
    document.removeEventListener('mousedown', onPointerDown);
    document.removeEventListener('keydown', onKeydown);
  });
}
