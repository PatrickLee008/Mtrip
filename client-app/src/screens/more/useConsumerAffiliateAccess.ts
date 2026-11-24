import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { fetchConsumerAffiliateAccess, type ConsumerAffiliateAccess } from '@/api/user';
import { useUserStore } from '@/store/userStore';

export function useConsumerAffiliateAccess() {
  const token = useUserStore((state) => state.token);
  const [access, setAccess] = useState<ConsumerAffiliateAccess>();
  useFocusEffect(useCallback(() => {
    let current = 0;
    const refresh = () => {
      const request = ++current;
      setAccess(undefined);
      if (!token) return;
      void fetchConsumerAffiliateAccess().then((result) => {
        if (request === current) setAccess(result);
      }).catch(() => {
        if (request === current) setAccess({ active: false });
      });
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      current++;
      subscription.remove();
    };
  }, [token]));
  return token ? access : { active: false } as const;
}
