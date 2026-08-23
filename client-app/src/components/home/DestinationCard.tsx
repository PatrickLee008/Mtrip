/**
 * 目的地卡(设计稿 06 `Bagan` node 81:2535)
 *
 * 设计稿实测:280x252,自上而下 —— 280x192 r32 封面(y=0)→ 名称(y=204,Outfit 400/20)
 * → 说明(y=228,Inter 400/16)。即**文字在图片下方**,封面与名称之间留白 12。
 * 封面左下角压分类标签,图片框带两层黑 10% 投影。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import CoverImage from '@/components/home/CoverImage';
import { colors, radius, shadows } from '@/config/theme';
import { fonts, text } from '@/config/typography';

export const DESTINATION_CARD_WIDTH = 280;

interface Props {
  name: string;
  desc: string;
  /** 设计稿压在封面上的分类标签,如 HISTORIC WONDERS */
  category?: string;
  uri?: string | null;
  /** 无 uri 时的本地兜底图(设计稿临时素材) */
  coverSource?: ImageSourcePropType;
  onPress: () => void;
}

export default function DestinationCard({
  name,
  desc,
  category,
  uri,
  coverSource,
  onPress,
}: Props) {
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.cover}>
        <CoverImage
          uri={uri}
          fallback={coverSource}
          width={DESTINATION_CARD_WIDTH}
          height={192}
          radius={radius.card}
          label={name}
        />
        {category ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{category}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[text.h4, styles.name]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={text.bodyMuted} numberOfLines={1}>
        {desc}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: DESTINATION_CARD_WIDTH },
  pressed: { opacity: 0.9 },
  /* 设计稿图片框带两层黑 10% 投影(0/4 blur6 spread-1 + 0/2 blur4 spread-2),RN 取近似的一层 */
  cover: { borderRadius: radius.card, ...shadows.media },
  /* 设计稿封面(192)与名称(204)之间留白 12 */
  name: { marginTop: 12 },
  badge: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 54, 173, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: fonts.interBold,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.5,
    color: colors.badgeText,
  },
});
