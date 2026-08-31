/**
 * 优惠中心的设计稿静态数据(Figma M-Trip / Promotion 1633:3300)
 *
 * 后端还没有活动/优惠券接口(payment-service 与 marketing-service 都没有对应路由),
 * 这里照搬设计稿的三段券列表与活动信息,文案全部走 i18n 键,接口就绪后逐项替换即可,
 * 组件不用动。券码/日期这类「值」不进 i18n,直接留在这里。
 */

import type { HomeIconName } from '@/components/home/HomeIcon';

/** 券的品类(决定左侧色块的图标与文案) */
export type CouponCategory = 'hotels' | 'food' | 'ride';
/** 券的状态(决定右下角按钮) */
export type CouponState = 'claim' | 'expired' | 'use';
/** 右上角角标(决定文案与配色) */
export type CouponBadge = 'newUser' | 'newUserExclusive' | 'limited' | 'popular';
/** 券的标题/副标题走 promotions.items.<key> */
export type CouponItem = 'hotelSave' | 'freeDelivery' | 'rideOff' | 'hotelWeekend';

export interface DemoCoupon {
  key: string;
  category: CouponCategory;
  /** 券码,设计稿多数卡写的就是占位串 COUPONCODE */
  code: string;
  badge: CouponBadge;
  item: CouponItem;
  /** 到期日,设计稿三段都是同一天 */
  expiry: string;
  state: CouponState;
}

export interface DemoSection {
  /** 走 promotions.sections.<key> */
  key: 'weekly' | 'monthly' | 'hotel';
  coupons: DemoCoupon[];
}

/** 品类 → 左色块图标(设计稿 fluent:building / food / vehicle-car-profile) */
export const CATEGORY_ICONS: Record<CouponCategory, HomeIconName> = {
  hotels: 'building',
  food: 'food',
  ride: 'carProfile',
};

const EXPIRY = '31 Jul 2026';

/** 设计稿 1328:2624 Coupon Sections 的三段 */
export const PROMO_SECTIONS: DemoSection[] = [
  {
    key: 'weekly',
    coupons: [
      { key: 'w1', category: 'hotels', code: 'COUPONCODE', badge: 'newUser', item: 'hotelSave', expiry: EXPIRY, state: 'claim' },
      { key: 'w2', category: 'food', code: 'COUPONCODE', badge: 'limited', item: 'freeDelivery', expiry: EXPIRY, state: 'expired' },
      { key: 'w3', category: 'ride', code: 'COUPONCODE', badge: 'popular', item: 'rideOff', expiry: EXPIRY, state: 'use' },
    ],
  },
  {
    key: 'monthly',
    coupons: [
      { key: 'm1', category: 'hotels', code: 'SAVE20', badge: 'newUserExclusive', item: 'hotelSave', expiry: EXPIRY, state: 'claim' },
      { key: 'm2', category: 'food', code: 'COUPONCODE', badge: 'limited', item: 'freeDelivery', expiry: EXPIRY, state: 'expired' },
      { key: 'm3', category: 'ride', code: 'COUPONCODE', badge: 'popular', item: 'rideOff', expiry: EXPIRY, state: 'use' },
    ],
  },
  {
    key: 'hotel',
    coupons: [
      { key: 'h1', category: 'hotels', code: 'COUPONCODE', badge: 'newUser', item: 'hotelSave', expiry: EXPIRY, state: 'claim' },
      { key: 'h2', category: 'hotels', code: 'COUPONCODE', badge: 'limited', item: 'hotelSave', expiry: EXPIRY, state: 'expired' },
      { key: 'h3', category: 'hotels', code: 'COUPONCODE', badge: 'popular', item: 'hotelWeekend', expiry: EXPIRY, state: 'use' },
    ],
  },
];

/** 「关于本活动」下方条款列表的键顺序(设计稿 1328:2728) */
export const TERMS_KEYS = [
  'claimFirst',
  'onePerBooking',
  'noCash',
  'periodOnly',
  'selectedHotels',
  'minimumSpend',
  'availability',
  'mtripRights',
] as const;

/** 「使用说明」弹层的三步(设计稿 1626:3220) */
export const HOW_TO_USE_STEPS = ['claim', 'choose', 'checkout'] as const;

/**
 * 「我的优惠券」页签的已领券(设计稿 1429:2110 里只有第三张卡是可见的,
 * 前两张是 hidden 的设计稿备选)
 */
export const CLAIMED_COUPONS: DemoCoupon[] = [
  { key: 'c1', category: 'ride', code: 'SAVE20', badge: 'newUserExclusive', item: 'rideOff', expiry: EXPIRY, state: 'use' },
];

/** 券详情页(设计稿 1625:2009)的静态内容 */
export const COUPON_DETAIL = {
  category: 'hotels' as CouponCategory,
  code: 'SAVE20',
  badge: 'newUserExclusive' as CouponBadge,
  expiry: EXPIRY,
  /** 条款列表的键顺序(设计稿 1626:3160) */
  termsKeys: ['onePerBooking', 'noCombine', 'periodOnly', 'elitePartners'] as const,
};
