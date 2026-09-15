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

/**
 * 关怀模式首页的四张大服务卡(Figma Lite Home `2540:21343`)
 *
 * **落地规则与 QUICK_ACTIONS 完全一致**(route 优先 → goodsType → comingSoon),
 * 业务线是同一批,只是换了张排版;`key` 复用同一套,标题因此直接走 `home.quickAction.{key}`,
 * 副标题另有 `home.liteService.{key}`。
 *
 * **插画不能复用 `assets/images/home/*.png`** —— 那四张是整块满幅的蓝色方形图标
 * (见 QuickActionGrid 头部注释),叠在这里的蓝色卡上会多出一个蓝方块;
 * 这里用的是设计稿另外导出的去底插画 `assets/images/lite/*.png`。
 */
export interface LiteService {
  key: 'hotels' | 'food' | 'cars' | 'package';
  image: ImageSourcePropType;
  /** 设计稿插画框宽度(高度四张都是 140 = 卡高) */
  imageWidth: number;
  /**
   * 文案区右侧留白。等于插画宽减去设计稿允许的重叠量 ——
   * Package 那张的文案容器写了 `mr:-30`,即文字可以压进插画 30(否则 40px 的标题排不下)。
   */
  textPaddingRight: number;
  /**
   * 插画在框内的偏移裁切,四个值都是**相对插画框**的比例(设计稿原样照抄)。
   * 缺省表示设计稿用的是 object-cover 满幅填充(Hotels / Package 两张)。
   * Food 与 Car 两张设计稿把图往下压了 20%~27%,不照做的话插画会偏高、与文字不在一条基线上。
   */
  crop?: { left: number; top: number; width: number; height: number };
  route?: 'Hotels';
  goodsType?: number;
}

export const LITE_SERVICES: LiteService[] = [
  {
    key: 'hotels',
    image: require('../../../assets/images/lite/hotels.png'),
    imageWidth: 140,
    textPaddingRight: 140,
    route: 'Hotels',
  },
  {
    key: 'food',
    image: require('../../../assets/images/lite/food.png'),
    imageWidth: 140,
    textPaddingRight: 140,
    crop: { left: -0.0505, top: 0.2075, width: 1.101, height: 0.9035 },
  },
  {
    key: 'cars',
    image: require('../../../assets/images/lite/cars.png'),
    imageWidth: 161,
    textPaddingRight: 161,
    crop: { left: 0, top: 0.2659, width: 1.0588, height: 0.8834 },
  },
  {
    key: 'package',
    image: require('../../../assets/images/lite/package.png'),
    imageWidth: 192,
    textPaddingRight: 162,
    goodsType: GOODS_TYPE.TICKET,
  },
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
