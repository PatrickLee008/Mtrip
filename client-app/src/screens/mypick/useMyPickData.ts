/**
 * 「我的精选」的数据层(完整模式 MyPickScreen 与关怀模式 MyPickLiteScreen 共用)
 *
 * 两个模式的版式完全不同,但**取数口径必须是同一份** —— 否则同一个账号在两种模式下
 * 看到的订单条数或收藏列表会对不上。抽在这里的只有取数与改数,不含任何排版。
 *
 * 关键约定沿用原页面(改动前写在 MyPickScreen 头部):
 *   - 本页是常驻 Tab,**必须用 useFocusEffect 而不是 useEffect** ——
 *     否则在酒店页收藏 / 下单后切回来还是旧数据(挂载不会重来)。
 *   - 登录后一律显示真实数据(可能为空);未登录时清空,由页面决定是否拿设计稿示例卡占位。
 *   - 收藏接口返回物业摘要、不含起价,补齐成 StayCard 需要的 GoodsItem 形状(minPrice=0)。
 */

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { fetchOrderList } from '@/api/order';
import { fetchFavoriteList, removeFavorite } from '@/api/user';
import { GOODS_TYPE, ORDER_STATUS } from '@/config/global';
import { colors } from '@/config/theme';
import { TAB_STATUS, type MyPickTab } from '@/screens/mypick/myPickSections';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import type { GoodsItem, OrderItemData } from '@/types/models';

/**
 * 状态胶囊底色:已支付/已核销/已完成走绿色,待支付走橙色,其余为中性灰。
 * 两种模式共用 —— 同一个订单在两处不该是两种颜色。
 */
export function orderStatusColor(status: number): string {
  if (status === ORDER_STATUS.PENDING) return colors.warning;
  if (status <= ORDER_STATUS.FINISHED) return colors.statusPaid;
  return colors.muted;
}

export interface MyPickData {
  isLogin: boolean;
  orders: OrderItemData[];
  favorites: GoodsItem[];
  /** 当前页签下的订单(按 TAB_STATUS 过滤) */
  tabOrders: OrderItemData[];
  tab: MyPickTab;
  setTab: (tab: MyPickTab) => void;
  refreshing: boolean;
  refresh: () => void;
  /** 取消收藏:先请求再就地移除(失败不动列表) */
  unfavorite: (propertyId: number) => Promise<void>;
}

export function useMyPickData(): MyPickData {
  const { t } = useTranslation();
  const isLogin = useUserStore((s) => s.isLogin);
  const showToast = useCommonStore((s) => s.showToast);

  const [tab, setTab] = useState<MyPickTab>('upcoming');
  const [orders, setOrders] = useState<OrderItemData[]>([]);
  const [favorites, setFavorites] = useState<GoodsItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isLogin) {
        setOrders([]);
        setFavorites([]);
        return;
      }
      if (isRefresh) setRefreshing(true);
      try {
        const [orderPage, favoritePage] = await Promise.all([
          fetchOrderList({ page: 1, pageSize: 20 }),
          fetchFavoriteList({ page: 1, pageSize: 20 }),
        ]);
        setOrders(orderPage.list);
        setFavorites(
          favoritePage.list.map((f) => ({
            id: f.property_id,
            property_id: f.property_id,
            property_name: f.property_name,
            goods_type: GOODS_TYPE.HOTEL,
            category_id: 0,
            goods_name: f.property_name,
            goods_brief: '',
            cover_image: f.cover_image,
            address: f.address,
            longitude: null,
            latitude: null,
            star_level: f.star_level,
            is_recommend: 0,
            is_hot: 0,
            sales_count: 0,
            minPrice: 0,
          })),
        );
      } catch (e) {
        setOrders([]);
        setFavorites([]);
        if (isRefresh) showToast(e instanceof Error ? e.message : 'Error');
      } finally {
        setRefreshing(false);
      }
    },
    [isLogin, showToast],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const unfavorite = useCallback(
    async (propertyId: number) => {
      try {
        await removeFavorite(propertyId);
        setFavorites((prev) => prev.filter((g) => g.id !== propertyId));
        showToast(t('myPick.savedHotels.removed'));
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Error');
      }
    },
    [showToast, t],
  );

  const tabOrders = useMemo(
    () => orders.filter((o) => TAB_STATUS[tab].includes(o.order_status)),
    [orders, tab],
  );

  return {
    isLogin,
    orders,
    favorites,
    tabOrders,
    tab,
    setTab,
    refreshing,
    refresh: () => void load(true),
    unfavorite,
  };
}
