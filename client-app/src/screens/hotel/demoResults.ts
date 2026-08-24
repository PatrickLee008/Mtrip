/**
 * 酒店搜索结果的演示数据 —— **直接照搬 Figma `Long Stay Search Results` 1695:6325 的四张卡**
 *
 * 与 myPickSections.ts 同一套约定:接口有数据就用接口,**接口为空或没连通时**用设计稿数据把页面
 * 渲染成设计稿的样子;示例卡 id 取负数,避免与真实商品 id 冲突(点卡片不跳详情、点心不发请求)。
 * 名称/地址/促销文案走 i18n(`hotels.results.demo.*`),封面走 `assets/tempImages.ts`。
 *
 * 设计稿原值(未做任何折算):
 *   1 The Heritage Bagan Hotel   Nyaung-U, Old Bagan        ★5  9.3 (1,230)  EXCELLENT
 *     划线 195,000 +「5% off for 7Nights」 主价 195,000  PREFERRED
 *   2 Aureum Palace Resort       Min Nanthu Village, Bagan  ★4  7.8 (1,230)  EXCELLENT
 *     划线 195,000 / 185,000 +「SUMMER PROMO」「5% off for 7Nights」 主价 175,000  HIGH DEMAND
 *   3 Thiripyitsaya Sanctuary Resort  River Side, Old Bagan ★3  4.3 (162)
 *     「Long Stay Not Supported」 主价 195,000  BEST SELLER
 *   4 Bagan Lodge                New Bagan                  ★3  4.3 (162)   主价 155,000
 *
 * 注意:设计稿的评分是 **10 分制**,后端 `goods_review.rating` 是 5 分制。演示数据按设计稿原样展示,
 * 接入真实评分后卡片会自然变成 5 分制(卡片只负责把数值打出来)。
 *   只有前两张卡有设计稿导出的图(复用 My Pick 那两张),后两张走 CoverImage 的渐变占位。
 */

import type { ImageSourcePropType } from 'react-native';

import { TEMP_HOTEL_COVERS } from '@/assets/tempImages';
import type { GoodsSortBy } from '@/api/goods';
import type { CardBadge, CardPromo } from '@/components/hotel/HotelResultCard';
import type { GoodsItem } from '@/types/models';

/** 演示卡的 i18n / 封面键,顺序即设计稿顺序 */
export const DEMO_KEYS = ['heritageBagan', 'aureumPalace', 'thiripyitsaya', 'baganLodge'] as const;

export type DemoKey = (typeof DEMO_KEYS)[number];

/** id → i18n 键(卡片渲染时按 id 反查;id 为负即演示卡) */
export const DEMO_KEY_BY_ID: Record<number, DemoKey> = {
  '-1': 'heritageBagan',
  '-2': 'aureumPalace',
  '-3': 'thiripyitsaya',
  '-4': 'baganLodge',
};

/** 演示封面;没有对应素材的卡留空,CoverImage 自动回落到渐变占位 */
export const DEMO_COVERS: Partial<Record<DemoKey, ImageSourcePropType>> = {
  heritageBagan: TEMP_HOTEL_COVERS.heritageBagan,
  aureumPalace: TEMP_HOTEL_COVERS.strandSuites,
};

const base = {
  goods_type: 1,
  category_id: 0,
  goods_name: '',
  goods_brief: '',
  cover_image: '',
  address: '',
  longitude: null,
  latitude: null,
} as const;

export const DEMO_RESULTS: GoodsItem[] = [
  {
    ...base,
    id: -1,
    star_level: 5,
    is_recommend: 1,
    is_hot: 0,
    sales_count: 320,
    minPrice: 195_000,
    rating: 9.3,
    reviewCount: 1230,
  },
  {
    ...base,
    id: -2,
    star_level: 4,
    is_recommend: 0,
    is_hot: 1,
    sales_count: 260,
    minPrice: 175_000,
    rating: 7.8,
    reviewCount: 1230,
  },
  {
    ...base,
    id: -3,
    star_level: 3,
    is_recommend: 0,
    is_hot: 0,
    sales_count: 140,
    minPrice: 195_000,
    rating: 4.3,
    reviewCount: 162,
  },
  {
    ...base,
    id: -4,
    star_level: 3,
    is_recommend: 0,
    is_hot: 0,
    sales_count: 90,
    minPrice: 155_000,
    rating: 4.3,
    reviewCount: 162,
  },
];

/** 设计稿里每张卡的封面右下角评价档徽章(第三、四张没有) */
export const DEMO_RATING_TIER: Record<DemoKey, string | null> = {
  heritageBagan: 'excellent',
  aureumPalace: 'excellent',
  thiripyitsaya: null,
  baganLodge: null,
};

/** 设计稿里每张卡的右下角徽章 */
export const DEMO_BADGE: Record<DemoKey, { textKey: string; tone: CardBadge['tone'] } | null> = {
  heritageBagan: { textKey: 'home.stays.preferred', tone: 'tint' },
  aureumPalace: { textKey: 'hotels.results.highDemand', tone: 'hot' },
  thiripyitsaya: { textKey: 'hotels.results.bestSeller', tone: 'soft' },
  baganLodge: null,
};

/** 设计稿里每张卡的促销小行(文案键 + 划线原价) */
export const DEMO_PROMO: Record<
  DemoKey,
  { strike?: number[]; tags?: { textKey: string; tone: NonNullable<CardPromo['tags']>[number]['tone'] }[] } | null
> = {
  heritageBagan: {
    strike: [195_000],
    tags: [{ textKey: 'hotels.results.demo.longStayOff', tone: 'primary' }],
  },
  aureumPalace: {
    strike: [195_000, 185_000],
    tags: [
      { textKey: 'hotels.results.demo.summerPromo', tone: 'hot' },
      { textKey: 'hotels.results.demo.longStayOff', tone: 'primary' },
    ],
  },
  thiripyitsaya: {
    tags: [{ textKey: 'hotels.results.demo.longStayNotSupported', tone: 'orange' }],
  },
  baganLodge: null,
};

/** 演示卡的设施标记,让 chips 在演示态下也能真的筛出东西 */
const DEMO_TAGS: Record<DemoKey, { breakfast: boolean; freeCancel: boolean; wifi: boolean }> = {
  heritageBagan: { breakfast: true, freeCancel: true, wifi: true },
  aureumPalace: { breakfast: true, freeCancel: false, wifi: true },
  thiripyitsaya: { breakfast: false, freeCancel: true, wifi: true },
  baganLodge: { breakfast: false, freeCancel: false, wifi: false },
};

interface DemoQuery {
  /** 已选中的 chips(与页面的 ChipKey 同名) */
  chips: string[];
  /** 关键词:比照后端对 goods_name / address 的 LIKE */
  keyword: string;
  sortBy: GoodsSortBy;
  /** 名称/地址是按 i18n 渲染的,关键词匹配得由页面把译文喂进来 */
  textOf: (key: DemoKey) => string;
}

/** 按当前筛选与排序过一遍演示数据(纯前端,行为对齐后端 applyFilters/applySort) */
export function queryDemoResults({ chips, keyword, sortBy, textOf }: DemoQuery): GoodsItem[] {
  const kw = keyword.trim().toLowerCase();
  const list = DEMO_RESULTS.filter((g) => {
    const tags = DEMO_TAGS[DEMO_KEY_BY_ID[g.id]];
    /* 设计稿评分是 10 分制,「Rating 4+」这里按同一口径比 4 */
    if (chips.includes('rating4') && (g.rating ?? 0) < 4) return false;
    if (chips.includes('freeCancellation') && !tags.freeCancel) return false;
    if (chips.includes('breakfast') && !tags.breakfast) return false;
    if (chips.includes('freeWifi') && !tags.wifi) return false;
    if (kw && !textOf(DEMO_KEY_BY_ID[g.id]).toLowerCase().includes(kw)) return false;
    return true;
  });

  const sorted = [...list];
  switch (sortBy) {
    case 'price_asc':
      sorted.sort((a, b) => a.minPrice - b.minPrice);
      break;
    case 'price_desc':
      sorted.sort((a, b) => b.minPrice - a.minPrice);
      break;
    case 'star':
      sorted.sort((a, b) => b.star_level - a.star_level);
      break;
    case 'rating':
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case 'sales':
      sorted.sort((a, b) => b.sales_count - a.sales_count);
      break;
    default:
      /* default / new / distance:保持设计稿的排列顺序 */
      break;
  }
  return sorted;
}
