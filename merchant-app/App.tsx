import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ToastHost from '@/components/common/ToastHost';
import { changeLanguage, initI18n } from '@/i18n';
import AppNavigator from '@/navigation';
import { bootstrapStores, useCommonStore } from '@/store';
import { applyWebGlobalStyles } from '@/utils/webStyles';

initI18n('en-US');
applyWebGlobalStyles();

export default function App() {
  const [ready, setReady] = useState(false);
  const lang = useCommonStore((s) => s.lang);
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    void bootstrapStores().then(() => setReady(true));
  }, []);

  useEffect(() => {
    changeLanguage(lang);
  }, [lang]);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" translucent backgroundColor="transparent" />
      {ready && fontsLoaded ? <AppNavigator /> : null}
      <ToastHost />
    </SafeAreaProvider>
  );
}
