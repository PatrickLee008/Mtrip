/**
 * 我的精选(按 Figma M-Trip / My Pick 289:1112 重做)
 *
 * 结构与设计稿一致:顶部栏 → 三分类页签 → 预订卡列表 → 入住反馈卡 →
 * 收藏酒店(横滑)→ 收藏餐厅(横滑)→ 新用户促销卡。
 * 数据策略沿用 HomeScreen:预订列表取 /order/list、收藏酒店取 /user/favorite/list;
 * 收藏餐厅后端暂无对应品类,走 myPickSections.ts 静态数据。
 *
 * **取数已抽到 `useMyPickData`**,与关怀模式的 MyPickLiteScreen 共用同一份口径
 * (含「常驻 Tab 必须 useFocusEffect」这条);本文件只剩排版。
 *
 * 「收藏酒店」= 真实收藏,与酒店搜索结果页的心形是同一份数据(`user_favorite` 表):
 *   - **登录后只显示真实收藏**,一条都没有时给空态文案 —— 不能拿设计稿示例卡冒充,
 *     否则看起来像「没对接后端」(设计稿示例只在**未登录**时展示,与上面的预订卡一致)。
 *   - 卡上的心形在这里是**实心且可点**,点一下调 `/user/favorite/remove` 取消收藏并就地移除。
 *   - 列表接口不返回起价(minPrice=0),StayCard 会自动隐藏价格行。
 *   - 本页是常驻的 Tab,**必须用 useFocusEffect 而不是 useEffect** —— 否则在酒店页收藏完
 *     切回来还是旧数据(挂载不会重来)。
 *
 * 封面另有一层兜底:真实酒店的 `cover_image` / 订单快照 `goods_image` 目前多是脏值或空值,
 * 统一用 `tempCoverFor(index)` 回落到设计稿临时图(与酒店搜索结果页同一套,免得同一家酒店两页两张图)。
 */

import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  TEMP_BOOKING_COVER,
  TEMP_HOTEL_COVERS,
  TEMP_RESTAURANT_COVERS,
  tempCoverFor,
} from '@/assets/tempImages';
import HomeHeader from '@/components/home/HomeHeader';
import PromoCard from '@/components/home/PromoCard';
import SectionHeader from '@/components/home/SectionHeader';
import StayCard, { STAY_CARD_WIDTH } from '@/components/home/StayCard';
import BookingCard from '@/components/mypick/BookingCard';
import FeedbackCard from '@/components/mypick/FeedbackCard';
import PickTabs from '@/components/mypick/PickTabs';
import SavedRestaurantCard, {
  RESTAURANT_CARD_WIDTH,
} from '@/components/mypick/SavedRestaurantCard';
import { GOODS_TYPE, ORDER_STATUS_I18N } from '@/config/global';
import { PAGE_PADDING, SECTION_GAP, colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import {
  MY_PICK_TABS,
  SAMPLE_SAVED_HOTELS,
  SAMPLE_SAVED_HOTEL_KEYS,
  SAVED_RESTAURANTS,
  type MyPickTab,
} from '@/screens/mypick/myPickSections';
import { orderStatusColor, useMyPickData } from '@/screens/mypick/useMyPickData';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import { formatDate } from '@/utils/format';

export default function MyPickScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  // 同 HomeScreen:用实测宽度而非窗口宽度,避开 web 端竖向滚动条占位
  const [contentWidth, setContentWidth] = useState(width - PAGE_PADDING * 2);

  const profile = useUserStore((s) => s.profile);
  const showToast = useCommonStore((s) => s.showToast);

  /* 取数与改数在 useMyPickData,两种模式共用同一份口径(含获焦重拉) */
  const { isLogin, favorites, tabOrders, tab, setTab, refreshing, refresh, unfavorite } =
    useMyPickData();

  const comingSoon = () => showToast(t('home.comingSoon'));
  const requireLogin = () => (isLogin ? comingSoon() : navigation.navigate('Login'));

  const tabItems = MY_PICK_TABS.map((key) => ({ key, label: t(`myPick.tab.${key}`) }));
  /* 登录后一律显示真实收藏(可能为空);设计稿示例卡只用于未登录的空壳展示 */
  const savedHotels = isLogin ? favorites : SAMPLE_SAVED_HOTELS;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <HomeHeader
        points={profile?.points ?? 0}
        onPressPoints={requireLogin}
        onPressMessage={() =>
          isLogin ? navigation.navigate('Notifications') : navigation.navigate('Login')
        }
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setContentWidth(e.nativeEvent.layout.width - PAGE_PADDING * 2)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* 01 三分类页签 */}
        <PickTabs items={tabItems} value={tab} onChange={(key) => setTab(key as MyPickTab)} />

        {/* 02 预订卡列表 */}
        <View style={styles.stack}>
          {tabOrders.length > 0 ? (
            tabOrders.map((o, i) => (
              <BookingCard
                key={o.id}
                width={contentWidth}
                title={o.goods_name}
                coverUri={o.goods_image}
                /* 订单快照里的酒店图同样多是脏值/空值,先用设计稿临时图兜底(同酒店搜索结果页) */
                coverSource={tempCoverFor(i)}
                skuName={o.sku_name}
                statusLabel={t(ORDER_STATUS_I18N[o.order_status] ?? 'common.empty')}
                statusColor={orderStatusColor(o.order_status)}
                dates={
                  o.use_date
                    ? `${formatDate(o.use_date)}${o.end_date ? ` - ${formatDate(o.end_date)}` : ''}`
                    : formatDate(o.created_at)
                }
                travelers={String(o.quantity)}
                travelersLabel={t('order.quantity')}
                onPressDetail={() => navigation.navigate('OrderDetail', { orderId: o.id })}
                onPressMap={comingSoon}
              />
            ))
          ) : isLogin ? (
            <Text style={styles.empty}>{t('myPick.booking.empty')}</Text>
          ) : (
            /* 未登录:展示设计稿示例卡,点按引导登录 */
            <BookingCard
              width={contentWidth}
              coverSource={TEMP_BOOKING_COVER}
              title={t('myPick.booking.sample.hotel')}
              address={t('myPick.booking.sample.address')}
              skuName={t('myPick.booking.sample.room')}
              statusLabel={t('order.status.paid')}
              dates={t('myPick.booking.sample.dates')}
              travelers={t('myPick.booking.travelersValue', { people: 2, rooms: 1 })}
              onPressDetail={requireLogin}
              onPressMap={comingSoon}
            />
          )}
        </View>

        {/* 03 入住反馈 */}
        <FeedbackCard onPress={requireLogin} />

        {/* 04 收藏酒店 */}
        <View>
          <SectionHeader
            title={t('myPick.savedHotels.title')}
            onSeeAll={requireLogin}
          />
          {savedHotels.length === 0 ? (
            <Text style={styles.empty}>{t('myPick.savedHotels.empty')}</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
              contentContainerStyle={styles.hList}
              snapToInterval={STAY_CARD_WIDTH + 16}
              decelerationRate="fast"
            >
              {savedHotels.map((g, i) => {
                // 未登录的示例卡(id 取负数)名称/地址走设计稿文案,真实收藏一律用接口字段;
                // 封面两者都先用设计稿临时图 —— 真实商品的 cover_image 目前多是脏值/空值
                const sampleKey = g.id < 0 ? SAMPLE_SAVED_HOTEL_KEYS[i] : undefined;
                const item = sampleKey
                  ? {
                      ...g,
                      goods_name: t(`myPick.savedHotels.${sampleKey}.name`),
                      address: t(`myPick.savedHotels.${sampleKey}.address`),
                    }
                  : g;
                return (
                  <StayCard
                    key={g.id}
                    goods={item}
                    coverSource={sampleKey ? TEMP_HOTEL_COVERS[sampleKey] : tempCoverFor(i)}
                    /* 真实收藏:实心心 + 可点取消;示例卡保持不可点的空心 */
                    favorite={!sampleKey}
                    onToggleFavorite={sampleKey ? undefined : () => void unfavorite(g.id)}
                    onPress={(goods) => {
                      if (goods.id <= 0) return requireLogin();
                      // 酒店走设计稿的酒店详情页,与搜索结果页一致;其余品类回落通用商品详情
                      return goods.goods_type === GOODS_TYPE.HOTEL
                        ? navigation.navigate('HotelDetail', { propertyId: goods.id })
                        : navigation.navigate('GoodsDetail', { id: goods.id });
                    }}
                  />
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* 05 收藏餐厅(后端暂无餐饮品类,静态数据) */}
        <View>
          <SectionHeader
            title={t('myPick.savedRestaurants.title')}
            onSeeAll={comingSoon}
            seeAllLabel={t('myPick.savedRestaurants.viewAll')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
            contentContainerStyle={styles.hList}
            snapToInterval={RESTAURANT_CARD_WIDTH + 16}
            decelerationRate="fast"
          >
            {SAVED_RESTAURANTS.map((r) => (
              <SavedRestaurantCard
                key={r.key}
                coverSource={TEMP_RESTAURANT_COVERS[r.key]}
                name={t(`myPick.savedRestaurants.${r.key}.name`)}
                rating={r.rating}
                distance={r.distance}
                duration={r.duration}
                deliveryFee={r.deliveryFee}
                premium={r.premium}
                discountLabel={
                  r.hasDiscount ? t(`myPick.savedRestaurants.${r.key}.discount`) : undefined
                }
                onPress={comingSoon}
                onToggleFavorite={requireLogin}
              />
            ))}
          </ScrollView>
        </View>

        {/* 06 新用户促销(与首页同一张卡) */}
        <PromoCard
          onPress={() =>
            navigation.navigate('GoodsList', {
              goodsType: GOODS_TYPE.HOTEL,
              title: t('home.promo.category'),
            })
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.pageBg, overflow: 'hidden' },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 8,
    paddingBottom: 32,
    gap: SECTION_GAP,
  },
  stack: { gap: 16 },
  empty: {
    paddingVertical: 32,
    textAlign: 'center',
    fontFamily: fonts.inter,
    fontSize: 14,
    color: colors.textSoft,
  },
  /* 横滑区块出血到屏幕边缘 */
  bleed: { marginHorizontal: -PAGE_PADDING },
  hList: { paddingHorizontal: PAGE_PADDING, gap: 16, paddingVertical: 6 },
});
