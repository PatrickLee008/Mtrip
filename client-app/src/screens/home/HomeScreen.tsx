/**
 * 首页(按 Figma M-Trip / Home 81:2464 重做)
 *
 * 结构与设计稿一致:搜索 → 快捷入口(一行 4 项)→ 筛选 chips → 促销卡 → 会员卡 →
 * 热门目的地 → 限时特惠 → 酒店特惠 → 餐饮 → 路线 → 本地体验 → 旅行协助 → 杂志流。
 * 其中「热门目的地」取接口 hot、「酒店特惠」取接口 recommend,其余区块暂用 homeSections.ts 的静态数据。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { fetchHome } from '@/api/goods';
import { LoadingView } from '@/components/common/StateViews';
import AssistanceGrid from '@/components/home/AssistanceGrid';
import DestinationCard, { DESTINATION_CARD_WIDTH } from '@/components/home/DestinationCard';
import DiningCard, { DINING_CARD_WIDTH } from '@/components/home/DiningCard';
import ExperienceCard from '@/components/home/ExperienceCard';
import HomeHeader from '@/components/home/HomeHeader';
import MagazineCard from '@/components/home/MagazineCard';
import MemberCard from '@/components/home/MemberCard';
import PromoCard from '@/components/home/PromoCard';
import QuickActionGrid from '@/components/home/QuickActionGrid';
import QuickFilterChips from '@/components/home/QuickFilterChips';
import RouteCard from '@/components/home/RouteCard';
import SearchSection from '@/components/home/SearchSection';
import SectionHeader from '@/components/home/SectionHeader';
import SpecialDealBanner from '@/components/home/SpecialDealBanner';
import StayCard, { STAY_CARD_WIDTH } from '@/components/home/StayCard';
import { GOODS_TYPE } from '@/config/global';
import { PAGE_PADDING, SECTION_GAP, colors } from '@/config/theme';
import {
  DESTINATIONS,
  DINING_ITEMS,
  EXPERIENCES,
  MAGAZINE_ITEMS,
  QUICK_ACTIONS,
  ROUTES,
  type QuickAction,
} from '@/screens/home/homeSections';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import { useUserStore } from '@/store/userStore';
import type { GoodsItem } from '@/types/models';

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  // 用 ScrollView 实测宽度而非窗口宽度:web 端竖向滚动条会占去约 15px,
  // 直接拿 window.width 算会让整宽卡片超出可视区,导致页面可以左右拖动
  const [contentWidth, setContentWidth] = useState(width - PAGE_PADDING * 2);

  const siteId = useSiteStore((s) => s.siteId);
  const siteName = useSiteStore((s) => s.siteName);
  const switchSite = useSiteStore((s) => s.switchSite);
  const isLogin = useUserStore((s) => s.isLogin);
  const profile = useUserStore((s) => s.profile);
  const showToast = useCommonStore((s) => s.showToast);

  const [keyword, setKeyword] = useState('');
  const [recommend, setRecommend] = useState<GoodsItem[]>([]);
  const [hot, setHot] = useState<GoodsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const data = await fetchHome();
        setRecommend(data.recommend);
        setHot(data.hot);
      } catch (e) {
        // 接口失败只影响 06/08 两个区块,静态区块照常展示
        setRecommend([]);
        setHot([]);
        if (isRefresh) showToast(e instanceof Error ? e.message : 'Error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void load();
  }, [load, siteId]);

  // 首次进入若无站点快照,拉取默认站点配置(货币/时区/语言)
  useEffect(() => {
    if (!siteName) {
      switchSite(siteId).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goDetail = (goods: GoodsItem) => navigation.navigate('GoodsDetail', { id: goods.id });
  const goList = (goodsType?: number, title?: string) =>
    navigation.navigate('GoodsList', goodsType ? { goodsType, title } : {});
  const comingSoon = () => showToast(t('home.comingSoon'));

  const search = () => {
    const kw = keyword.trim();
    navigation.navigate('GoodsList', kw ? { keyword: kw } : {});
  };

  const quickActionPress = (item: QuickAction) => {
    if (item.goodsType) {
      goList(item.goodsType, t(`home.quickAction.${item.key}`));
      return;
    }
    comingSoon();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <LoadingView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.blob} pointerEvents="none" />
      {/* 设计稿 Header - TopAppBar:左 mTrip 字标,右积分胶囊 + 消息 */}
      <HomeHeader
        points={profile?.points ?? 0}
        onPressPoints={() => (isLogin ? comingSoon() : navigation.navigate('Login'))}
        onPressMessage={() => (isLogin ? comingSoon() : navigation.navigate('Login'))}
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setContentWidth(e.nativeEvent.layout.width - PAGE_PADDING * 2)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
      >
        {/* 00 搜索 */}
        <SearchSection value={keyword} onChangeText={setKeyword} onSubmit={search} />

        {/* 01 快捷入口(设计稿只有一行 4 项) */}
        <QuickActionGrid items={QUICK_ACTIONS} onPress={quickActionPress} />

        {/* 03 快捷筛选 */}
        <QuickFilterChips onPress={comingSoon} />

        {/* 04 新用户促销 */}
        <PromoCard onPress={() => goList(GOODS_TYPE.HOTEL, t('home.promo.category'))} />

        {/* 05 会员引导(已登录隐藏) */}
        {!isLogin ? <MemberCard onPress={() => navigation.navigate('Login')} /> : null}

        {/* 06 热门目的地 */}
        <View>
          <SectionHeader
            title={t('home.destinations.title')}
            onSeeAll={() => goList(undefined, t('home.destinations.title'))}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
            contentContainerStyle={styles.hList}
            snapToInterval={DESTINATION_CARD_WIDTH + 16}
            decelerationRate="fast"
          >
            {hot.length > 0
              ? hot.map((g) => (
                  <DestinationCard
                    key={g.id}
                    name={g.goods_name}
                    desc={g.goods_brief}
                    uri={g.cover_image}
                    onPress={() => goDetail(g)}
                  />
                ))
              : DESTINATIONS.map((d) => (
                  <DestinationCard
                    key={d.key}
                    name={t(`home.destinations.${d.key}.name`)}
                    desc={t(`home.destinations.${d.key}.desc`)}
                    category={t(`home.destinations.${d.key}.category`)}
                    onPress={comingSoon}
                  />
                ))}
          </ScrollView>
        </View>

        {/* 07 限时特惠 */}
        <View>
          <SectionHeader title={t('home.specialDeals.title')} />
          <SpecialDealBanner
            width={contentWidth}
            onPress={() => goList(GOODS_TYPE.TICKET, t('home.specialDeals.title'))}
          />
        </View>

        {/* 08 酒店特惠 */}
        {recommend.length > 0 ? (
          <View>
            <SectionHeader
              title={t('home.stays.title')}
              onSeeAll={() => goList(GOODS_TYPE.HOTEL, t('home.stays.title'))}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
              contentContainerStyle={styles.hList}
              snapToInterval={STAY_CARD_WIDTH + 16}
              decelerationRate="fast"
            >
              {recommend.map((g) => (
                <StayCard key={g.id} goods={g} onPress={goDetail} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* 09 餐饮优惠 */}
        <View>
          <SectionHeader title={t('home.dining.title')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
            contentContainerStyle={styles.hList}
            snapToInterval={DINING_CARD_WIDTH + 16}
            decelerationRate="fast"
          >
            {DINING_ITEMS.map((key) => (
              <DiningCard
                key={key}
                name={t(`home.dining.${key}.name`)}
                desc={t(`home.dining.${key}.desc`)}
                onPress={comingSoon}
              />
            ))}
          </ScrollView>
        </View>

        {/* 10 热门路线 */}
        <View>
          <SectionHeader title={t('home.routes.title')} />
          <View style={styles.stack}>
            {ROUTES.map((r) => (
              <RouteCard
                key={r.key}
                name={t(`home.routes.${r.key}.name`)}
                desc={t(`home.routes.${r.key}.desc`)}
                price={r.price}
                originalPrice={r.originalPrice}
              />
            ))}
          </View>
        </View>

        {/* 11 本地体验 */}
        <View>
          <SectionHeader title={t('home.experiences.title')} />
          <View style={styles.stack}>
            {EXPERIENCES.map((e) => (
              <ExperienceCard
                key={e.key}
                width={contentWidth}
                name={t(`home.experiences.${e.key}.name`)}
                desc={t(`home.experiences.${e.key}.desc`)}
                highDemand={e.highDemand}
                onPress={comingSoon}
              />
            ))}
          </View>
        </View>

        {/* 12 旅行协助 */}
        <AssistanceGrid onPress={comingSoon} />

        {/* 13 杂志流 */}
        <View>
          <SectionHeader title={t('home.magazine.title')} />
          <View style={styles.magazine}>
            {MAGAZINE_ITEMS.map((key, i) => (
              <MagazineCard
                key={key}
                width={contentWidth}
                category={t(`home.magazine.${key}.category`)}
                title={t(`home.magazine.${key}.title`)}
                excerpt={t(`home.magazine.${key}.excerpt`)}
                meta={t(`home.magazine.${key}.meta`)}
                showDivider={i < MAGAZINE_ITEMS.length - 1}
                onPress={comingSoon}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* overflow hidden 用来裁掉右上角越界的装饰光斑,否则 web 端整页可以左右拖动 */
  safe: { flex: 1, backgroundColor: colors.pageBg, overflow: 'hidden' },
  flex: { flex: 1 },
  /* 设计稿右上角 320x320 高斯模糊光斑,RN 无 layer blur,用低透明度大圆近似 */
  blob: {
    position: 'absolute',
    top: -120,
    right: -110,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(78, 115, 255, 0.1)',
  },
  content: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 8,
    paddingBottom: 32,
    gap: SECTION_GAP,
  },
  /* 横滑区块出血到屏幕边缘 */
  bleed: { marginHorizontal: -PAGE_PADDING },
  hList: { paddingHorizontal: PAGE_PADDING, gap: 16 },
  stack: { gap: 16 },
  magazine: { gap: 24 },
});
