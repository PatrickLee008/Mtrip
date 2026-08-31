/**
 * 活动横幅(设计稿 1389:2769 High-Fidelity Promotion Campaign Banner)
 *
 * 设计稿实测:框 370×274、圆角 32、overflow hidden;底图在框内被放大裁切
 * (402 宽的容器里图片 126.48%×129.91%、偏移 -13.24%/-26.82%,容器本身又比框宽 32),
 * 折算到 370 的框上就是下面 image 的四个百分比 —— 用百分比是为了在任意屏宽下裁切一致。
 * 底部压一层主色 0→50% 的自下而上渐变,里面是品类胶囊(黑 25% + 6px 背景模糊)与大标题。
 */

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { TEMP_CAMPAIGN_BANNER } from '@/assets/tempImages';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

export default function CampaignBanner() {
  const { t } = useTranslation();
  return (
    <View style={styles.frame}>
      <Image source={TEMP_CAMPAIGN_BANNER} style={styles.image} resizeMode="cover" />

      <View style={styles.overlay}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="bannerGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={0} />
              <Stop offset="0.505" stopColor={colors.primary} stopOpacity={0.5} />
              <Stop offset="1" stopColor={colors.primary} stopOpacity={0.5} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#bannerGrad)" />
        </Svg>

        <View style={styles.chip}>
          <Text style={styles.chipText}>{t('promotions.campaign.category')}</Text>
        </View>
        <Text style={styles.title}>{t('promotions.campaign.name')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 370 / 274,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    justifyContent: 'flex-end',
  },
  /* 设计稿的图片填充裁切:相对 370×274 的框换算出来的比例 */
  image: {
    position: 'absolute',
    width: '137.4%',
    height: '129.9%',
    left: '-18.7%',
    top: '-26.8%',
  },

  overlay: { paddingHorizontal: 20, paddingVertical: 12, gap: 8, alignItems: 'flex-start' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.round,
    /* 设计稿还叠了 6px 背景模糊,RN 无原生 backdrop-blur(未引入 expo-blur),这里只保留底色 */
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  chipText: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  title: {
    fontFamily: fonts.interBold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.32,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.07)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 1.5,
  },
});
