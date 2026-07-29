/**
 * 商品卡片:封面 + 名称 + 星级/销量 + 多币种起价
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import PriceText from '@/components/business/PriceText';
import { colors, fontSize, radius, spacing } from '@/config/theme';
import type { GoodsItem } from '@/types/models';

interface Props {
  goods: GoodsItem;
  onPress: (goods: GoodsItem) => void;
}

export default function GoodsCard({ goods, onPress }: Props) {
  const { t } = useTranslation();
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => onPress(goods)}>
      <Image
        source={goods.cover_image ? { uri: goods.cover_image } : undefined}
        style={styles.cover}
        resizeMode="cover"
      />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {goods.goods_name}
        </Text>
        {goods.goods_brief ? (
          <Text style={styles.brief} numberOfLines={1}>
            {goods.goods_brief}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {goods.star_level > 0 ? (
            <Text style={styles.star}>{'★'.repeat(Math.min(goods.star_level, 5))}</Text>
          ) : null}
          <Text style={styles.sales}>{t('goods.sales', { count: goods.sales_count })}</Text>
        </View>
        <View style={styles.priceRow}>
          <PriceText amount={goods.minPrice} suffix={t('goods.priceFrom')} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.9 },
  cover: { width: 110, height: 110, backgroundColor: colors.background },
  body: { flex: 1, padding: spacing.md, justifyContent: 'space-between' },
  name: { fontSize: fontSize.md, color: colors.text, fontWeight: '600' },
  brief: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  star: { fontSize: fontSize.xs, color: colors.warning, marginRight: spacing.sm },
  sales: { fontSize: fontSize.xs, color: colors.textSecondary },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },
});
