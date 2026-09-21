import { onBeforeUnmount, watch, type Ref } from 'vue';

/**
 * 弹出层关闭:点击组件根节点之外、或按 Esc 时关闭。
 * 用于本页图稿里自定义的 Room Type 下拉、月份选择浮层(稿面不是 antd 控件形态)。
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
