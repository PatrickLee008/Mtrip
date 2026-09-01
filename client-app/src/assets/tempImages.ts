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

/* ------------------------------------------------------------------ 酒店详情 */

/** 酒店详情图库(设计稿 94:897 Hero Section / Gallery,展示框 402x300),顺序即设计稿顺序 */
export const TEMP_HOTEL_GALLERY: ImageSourcePropType[] = [
  require('../../assets/images/temp/hotel/detail-resort-view.png'),
  require('../../assets/images/temp/hotel/detail-room-interior.png'),
  require('../../assets/images/temp/hotel/detail-dining-view.png'),
];

/** 房型页三张房型卡封面(设计稿 222:1594,展示框 370x192),键为 DETAIL_ROOMS 的 key */
export const TEMP_ROOM_COVERS: Record<string, ImageSourcePropType> = {
  standard: require('../../assets/images/temp/hotel/room-standard.png'),
  deluxe: require('../../assets/images/temp/hotel/room-deluxe.png'),
  family: require('../../assets/images/temp/hotel/room-family.png'),
};

/** 周边页地图占位图(设计稿 222:2920,展示框 370x256;未接地图 SDK 前是静态图) */
export const TEMP_NEARBY_MAP: ImageSourcePropType = require('../../assets/images/temp/hotel/nearby-map.png');

/** 周边景点卡缩略图(设计稿 222:2942 等,展示框 64x64),键为 DETAIL_ATTRACTIONS 的 key */
export const TEMP_ATTRACTION_COVERS: Record<string, ImageSourcePropType> = {
  ananda: require('../../assets/images/temp/hotel/attraction-ananda.jpg'),
  dhammayangyi: require('../../assets/images/temp/hotel/attraction-dhammayangyi.jpg'),
  oldBaganMarket: require('../../assets/images/temp/hotel/attraction-market.jpg'),
};

/** 政策页页头大图(设计稿 222:3504,展示框 370x192) */
export const TEMP_POLICIES_HEADER: ImageSourcePropType = require('../../assets/images/temp/hotel/policies-header.png');

/* ------------------------------------------------------------------ 订房流程 */

/** Step 1 加购卡封面(设计稿 1675:6220 / 1675:6237,展示框 368x182) */
export const TEMP_ADDON_COVERS: Record<string, ImageSourcePropType> = {
  breakfast: require('../../assets/images/temp/hotel/booking/addon-breakfast.jpg'),
  transfer: require('../../assets/images/temp/hotel/booking/addon-transfer.jpg'),
};

/**
 * 预订成功页的数字凭证二维码(设计稿 1675:6728,展示框 174x174)
 * —— 静态页阶段用导出的静态图,不引 qrcode 库;接口给出凭证串后改运行时生成
 */
export const TEMP_VOUCHER_QR: ImageSourcePropType = require('../../assets/images/temp/hotel/booking/voucher-qr.png');

/** 支付方式图标,键为 PAYMENT_METHODS 的 key(展示框 40x40;mmqr 是 22x34 的窄图) */
export const TEMP_PAY_ICONS: Record<string, ImageSourcePropType> = {
  mmqr: require('../../assets/images/temp/hotel/booking/pay-mmqr.png'),
  kbzpay: require('../../assets/images/temp/hotel/booking/pay-kbzpay.png'),
  wavepay: require('../../assets/images/temp/hotel/booking/pay-wavepay.png'),
  wallet: require('../../assets/images/temp/hotel/booking/pay-wallet.png'),
  hotel: require('../../assets/images/temp/hotel/booking/pay-hotel.png'),
  card: require('../../assets/images/temp/hotel/booking/pay-card.png'),
  coupon: require('../../assets/images/temp/hotel/booking/pay-coupon.png'),
};

/** 「Mobile Banking」那格是两层图叠出来的(底图 cover + 标 contain),设计稿即如此 */
export const TEMP_PAY_MOBILE_BANKING: ImageSourcePropType = require('../../assets/images/temp/hotel/booking/pay-mobile-banking.png');
export const TEMP_PAY_MOBILE_BANKING_LOGO: ImageSourcePropType = require('../../assets/images/temp/hotel/booking/pay-mobile-banking-logo.png');

/** 卡组织标,键为 CARD_BRANDS 的 key(展示框高 16,宽各不相同) */
export const TEMP_CARD_BRANDS: Record<string, ImageSourcePropType> = {
  mpu: require('../../assets/images/temp/hotel/booking/brand-mpu.png'),
  visa: require('../../assets/images/temp/hotel/booking/brand-visa.png'),
  mastercard: require('../../assets/images/temp/hotel/booking/brand-mastercard.png'),
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

/* ------------------------------------------------------------------ 优惠中心 */

/** 活动横幅底图(设计稿 1389:2772,展示框 370x274) */
export const TEMP_CAMPAIGN_BANNER: ImageSourcePropType = require('../../assets/images/temp/promotion/campaign-banner.jpg');

/* -------------------------------------------------------------------- 更多 */

/**
 * Refer & Earn 页头图(设计稿 1687:4208,展示框 370x274)
 * —— 与优惠页活动横幅是**同一张图**(md5 一致),不重复入包
 */
export const TEMP_REFERRAL_BANNER: ImageSourcePropType = TEMP_CAMPAIGN_BANNER;

/** 教程视频封面(设计稿 2206:7835,展示框 322x160);设计稿三张卡用的是同一张图 */
export const TEMP_GUIDE_THUMBNAIL: ImageSourcePropType = require('../../assets/images/temp/more/guide-thumbnail.jpg');

/* ---------------------------------------------------------------------- 首页 */

/** 杂志流封面,键为 MAGAZINE_ITEMS 的项(展示框 370x192) */
export const TEMP_MAGAZINE_COVERS: Record<string, ImageSourcePropType> = {
  pagodaTips: require('../../assets/images/temp/home/magazine-pagoda-tips.png'),
};
