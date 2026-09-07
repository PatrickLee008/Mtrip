/**
 * 优惠券展示口径(C-M6.1)
 *
 * 后端 `App\Service\CouponView` 已经把「券类型 / 优惠值 / 门槛 / 封顶 / 适用酒店房型 /
 * 有效期 / 叠加规则 / 状态 / 不可用原因」统一成一套字段,这里只负责把那套字段翻成
 * 卡片要显示的几行文字 —— 领券中心、活动详情、我的券、券详情四处共用,
 * 不允许各页各写一套(否则同一张券在不同页面会显示成不同金额/不同状态)。
 *
 * 文案一律走 i18n;金额按站点币种格式化。
 */

import type { TFunction } from 'i18next';

import type { CouponReason, CouponStatus, CouponView } from '@/types/models';
import { formatMoney } from '@/utils/format';
import type { CouponBadge, CouponCategory, DemoCoupon } from '@/screens/promotions/promoSections';

/** 卡片按钮的形态(决定文案与是否可点) */
export type CouponAction = 'claim' | 'use' | 'used' | 'expired' | 'unavailable';

/** CouponCard 的入参:全部是已经翻好的成品文字,组件不再自己 t() */
export interface CouponCardModel {
  key: string;
  category: CouponCategory;
  /** 券码行:已领取显示券码,未领取显示券名 */
  codeLine: string;
  badge: CouponBadge | null;
  title: string;
  desc: string;
  /** 已含「Exp」前缀 */
  expiryText: string;
  action: CouponAction;
  actionLabel: string;
  /** 按钮是否可点 */
  disabled: boolean;
}

/** goods_scope → 卡片左侧品类色块(0 全部 / 1 酒店 / 2 门票 / 3 指定商品按酒店处理) */
export function categoryOf(view: CouponView): CouponCategory {
  if (view.goods_scope === 1 || view.goods_scope === 3) return 'hotels';
  if (view.goods_scope === 2) return 'tickets';
  return 'all';
}

/** 状态 → 按钮形态 */
export function actionOf(status: CouponStatus): CouponAction {
  switch (status) {
    case 'claimable':
      return 'claim';
    case 'available':
      return 'use';
    case 'used':
      return 'used';
    case 'expired':
    case 'void':
      return 'expired';
    default:
      // unclaimable / unusable:按钮位显示具体原因
      return 'unavailable';
  }
}

/** 优惠值主标题:满减/无门槛 = 金额,折扣 = 百分比(后端是 10 分制,8.5 折 = 15% OFF) */
export function discountTitle(view: CouponView, t: TFunction, currency: string): string {
  if (view.coupon_type === 2) {
    const percent = Math.round((10 - view.discount_value) * 10);
    return t('promotions.coupon.percentOff', { percent });
  }
  return t('promotions.coupon.amountOff', { amount: formatMoney(view.discount_value, currency) });
}

/** 副标题:有门槛显示最低消费,无门槛直说无门槛 */
export function thresholdText(view: CouponView, t: TFunction, currency: string): string {
  if (view.min_amount > 0) {
    return t('promotions.coupon.minSpend', { amount: formatMoney(view.min_amount, currency) });
  }
  return t('promotions.coupon.noMinSpend');
}

/** 有效期一行:固定区间给日期;领后N天型(尚未领取)给天数;都没有则不限期 */
export function expiryText(view: CouponView, t: TFunction): string {
  if (view.valid_end) {
    return t('promotions.coupon.expiry', { date: formatCouponDate(view.valid_end) });
  }
  if (view.valid_type === 2 && (view.valid_days ?? 0) > 0) {
    return t('promotions.coupon.validDays', { days: view.valid_days });
  }
  return t('promotions.coupon.noExpiry');
}

/** 不可领 / 不可用原因文案 */
export function reasonText(reason: CouponReason | null, t: TFunction): string {
  if (!reason) return '';
  return t(`promotions.coupon.reasons.${reason}`);
}

/**
 * 角标:真实券没有「新用户 / 热门」这种运营标签,能从数据里如实推出来的只有
 * 「限量发行」(设了发行总量)。推不出来的一律不显示,不拿运营标签硬套。
 */
function badgeOf(view: CouponView): CouponBadge | null {
  return (view.total_count ?? 0) > 0 ? 'limited' : null;
}

/** CouponView → 卡片模型 */
export function toCouponCard(view: CouponView, t: TFunction, currency: string): CouponCardModel {
  const action = actionOf(view.status);
  const disabled = action !== 'claim' && action !== 'use';
  return {
    key: view.receive_id > 0 ? `r${view.receive_id}` : `c${view.coupon_id}`,
    category: categoryOf(view),
    codeLine: view.coupon_code || view.coupon_name,
    badge: badgeOf(view),
    title: discountTitle(view, t, currency),
    desc: thresholdText(view, t, currency),
    expiryText: expiryText(view, t),
    action,
    actionLabel:
      action === 'unavailable'
        ? reasonText(view.unusableReason, t)
        : t(`promotions.coupon.actions.${action}`),
    disabled,
  };
}

/** 设计稿示例券 → 同一个卡片模型(未登录时的兜底展示,与真实券共用组件) */
export function demoToCouponCard(demo: DemoCoupon, t: TFunction): CouponCardModel {
  const action: CouponAction = demo.state === 'claim' ? 'claim' : demo.state === 'use' ? 'use' : 'expired';
  return {
    key: demo.key,
    category: demo.category,
    codeLine: demo.code,
    badge: demo.badge,
    title: t(`promotions.items.${demo.item}.title`),
    desc: t(`promotions.items.${demo.item}.desc`),
    expiryText: t('promotions.coupon.expiry', { date: demo.expiry }),
    action,
    actionLabel: t(`promotions.coupon.actions.${action}`),
    disabled: action === 'expired',
  };
}

/** 有效期日期:设计稿写法「31 Jul 2026」 */
export function formatCouponDate(input: string): string {
  const d = new Date(input.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return input;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
