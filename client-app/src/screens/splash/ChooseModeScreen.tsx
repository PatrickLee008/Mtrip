/**
 * 模式选择页(按 Figma M-Trip / Splash `2485:7324` "Choose Mode" 实现)
 *
 * 开屏引导的第三屏:纯开屏 → 语言选择 → **模式选择** → 主流程(编排见 App.tsx)。
 * 与前两屏共用同一层底衬(主色底 + logo + 底部两条白色 10% 波浪,见 SplashBackdrop)。
 *
 * 两个选项各自带一个直接落地的按钮(不是「先选中再 Continue」)——
 * 设计稿画的就是两张卡各配一个 CTA,点哪张就按哪种模式进入。
 *
 * 设计稿实测:
 *   页面    主色底,px16 py60,logo 组在上、卡片在下(justify-between);logo 框 217×160,下方标语 gap4
 *   卡片    --tab #FEFEFE,圆角 24,padding 24,gap 8;内列 gap 16,标题下方 pb8,选项间 gap16
 *   选项卡  圆角 12,padding 16,内部 gap 12,2px 描边
 *           Lite 底 rgba(239,246,255,0.7) + 主色描边 + 投影 0/1 blur2 黑 5%(= shadows.subtle)
 *           Full 底 --tab + --secondary 描边,无投影
 *   头部行  gap 14;图标底板 48 圆角 12(Lite 主色底 + 0/4 blur6 与 0/2 blur4 黑 10% 投影 = shadows.media,
 *           白色 fluent:accessibility-20-filled;Full --secondary 底,主色 fluent:grid-20-filled 20)
 *   文字    标题 Inter 700/18 --text;副标 Inter 700/12 主色;说明 Inter 500/12 --text-2(行高 19.5)
 *   按钮    整宽圆角 12;Lite 主色实心 py12 白字 Inter 700/16;Full 2px 主色描边 h50 主色字
 *   脚注    Inter 500/12 --text-2 居中(设计稿左侧那枚 16 的图标是 hidden,故不画)
 *
 * 与设计稿的偏差:
 *   标题节点名仍写着 "Choose a language to continue"(从语言选择页复制过来没改),
 *   但可见文案是 "Choose a Mode to continue",这里按可见文案走。
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import HomeIcon, { type HomeIconName } from '@/components/home/HomeIcon';
import { SplashLogo, SplashWaves } from '@/components/splash/SplashBackdrop';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 设计稿本屏的 logo 框(比纯开屏的 286×211 小一号) */
const LOGO_BOX = { width: 217, height: 160 };

/**
 * Lite 卡底色:设计稿 `#EFF6FF` 叠 70%。
 * 注意它**不是** `colors.tintBg`(#EFF4FF,不透明)—— 两者色相差一点,这里按设计稿原值。
 */
const LITE_CARD_BG = 'rgba(239, 246, 255, 0.7)';

interface Props {
  /** 选定模式:true = 关怀(Lite)模式 */
  onConfirm?: (lite: boolean) => void;
}

export default function ChooseModeScreen({ onConfirm }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <SplashWaves />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.main}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoGroup}>
            <SplashLogo box={LOGO_BOX} />
            <Text style={styles.tagline}>{t('user.tagline')}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardBody}>
              <View style={styles.headingWrap}>
                <Text style={styles.heading}>{t('splash.chooseMode')}</Text>
              </View>

              <ModeOption
                icon="accessibility"
                title={t('splash.lite.title')}
                tagline={t('splash.lite.tagline')}
                desc={t('splash.lite.desc')}
                cta={t('splash.lite.cta')}
                recommended
                onPress={() => onConfirm?.(true)}
              />
              <ModeOption
                icon="grid"
                title={t('splash.full.title')}
                tagline={t('splash.full.tagline')}
                desc={t('splash.full.desc')}
                cta={t('splash.full.cta')}
                onPress={() => onConfirm?.(false)}
              />
            </View>

            <Text style={styles.footnote}>{t('splash.modeFootnote')}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

interface OptionProps {
  icon: HomeIconName;
  title: string;
  tagline: string;
  desc: string;
  cta: string;
  /** true = Lite 那张主推卡(主色描边 + 淡蓝底 + 实心按钮) */
  recommended?: boolean;
  onPress: () => void;
}

function ModeOption({ icon, title, tagline, desc, cta, recommended, onPress }: OptionProps) {
  return (
    <View style={[styles.option, recommended ? styles.optionOn : styles.optionOff]}>
      <View style={styles.optionHead}>
        <View style={[styles.iconBox, recommended ? styles.iconBoxOn : styles.iconBoxOff]}>
          <HomeIcon name={icon} size={20} color={recommended ? '#FFFFFF' : colors.primary} />
        </View>
        <View style={styles.optionTitles}>
          <Text style={styles.optionTitle}>{title}</Text>
          <Text style={styles.optionTagline}>{tagline}</Text>
        </View>
      </View>

      <View style={styles.optionDescWrap}>
        <Text style={styles.optionDesc}>{desc}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.cta,
          recommended ? styles.ctaSolid : styles.ctaOutline,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        onPress={onPress}
      >
        <Text style={[styles.ctaText, recommended ? styles.ctaTextSolid : styles.ctaTextOutline]}>
          {cta}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  safe: { flex: 1 },

  /* 设计稿 py60:logo 组在上、卡片在下 */
  main: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_PADDING,
    paddingVertical: 60,
    gap: 24,
  },

  logoGroup: { alignItems: 'center', gap: 4 },
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

  /* 本屏卡片圆角是 24(语言选择页那张是 32),故不用 radius.card */
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 24,
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

  option: { gap: 12, padding: 16, borderRadius: radius.btn, borderWidth: 2 },
  optionOn: { backgroundColor: LITE_CARD_BG, borderColor: colors.primary, ...shadows.subtle },
  optionOff: { backgroundColor: colors.surface, borderColor: colors.softBlue },

  optionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.btn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxOn: { backgroundColor: colors.primary, ...shadows.media },
  iconBoxOff: { backgroundColor: colors.softBlue },

  optionTitles: { flex: 1, minWidth: 0, gap: 2 },
  optionTitle: {
    fontFamily: fonts.interBold,
    fontSize: 18,
    lineHeight: 28,
    color: colors.heading,
  },
  optionTagline: {
    fontFamily: fonts.interBold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.primary,
  },

  optionDescWrap: { paddingLeft: 2 },
  optionDesc: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 19.5,
    color: colors.textSoft,
  },

  cta: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.btn },
  ctaSolid: { backgroundColor: colors.primary, paddingVertical: 12 },
  ctaOutline: { height: 50, borderWidth: 2, borderColor: colors.primary },
  ctaText: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  ctaTextSolid: { color: '#FFFFFF' },
  ctaTextOutline: { color: colors.primary },

  footnote: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSoft,
    textAlign: 'center',
  },

  pressed: { opacity: 0.85 },
});
