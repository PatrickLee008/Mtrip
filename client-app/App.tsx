/**
 * App 入口:开屏(Figma Splash 452:2190)→ 启动引导(store hydrate + hooks 注入)
 * → 首次进入的语言选择(Figma Splash 2163:8057)→ 模式选择(Figma Splash 2485:7324)
 * → i18n → 导航
 *
 * 语言优先级:用户手选(本地已存) > 系统语言 > en-US。
 * 首次进入(本地没存过语言)不静默套用系统语言,而是把系统语言作为**默认选中项**
 * 弹出语言选择卡,用户按 Continue 才落地。
 *
 * **模式选择这一屏当前不问**(`ASK_MODE_ON_LAUNCH=false`):关怀模式已是默认模式
 * (`commonStore.liteMode` 初值 true),选完语言直接进主流程,改模式去「更多」页的开关。
 * 页面与整条 phase 链路**刻意原样保留**,把那个常量翻回 true 就恢复成三段引导。
 */

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import ToastHost from '@/components/common/ToastHost';
import type { Lang } from '@/config/global';
import { changeLanguage, initI18n } from '@/i18n';
import AppNavigator from '@/navigation';
import ChooseModeScreen from '@/screens/splash/ChooseModeScreen';
import SplashScreen from '@/screens/splash/SplashScreen';
import { bootstrapStores, useCommonStore } from '@/store';
import { detectSystemLang } from '@/utils/locale';
import { applyWebGlobalStyles } from '@/utils/webStyles';

// 先以兼容默认语言初始化,避免引导期间 useTranslation 无实例告警
initI18n('en-US');
// H5 端摘掉浏览器给 <input> 的聚焦框与自动填充底色(原生端空转,见函数注释)
applyWebGlobalStyles();

/** 开屏最短停留(ms):引导跑得比这快时也不让 logo 一闪而过 */
const MIN_SPLASH_MS = 1200;

/**
 * 启动时是否弹模式选择页(Figma Splash 2485:7324)。
 * 关怀模式设为默认模式后这一屏不再问,置 false;页面与下面的 'mode' 分支保留,翻回 true 即恢复。
 */
const ASK_MODE_ON_LAUNCH = false;

export default function App() {
  /** boot=纯开屏 language=语言选择 mode=模式选择 app=进主流程 */
  const [phase, setPhase] = useState<'boot' | 'language' | 'mode' | 'app'>('boot');
  const [systemLang, setSystemLang] = useState<Lang>('en-US');
  const setLang = useCommonStore((s) => s.setLang);
  const setMode = useCommonStore((s) => s.setMode);

  // 设计稿字体(Outfit 标题 / Inter 正文),未就绪时继续停在纯开屏
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
    void (async () => {
      const startedAt = Date.now();
      await bootstrapStores();

      const { lang, langChosen, modeChosen } = useCommonStore.getState();
      if (langChosen) {
        changeLanguage(lang);
      } else {
        // 取不到系统语言时 detectSystemLang 自己回落 en-US
        const detected = detectSystemLang();
        setSystemLang(detected);
        changeLanguage(detected);
      }

      const rest = MIN_SPLASH_MS - (Date.now() - startedAt);
      if (rest > 0) {
        await new Promise((resolve) => setTimeout(resolve, rest));
      }
      if (!langChosen) setPhase('language');
      else setPhase(!ASK_MODE_ON_LAUNCH || modeChosen ? 'app' : 'mode');
    })();
  }, []);

  const onPickLanguage = (picked: Lang) => {
    void (async () => {
      await setLang(picked);
      changeLanguage(picked);
      // 语言选完直接进主流程(关怀模式为默认);ASK_MODE_ON_LAUNCH 翻回 true 才接着问模式
      setPhase(
        !ASK_MODE_ON_LAUNCH || useCommonStore.getState().modeChosen ? 'app' : 'mode',
      );
    })();
  };

  const onPickMode = (lite: boolean) => {
    void (async () => {
      await setMode(lite ? 'lite' : 'full');
      setPhase('app');
    })();
  };

  const showApp = phase === 'app' && fontsLoaded;
  const showPicker = phase === 'language' && fontsLoaded;
  const showMode = phase === 'mode' && fontsLoaded;

  return (
    <SafeAreaProvider>
      {/* 开屏是主色深底,状态栏要走浅色 */}
      <StatusBar style={showApp ? 'dark' : 'light'} />
      {showApp ? <AppNavigator /> : null}
      {/* 字体没就绪时(fontsLoaded=false)三个 show* 都为假,统一停在纯开屏 */}
      {!showApp && showMode ? <ChooseModeScreen onConfirm={onPickMode} /> : null}
      {!showApp && !showMode ? (
        <SplashScreen picker={showPicker} defaultLang={systemLang} onConfirm={onPickLanguage} />
      ) : null}
      <ToastHost />
    </SafeAreaProvider>
  );
}
