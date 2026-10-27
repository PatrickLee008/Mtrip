/**
 * MMQR 扫码支付的公共入口(订房向导 / 预订详情 / 订单详情共用)
 *
 * 对**已建好的单**调 `order/pay` 或 `trip/pay`(payMethod=5)拿二维码,再进 `MmqrPayScreen`。
 * 后端对同一张单重复调用会复用未过期的码,所以「去支付」「重新支付」直接调这里即可,不会重复下单。
 */

import { PAY_METHOD, isMmqrResult, payOrder, payTrip, type MmqrPayResult } from '@/api/pay';
import type { RootStackParamList } from '@/navigation/types';

export interface MmqrTarget {
  orderId?: number;
  /** > 0 时按整车(Trip)支付 */
  tripId?: number;
}

/** 取(或复用)二维码;tripId > 0 优先整车 */
export async function requestMmqr(target: MmqrTarget): Promise<MmqrPayResult> {
  let res: unknown;
  if (target.tripId && target.tripId > 0) {
    res = await payTrip(target.tripId, PAY_METHOD.MMQR);
  } else if (target.orderId && target.orderId > 0) {
    res = await payOrder(target.orderId, PAY_METHOD.MMQR);
  } else {
    throw new Error('Missing orderId / tripId');
  }
  if (!isMmqrResult(res)) throw new Error('Invalid MMQR response');
  return res;
}

/** pay 接口返回 → `MmqrPay` 路由参数 */
export function mmqrRouteParams(
  res: MmqrPayResult,
  extra: Omit<RootStackParamList['MmqrPay'], 'payNo' | 'qrCode' | 'amount' | 'currency' | 'expireAt' | 'orderExpireAt'>,
): RootStackParamList['MmqrPay'] {
  return {
    payNo: res.payNo,
    qrCode: res.qrCode,
    amount: res.amount,
    currency: res.currency,
    expireAt: res.expireAt,
    orderExpireAt: res.orderExpireAt,
    ...extra,
  };
}
