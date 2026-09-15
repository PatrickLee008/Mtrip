/**
 * 开屏页(按 Figma M-Trip / Splash `452:2190` + `2163:8057` 实现)
 *
 * 两个阶段共用同一层背景(主色底 + logo + 底部两条白色 10% 波浪):
 *   phase=boot     纯开屏 `452:2190` —— 只有居中 logo,启动引导期间显示
 *   phase=language 语言选择 `2163:8057` —— logo + 标语 + 白色卡(标题 + 三行语言 + Continue)
 * 只有「首次进入」(本地没存过语言)才会走到第二阶段,选完写本地,之后不再出现。
 * 选完语言接着走模式选择 `2485:7324`(见 ChooseModeScreen),两屏的编排在 App.tsx。
 *
 * 设计稿实测(logo 与波浪已抽到 components/splash/SplashBackdrop.tsx,量值见该文件):
 *   logo    框 286×211
 *   卡片    --tab #FEFEFE,圆角 32,padding 24,gap 8;内列 gap 16,标题下方 pb8
 *   语言行  1px --secondary 描边,圆角 12,padding 16,行内 gap 12;国旗 40 圆形裁切
 *   勾选框  选中 fluent:checkbox-indeterminate 主色,未选 fluent:checkbox-unchecked #191A25(取自导出资产)
 *   CTA     主色,py16,圆角 12,Outfit 400/16
 *
 * 与设计稿的偏差:
 *   设计稿三行的国旗与文案对错了位(第一行「Choose English」配缅甸国旗、第二行缅甸文配英美国旗),
 *   这里按语言正确配对(English→英美、မြန်မာ→缅甸、中文→中国),顺序仍按设计稿。
 */

import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { SplashLogo, SplashWaves } from '@/components/splash/SplashBackdrop';
import { PAGE_PADDING, colors, radius } from '@/config/theme';
import { SUPPORTED_LANGS, type Lang } from '@/config/global';
import { fonts } from '@/config/typography';

const FLAGS: Record<Lang, number> = {
  'en-US': require('../../../assets/images/splash/flag-en.png'),
  'my-MM': require('../../../assets/images/splash/flag-my.png'),
  'zh-CN': require('../../../assets/images/splash/flag-zh.png'),
};

/**
 * 每种语言用它自己的文字标注(设计稿原文),不走 i18n ——
 * 选语言的时候用户还没定语言,列表必须永远同时可读
 */
const LANG_LABELS: Record<Lang, string> = {
  'en-US': 'Choose English',
  'my-MM': 'မြန်မာဘာသာစကားရွေးချယ်မည်',
  'zh-CN': '将选择中文',
};

/** 设计稿 logo 框 */
const LOGO_BOX = { width: 286, height: 211 };
/** 国旗圆框 40,内部图片按 275/183 比例撑满高度后左右裁切 */
const FLAG_SIZE = 40;
const FLAG_IMAGE_WIDTH = (FLAG_SIZE * 275) / 183;

interface Props {
  /** true = 显示语言选择卡(首次进入);false = 纯开屏 */
  picker?: boolean;
  /** 语言卡的默认选中项(系统语言,取不到为 en-US) */
  defaultLang?: Lang;
  onConfirm?: (lang: Lang) => void;
}

export default function SplashScreen({ picker = false, defaultLang = 'en-US', onConfirm }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Lang>(defaultLang);

  /* 标题与按钮跟着当前选中项走,点哪个语言就先预览哪个语言(不改全局语言) */
  const preview = (key: string) => t(key, { lng: selected });

  return (
    <View style={styles.root}>
      <SplashWaves />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.main}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SplashLogo box={LOGO_BOX} />

          {picker ? (
            <>
              <Text style={styles.tagline}>{t('user.tagline', { lng: selected })}</Text>

              <View style={styles.card}>
                <View style={styles.cardBody}>
                  <View style={styles.headingWrap}>
                    <Text style={styles.heading}>{preview('splash.chooseLanguage')}</Text>
                  </View>

                  {SUPPORTED_LANGS.map((l) => (
                    <Pressable
                      key={l}
                      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                      onPress={() => setSelected(l)}
                    >
                      <View style={styles.flagBox}>
                        <Image source={FLAGS[l]} style={flagImageStyle(l)} resizeMode="cover" />
                      </View>
                      <View style={styles.optionMain}>
                        <Text style={[styles.optionLabel, l === selected && styles.optionLabelOn]}>
                          {LANG_LABELS[l]}
                        </Text>
                        <HomeIcon
                          name={l === selected ? 'checkboxIndeterminate' : 'checkbox'}
                          size={20}
                          color={l === selected ? colors.primary : colors.body}
                        />
                      </View>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
                  onPress={() => onConfirm?.(selected)}
                >
                  <Text style={styles.ctaText}>{preview('splash.continue')}</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/**
 * 国旗图片:英美/缅甸是矩形旗,按 60.11×40 居中裁进圆框;
 * 中国旗导出的是带阴影的方形圆标,设计稿另做了 150.27%/left10.02%/top-11.12% 的二次裁切
 */
function flagImageStyle(lang: Lang) {
  if (lang === 'zh-CN') {
    return {
      position: 'absolute' as const,
      width: FLAG_IMAGE_WIDTH,
      height: FLAG_IMAGE_WIDTH,
      left: FLAG_IMAGE_WIDTH * 0.1002 - (FLAG_IMAGE_WIDTH - FLAG_SIZE) / 2,
      top: -FLAG_SIZE * 0.1112,
    };
  }
  return {
    position: 'absolute' as const,
    width: FLAG_IMAGE_WIDTH,
    height: FLAG_SIZE,
    left: -(FLAG_IMAGE_WIDTH - FLAG_SIZE) / 2,
    top: 0,
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  safe: { flex: 1 },

  main: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: PAGE_PADDING,
    paddingVertical: PAGE_PADDING,
    gap: 16,
  },

  tagline: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },

  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 24,
    gap: 8,
  },
  cardBody: { gap: 16 },
  headingWrap: { alignItems: 'center', paddingBottom: 8 },
  heading: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 32,
    color: colors.heading,
    textAlign: 'center',
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
  },
  /* 设计稿圆角 99 = 正圆 */
  flagBox: {
    width: FLAG_SIZE,
    height: FLAG_SIZE,
    borderRadius: FLAG_SIZE / 2,
    overflow: 'hidden',
  },
  optionMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  /* 未选中是 --text-2,选中是 --text */
  optionLabel: { flexShrink: 1, fontFamily: fonts.inter, fontSize: 16, color: colors.textSoft },
  optionLabelOn: { color: colors.heading },

  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  ctaText: {
    fontFamily: fonts.outfit,
    fontSize: 16,
    lineHeight: 28,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  pressed: { opacity: 0.85 },
});
