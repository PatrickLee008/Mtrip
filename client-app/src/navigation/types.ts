/**
 * 导航参数表:Stack / Tab 路由类型定义
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

/** 底部 Tab */
export type MainTabParamList = {
  HomeTab: undefined;
  OrderTab: undefined;
  MineTab: undefined;
};

/** 根 Stack */
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  SiteSelect: undefined;
  GoodsList: { goodsType?: number; categoryId?: number; keyword?: string; title?: string };
  GoodsDetail: { id: number };
  OrderConfirm: { goodsId: number; skuId: number };
  OrderDetail: { orderId: number };
  Login: undefined;
  Register: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
