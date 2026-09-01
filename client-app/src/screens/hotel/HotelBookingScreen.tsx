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
 * **两种模式**:
 *   - **真实模式**(从详情页房型卡进来,带 `goodsId` + `skuId`):酒店名 / 房型名 / 单价来自
 *     `/app/goods/detail`,支付步骤真的调 `/app/order/create` + `/app/order/pay` 落单。
 *     支付渠道本身仍未接通 —— 后端 `pay` 目前就是 mock(直接把订单置为已支付并返回核销码),
 *     所以选哪个渠道都直接成功,这与「暂不处理支付流程」的当前范围一致。
 *   - **演示模式**(不带参数直接进,如设计稿走查):数值来自 `bookingDemo.ts`,不发任何请求。
 *
 * 真实模式下**不提交**的两项(页面照旧展示,提交时忽略,避免与实付金额对不上):
 *   1. 加购项(早餐 / 接送 / 保险)—— 后端没有加购价目表与对应字段;
 *   2. 多住宿 Add More Stay —— 后端一次 `create` 只收一个 sku,故真实模式下走 comingSoon。
 *
 * 走 comingSoon 的:区号选择、Save Info、优惠券、Pay by other / Share、Payment Summary 展开、
 * 新增卡片、Add Hotel and Homestay 的二次搜索(演示模式下直接把设计稿的第二段住宿加进来)。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchGoodsDetail } from '@/api/goods';
import { createOrder, payOrder } from '@/api/order';
import { fetchTravelerList } from '@/api/user';
import { LoadingView } from '@/components/common/StateViews';
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
  normalizeDates,
} from '@/components/hotel/booking/bookingFormat';
import { PAGE_PADDING, colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import {
  BOOKING_DEMO,
  BOOKING_SECOND_STAY,
  scaleStay,
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

/**
 * 演示数据 → 一段住宿。设计稿那组金额本来就是「1 晚 1 间」的,直接当作 `units` 基数,
 * 再由 `scaleStay` 按实际晚数与间数摊开(默认 1 晚 1 间时与设计稿完全一致)。
 * `dates` 是搜索页带进来的入离日期,没有才用设计稿那组。
 */
function makeStay(
  source: typeof BOOKING_DEMO | typeof BOOKING_SECOND_STAY,
  key: string,
  dates?: { checkIn: string; checkOut: string },
): BookingStay {
  return scaleStay({
    key,
    demo: true,
    hotelKey: source.hotelKey,
    roomKey: source.roomKey,
    checkIn: dates?.checkIn ?? source.checkIn,
    checkOut: dates?.checkOut ?? source.checkOut,
    adults: source.adults,
    childCount: source.children,
    rooms: source.rooms,
    addons: [],
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
  /**
   * 入离日期优先用搜索页选好的那组(`HotelResults → HotelDetail → 这里` 透传);
   * 没带、或带来的是过去的日期(后端 `create` 会以「使用日期不能早于今天」拒掉)就用明天起 1 晚。
   */
  const initialDates = useMemo(() => normalizeDates(route.params?.checkIn, route.params?.checkOut), [
    route.params?.checkIn,
    route.params?.checkOut,
  ]);
  const [stays, setStays] = useState<BookingStay[]>([
    makeStay(BOOKING_DEMO, 'stay1', initialDates),
  ]);
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
  const [submitting, setSubmitting] = useState(false);
  const [failReason, setFailReason] = useState('');
  /** 真实下单成功后的单号 / 实付金额 / 核销码(二维码),传给成功页 */
  const [paid, setPaid] = useState<{
    orderNo: string;
    payAmount: number;
    verifyCode: string;
  } | null>(null);

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

  /**
   * 真实模式:房型卡带 `goodsId` / `skuId` 进来时,拉一次 `/goods/detail`,
   * 用真实酒店名、房型名与 `base_price` 覆盖演示数据。
   *
   * 价格口径按后端来:房费 = `base_price × 晚数 × 间数`;**不加税费、不加加购**
   *   —— 后端 `OrderController::create` 的价钱来自锁库存的日历价,再减长住折扣与优惠券,
   *      没有税费概念;加购(早餐/接送/保险)后端也没有价目表,本次只在页面内展示、不提交。
   * 最终实付以 `create` 返回的 `priceDetail.payAmount` 为准。
   *
   * 日期默认取明天起 1 晚 —— 演示数据那组 2026-06-04 已经是过去,
   * 后端 `create` 会以「使用日期不能早于今天」直接拒掉。
   */
  const goodsId = route.params?.goodsId;
  const skuId = route.params?.skuId;
  const realMode = Boolean(goodsId && skuId);
  const [loadingGoods, setLoadingGoods] = useState(realMode);

  useEffect(() => {
    if (!goodsId || !skuId) return;
    let alive = true;
    setLoadingGoods(true);
    void fetchGoodsDetail(goodsId)
      .then((detail) => {
        if (!alive) return;
        const sku = (detail.skus ?? []).find((r) => r.id === skuId);
        if (!sku) return;
        const unit = Number(sku.base_price) || 0;
        setStays([
          scaleStay({
            key: `goods-${goodsId}-sku-${skuId}`,
            demo: false,
            goodsId,
            skuId,
            hotelName: detail.goods_name,
            roomName: sku.room_name ?? '',
            address: detail.address ?? '',
            hotelKey: BOOKING_DEMO.hotelKey,
            roomKey: BOOKING_DEMO.roomKey,
            checkIn: initialDates.checkIn,
            checkOut: initialDates.checkOut,
            adults: Math.max(1, Number(sku.max_guests) || 2),
            childCount: 0,
            rooms: 1,
            addons: [],
            /* 真实商品没有税费与积分,只有房费(见 goNext 的说明) */
            units: { originalPrice: unit, roomPrice: unit, taxes: 0, total: unit, points: 0 },
            taxPercent: 0,
            originalPrice: 0,
            roomPrice: 0,
            taxes: 0,
            total: 0,
            points: 0,
          }),
        ]);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoadingGoods(false);
      });
    return () => {
      alive = false;
    };
  }, [goodsId, skuId, initialDates]);

  const multi = stays.length > 1;
  const current = stays[0];

  /** 步骤序列:多住宿才插入 trip */
  const sequence = useMemo<BookingStepKey[]>(
    () => (multi ? ['dates', 'guests', 'review', 'trip', 'payment'] : ['dates', 'guests', 'review', 'payment']),
    [multi],
  );
  const index = Math.max(sequence.indexOf(step), 0);

  /** 改一段住宿。金额一律由 `scaleStay` 按新的晚数 × 间数重算,不会停在进来时那一晚的价上 */
  const patchStay = (patch: Partial<BookingStay>) =>
    setStays((prev) => [scaleStay({ ...prev[0], ...patch }), ...prev.slice(1)]);

  const toggleAddon = (key: BookingAddonKey) =>
    patchStay({
      addons: current.addons.includes(key)
        ? current.addons.filter((k) => k !== key)
        : [...current.addons, key],
    });

  const addSecondStay = () => {
    /* 真实模式下后端一次只收一个 sku,多住宿没法落单 */
    if (!current.demo) {
      comingSoon();
      return;
    }
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

  /**
   * 真实下单:`create` 建单 → `pay` 支付。
   *
   * 后端 `pay` 目前就是 mock(直接置为已支付并发核销码),所以「点击支付直接成功」
   * 不需要前端伪造,照常调即可 —— 接真实渠道时只换 `pay` 的实现,这里不用改。
   *
   * 联系人手机号后端必填,而向导第 2 步的手机按设计稿是选填,所以真实下单前补校验一次。
   * **不拿账号手机号兜底**:`/app/user/me` 与登录返回的 `mobile` 都经过 `MaskHelper` 脱敏
   * (形如 `09****1234`),提交上去就是一条联系不上的假号码。
   */
  const submit = async () => {
    if (!current.goodsId || !current.skuId) {
      comingSoon();
      return;
    }
    const contactName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const contactPhone = form.phone.trim();
    if (!contactPhone) {
      showToast(t('hotels.booking.guests.phoneRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const order = await createOrder({
        goodsId: current.goodsId,
        skuId: current.skuId,
        quantity: current.rooms,
        useDate: current.checkIn,
        endDate: current.checkOut,
        contactName,
        contactPhone,
        remark: request.trim() || undefined,
        travelers: [
          {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            phone: form.phone.trim() || undefined,
            email: form.email.trim() || undefined,
          },
        ],
      });
      const paidResult = await payOrder(order.orderId);
      setPaid({
        orderNo: order.orderNo,
        payAmount: order.priceDetail.payAmount,
        verifyCode: paidResult.verifyCode,
      });
      setPayResult('success');
    } catch (e) {
      /* 库存不足 / 日期不可售等都由后端给中文原因,直接展示,不套设计稿的固定失败文案 */
      setFailReason(e instanceof Error ? e.message : '');
      setPayResult('error');
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => {
    if (submitting || loadingGoods) return;
    /**
     * 日历是「点一下起头、再点一下收尾」,中间那一下之后 `checkOut` 是空的。
     * 摘要卡的日期弹层去掉后,这个半选状态会一直留在页面上,必须在这里拦 ——
     * 否则真实模式会带着空的 `endDate` 去下单,被后端以「入住/离店日期不正确」打回。
     */
    if (step === 'dates' && !current.checkOut) {
      showToast(t('hotels.booking.dates.checkOutRequired'));
      return;
    }
    if (step === 'guests') {
      if (!form.firstName.trim() && !form.lastName.trim()) {
        showToast(t('hotels.booking.guests.nameRequired'));
        return;
      }
      /* 手机号按设计稿是选填,但后端 create 的 contactPhone 必填 —— 真实模式在这一步就拦下,
         不拖到支付步才报错 */
      if (!current.demo && !form.phone.trim()) {
        showToast(t('hotels.booking.guests.phoneRequired'));
        return;
      }
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
      if (current.demo) {
        /* 演示模式:不发请求,直接给设计稿的成功浮层,关闭后进成功页 */
        setPayResult('success');
        return;
      }
      if (!isLogin) {
        navigation.navigate('Login');
        return;
      }
      void submit();
      return;
    }
    setStep(sequence[index + 1]);
  };

  const tripTotal = stays.reduce((sum, stay) => sum + stay.total, 0);

  /** 真实商品用接口给的名称,演示数据走 i18n 键 */
  const hotelNameOf = (stay: BookingStay) =>
    stay.hotelName ?? t(`hotels.results.demo.${stay.hotelKey}.name`);
  const roomNameOf = (stay: BookingStay) =>
    stay.roomName || t(`hotels.detail.rooms.names.${stay.roomKey}`);

  /** 支付页 / Trip 页的汇总卡文案 */
  const summaryFor = (stay: BookingStay) => ({
    dateLabel: t('hotels.booking.payment.summaryRange', {
      checkIn: formatDayMonth(stay.checkIn, i18n.language),
      checkOut: formatDayMonth(stay.checkOut, i18n.language),
      nights: nightsLabel(t, nightsBetween(stay.checkIn, stay.checkOut)),
    }),
    roomLabel: t('hotels.booking.payment.roomLine', {
      rooms: stay.rooms,
      room: roomNameOf(stay),
      guests: stay.adults + stay.childCount,
    }),
    pointsLabel: t('hotels.booking.review.earnPoints', {
      points: stay.points.toLocaleString(i18n.language),
    }),
  });

  const primaryLabel = (() => {
    if (step === 'payment' && submitting) return t('common.loading');
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
        {/* 商品详情到手前不渲染步骤内容,免得先闪一屏演示数据的房型与价格 */}
        {loadingGoods ? <LoadingView /> : renderStep()}
      </ScrollView>

      <BookingBottomBar
        variant={barVariant}
        primaryLabel={primaryLabel}
        primaryArrow={step !== 'review' && step !== 'trip'}
        /* 真实商品的价格拉到手之前先留空,别把演示金额顶上去 */
        priceLabel={loadingGoods ? '' : formatMoney(multi ? tripTotal : current.total, currency)}
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
          navigation.replace('BookingSuccess', {
            orderNo: paid?.orderNo,
            verifyCode: paid?.verifyCode,
            hotelName: current.demo ? undefined : hotelNameOf(current),
            address: current.address || undefined,
            checkIn: current.checkIn,
            checkOut: current.checkOut,
            adults: current.adults + current.childCount,
            rooms: current.rooms,
            paidTotal: paid?.payAmount,
          });
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
