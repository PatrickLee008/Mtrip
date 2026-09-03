/**
 * 登录/注册流程的公共外壳(Figma Onboarding section 752:9380 的四张稿同一套版式)
 *
 * 主色底 + 插画铺底 → 顶部栏(返回 / 右侧文字链)→ logo + 标语 → 内容(由调用方给白卡)。
 * 设计稿实测取值原本写在 `LoginScreen`,四个页面逐字相同,故抽出来一处维护:
 *   插画   绝对定位,w150.41% h46.55% left-18.49% top16.66%(设计稿的图片填充裁切)
 *   Main   flex-1 两端对齐,pt68(让开顶部栏)pb20 px16,gap 24
 *   logo   框 100x74,内部图片放大后裁切
 *
 * 卡片本身不在这里 —— 登录/注册卡是 gap 8 无描边,验证码/推荐码卡是 gap 24 带 `--secondary` 描边。
 */

import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { PAGE_PADDING, colors } from '@/config/theme';
import { fonts } from '@/config/typography';

const ILLUSTRATION = require('../../../assets/images/login/illustration.png');
const LOGO = require('../../../assets/images/login/logo-badge.png');

/** 顶部栏高度 = py16*2 + 返回按钮 36,与设计稿 Main 的 pt68 对齐 */
const TOP_BAR_HEIGHT = 68;

interface AuthShellProps {
  /** 顶部栏右侧文字链(登录页是 Sign Up,其余是 Sign In) */
  actionLabel: string;
  onAction: () => void;
  onBack: () => void;
  children: React.ReactNode;
}

export default function AuthShell({ actionLabel, onAction, onBack, children }: AuthShellProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      {/**
       * 插画铺底:设计稿是整屏图片填充后裁切,这里按同样的比例绝对定位。
       * **必须外面套一层 overflow:'hidden' 的裁切层** —— 图宽是屏宽的 150.41%、左边还退了 18.49%,
       * 右侧会超出屏幕约 32%,不裁的话整页可以横向拖动(同开屏页波浪的 `styles.waves` 做法)。
       */}
      <View style={styles.illustrationClip} pointerEvents="none">
        <Image source={ILLUSTRATION} style={styles.illustration} resizeMode="cover" />
      </View>

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* 顶部栏:自上而下由主色 50% 渐隐到透明 */}
        <View style={styles.topBar}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="topBarGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0.5} />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#topBarGrad)" />
          </Svg>

          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={onBack}
            hitSlop={8}
          >
            <HomeIcon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={({ pressed }) => pressed && styles.pressed}
            onPress={onAction}
            hitSlop={8}
          >
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.main}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Image source={LOGO} style={styles.logo} resizeMode="cover" />
            </View>
            <Text style={styles.tagline}>{t('user.tagline')}</Text>
          </View>

          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  safe: { flex: 1 },
  flex: { flex: 1 },
  /* 插画裁切层:铺满整屏并把超出的部分剪掉(见上面 JSX 的说明) */
  illustrationClip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  /* 设计稿:w150.41% h46.55%,left-18.49% top16.66% */
  illustration: {
    position: 'absolute',
    width: '150.41%',
    height: '46.55%',
    left: '-18.49%',
    top: '16.66%',
  },

  topBar: {
    height: TOP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backBtn: {
    padding: 8,
    borderRadius: 20,
    /* 设计稿还叠了 4px 背景模糊,RN 无原生 backdrop-blur(未引入 expo-blur),这里只保留底色 */
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    opacity: 0.8,
  },
  action: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },

  main: {
    flexGrow: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 20,
    gap: 24,
  },
  header: { alignItems: 'center' },
  /* 设计稿 logo 框 100x74,内部图片放大后裁切 */
  logoBox: { width: 100, height: 74, overflow: 'hidden' },
  logo: { position: 'absolute', width: 180.6, height: 181.63, left: -40.3, top: -53.82 },
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

  pressed: { opacity: 0.85 },
});
