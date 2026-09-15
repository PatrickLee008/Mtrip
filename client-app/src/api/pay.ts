/**
 * 支付接口(order-service /api/v1/app/order/pay)
 *
 * 本期**只有余额(PAY_METHOD.BALANCE=3)是真支付** —— 后端会行锁扣 `user_info.balance`、
 * 写 `user_balance_log`(消费)与 `finance_flow`(订单支付),余额不足直接报错回滚。
 * Stripe(1)/PayPal(2) 后端仍是 mock,客户端一律不再调用,界面上置灰并提示 Coming soon。
 * 正式 Stripe/PayPal 收单拆到 payment-service 后仅需调整此文件路径。
 */

import { post } from '@/api/request';

/** 支付方式(与后端 order_main.pay_method / admin-web 文案映射一致) */
export const PAY_METHOD = {
  STRIPE: 1,
  PAYPAL: 2,
  /** mTrip 钱包余额,当前唯一可用渠道 */
  BALANCE: 3,
} as const;

export type PayMethod = (typeof PAY_METHOD)[keyof typeof PAY_METHOD];

export function payOrder(
  orderId: number,
  payMethod: PayMethod = PAY_METHOD.BALANCE,
): Promise<{ verifyCode: string }> {
  return post('/api/v1/app/order/pay', { orderId, payMethod });
}
