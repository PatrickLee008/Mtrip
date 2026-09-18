/**
 * 关怀模式酒店搜索结果页(Figma `Hotel Search Lite` / Search Results `2312:6745`)
 *
 * 与完整模式 `HotelResultsScreen`(1695:6325)的关系:同一份 `/app/hotels/list` 数据(与 `fetchHotelList` 同源,
 * 见 HANDOFF 2026-09-16 那条 —— 早先误用了只收门票的 `/app/goods/list`,必被 400 打回),
 * 但关怀稿**去掉了 chips 行、排序面板与地址/徽章**,只剩「Choose a Hotel + 一列大卡」;
 * 顶部栏也换成白底一行:返回 + 目的地/日期胶囊 + 筛选按钮。
 * 因为版式差得远,和首页 / 我的精选一样另起一页,不在完整版里加分支(见 HANDOFF 关怀模式那条)。
 *
 * 设计稿实测:
 *   页面   底色 --background;顶部栏白底(--tab)绝对定位,px20 py16,投影 0/1 blur1 黑 5%
 *   胶囊   #EFF4FF 圆角 16 高 64 p12:18 定位图标 + (目的地 Inter 600/20 / 日期 Inter 400/12)
 *   筛选   40 圆按钮,内 24 漏斗
 *   标题   「Choose a Hotel」Outfit 600/24
 *   列表   卡片间距 24(卡片本体见 components/hotel/lite/LiteHotelCard)
 *
 * 筛选浮层**直接复用完整模式的 `HotelFilterSheet`(408:1824)** —— Lite 稿 `2485:7101`
 * 与它逐段同构(Filter By / Recent Filters / Budget 直方图 + 双滑块 / Popular Filters / Show Results),
 * 没有需要放大的差异,再抄一份只会多一处要同步维护的地方。
 * 同完整模式:`/app/hotels/list` 虽然收 `priceMin/priceMax/amenities` 等参数,但 Lite 版没有 chips 行,
 * 筛选浮层里的选择(设计稿的静态计数与直方图)**只留在前端状态里**,不参与请求
 * —— 与完整版的取舍逐条一致(完整版只有 chips/排序进请求)。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchHotelList } from '@/api/goods';
import { addFavorite, fetchFavoriteList, removeFavorite } from '@/api/user';
import { tempCoverFor } from '@/assets/tempImages';
import { EmptyView, ErrorView, LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import HotelFilterSheet, {
  DEFAULT_HOTEL_FILTER,
  HotelFilterValue,
} from '@/components/hotel/HotelFilterSheet';
import LiteHotelCard from '@/components/hotel/lite/LiteHotelCard';
import { PAGE_PADDING, colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import type { GoodsItem } from '@/types/models';

const PAGE_SIZE = 10;

export default function HotelResultsLiteScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = useRoute<RouteProp<RootStackParamList, 'HotelResultsLite'>>().params ?? {};
  const showToast = useCommonStore((s) => s.showToast);
  const isLogin = useUserStore((s) => s.isLogin);

  const [items, setItems] = useState<GoodsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<HotelFilterValue>(DEFAULT_HOTEL_FILTER);

  const pageRef = useRef(1);
  const busyRef = useRef(false);

  const comingSoon = () => showToast(t('home.comingSoon'));

  const query = useMemo(
    () => ({
      countryCode: params.countryCode,
      cityKey: params.cityKey,
      keyword: params.keyword || undefined,
    }),
    [params.countryCode, params.cityKey, params.keyword],
  );

  const load = useCallback(
    async (page: number, mode: 'init' | 'refresh' | 'more') => {
      if (busyRef.current) return;
      busyRef.current = true;
      if (mode === 'init') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      try {
        const data = await fetchHotelList({ ...query, page, pageSize: PAGE_SIZE });
        pageRef.current = page;
        setItems((prev) => (page === 1 ? data.list : [...prev, ...data.list]));
        setTotal(data.total);
        setHasMore(page * data.pageSize < data.total);
        setError('');
      } catch (e) {
        if (page === 1) {
          setItems([]);
          setTotal(0);
        }
        setError(e instanceof Error ? e.message : 'Error');
      } finally {
        busyRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [query],
  );

  useEffect(() => {
    void load(1, 'init');
  }, [load]);

  /* 收藏态:登录后拉一次,未登录时点心跳登录页(与完整模式同一套) */
  useEffect(() => {
    if (!isLogin) {
      setFavorites([]);
      return;
    }
    fetchFavoriteList({ page: 1, pageSize: 100 })
      .then((data) => setFavorites(data.list.map((f) => f.property_id)))
      .catch(() => setFavorites([]));
  }, [isLogin]);

  const toggleFavorite = (goods: GoodsItem) => {
    if (!isLogin) {
      navigation.navigate('Login');
      return;
    }
    const has = favorites.includes(goods.id);
    /* 先改本地再发请求,失败回滚(列表页收藏是高频轻操作) */
    setFavorites((prev) => (has ? prev.filter((id) => id !== goods.id) : [...prev, goods.id]));
    const req = has ? removeFavorite(goods.id) : addFavorite(goods.id);
    req.catch(() => {
      setFavorites((prev) => (has ? [...prev, goods.id] : prev.filter((id) => id !== goods.id)));
      showToast(t('hotels.results.favoriteFailed'));
    });
  };

  const formatDay = (key?: string) => {
    if (!key) return '';
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(i18n.language, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };
  const dateLabel = [formatDay(params.checkIn), formatDay(params.checkOut)]
    .filter(Boolean)
    .join(' - ');

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <HomeIcon name="arrowLeft" size={32} color={colors.heading} />
          </Pressable>

          {/* 目的地胶囊:点它回搜索页改条件(设计稿是一整块可点区域) */}
          <Pressable
            style={({ pressed }) => [styles.destination, pressed && styles.pressed]}
            onPress={() => navigation.goBack()}
          >
            <HomeIcon name="location" size={18} color={colors.primary} />
            <View style={styles.flexCol}>
              <Text style={styles.destName} numberOfLines={1}>
                {params.keyword || t('hotels.lite.anywhere')}
              </Text>
              {dateLabel ? (
                <Text style={styles.destDates} numberOfLines={1}>
                  {dateLabel}
                </Text>
              ) : null}
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]}
            onPress={() => setFilterOpen(true)}
            hitSlop={8}
          >
            <HomeIcon name="filter" size={24} color={colors.heading} />
          </Pressable>
        </View>

        {loading ? (
          <LoadingView />
        ) : error && items.length === 0 ? (
          <ErrorView message={error} onRetry={() => void load(1, 'init')} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={<Text style={styles.heading}>{t('hotels.lite.chooseHotel')}</Text>}
            ListEmptyComponent={<EmptyView text={t('hotels.results.empty')} />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void load(1, 'refresh')} />
            }
            onEndReachedThreshold={0.3}
            onEndReached={() => {
              if (hasMore && !loadingMore) void load(pageRef.current + 1, 'more');
            }}
            ListFooterComponent={
              loadingMore ? <ActivityIndicator style={styles.more} color={colors.primary} /> : null
            }
            renderItem={({ item, index }) => (
              <LiteHotelCard
                goods={item}
                /* 接口暂时没有可用封面,轮流用设计稿临时图兜底(与完整模式同一套) */
                coverSource={tempCoverFor(index)}
                favorite={favorites.includes(item.id)}
                citizen={Boolean(params.citizen)}
                /* 带上已选日期,一路透传到订房向导 —— 否则选完房日期会跳回默认值 */
                /* 关怀模式留在关怀模式:进 Lite 详情页,不跳完整版的六页签详情 */
                onPress={(goods) =>
                  navigation.navigate('HotelDetailLite', {
                    id: goods.id,
                    checkIn: params.checkIn,
                    checkOut: params.checkOut,
                  })
                }
                onToggleFavorite={toggleFavorite}
              />
            )}
          />
        )}
      </SafeAreaView>

      <HotelFilterSheet
        visible={filterOpen}
        value={filter}
        onClose={() => setFilterOpen(false)}
        onApply={(value) => {
          setFilter(value);
          setFilterOpen(false);
        }}
        onComingSoon={comingSoon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  safe: { flex: 1 },
  pressed: { opacity: 0.85 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  destination: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 64,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.tintBg,
  },
  flexCol: { flex: 1, minWidth: 0, gap: 4 },
  destName: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 24, color: colors.heading },
  destDates: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  filterBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
  },

  list: { padding: PAGE_PADDING, paddingBottom: 32, gap: 24 },
  heading: {
    paddingTop: 8,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.heading,
  },
  more: { paddingVertical: 16 },
});
