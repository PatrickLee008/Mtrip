/**
 * 限时特惠横幅(设计稿 07):370x170 r32 封面 + 角标 + 标题 + 按钮(内容叠在封面上)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import CoverImage from '@/components/home/CoverImage';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  width: number;
  uri?: string | null;
  onPress: () => void;
}

export default function SpecialDealBanner({ width, uri, onPress }: Props) {
  const { t } = useTranslation();
  return (
    <Pressable style={({ pressed }) => [styles.wrap, pressed && styles.pressed]} onPress={onPress}>
      <CoverImage uri={uri} width={width} height={170} radius={radius.card} />
      <View style={styles.overlay}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('home.specialDeals.badge')}</Text>
        </View>
        <Text style={styles.headline}>{t('home.specialDeals.headline')}</Text>
        <View style={styles.btn}>
          <Text style={styles.btnText}>{t('home.bookNow')}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.card, overflow: 'hidden' },
  pressed: { opacity: 0.9 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    padding: 24,
    gap: 8,
    backgroundColor: 'rgba(0, 54, 173, 0.35)',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: colors.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  badgeText: { fontFamily: fonts.interBold, fontSize: 10, lineHeight: 15, color: colors.badgeText },
  headline: { fontFamily: fonts.outfitSemi, fontSize: 24, lineHeight: 32, color: '#FFFFFF' },
  btn: {
    alignSelf: 'flex-start',
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: radius.btn,
    backgroundColor: '#FFFFFF',
  },
  btnText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.deepBlue },
});
