/**
 * 关怀模式订房向导 · 一个路由 + 内部分步(Figma section `Booking Flow` `759:9777`)
 *
 * **设计侧没有出订房流程的 Lite 稿** —— 用户指定的这个 section 与完整模式已实现的
 * `Multi Booking Hotel Booking Flow` 1675:5776 逐屏同构(逐帧比对过 `224:4808` ≡ `1675:6292`)。
 * 所以这一版是按仓库已确立的关怀模式换算规则从该稿**推导**出来的:版式不变、每个元素放大一档,
 * 与 `HotelsLiteScreen`(搜索)、`HotelDetailLiteScreen`(详情)同一套字号,换算表见
 * `components/hotel/booking/lite/liteBookingShared.ts` 的头部。
 *
 * 壳在这里(顶栏 / 进度条 / 滚动区 / 吸底栏),每一步的内容各自一个组件:
 *   dates   → components/hotel/booking/lite/LiteStepDates
 *   guests  → components/hotel/booking/lite/LiteStepGuests
 *   review  → components/hotel/booking/lite/LiteStepReview
 *   payment → components/hotel/booking/lite/LiteStepPayment
 *
 * **状态与下单逻辑与完整模式共用 `useBookingWizard`**(真实/演示两种模式、只开通钱包余额、
 * 加购与多住宿不提交、优惠券由服务端试算 —— 完整说明见该 Hook 的头部注释)。
 * 这里传 `enableMultiStay: false`:步骤恒为 dates → guests → review → payment,
 * 没有 trip 步、也没有 Add More Stay(后端一次 `create` 只收一个 sku,完整模式点它本就只弹
 * Coming soon,关怀版不给死路)。
 *
 * 壳与完整模式的两处差异,都是为了少按几下:
 *   1. **顶栏常驻**(完整版只有第 1 步有),返回键一直在同一个位置;
 *   2. 吸底栏恒为「预计总价 + 一枚大按钮」,不在第 2~4 步换成左右两枚按钮 ——
 *      回上一步走顶栏的返回,一屏只有一个主操作。
 *
 * 复用完整模式的浮层与子页(结构同构,没必要再出一份):选券弹窗 `CouponPickerSheet`、
 * 支付结果 `AlertDialog`、常旅客 `Travelers`、新增旅客 `AddGuest`、保险 `Insurance`。
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import AlertDialog from '@/components/hotel/booking/AlertDialog';
import CouponPickerSheet from '@/components/hotel/booking/CouponPickerSheet';
import LiteStepDates from '@/components/hotel/booking/lite/LiteStepDates';
import LiteStepGuests from '@/components/hotel/booking/lite/LiteStepGuests';
import LiteStepPayment from '@/components/hotel/booking/lite/LiteStepPayment';
import LiteStepReview from '@/components/hotel/booking/lite/LiteStepReview';
import {
  LITE_BAR_HEIGHT,
  liteBooking,
} from '@/components/hotel/booking/lite/liteBookingShared';
import { PAGE_PADDING, colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { BOOKING_PROGRESS_TOTAL } from '@/screens/hotel/bookingDemo';
import { ADDITIONAL_QUOTA, useBookingWizard } from '@/screens/hotel/useBookingWizard';
import { formatMoney } from '@/utils/format';

export default function HotelBookingLiteScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'HotelBookingLite'>>();

  const {
    t,
    currency,
    isLogin,
    navigation,
    comingSoon,
    step,
    index,
    primaryLabel,
    current,
    loadingGoods,
    request,
    setRequest,
    agreed,
    setAgreed,
    form,
    setForm,
    patchStay,
    toggleAddon,
    method,
    setMethod,
    walletBalance,
    payableTotal,
    submitting,
    payResult,
    setPayResult,
    failReason,
    goSuccess,
    couponEnabled,
    couponList,
    couponId,
    couponLoading,
    couponOpen,
    setCouponOpen,
    setCouponId,
    setCouponTouched,
    bestCoupon,
    appliedCoupon,
    hasUsableCoupon,
    hotelNameOf,
    summaryFor,
    goBack,
    goNext,
  } = useBookingWizard({
    params: route.params,
    successRoute: 'BookingSuccessLite',
    enableMultiStay: false,
  });

  const renderStep = () => {
    switch (step) {
      case 'guests':
        return (
          <LiteStepGuests
            form={form}
            additionalQuota={ADDITIONAL_QUOTA}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onSelectTraveler={() => navigation.navigate('Travelers', { pick: true })}
            onAddGuest={() => navigation.navigate('AddGuest')}
            onComingSoon={comingSoon}
          />
        );
      case 'review':
        return (
          <LiteStepReview
            stay={current}
            agreed={agreed}
            onToggleAgree={() => setAgreed((v) => !v)}
            onComingSoon={comingSoon}
            coupon={
              couponEnabled
                ? {
                    applied: appliedCoupon,
                    hasUsable: hasUsableCoupon,
                    loading: couponLoading,
                    onOpen: () => setCouponOpen(true),
                  }
                : undefined
            }
          />
        );
      case 'payment': {
        const parts = summaryFor(current);
        return (
          <LiteStepPayment
            hotelName={hotelNameOf(current)}
            dateLabel={parts.dateLabel}
            roomLabel={parts.roomLabel}
            pointsLabel={parts.pointsLabel}
            total={formatMoney(payableTotal, currency)}
            method={method}
            balance={walletBalance}
            insufficient={!current.demo && isLogin && walletBalance < payableTotal}
            onSelect={setMethod}
            onComingSoon={comingSoon}
          />
        );
      }
      default:
        return (
          <LiteStepDates
            checkIn={current.checkIn}
            checkOut={current.checkOut}
            adults={current.adults}
            childCount={current.childCount}
            rooms={current.rooms}
            addons={current.addons}
            request={request}
            onChangeDates={(checkIn, checkOut) => patchStay({ checkIn, checkOut })}
            onChangeAdults={(adults) => patchStay({ adults })}
            onChangeChildCount={(childCount) => patchStay({ childCount })}
            onToggleAddon={toggleAddon}
            onChangeRequest={setRequest}
            onOpenInsurance={() => navigation.navigate('Insurance')}
          />
        );
    }
  };

  const ratio = Math.min(Math.max((index + 1) / BOOKING_PROGRESS_TOTAL, 0), 1);

  return (
    <View style={liteBooking.root}>
      <SafeAreaView style={liteBooking.flex} edges={['top']}>
        {/* 顶栏常驻:返回键一直在同一个位置 */}
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.topBack, pressed && liteBooking.pressed]}
            onPress={goBack}
            hitSlop={8}
          >
            <HomeIcon name="arrowLeft" size={32} color={colors.primary} />
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>
            {t(`hotels.booking.steps.${step}`)}
          </Text>
        </View>

        <ScrollView
          style={liteBooking.flex}
          contentContainerStyle={styles.main}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progress}>
            <Text style={styles.progressStep}>
              {t('hotels.booking.stepOf', { step: index + 1, total: BOOKING_PROGRESS_TOTAL })}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
            </View>
          </View>

          {/* 商品详情到手前不渲染步骤内容,免得先闪一屏演示数据的房型与价格 */}
          {loadingGoods ? <LoadingView /> : renderStep()}
        </ScrollView>
      </SafeAreaView>

      <SafeAreaView style={styles.bar} edges={['bottom']}>
        <View style={styles.barInner}>
          <View style={liteBooking.flexCol}>
            <Text style={styles.barLabel}>{t('hotels.booking.totalEstimated')}</Text>
            {/* 真实商品的价格拉到手之前先留空,别把演示金额顶上去 */}
            <Text style={styles.barPrice}>
              {loadingGoods ? '' : formatMoney(payableTotal, currency)}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.barBtn,
              submitting && styles.barBtnDisabled,
              pressed && !submitting && liteBooking.pressed,
            ]}
            disabled={submitting}
            onPress={goNext}
          >
            <Text style={styles.barBtnText}>{primaryLabel}</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <CouponPickerSheet
        visible={couponOpen}
        coupons={couponList}
        selectedId={couponId}
        bestId={bestCoupon?.couponId ?? 0}
        currency={currency}
        loading={couponLoading}
        onClose={() => setCouponOpen(false)}
        onSelect={(receiveId) => {
          setCouponTouched(true);
          setCouponId(receiveId);
        }}
      />

      <AlertDialog
        visible={payResult !== null}
        tone={payResult === 'error' ? 'error' : 'success'}
        title={
          payResult === 'error'
            ? t('hotels.booking.payment.failTitle')
            : t('hotels.booking.payment.successTitle')
        }
        desc={payResult === 'error' ? failReason || t('hotels.booking.payment.failReason') : null}
        primaryLabel={
          payResult === 'error'
            ? t('hotels.booking.payment.retry')
            : t('hotels.booking.payment.close')
        }
        onPrimary={() => {
          setPayResult(null);
          if (payResult !== 'success') return;
          goSuccess();
        }}
        secondaryLabel={payResult === 'error' ? t('hotels.booking.payment.cancel') : null}
        onSecondary={() => setPayResult(null)}
        onClose={() => setPayResult(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  topBack: { alignItems: 'center', justifyContent: 'center' },
  topTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 28,
    lineHeight: 36,
    color: colors.primary,
  },

  main: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 8,
    paddingBottom: LITE_BAR_HEIGHT + 24,
    gap: 24,
  },

  progress: { gap: 12 },
  progressStep: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 28,
    color: colors.primary,
  },
  track: { height: 12, width: '100%', borderRadius: 999, overflow: 'hidden', backgroundColor: colors.softBlue },
  fill: { height: '100%', backgroundColor: colors.primary },

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
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  barLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.label,
  },
  barPrice: { fontFamily: fonts.interBold, fontSize: 26, lineHeight: 34, color: colors.primary },
  barBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  barBtnDisabled: { opacity: 0.6 },
  barBtnText: {
    fontFamily: fonts.outfit,
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
