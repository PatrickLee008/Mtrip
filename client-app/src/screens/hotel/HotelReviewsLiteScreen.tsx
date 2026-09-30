/**
 * 关怀模式「住客评价」页(Figma `Hotel Details Lite` / Hotel Details Reviews Page `2352:6648`)
 *
 * 信息页评价卡的「Read All Reviews」落到这里:评分总览 → 维度条 → 评论卡列表。
 *
 * 设计稿实测(评论卡 `2352:6730`):
 *   卡片   --tab 底,1px --secondary,圆角 24,padding 25,gap12,投影 0/20 blur20 rgba(15,41,77,.08)
 *   头部   48 圆头像 + (昵称 Inter 400/16 #141D23 / 日期·同行类型 Inter 500/12 #5C5F60)
 *          右侧评分药丸:底 rgba(66,104,244,.1)、1px rgba(32,77,218,.2)、圆角 32,
 *          分数 Inter 400/18/28 主色 + 「/10」Inter 500/12
 *   正文   标题 Inter 600/18/20 --text;内容 Inter 400/16/24 --text-2
 *   图墙   横滑,单图 192×128 圆角 32,间距 12
 *   商家回复 底 #ECF5FE、左边框 4px rgba(32,77,218,.3)、圆角 32、pl20 pr16 py16
 *   底行   上边框 rgba(196,197,215,.3),pt17:左「Helpful (12)」右「Report」,均 Inter 500/12 #5C5F60
 *
 * **数据**(与完整模式 `HotelReviewsScreen` 同源同口径):
 *   - 评论列表走 `/app/hotels/reviews` 分页(下拉刷新 / 触底翻页 / 失败重试),卡片的昵称、日期、
 *     10 分制分数取 `components/hotel/reviewFormat.ts`,与完整模式评价卡一致;
 *   - 总分取 `/hotels/detail` 的 `reviewSummary.rating × 2`,条数取列表 `total`,低于 8 分不贴 Excellent;
 *   - 维度条与 AI Summary 后端没有数据,仍是 `detailDemo` 的设计稿数值(完整模式同此状态)。
 *   接口没有评论标题与「有用」计数,所以卡片不画标题行、Helpful 不带数字;Helpful / Report 仍 comingSoon。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchHotelDetail, fetchHotelReviews, type HotelReview } from '@/api/goods';
import { EmptyView, ErrorView, LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import LiteAiSummary from '@/components/hotel/lite/LiteAiSummary';
import LiteDetailBottomBar, {
  LITE_DETAIL_BAR_HEIGHT,
} from '@/components/hotel/lite/LiteDetailBottomBar';
import { liteShared } from '@/components/hotel/lite/liteShared';
import {
  EXCELLENT_FROM_SCORE,
  formatReviewDate,
  reviewNickname,
  toTenPointScore,
} from '@/components/hotel/reviewFormat';
import { PAGE_PADDING, colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import {
  DETAIL_DEMO,
  DETAIL_REVIEW_SCORES,
  DETAIL_REVIEW_SUMMARY,
} from '@/screens/hotel/detailDemo';
import { useCommonStore } from '@/store/commonStore';
import { resolveMediaUri } from '@/utils/media';

const PAGE_SIZE = 10;

export default function HotelReviewsLiteScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const showToast = useCommonStore((s) => s.showToast);
  const params = useRoute<RouteProp<RootStackParamList, 'HotelReviewsLite'>>().params;
  const propertyId = params.id;

  const comingSoon = () => showToast(t('home.comingSoon'));

  /* ---- 评价列表(分页逻辑与完整模式 HotelReviewsScreen 同一套) ---- */
  const [items, setItems] = useState<HotelReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  const busyRef = useRef(false);
  const loadVersion = useRef(0);
  /** 失败的那次请求;列表非空时靠底部重试行重放它(刷新重刷第 1 页、翻页重取同一页) */
  const failedRef = useRef<{ page: number; mode: 'refresh' | 'more' } | null>(null);

  const loadReviews = useCallback(
    async (page: number, mode: 'init' | 'refresh' | 'more') => {
      if (busyRef.current) return;
      const version = loadVersion.current;
      busyRef.current = true;
      if (mode === 'init') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      try {
        const data = await fetchHotelReviews({ propertyId, page, pageSize: PAGE_SIZE });
        if (version !== loadVersion.current) return;
        pageRef.current = page;
        setItems((prev) => (page === 1 ? data.list : [...prev, ...data.list]));
        setTotal(data.total);
        setHasMore(page * data.pageSize < data.total);
        failedRef.current = null;
        setError('');
      } catch (e) {
        if (version !== loadVersion.current) return;
        /* 只有首屏失败才清空列表;刷新/翻页失败保留已拿到的评价 */
        if (mode === 'init') {
          setItems([]);
          setTotal(0);
          setHasMore(false);
          failedRef.current = null;
        } else {
          failedRef.current = { page, mode };
        }
        setError(e instanceof Error ? e.message : 'Error');
      } finally {
        if (version === loadVersion.current) {
          busyRef.current = false;
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [propertyId],
  );

  useEffect(() => {
    loadVersion.current++;
    busyRef.current = false;
    failedRef.current = null;
    void loadReviews(1, 'init');
    return () => {
      loadVersion.current++;
    };
  }, [loadReviews]);

  /** 详情只取总分 / 物业名 / 底栏起价;拿不到只是不画那几项,不挡评价列表 */
  const [score, setScore] = useState(0);
  const [propertyName, setPropertyName] = useState('');
  const [priceFrom, setPriceFrom] = useState(0);
  useEffect(() => {
    let alive = true;
    void fetchHotelDetail(propertyId)
      .then((d) => {
        if (!alive) return;
        const rating = d.reviewSummary?.rating;
        /* 后端 rating 是 1-5,稿面是 /10 —— ×2 换算;脏值按 0 */
        setScore(typeof rating === 'number' && Number.isFinite(rating) ? rating * 2 : 0);
        setPropertyName(d.goods_name ?? '');
        setPriceFrom(d.minPrice ?? 0);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [propertyId]);

  const onEndReached = () => {
    if (!hasMore || loading || loadingMore || refreshing) return;
    void loadReviews(pageRef.current + 1, 'more');
  };
  const retryFailed = () => {
    const failed = failedRef.current;
    if (failed) void loadReviews(failed.page, failed.mode);
  };

  const renderEmpty = () => {
    if (loading) return <LoadingView />;
    if (error) return <ErrorView message={error} onRetry={() => void loadReviews(1, 'init')} />;
    return <EmptyView text={t('hotels.reviewsPage.empty')} />;
  };

  /* 总览 */
  const summary = (
    <View style={[liteShared.card, styles.summaryCard]}>
      <View style={liteShared.row}>
        <Text style={styles.score}>{score.toFixed(1)}</Text>
        <View style={liteShared.flexCol}>
          {score >= EXCELLENT_FROM_SCORE ? (
            <Text style={liteShared.itemTitle}>{t('hotels.results.excellent')}</Text>
          ) : null}
          <Text style={liteShared.body}>
            {t('hotels.detail.reviews.basedOn', { reviews: total.toLocaleString(i18n.language) })}
          </Text>
        </View>
      </View>

      {/* 维度条:后端没有分项评分,仍是设计稿数值(完整模式同此状态) */}
      {DETAIL_REVIEW_SCORES.map((row) => (
        <View key={row.key} style={styles.scoreRow}>
          <Text style={[liteShared.body, styles.scoreLabel]}>
            {t(`hotels.detail.reviews.dimensions.${row.key}`)}
          </Text>
          <View style={styles.bar}>
            <View
              style={[styles.barFill, { width: `${(row.score / DETAIL_REVIEW_SUMMARY.scoreMax) * 100}%` }]}
            />
          </View>
          <Text style={styles.scoreValue}>{row.score}</Text>
        </View>
      ))}

      <LiteAiSummary />
    </View>
  );

  /* 评论卡 */
  const renderReview = ({ item }: { item: HotelReview }) => {
    const avatarUri = resolveMediaUri(item.avatar);
    const photos = (Array.isArray(item.images) ? item.images : [])
      .map((uri) => resolveMediaUri(uri))
      .filter((uri): uri is string => uri !== null);
    const reply = typeof item.reply_content === 'string' ? item.reply_content.trim() : '';
    const date = formatReviewDate(item.created_at, i18n.language);
    const content = typeof item.content === 'string' ? item.content.trim() : '';

    return (
      <View style={[liteShared.card, styles.reviewCard]}>
        <View style={liteShared.rowBetween}>
          <View style={[liteShared.row, liteShared.flexCol]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <HomeIcon name="person" size={24} color="#5C5F60" />
              </View>
            )}
            <View style={liteShared.flexCol}>
              <Text style={styles.author} numberOfLines={1}>
                {reviewNickname(item, t)}
              </Text>
              {date ? <Text style={styles.meta}>{date}</Text> : null}
            </View>
          </View>

          <View style={styles.scorePill}>
            <Text style={styles.scorePillValue}>{toTenPointScore(item.rating)}</Text>
            <Text style={styles.scorePillMax}>{t('hotels.lite.reviews.outOfTen')}</Text>
          </View>
        </View>

        {content ? <Text style={liteShared.body}>{content}</Text> : null}

        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.photos}>
              {photos.map((uri, i) => (
                <Image key={`${uri}-${i}`} source={{ uri }} style={styles.photo} resizeMode="cover" />
              ))}
            </View>
          </ScrollView>
        ) : null}

        {reply ? (
          <View style={styles.reply}>
            <View style={liteShared.row}>
              <HomeIcon name="chatFilled" size={18} color={colors.primary} />
              <Text style={styles.replyFrom} numberOfLines={1}>
                {propertyName || t('hotels.lite.reviews.replyFrom')}
              </Text>
            </View>
            <Text style={liteShared.body}>{reply}</Text>
          </View>
        ) : null}

        {/* Helpful / Report 没有接口;接口也没有「有用」计数,所以不带数字 */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [liteShared.row, pressed && liteShared.pressed]}
            onPress={comingSoon}
            hitSlop={6}
          >
            <HomeIcon name="thumbUp" size={18} color="#5C5F60" />
            <Text style={styles.meta}>{t('hotels.lite.reviews.helpful')}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => pressed && liteShared.pressed} onPress={comingSoon} hitSlop={6}>
            <Text style={styles.meta}>{t('hotels.lite.reviews.report')}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={liteShared.root}>
      <SafeAreaView style={liteShared.safe} edges={['top']}>
        <View style={liteShared.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
          </Pressable>
          <Text style={liteShared.topTitle} numberOfLines={1}>
            {t('hotels.detail.tabs.reviews')}
          </Text>
        </View>

        <FlatList
          style={liteShared.flex}
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderReview}
          ListHeaderComponent={summary}
          ListEmptyComponent={<View style={styles.emptySlot}>{renderEmpty()}</View>}
          ItemSeparatorComponent={() => <View style={styles.cardGap} />}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.listFooter}>
                <LoadingView />
              </View>
            ) : error && items.length > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.listFooter, pressed && liteShared.pressed]}
                onPress={retryFailed}
              >
                <Text style={liteShared.link}>{t('common.retry')}</Text>
              </Pressable>
            ) : null
          }
          contentContainerStyle={[styles.listContent, styles.mainWithBar]}
          refreshing={refreshing}
          onRefresh={() => void loadReviews(1, 'refresh')}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>

      <LiteDetailBottomBar
        priceFrom={priceFrom}
        discountPercent={DETAIL_DEMO.discountPercent}
        onPress={() => navigation.navigate('HotelDetailLite', { id: propertyId })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /* 与 liteShared.main 同左右内边距;列表项之间的 24 由分隔组件给 */
  listContent: { paddingHorizontal: PAGE_PADDING },
  /* 底栏是绝对定位的,给滚动区留出它的高度 */
  mainWithBar: { paddingBottom: LITE_DETAIL_BAR_HEIGHT + 24 },
  summaryCard: { marginBottom: 24 },
  cardGap: { height: 24 },
  emptySlot: { minHeight: 200 },
  listFooter: { alignItems: 'center', paddingTop: 16 },

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

  reviewCard: { padding: 25, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 999 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E1E3E4' },
  author: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#141D23' },
  meta: { fontFamily: fonts.interMedium, fontSize: 12, lineHeight: 16, color: '#5C5F60' },

  scorePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(32, 77, 218, 0.2)',
    backgroundColor: 'rgba(66, 104, 244, 0.1)',
  },
  scorePillValue: { fontFamily: fonts.inter, fontSize: 18, lineHeight: 28, color: colors.primary },
  scorePillMax: { fontFamily: fonts.interMedium, fontSize: 12, lineHeight: 16, color: colors.primary },

  photos: { flexDirection: 'row', gap: 12 },
  photo: { width: 192, height: 128, borderRadius: 32 },

  reply: {
    gap: 8,
    paddingLeft: 20,
    paddingRight: 16,
    paddingVertical: 16,
    borderRadius: 32,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(32, 77, 218, 0.3)',
    backgroundColor: '#ECF5FE',
  },
  replyFrom: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#141D23' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 17,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 197, 215, 0.3)',
  },
});
