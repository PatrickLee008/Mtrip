/**
 * 酒店特惠卡(设计稿 08):300x290 r32 #FFF
 * 封面 298x176 + 收藏心 + 名称/评分 + 地址 + 起价//晚 + PREFERRED 徽章
 * 数据来自 goods-service 列表行(GoodsItem,snake_case 直出)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import CoverImage from '@/components/home/CoverImage';
import PriceText from '@/components/business/PriceText';
import { colors, radius } from '@/config/theme';
import { fonts, text } from '@/config/typography';
import type { GoodsItem } from '@/types/models';

export const STAY_CARD_WIDTH = 300;
const COVER_WIDTH = STAY_CARD_WIDTH - 2;

interface Props {
  goods: GoodsItem;
  onPress: (goods: GoodsItem) => void;
}

export default function StayCard({ goods, onPress }: Props) {
  const { t } = useTranslation();
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(goods)}
    >
      <View style={styles.coverWrap}>
        <CoverImage
          uri={goods.cover_image}
          width={COVER_WIDTH}
          height={176}
          label={goods.goods_name}
        />
        <View style={styles.heart}>
          <HomeIcon name="heart" size={14} color="#FFFFFF" />
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={[text.cardTitle, styles.name]} numberOfLines={1}>
            {goods.goods_name}
          </Text>
          {goods.star_level > 0 ? (
            <View style={styles.rating}>
              <HomeIcon name="diamond" size={12} color={colors.primary} />
              <Text style={styles.ratingText}>{goods.star_level.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        {goods.address ? (
          <View style={styles.row}>
            <HomeIcon name="location" size={14} color={colors.body} />
            <Text style={[text.meta, styles.address]} numberOfLines={1}>
              {goods.address}
            </Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <View style={styles.priceRow}>
            <PriceText amount={goods.minPrice} />
            <Text style={styles.perNight}>{t('home.stays.perNight')}</Text>
          </View>
          {goods.is_recommend === 1 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('home.stays.preferred')}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: STAY_CARD_WIDTH,
    borderRadius: radius.card,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  pressed: { opacity: 0.92 },
  coverWrap: { width: COVER_WIDTH, height: 176, margin: 1 },
  heart: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  body: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, marginRight: 8 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontFamily: fonts.interSemi, fontSize: 12, color: colors.cardTitle },
  address: { flex: 1, marginLeft: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  perNight: { marginLeft: 2, fontFamily: fonts.inter, fontSize: 12, color: colors.muted },
  badge: {
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { fontFamily: fonts.interBold, fontSize: 10, lineHeight: 15, color: '#FFFFFF' },
});
