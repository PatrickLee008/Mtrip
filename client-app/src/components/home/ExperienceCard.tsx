/**
 * 本地体验卡(设计稿 11):370x256 r32,整图 + 渐变遮罩 + 底部文案
 * highDemand 时左上角显示 88x23 r999 #EC1317 角标
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import CoverImage from '@/components/home/CoverImage';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  width: number;
  name: string;
  desc: string;
  uri?: string | null;
  highDemand?: boolean;
  onPress: () => void;
}

export default function ExperienceCard({ width, name, desc, uri, highDemand, onPress }: Props) {
  const { t } = useTranslation();
  return (
    <Pressable style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]} onPress={onPress}>
      <CoverImage uri={uri} width={width} height={256} radius={radius.card} />
      <View style={styles.mask} />
      {highDemand ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('home.experiences.highDemand')}</Text>
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.desc} numberOfLines={2}>
          {desc}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { height: 256, borderRadius: radius.card, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  pressed: { opacity: 0.92 },
  mask: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6, 28, 52, 0.32)' },
  badge: {
    position: 'absolute',
    top: 20,
    left: 20,
    borderRadius: 999,
    backgroundColor: colors.hot,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontFamily: fonts.interBold, fontSize: 10, lineHeight: 15, color: '#FFFFFF' },
  body: { position: 'absolute', left: 20, right: 20, bottom: 20, gap: 4 },
  name: { fontFamily: fonts.outfitSemi, fontSize: 20, lineHeight: 24, color: '#FFFFFF' },
  desc: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 20, color: 'rgba(255, 255, 255, 0.88)' },
});
