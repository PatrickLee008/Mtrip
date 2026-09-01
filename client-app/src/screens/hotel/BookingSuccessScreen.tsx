/**
 * 预订成功(Figma M-Trip / `Booking Success` 1675:6714)
 *
 * 设计稿实测:页面底是 `#F8FAFC`(与全站 `--background` 不同,只有这一屏用),Main pt96 px16 gap32
 *   头部    96 圆的绿 10% 底 + 40 的对勾 → 「Booking Confirmed」Inter 700/48 lh56 tracking -.96
 *           → 「Reference ID: MT-2025-123456」Inter 400/18(编号段 600 深色)
 *   凭证卡  `--tab` 底、1px 白描边、圆角 32、padding 25、投影 0/-4 blur20 `rgba(78,115,255,.08)`
 *           里面是 192 见方的白框(1px `#C4C5D7`、圆角 8、padding 9)包着二维码 + 三行文案 + 两枚胶囊
 *   摘要卡  `--tab` 底、1px `--secondary`、圆角 32:表头「Booking Summary」+ 绿色 PAID 徽章,
 *           下面四段 padding 24 的键值,段间一条 1px 线
 *   动作    主色「Download Voucher」+ 1px `#747686` 描边的「View Booking」
 *   引流卡  `rgba(221,225,255,.3)` 底 + 1px `#DDE1FF`、圆角 12,两行居中
 *   吸底    整宽主色「Back to Home」
 *
 * 真实下单后由向导 `navigation.replace` 带参进来(单号 / 酒店 / 房型 / 日期 / 人数 / 实付),
 * 没带参数时(设计稿走查、演示模式)整屏回落到 `bookingDemo.ts` 的数值。
 *
 * 二维码画的是 `order/pay` 返回的**核销码**(`verifyCode`),用 react-native-qrcode-svg 现场生成;
 * 没有核销码时(演示模式、设计稿走查)才回落到设计稿导出的静态二维码图。
 *
 * 仍是静态的:下载凭证 / 查看订单 / 探索玩乐走 comingSoon,「Back to Home」回到底部 Tab 首页。
 */

import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';

import { TEMP_VOUCHER_QR } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import { DEEP_PRIMARY, bookingShared } from '@/components/hotel/booking/bookingShared';
import { formatWeekdayDateYear } from '@/components/hotel/booking/bookingFormat';
import { PAGE_PADDING, colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { BOOKING_DEMO, VOUCHER_TAGS } from '@/screens/hotel/bookingDemo';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import { formatAmount } from '@/utils/format';

/** 只有这一屏用的页面底色(设计稿 1675:6714 的双层线性渐变压平即 #F8FAFC) */
const PAGE_BG = '#F8FAFC';

/** 二维码边长:设计稿的 192 见方白框减去 padding 9 与 1px 描边(192 - 9*2 - 1*2) */
const QR_SIZE = 172;

export default function BookingSuccessScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingSuccess'>>();
  const insets = useSafeAreaInsets();
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
  const address = p.address ?? (p.orderNo ? '' : t(`hotels.results.demo.${BOOKING_DEMO.hotelKey}.address`));
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
      <View style={[styles.statusBar, { height: insets.top }]} />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.main, { paddingBottom: 96 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.checkCircle}>
            <HomeIcon name="checkmarkCircle" size={40} color={colors.statusPaid} />
          </View>
          <Text style={styles.title}>{t('hotels.booking.success.title')}</Text>
          <Text style={styles.reference}>
            {t('hotels.booking.success.referencePrefix')}
            <Text style={styles.referenceId}>{referenceId}</Text>
          </Text>
        </View>

        <View style={styles.voucherCard}>
          <View style={styles.qrFrame}>
            <View style={styles.qrInner}>
              {verifyCode ? (
                <QRCode value={verifyCode} size={QR_SIZE} backgroundColor="#FFFFFF" />
              ) : (
                <Image source={TEMP_VOUCHER_QR} style={styles.qr} resizeMode="cover" />
              )}
            </View>
          </View>
          <View style={styles.voucherText}>
            <Text style={styles.voucherLabel}>{t('hotels.booking.success.voucher')}</Text>
            <Text style={styles.voucherHotel}>{hotelName}</Text>
            {address ? (
              <View style={styles.voucherAddress}>
                <HomeIcon
                  name="locationOutline"
                  width={9.333}
                  height={11.667}
                  color={colors.textSoft}
                />
                <Text style={styles.voucherAddressText}>{address}</Text>
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
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHead}>
            <Text style={styles.summaryTitle}>{t('hotels.booking.success.summary')}</Text>
            <View style={styles.paidBadge}>
              <Text style={styles.paidText}>{t('hotels.booking.success.paid')}</Text>
            </View>
          </View>
          <View style={styles.summaryBody}>
            {rows.map((row, i) => (
              <View key={row.key}>
                {i > 0 ? <View style={styles.summaryDivider} /> : null}
                <View style={styles.summaryRow}>
                  <Text style={bookingShared.overline}>{row.label}</Text>
                  <Text style={[styles.summaryValue, row.accent && styles.summaryValueAccent]}>
                    {row.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.downloadBtn, pressed && bookingShared.pressed]}
            onPress={comingSoon}
          >
            <HomeIcon name="download" size={16} color="#FFFFFF" />
            <Text style={styles.downloadText}>{t('hotels.booking.success.download')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ghostBtn, pressed && bookingShared.pressed]}
            onPress={comingSoon}
          >
            <HomeIcon name="eye" width={22} height={15} color={colors.heading} />
            <Text style={styles.ghostText}>{t('hotels.booking.success.viewBooking')}</Text>
          </Pressable>
        </View>

        {/* 引流卡的文案里要嵌城市名,地址为空时整块不出 */}
        {address ? (
          <View style={styles.upsell}>
            <Text style={styles.upsellText}>
              {t('hotels.booking.success.upsell', {
                city: address.split(',').pop()?.trim(),
              })}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.upsellLink, pressed && bookingShared.pressed]}
              onPress={comingSoon}
            >
              <Text style={styles.upsellLinkText}>{t('hotels.booking.success.upsellLink')}</Text>
              <HomeIcon name="arrowRightLine" size={9.333} color={DEEP_PRIMARY} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
        <Pressable
          style={({ pressed }) => [styles.homeBtn, pressed && bookingShared.pressed]}
          onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
        >
          <Text style={styles.homeText}>{t('hotels.booking.success.backHome')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  flex: { flex: 1 },
  statusBar: { backgroundColor: '#000000' },
  main: { paddingHorizontal: PAGE_PADDING, paddingTop: 96 - 54, gap: 32 },

  header: { alignItems: 'center', gap: 16 },
  checkCircle: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  title: {
    marginTop: 16,
    fontFamily: fonts.interBold,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -0.96,
    textAlign: 'center',
    color: colors.heading,
  },
  reference: {
    fontFamily: fonts.inter,
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
    color: colors.textSoft,
  },
  referenceId: { fontFamily: fonts.interSemi, color: colors.heading },

  voucherCard: {
    alignItems: 'center',
    gap: 24,
    padding: 25,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: colors.surface,
    shadowColor: '#4E73FF',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 3,
  },
  qrFrame: {
    width: 192,
    height: 192,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: '#FFFFFF',
  },
  qrInner: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    overflow: 'hidden',
    /* 静态图是满铺的,现场生成的二维码是 172 见方居中,底色跟着白框走才不会露出蓝边 */
    backgroundColor: '#FFFFFF',
  },
  qr: { width: '100%', height: '100%' },
  voucherText: { alignItems: 'center', gap: 8 },
  voucherLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textAlign: 'center',
    color: colors.primary,
  },
  voucherHotel: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
    color: colors.heading,
  },
  voucherAddress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  voucherAddressText: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
  },
  tagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 16 },
  tag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  tagText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textAlign: 'center',
    color: colors.heading,
  },

  summaryCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 25,
    borderBottomWidth: 1,
    borderBottomColor: colors.tintBg,
  },
  summaryTitle: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.heading },
  paidBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  paidText: {
    fontFamily: fonts.interBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.statusPaid,
  },
  summaryBody: { paddingHorizontal: 24 },
  summaryDivider: { height: 1, backgroundColor: colors.tintBg },
  summaryRow: { gap: 4, padding: 24 },
  summaryValue: { fontFamily: fonts.interSemi, fontSize: 18, lineHeight: 28, color: colors.heading },
  summaryValueAccent: { fontFamily: fonts.interBold, color: colors.primary },

  actions: { gap: 16 },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  downloadText: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 17,
    paddingVertical: 13,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.label,
  },
  ghostText: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.heading,
  },

  upsell: {
    alignItems: 'center',
    gap: 7.5,
    padding: 25,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: '#DDE1FF',
    backgroundColor: 'rgba(221, 225, 255, 0.3)',
  },
  upsellText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: '#0037B9',
  },
  upsellLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  upsellLinkText: {
    fontFamily: fonts.interBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: DEEP_PRIMARY,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 32,
    paddingTop: 16,
    backgroundColor: colors.surface,
  },
  homeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  homeText: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
