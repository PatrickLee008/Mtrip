/**
 * 导航参数表:Stack / Tab 路由类型定义
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

/** 底部 Tab(对应 Figma M-Trip / Home 81:2464 的 BottomNavBar) */
export type MainTabParamList = {
  HomeTab: undefined;
  MyPickTab: undefined;
  PromotionsTab: undefined;
  MoreTab: undefined;
};

/** 根 Stack */
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  SiteSelect: undefined;
  /** 酒店搜索页(Figma 91:200),首页快捷入口 hotels 的落地页 */
  Hotels: undefined;
  /** 酒店搜索结果页(Figma 1695:6325),酒店搜索页 Search 的落地页 */
  HotelResults: {
    countryCode?: string;
    cityKey?: string;
    keyword?: string;
    /** YYYY-MM-DD */
    checkIn?: string;
    checkOut?: string;
    /** 弹性日期天数,0=精确日期 */
    flexDays?: number;
    /** 是否按缅甸公民价展示 */
    citizen?: boolean;
  };
  /**
   * 酒店详情页(Figma 94:438),搜索结果卡的落地页。
   * 当前是静态页,还没接 `/goods/detail`,故 id 可缺省(演示卡没有真实商品 id)。
   */
  HotelDetail: { id?: number } | undefined;
  GoodsList: { goodsType?: number; categoryId?: number; keyword?: string; title?: string };
  GoodsDetail: { id: number };
  OrderList: undefined;
  OrderConfirm: { goodsId: number; skuId: number };
  OrderDetail: { orderId: number };
  /**
   * 优惠券详情(Figma 1625:2009),优惠中心的券卡落地页。
   * 当前是静态页(后端无优惠券接口),故不带参数。
   */
  CouponDetail: undefined;
  /* ---- 「更多」section(Figma 1695:5951)的子页,全部无参数(当前都是静态页) ---- */
  /** 通知(Figma 1770:3863),首页 / 我的精选顶部栏铃铛的落地页 */
  Notifications: undefined;
  Account: undefined;
  Travelers: undefined;
  EditEmail: undefined;
  Referral: undefined;
  ReferralStatus: undefined;
  HowReferralWorks: undefined;
  Guides: undefined;
  LegalTerms: undefined;
  Login: undefined;
  Register: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
