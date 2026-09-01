/**
 * 酒店详情页 · 六个页签(Figma M-Trip / `Hotel Details` 759:9776)
 *
 * 设计稿是六张独立的稿,共用同一套壳(图库 / 顶部栏 / 标题卡 / 二级导航 / 底部价格栏),
 * 只有 Main 里的内容列不同 —— 这里做成**一个页面 + 六个页签内容组件**:
 *   Overview   94:438   → components/hotel/HotelOverviewTab
 *   Rooms      222:1428 → components/hotel/HotelRoomsTab
 *   Amenities  222:2539 → components/hotel/HotelAmenitiesTab
 *   Nearby     222:2758 → components/hotel/HotelNearbyTab(设计稿名 Hotel Details Location)
 *   Reviews    222:2978 → components/hotel/HotelReviewsTab
 *   Policies   222:3189 → components/hotel/HotelPoliciesTab
 *
 * **当前是静态页**:数值/文案来自设计稿(`detailDemo.ts` + `hotels.detail.*`),尚未接 `/goods/detail`。
 *
 * 页面壳的实现要点:
 *   状态栏黑条(760:10037)不随内容滚动;二级导航吸顶用 `ScrollView` 的 `stickyHeaderIndices`,
 *   因此它必须是 ScrollView 的直接子节点 —— 设计稿 Main 的 24 间距改由各块自己的 paddingTop 承担。
 *   **底部价格栏在 Rooms 页签隐藏**:设计稿 222:2529 是 hidden 的(每张房型卡自带 Select)。
 *
 * 设计稿有、当前没有对应实现的交互一律走 comingSoon:See Map / Get Directions / 提醒 / 分享 /
 * 客服 / 房型卡的收藏 / Read All Reviews / 面积单位切换。
 * (「Choose my room」已改为切到 Rooms 页签,房型卡 Select 已接上订房流程 1675:5776)
 * 设计稿里另有几张二级页(Rooms Details 281:1041、Reviews Page 1133:2998、Map Location 864:1775、
 * Property Preview / VR View / 3d View)不属于页签,本次未实现。
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { TEMP_HOTEL_GALLERY } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import HotelAmenitiesTab from '@/components/hotel/HotelAmenitiesTab';
import HotelDetailTabs from '@/components/hotel/HotelDetailTabs';
import HotelGallery from '@/components/hotel/HotelGallery';
import HotelNearbyTab from '@/components/hotel/HotelNearbyTab';
import HotelOverviewTab from '@/components/hotel/HotelOverviewTab';
import HotelPoliciesTab from '@/components/hotel/HotelPoliciesTab';
import HotelReviewsTab from '@/components/hotel/HotelReviewsTab';
import HotelRoomsTab from '@/components/hotel/HotelRoomsTab';
import { PAGE_PADDING, SECTION_GAP, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { DETAIL_DEMO, DETAIL_TABS, type DetailTabKey } from '@/screens/hotel/detailDemo';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

/** 设计稿图库 402x300 */
const GALLERY_HEIGHT = 300;
/** 底部价格栏:pt17 + 内容 55(12/16 + 16/24 + 10/15)+ pb16 */
const BOTTOM_BAR_HEIGHT = 88;

export default function HotelDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const currency = useSiteStore((s) => s.currency);
  const showToast = useCommonStore((s) => s.showToast);

  const [tab, setTab] = useState<DetailTabKey>('overview');

  const comingSoon = () => showToast(t('home.comingSoon'));

  /** 设计稿 Rooms 页的底部价格栏是 hidden 的(每张房型卡自带 Select) */
  const showBottomBar = tab !== 'rooms';
  const bottomInset = showBottomBar ? BOTTOM_BAR_HEIGHT + insets.bottom : insets.bottom;

  const renderTab = () => {
    switch (tab) {
      case 'rooms':
        return (
          <HotelRoomsTab
            onComingSoon={comingSoon}
            onSelectRoom={(roomKey) => navigation.navigate('HotelBooking', { roomKey })}
          />
        );
      case 'amenities':
        return <HotelAmenitiesTab />;
      case 'nearby':
        return <HotelNearbyTab onComingSoon={comingSoon} />;
      case 'reviews':
        return <HotelReviewsTab onComingSoon={comingSoon} />;
      case 'policies':
        return <HotelPoliciesTab />;
      default:
        return <HotelOverviewTab onComingSoon={comingSoon} />;
    }
  };

  return (
    <View style={styles.root}>
      {/* 状态栏黑条(设计稿导航条),不随内容滚动 */}
      <View style={[styles.statusBar, { height: insets.top }]} />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: bottomInset + SECTION_GAP }}
        showsVerticalScrollIndicator={false}
        /* 二级导航吸顶:必须是 ScrollView 的直接子节点,故下面几块按设计稿的 24 间距各自留边 */
        stickyHeaderIndices={[2]}
      >
        <HotelGallery images={TEMP_HOTEL_GALLERY} height={GALLERY_HEIGHT} width={width} />

        {/* 标题卡(六个页签共用) */}
        <View style={styles.titleWrap}>
          <View style={styles.titleCard}>
            <Text style={styles.title}>{t('hotels.results.demo.heritageBagan.name')}</Text>
            <View style={styles.addressRow}>
              <HomeIcon name="locationOutline" width={12} height={15} color={colors.textSoft} />
              <Text style={styles.address}>{t('hotels.results.demo.heritageBagan.address')}</Text>
            </View>
          </View>
        </View>

        {/* 二级导航(吸顶;底色取页面底色,滚动时内容不会透出来) */}
        <View style={styles.tabsWrap}>
          <HotelDetailTabs tabs={DETAIL_TABS} value={tab} onChange={setTab} />
        </View>

        <View style={styles.body}>{renderTab()}</View>
      </ScrollView>

      {/* 顶部栏悬浮在图库上,不随内容滚动 */}
      <View style={[styles.topBar, { top: insets.top }]} pointerEvents="box-none">
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="hotelDetailTopBar" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={0.5} />
              <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#hotelDetailTopBar)" />
        </Svg>

        <Pressable
          style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <HomeIcon name="arrowLeft" size={20} color="#FFFFFF" />
        </Pressable>

        <View style={styles.topBarRight}>
          <Pressable
            style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
            onPress={comingSoon}
            hitSlop={8}
          >
            <HomeIcon name="bellOutline" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
            onPress={comingSoon}
            hitSlop={8}
          >
            <HomeIcon name="share" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/**
       * 客服悬浮球:设计稿只在 Overview / Rooms 两张稿上画了它,但它是全局入口,
       * 这里六个页签都保留,位置跟着底栏在不在走。
       */}
      <Pressable
        style={({ pressed }) => [styles.fab, { bottom: bottomInset + 2 }, pressed && styles.pressed]}
        onPress={comingSoon}
      >
        <HomeIcon name="chatFilled" size={20} color="#FFFFFF" />
      </Pressable>

      {/* 底部价格栏 */}
      {showBottomBar ? (
        <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
          <View>
            <Text style={styles.startAt}>{t('hotels.detail.startAt')}</Text>
            <Text style={styles.price}>{formatMoney(DETAIL_DEMO.priceFrom, currency)}</Text>
            <Text style={styles.discount}>
              {t('hotels.detail.discountToday', { percent: DETAIL_DEMO.discountPercent })}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            /* 「Choose my room」切到 Rooms 页签(那里每张房型卡自带 Select 进订房流程) */
            onPress={() => setTab('rooms')}
          >
            <Text style={styles.ctaText}>{t('hotels.detail.chooseRoom')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1 },
  statusBar: { backgroundColor: '#000000' },

  /* ---- 顶部栏 ---- */
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roundBtn: {
    padding: 8,
    borderRadius: 20,
    /* 设计稿还叠了 4px 背景模糊,RN 无原生 backdrop-blur,只保留底色 */
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },

  /* ---- 标题卡 ---- */
  titleWrap: { paddingHorizontal: PAGE_PADDING, paddingTop: SECTION_GAP },
  titleCard: {
    padding: 21,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.card,
    ...shadows.subtle,
  },
  title: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.heading,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  address: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  /* ---- 二级导航 ---- */
  tabsWrap: { paddingTop: SECTION_GAP, backgroundColor: colors.pageBg },

  body: { paddingHorizontal: PAGE_PADDING, paddingTop: SECTION_GAP },

  /* ---- 客服悬浮球 ---- */
  fab: {
    position: 'absolute',
    right: 10.4,
    width: 57.6,
    height: 57.6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28.8,
    borderWidth: 1.2,
    borderColor: colors.softBlue,
    backgroundColor: colors.primary,
    ...shadows.card,
  },

  /* ---- 底部价格栏 ---- */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 17,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 197, 215, 0.3)',
    backgroundColor: colors.card,
  },
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
