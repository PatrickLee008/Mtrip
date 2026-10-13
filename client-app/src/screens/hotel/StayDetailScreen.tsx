/**
 * Trip 里单段住宿的复核页(Figma M-Trip / `Booking Final Hotel Review` 1675:9677,页头「Hotel Detail」)
 *
 * 页壳复用 `MorePageLayout`;内容 = 「Stay n / Change」行 + 酒店标题卡 + `ReviewBody`(与 Step 3 共用),
 * 底部是 Back / Check Out 两枚按钮(与向导吸底栏同款,交给 layout 的 footer 插槽)。
 *
 * **真实行程**:`index` 指向多酒店行程里的第 n 段住宿(`combineTripStays`:已加入的 + 车里正在挑的),
 * 酒店名 / 房型 / 日期取自那段住宿,地址与退改规则按物业拉 `/hotels/detail`,
 * 房费与长住优惠按这一段单独 `trip/quote` 试算。「Change」:正在挑的那一家回购物车改房,已加入的暂不支持;
 * 「Check Out」回向导(真正的结算在向导第 2 / 3 步)。
 * **演示兜底**:没有这段住宿(演示模式)时仍是设计稿数值(`bookingDemo.ts`)。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import ReviewBody from '@/components/hotel/booking/ReviewBody';
import { bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import {
  BOOKING_DEMO,
  BOOKING_SECOND_STAY,
  scaleStay,
  type BookingStay,
} from '@/screens/hotel/bookingDemo';
import { fetchHotelDetail } from '@/api/goods';
import { cartTripItems, useTripQuote } from '@/screens/hotel/useTripQuote';
import { useCommonStore } from '@/store/commonStore';
import { combineTripStays, nightsBetween, useRoomCartStore } from '@/store/roomCartStore';
import { useUserStore } from '@/store/userStore';
import type { RefundRule } from '@/types/models';

function toStay(index: number): BookingStay {
  const source = index > 0 ? BOOKING_SECOND_STAY : BOOKING_DEMO;
  return scaleStay({
    key: `stay${index + 1}`,
    /* 这一屏只服务演示数据(多住宿只在演示模式下存在) */
    demo: true,
    hotelKey: source.hotelKey,
    roomKey: source.roomKey,
    checkIn: source.checkIn,
    checkOut: source.checkOut,
    adults: source.adults,
    childCount: source.children,
    rooms: source.rooms,
    /* 设计稿这张稿画了 Airport Transfer 胶囊 */
    addons: ['transfer'],
    /* 设计稿金额是「1 晚 1 间」的基数,由 scaleStay 按实际晚数摊开(第二段住宿是 2 晚) */
    units: {
      originalPrice: source.originalPrice,
      roomPrice: source.roomPrice,
      taxes: source.taxes,
      total: source.total,
      points: source.points,
    },
    taxPercent: source.taxPercent,
    originalPrice: 0,
    roomPrice: 0,
    taxes: 0,
    total: 0,
    points: 0,
  });
}

export default function StayDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'StayDetail'>>();
  const showToast = useCommonStore((s) => s.showToast);
  const comingSoon = () => showToast(t('home.comingSoon'));

  const index = route.params?.index ?? 0;
  const isLogin = useUserStore((s) => s.isLogin);

  /* 分别订阅再组合:combineTripStays 每次返回新数组,不能直接当 zustand selector */
  const tripStays = useRoomCartStore((s) => s.tripStays);
  const cartItems = useRoomCartStore((s) => s.items);
  const cartPropertyId = useRoomCartStore((s) => s.propertyId);
  const cartHotelName = useRoomCartStore((s) => s.hotelName);
  const cartCheckIn = useRoomCartStore((s) => s.checkIn);
  const cartCheckOut = useRoomCartStore((s) => s.checkOut);
  const tripStay = useMemo(
    () =>
      combineTripStays({
        tripStays,
        propertyId: cartPropertyId,
        hotelName: cartHotelName,
        checkIn: cartCheckIn,
        checkOut: cartCheckOut,
        items: cartItems,
      })[index] ?? null,
    [tripStays, cartPropertyId, cartHotelName, cartCheckIn, cartCheckOut, cartItems, index],
  );

  /* 地址与退改规则按物业拉一次 */
  const [address, setAddress] = useState('');
  const [refundRules, setRefundRules] = useState<RefundRule[]>([]);
  const propertyId = tripStay?.propertyId;
  useEffect(() => {
    if (!propertyId) return;
    let alive = true;
    void fetchHotelDetail(propertyId)
      .then((detail) => {
        if (!alive) return;
        setAddress(detail.address ?? '');
        setRefundRules(detail.refundRules ?? []);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [propertyId]);

  /* 这一段单独试算(日历价 / 长住优惠),没有试算时按 单价 × 间数 × 晚数 预估 */
  const quoteItems = useMemo(
    () =>
      tripStay
        ? cartTripItems(tripStay.propertyId, tripStay.items, tripStay.checkIn, tripStay.checkOut)
        : [],
    [tripStay],
  );
  const { itemsQuote } = useTripQuote(quoteItems, 0, isLogin && quoteItems.length > 0);
  const estimate = tripStay
    ? tripStay.items.reduce(
        (sum, room) => sum + room.price * room.quantity * nightsBetween(tripStay.checkIn, tripStay.checkOut),
        0,
      )
    : 0;

  /** ReviewBody 要的住宿形状:真实行程按这一段的日期与间数拼,人数沿用向导口径(首个房型的可住人数) */
  const stay: BookingStay = tripStay
    ? {
        ...toStay(0),
        key: tripStay.key,
        demo: false,
        hotelName: tripStay.hotelName,
        checkIn: tripStay.checkIn,
        checkOut: tripStay.checkOut,
        adults: Math.max(1, Number(tripStay.items[0]?.sku?.max_guests) || 2),
        childCount: 0,
        rooms: tripStay.items.reduce((sum, room) => sum + room.quantity, 0),
        addons: [],
        points: 0,
      }
    : toStay(index);
  const [agreed, setAgreed] = useState(false);

  return (
    <MorePageLayout
      title={t('hotels.booking.trip.stayDetailTitle')}
      footer={
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && bookingShared.pressed]}
            onPress={() => navigation.goBack()}
          >
            <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
            <Text style={styles.backText}>{t('hotels.booking.back')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.checkoutBtn, pressed && bookingShared.pressed]}
            onPress={tripStay ? () => navigation.goBack() : comingSoon}
          >
            <Text style={styles.checkoutText}>{t('hotels.booking.checkOut')}</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.stayRow}>
        <Text style={styles.stayLabel}>
          {t('hotels.booking.trip.stay', { index: index + 1 })}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.changeBtn, pressed && bookingShared.pressed]}
          /* 正在挑的那一家回购物车改房;已加入行程的住宿暂不支持改(车只装一家) */
          onPress={tripStay?.key === 'active' ? () => navigation.navigate('RoomCart') : comingSoon}
          hitSlop={8}
        >
          <Text style={styles.stayLabel}>{t('hotels.booking.trip.change')}</Text>
          <HomeIcon name="edit" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.titleCard}>
        <Text style={styles.hotelName}>
          {tripStay ? tripStay.hotelName : t(`hotels.results.demo.${stay.hotelKey}.name`)}
        </Text>
        {tripStay && !address ? null : (
          <View style={styles.addressRow}>
            <HomeIcon name="locationOutline" width={12} height={15} color={colors.textSoft} />
            <Text style={styles.address}>
              {tripStay ? address : t(`hotels.results.demo.${stay.hotelKey}.address`)}
            </Text>
          </View>
        )}
      </View>

      {tripStay ? (
        /* 真实行程:这一段的房型走 Selected Rooms(可能不止一种房型),房费 / 长住优惠按这一段试算 */
        <ReviewBody
          stay={stay}
          cartRooms={tripStay.items}
          roomTotal={itemsQuote?.original ?? estimate}
          longstayDiscount={itemsQuote?.longstayDiscount ?? 0}
          refundRules={refundRules}
          onEditRooms={tripStay.key === 'active' ? () => navigation.navigate('RoomCart') : comingSoon}
          onComingSoon={comingSoon}
        />
      ) : (
        /* 演示:单段住宿,不传 cartRooms,ReviewBody 走原来的单房型版式 */
        <ReviewBody stay={stay} onComingSoon={comingSoon} />
      )}
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  stayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stayLabel: { fontFamily: fonts.interSemi, fontSize: 16, color: colors.primary },
  changeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  titleCard: {
    padding: 21,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.card,
    ...shadows.subtle,
  },
  hotelName: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.heading },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  address: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  /**
   * 与向导吸底栏同款(`--tab` 底 / py16 / 内容 px24 / gap20)。
   * `MorePageLayout` 的 footer 插槽自带 px16 / pt12 / pb20 的页面底色内边距,用负 margin 抵消。
   */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginHorizontal: -16,
    marginTop: -12,
    marginBottom: -20,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.surface,
  },
  backBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  backText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  checkoutBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  checkoutText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
