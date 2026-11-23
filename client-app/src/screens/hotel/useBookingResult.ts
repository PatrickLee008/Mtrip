/**
 * 预订结果页的数据层(完整模式 `BookingSuccessScreen` 与关怀模式 `BookingSuccessLiteScreen` 共用)
 *
 * 两个页面的**版式各留各的**(用户 2026-09-22 明确:日后样式可能分化,不抽共用组件),
 * 但「读订单 / 倒计时 / 重新发起支付」这套取数与改数必须是同一份 ——
 * 否则同一张单在两种模式下会显示出不同的金额、状态或剩余时间。
 * 与 `useBookingWizard`、`useMyPickData` 同一做法。
 *
 * 三件事:
 *   1. **读订单**(用户 2026-09-22 要求,成功态也读):
 *      有 `orderId` → `order/detail`;有 `tripId` → `trip/detail`(多房间要整车金额与各预订)。
 *      单号 / 金额 / 订单状态 / 支付截止时间一律以接口为准,**路由参数只作兜底** ——
 *      演示模式没有 orderId,完全走参数,行为与从前一致。
 *   2. **倒计时**:后端 `order_main.payment_expires_at` + 每分钟扫描的超时任务
 *      (`BookingExpiryService`)到点即自动取消并释放库存。不显示剩余时间的话,
 *      用户不知道这张单还能拖多久,回来重试时往往已经失效。
 *      多房间取各预订里**最早**的那个截止时间(整车一起付,最早的一到期整车就不完整了)。
 *   3. **重新发起支付**:对**已存在的单**调 `order/pay` / `trip/pay` ——
 *      后端只要求 `order_status=0` / `pay_status=0`,天然支持重付。
 *      **绝不在这里建单**:本文件存在的理由就是修掉「失败后重试又建一单」那个缺陷。
 *      重复支付不会重复扣款:`OrderController::pay` 在扣款前就拦掉非待支付的单
 *      (实测第二次调用返回 `40901 订单不是待支付状态`,余额只动一次)。
 *      但正因为它是报错而不是静默成功,「其实已扣款、只是响应丢了」的情况下用户会看到一句
 *      莫名其妙的错误 —— 所以 `repay` 的 catch 里重读订单,**发现已经是已支付就当成功**。
 *      钱包部分抵扣(PRD 模块 25,2026-11-11):重付与向导同一规则(`payPendingWithWallet`)——
 *      钱包够付全额就钱包付;不够且站点开通 MMQR 就钱包先抵扣、剩余进扫码页(此时返回 false,页面已跳走)。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchOrderDetail } from '@/api/order';
import { PAY_METHOD, getPayMethods, isMethodEnabled } from '@/api/pay';
import { fetchTripDetail, type TripBookingRow, type TripDetailResult } from '@/api/trip';
import { ORDER_STATUS } from '@/config/global';
import type { RootStackParamList } from '@/navigation/types';
import { mmqrRouteParams, payPendingWithWallet } from '@/screens/pay/mmqrPay';
import { useSiteStore } from '@/store/siteStore';
import { useUserStore } from '@/store/userStore';
import type { OrderDetail } from '@/types/models';
import { parseUtcTime } from '@/utils/time';

/** 结果页三态:成功 / 等酒店确认(后端暂无此档)/ 支付失败(单已建好,仍待支付) */
export type BookingResultStatus = 'confirmed' | 'confirming' | 'failed';

export interface BookingResultParams {
  orderId?: number;
  orderNo?: string;
  tripId?: number;
  paidTotal?: number;
  status?: BookingResultStatus;
  failReason?: string;
}

export interface BookingResult {
  status: BookingResultStatus;
  /** 展示用单号:接口优先(多房间是 trip_no),缺省回落路由参数 */
  bookingId: string;
  /** 实付金额:接口优先 */
  payAmount: number;
  longStayDiscount: number;
  /** 同 Trip 下的各预订(单房型链路为空) */
  bookings: TripBookingRow[];
  order: OrderDetail | null;
  /** 支付失败原因(重付失败会被新原因覆盖) */
  failReason: string;
  /** 距支付截止还剩多少秒;null = 没有截止时间(已支付 / 演示模式 / 接口没给) */
  secondsLeft: number | null;
  /**
   * **订单真的已失效**(服务端口径:已取消/已过期),不是「倒计时归零」。
   *
   * 实测:`order/pay` 只判 `order_status=0`,**不判 `payment_expires_at`** ——
   * 过期是每分钟的 `BookingExpiryService` 扫出来取消的。所以截止时间刚过的那一小段里
   * 后端其实还能正常扣款(付掉之后超时任务会跳过这张单)。
   * 按倒计时禁用按钮就会比后端更严,把只迟到几秒的用户挡在外面 ——
   * 所以这里只认服务端状态,倒计时归零后每三秒重读订单,直到服务端确认支付或失效。
   */
  expired: boolean;
  paying: boolean;
  loading: boolean;
  /** 对**已有**订单重新发起支付;成功返回 true(调用方据此切成功态) */
  repay: () => Promise<boolean>;
  reload: () => Promise<void>;
}

function paidOrder(status: number | undefined): boolean {
  return status !== undefined && [ORDER_STATUS.PAID, ORDER_STATUS.USED, ORDER_STATUS.FINISHED,
    ORDER_STATUS.REFUNDING, ORDER_STATUS.REFUNDED].some((value) => value === status);
}

function unavailableOrder(status: number): boolean {
  return status === ORDER_STATUS.CANCELLED || status === ORDER_STATUS.EXPIRED;
}

type ResultSnapshot = { order?: OrderDetail; trip?: TripDetailResult };

export function useBookingResult(p: BookingResultParams): BookingResult {
  const refreshProfile = useUserStore((s) => s.refreshProfile);
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const currency = useSiteStore((s) => s.currency);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [bookings, setBookings] = useState<TripBookingRow[]>([]);
  const [tripPayAmount, setTripPayAmount] = useState<number | null>(null);
  const [tripNo, setTripNo] = useState('');
  const [tripPayStatus, setTripPayStatus] = useState<number | null>(null);
  /** 本地态:重付成功后就地切成 confirmed,不再 push 一层新页面 */
  const [status, setStatus] = useState<BookingResultStatus>(p.status ?? 'confirmed');
  const [failReason, setFailReason] = useState(p.failReason ?? '');
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (): Promise<ResultSnapshot | null> => {
    /* 演示模式没有 orderId/tripId:什么都不请求,整页走路由参数(与从前一致) */
    if (!p.orderId && !p.tripId) return null;
    setLoading(true);
    try {
      if (p.tripId && p.tripId > 0) {
        const trip = await fetchTripDetail(p.tripId).catch(() => null);
        if (trip) {
          setBookings(trip.bookings ?? []);
          setTripPayAmount(Number(trip.pay_amount) || 0);
          setTripNo(String(trip.trip_no ?? ''));
          setTripPayStatus(trip.pay_status);
          setStatus(trip.pay_status === 1 ? 'confirmed' : 'failed');
          if (trip.pay_status === 1) setFailReason('');
          return { trip };
        }
      } else if (p.orderId) {
        const detail = await fetchOrderDetail(p.orderId).catch(() => null);
        if (detail) {
          setOrder(detail);
          setStatus(paidOrder(detail.order_status) ? 'confirmed' : 'failed');
          if (paidOrder(detail.order_status)) setFailReason('');
          return { order: detail };
        }
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [p.orderId, p.tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * 支付截止时间:多房间取各预订里**最早**的一个;单房型取订单自己的。
   * 已支付(不是待支付态)就没有倒计时。
   */
  const expiresAt = useMemo(() => {
    const pending = (row: { order_status: number }) => row.order_status === ORDER_STATUS.PENDING;
    if (bookings.length > 0) {
      if (tripPayStatus === 1 || bookings.some((row) => unavailableOrder(row.order_status))) return null;
      const times = bookings
        .filter(pending)
        .map((row) => parseUtcTime(row.payment_expires_at))
        .filter((ms): ms is number => ms !== null);
      return times.length > 0 ? Math.min(...times) : null;
    }
    if (order && order.order_status === ORDER_STATUS.PENDING) {
      return parseUtcTime(order.payment_expires_at);
    }
    return null;
  }, [bookings, order, tripPayStatus]);

  /* 有截止时间才起秒表,免得成功页白白每秒重渲染 */
  const ticking = expiresAt !== null && status !== 'confirmed';
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  const secondsLeft = expiresAt === null ? null : Math.max(0, Math.floor((expiresAt - now) / 1000));
  /** 倒计时归零 ≠ 单子作废,只是「该去问问后端了」 */
  const timeUp = secondsLeft !== null && secondsLeft <= 0;

  /* 到点后继续查询，直到服务器落下支付或失效状态；不能只问一次后永远停在0秒。 */
  const askedAfterTimeUp = useRef(false);
  useEffect(() => {
    if (!timeUp) {
      askedAfterTimeUp.current = false;
      return;
    }
    if (!askedAfterTimeUp.current) {
      askedAfterTimeUp.current = true;
      void load();
    }
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [timeUp, load]);

  /** 失效以**服务端状态**为准 */
  const expired = p.tripId
    ? tripPayStatus !== 1 && bookings.some((row) => unavailableOrder(row.order_status))
    : order !== null && unavailableOrder(order.order_status);

  /** 防连点:支付请求在途时再点一次会重复扣款风险 */
  const inFlight = useRef(false);

  const repay = useCallback(async (): Promise<boolean> => {
    if (inFlight.current || expired) return false;
    inFlight.current = true;
    setPaying(true);
    try {
      /* 只对已有的单发起支付 —— 这里**没有**也不该有任何 create 调用 */
      const target = { orderId: p.orderId, tripId: p.tripId && p.tripId > 0 ? p.tripId : undefined };
      if (!target.tripId && !target.orderId) return false;
      /* 钱包够不够要按最新余额与后台限额判断:现取资料与渠道表(渠道接口失败按只有钱包处理) */
      await refreshProfile().catch(() => undefined);
      const methods = await getPayMethods(currency || undefined).catch(() => null);
      const list = Array.isArray(methods) ? methods : null;
      const payable = target.tripId
        ? (tripPayAmount ?? Number((await fetchTripDetail(target.tripId)).pay_amount)) || 0
        : Number(order?.pay_amount ?? (await fetchOrderDetail(target.orderId as number)).pay_amount) || 0;
      const outcome = await payPendingWithWallet(target, {
        payable,
        balance: Number(useUserStore.getState().profile?.balance ?? 0),
        methods: list,
        mmqrEnabled: isMethodEnabled(list, PAY_METHOD.MMQR, currency || undefined),
      });
      void refreshProfile().catch(() => undefined);
      if (outcome.kind === 'insufficient') {
        setFailReason(t('order.balanceInsufficient'));
        return false;
      }
      if (outcome.kind === 'mmqr') {
        /* 钱包已抵扣,剩余进扫码页;付完扫码页回预订详情 */
        navigation.navigate(
          'MmqrPay',
          mmqrRouteParams(outcome.res, { ...target, detailRoute: 'BookingDetail', useWallet: outcome.useWallet }),
        );
        return false;
      }
      setFailReason('');
      setStatus('confirmed');
      /* 重读一次:状态行与金额都改以接口为准,不靠前端猜 */
      await load();
      return true;
    } catch (e) {
      /**
       * 两种情况都会报「订单不是待支付状态」(40901):
       *   a) 超时被自动取消 —— 该报错;
       *   b) 上一次其实扣款成功、只是响应丢了 —— 此时报错会让用户莫名其妙。
       * 所以重读一次订单**按真实状态判**:已支付就当成功,不拿这句错误吓人。
       */
      const latest = await load();
      if (latest?.trip?.pay_status === 1 || paidOrder(latest?.order?.order_status)) {
        setFailReason('');
        setStatus('confirmed');
        return true;
      }
      setFailReason(e instanceof Error ? e.message : '');
      return false;
    } finally {
      inFlight.current = false;
      setPaying(false);
    }
  }, [p.orderId, p.tripId, refreshProfile, load, currency, tripPayAmount, order, navigation, t, expired]);

  return {
    status,
    bookingId: tripNo || order?.order_no || p.orderNo || '',
    payAmount: tripPayAmount ?? (order ? Number(order.pay_amount) || 0 : (p.paidTotal ?? 0)),
    longStayDiscount: p.tripId
      ? bookings.reduce((total, booking) => total + (Number(booking.longstay_discount) || 0), 0)
      : Number(order?.longstay_discount) || 0,
    bookings,
    order,
    failReason,
    secondsLeft,
    expired,
    paying,
    loading,
    repay,
    reload: async () => { await load(); },
  };
}

/** 剩余秒数 → `mm:ss`(超过一小时按 `hh:mm:ss`,实际只有 10 分钟,留着防配置变更) */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, seconds);
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const body = `${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return h > 0 ? `${pad(h)}:${body}` : body;
}
