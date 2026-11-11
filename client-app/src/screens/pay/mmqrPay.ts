/**
 * MMQR 扫码支付与钱包部分抵扣的公共入口(订房向导 / 预订详情 / 订单详情 / 结果页 / 扫码页共用)
 *
 * 对**已建好的单**调 `order/pay` 或 `trip/pay`(payMethod=5)拿二维码,再进 `MmqrPayScreen`。
 * 后端对同一张单重复调用会复用未过期的码,所以「去支付」「重新支付」直接调这里即可,不会重复下单。
 *
 * 钱包部分抵扣(Super Admin PRD v1.0.14 模块 25,规则见 `api/pay` 文件头):
 *   `useWallet=true` 时后端先从钱包扣出抵扣额,码只收剩余金额;**同一张单的后续调用(刷新二维码)必须带同一个值** ——
 *   后端见到 `useWallet=0` 会把之前冻结的抵扣额退回钱包、改为整单扫码。
 *   钱包够付全额时后端会直接改走钱包支付(返回核销码而不是二维码),所以 `requestMmqr` 返回联合类型。
 */

import {
  PAY_METHOD,
  isMmqrResult,
  payOrder,
  payTrip,
  walletRule,
  walletSplit,
  type MmqrPayResult,
  type PayMethodOption,
} from '@/api/pay';
import type { RootStackParamList } from '@/navigation/types';

export interface MmqrTarget {
  orderId?: number;
  /** > 0 时按整车(Trip)支付 */
  tripId?: number;
  /** 钱包部分抵扣:先扣钱包,码只收剩余 */
  useWallet?: boolean;
}

/** 后端判定钱包够付全额、已直接用钱包付清(没有二维码) */
export interface WalletPaidResult {
  paidByWallet: true;
}

export function isWalletPaid(value: unknown): value is WalletPaidResult {
  return typeof value === 'object' && value !== null && (value as WalletPaidResult).paidByWallet === true;
}

/** 取(或复用)二维码;tripId > 0 优先整车 */
export async function requestMmqr(target: MmqrTarget): Promise<MmqrPayResult | WalletPaidResult> {
  let res: unknown;
  const useWallet = Boolean(target.useWallet);
  if (target.tripId && target.tripId > 0) {
    res = await payTrip(target.tripId, PAY_METHOD.MMQR, useWallet);
  } else if (target.orderId && target.orderId > 0) {
    res = await payOrder(target.orderId, PAY_METHOD.MMQR, useWallet);
  } else {
    throw new Error('Missing orderId / tripId');
  }
  if (isMmqrResult(res)) return res;
  /* useWallet=1 而钱包够付:后端改走钱包全额,返回 {verifyCode} / {codes} */
  if (useWallet && typeof res === 'object' && res !== null && ('verifyCode' in res || 'codes' in res)) {
    return { paidByWallet: true };
  }
  throw new Error('Invalid MMQR response');
}

/** pay 接口返回 → `MmqrPay` 路由参数 */
export function mmqrRouteParams(
  res: MmqrPayResult,
  extra: Omit<
    RootStackParamList['MmqrPay'],
    'payNo' | 'qrCode' | 'amount' | 'currency' | 'expireAt' | 'orderExpireAt' | 'walletAmount'
  >,
): RootStackParamList['MmqrPay'] {
  return {
    payNo: res.payNo,
    qrCode: res.qrCode,
    amount: res.amount,
    currency: res.currency,
    expireAt: res.expireAt,
    orderExpireAt: res.orderExpireAt,
    walletAmount: Number(res.walletAmount ?? 0) || 0,
    ...extra,
  };
}

/** 对已有待支付单发起支付的结果 */
export type PendingPayOutcome =
  | { kind: 'paid' }
  | { kind: 'mmqr'; res: MmqrPayResult; useWallet: boolean }
  /** 钱包不够(余额或单笔限额)而站点又没开通可补差额的渠道 */
  | { kind: 'insufficient' };

/**
 * 「立即支付」一张**已有的**待支付单(预订详情 / 订单详情 / 结果页重付),规则与订房向导一致:
 * 钱包默认抵扣 min(余额, 酒店单笔限额, 应付) ——
 *   够付全额 → `payMethod=3`;
 *   不够且站点开通了 MMQR → MMQR + `useWallet=1`,码只收剩余(之前已冻结过抵扣额的单,后端直接复用);
 *   不够且没有可补差额的渠道 → `insufficient`,由调用方提示。
 * `autoApply` 被后台关掉时不自动抵扣:整单走 MMQR(没有 MMQR 才退回钱包全额)。
 */
export async function payPendingWithWallet(
  target: { orderId?: number; tripId?: number },
  ctx: { payable: number; balance: number; methods: PayMethodOption[] | null; mmqrEnabled: boolean },
): Promise<PendingPayOutcome> {
  const rule = walletRule(ctx.methods);
  const split = walletSplit(ctx.balance, rule.maxUseHotel, ctx.payable);
  const preferWallet = rule.autoApply || !ctx.mmqrEnabled;
  if (preferWallet && split.covers) {
    if (target.tripId && target.tripId > 0) await payTrip(target.tripId, PAY_METHOD.BALANCE);
    else if (target.orderId) await payOrder(target.orderId, PAY_METHOD.BALANCE);
    else throw new Error('Missing orderId / tripId');
    return { kind: 'paid' };
  }
  if (!ctx.mmqrEnabled) return { kind: 'insufficient' };
  /**
   * 自动抵扣开着就一律带 useWallet=1(哪怕本地算出可抵 0):之前已冻结过抵扣额的单(扫码页退出后回来重付),
   * 余额已被扣过,本地看是 0,但带 0 过去后端会把冻结额退回、改成整单扫码。
   */
  const useWallet = rule.autoApply;
  const res = await requestMmqr({ ...target, useWallet });
  if (isWalletPaid(res)) return { kind: 'paid' };
  return { kind: 'mmqr', res, useWallet };
}
