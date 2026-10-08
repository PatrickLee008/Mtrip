import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ToastHost from '@/components/common/ToastHost';
import type { Lang } from '@/config/global';
import { changeLanguage, initI18n } from '@/i18n';
import AppNavigator from '@/navigation';
import LanguageScreen from '@/screens/splash/LanguageScreen';
import { bootstrapStores, useCommonStore } from '@/store';
import { detectSystemLang } from '@/utils/locale';
import { applyWebGlobalStyles } from '@/utils/webStyles';

initI18n('en-US');
applyWebGlobalStyles();

export default function App() {
  const [phase, setPhase] = useState<'boot' | 'language' | 'app'>('boot');
  const [defaultLang, setDefaultLang] = useState<Lang>('en-US');
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
    void bootstrapStores().then(() => {
      const { lang, langChosen } = useCommonStore.getState();
      const selected = langChosen ? lang : detectSystemLang();
      changeLanguage(selected);
      setDefaultLang(selected);
      setPhase(langChosen ? 'app' : 'language');
    });
  }, []);

  const chooseLanguage = async (lang: Lang) => {
    await useCommonStore.getState().setLang(lang);
    changeLanguage(lang);
    setPhase('app');
  };

  return (
    <SafeAreaProvider>
      <StatusBar style={phase === 'app' ? 'auto' : 'light'} translucent backgroundColor="transparent" />
      {phase === 'app' && fontsLoaded ? <AppNavigator /> : null}
      {phase === 'language' && fontsLoaded ? <LanguageScreen defaultLang={defaultLang} onConfirm={(lang) => void chooseLanguage(lang)} /> : null}
      <ToastHost />
    </SafeAreaProvider>
  );
}
