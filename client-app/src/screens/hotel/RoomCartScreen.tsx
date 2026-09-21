/**
 * 房型购物车(Figma M-Trip / Room Cart `2659:11842`,顶栏标题 My Rooms)
 *
 * 自上而下:顶栏(返回 + My Rooms)→ 预订摘要卡(酒店名 + 日期)→ Selected Rooms (n)
 * → 已选房型卡(90 方图 + 名称/Room n 角标 + 属性 + 价格 + 加减器)→ Add Another Room
 * → Price Breakdown → 吸底 Back / Check Out。
 *
 * 设计稿实测:
 *   摘要卡/明细卡  `--tab` 底 / 1px `--secondary` / 圆角 24 / padding 25 / gap 16
 *   房型卡        同壳但 padding 16;左图 90x90 圆角 8;右侧 gap 4
 *                 名称 Outfit 600/16、「Room n」Inter 600/12 主色(稿面无底色)
 *                 属性格 宽 100、图标 + Inter 500/12 `--text-2`,换行排布 gap 8
 *                 加减器 见 `components/hotel/RoomStepper`(与房型卡共用那一份)
 *   Add Another Room  #C4D2FF 底、1px 主色、圆角 24、padding 16、Inter 600/14 主色
 *   明细行        1px `--secondary` 圆角 12 的表格,行间下边框;标签 Inter 400/16、值 Inter 500/16
 *   合计          「TOTAL AMOUNT」Inter 600/12 `--text-2` 大写 tracking .6;
 *                 积分胶囊 rgba(65,105,237,.1) 圆角 8;总价 Inter 700/40(行高 60)主色 tracking -.96
 *   吸底栏        `--tab` 底 py16 px24 gap20,两枚等宽圆角 12:Back 描边 / Check Out 主色
 *
 * ⚠️ **明细里的税费/服务费/会员折扣与积分,后端目前没有任何字段**
 * (`order/create` 只回 original / longstayDiscount / couponDiscount / payAmount)。
 * 稿面那几行写死了 10% / 5% / 20% 与 Earn 1,250 Points,照抄会在结算页对不上账 ——
 * 所以这里按**费率常量**渲染且**为 0 时整行不显示**,默认全 0,合计 = 房费小计。
 * 后端出了字段(或站点配置下发费率)再把常量换成真实值即可,不改版式。
 */

import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import ConfirmDialog from '@/components/common/ConfirmDialog';
import { EmptyView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import RoomStepper from '@/components/hotel/RoomStepper';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { nightsBetween, useRoomCartStore } from '@/store/roomCartStore';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

/**
 * 明细费率(稿面 10% / 5% / 20%)。**后端无对应字段,一律置 0 = 该行不显示**,
 * 免得购物车总价与结算页实付对不上。拿到真实口径后改这里即可。
 */
const RATES = { tax: 0, service: 0, memberDiscount: 0 };
/** 稿面「Earn 1,250 Points」;后端没有下发积分预估,置 0 即不显示胶囊 */
const EARN_POINTS = 0;

export default function RoomCartScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const currency = useSiteStore((s) => s.currency);

  const { propertyId, hotelName, checkIn, checkOut, items, setQuantity, remove } =
    useRoomCartStore();
  /** 待确认移除的房型(设计稿 Alert Overlay 2659:12483) */
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  const nights = nightsBetween(checkIn, checkOut);
  const roomCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity * nights, 0);
  const tax = subtotal * RATES.tax;
  const service = subtotal * RATES.service;
  const memberDiscount = subtotal * RATES.memberDiscount;
  const total = subtotal + tax + service - memberDiscount;

  /** 减到 0 不直接删,先弹确认框(设计稿要求) */
  const decrease = (roomKey: string, quantity: number) => {
    if (quantity <= 1) setPendingRemove(roomKey);
    else setQuantity(roomKey, quantity - 1);
  };

  const confirmRemove = () => {
    if (pendingRemove) remove(pendingRemove);
    setPendingRemove(null);
  };

  /**
   * Check Out:进订房向导(与详情页底栏 Continue 同一入口)。
   * 向导会读**同一份**购物车组 `trip/create` 的 items,所以整车都会被下单 ——
   * 这里只需把「真实模式」需要的 propertyId / roomTypeId 带过去(取车里第一个真实房型),
   * 向导据此拉商品详情、填酒店名与退改规则;演示房型没有 sku,照旧进演示模式不发请求。
   */
  const checkout = () => {
    const real = items.find((item) => item.sku);
    navigation.navigate('HotelBooking', {
      roomKey: items[0]?.roomKey,
      checkIn,
      checkOut,
      propertyId: real && propertyId ? propertyId : undefined,
      roomTypeId: real?.sku?.id,
    });
  };

  const dateLabel =
    checkIn && checkOut
      ? t('hotels.cart.dateRange', { from: checkIn, to: checkOut, nights })
      : t('hotels.cart.noDate');

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* 顶栏 2659:12394 */}
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.topBack, pressed && styles.pressed]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
          >
            <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
            <Text style={styles.topTitle}>{t('hotels.cart.title')}</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.main}
          showsVerticalScrollIndicator={false}
        >
          {/* 预订摘要 2659:12451 */}
          <View style={styles.panel}>
            <Text style={styles.hotelName}>{hotelName || t('hotels.cart.title')}</Text>
            <View style={styles.dateRow}>
              <HomeIcon name="calendar" size={12} color={colors.label} />
              <Text style={styles.dateText}>{dateLabel}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>
            {t('hotels.cart.selected', { rooms: roomCount })}
          </Text>

          {items.length === 0 ? (
            <EmptyView text={t('hotels.cart.empty')} />
          ) : (
            <View style={styles.list}>
              {items.map((item, index) => (
                <View key={item.roomKey} style={[styles.panel, styles.roomCard]}>
                  <View style={styles.roomTop}>
                    {item.cover ? (
                      <Image source={item.cover} style={styles.roomCover} resizeMode="cover" />
                    ) : (
                      <View style={[styles.roomCover, styles.roomCoverBlank]} />
                    )}

                    <View style={styles.roomInfo}>
                      <View style={styles.roomNameRow}>
                        <Text style={styles.roomName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.roomIndex}>
                          {t('hotels.cart.roomIndex', { index: index + 1 })}
                        </Text>
                      </View>

                      <View style={styles.attrs}>
                        {item.attrs.map((attr) => (
                          <View key={attr.key} style={styles.attr}>
                            <HomeIcon name={attr.icon} size={16} color={colors.textSoft} />
                            <Text style={styles.attrText} numberOfLines={1}>
                              {attr.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.roomBottom}>
                    <View>
                      {item.strike || item.promoKey ? (
                        <View style={styles.promoRow}>
                          {item.strike ? (
                            <Text style={styles.strike}>{formatMoney(item.strike, currency)}</Text>
                          ) : null}
                          {item.promoKey ? (
                            <Text style={styles.promo}>{t(item.promoKey)}</Text>
                          ) : null}
                        </View>
                      ) : null}
                      <View style={styles.priceRow}>
                        <Text style={styles.price}>{formatMoney(item.price, currency)}</Text>
                        <Text style={styles.perNight}>{t('hotels.detail.rooms.perNight')}</Text>
                      </View>
                    </View>

                    {/* 加减器 2659:12366 —— 与房型卡共用同一个组件 */}
                    <RoomStepper
                      quantity={item.quantity}
                      onIncrease={() => setQuantity(item.roomKey, item.quantity + 1)}
                      onDecrease={() => decrease(item.roomKey, item.quantity)}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Add Another Room 2659:12429 —— 回房型列表继续挑 */}
          <Pressable
            style={({ pressed }) => [styles.addRoom, pressed && styles.pressed]}
            onPress={() => navigation.goBack()}
          >
            <HomeIcon name="plus" size={12} color={colors.primary} />
            <Text style={styles.addRoomText}>{t('hotels.cart.addAnother')}</Text>
          </Pressable>

          {/* Price Breakdown 2659:11922 */}
          <View style={styles.panel}>
            <Text style={styles.breakdownTitle}>{t('hotels.cart.breakdown')}</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.rowLabel}>
                  {t('hotels.cart.roomSubtotal', { rooms: roomCount, nights })}
                </Text>
                <Text style={styles.rowValue}>{formatMoney(subtotal, currency)}</Text>
              </View>
              {tax > 0 ? (
                <View style={styles.tableRow}>
                  <Text style={styles.rowLabel}>
                    {t('hotels.cart.tax', { percent: Math.round(RATES.tax * 100) })}
                  </Text>
                  <Text style={styles.rowValue}>{formatMoney(tax, currency)}</Text>
                </View>
              ) : null}
              {service > 0 ? (
                <View style={styles.tableRow}>
                  <Text style={styles.rowLabel}>
                    {t('hotels.cart.service', { percent: Math.round(RATES.service * 100) })}
                  </Text>
                  <Text style={styles.rowValue}>{formatMoney(service, currency)}</Text>
                </View>
              ) : null}
              {memberDiscount > 0 ? (
                <View style={styles.tableRow}>
                  <Text style={styles.rowLabel}>
                    {t('hotels.cart.memberDiscount', {
                      percent: Math.round(RATES.memberDiscount * 100),
                    })}
                  </Text>
                  <Text style={[styles.rowValue, styles.rowValueAccent]}>
                    -{formatMoney(memberDiscount, currency)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.totalBlock}>
                <View style={styles.totalHead}>
                  <Text style={styles.totalLabel}>{t('hotels.cart.totalAmount')}</Text>
                  {EARN_POINTS > 0 ? (
                    <View style={styles.pointsPill}>
                      <Text style={styles.pointsText}>
                        {t('hotels.cart.earnPoints', { points: EARN_POINTS })}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.totalValue}>{formatMoney(total, currency)}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* 吸底 2659:11982 */}
      <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
        >
          <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
          <Text style={styles.backText}>{t('hotels.cart.back')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.checkoutBtn,
            items.length === 0 && styles.disabled,
            pressed && items.length > 0 && styles.pressed,
          ]}
          disabled={items.length === 0}
          onPress={checkout}
        >
          <Text style={styles.checkoutText}>{t('hotels.cart.checkout')}</Text>
        </Pressable>
      </View>

      <ConfirmDialog
        visible={pendingRemove !== null}
        title={t('hotels.cart.removeTitle')}
        message={t('hotels.cart.removeMessage')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.confirm')}
        onCancel={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  safe: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },

  /* ---- 顶栏 ---- */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  topBack: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  topTitle: {
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary,
  },

  main: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 124, gap: 24 },

  /* ---- 通用卡壳(摘要 / 明细 padding 25,房型卡覆盖为 16) ---- */
  panel: {
    width: '100%',
    gap: 16,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  hotelName: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    color: '#0B1C30',
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: '#434655',
  },

  sectionTitle: {
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 24,
    color: colors.heading,
  },

  list: { gap: 16 },

  /* ---- 已选房型卡 ---- */
  roomCard: { padding: 16, gap: 12 },
  roomTop: { flexDirection: 'row', alignItems: 'flex-start' },
  roomCover: { width: 90, height: 90, borderRadius: 8 },
  roomCoverBlank: { backgroundColor: colors.softBlue },
  roomInfo: { flex: 1, minWidth: 0, gap: 4, paddingLeft: 16 },
  roomNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roomName: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },
  /* 稿面「Room 1」胶囊无底色,只有主色文字 */
  roomIndex: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    color: colors.primary,
  },
  attrs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  attr: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 100 },
  attrText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  divider: { height: 1, backgroundColor: colors.softBlue },

  roomBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  promoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  strike: {
    fontFamily: fonts.interSemi,
    fontSize: 10,
    lineHeight: 10,
    textDecorationLine: 'line-through',
    color: colors.textSoft,
  },
  promo: { fontFamily: fonts.interSemi, fontSize: 10, lineHeight: 10, color: colors.primary },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  price: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.primary },
  perNight: { fontFamily: fonts.inter, fontSize: 10, lineHeight: 15, color: colors.textSoft },

  /* ---- Add Another Room ---- */
  addRoom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#C4D2FF',
  },
  addRoomText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },

  /* ---- 明细 ---- */
  breakdownTitle: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 28,
    color: colors.heading,
  },
  table: {
    width: '100%',
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.softBlue,
  },
  rowLabel: { flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },
  rowValue: {
    width: 100,
    textAlign: 'right',
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },
  rowValueAccent: { color: colors.primary },

  totalBlock: { paddingHorizontal: 16, paddingVertical: 8, gap: 4 },
  totalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  pointsPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(65, 105, 237, 0.1)',
  },
  pointsText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textAlign: 'right',
    color: colors.heading,
  },
  totalValue: {
    fontFamily: fonts.interBold,
    fontSize: 40,
    lineHeight: 60,
    letterSpacing: -0.96,
    textAlign: 'right',
    color: colors.primary,
  },

  /* ---- 吸底 ---- */
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: colors.surface,
  },
  backBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  backText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.primary,
  },
  checkoutBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  checkoutText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
