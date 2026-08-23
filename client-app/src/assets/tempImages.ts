/**
 * 设计稿临时图片的唯一引用出口(素材在 assets/images/temp/,来源见该目录 README)
 *
 * 这些图只在「接口无数据 / 未登录」时兜底,用于把页面渲染成设计稿的样子。
 * 接口能返回真实 cover_image 后,删掉这里对应的项 + assets/images/temp/ 下的文件即可,
 * 业务组件不受影响(CoverImage 的 fallback 是可选参数,缺省自动回落到渐变占位)。
 */

import type { ImageSourcePropType } from 'react-native';

/* ------------------------------------------------------------------ 我的精选 */

/** 未登录时的示例预订卡封面(设计稿 Booking Card 3,展示框 402x176) */
export const TEMP_BOOKING_COVER: ImageSourcePropType = require('../../assets/images/temp/mypick/booking-cover.jpg');

/** 收藏酒店兜底卡封面,键为 SAMPLE_SAVED_HOTEL_KEYS 的项(展示框 298x176) */
export const TEMP_HOTEL_COVERS: Record<string, ImageSourcePropType> = {
  heritageBagan: require('../../assets/images/temp/mypick/hotel-heritage-bagan.png'),
  strandSuites: require('../../assets/images/temp/mypick/hotel-strand-suites.png'),
};

/** 收藏餐厅卡封面,键为 SAVED_RESTAURANTS 的 key(展示框 322x128) */
export const TEMP_RESTAURANT_COVERS: Record<string, ImageSourcePropType> = {
  goldenMandalay: require('../../assets/images/temp/mypick/restaurant-golden-mandalay.jpg'),
  shweFlower: require('../../assets/images/temp/mypick/restaurant-shwe-flower.jpg'),
};

/* ---------------------------------------------------------------------- 首页 */

/** 热门目的地兜底卡,键为 DESTINATIONS 的 key(展示框 280x192) */
export const TEMP_DESTINATION_COVERS: Record<string, ImageSourcePropType> = {
  bagan: require('../../assets/images/temp/home/dest-bagan.png'),
  inleLake: require('../../assets/images/temp/home/dest-inle-lake.png'),
  ngapali: require('../../assets/images/temp/home/dest-ngapali.png'),
};

/** 限时特惠横幅底图(展示框 370x170) */
export const TEMP_SPECIAL_DEAL_COVER: ImageSourcePropType = require('../../assets/images/temp/home/special-deal.png');

/** 餐饮优惠卡缩略图,键为 DINING_ITEMS 的项(展示框 80x80) */
export const TEMP_DINING_COVERS: Record<string, ImageSourcePropType> = {
  rangoonTeaHouse: require('../../assets/images/temp/home/dining-rangoon-tea-house.jpg'),
  seeds: require('../../assets/images/temp/home/dining-seeds.jpg'),
};

/** 本地体验卡整图,键为 EXPERIENCES 的 key(展示框 370x256) */
export const TEMP_EXPERIENCE_COVERS: Record<string, ImageSourcePropType> = {
  balloon: require('../../assets/images/temp/home/experience-balloon.png'),
  sunsetBoat: require('../../assets/images/temp/home/experience-sunset-boat.png'),
};

/** 杂志流封面,键为 MAGAZINE_ITEMS 的项(展示框 370x192) */
export const TEMP_MAGAZINE_COVERS: Record<string, ImageSourcePropType> = {
  pagodaTips: require('../../assets/images/temp/home/magazine-pagoda-tips.png'),
};
