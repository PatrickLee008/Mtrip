/**
 * 酒店搜索结果页(Figma M-Trip / Long Stay Search Results 1695:6325)
 *
 * 结构:顶部大图 → 悬浮顶部栏(返回 / 筛选)→ 搜索卡(回显并可改条件)
 *      → 筛选 chips(横滑)→ 结果头(总数 / 含税说明 / View map)→ 酒店卡列表。
 *
 * 设计稿实测:
 *   大图     402x268 顶部对齐;Main 从状态栏下 120 起(与大图重叠 148),同酒店搜索页
 *   搜索卡   --tab 底,圆角 32,padding 24,内部 gap 16,投影 DS_AG(shadows.card)
 *            标题 Inter 700/20 主色;字段 #EFF4FF 圆角 12,搜索框高 64、日期/入住人高 60
 *   chips    px17/py9 圆角 999,Inter 500/14;选中主色底白字,未选中 --tab 底 --secondary 描边
 *   结果头   左「N Properties Found」Outfit 600/24 +「Prices include taxes and fees」Inter 500/14
 *            右「View map」15px 图标 + Inter 600/14 主色
 *   卡片间距 24(Section - Hotel Grid 的 itemSpacing)
 *
 * 数据:`/api/v1/app/goods/list`(goodsType=1)。chips 与排序都落到真实查询参数上——
 *   Rating 4+ → reviewScore=4、Free Cancellation → freeCancel=1、Breakfast → breakfast=1、
 *   Free Wifi → amenities=Wifi(按 goods_info.facilities 的 JSON 值匹配),Sort by → sortBy 白名单。
 *   搜索卡里改目的地/日期/公民身份后要点 Search 才生效(设计稿有 CTA);chips 与排序即时生效。
 *
 * **演示数据**:接口没连通或没返回结果时,列表回落到 `demoResults.ts` —— 设计稿那四张卡的原始数值与文案
 *   (评分 9.3/7.8/4.3、SUMMER PROMO、Long Stay Not Supported、PREFERRED/HIGH DEMAND/BEST SELLER…),
 *   结果头的总数也随之显示演示条数,并在其下给一条可点重试的提示条(请求失败时附带错误原因)。
 *   演示态下 chips / 排序 / 关键词在前端本地生效,点卡片不跳详情、点心只切本地状态。
 *
 * 未实现的能力(设计稿有、当前没有对应依赖或接口),一律走 comingSoon:
 *   入住人选择、View map(未引入地图)。
 * 顶部栏筛选按钮复用 `HotelFilterSheet`;列表接口没有价格/设施区间参数,面板结果同样只留在状态里。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { fetchGoodsList, type GoodsSortBy } from '@/api/goods';
import { addFavorite, fetchFavoriteList, removeFavorite } from '@/api/user';
import { LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import DatePickerSheet, {
  DateRangeValue,
  defaultDateRange,
} from '@/components/hotel/DatePickerSheet';
import HotelFilterSheet, {
  DEFAULT_HOTEL_FILTER,
  HotelFilterValue,
} from '@/components/hotel/HotelFilterSheet';
import HotelResultCard from '@/components/hotel/HotelResultCard';
import SortSheet, { type SortAnchor } from '@/components/hotel/SortSheet';
import { GOODS_TYPE } from '@/config/global';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import {
  DEMO_BADGE,
  DEMO_COVERS,
  DEMO_KEY_BY_ID,
  DEMO_PROMO,
  DEMO_RATING_TIER,
  queryDemoResults,
  type DemoKey,
} from '@/screens/hotel/demoResults';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import type { GoodsItem } from '@/types/models';

const HERO = require('../../../assets/images/hotels/hero.png');

/** 设计稿大图 402x268,搜索卡顶在状态栏下 120,故与大图重叠 148(同酒店搜索页) */
const HERO_HEIGHT = 268;
const MAIN_OVERLAP = HERO_HEIGHT - 120;

const PAGE_SIZE = 10;

/** 设计稿 chips:除 Sort by 外都是开关,各自映射到列表接口的一个筛选参数 */
type ChipKey = 'rating4' | 'freeCancellation' | 'breakfast' | 'freeWifi';
const CHIPS: ChipKey[] = ['rating4', 'freeCancellation', 'breakfast', 'freeWifi'];

/** Free Wifi 对应 goods_info.facilities 里的标签值(后端按 JSON_CONTAINS 精确匹配) */
const WIFI_AMENITY = 'Wifi';

export default function HotelResultsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'HotelResults'>>();
  const params = route.params ?? {};
  const showToast = useCommonStore((s) => s.showToast);
  const isLogin = useUserStore((s) => s.isLogin);

  /* ---- 搜索卡草稿:改完点 Search 才落到 applied ---- */
  const [keyword, setKeyword] = useState(params.keyword ?? '');
  const [range, setRange] = useState<DateRangeValue>(() =>
    params.checkIn && params.checkOut
      ? { checkIn: params.checkIn, checkOut: params.checkOut, flexDays: params.flexDays ?? 0 }
      : defaultDateRange(),
  );
  const [citizen, setCitizen] = useState(Boolean(params.citizen));

  /** 已提交的查询条件(chips 与排序即时改这里) */
  const [applied, setApplied] = useState({
    keyword: params.keyword ?? '',
    citizen: Boolean(params.citizen),
  });
  const [chips, setChips] = useState<ChipKey[]>([]);
  const [sortBy, setSortBy] = useState<GoodsSortBy>('default');

  const [sortOpen, setSortOpen] = useState(false);
  /** 排序面板锚定在「Sort by」chip 下方(设计稿 901:1673 是一张就地弹出的卡片) */
  const sortChipRef = useRef<View>(null);
  const [sortAnchor, setSortAnchor] = useState<SortAnchor | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<HotelFilterValue>(DEFAULT_HOTEL_FILTER);

  /* ---- 列表 ---- */
  const [items, setItems] = useState<GoodsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  const busyRef = useRef(false);

  const [favorites, setFavorites] = useState<number[]>([]);

  const comingSoon = () => showToast(t('home.comingSoon'));

  const query = useMemo(
    () => ({
      goodsType: GOODS_TYPE.HOTEL,
      keyword: applied.keyword || undefined,
      sortBy,
      reviewScore: chips.includes('rating4') ? 4 : undefined,
      freeCancel: chips.includes('freeCancellation') ? 1 : undefined,
      breakfast: chips.includes('breakfast') ? 1 : undefined,
      amenities: chips.includes('freeWifi') ? WIFI_AMENITY : undefined,
    }),
    [applied.keyword, chips, sortBy],
  );

  const load = useCallback(
    async (page: number, mode: 'init' | 'refresh' | 'more') => {
      if (busyRef.current) return;
      busyRef.current = true;
      if (mode === 'init') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      try {
        const data = await fetchGoodsList({ ...query, page, pageSize: PAGE_SIZE });
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

  /* 收藏态:登录后拉一次,未登录时点心跳登录页 */
  useEffect(() => {
    if (!isLogin) {
      setFavorites([]);
      return;
    }
    fetchFavoriteList({ page: 1, pageSize: 100 })
      .then((data) => setFavorites(data.list.map((f) => f.goods_id)))
      .catch(() => setFavorites([]));
  }, [isLogin]);

  const toggleFavorite = (goods: GoodsItem) => {
    /* 演示卡(id 取负数)没有真实商品,只切本地状态 */
    if (goods.id < 0) {
      setFavorites((prev) =>
        prev.includes(goods.id) ? prev.filter((id) => id !== goods.id) : [...prev, goods.id],
      );
      return;
    }
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

  /** 先量一次 chip 的窗口坐标,面板据此贴着它下方弹出 */
  const openSort = () => {
    if (!sortChipRef.current) {
      setSortAnchor(null);
      setSortOpen(true);
      return;
    }
    sortChipRef.current.measureInWindow((x, y, _w, h) => {
      setSortAnchor({ x, y: y + h });
      setSortOpen(true);
    });
  };

  const toggleChip = (key: ChipKey) =>
    setChips((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const submit = () => setApplied({ keyword: keyword.trim(), citizen });

  /* 设计稿的日期形如 Wed, Jun 3;跟随当前语言 */
  const formatDay = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(i18n.language, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  /**
   * 演示数据:接口没连通或没有结果时,先用设计稿那四张卡把页面撑起来。
   * 关键词匹配要用译文,故把「名称 + 地址」喂给 queryDemoResults。
   */
  const demoText = useCallback(
    (key: DemoKey) =>
      `${t(`hotels.results.demo.${key}.name`)} ${t(`hotels.results.demo.${key}.address`)}`,
    [t],
  );
  const demoItems = useMemo(
    () => queryDemoResults({ chips, keyword: applied.keyword, sortBy, textOf: demoText }),
    [chips, applied.keyword, sortBy, demoText],
  );
  const showDemo = !loading && items.length === 0;
  const data = loading ? [] : showDemo ? demoItems : items;
  const shownTotal = showDemo ? demoItems.length : total;

  const header = (
    <View>
      <Image source={HERO} style={styles.hero} resizeMode="cover" />

      <View style={styles.main}>
        {/* 01 搜索卡(回显当前条件,可改后重查) */}
        <View style={styles.searchCard}>
          <Text style={styles.searchTitle}>{t('hotels.title')}</Text>

          <View style={[styles.field, styles.searchField]}>
            <HomeIcon name="search" size={18} color={colors.primary} />
            <TextInput
              style={styles.searchInput}
              value={keyword}
              onChangeText={setKeyword}
              placeholder={t('hotels.searchPlaceholder')}
              placeholderTextColor={colors.textSoft}
              returnKeyType="search"
              onSubmitEditing={submit}
            />
          </View>

          <View style={styles.dateRow}>
            {(['checkIn', 'checkOut'] as const).map((field) => (
              <Pressable
                key={field}
                style={({ pressed }) => [styles.field, styles.dateField, pressed && styles.pressed]}
                onPress={() => setDateOpen(true)}
              >
                <HomeIcon name="calendar" size={20} color={colors.primary} />
                <View>
                  <Text style={styles.fieldLabel}>
                    {t(field === 'checkIn' ? 'hotels.checkIn' : 'hotels.checkOut')}
                  </Text>
                  <Text style={styles.fieldValue}>{formatDay(range[field])}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.field, styles.guestField, pressed && styles.pressed]}
            onPress={comingSoon}
          >
            <HomeIcon name="travelers" size={22} color={colors.primary} />
            <View>
              <Text style={styles.fieldLabel}>{t('hotels.guests')}</Text>
              <Text style={styles.fieldValue}>
                {t('hotels.guestsValue', { adults: 2, rooms: 1 })}
              </Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.citizenRow, pressed && styles.pressed]}
            onPress={() => setCitizen((v) => !v)}
            hitSlop={6}
          >
            <HomeIcon
              name={citizen ? 'checkboxIndeterminate' : 'checkbox'}
              size={20}
              color={citizen ? colors.primary : colors.textSoft}
            />
            <Text style={styles.citizenText}>{t('hotels.myanmarCitizen')}</Text>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.cta, pressed && styles.pressed]} onPress={submit}>
            <Text style={styles.ctaText}>{t('hotels.search')}</Text>
          </Pressable>
        </View>

        {/* 02 筛选 chips(设计稿一排排满,窄屏可横滑) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          <Pressable
            ref={sortChipRef}
            style={({ pressed }) => [styles.chip, styles.chipPlain, pressed && styles.pressed]}
            onPress={openSort}
          >
            {/* 设计稿是 fluent:arrow-sort-down-lines-16-filled,项目图标表里暂用同体系的 filter 字形 */}
            <HomeIcon name="filter" size={16} color={colors.textSoft} />
            <Text style={styles.chipText}>{t('hotels.results.sortBy')}</Text>
          </Pressable>

          {CHIPS.map((key) => {
            const active = chips.includes(key);
            return (
              <Pressable
                key={key}
                style={({ pressed }) => [
                  styles.chip,
                  active ? styles.chipActive : styles.chipIdle,
                  pressed && styles.pressed,
                ]}
                onPress={() => toggleChip(key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(`hotels.results.chips.${key}`)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 03 结果头 */}
        <View style={styles.resultHeader}>
          <View style={styles.resultHeaderLeft}>
            <Text style={styles.resultCount}>
              {t('hotels.results.found', { total: shownTotal })}
            </Text>
            <Text style={styles.resultNote}>{t('hotels.results.taxNote')}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.mapBtn, pressed && styles.pressed]}
            onPress={comingSoon}
            hitSlop={8}
          >
            {/* 设计稿 15x15 地图图标;项目图标表里的 map 仍是同体系顶替字形 */}
            <HomeIcon name="map" size={15} color={colors.primary} />
            <Text style={styles.mapText}>{t('hotels.results.viewMap')}</Text>
          </Pressable>
        </View>

        {/* 演示数据提示:点一下重试真实请求 */}
        {showDemo ? (
          <Pressable
            style={({ pressed }) => [styles.demoNotice, pressed && styles.pressed]}
            onPress={() => void load(1, 'init')}
          >
            {/* 请求失败时把原因一并带出来,别让演示数据把错误盖掉 */}
            <Text style={styles.demoNoticeText}>
              {error ? `${t('hotels.results.demoNotice')} · ${error}` : t('hotels.results.demoNotice')}
            </Text>
            <Text style={styles.demoNoticeLink}>{t('common.retry')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={header}
          renderItem={({ item }) => {
            /* 演示卡(id 取负数)的名称/地址/促销/徽章全部照设计稿回填,真实数据一律走接口字段 */
            const key = item.id < 0 ? DEMO_KEY_BY_ID[item.id] : undefined;
            if (!key) {
              return (
                <HotelResultCard
                  goods={item}
                  favorite={favorites.includes(item.id)}
                  citizen={applied.citizen}
                  onPress={(g) => navigation.navigate('GoodsDetail', { id: g.id })}
                  onToggleFavorite={toggleFavorite}
                />
              );
            }
            const tier = DEMO_RATING_TIER[key];
            const badge = DEMO_BADGE[key];
            const promo = DEMO_PROMO[key];
            return (
              <HotelResultCard
                goods={{
                  ...item,
                  goods_name: t(`hotels.results.demo.${key}.name`),
                  address: t(`hotels.results.demo.${key}.address`),
                }}
                coverSource={DEMO_COVERS[key]}
                favorite={favorites.includes(item.id)}
                citizen={applied.citizen}
                ratingTier={tier ? t(`hotels.results.${tier}`) : null}
                badge={badge ? { text: t(badge.textKey), tone: badge.tone } : null}
                promo={
                  promo
                    ? {
                        strike: promo.strike,
                        tags: promo.tags?.map((tag) => ({ text: t(tag.textKey), tone: tag.tone })),
                      }
                    : undefined
                }
                onPress={comingSoon}
                onToggleFavorite={toggleFavorite}
              />
            );
          }}
          ListEmptyComponent={loading ? <LoadingView /> : null}
          ListFooterComponent={
            items.length > 0 ? (
              <Text style={styles.footerText}>
                {loadingMore ? t('common.loadMore') : hasMore ? '' : t('common.noMore')}
              </Text>
            ) : null
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.cardGap} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshing={refreshing}
          onRefresh={() => void load(1, 'refresh')}
          onEndReached={() => {
            if (hasMore && !loadingMore) void load(pageRef.current + 1, 'more');
          }}
          onEndReachedThreshold={0.3}
        />

        {/* 顶部栏悬浮在大图上,不随内容滚动 */}
        <View style={styles.topBar} pointerEvents="box-none">
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="hotelResultsTopBar" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0.5} />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#hotelResultsTopBar)" />
          </Svg>

          <Pressable
            style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
          >
            <HomeIcon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.roundBtn, styles.filterBtn, pressed && styles.pressed]}
            onPress={() => setFilterOpen(true)}
            hitSlop={8}
          >
            <HomeIcon name="filter" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </SafeAreaView>

      <SortSheet
        visible={sortOpen}
        value={sortBy}
        anchor={sortAnchor}
        onClose={() => setSortOpen(false)}
        onSelect={(next) => {
          setSortBy(next);
          setSortOpen(false);
        }}
        onUnavailable={comingSoon}
      />

      <DatePickerSheet
        visible={dateOpen}
        value={range}
        onClose={() => setDateOpen(false)}
        onConfirm={(next) => {
          setRange(next);
          setDateOpen(false);
        }}
      />

      <HotelFilterSheet
        visible={filterOpen}
        value={filter}
        onClose={() => setFilterOpen(false)}
        onApply={(next) => {
          setFilter(next);
          setFilterOpen(false);
        }}
        onComingSoon={comingSoon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1 },

  listContent: { paddingHorizontal: PAGE_PADDING, paddingBottom: 32 },
  /* 卡片间距 24;头部自己带内边距,故左右负一个页面内边距还原整宽大图 */
  cardGap: { height: 24 },
  footerText: {
    paddingVertical: 16,
    textAlign: 'center',
    fontFamily: fonts.inter,
    fontSize: 12,
    color: colors.textSoft,
  },

  hero: {
    height: HERO_HEIGHT,
    /**
     * 列表内容有 16 的横向内边距,大图要铺满整宽:
     * 负外边距 + alignSelf:'stretch' 让它按「父宽 + 32」拉伸(不能再写 width:'100%',
     * 那样只会整体左移、右边空出 16)
     */
    marginHorizontal: -PAGE_PADDING,
    alignSelf: 'stretch',
  },
  main: { marginTop: -MAIN_OVERLAP, paddingBottom: 24, gap: 24 },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  roundBtn: {
    padding: 8,
    borderRadius: 20,
    /* 设计稿还叠了 4px 背景模糊,RN 无原生 backdrop-blur,只保留底色 */
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  filterBtn: { borderRadius: 999 },

  searchCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 24,
    gap: 16,
    ...shadows.card,
  },
  searchTitle: {
    fontFamily: fonts.interBold,
    fontSize: 20,
    color: colors.primary,
    textAlign: 'center',
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.btn,
    backgroundColor: colors.tintBg,
  },
  searchField: { height: 64 },
  searchInput: {
    flex: 1,
    /* 同酒店页:web 端 <input> 的 min-width:auto 会把圆角框撑破 */
    minWidth: 0,
    fontFamily: fonts.interSemi,
    fontSize: 20,
    color: colors.heading,
  },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1, height: 60 },
  guestField: { height: 60 },
  fieldLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSoft,
  },
  fieldValue: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },

  citizenRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  citizenText: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 24,
    color: colors.textSoft,
  },

  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  ctaText: {
    fontFamily: fonts.outfit,
    fontSize: 16,
    lineHeight: 28,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  chipScroll: { marginHorizontal: -PAGE_PADDING },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: PAGE_PADDING },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 17,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  /* Sort by 与 Free Wifi 在设计稿里是纯白底 + --divider 描边 */
  chipPlain: { backgroundColor: '#FFFFFF', borderColor: colors.divider },
  chipIdle: { backgroundColor: colors.surface, borderColor: colors.softBlue },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.divider },
  chipText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
    textAlign: 'center',
  },
  chipTextActive: { color: '#FFFFFF' },

  resultHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  resultHeaderLeft: { flexShrink: 1 },
  resultCount: {
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.heading,
  },
  resultNote: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: -12,
    padding: 12,
    borderRadius: radius.btn,
    backgroundColor: colors.tintBg,
  },
  demoNoticeText: {
    flexShrink: 1,
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSoft,
  },
  demoNoticeLink: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    color: colors.primary,
  },

  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mapText: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },

  pressed: { opacity: 0.85 },
});
