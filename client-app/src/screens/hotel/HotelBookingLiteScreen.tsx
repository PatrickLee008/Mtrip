/**
 * 关怀模式订房向导 · 一个路由 + 内部两步(Figma section `2540:19101`)
 *
 * **这一版是照真稿做的,不再是推导**。2026-09-15 首次落地时设计侧没有 Lite 稿,
 * 那一版是从完整模式 `1675:5776` 按换算规则推导的四步(dates → guests → review → payment)。
 * 2026-09-18 设计出了 `Lite Booking step 1 / 2`,把流程收成两步:
 *
 *   step 1 `2540:19394`  Confirm Your Room & Date → components/hotel/booking/lite/LiteStepConfirm
 *   step 2 `2540:19621`  Price Breakdown          → components/hotel/booking/lite/LiteStepPay
 *
 * **状态与下单逻辑仍与完整模式共用 `useBookingWizard`**(真实/演示两种模式、只开通钱包余额、
 * 加购与多住宿不提交、优惠券由服务端试算 —— 完整说明见该 Hook 的头部注释)。
 * 这里传 `steps: ['guests', 'payment']` —— **刻意复用原有的 step key**,
 * 这样 Hook 里「姓名/手机必填」「渠道必选 / 未登录 / 余额不足 / 下单」两段校验原样生效。
 *
 * 壳与完整模式的差异(都按新稿):
 *   1. **没有顶栏、也没有进度条** —— 标题是 Main 里的第一行文字,返回靠底部的 Cancel / Back;
 *   2. 吸底栏是**两枚等宽按钮**(Cancel / Continue → 与 ← Back / Pay Now →),
 *      不再是「预计总价 + 一枚大按钮」—— 总价改由 step 2 的价格明细卡承担。
 *
 * **新稿把日期与人数画成只读摘要**,这里按用户确认接上了现成弹层(`DatePickerSheet` /
 * `GuestRoomSheet`):不然进了订房页发现日期错了只能退两层重选。
 *
 * 复用完整模式的浮层与子页:选券 `CouponPickerSheet`、结果浮层 `AlertDialog`、
 * 常旅客 `Travelers`、新增旅客 `AddGuest`、保险 `Insurance`(那两页的新稿与已实现的
 * `1675:5777` / `1675:5900` 是同一版式,本次未动)。
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import DatePickerSheet from '@/components/hotel/DatePickerSheet';
import AlertDialog from '@/components/hotel/booking/AlertDialog';
import { formatMonthDayYear } from '@/components/hotel/booking/bookingFormat';
import CouponPickerSheet from '@/components/hotel/booking/CouponPickerSheet';
import LiteStepConfirm from '@/components/hotel/booking/lite/LiteStepConfirm';
import LiteStepPay from '@/components/hotel/booking/lite/LiteStepPay';
import { LITE_BAR_HEIGHT, liteBooking } from '@/components/hotel/booking/lite/liteBookingShared';
import GuestRoomSheet from '@/components/hotel/lite/GuestRoomSheet';
import { PAGE_PADDING, colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useBookingWizard } from '@/screens/hotel/useBookingWizard';

export default function HotelBookingLiteScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'HotelBookingLite'>>();

  const [datesOpen, setDatesOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);

  const {
    t,
    i18n,
    currency,
    isLogin,
    navigation,
    comingSoon,
    step,
    current,
    loadingGoods,
    refundRules,
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
    loginPrompt,
    setLoginPrompt,
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
    roomNameOf,
    goBack,
    goNext,
  } = useBookingWizard({
    params: route.params,
    successRoute: 'BookingSuccessLite',
    enableMultiStay: false,
    steps: ['guests', 'payment'],
    confirmLogin: true,
    /* 关怀模式只订一间:车里可能还留着完整模式挑的房,不能拿来替它下单 */
    useCart: false,
  });

  const onPay = step === 'payment';

  /**
   * 退改说明:真实商品接 `refundRules`(rule_type 1 免费 / 2 阶梯 / 3 不可退,口径与
   * `HotelPolicyLiteScreen`、后端 `computeRefund` 的兜底一致);演示模式用设计稿文案。
   */
  const cancellationDesc = (() => {
    const rule = refundRules[0];
    if (!rule) {
      return t('hotels.booking.review.cancellationDesc', {
        date: formatMonthDayYear(current.checkIn, i18n.language),
      });
    }
    if (rule.rule_type === 3) return t('hotels.lite.policy.nonRefundable');
    if (rule.rule_type === 2) return t('hotels.lite.policy.tieredRefund');
    return t('hotels.lite.policy.freeCancel');
  })();

  return (
    <View style={liteBooking.root}>
      <SafeAreaView style={liteBooking.flex} edges={['top']}>
        <ScrollView
          style={liteBooking.flex}
          contentContainerStyle={styles.main}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={liteBooking.pageTitle}>
            {t(onPay ? 'hotels.booking.lite.priceTitle' : 'hotels.booking.lite.confirmTitle')}
          </Text>

          {/* 商品详情到手前不渲染步骤内容,免得先闪一屏演示数据的房型与价格 */}
          {loadingGoods ? (
            <LoadingView />
          ) : onPay ? (
            <LiteStepPay
              stay={current}
              total={payableTotal}
              method={method}
              balance={walletBalance}
              insufficient={!current.demo && isLogin && walletBalance < payableTotal}
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
              onSelect={setMethod}
              onComingSoon={comingSoon}
            />
          ) : (
            <LiteStepConfirm
              roomName={roomNameOf(current)}
              rooms={current.rooms}
              checkIn={current.checkIn}
              checkOut={current.checkOut}
              adults={current.adults}
              childCount={current.childCount}
              bedType={current.bedType}
              form={form}
              onChangeForm={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
              addons={current.addons}
              onToggleAddon={toggleAddon}
              cancellationDesc={cancellationDesc}
              onOpenDates={() => setDatesOpen(true)}
              onOpenGuests={() => setGuestsOpen(true)}
              onSelectTraveler={() => navigation.navigate('Travelers', { pick: true })}
              onOpenInsurance={() => navigation.navigate('Insurance')}
              onComingSoon={comingSoon}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      {/* 吸底双按钮:左退(Cancel / Back)、右进(Continue / Pay Now) */}
      <SafeAreaView style={styles.bar} edges={['bottom']}>
        <View style={styles.barInner}>
          <Pressable
            style={({ pressed }) => [styles.ghostBtn, pressed && liteBooking.pressed]}
            onPress={onPay ? goBack : () => navigation.goBack()}
          >
            {onPay ? <HomeIcon name="arrowLeft" size={20} color={colors.primary} /> : null}
            <Text style={[styles.ghostText, !onPay && styles.cancelText]}>
              {t(onPay ? 'hotels.booking.back' : 'hotels.booking.lite.cancel')}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              submitting && styles.primaryDisabled,
              pressed && !submitting && liteBooking.pressed,
            ]}
            disabled={submitting}
            onPress={goNext}
          >
            <Text style={styles.primaryText}>
              {submitting
                ? t('common.loading')
                : t(onPay ? 'hotels.booking.lite.payNow' : 'hotels.booking.continue')}
            </Text>
            <HomeIcon name="arrowRight" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* 新稿把日期/人数画成只读摘要,这两枚弹层是补的可改入口(见文件头) */}
      <DatePickerSheet
        visible={datesOpen}
        /* 背后是白卡页面,压一层遮罩;搜索/结果页那几处按设计稿仍然不压 */
        backdrop
        value={{ checkIn: current.checkIn, checkOut: current.checkOut, flexDays: 0 }}
        onClose={() => setDatesOpen(false)}
        onConfirm={(v) => {
          patchStay({ checkIn: v.checkIn, checkOut: v.checkOut });
          setDatesOpen(false);
        }}
      />

      <GuestRoomSheet
        visible={guestsOpen}
        value={{ rooms: current.rooms, adults: current.adults, children: current.childCount }}
        onClose={() => setGuestsOpen(false)}
        onConfirm={(v) => {
          patchStay({ rooms: v.rooms, adults: v.adults, childCount: v.children });
          setGuestsOpen(false);
        }}
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

      {/* 未登录先确认再跳(新稿 `2540:20959`),不直接把人踢去登录页 */}
      <AlertDialog
        visible={loginPrompt}
        tone="plain"
        title={t('hotels.booking.lite.loginRequiredTitle')}
        desc={t('hotels.booking.lite.loginRequiredDesc')}
        primaryLabel={t('hotels.booking.lite.confirm')}
        onPrimary={() => {
          setLoginPrompt(false);
          navigation.navigate('Login');
        }}
        secondaryLabel={t('hotels.booking.lite.cancel')}
        onSecondary={() => setLoginPrompt(false)}
        onClose={() => setLoginPrompt(false)}
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
          const wasError = payResult === 'error';
          setPayResult(null);
          if (wasError) {
            /**
             * 走到这个弹窗只剩**建单失败**(支付失败已经跳结果页了),
             * 此时库里没有任何单 —— 所以「Retry」就该真的重新建单,
             * 而不是像从前那样只把弹窗关掉、让用户自己再去点一次 Pay Now。
             * `goNext` 内部有 `submitting` 护栏,不会重复提交。
             */
            goNext();
            return;
          }
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
  main: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 16,
    paddingBottom: LITE_BAR_HEIGHT + 24,
    gap: 20,
  },

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
    paddingHorizontal: 16,
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
    textAlign: 'center',
    color: colors.primary,
  },
  /* 设计稿的 Cancel 是主色描边 + 红字(不是整枚红) */
  cancelText: { color: colors.hot },

  primaryBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: {
    fontFamily: fonts.interMedium,
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
