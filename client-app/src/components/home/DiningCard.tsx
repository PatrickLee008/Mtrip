/**
 * 餐饮优惠卡(设计稿 09 `Overlay+Border+OverlayBlur` node 196:759)
 *
 * 设计稿实测:320x128 r32 #FEFEFE,1px --secondary 描边,pad 24,gap 16
 * 左侧 80x80 r24 封面(带 Effect/DS 弱投影)
 * 右侧:名称 Inter 400/14 --text → 描述 Inter 400/12 --text-2(下留白 8)
 *       → Book Now(r8 #D9E1FB,pad 12/6,Inter 700/11 主色 + 8x8 右箭头,gap 4)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';

import CoverImage from '@/components/home/CoverImage';
import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

export const DINING_CARD_WIDTH = 320;

interface Props {
  name: string;
  desc: string;
  uri?: string | null;
  /** 无 uri 时的本地兜底图(设计稿临时素材) */
  coverSource?: ImageSourcePropType;
  onPress: () => void;
}

export default function DiningCard({ name, desc, uri, coverSource, onPress }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.thumb}>
        <CoverImage uri={uri} fallback={coverSource} width={80} height={80} radius={24} />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.desc} numberOfLines={1}>
          {desc}
        </Text>
        <Pressable style={({ pressed }) => [styles.btn, pressed && styles.pressed]} onPress={onPress}>
          <Text style={styles.btnText}>{t('home.bookNow')}</Text>
          <HomeIcon name="arrowRight" size={8} color={colors.primary} />
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
    /* 设计稿 1px --secondary 描边 */
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
  },
  /* 缩略图带 Effect/DS 弱投影,挂在外层 View 上(iOS 需不透明底) */
  thumb: { borderRadius: 24, backgroundColor: '#FFFFFF', ...shadows.subtle },
  body: { flex: 1, marginLeft: 16, gap: 2 },
  name: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 20, color: colors.heading },
  desc: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 16, color: colors.textSoft },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
