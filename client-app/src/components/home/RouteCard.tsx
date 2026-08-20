/**
 * 热门路线卡(设计稿 10):370x98 r32 #FEFEFE,pad 24
 * 左 48x48 r12 #D9E1FB 图标底 + 路线名/说明,右 原价(划线)+ 现价
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import HomeIcon from '@/components/home/HomeIcon';
import PriceText from '@/components/business/PriceText';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

interface Props {
  name: string;
  desc: string;
  price: number;
  originalPrice?: number;
}

export default function RouteCard({ name, desc, price, originalPrice }: Props) {
  const currency = useSiteStore((s) => s.currency);
  return (
    <View style={styles.card}>
      <View style={styles.tile}>
        <HomeIcon name="location" size={20} color={colors.primary} />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.desc} numberOfLines={1}>
          {desc}
        </Text>
      </View>
      <View style={styles.priceCol}>
        {originalPrice ? (
          <Text style={styles.original}>{formatMoney(originalPrice, currency)}</Text>
        ) : null}
        <PriceText amount={price} size="sm" style={styles.price} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 98,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: radius.btn,
    backgroundColor: colors.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, marginLeft: 16 },
  name: { fontFamily: fonts.outfit, fontSize: 16, lineHeight: 24, color: colors.heading },
  desc: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 16, color: colors.muted },
  priceCol: { alignItems: 'flex-end', marginLeft: 8 },
  original: {
    fontFamily: fonts.interSemi,
    fontSize: 10,
    lineHeight: 16,
    color: colors.body,
    textDecorationLine: 'line-through',
  },
  price: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 24, color: colors.primary },
});
