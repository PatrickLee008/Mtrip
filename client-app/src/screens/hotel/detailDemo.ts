/**
 * 酒店详情六个页签的演示数据 —— 直接照搬 Figma `Hotel Details` 759:9776 下的六张稿:
 *   Overview 94:438 / Rooms 222:1428 / Amenities 222:2539 /
 *   Location(周边)222:2758 / Reviews 222:2978 / Policies 222:3189
 *
 * 与 demoResults.ts 同一套约定:静态页阶段先把设计稿数值固化在这里,接上
 * `/goods/detail` 后逐项换成接口字段,页面结构不动。文案一律走 i18n(`hotels.detail.*`),
 * 图库走 `assets/tempImages.ts`。
 *
 * 设计稿原值(未做任何折算):
 *   标题 The Heritage Bagan Hotel / Nyaung-U, Old Bagan(与搜索结果第 1 张卡同一家酒店)
 *   三宫格 4 Star·Rating / 9.3·Excellent / 42·Booked
 *   底栏 Start at MMK 195,000,-15% TODAY,CTA「Choose my room」
 *   图库计数 2/12 —— 设计稿只导出 3 张图,页面按实际张数显示,不硬写 12
 */

import type { HomeIconName } from '@/components/home/HomeIcon';

/** 二级导航页签,顺序即设计稿顺序;当前只有 overview 有内容 */
export const DETAIL_TABS = [
  'overview',
  'rooms',
  'amenities',
  'nearby',
  'reviews',
  'policies',
] as const;

export type DetailTabKey = (typeof DETAIL_TABS)[number];

/** 三宫格(设计稿 222:1421):图标 + 主数值 + 副标题 */
export const DETAIL_STATS = [
  { key: 'star', icon: 'star' },
  { key: 'score', icon: 'like' },
  { key: 'booked', icon: 'bed' },
] as const satisfies readonly { key: string; icon: HomeIconName }[];

/** Why Guests Choose 三条(设计稿 94:528),图标 40x40,底色 --secondary */
export const DETAIL_REASONS = [
  { key: 'bestLocation', icon: 'map' },
  { key: 'greatBreakfast', icon: 'food' },
  { key: 'largeRooms', icon: 'bed' },
] as const satisfies readonly { key: string; icon: HomeIconName }[];

/**
 * 设施标签四枚(设计稿 222:1355),两行两列。
 * 这四枚字形都不是正方形,宽高按导出资产原生尺寸给,交给 HomeIcon 的 width/height。
 */
export const DETAIL_AMENITIES = [
  { key: 'familyFriendly', icon: 'familyFriendly', width: 15.375, height: 15 },
  { key: 'freeBreakfast', icon: 'breakfast', width: 11.25, height: 15 },
  { key: 'airportShuttle', icon: 'airportShuttle', width: 16.5, height: 10.5 },
  { key: 'infinityPool', icon: 'pool', width: 15, height: 13.5 },
] as const satisfies readonly { key: string; icon: HomeIconName; width: number; height: number }[];

/** 设计稿写死的数值(接上接口后逐项替换) */
export const DETAIL_DEMO = {
  /** 三宫格:星级 / 10 分制评分 / 已订间夜 */
  starLevel: 4,
  score: 9.3,
  booked: 42,
  /** 底栏起价与今日折扣 */
  priceFrom: 195_000,
  discountPercent: 15,
} as const;

/* ------------------------------------------------------- Rooms(222:1594) */

/**
 * 房型卡三张,数值即设计稿原值:
 *   Standard Room  4 Left / 2 Guests / 1 Queen / 32sq Ft   划线 195,000 +「5% off for 7Nights」→ 195,000 /night
 *   Deluxe Room   12 Left / 2 Guests / King   / 40 sq Ft   205,000
 *   Family Suite   无余量 / 4 Guests / 2 King / 50 sqm     划线 395,000 → 295,000
 * 设计稿的面积单位在 Standard/Deluxe 写 sq Ft、Family 写 sqm,页头还有个 Sq Ft ⇄ 的切换按钮 ——
 * 单位换算没有依据,这里按设计稿原样把单位跟着每张卡走,切换按钮走 comingSoon。
 */
export const DETAIL_ROOMS = [
  {
    key: 'standard',
    /** 封面右上角收藏态、左上角 Bestseller 角标(设计稿写死) */
    bestseller: true,
    favorite: true,
    /** 封面右下角是否带 360°/全景两枚按钮(设计稿只有前两张卡有) */
    viewer: true,
    /** 余量角标,null=设计稿这张卡没有 */
    left: 4,
    guests: 2,
    /** 床型文案键后缀,见 i18n hotels.detail.rooms.beds.* */
    bed: 'queen',
    /** 床图标画几个(Family Suite 是两张床) */
    bedCount: 1,
    area: 32,
    areaUnit: 'sqft',
    /** 设施小格,顺序即设计稿顺序 */
    facilities: ['wifi', 'parking', 'pool', 'breakfast'],
    /** 划线原价,null=没有 */
    strike: 195_000,
    /** 促销小字的 i18n 键,null=没有 */
    promoKey: 'hotels.results.demo.longStayOff',
    price: 195_000,
    /** 价格后面是否跟「/ night」 */
    perNight: true,
  },
  {
    key: 'deluxe',
    bestseller: true,
    favorite: true,
    viewer: true,
    left: 12,
    guests: 2,
    bed: 'king',
    bedCount: 1,
    area: 40,
    areaUnit: 'sqft',
    facilities: ['wifi', 'parking', 'pool'],
    strike: null,
    promoKey: null,
    price: 205_000,
    perNight: false,
  },
  {
    key: 'family',
    bestseller: false,
    favorite: false,
    viewer: false,
    left: null,
    guests: 4,
    bed: 'king',
    bedCount: 2,
    area: 50,
    areaUnit: 'sqm',
    facilities: ['wifi', 'parking', 'pool', 'breakfast'],
    strike: 395_000,
    promoKey: null,
    price: 295_000,
    perNight: false,
  },
] as const;

/**
 * 房型卡设施小格 → 图标与原生尺寸(设计稿 361:1445)。
 * wifi 那格设计稿配的确实是定位针字形(`fluent:location-16-regular`),且只有它是 16,其余三枚是 20。
 */
export const ROOM_FACILITY_ICONS = {
  wifi: { icon: 'locationRegular', size: 16 },
  parking: { icon: 'parking', size: 20 },
  pool: { icon: 'swimmingPool', size: 20 },
  breakfast: { icon: 'food', size: 20 },
} as const satisfies Record<string, { icon: HomeIconName; size: number }>;

/* --------------------------------------------------- Amenities(222:2705) */

/** 设施分组,顺序即设计稿顺序;每项 i18n 键为 hotels.detail.amenityList.<key> */
export const DETAIL_AMENITY_GROUPS = [
  {
    key: 'essentials',
    items: [
      { key: 'freeWifi', icon: 'wifiFilled', width: 24, height: 17 },
      { key: 'airConditioning', icon: 'airConditioning', width: 20, height: 20 },
      { key: 'housekeeping', icon: 'housekeeping', width: 18, height: 22 },
    ],
  },
  {
    key: 'recreation',
    items: [
      { key: 'outdoorPool', icon: 'outdoorPool', width: 20, height: 18 },
      { key: 'spa', icon: 'spa', width: 20, height: 20 },
      { key: 'gym', icon: 'gym', width: 19.8, height: 19.8 },
    ],
  },
  {
    key: 'dining',
    items: [
      { key: 'restaurant', icon: 'restaurant', width: 15, height: 20 },
      { key: 'bar', icon: 'bar', width: 18, height: 18 },
      { key: 'coffee', icon: 'coffee', width: 18, height: 18 },
    ],
  },
] as const satisfies readonly {
  key: string;
  items: readonly { key: string; icon: HomeIconName; width: number; height: number }[];
}[];

/** 长住折扣阶梯(设计稿 1695:6754);current 之外的档设计稿透明度 50% */
export const DETAIL_LONG_STAY_TIERS = [
  { nights: 7, percent: 5, current: true },
  { nights: 14, percent: 10, current: false },
  { nights: 30, percent: 25, current: false },
  { nights: 90, percent: 40, current: false },
] as const;

/** 长住权益(设计稿 1695:6794);strong=设计稿用粗体的那几条 */
export const DETAIL_LONG_STAY_BENEFITS = [
  { key: 'freeLaundry', strong: false },
  { key: 'freeUtilities', strong: false },
  { key: 'kitchen', strong: false },
  { key: 'workspace', strong: true },
  { key: 'petFriendly', strong: false },
  { key: 'monthlyContract', strong: true },
  { key: 'noDeposit', strong: true },
  { key: 'flexibleCancellation', strong: false },
] as const;

/* ------------------------------------------------------ Nearby(222:2910) */

/** 交通耗时卡两条(设计稿 222:2921) */
export const DETAIL_TRANSPORT = [
  { key: 'airport', icon: 'airplane', width: 20, height: 20 },
  { key: 'temples', icon: 'temple', width: 22, height: 21 },
] as const satisfies readonly { key: string; icon: HomeIconName; width: number; height: number }[];

/** 周边景点横滑卡三张(设计稿 222:2941 起) */
export const DETAIL_ATTRACTIONS = ['ananda', 'dhammayangyi', 'oldBaganMarket'] as const;

/* ----------------------------------------------------- Reviews(222:3117) */

/** 评分维度条:设计稿 4 条,进度按 5 分制折算(4.9/5=98%) */
export const DETAIL_REVIEW_SCORES = [
  { key: 'cleanliness', score: 4.9 },
  { key: 'service', score: 4.8 },
  { key: 'value', score: 4.6 },
  { key: 'comfort', score: 4.7 },
] as const;

/** 评价总览(设计稿 222:3684) */
export const DETAIL_REVIEW_SUMMARY = {
  /** 设计稿 8.8,10 分制 */
  score: 8.8,
  total: 1240,
  /** 维度条满分(设计稿维度分是 5 分制) */
  scoreMax: 5,
} as const;

/* ---------------------------------------------------- Policies(222:3503) */

/** 入住/退房两张卡(设计稿 222:3533 / 222:3556) */
export const DETAIL_CHECK_TIMES = [
  { key: 'checkIn', icon: 'checkInArrow', time: '14:00' },
  { key: 'checkOut', icon: 'checkOutArrow', time: '12:00' },
] as const satisfies readonly { key: string; icon: HomeIconName; time: string }[];

/** 入住必备证件(设计稿 222:3549) */
export const DETAIL_REQUIRED_DOCS = ['passport', 'bookingConfirmation'] as const;

/**
 * 加床政策三行(设计稿 222:3575)。
 * 设计稿这里的币种写的是「Ks 35,000」(缅甸的另一种写法),与底栏的「MMK」不一致;
 * 页面统一走 formatMoney + 站点币种,不硬写。
 */
export const DETAIL_EXTRA_BEDS = [
  { key: 'age0to5', price: null, complimentary: true },
  { key: 'age6to12', price: 35_000, complimentary: false },
  { key: 'adults', price: 50_000, complimentary: false },
] as const;

/** 住店规则三张(设计稿 222:3619 起) */
export const DETAIL_PROPERTY_RULES = [
  { key: 'smoking', icon: 'noSmoking', width: 20.6, height: 20.6 },
  { key: 'quietHours', icon: 'quietHours', width: 19.8, height: 19.8 },
  { key: 'poolHours', icon: 'poolHours', width: 20, height: 18 },
] as const satisfies readonly { key: string; icon: HomeIconName; width: number; height: number }[];
