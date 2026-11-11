/**
 * 支付接口(order-service /api/v1/app/order/pay*)
 *
 * 渠道:
 *   - 余额(PAY_METHOD.BALANCE=3):真支付 —— 后端行锁扣 `user_info.balance`、写 `user_balance_log`
 *     与 `finance_flow`,余额不足直接报错回滚。返回 `{verifyCode}`。
 *   - KBZPay MMQR(PAY_METHOD.MMQR=5):后端经 payment-service 向 KBZ 预下单,返回二维码串
 *     `{payMethod:5, payNo, qrCode, amount, currency, expireAt, orderExpireAt}`;
 *     用户用 KBZPay / 任意缅甸 MMQR 银行 App 扫码付款,前端轮询 `getPayStatus` 等结果
 *     (见 `screens/pay/MmqrPayScreen`)。重复调用:未过期的码复用;码过期而订单仍在支付窗口内会出新码。
 *   - Stripe(1)/PayPal(2):后端仍是 mock,客户端不调用,界面置灰 Coming soon。
 *
 * **钱包部分抵扣**(Super Admin PRD v1.0.14 模块 25):结账时钱包默认自动抵扣(`autoApply`,用户可在付款前关掉),
 * 抵扣额 = min(可用余额, 该交易类型单笔限额 `maxUse`(0 不限), 应付)。钱包不够付全额时剩余部分走其他渠道:
 * `payMethod=5` + `useWallet=1` → 后端先从钱包扣出抵扣额,二维码只收剩余金额(返回多带 `walletAmount` / `dueAmount`);
 * 钱包够付全额时客户端直接发 `payMethod=3`(后端对 `useWallet=1` 也会自动改走钱包全额)。
 * 不传 `useWallet` = 0(旧行为)。未付清就取消 / 超时,后端自动退回已扣的抵扣额。
 *
 * 可用渠道由 `getPayMethods` 按站点绑定返回,失败时调用方退化为「只有余额可用」。
 * 时间字段(expireAt / orderExpireAt / paidAt)均为 `Y-m-d H:i:s` **UTC** 字符串,
 * 解析一律走 `utils/time.parseUtcTime`,不要直接 `new Date()`(各平台会按本地时区解析)。
 */

import { get, post } from '@/api/request';

/** 支付方式(与后端 order_main.pay_method / admin-web 文案映射一致) */
export const PAY_METHOD = {
  STRIPE: 1,
  PAYPAL: 2,
  /** mTrip 钱包余额 */
  BALANCE: 3,
  /** KBZPay MMQR 扫码(4 是到店付款,客户端不发起) */
  MMQR: 5,
} as const;

export type PayMethod = (typeof PAY_METHOD)[keyof typeof PAY_METHOD];

/** 非扫码渠道的支付结果:核销码 */
export interface VerifyCodePayResult {
  verifyCode: string;
}

/** MMQR 下单结果:二维码 + 有效期 */
export interface MmqrPayResult {
  payMethod: 5;
  /** 支付流水号(轮询 `getPayStatus` 用) */
  payNo: string;
  /** 二维码内容(EMVCo MMQR 串),前端直接渲染成二维码 */
  qrCode: string;
  amount: number | string;
  currency: string;
  /** 码过期时间(UTC);早于订单过期 */
  expireAt: string;
  /** 订单支付窗口截止(UTC) */
  orderExpireAt: string;
  /** 钱包已抵扣的金额(`useWallet=1` 时;0 / 缺省 = 未用钱包) */
  walletAmount?: number | string;
  /** 二维码实际要付的剩余金额(= amount) */
  dueAmount?: number | string;
}

/** Trip 非扫码渠道结果:各预订的核销码 */
export interface TripCodesPayResult {
  codes: { orderNo: string; verifyCode: string }[];
}

export function isMmqrResult(value: unknown): value is MmqrPayResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number((value as { payMethod?: unknown }).payMethod) === PAY_METHOD.MMQR &&
    typeof (value as { qrCode?: unknown }).qrCode === 'string'
  );
}

/**
 * 对已建好的单发起支付。重载保证老调用点(余额,默认参数)仍拿到 `{verifyCode}`。
 * `useWallet`:钱包部分抵扣(见文件头);MMQR 带上它时码只收剩余金额。
 */
export function payOrder(orderId: number): Promise<VerifyCodePayResult>;
export function payOrder(
  orderId: number,
  payMethod: typeof PAY_METHOD.MMQR,
  useWallet?: boolean,
): Promise<MmqrPayResult | VerifyCodePayResult>;
export function payOrder(
  orderId: number,
  payMethod: Exclude<PayMethod, typeof PAY_METHOD.MMQR>,
  useWallet?: boolean,
): Promise<VerifyCodePayResult>;
export function payOrder(
  orderId: number,
  payMethod: PayMethod,
  useWallet?: boolean,
): Promise<VerifyCodePayResult | MmqrPayResult>;
export function payOrder(
  orderId: number,
  payMethod: PayMethod = PAY_METHOD.BALANCE,
  useWallet = false,
): Promise<VerifyCodePayResult | MmqrPayResult> {
  return post('/api/v1/app/order/pay', { orderId, payMethod, ...(useWallet ? { useWallet: 1 } : {}) });
}

/**
 * 支付整个 Trip(多房间 / 多酒店一次结账)。余额链路历史上走 `api/trip.apiTripPay`,
 * 那里保持不动;这里补 MMQR 的类型化入口。`useWallet` 同 `payOrder`。
 * 注意:`useWallet=1` 且钱包够付全额时后端会改走钱包全额,MMQR 调用也可能拿到 `{codes}`。
 */
export function payTrip(
  tripId: number,
  payMethod: typeof PAY_METHOD.MMQR,
  useWallet?: boolean,
): Promise<MmqrPayResult | TripCodesPayResult>;
export function payTrip(
  tripId: number,
  payMethod: Exclude<PayMethod, typeof PAY_METHOD.MMQR>,
  useWallet?: boolean,
): Promise<TripCodesPayResult>;
export function payTrip(
  tripId: number,
  payMethod: PayMethod,
  useWallet?: boolean,
): Promise<TripCodesPayResult | MmqrPayResult>;
export function payTrip(
  tripId: number,
  payMethod: PayMethod,
  useWallet = false,
): Promise<TripCodesPayResult | MmqrPayResult> {
  return post('/api/v1/app/order/trip/pay', { tripId, payMethod, ...(useWallet ? { useWallet: 1 } : {}) });
}

/** 支付流水状态:late = 订单已超时取消后才收到款(后端自动恢复或原路退款) */
export type PayTxStatus = 'pending' | 'paid' | 'failed' | 'closed' | 'late';

export interface PayStatusResult {
  payNo: string;
  status: PayTxStatus;
  bizType: 'order' | 'trip';
  orderId: number | null;
  tripId: number | null;
  paidAt: string | null;
  expireAt: string | null;
  orderExpireAt: string | null;
  /** 业务单状态(后端口径,前端只做透传/兜底,不依赖其取值) */
  bookingStatus: number | string | null;
}

/**
 * 查询支付状态。`refresh=true` 让服务端实时向 KBZ 查单(「我已付款」按钮用);
 * 轮询用默认 false,只读本地流水。静默:轮询失败不打扰用户。
 */
export function getPayStatus(payNo: string, refresh = false): Promise<PayStatusResult> {
  return get<PayStatusResult>(
    '/api/v1/app/order/pay/status',
    { payNo, refresh: refresh ? 1 : 0 },
    { silent: true },
  );
}

export interface PayMethodOption {
  payMethod: number;
  code: string;
  name: string;
  currencies: string[];
  enabled: boolean;
  /** 只有钱包行有:结账时是否默认自动抵扣(用户可关) */
  autoApply?: boolean;
  /** 只有钱包行有:各交易类型单笔最多可用钱包金额,0 = 不限(酒店含多预订行程用 `hotel`) */
  maxUse?: { hotel?: number | string; car?: number | string };
}

/** 本站点可用的支付渠道(后端按站点绑定返回);静默,失败由调用方退化为写死逻辑 */
export function getPayMethods(currency?: string): Promise<PayMethodOption[]> {
  return get<PayMethodOption[]>(
    '/api/v1/app/order/pay/methods',
    currency ? { currency } : undefined,
    { silent: true },
  );
}

/**
 * 某渠道是否可用:必须出现在列表里、`enabled`,且币种匹配(`currencies` 为空视为不限)。
 */
export function isMethodEnabled(
  methods: PayMethodOption[] | null,
  payMethod: number,
  currency?: string,
): boolean {
  if (!methods) return false;
  return methods.some(
    (m) =>
      Number(m.payMethod) === payMethod &&
      m.enabled &&
      (!currency || !Array.isArray(m.currencies) || m.currencies.length === 0 || m.currencies.includes(currency)),
  );
}

/**
 * 余额是否可用:接口失败(null)或没列出余额时按原有写死逻辑视为可用,
 * 只有后端**明确**给出 `enabled=false` 才灰显。
 */
export function isBalanceEnabled(methods: PayMethodOption[] | null): boolean {
  if (!methods) return true;
  const row = methods.find((m) => Number(m.payMethod) === PAY_METHOD.BALANCE);
  return row ? Boolean(row.enabled) : true;
}

/**
 * 钱包抵扣规则(取自渠道表的钱包行)。接口失败 / 没给字段时按后端默认:自动抵扣、不限额。
 */
export function walletRule(methods: PayMethodOption[] | null): { autoApply: boolean; maxUseHotel: number } {
  const row = methods?.find((m) => Number(m.payMethod) === PAY_METHOD.BALANCE);
  return {
    autoApply: row?.autoApply === undefined ? true : Boolean(row.autoApply),
    maxUseHotel: Math.max(0, Number(row?.maxUse?.hotel ?? 0) || 0),
  };
}

/**
 * 本次钱包抵扣额 = min(可用余额, 单笔限额(0 不限), 应付),与后端 `WalletHoldService::portion` 同一公式。
 * `due` 是剩余要用其他渠道付的部分;`covers` = 钱包付清全额(应付为 0 也算,按钱包支付 0 元走)。
 */
export function walletSplit(
  balance: number,
  cap: number,
  payable: number,
): { wallet: number; due: number; covers: boolean } {
  const amount = Math.max(0, Number(payable) || 0);
  let wallet = Math.min(Math.max(0, Number(balance) || 0), amount);
  if (cap > 0) wallet = Math.min(wallet, cap);
  wallet = Math.round(wallet * 100) / 100;
  const due = Math.max(0, Math.round((amount - wallet) * 100) / 100);
  return { wallet, due, covers: due < 0.005 };
}
