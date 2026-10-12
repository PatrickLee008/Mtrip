/**
 * 关怀模式酒店详情页(Figma `Hotel Details Lite` / `2642:10749`,含多房间底栏)
 *
 * ⚠️ **版式几经反复,以这一版为准**:09-18 曾按 `2540:16882` 改成
 * 「Hero 图库 + 评分行 + 整宽封面房卡 + Read Policies」,用户实际看过后判定与设计稿差太多,
 * 已按 `2642:10749` 改回**文字顶栏 + 标题卡 + 横排房卡**。别再照 `2540:16882` 改回去。
 *
 * 与完整模式 `HotelDetailScreen`(94:438)的关系:完整版是「图库 + 六个页签」,
 * 关怀版把首屏收成「标题卡 + 房型列表」,设施 / 周边 / 评价挪到「View Hotel Detail」那一页
 * (`HotelInfoLiteScreen`),退改与政策挪到顶栏的「Hotel Policy」(`HotelPolicyLiteScreen`)。
 *
 * 设计稿实测:
 *   页面   底色 --background;Main pt80 px16 pb16 gap24(顶栏绝对定位在状态栏下)
 *   顶栏   px20 py16:左 20 返回 + 「Hotel Details」Outfit 600/24;右「Hotel Policy」按钮
 *          (20 文档图标 + Inter 600/16 主色)
 *   标题卡 `2642:10751` 白底 1px --secondary 圆角 24 padding 21 gap12,投影 0/1 blur1 黑 5%:
 *          酒店名 Inter 600/24/32 → 地址(16 定位图标 + Inter 400/14/24 --text-2)
 *          → 底行 See Map(Inter 600/16/20 主色 + 20 地图图标,px12 gap8)/
 *            View Hotel Detail(Outfit 600/16/24 主色)
 *   区标题 「Choose a Room」Outfit 600/24/24;房卡见 components/hotel/lite/LiteRoomCard
 *   底栏   `2863:7627` 白底、上边框 rgba(196,197,215,.3)、px20 pt17 pb16:
 *          左 Total Price(Inter 600/12/16)+ 金额(Inter 600/16/24 主色)+ -N% TODAY
 *            (Inter 700/10/15 #BA1A1A);
 *          右 购物车(1px 主色描边圆角 12 p12,32 图标,角标 left31/top-8/w24/r99)
 *            + Continue(主色圆角 12 px32 py16,Inter 700/20/24 白)
 *
 * ⚠️ **多房间的合计只是展示**:后端 `order/create` **一单只收一个 sku**,
 * Continue 仍带**第一个**选中的房型进订房向导。这是刻意的,不是没接完。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchHotelDetail } from '@/api/goods';
import { tempCoverFor } from '@/assets/tempImages';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import { realRoomCartEntry } from '@/components/hotel/HotelRoomsTab';
import LiteRoomCard from '@/components/hotel/lite/LiteRoomCard';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { DETAIL_DEMO } from '@/screens/hotel/detailDemo';
import { cartTripItems, useTripQuote } from '@/screens/hotel/useTripQuote';
import { useCommonStore } from '@/store/commonStore';
import { nightsBetween, useRoomCartStore } from '@/store/roomCartStore';
import { useSiteStore } from '@/store/siteStore';
import { useUserStore } from '@/store/userStore';
import type { GoodsDetail, GoodsSku } from '@/types/models';
import { formatMoney } from '@/utils/format';

/** 合计栏高(pt17 + pb16 + 按钮 56),滚动区据此留白 */
const BAR_HEIGHT = 89;

export default function HotelDetailLiteScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = useRoute<RouteProp<RootStackParamList, 'HotelDetailLite'>>().params;
  const showToast = useCommonStore((s) => s.showToast);
  const currency = useSiteStore((s) => s.currency);

  const [detail, setDetail] = useState<GoodsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /**
   * 多房间选择放共享购物车 `roomCartStore`(与完整模式同一份):购物车页 `RoomCart` 与订房向导读同一车,
   * 以前存本页 state,Continue 只带第一个房型,选了几种房型最后只订一种。
   */
  const cartItems = useRoomCartStore((s) => s.items);
  const cartToggle = useRoomCartStore((s) => s.toggle);
  const cartSetQuantity = useRoomCartStore((s) => s.setQuantity);
  const setCartContext = useRoomCartStore((s) => s.setContext);
  const isLogin = useUserStore((s) => s.isLogin);

  const comingSoon = () => showToast(t('home.comingSoon'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await fetchHotelDetail(params.id, { checkIn: params.checkIn, checkOut: params.checkOut }));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [params.id, params.checkIn, params.checkOut]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 换了酒店 setContext 会清空车(跨物业没法下一单),同一家保留已选;购物车页的酒店名与日期也从这里来 */
  useEffect(() => {
    setCartContext({
      propertyId: params.id,
      hotelName: detail?.goods_name ?? '',
      checkIn: params.checkIn,
      checkOut: params.checkOut,
    });
  }, [params.id, detail?.goods_name, params.checkIn, params.checkOut, setCartContext]);

  const rooms = useMemo(() => detail?.skus ?? [], [detail]);
  /** 房型 id → 车内间数(卡片加减器读它) */
  const picked = useMemo(
    () => Object.fromEntries(cartItems.filter((item) => item.sku).map((item) => [item.sku!.id, item.quantity])),
    [cartItems],
  ) as Record<number, number>;
  /** 角标与购物车页「已选房型(n)」同口径:总间数 */
  const pickedCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  /**
   * 底栏合计与完整模式详情页 / 购物车页同口径:能试算就取 `trip/quote`(日历价 − 长住优惠,不含券),
   * 否则按 Σ 单价 × 间数 × 晚数 预估。
   */
  const nights = nightsBetween(params.checkIn, params.checkOut);
  const estimate = cartItems.reduce((sum, item) => sum + item.price * item.quantity * nights, 0);
  const allReal = cartItems.length > 0 && cartItems.every((item) => item.sku);
  const quoteItems = useMemo(
    () =>
      allReal && params.checkIn && params.checkOut
        ? cartTripItems(params.id, cartItems, params.checkIn, params.checkOut)
        : [],
    [allReal, params.id, cartItems, params.checkIn, params.checkOut],
  );
  const { quote } = useTripQuote(quoteItems, 0, isLogin && quoteItems.length > 0);
  const total = quote?.payAmount ?? estimate;

  /* Hook 必须全部跑完再早退,否则渲染分支之间 Hook 数量不一致 */
  if (loading) return <LoadingView />;
  if (error || !detail) return <ErrorView message={error} onRetry={() => void load()} />;

  const goBooking = (sku: GoodsSku) =>
    navigation.navigate('HotelBookingLite', {
      propertyId: detail.id,
      roomTypeId: sku.id,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
    });

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>
            {t('hotels.lite.detailTitle')}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.policyBtn, pressed && styles.pressed]}
            onPress={() => navigation.navigate('HotelPolicyLite', { id: detail.id })}
            hitSlop={8}
          >
            <HomeIcon name="documentList" size={20} color={colors.primary} />
            <Text style={styles.policyText}>{t('hotels.lite.hotelPolicy')}</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.main, pickedCount > 0 && styles.mainWithBar]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleCard}>
            <Text style={styles.hotelName}>{detail.goods_name}</Text>

            <View style={styles.addressRow}>
              <HomeIcon name="locationOutline" size={16} color={colors.textSoft} />
              <Text style={styles.address}>{detail.address}</Text>
            </View>

            <View style={styles.linkRow}>
              <Pressable
                style={({ pressed }) => [styles.mapLink, pressed && styles.pressed]}
                onPress={comingSoon}
                hitSlop={6}
              >
                <Text style={styles.mapText}>{t('hotels.lite.seeMap')}</Text>
                <HomeIcon name="map" size={20} color={colors.primary} />
              </Pressable>
              <Pressable
                style={({ pressed }) => pressed && styles.pressed}
                onPress={() => navigation.navigate('HotelInfoLite', { id: detail.id })}
                hitSlop={6}
              >
                <Text style={styles.viewDetail}>{t('hotels.lite.viewHotelDetail')}</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.roomsTitle}>{t('hotels.lite.chooseRoom')}</Text>

          <View style={styles.rooms}>
            {rooms.map((sku, index) => (
              <LiteRoomCard
                key={sku.id}
                sku={sku}
                /* 房型没有图时轮流用设计稿临时图兜底(与结果页同一套) */
                coverSource={tempCoverFor(index)}
                /* 设计稿第一张卡挂 Bestseller;接口没有这个标记,按「排序最前」等价处理 */
                badge={index === 0 ? t('hotels.lite.bestseller') : null}
                onSeeRoom={(room) =>
                  navigation.navigate('RoomDetailLite', {
                    goodsId: detail.id,
                    skuId: room.id,
                    checkIn: params.checkIn,
                    checkOut: params.checkOut,
                  })
                }
                /* Choose = 加入选择(置 1 间),之后那枚按钮就地变成加减器 */
                onChoose={(room) => {
                  const entry = realRoomCartEntry(room, index, t);
                  cartToggle({ roomKey: entry.roomKey, price: entry.price, sku: entry.sku, ...entry.extra });
                }}
                quantity={picked[sku.id] ?? 0}
                onChangeQuantity={(room, qty) => cartSetQuantity(`room-${room.id}`, qty)}
              />
            ))}
            {rooms.length === 0 ? (
              <Text style={styles.emptyRooms}>{t('hotels.detail.rooms.empty')}</Text>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/**
       * 多房间合计栏(`2863:7627`),选中任一房型才出现。购物车按钮进 `RoomCart`(两种模式同一页);
       * Continue 进关怀模式订房页,它读同一车按整车 `trip/create` 下单。
       */}
      {pickedCount > 0 ? (
        <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
          <View style={styles.bottomInner}>
            <View>
              <Text style={styles.totalLabel}>{t('hotels.lite.totalPrice')}</Text>
              <Text style={styles.totalValue}>{formatMoney(total, currency)}</Text>
              <Text style={styles.totalDiscount}>
                {t('hotels.detail.discountToday', { percent: DETAIL_DEMO.discountPercent })}
              </Text>
            </View>

            <View style={styles.bottomActions}>
              <Pressable
                style={({ pressed }) => [styles.cartBtn, pressed && styles.pressed]}
                onPress={() => navigation.navigate('RoomCart')}
                hitSlop={6}
              >
                <HomeIcon name="cart" size={32} color={colors.primary} />
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{pickedCount}</Text>
                </View>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.continueBtn, pressed && styles.pressed]}
                onPress={() => {
                  const first = rooms.find((sku) => (picked[sku.id] ?? 0) > 0);
                  if (first) goBooking(first);
                }}
              >
                <Text style={styles.continueText}>{t('hotels.lite.continue')}</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  safe: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },

  /* ---- 顶栏 ---- */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  topTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary,
  },
  policyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  policyText: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.primary },

  main: { paddingHorizontal: PAGE_PADDING, paddingBottom: 16, gap: 24 },
  /* 合计栏是绝对定位的,选了房就给列表留出它的高度 */
  mainWithBar: { paddingBottom: BAR_HEIGHT + 16 },

  /* ---- 标题卡 ---- */
  titleCard: {
    width: '100%',
    padding: 21,
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: '#FFFFFF',
    ...shadows.subtle,
  },
  hotelName: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.heading },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  address: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.inter,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSoft,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  mapText: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  viewDetail: { fontFamily: fonts.outfitSemi, fontSize: 16, lineHeight: 24, color: colors.primary },

  /* ---- 房型区 ---- */
  roomsTitle: { fontFamily: fonts.outfitSemi, fontSize: 24, lineHeight: 24, color: colors.heading },
  rooms: { gap: 16 },
  emptyRooms: {
    paddingVertical: 24,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSoft,
    textAlign: 'center',
  },

  /* ---- 多房间合计栏(设计稿 `2863:7627`) ---- */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 197, 215, 0.3)',
    backgroundColor: '#FFFFFF',
  },
  bottomInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 17,
    paddingBottom: 16,
  },
  totalLabel: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: colors.heading },
  totalValue: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.primary },
  totalDiscount: {
    fontFamily: fonts.interBold,
    fontSize: 10,
    lineHeight: 15,
    color: colors.emergencyFg,
  },

  bottomActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cartBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  cartBadge: {
    position: 'absolute',
    left: 31,
    top: -8,
    minWidth: 24,
    paddingHorizontal: 4,
    borderRadius: 99,
    backgroundColor: colors.primary,
  },
  cartBadgeText: {
    fontFamily: fonts.interBold,
    fontSize: 12,
    lineHeight: 24,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  continueBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  continueText: {
    fontFamily: fonts.interBold,
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
