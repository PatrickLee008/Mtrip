/**
 * 关怀模式「酒店信息」页(Figma `Hotel Details Lite` / Lite Hotel Details Overview `2352:8182`)
 *
 * 主详情页标题卡右下角的「View Hotel Detail」落到这里。设计稿自上而下:
 * 图库 → 标题卡 → Why Guests Choose → Amenities(分组)→ Location & Attractions → Reviews 摘要。
 *
 * **内容与完整模式同源**:设施 / 周边 / 评价这三段完整版已有页签
 * (`HotelAmenitiesTab` / `HotelNearbyTab` / `HotelReviewsTab`),数据都来自
 * `screens/hotel/detailDemo.ts` + `hotels.detail.*` 文案 —— 关怀版直接复用同一份,
 * 只把版式换成一列大卡、字号大一档。**不另造一套 Lite 数据**,否则两种模式会对不上。
 *
 * 设计稿实测:卡片 1px --secondary、圆角 24、padding 24、gap16,弱投影;
 * 区块标题 Inter 600/24/32;分组小标 Inter 700/16 大写 tracking1.2 主色;
 * 条目文字 Inter 400/20/24 #0B1C30;链接 Inter 600/16 主色。
 *
 * 未接通能力一律 comingSoon:See Map / Get Directions(没接地图 SDK)。
 * 评分与评论仍是设计稿数值 —— 后端没有评价接口(完整模式同此状态)。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchHotelDetail } from '@/api/goods';
import { TEMP_HOTEL_COVERS, tempCoverFor } from '@/assets/tempImages';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import LiteAiSummary from '@/components/hotel/lite/LiteAiSummary';
import LiteDetailBottomBar, {
  LITE_DETAIL_BAR_HEIGHT,
} from '@/components/hotel/lite/LiteDetailBottomBar';
import { liteShared } from '@/components/hotel/lite/liteShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import {
  DETAIL_AMENITY_GROUPS,
  DETAIL_ATTRACTIONS,
  DETAIL_DEMO,
  DETAIL_REASONS,
  DETAIL_REVIEW_SCORES,
  DETAIL_REVIEW_SUMMARY,
  DETAIL_TRANSPORT,
} from '@/screens/hotel/detailDemo';
import { useCommonStore } from '@/store/commonStore';
import type { GoodsDetail } from '@/types/models';

export default function HotelInfoLiteScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = useRoute<RouteProp<RootStackParamList, 'HotelInfoLite'>>().params;
  const showToast = useCommonStore((s) => s.showToast);

  const [detail, setDetail] = useState<GoodsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const comingSoon = () => showToast(t('home.comingSoon'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await fetchHotelDetail(params.id));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingView />;
  if (error || !detail) return <ErrorView message={error} onRetry={() => void load()} />;

  /**
   * 评价摘要的分数与条数:与完整模式 `HotelDetailScreen` 同口径 —— 取 `reviewSummary`
   * (`rating` 1-5,×2 换算成 10 分制),字段缺失才回落设计稿数值。维度条后端没有数据,仍是设计稿值。
   */
  const reviewRating = detail.reviewSummary?.rating;
  const reviewCount = detail.reviewSummary?.count;
  const reviewScore =
    typeof reviewRating === 'number' && Number.isFinite(reviewRating)
      ? (reviewRating * 2).toFixed(1)
      : String(DETAIL_REVIEW_SUMMARY.score);
  const reviewTotal = typeof reviewCount === 'number' ? reviewCount : DETAIL_REVIEW_SUMMARY.total;

  const cover = detail.images?.[0] ? { uri: detail.images[0] } : TEMP_HOTEL_COVERS[0];

  return (
    <View style={liteShared.root}>
      <SafeAreaView style={liteShared.safe} edges={['top']}>
        <View style={liteShared.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
          </Pressable>
          <Text style={liteShared.topTitle} numberOfLines={1}>
            {t('hotels.lite.info.title')}
          </Text>
        </View>

        <ScrollView
          style={liteShared.flex}
          contentContainerStyle={[liteShared.main, styles.mainWithBar]}
          showsVerticalScrollIndicator={false}
        >
          {/* 图库:接口只给一组图,取首图铺满并标张数(设计稿的轮播交互未做) */}
          <View style={styles.gallery}>
            <Image source={cover} style={styles.galleryImage} resizeMode="cover" />
            {detail.images?.length ? (
              <View style={styles.photoCount}>
                <HomeIcon name="imageCopy" size={16} color="#FFFFFF" />
                <Text style={styles.photoCountText}>
                  {t('hotels.detail.photoCount', { index: 1, total: detail.images.length })}
                </Text>
              </View>
            ) : null}
          </View>

          {/* 标题卡 */}
          <View style={liteShared.card}>
            <Text style={styles.hotelName}>{detail.goods_name}</Text>
            <View style={styles.addressRow}>
              <HomeIcon name="locationOutline" size={16} color={colors.textSoft} />
              <Text style={[liteShared.body, liteShared.flexCol]}>{detail.address}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [liteShared.row, pressed && liteShared.pressed]}
              onPress={comingSoon}
              hitSlop={6}
            >
              <Text style={liteShared.link}>{t('hotels.lite.seeMap')}</Text>
              <HomeIcon name="map" size={20} color={colors.primary} />
            </Pressable>
          </View>

          {/* Why Guests Choose */}
          <View style={liteShared.card}>
            <Text style={liteShared.sectionTitle}>{t('hotels.lite.info.whyChoose')}</Text>
            {DETAIL_REASONS.map((reason) => (
              <View key={reason.key} style={styles.reason}>
                <View style={styles.reasonIcon}>
                  <HomeIcon name={reason.icon} size={24} color={colors.primary} />
                </View>
                <View style={liteShared.flexCol}>
                  <Text style={liteShared.itemTitle}>
                    {t(`hotels.detail.reasons.${reason.key}.title`)}
                  </Text>
                  <Text style={liteShared.body}>
                    {t(`hotels.detail.reasons.${reason.key}.desc`)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* 设施(与完整模式 Amenities 页签同一份数据) */}
          <View style={liteShared.card}>
            <Text style={liteShared.sectionTitle}>{t('hotels.detail.tabs.amenities')}</Text>
            {DETAIL_AMENITY_GROUPS.map((group) => (
              <View key={group.key} style={styles.group}>
                <Text style={liteShared.groupTitle}>
                  {t(`hotels.detail.amenityGroups.${group.key}`)}
                </Text>
                {group.items.map((item) => (
                  <View key={item.key} style={styles.amenityItem}>
                    <HomeIcon
                      name={item.icon}
                      width={item.width}
                      height={item.height}
                      color={colors.primary}
                    />
                    <Text style={liteShared.bodyLarge}>
                      {t(`hotels.detail.amenityList.${item.key}`)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* 周边:交通耗时 + 景点 */}
          <View style={liteShared.card}>
            <View style={liteShared.rowBetween}>
              <Text style={liteShared.sectionTitle}>{t('hotels.detail.nearby.title')}</Text>
              <Pressable onPress={comingSoon} hitSlop={6}>
                <Text style={liteShared.link}>{t('hotels.detail.nearby.getDirections')}</Text>
              </Pressable>
            </View>

            {DETAIL_TRANSPORT.map((item) => (
              <View key={item.key} style={liteShared.row}>
                <HomeIcon
                  name={item.icon}
                  width={item.width}
                  height={item.height}
                  color={colors.primary}
                />
                <View style={liteShared.flexCol}>
                  <Text style={liteShared.itemTitle}>
                    {t(`hotels.detail.nearby.transport.${item.key}.name`)}
                  </Text>
                  <Text style={liteShared.body}>
                    {t(`hotels.detail.nearby.transport.${item.key}.time`)}
                  </Text>
                </View>
              </View>
            ))}

            <View style={liteShared.divider} />

            {DETAIL_ATTRACTIONS.map((key, index) => (
              <View key={key} style={liteShared.row}>
                <Image source={tempCoverFor(index)} style={styles.attraction} resizeMode="cover" />
                <View style={liteShared.flexCol}>
                  <Text style={liteShared.itemTitle}>
                    {t(`hotels.detail.nearby.attractions.${key}.name`)}
                  </Text>
                  <Text style={liteShared.body}>
                    {t(`hotels.detail.nearby.attractions.${key}.meta`)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* 评价摘要:整块点进 Reviews 页 */}
          <View style={liteShared.card}>
            <Text style={liteShared.sectionTitle}>{t('hotels.detail.tabs.reviews')}</Text>

            <View style={liteShared.row}>
              <Text style={styles.score}>{reviewScore}</Text>
              <Text style={liteShared.body}>
                {t('hotels.detail.reviews.basedOn', {
                  reviews: reviewTotal.toLocaleString(i18n.language),
                })}
              </Text>
            </View>

            {DETAIL_REVIEW_SCORES.map((row) => (
              <View key={row.key} style={styles.scoreRow}>
                <Text style={[liteShared.body, styles.scoreLabel]}>
                  {t(`hotels.detail.reviews.dimensions.${row.key}`)}
                </Text>
                <View style={styles.bar}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${(row.score / DETAIL_REVIEW_SUMMARY.scoreMax) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.scoreValue}>{row.score}</Text>
              </View>
            ))}

            <Pressable
              style={({ pressed }) => [styles.reviewCta, pressed && liteShared.pressed]}
              onPress={() => navigation.navigate('HotelReviewsLite', { id: detail.id })}
            >
              <Text style={styles.reviewCtaText}>{t('hotels.detail.reviews.readAll')}</Text>
            </Pressable>

            <LiteAiSummary />
          </View>

          {/* 实景预览入口 */}
          <Pressable
            style={({ pressed }) => [liteShared.card, liteShared.rowBetween, pressed && liteShared.pressed]}
            onPress={() => navigation.navigate('PropertyPreviewLite', { id: detail.id })}
          >
            <Text style={liteShared.sectionTitle}>{t('hotels.lite.preview.title')}</Text>
            <HomeIcon name="chevronRight" size={20} color={colors.primary} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <LiteDetailBottomBar
        priceFrom={detail.minPrice}
        discountPercent={DETAIL_DEMO.discountPercent}
        onPress={() => navigation.navigate('HotelDetailLite', { id: detail.id })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /* 底栏是绝对定位的,给滚动区留出它的高度 */
  mainWithBar: { paddingBottom: LITE_DETAIL_BAR_HEIGHT + 24 },

  gallery: { width: '100%', height: 220, borderRadius: 24, overflow: 'hidden' },
  galleryImage: { width: '100%', height: '100%' },
  photoCount: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  photoCountText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 20, color: '#FFFFFF' },

  hotelName: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.heading },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },

  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  reasonIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.softBlue,
  },

  group: { gap: 16 },
  amenityItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  attraction: { width: 72, height: 72, borderRadius: 16 },

  score: { fontFamily: fonts.interBold, fontSize: 40, lineHeight: 48, color: colors.primary },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreLabel: { width: 110 },
  bar: { flex: 1, height: 8, borderRadius: 999, backgroundColor: colors.softBlue },
  barFill: { height: 8, borderRadius: 999, backgroundColor: colors.primary },
  scoreValue: {
    width: 40,
    textAlign: 'right',
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },
  reviewCta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  reviewCtaText: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 24, color: colors.primary },
});
