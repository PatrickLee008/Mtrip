/**
 * 酒店评价整页(Figma M-Trip / `Hotel Details Reviews Page` `1133:2998`)
 *
 * 酒店详情「Reviews」页签里那张卡片的「Read All Reviews」落到这里。
 *
 * 设计稿实测:
 *   根 frame  padding-top 124(= 状态栏 54 + 顶栏 70),底色 `--page-bg` #EBF0FF
 *   顶栏      悬浮在滚动区之上(y=54),padding 16/20,gap 16,底 #FEFEFE + Effect/DS;
 *             标题「Reviews (1,240)」Outfit 600/24/32 主色,左侧 20 返回箭头(主色)
 *   Main      padding 24px 16px 124px,gap 24
 *   总览卡    见 `HotelReviewDashboard`(本页不画「Read All Reviews」—— 本页就是落地页)
 *   评论卡    见 `HotelReviewCard`
 *   底栏      Mobile Bottom Bar(padding 16/20,顶部 1px 分隔线):起价 + -15% TODAY + CTA
 *
 * **数据口径(与用户逐项确认过)**:
 *   · 总分行 /「Based on N reviews」/ 顶栏 `Reviews (N)` —— 全部真实:总分取
 *     `/hotels/detail` 的 `reviewSummary.rating × 2`(后端 1-5 → 稿面 /10,与搜索结果页同口径),
 *     条数取 `/hotels/reviews` 的 `total`,**顶栏与卡内同源**,不会自相矛盾。
 *   · 评论卡内容 —— 真实,字段缺失的行不渲染(见 `HotelReviewCard` 头部注释)。
 *   · 维度条与 AI Summary —— 设计稿静态文案:`goods_review` 只有单一 `rating`,
 *     没有分维度评分,也没有 AI 总结的数据源,不编造。
 *
 * 无 `propertyId`(演示酒店)时:不发请求,直接空态,底栏只留 CTA 不画金额。
 * 「Choose my room」按用户拍板**回到酒店详情页并切到 Rooms 页签**(不是直接进订房向导)。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchHotelDetail, fetchHotelReviews, type HotelReview } from '@/api/goods';
import { EmptyView, ErrorView, LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import HotelReviewCard from '@/components/hotel/HotelReviewCard';
import HotelReviewDashboard from '@/components/hotel/HotelReviewDashboard';
import { PAGE_PADDING, SECTION_GAP, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { DETAIL_DEMO } from '@/screens/hotel/detailDemo';
import { useSiteStore } from '@/store/siteStore';
import type { GoodsDetail } from '@/types/models';
import { formatMoney } from '@/utils/format';

/**
 * 稿面顶栏高 70(根 frame padding-top 124 = 状态栏 54 + 顶栏 70)。
 * 状态栏高度跟设备走,所以滚动留白是 `insets.top + HEADER_HEIGHT`,不是写死的 124。
 */
const HEADER_HEIGHT = 70;
/** 底栏 pt16 + 内容 56(12/16 + 16/24 + 10/15 与之取高)+ pb16 = 88(同酒店详情页底栏) */
const BOTTOM_BAR_HEIGHT = 88;
const PAGE_SIZE = 10;

export default function HotelReviewsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'HotelReviews'>>();
  const insets = useSafeAreaInsets();
  const currency = useSiteStore((s) => s.currency);

  const propertyId = route.params?.propertyId;
  const checkIn = route.params?.checkIn;
  const checkOut = route.params?.checkOut;

  /* ---- 评价列表 ---- */
  const [items, setItems] = useState<HotelReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(propertyId));
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  const busyRef = useRef(false);
  const loadVersion = useRef(0);
  /**
   * 失败的那次请求(page + mode)。列表非空时 `ListEmptyComponent` 不会出现,
   * 错误就没有任何可见出口 —— 底部据此画一条重试,并且**重放原来那次请求**
   * (刷新失败要重刷第 1 页、翻页失败要重取下一页,不是一律 +1)。
   */
  const failedRef = useRef<{ page: number; mode: 'refresh' | 'more' } | null>(null);

  /** 详情只用来取总分 / 物业名 / 起价;拿不到就只是不画那几行,不挡评价列表 */
  const [detail, setDetail] = useState<GoodsDetail | null>(null);

  const loadReviews = useCallback(
    async (page: number, mode: 'init' | 'refresh' | 'more') => {
      if (!propertyId || busyRef.current) return;
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
        /**
         * **只有首屏失败才清空列表**。下拉刷新走的也是 page=1,如果按 `page === 1` 判,
         * 刷新失败会把已经拿到的评价全抹掉 —— 那是比刷新失败本身更糟的结果。
         */
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
    setItems([]);
    setTotal(0);
    setError('');
    setHasMore(false);
    /* 演示酒店没有物业 id,评价接口无从查起 —— 直接空态,不发请求 */
    if (!propertyId) {
      setLoading(false);
      return () => {
        loadVersion.current++;
      };
    }
    void loadReviews(1, 'init');
    return () => {
      loadVersion.current++;
    };
  }, [loadReviews, propertyId]);

  useEffect(() => {
    if (!propertyId) {
      setDetail(null);
      return;
    }
    let alive = true;
    void fetchHotelDetail(propertyId)
      .then((data) => {
        if (alive) setDetail(data);
      })
      .catch(() => {
        if (alive) setDetail(null);
      });
    return () => {
      alive = false;
    };
  }, [propertyId]);

  /** 后端 rating 是 1-5 分制,稿面是 /10 —— ×2 换算;脏值按 0,不产生 NaN */
  const rating = detail?.reviewSummary?.rating;
  const score = typeof rating === 'number' && Number.isFinite(rating) ? rating * 2 : 0;
  const priceFrom = detail?.minPrice && detail.minPrice > 0 ? detail.minPrice : 0;

  /** 顶栏条数与卡内「Based on N reviews」同源(都用列表的 total) */
  const title = t('hotels.reviewsPage.title', { reviews: total.toLocaleString(i18n.language) });

  const onRefresh = () => void loadReviews(1, 'refresh');
  const onRetry = () => void loadReviews(1, 'init');
  const onEndReached = () => {
    /* 注意这里**不**因 error 收手:翻页失败时列表还在,靠底部的重试行 / 再次滚动自愈;
       首页失败时 hasMore 已是 false,不会进这里 */
    if (!hasMore || loading || loadingMore || refreshing) return;
    void loadReviews(pageRef.current + 1, 'more');
  };
  /** 重放失败的那次请求(刷新→重刷第 1 页;翻页→重取同一页,pageRef 失败时不会前进) */
  const retryFailed = () => {
    const failed = failedRef.current;
    if (failed) void loadReviews(failed.page, failed.mode);
  };

  /** 用户拍板:回详情页并切到 Rooms 页签(把日期一并带回去,免得详情页丢了上下文) */
  const goRooms = () => navigation.navigate('HotelDetail', { propertyId, checkIn, checkOut, tab: 'rooms' });

  const renderEmpty = () => {
    if (loading) return <LoadingView />;
    if (error) return <ErrorView message={error} onRetry={onRetry} />;
    return <EmptyView text={t('hotels.reviewsPage.empty')} />;
  };

  return (
    <View style={styles.root}>
      {/**
       * ⚠️ **顺序即层级**:RN / react-native-web 的同级兄弟按**声明顺序**绘制,后声明者在上。
       * 顶栏与底栏都是 `position: 'absolute'` 的悬浮层,所以它们必须声明在 FlatList **之后** ——
       * 之前把顶栏写在 FlatList 前面,列表就盖住了顶栏:既挡住内容,又吃掉返回按钮的点击
       * (Web/H5 上实测的三个症状:返回点不动 / 顶栏层级错 / 上拉时内容挡住顶栏)。
       * 除顺序外再显式给 zIndex,免得以后有人挪动 JSX 又把层级挪没了。
       * 参照实现:同仓库的 `HotelDetailScreen`(悬浮 topBar 声明在 ScrollView 之后)。
       */}
      <FlatList
        style={styles.flex}
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <HotelReviewCard review={item} propertyName={detail?.goods_name} />
        )}
        ListHeaderComponent={
          <View style={styles.dashboardSlot}>
            {/* 本页就是评价落地页,不画「Read All Reviews」 */}
            <HotelReviewDashboard score={score} total={total} />
          </View>
        }
        ListEmptyComponent={<View style={styles.emptySlot}>{renderEmpty()}</View>}
        ItemSeparatorComponent={() => <View style={styles.cardGap} />}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <LoadingView />
            </View>
          ) : error && items.length > 0 ? (
            <View style={styles.footer}>
              <Pressable
                style={({ pressed }) => [styles.retryMore, pressed && styles.pressed]}
                onPress={retryFailed}
              >
                <Text style={styles.retryMoreText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : null
        }
        contentContainerStyle={[
          styles.main,
          {
            paddingTop: insets.top + HEADER_HEIGHT + SECTION_GAP,
            paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + SECTION_GAP,
          },
        ]}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
      />

      {/* 悬浮顶栏:必须在 FlatList 之后声明(见上方注释),滚动内容从它下方滑过 */}
      <View style={[styles.headerBar, { top: insets.top }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {/* 底部价格栏 */}
      <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
        {priceFrom > 0 ? (
          <View style={styles.priceBlock}>
            <Text style={styles.startAt}>{t('hotels.detail.startAt')}</Text>
            <Text style={styles.price}>{formatMoney(priceFrom, currency)}</Text>
            <Text style={styles.discount}>
              {t('hotels.detail.discountToday', { percent: DETAIL_DEMO.discountPercent })}
            </Text>
          </View>
        ) : (
          /* 拿不到真实起价时不编造金额,CTA 靠右站住(底栏 justify-content: space-between) */
          <View />
        )}
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          onPress={goRooms}
        >
          <Text style={styles.ctaText}>{t('hotels.detail.chooseRoom')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  /** 滚动视口 = 屏幕剩余空间;少了它 FlatList 会撑成内容高,滚动行为就不对了 */
  flex: { flex: 1 },

  /* ---- 悬浮顶栏(稿面 Header - Top App Bar 1133:3247)---- */
  headerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    /* 显式压住滚动内容:不把层级寄托在 JSX 声明顺序上(Android 靠 elevation,已由 shadows.subtle 给) */
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  backBtn: { padding: 0 },
  headerTitle: {
    flexShrink: 1,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary,
  },

  /* ---- 滚动区(稿面 Main:padding 24px 16px 124px,gap 24)---- */
  main: { paddingHorizontal: PAGE_PADDING },
  dashboardSlot: { marginBottom: SECTION_GAP },
  cardGap: { height: SECTION_GAP },
  emptySlot: { minHeight: 240, justifyContent: 'center' },
  footer: { paddingTop: SECTION_GAP, minHeight: 64, justifyContent: 'center' },
  retryMore: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  retryMoreText: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
  },

  /* ---- 吸底价格栏(稿面 Mobile Bottom Bar 1133:3113)---- */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    /* 同顶栏:显式压住滚动内容(它声明在 FlatList 之后,这里再加一层保险) */
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 197, 215, 0.3)',
    backgroundColor: colors.card,
  },
  priceBlock: { gap: 0 },
  startAt: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    color: colors.heading,
  },
  price: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.primary,
  },
  discount: {
    fontFamily: fonts.interBold,
    fontSize: 10,
    lineHeight: 15,
    color: colors.emergencyFg,
  },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  ctaText: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  pressed: { opacity: 0.85 },
});
