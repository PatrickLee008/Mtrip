/**
 * 取消成功(Figma `1205:2679` Cancel Booking4)
 *
 * **一页两用**:
 *   用户自己取消(`1205:2679`)—— 勾圆 +「Booking Cancelled」;
 *   **商户取消**(`1685:3429`)—— 顶栏「Booking Cancel Details」、标题「Booking Cancelled by Merchant」,
 *     并多一张黄色 **Cancel Reason** 卡(写明商户给的原因)。
 * 两者其余部分完全相同(预订摘要 + CONFIRMED REFUND + 两枚按钮),所以是一页两态不是两页。
 *
 * 数据有两条路:
 *   取消流程走完 → 上一步把退款单号/金额/酒店名/日期直接带过来,**不再请求**;
 *   从「我的预订」的已取消单点进来 → 只有 `orderId`,自己拉一次 `order/detail`。
 *     后端在已取消/退款的单上会附一段 `cancelInfo`:
 *       `operatorType`(0系统 1住客 **2商户** 3平台,取自 `order_booking_event` 最后一条 cancelled 事件)
 *       + `refundNo` / `refundAmount`(取自 `order_refund`)。
 *     **谁取消的只记在事件表里**,`order_main` 上没有这个字段 —— 所以是后端查一次给前端,而不是前端猜。
 *
 * 设计稿实测:
 *   页面   `--background` 底;顶栏同取消页(← +「Cancel Booking」);Main pt16 px16 gap24
 *   结果头 64 圆(主色 10% 底)+ 32 勾 → 标题 Inter 700 24/32 居中 → 说明 Inter 400/16 `--text-2` 居中
 *   摘要   标题 Inter 600/20 +(共用)`BookingSummaryCard`
 *   退款卡 `--tab` 1px `--secondary` 圆角 24 p25 gap12:
 *          小标题「CONFIRMED REFUND」Inter 600/12 tracking .6 `--text-2` 大写
 *          → Refund Amount 行(左 Inter 400/18、右货币 + 数字 700/20 主色)
 *          → 「Refund Initiated」Inter 600/14 主色(前置 16 图标)
 *          → 退款单号 Inter 400/16 `#0B1C30`
 *          → 「Estimated Timeline」(16 图标 + Inter 600/14)+ 说明 Inter 400/16
 *   按钮   主色整宽「Back to My Booking」/ 1px 主色描边「Start New Booking」
 *
 * ⚠️ 稿面在两枚按钮上方还有一张「VOYAGE ELITE / We hope to host you soon.」的营销图卡 ——
 *   那是**运营位**,后端没有对应的数据源(既不是商品也不是 banner 接口的位次),
 *   凭空放一张写死的图会变成假内容,所以**本轮不渲染**;接了运营位再补。
 * ⚠️ 退款到账时效文案与取消页同一条(PRD line 865 是 3-7 个工作日,稿面写 3-5)——
 *   这里**以稿面为准**,两页用同一个 i18n 键,免得两处对不上。
 */

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchOrderDetail } from '@/api/order';
import { tempCoverFor } from '@/assets/tempImages';
import { LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import BookingSummaryCard from '@/components/order/BookingSummaryCard';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useSiteStore } from '@/store/siteStore';
import type { OrderDetail } from '@/types/models';
import { formatDate, formatMoney } from '@/utils/format';

export default function BookingCancelledScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingCancelled'>>();
  const insets = useSafeAreaInsets();
  const currency = useSiteStore((s) => s.currency);

  const p = route.params;
  /* 带参进来就直接用;只给 orderId(从已取消列表进来)时自己拉一次 */
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(!p.refundNo);

  useEffect(() => {
    if (p.refundNo) return;
    let alive = true;
    void fetchOrderDetail(p.orderId)
      .then((d) => {
        if (alive) setDetail(d);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [p.orderId, p.refundNo]);

  const refundNo = p.refundNo || detail?.cancelInfo?.refundNo || '';
  const refundAmount = (p.refundNo ? p.refundAmount : detail?.cancelInfo?.refundAmount) ?? 0;
  const hotelName = p.hotelName ?? detail?.goods_name;
  const dateRange =
    p.dateRange ??
    (detail?.use_date
      ? `${formatDate(detail.use_date)}${detail.end_date ? ` - ${formatDate(detail.end_date)}` : ''}`
      : undefined);
  /** 商户取消:`operator_type = 2`(BookingConst::OPERATOR_MERCHANT) */
  const byMerchant = (p.by ?? (detail?.cancelInfo?.operatorType === 2 ? 'merchant' : 'guest')) === 'merchant';
  const cancelReason = detail?.cancel_reason ?? '';

  /**
   * 「Back to My Booking」回「我的预订」——用 `reset` 不是 `navigate`:
   * 取消流程已经走完,栈里那几屏(详情 → 取消 → 结果)不该还能退回去
   * (与预订成功页同一处理,那边踩过「卡在两屏之间」的坑)。
   */
  const backToBookings = () =>
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'MyPickTab' } }] });
  const startNewBooking = () =>
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'HomeTab' } }] });

  if (loading) return <LoadingView />;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.main,
          { paddingTop: insets.top + 80, paddingBottom: 32 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.iconWrap, byMerchant && styles.iconWrapMerchant]}>
            <HomeIcon
              name={byMerchant ? 'dismissCircle' : 'checkmarkCircle'}
              size={32}
              color={byMerchant ? colors.hot : colors.primary}
            />
          </View>
          <Text style={styles.title}>
            {t(byMerchant ? 'order.cancelled.merchantTitle' : 'order.cancelled.title')}
          </Text>
          <Text style={styles.desc}>
            {t(byMerchant ? 'order.cancelled.merchantDesc' : 'order.cancelled.desc')}
          </Text>
        </View>

        {/* 商户取消才有的原因卡 1685:3429 —— 原因是商户填的,没有就不渲染空卡 */}
        {byMerchant && cancelReason ? (
          <View style={styles.reasonCard}>
            <HomeIcon name="alert" width={22} height={21} color="#856404" />
            <View style={styles.flexCol}>
              <Text style={styles.reasonTitle}>{t('order.cancelled.cancelReason')}</Text>
              <Text style={styles.reasonDesc}>{cancelReason}</Text>
            </View>
          </View>
        ) : null}

        {hotelName ? (
          <View style={styles.group}>
            <Text style={styles.sectionTitle}>{t('order.cancel.bookingDetails')}</Text>
            <BookingSummaryCard
              cover={tempCoverFor(0)}
              hotelName={hotelName}
              dateRange={dateRange ?? '-'}
            />
          </View>
        ) : null}

        {/* CONFIRMED REFUND 1205:2723 */}
        <View style={styles.refundCard}>
          <Text style={styles.refundLabel}>{t('order.cancelled.confirmedRefund')}</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>{t('order.cancel.refundAmount')}</Text>
            <Text style={styles.amountValue}>{formatMoney(refundAmount, currency)}</Text>
          </View>
          <View style={styles.statusRow}>
            <HomeIcon name="wallet" size={16} color={colors.primary} />
            <Text style={styles.statusText}>{t('order.cancelled.refundInitiated')}</Text>
          </View>
          <Text style={styles.refNo}>
            {t('order.cancelled.transactionRef')}
            <Text style={styles.refNoValue}>{refundNo}</Text>
          </Text>
          <View style={styles.statusRow}>
            <HomeIcon name="clock" size={16} color={colors.textSoft} />
            <Text style={styles.timelineLabel}>{t('order.cancel.refundTimeline')}</Text>
          </View>
          <Text style={styles.timelineDesc}>{t('order.cancel.refundTimelineDesc')}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={backToBookings}
          >
            <Text style={styles.primaryBtnText}>{t('order.cancelled.backToBookings')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
            onPress={startNewBooking}
          >
            <Text style={styles.ghostBtnText}>{t('order.cancelled.startNew')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.topBar, { paddingTop: insets.top + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.topBack, pressed && styles.pressed]}
          onPress={backToBookings}
          hitSlop={8}
        >
          <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
          <Text style={styles.topTitle}>
            {t(byMerchant ? 'order.cancelled.detailsTitle' : 'order.cancel.title')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1 },
  main: { paddingHorizontal: PAGE_PADDING, gap: 24 },
  group: { gap: 8 },
  pressed: { opacity: 0.85 },

  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  topBack: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 },
  topTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary,
  },

  header: { alignItems: 'center', gap: 8 },
  iconWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(65, 105, 237, 0.1)',
  },
  title: {
    width: '100%',
    fontFamily: fonts.interBold,
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
    color: colors.heading,
  },
  desc: {
    width: '100%',
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
  },
  flexCol: { flex: 1, minWidth: 0 },
  iconWrapMerchant: { backgroundColor: 'rgba(236, 19, 23, 0.1)' },
  /* 商户取消原因卡(1685:3429),与确认页的 Final Notice 同一套黄色 */
  reasonCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFD666',
    backgroundColor: '#FFF9E6',
  },
  reasonTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#856404',
  },
  reasonDesc: { paddingTop: 4, fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#856404' },
  sectionTitle: {
    paddingHorizontal: 4,
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 24,
    color: colors.heading,
  },

  refundCard: {
    width: '100%',
    gap: 12,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  refundLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  amountLabel: { fontFamily: fonts.inter, fontSize: 18, lineHeight: 27, color: '#0B1C30' },
  amountValue: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 30, color: colors.primary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 20, color: colors.primary },
  refNo: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#0B1C30' },
  refNoValue: { fontFamily: fonts.interSemi },
  timelineLabel: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 20, color: colors.heading },
  timelineDesc: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.muted },

  actions: { width: '100%', gap: 16 },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#FFFFFF',
  },
  ghostBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ghostBtnText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#204DDA',
  },
});
