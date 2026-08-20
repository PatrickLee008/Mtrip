/**
 * 目的地卡(设计稿 06):280x252,标题 Outfit 400/20 + 说明 Inter 400/16 + 280x192 r32 封面
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import CoverImage from '@/components/home/CoverImage';
import { colors, radius } from '@/config/theme';
import { fonts, text } from '@/config/typography';

export const DESTINATION_CARD_WIDTH = 280;

interface Props {
  name: string;
  desc: string;
  /** 设计稿压在封面上的分类标签,如 HISTORIC WONDERS */
  category?: string;
  uri?: string | null;
  onPress: () => void;
}

export default function DestinationCard({ name, desc, category, uri, onPress }: Props) {
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <Text style={text.h4} numberOfLines={1}>
        {name}
      </Text>
      <Text style={text.bodyMuted} numberOfLines={1}>
        {desc}
      </Text>
      <View style={styles.cover}>
        <CoverImage
          uri={uri}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: DESTINATION_CARD_WIDTH },
  pressed: { opacity: 0.9 },
  cover: { marginTop: 12 },
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
