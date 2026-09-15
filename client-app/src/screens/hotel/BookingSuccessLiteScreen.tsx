/**
 * 关怀模式预订成功(Figma `Booking Flow` `759:9777` 的 Booking Success `224:3826`)
 *
 * 与完整模式 `BookingSuccessScreen` **同一份数据**:真实下单后由 Lite 向导 `navigation.replace`
 * 带参进来(单号 / 酒店 / 地址 / 日期 / 人数 / 实付),没带参数时(演示模式、设计稿走查)
 * 整屏回落到 `bookingDemo.ts` 的数值。二维码画的是 `order/pay` 返回的**核销码**,
 * 用 react-native-qrcode-svg 现场生成;没有核销码时才回落到设计稿导出的静态二维码图。
 *
 * 排版按关怀模式换算规则放大一档,并去掉完整版末尾那张「探索当地玩乐」引流卡 ——
 * 它是一条 comingSoon 的死链,关怀版不留(下载凭证 / 查看订单两枚按钮照旧,
 * 与完整模式同为 comingSoon,接通时两页一起改)。
 */

import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';

import { TEMP_VOUCHER_QR } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import { formatWeekdayDateYear } from '@/components/hotel/booking/bookingFormat';
import { liteBooking } from '@/components/hotel/booking/lite/liteBookingShared';
import { PAGE_PADDING, colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { BOOKING_DEMO, VOUCHER_TAGS } from '@/screens/hotel/bookingDemo';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import { formatAmount } from '@/utils/format';

/** 成功页专用底色(与完整版同一值:设计稿的双层线性渐变压平即 #F8FAFC) */
const PAGE_BG = '#F8FAFC';

/** 二维码边长:关怀版把白框放大到 224,减去 padding 12 与 1px 描边 */
const QR_SIZE = 198;

export default function BookingSuccessLiteScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingSuccessLite'>>();
  const currency = useSiteStore((s) => s.currency);
  const showToast = useCommonStore((s) => s.showToast);
  const comingSoon = () => showToast(t('home.comingSoon'));

  /* 真实下单带参进来,缺参就回落到演示数值 */
  const p = route.params ?? {};
  const referenceId = p.orderNo ?? BOOKING_DEMO.referenceId;
  /** 核销码 —— 有就现场画二维码,没有(演示模式)才用设计稿的静态图 */
  const verifyCode = p.verifyCode ?? '';
  const hotelName = p.hotelName ?? t(`hotels.results.demo.${BOOKING_DEMO.hotelKey}.name`);
  /**
   * 地址只在演示模式回落到设计稿的 Bagan 地址;真实订单没有地址就留空并隐藏那一行,
   * 否则会给一家真实酒店挂上一条完全不相干的地址(后台目前允许 address 为空)。
   */
  const address =
    p.address ?? (p.orderNo ? '' : t(`hotels.results.demo.${BOOKING_DEMO.hotelKey}.address`));
  const checkIn = p.checkIn ?? BOOKING_DEMO.checkIn;
  const checkOut = p.checkOut ?? BOOKING_DEMO.checkOut;
  const adults = p.adults ?? BOOKING_DEMO.adults;
  const rooms = p.rooms ?? BOOKING_DEMO.rooms;
  const paidTotal = p.paidTotal ?? BOOKING_DEMO.paidTotal;

  const rows = [
    {
      key: 'checkIn',
      label: t('hotels.booking.success.checkIn'),
      value: formatWeekdayDateYear(checkIn, i18n.language),
    },
    {
      key: 'checkOut',
      label: t('hotels.booking.success.checkOut'),
      value: formatWeekdayDateYear(checkOut, i18n.language),
    },
    {
      key: 'guests',
      label: t('hotels.booking.success.guests'),
      value: t('hotels.booking.success.guestsValue', { adults, rooms }),
    },
    {
      key: 'paid',
      label: t('hotels.booking.success.totalPaid'),
      value: `${formatAmount(paidTotal, currency)} ${currency}`,
      accent: true,
    },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView style={liteBooking.flex} edges={['top']}>
        <ScrollView
          style={liteBooking.flex}
          contentContainerStyle={styles.main}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.checkCircle}>
              <HomeIcon name="checkmarkCircle" size={56} color={colors.statusPaid} />
            </View>
            <Text style={styles.title}>{t('hotels.booking.success.title')}</Text>
            <Text style={styles.reference}>
              {t('hotels.booking.success.referencePrefix')}
              <Text style={styles.referenceId}>{referenceId}</Text>
            </Text>
          </View>

          <View style={styles.voucherCard}>
            <View style={styles.qrFrame}>
              {verifyCode ? (
                <QRCode value={verifyCode} size={QR_SIZE} backgroundColor="#FFFFFF" />
              ) : (
                <Image source={TEMP_VOUCHER_QR} style={styles.qr} resizeMode="cover" />
              )}
            </View>
            <Text style={liteBooking.overline}>{t('hotels.booking.success.voucher')}</Text>
            <Text style={styles.voucherHotel}>{hotelName}</Text>
            {address ? (
              <View style={styles.addressRow}>
                <HomeIcon name="locationOutline" width={14} height={18} color={colors.textSoft} />
                <Text style={[liteBooking.note, liteBooking.flexCol]}>{address}</Text>
              </View>
            ) : null}
            <View style={styles.tagRow}>
              {VOUCHER_TAGS.map((tag) => (
                <View key={tag.key} style={[styles.tag, { backgroundColor: tag.bg }]}>
                  <Text style={styles.tagText}>{t(`hotels.booking.success.tags.${tag.key}`)}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={liteBooking.card}>
            <View style={liteBooking.rowBetween}>
              <Text style={[liteBooking.cardTitle, liteBooking.flexCol]}>
                {t('hotels.booking.success.summary')}
              </Text>
              <View style={styles.paidBadge}>
                <Text style={styles.paidText}>{t('hotels.booking.success.paid')}</Text>
              </View>
            </View>
            {rows.map((row, i) => (
              <View key={row.key} style={styles.summaryRow}>
                {i > 0 ? <View style={styles.summaryDivider} /> : null}
                <Text style={liteBooking.overline}>{row.label}</Text>
                <Text style={[styles.summaryValue, row.accent && styles.summaryValueAccent]}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [liteBooking.primaryBtn, pressed && liteBooking.pressed]}
              onPress={comingSoon}
            >
              <HomeIcon name="download" size={22} color="#FFFFFF" />
              <Text style={liteBooking.primaryBtnText}>
                {t('hotels.booking.success.download')}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.ghostBtn, pressed && liteBooking.pressed]}
              onPress={comingSoon}
            >
              <HomeIcon name="eye" width={28} height={19} color={colors.heading} />
              <Text style={styles.ghostText}>{t('hotels.booking.success.viewBooking')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        <Pressable
          style={({ pressed }) => [styles.homeBtn, pressed && liteBooking.pressed]}
          onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
        >
          <Text style={liteBooking.primaryBtnText}>{t('hotels.booking.success.backHome')}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  main: { paddingHorizontal: PAGE_PADDING, paddingTop: 32, paddingBottom: 140, gap: 32 },

  header: { alignItems: 'center', gap: 16 },
  checkCircle: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  title: {
    fontFamily: fonts.interBold,
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -0.88,
    textAlign: 'center',
    color: colors.heading,
  },
  reference: { fontFamily: fonts.inter, fontSize: 20, lineHeight: 28, color: colors.textSoft },
  referenceId: { fontFamily: fonts.interSemi, color: colors.heading },

  voucherCard: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: colors.surface,
    shadowColor: 'rgba(78, 115, 255, 0.08)',
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 3,
  },
  qrFrame: {
    width: 224,
    height: 224,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: '#FFFFFF',
  },
  qr: { width: QR_SIZE, height: QR_SIZE },
  voucherHotel: {
    fontFamily: fonts.interSemi,
    fontSize: 26,
    lineHeight: 34,
    textAlign: 'center',
    color: colors.heading,
  },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  tag: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  tagText: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 20, color: colors.heading },

  paidBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.statusPaid,
  },
  paidText: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 20, color: '#FFFFFF' },
  summaryRow: { gap: 4 },
  summaryDivider: {
    height: 1,
    marginBottom: 16,
    backgroundColor: 'rgba(196, 197, 215, 0.3)',
  },
  summaryValue: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.heading },
  summaryValueAccent: { fontFamily: fonts.interBold, color: colors.primary },

  actions: { gap: 16 },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.label,
  },
  ghostText: { fontFamily: fonts.outfit, fontSize: 24, lineHeight: 32, color: colors.heading },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface },
  homeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
});
