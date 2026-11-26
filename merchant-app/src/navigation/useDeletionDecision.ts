import { useEffect } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { apiDeletionReceipt } from '@/api/deletion';
import { useMerchantStore } from '@/store/merchantStore';
import { clearDeletionReceipt, readDeletionReceipt } from '@/utils/deletionReceipt';

export function useDeletionDecision(returnToLogin: () => void) {
  const { t } = useTranslation();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    let checking = false;
    let displayed = 0;

    async function checkDecision() {
      if (checking || AppState.currentState === 'background') return;
      checking = true;
      try {
        const receipt = await readDeletionReceipt();
        if (!receipt || !active || displayed === receipt.id) return;
        const profile = useMerchantStore.getState().profile;
        if (profile && profile.id !== receipt.accountId) return;

        const result = await apiDeletionReceipt(receipt.id, receipt.token);
        const current = useMerchantStore.getState().profile;
        if (!active || (current && current.id !== receipt.accountId) || result.status === 'pending') return;
        displayed = receipt.id;
        if (result.status === 'approved' && current) {
          try { await useMerchantStore.getState().clearLocal(); }
          finally { if (active) returnToLogin(); }
        }
        const localKey = 'menu.security.deletion.';
        if (active && (result.status === 'approved' || result.status === 'rejected')) {
          Alert.alert(t(localKey + result.status), t(localKey + result.status + 'Copy'), [
            { text: t('dashboardHome.close'), onPress: () => { void clearDeletionReceipt(receipt.id).catch(() => undefined); } },
          ], { cancelable: false });
        } else if (result.status === 'cancelled') {
          await clearDeletionReceipt(receipt.id);
        }
      } catch { /* Try again on the next foreground refresh. */ }
      finally { checking = false; }
    }

    void checkDecision();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void checkDecision(); });
    const interval = setInterval(() => { if (AppState.currentState === 'active') void checkDecision(); }, 30_000);
    return () => { active = false; listener.remove(); clearInterval(interval); };
  }, [returnToLogin, t]);
}
