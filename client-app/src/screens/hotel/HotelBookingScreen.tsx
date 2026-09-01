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
 * **当前是静态页**:数值来自 `bookingDemo.ts`,不调任何下单 / 支付接口。
 * 能真的点的:改日期、加减人数、勾加购、填表、勾条款、选支付方式、加第二段住宿、前进后退。
 * 走 comingSoon 的:区号选择、Save Info、优惠券、Pay by other / Share、Payment Summary 展开、
 * 新增卡片、Add Hotel and Homestay 的二次搜索(这里直接把设计稿的第二段住宿加进来)。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchTravelerList } from '@/api/user';
import HomeIcon from '@/components/home/HomeIcon';
import AlertDialog from '@/components/hotel/booking/AlertDialog';
import BookingBottomBar from '@/components/hotel/booking/BookingBottomBar';
import BookingProgress from '@/components/hotel/booking/BookingProgress';
import BookingStepDates from '@/components/hotel/booking/BookingStepDates';
import BookingStepGuests, {
  type LeadGuestForm,
} from '@/components/hotel/booking/BookingStepGuests';
import BookingStepPayment from '@/components/hotel/booking/BookingStepPayment';
import ReviewBody from '@/components/hotel/booking/ReviewBody';
import { AddMoreStayCard, PriceBreakdownCard } from '@/components/hotel/booking/ReviewCards';
import StaySummaryCard from '@/components/hotel/booking/StaySummaryCard';
import { BOTTOM_BAR_HEIGHT, bookingShared } from '@/components/hotel/booking/bookingShared';
import {
  formatDayMonth,
  nightsBetween,
  nightsLabel,
} from '@/components/hotel/booking/bookingFormat';
import { PAGE_PADDING, colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import {
  BOOKING_DEMO,
  BOOKING_SECOND_STAY,
  type BookingAddonKey,
  type BookingStay,
  type BookingStepKey,
  type PaymentMethodKey,
} from '@/screens/hotel/bookingDemo';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import { useUserStore } from '@/store/userStore';
import { formatAmount, formatMoney } from '@/utils/format';

/** 设计稿写死「还能再加 2 位同行人」 */
const ADDITIONAL_QUOTA = 2;

function makeStay(source: typeof BOOKING_DEMO | typeof BOOKING_SECOND_STAY, key: string): BookingStay {
  return {
    key,
    hotelKey: source.hotelKey,
    roomKey: source.roomKey,
    checkIn: source.checkIn,
    checkOut: source.checkOut,
    adults: source.adults,
    childCount: source.children,
    rooms: source.rooms,
    addons: [],
    originalPrice: source.originalPrice,
    roomPrice: source.roomPrice,
    taxPercent: source.taxPercent,
    taxes: source.taxes,
    total: source.total,
    points: source.points,
  };
}

export default function HotelBookingScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'HotelBooking'>>();
  const insets = useSafeAreaInsets();
  const isLogin = useUserStore((s) => s.isLogin);
  const currency = useSiteStore((s) => s.currency);
  const showToast = useCommonStore((s) => s.showToast);

  const comingSoon = () => showToast(t('home.comingSoon'));

  const [step, setStep] = useState<BookingStepKey>('dates');
  const [stays, setStays] = useState<BookingStay[]>([makeStay(BOOKING_DEMO, 'stay1')]);
  const [request, setRequest] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState<LeadGuestForm>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    saveInfo: false,
  });
  const [method, setMethod] = useState<PaymentMethodKey | null>(null);
  const [expanded, setExpanded] = useState<'card' | 'mobileBanking' | null>(null);
  const [payResult, setPayResult] = useState<'success' | 'error' | null>(null);

  /**
   * 主要入住人的姓名有两个来源,都**只填姓名**:
   *   1) 进页面时自动读**默认常旅客**(`is_default=1`);没设默认就不填 —— 拿最新一条会让人莫名其妙。
   *   2) 从常旅客页选回来(`route.params.leadGuest`,见 TravelersScreen 的 pick 模式)。
   * 电话与邮箱填不了:`user_traveler` 没有联系方式列,`/app/user/me` 的手机号与邮箱又都是脱敏的
   * (`AuthService::profile` 走 MaskHelper),拿脱敏值占位会被用户直接提交上去。
   */
  const autoFilled = useRef(false);
  useEffect(() => {
    if (!isLogin || autoFilled.current) return;
    autoFilled.current = true;
    void fetchTravelerList()
      .then((rows) => {
        const preset = rows.find((r) => r.is_default === 1);
        if (!preset) return;
        /* 只在用户还没动过姓名两栏时填,不覆盖已输入的内容 */
        setForm((prev) =>
          prev.firstName || prev.lastName
            ? prev
            : { ...prev, firstName: preset.first_name, lastName: preset.last_name },
        );
      })
      .catch(() => undefined);
  }, [isLogin]);

  /**
   * 从常旅客页选回来。依赖用的是 `picked` 的**对象身份**:React Navigation 只在 params 真的变化时
   * 才换一个新对象,普通重渲染拿到的是同一个引用,所以这个副作用每次「选择并返回」只跑一次,
   * 不会反复盖掉用户之后手改的姓名 —— 也就不需要再 `setParams` 去清参数
   * (那个 API 在联合类型的路由参数上还有类型坑)。
   */
  const picked = route.params?.leadGuest;
  useEffect(() => {
    if (!picked) return;
    setForm((prev) => ({ ...prev, firstName: picked.firstName, lastName: picked.lastName }));
  }, [picked]);

  const multi = stays.length > 1;
  const current = stays[0];

  /** 步骤序列:多住宿才插入 trip */
  const sequence = useMemo<BookingStepKey[]>(
    () => (multi ? ['dates', 'guests', 'review', 'trip', 'payment'] : ['dates', 'guests', 'review', 'payment']),
    [multi],
  );
  const index = Math.max(sequence.indexOf(step), 0);

  const patchStay = (patch: Partial<BookingStay>) =>
    setStays((prev) => [{ ...prev[0], ...patch }, ...prev.slice(1)]);

  const toggleAddon = (key: BookingAddonKey) =>
    patchStay({
      addons: current.addons.includes(key)
        ? current.addons.filter((k) => k !== key)
        : [...current.addons, key],
    });

  const addSecondStay = () => {
    if (multi) return;
    setStays((prev) => [...prev, makeStay(BOOKING_SECOND_STAY, 'stay2')]);
    setStep('trip');
    showToast(t('hotels.booking.trip.added'));
  };

  const goBack = () => {
    if (index <= 0) {
      navigation.goBack();
      return;
    }
    setStep(sequence[index - 1]);
  };

  const goNext = () => {
    if (step === 'guests' && !form.firstName.trim() && !form.lastName.trim()) {
      showToast(t('hotels.booking.guests.nameRequired'));
      return;
    }
    if (step === 'review' && !agreed) {
      showToast(t('hotels.booking.review.agreeRequired'));
      return;
    }
    if (step === 'payment') {
      if (!method) {
        showToast(t('hotels.booking.payment.methodRequired'));
        return;
      }
      /* 静态页:不发请求,直接给设计稿的成功浮层,关闭后进成功页 */
      setPayResult('success');
      return;
    }
    setStep(sequence[index + 1]);
  };

  const tripTotal = stays.reduce((sum, stay) => sum + stay.total, 0);

  /** 支付页 / Trip 页的汇总卡文案 */
  const summaryFor = (stay: BookingStay) => ({
    dateLabel: t('hotels.booking.payment.summaryRange', {
      checkIn: formatDayMonth(stay.checkIn, i18n.language),
      checkOut: formatDayMonth(stay.checkOut, i18n.language),
      nights: nightsLabel(t, nightsBetween(stay.checkIn, stay.checkOut)),
    }),
    roomLabel: t('hotels.booking.payment.roomLine', {
      rooms: stay.rooms,
      room: t(`hotels.detail.rooms.names.${stay.roomKey}`),
      guests: stay.adults + stay.childCount,
    }),
    pointsLabel: t('hotels.booking.review.earnPoints', {
      points: stay.points.toLocaleString(i18n.language),
    }),
  });

  const primaryLabel = (() => {
    if (step === 'review') return t('hotels.booking.addToTrip');
    if (step === 'trip') return t('hotels.booking.checkOut');
    return t('hotels.booking.continue');
  })();

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
                  hotelName={t(`hotels.results.demo.${stay.hotelKey}.name`)}
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
                hotelName={t(`hotels.results.demo.${current.hotelKey}.name`)}
                dateLabel={parts.dateLabel}
                roomLabel={parts.roomLabel}
                viewDetailsLabel={t('hotels.booking.payment.viewDetails')}
                onViewDetails={() => navigation.navigate('StayDetail', { index: 0 })}
                totalLabel={t('hotels.booking.review.totalAmount')}
                pointsLabel={parts.pointsLabel}
                total={formatMoney(multi ? tripTotal : current.total, currency)}
                payByOtherLabel={t('hotels.booking.payment.payByOther')}
                shareLabel={t('hotels.booking.payment.share')}
                onShare={comingSoon}
              />
            }
            method={method}
            expanded={expanded}
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
        {renderStep()}
      </ScrollView>

      <BookingBottomBar
        variant={barVariant}
        primaryLabel={primaryLabel}
        primaryArrow={step !== 'review' && step !== 'trip'}
        priceLabel={formatMoney(multi ? tripTotal : current.total, currency)}
        onPrimary={goNext}
        onBack={goBack}
      />

      <AlertDialog
        visible={payResult !== null}
        tone={payResult === 'error' ? 'error' : 'success'}
        title={
          payResult === 'error'
            ? t('hotels.booking.payment.failTitle')
            : t('hotels.booking.payment.successTitle')
        }
        desc={payResult === 'error' ? t('hotels.booking.payment.failReason') : null}
        primaryLabel={
          payResult === 'error'
            ? t('hotels.booking.payment.retry')
            : t('hotels.booking.payment.close')
        }
        onPrimary={() => {
          setPayResult(null);
          if (payResult === 'success') navigation.replace('BookingSuccess');
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
