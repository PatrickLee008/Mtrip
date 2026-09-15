/**
 * 关怀模式「我的精选」(按 Figma Lite My Pick `2540:21121` 实现)
 *
 * 取数与完整模式共用 `useMyPickData`(订单 /order/list、收藏 /user/favorite/list,含获焦重拉),
 * 所以同一个账号在两种模式下看到的订单条数与收藏列表必然一致;本文件只负责排版。
 *
 * 相对完整模式**去掉了两个区块**(设计稿没画,且都不是必需功能):
 *   入住反馈卡 FeedbackCard、底部新用户促销卡 PromoCard。
 * 保留的三段是:三分类页签 → 预订卡 → 收藏酒店 → 收藏餐厅。
 *
 * 设计稿实测:Main px16 pt16 pb20,块间距 24;区块标题 Outfit 600/24 行高 32,
 * 右侧 See All / View all 主色 Inter 400/16。卡片量值见 components/lite/LiteMyPickCards.tsx。
 *
 * 设计稿里那张「Multi Booking (2 Stay)」多住宿卡**没有实现** —— 后端一个订单只对应一个 sku,
 * 造不出「一单两段住宿」的数据,完整模式同样没做这件事(见 HotelBooking 的多住宿走 comingSoon)。
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
import {
  LITE_HOTEL_CARD_WIDTH,
  LITE_RESTAURANT_CARD_WIDTH,
  LiteBookingCard,
  LiteSavedHotelCard,
  LiteSavedRestaurantCard,
  LiteTabs,
} from '@/components/lite/LiteMyPickCards';
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

export default function MyPickLiteScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  // 同完整模式:用实测宽度而非窗口宽度,避开 web 端竖向滚动条占位
  const [contentWidth, setContentWidth] = useState(width - PAGE_PADDING * 2);

  const profile = useUserStore((s) => s.profile);
  const showToast = useCommonStore((s) => s.showToast);
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
        <LiteTabs items={tabItems} value={tab} onChange={(key) => setTab(key as MyPickTab)} />

        <View style={styles.stack}>
          {tabOrders.length > 0 ? (
            tabOrders.map((o, i) => (
              <LiteBookingCard
                key={o.id}
                width={contentWidth}
                title={o.goods_name}
                coverUri={o.goods_image}
                /* 订单快照里的酒店图多是脏值/空值,先用设计稿临时图兜底(同完整模式) */
                coverSource={tempCoverFor(i)}
                skuName={o.sku_name}
                statusLabel={t(ORDER_STATUS_I18N[o.order_status] ?? 'common.empty')}
                statusColor={orderStatusColor(o.order_status)}
                datesLabel={t('myPick.booking.dates')}
                dates={
                  o.use_date
                    ? `${formatDate(o.use_date)}${o.end_date ? ` - ${formatDate(o.end_date)}` : ''}`
                    : formatDate(o.created_at)
                }
                travelersLabel={t('order.quantity')}
                travelers={String(o.quantity)}
                detailLabel={t('myPick.booking.viewDetails')}
                onPressDetail={() => navigation.navigate('OrderDetail', { orderId: o.id })}
              />
            ))
          ) : isLogin ? (
            <Text style={styles.empty}>{t('myPick.booking.empty')}</Text>
          ) : (
            /* 未登录:展示设计稿示例卡,点按引导登录 */
            <LiteBookingCard
              width={contentWidth}
              coverSource={TEMP_BOOKING_COVER}
              title={t('myPick.booking.sample.hotel')}
              skuName={t('myPick.booking.sample.room')}
              statusLabel={t('order.status.paid')}
              datesLabel={t('myPick.booking.dates')}
              dates={t('myPick.booking.sample.dates')}
              travelersLabel={t('myPick.booking.travelers')}
              travelers={t('myPick.booking.travelersValue', { people: 2, rooms: 1 })}
              detailLabel={t('myPick.booking.viewDetails')}
              onPressDetail={requireLogin}
            />
          )}
        </View>

        {/* 收藏酒店 */}
        <View style={styles.section}>
          <LiteSectionHeader
            title={t('myPick.savedHotels.title')}
            action={t('home.seeAll')}
            onPressAction={requireLogin}
          />
          {savedHotels.length === 0 ? (
            <Text style={styles.empty}>{t('myPick.savedHotels.empty')}</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
              contentContainerStyle={styles.hList}
              snapToInterval={LITE_HOTEL_CARD_WIDTH + 16}
              decelerationRate="fast"
            >
              {savedHotels.map((g, i) => {
                // 未登录的示例卡(id 取负数)走设计稿文案,真实收藏一律用接口字段
                const sampleKey = g.id < 0 ? SAMPLE_SAVED_HOTEL_KEYS[i] : undefined;
                const name = sampleKey
                  ? t(`myPick.savedHotels.${sampleKey}.name`)
                  : g.goods_name;
                return (
                  <LiteSavedHotelCard
                    key={g.id}
                    name={name}
                    coverSource={sampleKey ? TEMP_HOTEL_COVERS[sampleKey] : tempCoverFor(i)}
                    /* 真实收藏:实心心 + 可点取消;示例卡保持不可点的空心 */
                    favorite={!sampleKey}
                    onToggleFavorite={sampleKey ? undefined : () => void unfavorite(g.id)}
                    onPress={() => {
                      if (g.id <= 0) return requireLogin();
                      return g.goods_type === GOODS_TYPE.HOTEL
                        ? navigation.navigate('HotelDetail', { propertyId: g.id })
                        : navigation.navigate('GoodsDetail', { id: g.id });
                    }}
                  />
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* 收藏餐厅(后端暂无餐饮品类,静态数据,与完整模式同一份) */}
        <View style={styles.section}>
          <LiteSectionHeader
            title={t('myPick.savedRestaurants.title')}
            action={t('myPick.savedRestaurants.viewAll')}
            onPressAction={comingSoon}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
            contentContainerStyle={styles.hList}
            snapToInterval={LITE_RESTAURANT_CARD_WIDTH + 16}
            decelerationRate="fast"
          >
            {SAVED_RESTAURANTS.map((r) => (
              <LiteSavedRestaurantCard
                key={r.key}
                name={t(`myPick.savedRestaurants.${r.key}.name`)}
                coverSource={TEMP_RESTAURANT_COVERS[r.key]}
                premiumLabel={r.premium ? t('myPick.savedRestaurants.premium') : undefined}
                discountLabel={
                  r.hasDiscount
                    ? t(`myPick.savedRestaurants.${r.key}.discount`)
                    : t('myPick.savedRestaurants.freeDelivery')
                }
                onPress={comingSoon}
                onToggleFavorite={requireLogin}
              />
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** 区块标题行(设计稿 Outfit 600/24 + 右侧主色链接) */
function LiteSectionHeader({
  title,
  action,
  onPressAction,
}: {
  title: string;
  action: string;
  onPressAction: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.sectionAction} onPress={onPressAction} suppressHighlighting>
        {action}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.pageBg, overflow: 'hidden' },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 16,
    paddingBottom: 20,
    gap: SECTION_GAP,
  },
  stack: { gap: 16 },
  section: { gap: 16 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    flexShrink: 1,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.heading,
  },
  sectionAction: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.primary },

  empty: {
    paddingVertical: 32,
    textAlign: 'center',
    fontFamily: fonts.inter,
    fontSize: 16,
    color: colors.textSoft,
  },
  /* 横滑区块出血到屏幕边缘 */
  bleed: { marginHorizontal: -PAGE_PADDING },
  hList: { paddingHorizontal: PAGE_PADDING, gap: 16, paddingVertical: 6 },
});
