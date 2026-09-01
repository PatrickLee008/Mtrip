/**
 * 订房流程的演示数据 —— 照搬 Figma `Multi Booking Hotel Booking Flow` 1675:5776 下的 14 张稿:
 *   Step 1 日期确认 1675:6069(加购已选态 1675:7406)/ Step 2 旅客信息 1675:6292 /
 *   Step 3 复核确认 1675:6404(单住宿变体 1675:9010)/ Step 4 Trip Details 1675:9406 /
 *   Step 4 支付 1675:6537(多住宿态 1675:9158)/ 预订成功 1675:6714 /
 *   新增旅客 1675:5777 / 旅行保险 1675:5900 / Stay 明细 1675:9677
 *
 * 与 `detailDemo.ts` / `promoSections.ts` 同一套约定:静态页阶段把设计稿数值固化在这里,
 * 接上下单接口后逐项换成接口字段,组件结构不动。文案一律走 i18n(`hotels.booking.*`)。
 *
 * **一处刻意的收敛**:设计稿自身对不上 —— Step 1 的摘要条写「Thu, 12 Oct → Sat, 14 Oct / 2 Nights」,
 * 同屏日历却高亮 2026 年 6 月的 12–14,而 Step 3/4/成功页又写「4 Jun – 5 Jun (1 Night)」。
 * 这里以出现次数最多、且与价格行「(1 night)」自洽的 **2026-06-04 → 2026-06-05** 为准,
 * 日历随之高亮 6 月 4–5;晚数不再硬写,由实际选择推导。金额沿用设计稿原值。
 */

import type { HomeIconName } from '@/components/home/HomeIcon';

/* ------------------------------------------------------------------ 步骤序列 */

/**
 * 向导步骤。`trip` 只在多住宿时出现;`payment` 在多住宿态没有进度条
 * (设计稿 1675:9158 确实没画),故它不占进度格。
 */
export const BOOKING_STEPS = ['dates', 'guests', 'review', 'trip', 'payment'] as const;
export type BookingStepKey = (typeof BOOKING_STEPS)[number];

/** 进度条固定 4 格(设计稿 Step n of 4) */
export const BOOKING_PROGRESS_TOTAL = 4;

/* -------------------------------------------------------------------- 主数据 */

export const BOOKING_DEMO = {
  /** 复用搜索结果 / 详情页同一家酒店的文案键 `hotels.results.demo.heritageBagan.*` */
  hotelKey: 'heritageBagan',
  /** 复用 Rooms 页签的房型键(封面走 TEMP_ROOM_COVERS.deluxe,与设计稿是同一张图) */
  roomKey: 'deluxe',
  checkIn: '2026-06-04',
  checkOut: '2026-06-05',
  adults: 2,
  children: 0,
  rooms: 1,

  /** 价格明细(设计稿原值,单位为站点币种的最小展示单位) */
  originalPrice: 195_000,
  roomPrice: 185_000,
  taxPercent: 10,
  taxes: 18_500,
  total: 195_000,
  /** 「Earn N Points」徽章 */
  points: 1_250,

  /** 支付页 mTrip 钱包卡 */
  walletBalance: 250_000,
  /** 返现横幅 */
  cashbackPercent: 5,
  cashbackAmount: 12_500,

  /** 成功页 */
  referenceId: 'MT-2025-123456',
  paidTotal: 185_000,
} as const;

/**
 * 一段住宿的完整形状 —— Step 3 复核、Trip 明细、Stay 明细页三处共用。
 * 接下单接口后这就是「一条 stay 行」的字段清单。
 */
export interface BookingStay {
  key: string;
  hotelKey: string;
  roomKey: string;
  /** `YYYY-MM-DD` */
  checkIn: string;
  checkOut: string;
  adults: number;
  childCount: number;
  rooms: number;
  addons: BookingAddonKey[];
  originalPrice: number;
  roomPrice: number;
  taxPercent: number;
  taxes: number;
  total: number;
  points: number;
}

/** 第二段住宿(Add More Stay 之后加进 Trip 的那条,设计稿 1675:9406 的 Stay 2) */
export const BOOKING_SECOND_STAY = {
  hotelKey: 'heritageBagan',
  roomKey: 'deluxe',
  checkIn: '2026-06-06',
  checkOut: '2026-06-08',
  rooms: 1,
  adults: 2,
  children: 0,
  originalPrice: 195_000,
  roomPrice: 185_000,
  taxPercent: 10,
  taxes: 18_500,
  total: 195_000,
  points: 1_250,
} as const;

/* -------------------------------------------------------------------- 加购项 */

/**
 * Enhance Your Stay 三张卡。前两张有封面照(设计稿 1675:6218 / 1675:6235),
 * 第三张保险没有照片、且点「Add to booking」跳独立的 Travel Protection 页(1675:5900)。
 */
export const BOOKING_ADDONS = [
  { key: 'breakfast', price: 20_000, cover: true, route: null },
  { key: 'transfer', price: 30_000, cover: true, route: null },
  { key: 'insurance', price: 30_000, cover: false, route: 'Insurance' },
] as const satisfies readonly {
  key: string;
  price: number;
  cover: boolean;
  route: 'Insurance' | null;
}[];

export type BookingAddonKey = (typeof BOOKING_ADDONS)[number]['key'];

/* -------------------------------------------------------------------- 支付页 */

/** Popular Payment Method 三项(图标走 TEMP_PAY_ICONS) */
export const PAYMENT_POPULAR = ['mmqr', 'kbzpay', 'wavepay'] as const;
/** Other Payment Methods 里两项可直接单选的 */
export const PAYMENT_OTHER = ['wallet', 'hotel'] as const;
/** 「Credit/debit Cards」展开后的已存卡(设计稿 440:1170) */
export const SAVED_CARDS = [{ key: 'visa3456', brand: 'visa', last4: '3456', expires: '09/26' }];
/** 卡组织标(展示框高 16,宽按素材原生比例) */
export const CARD_BRANDS = [
  { key: 'mpu', width: 44 },
  { key: 'visa', width: 49 },
  { key: 'mastercard', width: 27 },
] as const;
/** Mobile Banking 行下方的两枚小标(设计稿复用了 KBZPay / Wave Pay 的图) */
export const MOBILE_BANKING_BRANDS = ['kbzpay', 'wavepay'] as const;

export type PaymentMethodKey =
  | (typeof PAYMENT_POPULAR)[number]
  | (typeof PAYMENT_OTHER)[number]
  | 'card'
  | 'mobileBanking';

/** 底部三枚合规标(设计稿 1675:6687,整块 60% 不透明度) */
export const TRUST_BADGES = [
  { key: 'ssl', icon: 'lockSmall', width: 9.333, height: 12.25 },
  { key: 'pci', icon: 'shieldCheckSmall', width: 9.333, height: 11.667 },
  { key: 'support', icon: 'headset', width: 11.667, height: 10.5 },
] as const satisfies readonly {
  key: string;
  icon: HomeIconName;
  width: number;
  height: number;
}[];

/*
 * 新增旅客页原有的性别 / NRC 段码 / 国籍 / 出生日期年份四组常量已删除:
 * 那一页已接后端 `user_traveler`,只保留表里有的字段(见 screens/hotel/AddGuestScreen.tsx 的说明),
 * 证件类型改用 `config/global.ts` 的 `TRAVELER_ID_TYPES`。
 */

/* ---------------------------------------------------------------- 旅行保险页 */

/** 「Number of person」下拉(设计稿示例 1 Person) */
export const INSURANCE_PERSON_OPTIONS = [1, 2, 3, 4] as const;
/** 「Extend your coverage by up to 30 days」下拉(设计稿示例 3 days) */
export const INSURANCE_DAY_OPTIONS = [3, 7, 14, 30] as const;

/** 保障范围两条(设计稿 1675:5996 / 1675:6004) */
export const INSURANCE_BENEFITS = [
  { key: 'accidentalDeath', amount: 10_000_000 },
  { key: 'medical', amount: 1_000_000 },
] as const;

/** 三枚说明胶囊(设计稿 1675:6019/6021/6023),都没有对应二级页 */
export const INSURANCE_LINKS = ['eligibility', 'terms', 'cancellation'] as const;

/** 保险页顶部的「N days covered」 */
export const INSURANCE_DEFAULT_DAYS = 3;
export const INSURANCE_DEFAULT_PERSONS = 1;

/* ------------------------------------------------------------------ 成功页 */

/** 凭证卡下方两枚胶囊(设计稿 1675:6739 / 1675:6741,底色略有差别) */
export const VOUCHER_TAGS = [
  { key: 'room', bg: '#DDE1FF' },
  { key: 'breakfast', bg: '#DBE2FA' },
] as const;
