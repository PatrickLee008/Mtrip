/**
 * App 入口:启动引导(store hydrate + hooks 注入)→ i18n → 导航
 */

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ToastHost from '@/components/common/ToastHost';
import { LoadingView } from '@/components/common/StateViews';
import { changeLanguage, initI18n } from '@/i18n';
import AppNavigator from '@/navigation';
import { bootstrapStores, useCommonStore, useSiteStore } from '@/store';

// 先以兼容默认语言初始化,避免引导期间 useTranslation 无实例告警
initI18n('en-US');

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      await bootstrapStores();
      // 语言优先级:用户手选 > 站点默认 > en-US
      const userLang = useCommonStore.getState().lang;
      const siteLang = useSiteStore.getState().language;
      changeLanguage(userLang || (siteLang === 'zh-CN' ? 'zh-CN' : 'en-US'));
      setReady(true);
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {ready ? <AppNavigator /> : <LoadingView />}
      <ToastHost />
    </SafeAreaProvider>
  );
}
