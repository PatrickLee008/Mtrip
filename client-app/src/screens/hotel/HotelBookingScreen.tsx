/**
 * 订房向导 · 一个路由 + 内部分步(Figma M-Trip / `Multi Booking Hotel Booking Flow` 1675:5776)
 *
 * 与酒店详情页「一个壳 + 六个页签组件」同一做法:壳(状态栏黑条 / 进度条 / 滚动区 / 吸底栏)在这里,
 * 每一步的内容各自一个组件:
 *   dates   1675:6069 → components/hotel/booking/BookingStepDates
 *   guests  1675:6292 → components/hotel/booking/BookingStepGuests
 *   review  1675:6404 → components/hotel/booking/ReviewBody(与 Stay 明细页共用)
 *   trip    1675:9406 → 本文件内联(两张汇总卡 + Add More Stay + 合计明细,结构简单不另拆)
 *   payment 1675:6537 → components/hotel/booking/BookingStepPayment
 *
 * 步骤序列:dates → guests → review →(多住宿才有 trip)→ payment。
 * 进度条固定 4 格;**多住宿的支付页没有进度条**(设计稿 1675:9158 确实没画)。
 *
 * **状态与下单逻辑全在 `useBookingWizard`**(与关怀模式 `HotelBookingLiteScreen` 共用一份):
 * 两种模式(真实 / 演示)、只开通钱包余额渠道、加购与多住宿不提交、优惠券由服务端试算,
 * 这些约定的完整说明见该 Hook 的头部注释。本文件只负责完整模式的排版。
 *
 * 走 comingSoon 的:区号选择、Save Info、优惠券、Pay by other / Share、Payment Summary 展开、
 * 新增卡片、Add Hotel and Homestay 的二次搜索(演示模式下直接把设计稿的第二段住宿加进来)。
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import AlertDialog from '@/components/hotel/booking/AlertDialog';
import BookingBottomBar from '@/components/hotel/booking/BookingBottomBar';
import BookingProgress from '@/components/hotel/booking/BookingProgress';
import BookingStepDates from '@/components/hotel/booking/BookingStepDates';
import BookingStepGuests from '@/components/hotel/booking/BookingStepGuests';
import BookingStepPayment from '@/components/hotel/booking/BookingStepPayment';
import CouponPickerSheet from '@/components/hotel/booking/CouponPickerSheet';
import ReviewBody from '@/components/hotel/booking/ReviewBody';
import { AddMoreStayCard, PriceBreakdownCard } from '@/components/hotel/booking/ReviewCards';
import StaySummaryCard from '@/components/hotel/booking/StaySummaryCard';
import { BOTTOM_BAR_HEIGHT, bookingShared } from '@/components/hotel/booking/bookingShared';
import { PAGE_PADDING, colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { ADDITIONAL_QUOTA, useBookingWizard } from '@/screens/hotel/useBookingWizard';
import { formatAmount, formatMoney } from '@/utils/format';

export default function HotelBookingScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'HotelBooking'>>();
  const insets = useSafeAreaInsets();

  const {
    t,
    i18n,
    currency,
    isLogin,
    navigation,
    comingSoon,
    step,
    index,
    primaryLabel,
    stays,
    current,
    multi,
    loadingGoods,
    request,
    setRequest,
    agreed,
    setAgreed,
    form,
    setForm,
    patchStay,
    toggleAddon,
    addSecondStay,
    method,
    setMethod,
    expanded,
    setExpanded,
    walletBalance,
    payableTotal,
    tripTotal,
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
  } = useBookingWizard({ params: route.params, successRoute: 'BookingSuccess' });

  const renderStep = () => {
    switch (step) {
      case 'guests':
        return (
          <BookingStepGuests
            form={form}
            additionalQuota={ADDITIONAL_QUOTA}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onSelectTraveler={() => navigation.navigate('Travelers', { pick: true })}
            onAddGuest={() => navigation.navigate('AddGuest')}
            onSaveInfo={comingSoon}
            onComingSoon={comingSoon}
          />
        );
      case 'review':
        return (
          <View style={styles.reviewGroup}>
            <ReviewBody
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
            <AddMoreStayCard
              title={t('hotels.booking.review.addMoreStay')}
              desc={t('hotels.booking.review.addMoreStayDesc')}
              action={t('hotels.booking.review.addHotel')}
              onPress={addSecondStay}
            />
          </View>
        );
      case 'trip':
        return (
          <View style={styles.tripGroup}>
            {stays.map((stay, i) => {
              const parts = summaryFor(stay);
              return (
                <StaySummaryCard
                  key={stay.key}
                  stayLabel={t('hotels.booking.trip.stay', { index: i + 1 })}
                  onEdit={() => navigation.navigate('StayDetail', { index: i })}
                  hotelName={hotelNameOf(stay)}
                  dateLabel={parts.dateLabel}
                  roomLabel={parts.roomLabel}
                  viewDetailsLabel={t('hotels.booking.trip.viewDetails')}
                  onViewDetails={() => navigation.navigate('StayDetail', { index: i })}
                  totalLabel={t('hotels.booking.review.totalAmount')}
                  pointsLabel={parts.pointsLabel}
                  total={formatMoney(stay.total, currency)}
                />
              );
            })}

            <AddMoreStayCard
              title={t('hotels.booking.review.addMoreStay')}
              desc={t('hotels.booking.review.addMoreStayDesc')}
              action={t('hotels.booking.review.addHotel')}
              onPress={comingSoon}
            />

            <PriceBreakdownCard
              title={t('hotels.booking.review.priceBreakdown')}
              rows={stays.map((stay, i) => ({
                key: stay.key,
                label: t('hotels.booking.trip.hotelTotal', { index: i + 1 }),
                value: formatAmount(stay.roomPrice, currency),
              }))}
              totalLabel={t('hotels.booking.review.totalAmount')}
              pointsLabel={t('hotels.booking.review.earnPoints', {
                points: stays
                  .reduce((sum, stay) => sum + stay.points, 0)
                  .toLocaleString(i18n.language),
              })}
              total={formatMoney(tripTotal, currency)}
            />
          </View>
        );
      case 'payment': {
        const parts = summaryFor(current);
        return (
          <BookingStepPayment
            summary={
              <StaySummaryCard
                eyebrow={
                  multi ? t('hotels.booking.trip.multiBooking', { stays: stays.length }) : null
                }
                hotelName={hotelNameOf(current)}
                dateLabel={parts.dateLabel}
                roomLabel={parts.roomLabel}
                viewDetailsLabel={t('hotels.booking.payment.viewDetails')}
                onViewDetails={() => navigation.navigate('StayDetail', { index: 0 })}
                totalLabel={t('hotels.booking.review.totalAmount')}
                pointsLabel={parts.pointsLabel}
                total={formatMoney(payableTotal, currency)}
                payByOtherLabel={t('hotels.booking.payment.payByOther')}
                shareLabel={t('hotels.booking.payment.share')}
                onShare={comingSoon}
              />
            }
            method={method}
            expanded={expanded}
            balance={walletBalance}
            insufficient={!current.demo && isLogin && walletBalance < payableTotal}
            onSelect={setMethod}
            onToggleExpand={(key) => setExpanded((prev) => (prev === key ? null : key))}
            onComingSoon={comingSoon}
          />
        );
      }
      default:
        return (
          <BookingStepDates
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

  /** 设计稿只有加购已选态那张(1675:7406)带返回栏,其余屏没有;这里第 1 步统一给它,方便退出向导 */
  const showHeader = step === 'dates';
  /** 多住宿的支付页设计稿没有进度条 */
  const showProgress = !(multi && step === 'payment');
  /** Step 1 的吸底栏是「预计总价 + Continue」的变体 */
  const barVariant = step === 'dates' ? 'price' : 'buttons';

  return (
    <View style={styles.root}>
      <View style={[styles.statusBar, { height: insets.top }]} />

      {showHeader ? (
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.headerBack, pressed && bookingShared.pressed]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
          >
            <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
            <Text style={styles.headerTitle}>{t('hotels.booking.back')}</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.main,
          { paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showProgress ? (
          <BookingProgress
            step={index + 1}
            title={t(`hotels.booking.steps.${step}`)}
          />
        ) : null}
        {/* 商品详情到手前不渲染步骤内容,免得先闪一屏演示数据的房型与价格 */}
        {loadingGoods ? <LoadingView /> : renderStep()}
      </ScrollView>

      <BookingBottomBar
        variant={barVariant}
        primaryLabel={primaryLabel}
        primaryArrow={step !== 'review' && step !== 'trip'}
        /* 真实商品的价格拉到手之前先留空,别把演示金额顶上去 */
        priceLabel={loadingGoods ? '' : formatMoney(payableTotal, currency)}
        onPrimary={goNext}
        onBack={goBack}
      />

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
        desc={
          payResult === 'error'
            ? failReason || t('hotels.booking.payment.failReason')
            : null
        }
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
  root: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1 },
  statusBar: { backgroundColor: '#000000' },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  headerBack: { flexDirection: 'row', alignItems: 'center', gap: 16, alignSelf: 'flex-start' },
  headerTitle: { fontFamily: fonts.outfitSemi, fontSize: 24, lineHeight: 30, color: colors.primary },

  main: { paddingHorizontal: PAGE_PADDING, paddingTop: 32, gap: 24 },
  reviewGroup: { gap: 24 },
  tripGroup: { gap: 24 },
});
