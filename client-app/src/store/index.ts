/**
 * store 汇总与启动引导:
 * 注入请求层/日志上下文钩子,恢复本地持久化状态
 */

import { setRequestHooks } from '@/api/request';
import { setLogContextProvider } from '@/logs/logger';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import { useUserStore } from '@/store/userStore';
import { getGdprConsent } from '@/utils/gdpr';

export { useCommonStore } from '@/store/commonStore';
export { useSiteStore } from '@/store/siteStore';
export { useUserStore } from '@/store/userStore';

/** App 启动引导(App.tsx 调用一次) */
export async function bootstrapStores(): Promise<void> {
  setRequestHooks({
    getToken: () => useUserStore.getState().token,
    getSiteId: () => useSiteStore.getState().siteId,
    getLang: () => useCommonStore.getState().lang,
    onUnauthorized: () => useUserStore.getState().clearLocal(),
    onToast: (message) => useCommonStore.getState().showToast(message),
  });
  setLogContextProvider(() => ({
    siteId: useSiteStore.getState().siteId,
    userId: useUserStore.getState().profile?.id ?? 0,
  }));

  await Promise.all([
    useUserStore.getState().hydrate(),
    useSiteStore.getState().hydrate(),
    useCommonStore.getState().hydrate(),
  ]);
  const consent = await getGdprConsent();
  useCommonStore.getState().setGdprAccepted(consent?.accepted === true);
}
