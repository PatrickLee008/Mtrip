/**
 * Trip 里单段住宿的复核页(Figma M-Trip / `Booking Final Hotel Review` 1675:9677,页头「Hotel Detail」)
 *
 * 页壳复用 `MorePageLayout`;内容 = 「Stay n / Change」行 + 酒店标题卡 + `ReviewBody`(与 Step 3 共用),
 * 底部是 Back / Check Out 两枚按钮(与向导吸底栏同款,交给 layout 的 footer 插槽)。
 *
 * **静态页**:数值来自 `bookingDemo.ts`;Change 与 Check Out 走 comingSoon(真正的结算在向导里)。
 * 路由参数 `index` 只用来决定标题里的「Stay n」,第二段住宿的数值取 `BOOKING_SECOND_STAY`。
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
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
  type BookingStay,
} from '@/screens/hotel/bookingDemo';
import { useCommonStore } from '@/store/commonStore';

function toStay(index: number): BookingStay {
  const source = index > 0 ? BOOKING_SECOND_STAY : BOOKING_DEMO;
  return {
    key: `stay${index + 1}`,
    hotelKey: source.hotelKey,
    roomKey: source.roomKey,
    checkIn: source.checkIn,
    checkOut: source.checkOut,
    adults: source.adults,
    childCount: source.children,
    rooms: source.rooms,
    /* 设计稿这张稿画了 Airport Transfer 胶囊 */
    addons: ['transfer'],
    originalPrice: source.originalPrice,
    roomPrice: source.roomPrice,
    taxPercent: source.taxPercent,
    taxes: source.taxes,
    total: source.total,
    points: source.points,
  };
}

export default function StayDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'StayDetail'>>();
  const showToast = useCommonStore((s) => s.showToast);
  const comingSoon = () => showToast(t('home.comingSoon'));

  const index = route.params?.index ?? 0;
  const stay = toStay(index);
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
            onPress={comingSoon}
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
          onPress={comingSoon}
          hitSlop={8}
        >
          <Text style={styles.stayLabel}>{t('hotels.booking.trip.change')}</Text>
          <HomeIcon name="edit" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.titleCard}>
        <Text style={styles.hotelName}>{t(`hotels.results.demo.${stay.hotelKey}.name`)}</Text>
        <View style={styles.addressRow}>
          <HomeIcon name="locationOutline" width={12} height={15} color={colors.textSoft} />
          <Text style={styles.address}>{t(`hotels.results.demo.${stay.hotelKey}.address`)}</Text>
        </View>
      </View>

      <ReviewBody
        stay={stay}
        agreed={agreed}
        onToggleAgree={() => setAgreed((v) => !v)}
        onComingSoon={comingSoon}
      />
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
