/**
 * 餐饮优惠卡(设计稿 09):320x128 r32 #FEFEFE,pad 24,gap 16
 * 左侧 80x80 r24 封面,右侧 名称/描述/Book Now(90x29 r8 #D9E1FB)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import CoverImage from '@/components/home/CoverImage';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

export const DINING_CARD_WIDTH = 320;

interface Props {
  name: string;
  desc: string;
  uri?: string | null;
  onPress: () => void;
}

export default function DiningCard({ name, desc, uri, onPress }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <CoverImage uri={uri} width={80} height={80} radius={24} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.desc} numberOfLines={1}>
          {desc}
        </Text>
        <Pressable style={({ pressed }) => [styles.btn, pressed && styles.pressed]} onPress={onPress}>
          <Text style={styles.btnText}>{t('home.bookNow')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: DINING_CARD_WIDTH,
    height: 128,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
  },
  body: { flex: 1, marginLeft: 16, gap: 2 },
  name: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 20, color: colors.heading },
  desc: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 16, color: colors.body },
  btn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: colors.softBlue,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pressed: { opacity: 0.85 },
  btnText: { fontFamily: fonts.interBold, fontSize: 11, lineHeight: 17, color: colors.primary },
});
