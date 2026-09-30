import { setRequestHooks } from '@/api/request';
import { setLogContextProvider } from '@/logs/logger';
import { useCommonStore } from '@/store/commonStore';
import { useMerchantStore } from '@/store/merchantStore';
import { useRegistrationStore } from '@/store/registrationStore';

export { useCommonStore } from '@/store/commonStore';
export { useMerchantStore } from '@/store/merchantStore';
export { useRegistrationStore } from '@/store/registrationStore';

export async function bootstrapStores(): Promise<void> {
  setRequestHooks({
    getToken: () => useMerchantStore.getState().token,
    getSiteId: () => useCommonStore.getState().siteId,
    getLang: () => useCommonStore.getState().lang,
    onUnauthorized: () => useMerchantStore.getState().clearLocal(),
    onToast: (message) => useCommonStore.getState().showToast(message),
  });
  setLogContextProvider(() => ({
    siteId: useCommonStore.getState().siteId,
    merchantAdminId: useMerchantStore.getState().profile?.id ?? 0,
  }));
  await useCommonStore.getState().hydrate();
  await Promise.all([useMerchantStore.getState().hydrate(), useRegistrationStore.getState().hydrate()]);
}
