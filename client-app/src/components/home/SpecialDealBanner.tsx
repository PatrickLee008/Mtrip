/**
 * 限时特惠横幅(设计稿 07 `Section - Promotional Banner` node 196:825)
 *
 * 设计稿实测:370x162 —— 1px --secondary 描边 + p-px,内容区 368x160,圆角 32,
 * Effect/DS 弱投影(0/1 blur2 黑 5%)。
 *   底图 368x160 居中裁切
 *   遮罩 = **从左到右**的线性渐变:rgba(0,0,0,0.6) → rgba(0,0,0,0)(不是整块纯色叠加)
 *   内容 padding 24,**上下两端对齐**(justify-between):
 *     上:SPECIAL OFFER —— 纯文字,Inter 600/12 行高16 字距1.2 大写 --tab,下留白 4
 *        标题 —— Outfit 600/24 行高32 --tab,下留白 8
 *     下:Book Now —— **主色底 #4169ED**,圆角 16,pad 16/4,文字 Inter 600/16 行高24 --tab
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import CoverImage from '@/components/home/CoverImage';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 设计稿内容区高度(外层再加 1px 描边 = 162) */
const BANNER_HEIGHT = 160;

interface Props {
  width: number;
  uri?: string | null;
  /** 无 uri 时的本地兜底图(设计稿临时素材) */
  coverSource?: ImageSourcePropType;
  onPress: () => void;
}

export default function SpecialDealBanner({ width, uri, coverSource, onPress }: Props) {
  const { t } = useTranslation();
  const innerWidth = width - 2;
  return (
    <Pressable style={({ pressed }) => [styles.wrap, pressed && styles.pressed]} onPress={onPress}>
      <CoverImage
        uri={uri}
        fallback={coverSource}
        width={innerWidth}
        height={BANNER_HEIGHT}
        radius={radius.card}
      />

      {/* 左→右的黑色渐隐遮罩,保证左侧文字可读 */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="dealGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#000000" stopOpacity={0.6} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#dealGrad)" />
      </Svg>

      <View style={styles.overlay}>
        <View>
          <Text style={styles.badge}>{t('home.specialDeals.badge')}</Text>
          <Text style={styles.headline}>{t('home.specialDeals.headline')}</Text>
        </View>
        <View style={styles.btn}>
          <Text style={styles.btnText}>{t('home.bookNow')}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* 设计稿:1px --secondary 描边 + Effect/DS 弱投影 */
  wrap: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  pressed: { opacity: 0.9 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 24,
  },
  badge: {
    marginBottom: 4,
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.surface,
  },
  headline: {
    marginBottom: 8,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.surface,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  btnText: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.surface,
    textAlign: 'center',
  },
});
