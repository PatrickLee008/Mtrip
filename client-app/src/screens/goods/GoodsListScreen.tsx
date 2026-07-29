/**
 * 商品列表:排序 Tab(综合/销量/最新)+ 分页列表
 */

import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { fetchGoodsList } from '@/api/goods';
import GoodsCard from '@/components/business/GoodsCard';
import ListLayout from '@/components/layout/ListLayout';
import PageLayout from '@/components/layout/PageLayout';
import { colors, fontSize, spacing } from '@/config/theme';
import type { RootStackParamList } from '@/navigation/types';
import type { GoodsItem } from '@/types/models';

type SortBy = 'default' | 'sales' | 'new';

export default function GoodsListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'GoodsList'>>();
  const { goodsType, categoryId, keyword } = route.params ?? {};
  const [sortBy, setSortBy] = useState<SortBy>('default');

  const fetcher = useCallback(
    (page: number, pageSize: number) =>
      fetchGoodsList({ page, pageSize, goodsType, categoryId, keyword, sortBy }),
    [goodsType, categoryId, keyword, sortBy],
  );

  const sorts: Array<{ key: SortBy; label: string }> = [
    { key: 'default', label: t('goods.sortDefault') },
    { key: 'sales', label: t('goods.sortSales') },
    { key: 'new', label: t('goods.sortNew') },
  ];

  return (
    <PageLayout>
      <View style={styles.sortBar}>
        {sorts.map((s) => (
          <Pressable key={s.key} style={styles.sortItem} onPress={() => setSortBy(s.key)}>
            <Text style={[styles.sortText, sortBy === s.key && styles.sortActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
      <ListLayout<GoodsItem>
        fetcher={fetcher}
        reloadKey={`${goodsType ?? ''}-${categoryId ?? ''}-${keyword ?? ''}-${sortBy}`}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <GoodsCard goods={item} onPress={(g) => navigation.navigate('GoodsDetail', { id: g.id })} />
        )}
      />
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  sortBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
  },
  sortItem: { flex: 1, alignItems: 'center' },
  sortText: { fontSize: fontSize.sm, color: colors.textSecondary },
  sortActive: { color: colors.primary, fontWeight: '700' },
});
