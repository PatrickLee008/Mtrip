/**
 * 首页静态区块数据(Figma M-Trip / Home 81:2464)
 * 这些区块后端暂无对应接口,先以常量驱动;文案统一走 i18n key,便于后续逐个换成接口数据
 *
 * 设计稿里 visible:false 的区块一律不实现(筛选 chips / 热门路线 / 旅行协助 / 杂志流第二篇),
 * 判断依据见 .figma-cache/home/README.md。
 */

import type { ImageSourcePropType } from 'react-native';

import { GOODS_TYPE } from '@/config/global';

/**
 * 快捷入口:图标为设计稿导出的本地 PNG。
 * route 优先 —— 该业务线有专属落地页;否则用 goodsType 直接跳商品列表;
 * 两者都没有表示业务线尚未开放,点按只提示 comingSoon。
 */
export interface QuickAction {
  key: string;
  icon: ImageSourcePropType;
  /**
   * 方块底色深浅,决定投影强度(设计稿两组用了不同的 Effect):
   * solid = 主色/深色底(DS_AG 强投影),tint = 白底叠浅色(Effect/DS 弱投影)
   */
  tone: 'solid' | 'tint';
  /** 专属落地页(目前只有酒店) */
  route?: 'Hotels';
  goodsType?: number;
}

/**
 * 快捷入口只有一行 4 项。设计稿里第二行(Tours/Flights/Parks/Support)与第一行的
 * Bus 所在容器都带 `visible:false`,是隐藏稿,不渲染。
 */
export const QUICK_ACTIONS: QuickAction[] = [
  { key: 'hotels', icon: require('../../../assets/images/home/hotels.png'), tone: 'solid', route: 'Hotels' },
  { key: 'food', icon: require('../../../assets/images/home/food.png'), tone: 'solid' },
  { key: 'cars', icon: require('../../../assets/images/home/cars.png'), tone: 'tint' },
  { key: 'package', icon: require('../../../assets/images/home/package.png'), tone: 'tint', goodsType: GOODS_TYPE.TICKET },
];

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

/** 本地体验;highDemand 对应设计稿角标 */
export interface ExperienceItem {
  key: string;
  highDemand?: boolean;
}

export const EXPERIENCES: ExperienceItem[] = [
  { key: 'balloon', highDemand: true },
  { key: 'sunsetBoat' },
];

/** 杂志文章(设计稿第二篇 Mohinga 是 visible:false 的隐藏稿,不实现) */
export const MAGAZINE_ITEMS = ['pagodaTips'] as const;
