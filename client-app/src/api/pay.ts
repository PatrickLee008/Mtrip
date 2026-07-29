/**
 * 支付接口:本期为 order-service 内 mock(/api/v1/app/order/pay)
 * 正式 Stripe/PayPal 收单拆到 payment-service 后仅需调整此文件路径
 */

import { post } from '@/api/request';

/** payMethod:1 Stripe 2 PayPal */
export function payOrder(orderId: number, payMethod: 1 | 2): Promise<{ verifyCode: string }> {
  return post('/api/v1/app/order/pay', { orderId, payMethod });
}
