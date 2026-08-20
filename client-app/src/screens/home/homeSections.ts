/**
 * 首页静态区块数据(Figma M-Trip / Home 81:2464)
 * 这些区块后端暂无对应接口,先以常量驱动;文案统一走 i18n key,便于后续逐个换成接口数据
 */

import type { ImageSourcePropType } from 'react-native';

import { GOODS_TYPE } from '@/config/global';

/** 快捷入口:图标为设计稿导出的本地 PNG;goodsType 为空表示该业务线尚未开放 */
export interface QuickAction {
  key: string;
  icon: ImageSourcePropType;
  goodsType?: number;
}

/**
 * 快捷入口只有一行 4 项。设计稿里第二行(Tours/Flights/Parks/Support)与第一行的
 * Bus 所在容器都带 `visible:false`,是隐藏稿,不渲染。
 */
export const QUICK_ACTIONS: QuickAction[] = [
  { key: 'hotels', icon: require('../../../assets/images/home/hotels.png'), goodsType: GOODS_TYPE.HOTEL },
  { key: 'food', icon: require('../../../assets/images/home/food.png') },
  { key: 'cars', icon: require('../../../assets/images/home/cars.png') },
  { key: 'package', icon: require('../../../assets/images/home/package.png'), goodsType: GOODS_TYPE.TICKET },
];

/** 快捷筛选 chips */
export const QUICK_FILTERS = ['multiBooking', 'longStay'] as const;

/** 目的地兜底数据(接口无数据时展示) */
export interface DestinationItem {
  key: string;
}

export const DESTINATIONS: DestinationItem[] = [
  { key: 'bagan' },
  { key: 'inleLake' },
  { key: 'ngapali' },
];

/** 餐饮优惠 */
export const DINING_ITEMS = ['rangoonTeaHouse', 'seeds'] as const;

/** 热门路线:价格为设计稿静态值(MMK) */
export interface RouteItem {
  key: string;
  originalPrice?: number;
  price: number;
}

export const ROUTES: RouteItem[] = [
  { key: 'yangonMandalay', originalPrice: 45000, price: 32500 },
  { key: 'yangonBagan', price: 155000 },
];

/** 本地体验;highDemand 对应设计稿角标 */
export interface ExperienceItem {
  key: string;
  highDemand?: boolean;
}

export const EXPERIENCES: ExperienceItem[] = [
  { key: 'balloon', highDemand: true },
  { key: 'sunsetBoat' },
];

/** 旅行协助九宫格 */
export const ASSISTANCE_ITEMS = ['liveSupport', 'visaGuide', 'emergency'] as const;

/** 杂志文章 */
export const MAGAZINE_ITEMS = ['pagodaTips', 'mohinga'] as const;
