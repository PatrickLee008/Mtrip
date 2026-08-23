/**
 * 我的精选静态区块数据(Figma M-Trip / My Pick 289:1112)
 *
 * 与 homeSections.ts 同一套约定:后端已有接口的区块走接口,接口为空或未登录时用设计稿示例兜底;
 * 后端完全没有对应数据的区块(收藏餐厅 —— goods_type 目前只有 1酒店/2门票)先以常量驱动。
 * 文案统一走 i18n key,便于后续逐个换成接口数据。
 */

import type { GoodsItem } from '@/types/models';

/** 订单三分类页签(与 config/global.ts 的 ORDER_STATUS 对应) */
export const MY_PICK_TABS = ['upcoming', 'completed', 'cancelled'] as const;

export type MyPickTab = (typeof MY_PICK_TABS)[number];

/**
 * 页签 → 订单状态集合。
 * 后端 /order/list 只接受单个 status,故这里在前端按集合过滤整页结果。
 */
export const TAB_STATUS: Record<MyPickTab, number[]> = {
  upcoming: [0, 1],
  completed: [2, 3],
  cancelled: [4, 5, 6, 7],
};

/**
 * 收藏酒店兜底数据(设计稿 Save Hotels 两张卡)。
 * 复用首页 StayCard,故按 GoodsItem 造形;id 取负数,避免与真实商品 id 冲突。
 */
export const SAMPLE_SAVED_HOTELS: GoodsItem[] = [
  {
    id: -1,
    goods_type: 1,
    category_id: 0,
    goods_name: '',
    goods_brief: '',
    cover_image: '',
    address: '',
    longitude: null,
    latitude: null,
    star_level: 4.9,
    is_recommend: 1,
    is_hot: 0,
    sales_count: 0,
    minPrice: 185000,
  },
  {
    id: -2,
    goods_type: 1,
    category_id: 0,
    goods_name: '',
    goods_brief: '',
    cover_image: '',
    address: '',
    longitude: null,
    latitude: null,
    star_level: 5,
    is_recommend: 0,
    is_hot: 0,
    sales_count: 0,
    minPrice: 185000,
  },
];

/** 兜底卡片的 i18n key(name/address 在渲染时按序回填) */
export const SAMPLE_SAVED_HOTEL_KEYS = ['heritageBagan', 'strandSuites'] as const;

/** 收藏餐厅(设计稿 Save Restaurants,后端暂无餐饮品类) */
export interface SavedRestaurant {
  key: string;
  /** 评分,设计稿星形图标右侧数值 */
  rating: number;
  /** 距离,如 1.2km */
  distance: string;
  /** 配送时长,如 25-35 min */
  duration: string;
  /** 配送费(MMK,分位由 formatMoney 处理);未设置表示免配送费 */
  deliveryFee?: number;
  /** 图上左下角是否展示「Premium choice」主色胶囊 */
  premium?: boolean;
  /** 图上左下角折扣胶囊文案 i18n key(myPick.savedRestaurants.{key}.discount) */
  hasDiscount?: boolean;
}

export const SAVED_RESTAURANTS: SavedRestaurant[] = [
  {
    key: 'goldenMandalay',
    rating: 4.9,
    distance: '1.2km',
    duration: '25-35 min',
    deliveryFee: 1000,
    premium: true,
    hasDiscount: true,
  },
  { key: 'shweFlower', rating: 4.9, distance: '0.8km', duration: '15-25 min' },
];
