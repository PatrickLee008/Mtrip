/**
 * 订房向导的数据层(完整模式 `HotelBookingScreen` 与关怀模式 `HotelBookingLiteScreen` 共用)
 *
 * 两个模式的版式完全不同,但**下单口径必须是同一份** —— 否则同一个账号在两种模式下
 * 算出来的实付金额、能不能用券、余额够不够会对不上。抽在这里的只有状态 / 取数 / 下单,
 * 不含任何排版(与「我的精选」的 `useMyPickData` 同一做法)。
 *
 * 约定沿用原页面(改动前写在 `HotelBookingScreen` 头部):
 *   - **两种模式**:带 `propertyId` + `roomTypeId` 是真实模式,真的调 `/app/order/create` +
 *     `/app/order/pay` 落单;不带参数是演示模式,数值来自 `bookingDemo.ts`,不发任何请求。
 *   - 真实模式下**不提交**加购项(后端没有加购价目表)与多住宿(一次 `create` 只收一个 sku)。
 *   - 渠道只开通 mTrip 钱包余额(`payMethod=3`),其余置灰 + Coming soon。
 *   - 优惠券抵扣额一律由服务端 `/marketing/coupon/match-list` 给出,前端不自己算。
 *
 * 关怀模式传 `enableMultiStay: false`:步骤序列恒为 dates → guests → review → payment,
 * 不出现 `trip` 与 Add More Stay —— 真实下单本来就不支持多住宿,关怀版不给死路。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchHotelDetail } from '@/api/goods';
import { fetchCouponMatchList, type BestCoupon } from '@/api/marketing';
import { createOrder, payOrder } from '@/api/order';
import { apiTripCreate, apiTripPay } from '@/api/trip';
import { fetchTravelerList } from '@/api/user';
import {
  formatDayMonth,
  nightsBetween,
  nightsLabel,
  normalizeDates,
} from '@/components/hotel/booking/bookingFormat';
import type { RootStackParamList } from '@/navigation/types';
import {
  BOOKING_DEMO,
  BOOKING_SECOND_STAY,
  scaleStay,
  type BookingAddonKey,
  type BookingStay,
  type BookingStepKey,
  type LeadGuestForm,
  type PaymentMethodKey,
} from '@/screens/hotel/bookingDemo';
import { useCommonStore } from '@/store/commonStore';
import { useRoomCartStore } from '@/store/roomCartStore';
import { useSiteStore } from '@/store/siteStore';
import { useUserStore } from '@/store/userStore';
import type { CouponView, RefundRule } from '@/types/models';
import { formatMoney } from '@/utils/format';

/** 设计稿写死「还能再加 2 位同行人」 */
export const ADDITIONAL_QUOTA = 2;

/** 向导入参(两个模式的路由参数同形) */
export type BookingWizardParams = RootStackParamList['HotelBooking'];

interface Options {
  params: BookingWizardParams;
  /** 支付成功后 replace 的目标路由(完整模式 / 关怀模式各一页) */
  successRoute: 'BookingSuccess' | 'BookingSuccessLite';
  /** 是否允许多住宿(trip 步骤 + Add More Stay);关怀模式传 false */
  enableMultiStay?: boolean;
  /**
   * 步骤序列覆盖。关怀模式新稿(`2540:19101`)把四步收成两步,传 `['guests', 'payment']` ——
   * **刻意复用原有的 step key**,这样 `goNext` 里那两段校验(姓名/手机、渠道/登录/余额/下单)
   * 原样生效,不用为 Lite 再写一份。不传就是完整模式的原序列。
   */
  steps?: BookingStepKey[];
  /**
   * 未登录时是先弹「Account Login Required」浮层再跳登录页(关怀模式新稿 `2540:20959`),
   * 还是直接跳。完整模式的稿子里没有这张浮层,默认 false 保持原行为。
   */
  confirmLogin?: boolean;
  /**
   * 是否使用房型购物车(多房间预订走 `trip/create`)。
   * 关怀模式传 false —— 它的详情页不加购,但车里可能还留着完整模式挑的房,
   * 不关掉的话会在关怀模式下悄悄按车里的内容下单。
   */
  useCart?: boolean;
}

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

export function useBookingWizard({
  params,
  successRoute,
  enableMultiStay = true,
  steps,
  confirmLogin = false,
  useCart = true,
}: Options) {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isLogin = useUserStore((s) => s.isLogin);
  const profile = useUserStore((s) => s.profile);
  const refreshProfile = useUserStore((s) => s.refreshProfile);
  const currency = useSiteStore((s) => s.currency);
  const showToast = useCommonStore((s) => s.showToast);

  const comingSoon = () => showToast(t('home.comingSoon'));
  /** 钱包可用余额:登录后取 `/app/user/me` 的 balance(字符串),演示模式回落设计稿数值 */
  const walletBalance = isLogin ? Number(profile?.balance ?? 0) : BOOKING_DEMO.walletBalance;

  const [step, setStep] = useState<BookingStepKey>(steps?.[0] ?? 'dates');
  /** 未登录时的确认浮层(只有 `confirmLogin` 打开时才会被置起) */
  const [loginPrompt, setLoginPrompt] = useState(false);
  /**
   * 入离日期优先用搜索页选好的那组(`HotelResults → HotelDetail → 这里` 透传);
   * 没带、或带来的是过去的日期(后端 `create` 会以「使用日期不能早于今天」拒掉)就用今天起 2 晚
   * —— 与搜索页 `defaultDateRange(2)` 同一口径,别再默默挪到明天(见 `normalizeDates` 注释)。
   */
  const initialDates = useMemo(() => normalizeDates(params?.checkIn, params?.checkOut), [
    params?.checkIn,
    params?.checkOut,
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
  /** 本期只有钱包余额是真渠道,直接预选上(其余渠道点了只弹 Coming soon) */
  const [method, setMethod] = useState<PaymentMethodKey | null>('wallet');
  const [expanded, setExpanded] = useState<'card' | 'mobileBanking' | null>(null);
  const [payResult, setPayResult] = useState<'success' | 'error' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** 房型购物车:有内容就走 Trip 多房间下单,支付成功后清空 */
  const cartRooms = useRoomCartStore((s) => s.items);
  const cartPropertyId = useRoomCartStore((s) => s.propertyId);
  const checkoutCart = useRoomCartStore((s) => s.checkout);
  const [failReason, setFailReason] = useState('');
  /**
   * 真实下单成功后的订单主键 / 单号 / 实付金额 / 核销码(二维码),传给成功页。
   * `orderId` 是给成功页的「View Booking」跳 `OrderDetail` 用的(那个路由收的是数字主键,不是单号)。
   */
  const [paid, setPaid] = useState<{
    orderId: number;
    orderNo: string;
    payAmount: number;
    verifyCode: string;
  } | null>(null);

  /**
   * 主要入住人的姓名有两个来源,都**只填姓名**:
   *   1) 进页面时自动读**默认常旅客**(`is_default=1`);没设默认就不填 —— 拿最新一条会让人莫名其妙。
   *   2) 从常旅客页选回来(`params.leadGuest`,见 TravelersScreen 的 pick 模式)。
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

  /* 进支付步先把余额刷新一次:本地资料可能是上次启动时缓存的,拿旧余额会误判「余额不足」 */
  useEffect(() => {
    if (step !== 'payment' || !isLogin) return;
    void refreshProfile().catch(() => undefined);
  }, [step, isLogin, refreshProfile]);

  /**
   * 从常旅客页选回来。依赖用的是 `picked` 的**对象身份**:React Navigation 只在 params 真的变化时
   * 才换一个新对象,普通重渲染拿到的是同一个引用,所以这个副作用每次「选择并返回」只跑一次,
   * 不会反复盖掉用户之后手改的姓名 —— 也就不需要再 `setParams` 去清参数
   * (那个 API 在联合类型的路由参数上还有类型坑)。
   */
  const picked = params?.leadGuest;
  useEffect(() => {
    if (!picked) return;
    setForm((prev) => ({ ...prev, firstName: picked.firstName, lastName: picked.lastName }));
  }, [picked]);

  /**
   * 真实模式:房型卡带 `propertyId` / `roomTypeId` 进来时,拉一次 `/hotels/detail`,
   * 用真实酒店名、房型名与 `base_price` 覆盖演示数据。
   *
   * 价格口径按后端来:房费 = `base_price × 晚数 × 间数`;**不加税费、不加加购**
   *   —— 后端 `OrderController::create` 的价钱来自锁库存的日历价,再减长住折扣与优惠券,
   *      没有税费概念;加购(早餐/接送/保险)后端也没有价目表,本次只在页面内展示、不提交。
   * 最终实付以 `create` 返回的 `priceDetail.payAmount` 为准。
   */
  const propertyId = params?.propertyId;
  const roomTypeId = params?.roomTypeId;
  const realMode = Boolean(propertyId && roomTypeId);
  const [loadingGoods, setLoadingGoods] = useState(realMode);
  /** 真实商品的退改规则,给关怀模式 Step 1 的 Cancellation Policy 卡用(演示模式为空) */
  const [refundRules, setRefundRules] = useState<RefundRule[]>([]);

  useEffect(() => {
    if (!propertyId || !roomTypeId) return;
    let alive = true;
    setLoadingGoods(true);
    void fetchHotelDetail(propertyId)
      .then((detail) => {
        if (!alive) return;
        const sku = (detail.skus ?? []).find((r) => r.id === roomTypeId);
        if (!sku) return;
        setRefundRules(detail.refundRules ?? []);
        const unit = Number(sku.base_price) || 0;
        setStays([
          scaleStay({
            key: `property-${propertyId}-room-${roomTypeId}`,
            demo: false,
            propertyId,
            roomTypeId,
            hotelName: detail.goods_name,
            roomName: sku.room_name ?? '',
            address: detail.address ?? '',
            bedType: sku.bed_type ?? undefined,
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
  }, [propertyId, roomTypeId, initialDates]);

  const multi = stays.length > 1;
  const current = stays[0];

  /* ------------------------------------------------------------ 房型购物车(多房间预订) */
  /**
   * 车里**能落单**的房型:有真实 `sku` 且车属于某个物业(演示房型没有 sku,进不了真实下单)。
   * 这个判定必须与 `submit` 里组 `tripItems` 的条件**完全一致** ——
   * 否则页面显示/校验的金额会与实际提交的内容错开。
   */
  const tripRooms = useMemo(
    () =>
      useCart && cartPropertyId && cartPropertyId === propertyId
        ? cartRooms.filter((room) => room.sku)
        : [],
    [useCart, cartRooms, cartPropertyId, propertyId],
  );
  /** 多房间模式:金额与间数一律以车为准,不再是路由带进来的那一个 `roomTypeId` */
  const cartMode = tripRooms.length > 0;
  /**
   * 车内房费合计 = Σ 单价 × 间数 × 晚数,与详情页底栏、购物车页的合计**同一公式**。
   * 半选日期(`checkOut` 为空)时按 1 晚,跟 `roomCartStore.nightsBetween` 的兜底一致。
   *
   * 这是**预估值**(单价取 `base_price`),实付仍以 `trip/create` 返回的 `payAmount` 为准 ——
   * 与单房型链路拿 `base_price × 晚数 × 间数` 预估是同一口径。
   */
  const cartTotal = useMemo(() => {
    if (!cartMode) return 0;
    const nights = Math.max(1, nightsBetween(current.checkIn, current.checkOut));
    return tripRooms.reduce((sum, room) => sum + room.price * room.quantity * nights, 0);
  }, [cartMode, tripRooms, current.checkIn, current.checkOut]);
  /** 向导各处要用的房费与间数口径:多房间看车,单房型看当前住宿 */
  const roomsTotal = cartMode ? cartTotal : current.total;
  const roomCount = cartMode
    ? tripRooms.reduce((sum, room) => sum + room.quantity, 0)
    : current.rooms;

  /* ------------------------------------------------------------ 结账优惠券(C-M6) */
  /**
   * 进入复核步时**自动应用最优券**,用户可在弹窗里换一张 / 不用券 / 恢复最优券。
   * 每张券对本单的抵扣额一律由服务端 `/marketing/coupon/match-list` 给出
   * (与下单时 `PricingService::resolveCoupon` 同一公式),前端不自己算 —— 否则这里显示的
   * 优惠会和实际扣款对不上。改日期/间数后房费变了会重新拉一次,即「切换后重新试算」。
   *
   * 只在**真实模式且已登录**时启用:演示模式没有 propertyId,券接口也要登录态。
   */
  const [couponList, setCouponList] = useState<CouponView[]>([]);
  const [bestCoupon, setBestCoupon] = useState<BestCoupon | null>(null);
  /** 当前选用的领券记录 id;0 = 不使用优惠券 */
  const [couponId, setCouponId] = useState(0);
  /** 用户手动动过券之后就不再被自动最优券覆盖 */
  const [couponTouched, setCouponTouched] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);

  const couponEnabled = realMode && isLogin && !multi;
  /* 试算基数:多房间要按整车净额算,否则券的抵扣额会按单间去匹配门槛,与后端整单口径对不上 */
  const couponBase = cartMode ? cartTotal : current.roomPrice;

  useEffect(() => {
    if (!couponEnabled || !propertyId || !roomTypeId || couponBase <= 0) {
      setCouponList([]);
      setBestCoupon(null);
      return;
    }
    let alive = true;
    setCouponLoading(true);
    void fetchCouponMatchList({ orderType: 1, propertyId, roomTypeId, amount: couponBase })
      .then((data) => {
        if (!alive) return;
        setCouponList(data.list);
        setBestCoupon(data.best);
        setCouponId((prev) => {
          /* 没动过 → 自动应用最优券 */
          if (!couponTouched) return data.best?.couponId ?? 0;
          /* 动过 → 原来那张若因金额变化而失效,退回最优券(没有就退回不使用) */
          if (prev === 0) return 0;
          const still = data.list.find((c) => c.receive_id === prev && c.unusableReason === null);
          return still ? prev : (data.best?.couponId ?? 0);
        });
      })
      .catch(() => {
        if (!alive) return;
        setCouponList([]);
        setBestCoupon(null);
      })
      .finally(() => {
        if (alive) setCouponLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [couponEnabled, propertyId, roomTypeId, couponBase, couponTouched]);

  /** 真正生效的券:选中的那张必须仍在可用列表里,否则当作没有券 */
  const appliedCoupon = useMemo(() => {
    if (couponId <= 0) return null;
    const found = couponList.find((c) => c.receive_id === couponId);
    if (!found || found.unusableReason !== null) return null;
    return { receiveId: found.receive_id, name: found.coupon_name, discount: found.discount ?? 0 };
  }, [couponId, couponList]);

  const hasUsableCoupon = couponList.some((c) => c.unusableReason === null);
  const couponDiscount = appliedCoupon?.discount ?? 0;

  /** 步骤序列:调用方给了 `steps` 就用它;否则多住宿才插入 trip */
  const sequence = useMemo<BookingStepKey[]>(
    () =>
      steps ??
      (multi && enableMultiStay
        ? ['dates', 'guests', 'review', 'trip', 'payment']
        : ['dates', 'guests', 'review', 'payment']),
    [steps, multi, enableMultiStay],
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
    /* 真实模式下后端一次只收一个 sku,多住宿没法落单;关怀模式整条路都不开 */
    if (!enableMultiStay || !current.demo) {
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

  const tripTotal = stays.reduce((sum, stay) => sum + stay.total, 0);
  /**
   * 吸底栏与支付页汇总卡的金额:多住宿(演示)走 Trip 合计,其余用 `roomsTotal` 扣掉已应用的券。
   * `roomsTotal` 在多房间模式下是**整车**合计 —— 这里若还按单间算,余额校验会放过余额不足的账号,
   * 到 `trip/pay` 才被后端打回,用户看到的也会是比实扣少的数字。
   */
  const payableTotal = multi ? tripTotal : Math.max(0, roomsTotal - couponDiscount);

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
    /* 多房间模式下房型来自购物车,路由不一定带 roomTypeId,所以只在单房型链路上拦 */
    if (!cartMode && (!current.propertyId || !current.roomTypeId)) {
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
      /**
       * 多房间预订走 Trip:购物车里有房型(且拿得到真实房型 id)时,
       * 整车一次 `trip/create` + `trip/pay`(券只消耗一次、各预订各自出核销码)。
       * 车是空的(单房型旧链路 / 演示模式)仍走 `order/create` + `order/pay`。
       */
      const tripItems = tripRooms.map((room) => ({
        propertyId: cartPropertyId as number,
        roomTypeId: room.sku!.id,
        quantity: room.quantity,
        useDate: current.checkIn,
        endDate: current.checkOut,
        contactName,
        contactPhone,
        remark: request.trim() || undefined,
      }));

      if (tripItems.length > 0) {
        const trip = await apiTripCreate({
          items: tripItems,
          couponId: appliedCoupon?.receiveId,
        });
        /**
         * 钱包余额 → 3(后端真扣 `user_info.balance`,整单扣一次);
         * 其余渠道(card / mmqr / kbzpay / wavepay / mobileBanking)本期都是 mock,统一走 1。
         * 本项目没有 PayPal 这个选项,所以不映射 2。
         */
        const paidTrip = await apiTripPay({
          tripId: trip.tripId,
          payMethod: method === 'wallet' ? 3 : 1,
        });
        void refreshProfile().catch(() => undefined);
        /* 下单完成:清空购物车(转存为快照,成功页要按它列本单明细) */
        checkoutCart();
        const first = trip.bookings[0];
        setPaid({
          orderId: first?.orderId ?? 0,
          orderNo: trip.tripNo,
          payAmount: trip.payAmount,
          verifyCode: paidTrip.codes?.[0]?.verifyCode ?? '',
        });
        setPayResult('success');
        return;
      }

      const order = await createOrder({
        propertyId: current.propertyId,
        roomTypeId: current.roomTypeId,
        quantity: current.rooms,
        useDate: current.checkIn,
        endDate: current.checkOut,
        contactName,
        contactPhone,
        remark: request.trim() || undefined,
        /* 复核页应用的券。后端 create 会用同一张券再算一次并以它为准,
           所以这里提交的是领券记录 id,不是前端算好的金额 */
        couponId: appliedCoupon?.receiveId,
        travelers: [
          {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            phone: form.phone.trim() || undefined,
            email: form.email.trim() || undefined,
          },
        ],
      });
      /* 余额支付(payOrder 默认 PAY_METHOD.BALANCE):后端真扣 user_info.balance 并落流水 */
      const paidResult = await payOrder(order.orderId);
      /* 单房型链路车本就是空的;仍要走一次,把上一单的快照清掉,成功页不会串到上次的房型 */
      checkoutCart();
      /* 余额变了,把本地资料刷一次,钱包卡与「我的」页不至于还显示扣款前的数 */
      void refreshProfile().catch(() => undefined);
      setPaid({
        orderId: order.orderId,
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
     * 这个半选状态会一直留在页面上,必须拦 —— 否则真实模式会带着空的 `endDate` 去下单,
     * 被后端以「入住/离店日期不正确」打回。
     *
     * **无条件判**(不再限定 `step === 'dates'`):关怀模式新稿没有 dates 这一步,
     * 限定步骤的话这条护栏会整个失效。完整模式第一步就是 dates,后面几步 `checkOut` 必非空,
     * 所以放开步骤限制对它没有实际影响。
     */
    if (!current.checkOut) {
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
    /**
     * 复核步不再有「同意条款」勾选框(新稿 2659:13281 把它改成了 Continue 下方的一行说明文字,
     * 继续即视为同意),所以这里不再拦截。`agreed` 仍保留导出给关怀模式等旧调用方。
     */
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
        /* 关怀模式新稿先弹「Account Login Required」确认;完整模式保持直接跳 */
        if (confirmLogin) setLoginPrompt(true);
        else navigation.navigate('Login');
        return;
      }
      /* 余额是唯一真渠道:不够就别去创建订单,免得留一单十分钟后才过期的待支付 */
      if (walletBalance < payableTotal) {
        showToast(t('hotels.booking.payment.insufficient'));
        return;
      }
      void submit();
      return;
    }
    setStep(sequence[index + 1]);
  };

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
      /* 多房间模式下「间数」是整车的总间数,不是这一段住宿里那个计数器 */
      rooms: cartMode ? roomCount : stay.rooms,
      room: roomNameOf(stay),
      guests: stay.adults + stay.childCount,
    }),
    pointsLabel: t('hotels.booking.review.earnPoints', {
      points: stay.points.toLocaleString(i18n.language),
    }),
  });

  const primaryLabel = (() => {
    if (step === 'payment' && submitting) return t('common.loading');
    /* 关怀模式没有 Trip,复核步的下一步直接是支付,按钮仍叫 Continue */
    if (step === 'review' && enableMultiStay) return t('hotels.booking.addToTrip');
    if (step === 'trip') return t('hotels.booking.checkOut');
    return t('hotels.booking.continue');
  })();

  /**
   * 支付成功浮层关闭后进成功页。两个模式各有一页、参数同形 ——
   * 这里按目标路由分开写,不给 `navigation.replace` 传联合类型的路由名(TS 展不开对应的参数)。
   */
  const goSuccess = () => {
    const payload = {
      orderId: paid?.orderId,
      orderNo: paid?.orderNo,
      verifyCode: paid?.verifyCode,
      hotelName: current.demo ? undefined : hotelNameOf(current),
      address: current.address || undefined,
      checkIn: current.checkIn,
      checkOut: current.checkOut,
      adults: current.adults + current.childCount,
      rooms: roomCount,
      paidTotal: paid?.payAmount,
    };
    if (successRoute === 'BookingSuccessLite') {
      navigation.replace('BookingSuccessLite', payload);
      return;
    }
    navigation.replace('BookingSuccess', payload);
  };

  return {
    /* 环境 */
    t,
    i18n,
    currency,
    isLogin,
    navigation,
    comingSoon,

    /* 步骤 */
    step,
    sequence,
    index,
    primaryLabel,

    /* 住宿与表单 */
    stays,
    current,
    multi,
    loadingGoods,
    refundRules,
    /* 多房间(购物车)模式:页面据此把房费与间数换成整车口径 */
    cartMode,
    roomsTotal,
    roomCount,
    request,
    setRequest,
    agreed,
    setAgreed,
    form,
    setForm,
    patchStay,
    toggleAddon,
    addSecondStay,

    /* 支付 */
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
    loginPrompt,
    setLoginPrompt,

    /* 优惠券 */
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
    couponDiscount,

    /* 文案助手 */
    hotelNameOf,
    roomNameOf,
    summaryFor,

    /* 动作 */
    goBack,
    goNext,
  };
}
