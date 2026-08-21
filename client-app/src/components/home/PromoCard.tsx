/**
 * 新用户促销大卡(设计稿 04 `Section - Upcoming Trip Card` node 81:2516)
 *
 * 设计稿实测:370x180 r32 #0036AD,pad 24,内容竖排 gap 8 并垂直居中,
 * 右上角是 148x117、透明度 20% 的床形装饰(矢量,取自设计稿 fillGeometry),被卡片圆角裁掉。
 * 内容顺序:徽章 142x20 r9999 #1F4ED3(Inter 700/10,大写,字距 0.5,#C8D1FF)
 *   → Hotels(Outfit 600/16 白)→ 20% Off(Inter 600/24 白,容器透明度 0.9)
 *   → Book Now 按钮(白底 r12,pad 24/8,Inter 400/16 #0036AD)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 设计稿装饰图形(床),原始尺寸 148.1333x101 */
const BED_PATH =
  'M0 101L0 0L13.4667 0L13.4667 67.3333L67.3333 67.3333L67.3333 13.4667L121.2 13.4667C128.607 13.4667 134.947 16.1039 140.222 21.3783C145.496 26.6528 148.133 32.9933 148.133 40.4L148.133 101L134.667 101L134.667 80.8L13.4667 80.8L13.4667 101L0 101ZM40.4 60.6C34.7889 60.6 30.0194 58.6361 26.0917 54.7083C22.1639 50.7806 20.2 46.0111 20.2 40.4C20.2 34.7889 22.1639 30.0194 26.0917 26.0917C30.0194 22.1639 34.7889 20.2 40.4 20.2C46.0111 20.2 50.7806 22.1639 54.7083 26.0917C58.6361 30.0194 60.6 34.7889 60.6 40.4C60.6 46.0111 58.6361 50.7806 54.7083 54.7083C50.7806 58.6361 46.0111 60.6 40.4 60.6ZM80.8 67.3333L134.667 67.3333L134.667 40.4C134.667 36.6967 133.348 33.5264 130.711 30.8892C128.074 28.2519 124.903 26.9333 121.2 26.9333L80.8 26.9333L80.8 67.3333ZM40.4 47.1333C42.3078 47.1333 43.9069 46.4881 45.1975 45.1975C46.4881 43.9069 47.1333 42.3078 47.1333 40.4C47.1333 38.4922 46.4881 36.8931 45.1975 35.6025C43.9069 34.3119 42.3078 33.6667 40.4 33.6667C38.4922 33.6667 36.8931 34.3119 35.6025 35.6025C34.3119 36.8931 33.6667 38.4922 33.6667 40.4C33.6667 42.3078 34.3119 43.9069 35.6025 45.1975C36.8931 46.4881 38.4922 47.1333 40.4 47.1333Z';

export default function PromoCard({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      {/* 右上角床形水印:绝对定位贴右边,不占布局,超出部分由卡片圆角裁掉 */}
      <View style={styles.art} pointerEvents="none">
        <Svg width={148.1333} height={101} viewBox="0 0 148.1333 101">
          <Path d={BED_PATH} fill="#FFFFFF" fillRule="nonzero" />
        </Svg>
      </View>

      <View style={styles.body}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('home.promo.badge')}</Text>
        </View>
        <Text style={styles.category}>{t('home.promo.category')}</Text>
        <Text style={styles.title}>{t('home.promo.title')}</Text>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          onPress={onPress}
        >
          <Text style={styles.btnText}>{t('home.bookNow')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 180,
    justifyContent: 'center',
    borderRadius: radius.card,
    backgroundColor: colors.deepBlue,
    padding: 24,
    overflow: 'hidden',
    /* 设计稿两层黑 10%(0/10 blur15 spread-3 + 0/4 blur6 spread-4),RN 取近似的一层 */
    ...shadows.raised,
  },
  art: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 148,
    height: 117,
    opacity: 0.2,
  },
  body: { gap: 8, alignItems: 'flex-start' },
  badge: {
    borderRadius: 999,
    backgroundColor: colors.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  badgeText: {
    fontFamily: fonts.interBold,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.badgeText,
  },
  category: { fontFamily: fonts.outfitSemi, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
  title: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 24,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  btn: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: radius.btn,
    backgroundColor: '#FFFFFF',
  },
  pressed: { opacity: 0.85 },
  btnText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.deepBlue },
});
