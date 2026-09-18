/**
 * 关怀模式预订结果页(Figma `2540:19863` Booking Confirmed! / `2540:19741` Booking Confirming)
 *
 * 一屏两态,由路由参数 `status` 决定:
 *   `confirmed`  绿勾 + PAID / CONFIRMED    + 底部 Save E-receipt / View Booking
 *   `confirming` 橙钟 + PAID / CONFIRMING   + 底部只有一枚 View Booking
 *
 * ⚠️ **`confirming` 目前产生不了,不是漏接**:后端 `ORDER_STATUS` 只有
 * 0待支付 / 1已支付 / 2已核销……,**没有「等酒店确认」这一档**,`order/pay` 成功即已支付、
 * 库存已锁。两态都实现好放在这里,等后端补上该状态时,只需让 `useBookingWizard.goSuccess`
 * 传 `status: 'confirming'` 即可,页面不用再动。
 *
 * **与上一版的差别**:上一版(推导自 `224:3826`)是一张二维码核销凭证页。新稿没有二维码 ——
 * 核销码并没有丢,它在订单详情页(`OrderDetailScreen` 的 `VerifyCodeView`)里,
 * 所以「View Booking」跳 `OrderDetail` 就够了。没有订单号(演示模式)时该按钮退回订单列表。
 *
 * 设计稿实测:
 *   Main     `2540:19865` padding 16 / gap 32
 *   结果卡   `2540:19874` --tab 底 1px --secondary 圆角 24 padding 25 投影 DS_AG;内容 gap24
 *     图标底  96 宽、py24、圆形,底色 = 状态色 10%;图标 40
 *     标题    Inter 700 24/32 tracking -0.96 --text 居中
 *     说明    Inter 500 16/24 --text-2 居中
 *     状态行  py4 两端对齐:32 圆形主色底 + 20 图标 / 文案 Inter 500 16/20 --text-2;
 *             右侧药丸 px12 py4 圆角 999,12 图标 + 12/16 白色大写 tracking .24
 *     分隔线  1px --secondary
 *     单号行  「Booking ID: 」Inter 400 16/28 --text-2 +单号 Inter 600 --text;右 20 复制图标
 *   详情区   `2540:19929` gap8:标题 Inter 600 20/16;卡 --tab 底 1px --secondary 圆角 24 p25 gap16
 *             96 缩略图圆角 12.8 + 酒店名 Inter 400 18/22.5 + 日期行(10.5×11.667 图标 + Inter 500 14/20)
 */

import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';

import { tempCoverFor } from '@/assets/tempImages';
import HomeIcon, { type HomeIconName } from '@/components/home/HomeIcon';
import { formatMonthDayYear } from '@/components/hotel/booking/bookingFormat';
import { liteBooking } from '@/components/hotel/booking/lite/liteBookingShared';
import { PAGE_PADDING, colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { BOOKING_DEMO } from '@/screens/hotel/bookingDemo';
import { useCommonStore } from '@/store/commonStore';

export default function BookingSuccessLiteScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingSuccessLite'>>();
  const showToast = useCommonStore((s) => s.showToast);

  /* 真实下单带参进来,缺参就回落到演示数值 */
  const p = route.params ?? {};
  const confirmed = (p.status ?? 'confirmed') === 'confirmed';
  const bookingId = p.orderNo ?? BOOKING_DEMO.referenceId;
  const hotelName = p.hotelName ?? t(`hotels.results.demo.${BOOKING_DEMO.hotelKey}.name`);
  const checkIn = p.checkIn ?? BOOKING_DEMO.checkIn;
  const checkOut = p.checkOut ?? BOOKING_DEMO.checkOut;

  const tone = confirmed ? colors.statusPaid : colors.orange;

  const copyId = () => {
    void Clipboard.setStringAsync(bookingId);
    showToast(t('hotels.booking.lite.idCopied'));
  };

  /** 核销二维码在订单详情页;没有订单号(演示模式)就退回订单列表 */
  const viewBooking = () =>
    p.orderId ? navigation.navigate('OrderDetail', { orderId: p.orderId }) : navigation.navigate('OrderList');

  return (
    <View style={styles.root}>
      <SafeAreaView style={liteBooking.flex} edges={['top']}>
        <ScrollView
          style={liteBooking.flex}
          contentContainerStyle={styles.main}
          showsVerticalScrollIndicator={false}
        >
          {/* -------------------------------------------------------- 结果卡 */}
          <View style={styles.resultCard}>
            <View style={styles.header}>
              <View style={[styles.iconWrap, { backgroundColor: `${tone}1A` }]}>
                <HomeIcon name={confirmed ? 'checkmarkCircle' : 'clock'} size={40} color={tone} />
              </View>
              <Text style={styles.title}>
                {t(
                  confirmed
                    ? 'hotels.booking.lite.success.confirmedTitle'
                    : 'hotels.booking.lite.success.confirmingTitle',
                )}
              </Text>
              <Text style={styles.desc}>
                {t(
                  confirmed
                    ? 'hotels.booking.lite.success.confirmedDesc'
                    : 'hotels.booking.lite.success.confirmingDesc',
                )}
              </Text>
            </View>

            <View style={styles.statusCard}>
              <StatusRow
                icon="wallet"
                label={t('hotels.booking.lite.success.paymentStatus')}
                badge={t('hotels.booking.lite.success.paid')}
                badgeIcon="checkmarkCircle"
                badgeColor={colors.statusPaid}
              />
              <View style={styles.statusDivider} />
              <StatusRow
                icon="calendar"
                label={t('hotels.booking.lite.success.bookingStatus')}
                badge={t(
                  confirmed
                    ? 'hotels.booking.lite.success.confirmed'
                    : 'hotels.booking.lite.success.confirming',
                )}
                badgeIcon={confirmed ? 'checkmarkCircle' : 'clock'}
                badgeColor={tone}
              />
            </View>

            <View style={liteBooking.rowBetween}>
              <Text style={styles.idLabel} numberOfLines={1}>
                {t('hotels.booking.lite.success.bookingId')}
                <Text style={styles.idValue}>{bookingId}</Text>
              </Text>
              <Pressable onPress={copyId} hitSlop={8}>
                {({ pressed }) => (
                  <View style={pressed ? liteBooking.pressed : undefined}>
                    <HomeIcon name="copy" size={20} color={colors.textSoft} />
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {/* ------------------------------------------------------ 预订详情 */}
          <View style={styles.detailGroup}>
            <Text style={styles.detailHead}>{t('hotels.booking.lite.success.bookingDetails')}</Text>
            <View style={styles.detailCard}>
              <Image source={tempCoverFor(0)} style={styles.thumb} resizeMode="cover" />
              <View style={liteBooking.flexCol}>
                <Text style={styles.hotelName} numberOfLines={2}>
                  {hotelName}
                </Text>
                <View style={styles.dateRow}>
                  <HomeIcon name="calendarOutline" width={10.5} height={11.667} color={colors.textSoft} />
                  <Text style={styles.dateText} numberOfLines={1}>
                    {t('hotels.booking.lite.success.dateRange', {
                      checkIn: formatMonthDayYear(checkIn, i18n.language),
                      checkOut: formatMonthDayYear(checkOut, i18n.language),
                    })}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <SafeAreaView style={styles.bar} edges={['bottom']}>
        <View style={styles.barInner}>
          {/* 待确认态设计稿只有一枚整宽 View Booking */}
          {confirmed ? (
            <Pressable
              style={({ pressed }) => [styles.ghostBtn, pressed && liteBooking.pressed]}
              onPress={() => showToast(t('home.comingSoon'))}
            >
              <HomeIcon name="download" size={20} color={colors.primary} />
              <Text style={styles.ghostText}>{t('hotels.booking.lite.success.saveEreceipt')}</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && liteBooking.pressed]}
            onPress={viewBooking}
          >
            <Text style={styles.primaryText}>{t('hotels.booking.success.viewBooking')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** 「Payment Status」/「Booking Status」一行:左圆形图标 + 文案,右状态药丸 */
function StatusRow({
  icon,
  label,
  badge,
  badgeIcon,
  badgeColor,
}: {
  icon: HomeIconName;
  label: string;
  badge: string;
  badgeIcon: HomeIconName;
  badgeColor: string;
}) {
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusLeft}>
        <View style={styles.statusIcon}>
          <HomeIcon name={icon} size={20} color="#FFFFFF" />
        </View>
        <Text style={styles.statusLabel}>{label}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <HomeIcon name={badgeIcon} size={12} color="#FFFFFF" />
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  main: { paddingHorizontal: PAGE_PADDING, paddingTop: 16, paddingBottom: 120, gap: 32 },

  /* ---- 结果卡 ---- */
  resultCard: {
    width: '100%',
    padding: 25,
    gap: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    shadowColor: '#0F294D',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  header: { alignItems: 'center', gap: 16 },
  iconWrap: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 999,
  },
  title: {
    width: '100%',
    fontFamily: fonts.interBold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.96,
    textAlign: 'center',
    color: colors.heading,
  },
  desc: {
    width: '100%',
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
  },

  statusCard: { width: '100%', gap: 12 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  statusLabel: { fontFamily: fonts.interMedium, fontSize: 16, lineHeight: 20, color: colors.textSoft },
  statusDivider: { height: 1, backgroundColor: colors.softBlue },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.24,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },

  idLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 28,
    color: colors.textSoft,
  },
  idValue: { fontFamily: fonts.interSemi, color: colors.heading },

  /* ---- 预订详情 ---- */
  detailGroup: { gap: 8 },
  detailHead: {
    paddingHorizontal: 4,
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 24,
    color: colors.heading,
  },
  detailCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    shadowColor: '#0F294D',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  thumb: { width: 96, height: 96, borderRadius: 12.8 },
  hotelName: { fontFamily: fonts.inter, fontSize: 18, lineHeight: 22.5, color: colors.heading },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 },
  dateText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  /* ---- 吸底栏 ---- */
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  ghostBtn: {
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
  ghostText: {
    fontFamily: fonts.interMedium,
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  primaryBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  primaryText: {
    fontFamily: fonts.interMedium,
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
