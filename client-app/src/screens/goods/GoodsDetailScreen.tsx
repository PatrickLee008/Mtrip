/**
 * 商品详情:图片/信息/SKU选择/退改规则,预订走登录守卫
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { fetchGoodsDetail } from '@/api/goods';
import PriceText from '@/components/business/PriceText';
import CustomButton from '@/components/common/CustomButton';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import PageLayout from '@/components/layout/PageLayout';
import { colors, fontSize, radius, spacing } from '@/config/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useUserStore } from '@/store/userStore';
import type { GoodsDetail, GoodsSku } from '@/types/models';

/** SKU 展示名:房型/票种字段并集 */
function skuName(sku: GoodsSku): string {
  return sku.room_name ?? sku.ticket_name ?? `#${sku.id}`;
}

export default function GoodsDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'GoodsDetail'>>();
  const goodsId = route.params.id;
  const isLogin = useUserStore((s) => s.isLogin);

  const [detail, setDetail] = useState<GoodsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [skuId, setSkuId] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGoodsDetail(goodsId);
      setDetail(data);
      setSkuId(data.skus[0]?.id ?? 0);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [goodsId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingView />;
  if (error || !detail) return <ErrorView message={error} onRetry={() => void load()} />;

  const selectedSku = detail.skus.find((s) => s.id === skuId);
  const canBook = Boolean(selectedSku);

  const book = () => {
    if (!selectedSku) return;
    if (!isLogin) {
      navigation.navigate('Login');
      return;
    }
    navigation.navigate('OrderConfirm', { goodsId: detail.id, skuId: selectedSku.id });
  };

  return (
    <PageLayout>
      <View style={styles.flex}>
        <PageLayout scrollable edges={[]}>
          <Image
            source={detail.cover_image ? { uri: detail.cover_image } : undefined}
            style={styles.cover}
            resizeMode="cover"
          />
          <View style={styles.card}>
            <Text style={styles.name}>{detail.goods_name}</Text>
            {detail.star_level > 0 ? (
              <Text style={styles.star}>{'★'.repeat(Math.min(detail.star_level, 5))}</Text>
            ) : null}
            {detail.goods_brief ? <Text style={styles.brief}>{detail.goods_brief}</Text> : null}
            {detail.address ? (
              <Text style={styles.address}>
                {t('goods.address')}: {detail.address}
              </Text>
            ) : null}
            <View style={styles.priceRow}>
              <PriceText amount={detail.minPrice} suffix={t('goods.priceFrom')} size="lg" />
              <Text style={styles.sales}>{t('goods.sales', { count: detail.sales_count })}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('goods.selectSku')}</Text>
            {detail.skus.map((sku) => {
              const active = sku.id === skuId;
              const soldOut = sku.status !== 1;
              return (
                <Pressable
                  key={sku.id}
                  style={[styles.skuRow, active && styles.skuActive, soldOut && styles.skuDisabled]}
                  disabled={soldOut}
                  onPress={() => setSkuId(sku.id)}
                >
                  <View style={styles.skuInfo}>
                    <Text style={[styles.skuName, active && styles.skuNameActive]}>
                      {skuName(sku)}
                    </Text>
                    {sku.bed_type || sku.area ? (
                      <Text style={styles.skuMeta}>
                        {[sku.bed_type, sku.area].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  {soldOut ? (
                    <Text style={styles.soldOut}>{t('goods.soldOut')}</Text>
                  ) : (
                    <PriceText amount={sku.base_price} size="sm" />
                  )}
                </Pressable>
              );
            })}
          </View>

          {detail.facilities.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('goods.facilities')}</Text>
              <Text style={styles.facilities}>{detail.facilities.join(' · ')}</Text>
            </View>
          ) : null}

          {detail.refundRules.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('goods.refundRules')}</Text>
              {detail.refundRules.map((rule) => (
                <View key={rule.id} style={styles.ruleBlock}>
                  {rule.rules.map((r, i) => (
                    <Text key={i} style={styles.ruleText}>
                      ≥{r.hours_before}h → {r.refund_rate}%
                    </Text>
                  ))}
                  {rule.remark ? <Text style={styles.ruleRemark}>{rule.remark}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </PageLayout>
        <View style={styles.footer}>
          <CustomButton title={t('goods.book')} disabled={!canBook} onPress={book} />
        </View>
      </View>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cover: { width: '100%', height: 220, backgroundColor: colors.border },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  name: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  star: { marginTop: spacing.xs, fontSize: fontSize.sm, color: colors.warning },
  brief: { marginTop: spacing.sm, fontSize: fontSize.sm, color: colors.textSecondary },
  address: { marginTop: spacing.sm, fontSize: fontSize.xs, color: colors.textSecondary },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  sales: { fontSize: fontSize.xs, color: colors.textSecondary },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  skuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  skuActive: { borderColor: colors.primary, backgroundColor: '#f0f6ff' },
  skuDisabled: { opacity: 0.5 },
  skuInfo: { flex: 1, marginRight: spacing.md },
  skuName: { fontSize: fontSize.md, color: colors.text, fontWeight: '500' },
  skuNameActive: { color: colors.primary },
  skuMeta: { marginTop: 2, fontSize: fontSize.xs, color: colors.textSecondary },
  soldOut: { fontSize: fontSize.sm, color: colors.textSecondary },
  facilities: { fontSize: fontSize.sm, color: colors.text, lineHeight: 22 },
  ruleBlock: { marginBottom: spacing.sm },
  ruleText: { fontSize: fontSize.sm, color: colors.text, lineHeight: 22 },
  ruleRemark: { marginTop: 2, fontSize: fontSize.xs, color: colors.textSecondary },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
