/**
 * 关怀模式酒店详情页(Figma section `Hotel Details Lite` `2352:5591`)
 *
 * 两张稿同一页两态:
 *   单选 `2492:10399`「Choose a Room」—— 每张房卡右下角一枚 Choose,选完直接进订房向导;
 *   多选 `2707:13098`「Choose Multiple Room」—— 房卡换成加减器,底部多一条合计栏(Total Price +
 *   购物车 + Continue)。标题右侧的链接在两态之间来回切(`+ Choose Single` / `+ Choose Multiple`)。
 *
 * 与完整模式 `HotelDetailScreen`(94:438)的关系:完整版是「图库 + 六个页签」,
 * 关怀版把首屏收成「标题卡 + 房型列表」,设施 / 周边 / 评价挪到「View Hotel Detail」那一页
 * (`HotelInfoLiteScreen`),退改与政策挪到顶栏的「Hotel Policy」(`HotelPolicyLiteScreen`)。
 *
 * 设计稿实测:
 *   页面   底色 --background;Main pt80 px16 pb16 gap24(顶栏绝对定位在状态栏下)
 *   顶栏   px20 py16:左 20 返回 + 「Hotel Details」Outfit 600/24;右「Hotel Policy」按钮
 *          (20 文档图标 + Inter 600/16 主色)
 *   标题卡 白底 1px --secondary 圆角 24 padding 21 gap12,投影 0/1 blur1 黑 5%:
 *          酒店名 Inter 600/24/32 → 地址(16 定位图标 + Inter 400/14/24 --text-2)
 *          → 底行 See Map(Inter 600/16 主色 + 20 地图图标)/ View Hotel Detail(Outfit 600/16 主色)
 *   区标题 「Choose a Room」Outfit 600/24;房卡见 components/hotel/lite/LiteRoomCard
 *   合计栏 白底、上边框 rgba(196,197,215,.3)、px20 pt17 pb16:
 *          左 Total Price(Inter 600/12)+ 金额(Inter 600/20/24 主色);
 *          右 购物车(1px 主色描边圆角 12,40 图标,右上角计数气泡)+ Continue(主色圆角 12 px32 py16)
 *
 * **多选的合计只是把「单价 × 间数」加起来**:后端一单只收一个 sku(见 HANDOFF 订房那条),
 * 所以 Continue 仍带**第一个选中的房型**进订房向导,其余间数只体现在这一屏的合计上。
 * 真正的多房间下单要等订房流程 Lite 版与后端多 sku 支持,这里不假装能下多间。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchGoodsDetail } from '@/api/goods';
import { tempCoverFor } from '@/assets/tempImages';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import LiteRoomCard, { type RoomCardMode } from '@/components/hotel/lite/LiteRoomCard';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import type { GoodsDetail, GoodsSku } from '@/types/models';
import { formatMoney } from '@/utils/format';

export default function HotelDetailLiteScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = useRoute<RouteProp<RootStackParamList, 'HotelDetailLite'>>().params;
  const showToast = useCommonStore((s) => s.showToast);
  const currency = useSiteStore((s) => s.currency);

  const [detail, setDetail] = useState<GoodsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<RoomCardMode>('single');
  /** 多选态的「房型 id → 间数」 */
  const [picked, setPicked] = useState<Record<number, number>>({});

  const comingSoon = () => showToast(t('home.comingSoon'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await fetchGoodsDetail(params.id));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const rooms = detail?.skus ?? [];

  /** 多选合计 = Σ 单价 × 间数 */
  const total = useMemo(
    () =>
      rooms.reduce((sum, sku) => sum + Number(sku.base_price) * (picked[sku.id] ?? 0), 0),
    [rooms, picked],
  );
  const pickedCount = useMemo(
    () => Object.values(picked).reduce((sum, n) => sum + n, 0),
    [picked],
  );

  if (loading) return <LoadingView />;
  if (error || !detail) return <ErrorView message={error} onRetry={() => void load()} />;

  const goBooking = (sku: GoodsSku) =>
    navigation.navigate('HotelBookingLite', {
      propertyId: detail.id,
      roomTypeId: sku.id,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
    });

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>
            {t('hotels.lite.detailTitle')}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.policyBtn, pressed && styles.pressed]}
            onPress={() => navigation.navigate('HotelPolicyLite', { id: detail.id })}
            hitSlop={8}
          >
            <HomeIcon name="documentList" size={20} color={colors.primary} />
            <Text style={styles.policyText}>{t('hotels.lite.hotelPolicy')}</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.main, mode === 'multi' && styles.mainWithBar]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleCard}>
            <Text style={styles.hotelName}>{detail.goods_name}</Text>

            <View style={styles.addressRow}>
              <HomeIcon name="locationOutline" size={16} color={colors.textSoft} />
              <Text style={styles.address}>{detail.address}</Text>
            </View>

            <View style={styles.linkRow}>
              <Pressable
                style={({ pressed }) => [styles.mapLink, pressed && styles.pressed]}
                onPress={comingSoon}
                hitSlop={6}
              >
                <Text style={styles.linkText}>{t('hotels.lite.seeMap')}</Text>
                <HomeIcon name="map" size={20} color={colors.primary} />
              </Pressable>
              <Pressable
                style={({ pressed }) => pressed && styles.pressed}
                onPress={() => navigation.navigate('HotelInfoLite', { id: detail.id })}
                hitSlop={6}
              >
                <Text style={styles.viewDetail}>{t('hotels.lite.viewHotelDetail')}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.roomsHead}>
            <Text style={styles.roomsTitle}>
              {t(mode === 'single' ? 'hotels.lite.chooseRoom' : 'hotels.lite.chooseMultiRoom')}
            </Text>
            <Pressable
              style={({ pressed }) => pressed && styles.pressed}
              onPress={() => {
                setMode((prev) => (prev === 'single' ? 'multi' : 'single'));
                setPicked({});
              }}
              hitSlop={6}
            >
              <Text style={styles.modeLink}>
                {t(mode === 'single' ? 'hotels.lite.switchMulti' : 'hotels.lite.switchSingle')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.rooms}>
            {rooms.map((sku, index) => (
              <LiteRoomCard
                key={sku.id}
                sku={sku}
                /* 房型没有图时轮流用设计稿临时图兜底(与结果页同一套) */
                coverSource={tempCoverFor(index)}
                /* 设计稿第一张卡挂 Bestseller;接口没有这个标记,按「排序最前」等价处理 */
                badge={index === 0 ? t('hotels.lite.bestseller') : null}
                mode={mode}
                quantity={picked[sku.id] ?? 0}
                onSeeRoom={(room) =>
                  navigation.navigate('RoomDetailLite', {
                    goodsId: detail.id,
                    skuId: room.id,
                    checkIn: params.checkIn,
                    checkOut: params.checkOut,
                  })
                }
                onChoose={goBooking}
                onChangeQuantity={(room, quantity) =>
                  setPicked((prev) => ({ ...prev, [room.id]: Math.max(0, quantity) }))
                }
              />
            ))}
            {rooms.length === 0 ? (
              <Text style={styles.emptyRooms}>{t('hotels.detail.rooms.empty')}</Text>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* 多选态的合计栏 */}
      {mode === 'multi' ? (
        <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
          <View style={styles.bottomInner}>
            <View>
              <Text style={styles.totalLabel}>{t('hotels.lite.totalPrice')}</Text>
              <Text style={styles.totalValue}>{formatMoney(total, currency)}</Text>
            </View>

            <View style={styles.bottomActions}>
              <Pressable
                style={({ pressed }) => [styles.cartBtn, pressed && styles.pressed]}
                onPress={comingSoon}
                hitSlop={6}
              >
                <HomeIcon name="cart" size={28} color={colors.primary} />
                {pickedCount > 0 ? (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{pickedCount}</Text>
                  </View>
                ) : null}
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.continueBtn,
                  pickedCount === 0 && styles.continueDisabled,
                  pressed && pickedCount > 0 && styles.pressed,
                ]}
                disabled={pickedCount === 0}
                onPress={() => {
                  const first = rooms.find((sku) => (picked[sku.id] ?? 0) > 0);
                  if (first) goBooking(first);
                }}
              >
                <Text style={styles.continueText}>{t('hotels.lite.continue')}</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  safe: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  topTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary,
  },
  policyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  policyText: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.primary },

  main: { paddingHorizontal: PAGE_PADDING, paddingBottom: 16, gap: 24 },
  /* 合计栏是绝对定位的,多选态给列表留出它的高度 */
  mainWithBar: { paddingBottom: 120 },

  titleCard: {
    width: '100%',
    padding: 21,
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: '#FFFFFF',
    ...shadows.subtle,
  },
  hotelName: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.heading },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  address: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.inter,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSoft,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  linkText: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  viewDetail: { fontFamily: fonts.outfitSemi, fontSize: 16, lineHeight: 24, color: colors.primary },

  roomsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  roomsTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 28,
    color: colors.heading,
  },
  modeLink: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.primary },

  rooms: { gap: 16 },
  emptyRooms: {
    paddingVertical: 24,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSoft,
    textAlign: 'center',
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 197, 215, 0.3)',
    backgroundColor: '#FFFFFF',
  },
  bottomInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 17,
    paddingBottom: 16,
  },
  totalLabel: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: colors.heading },
  totalValue: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 24, color: colors.primary },

  bottomActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cartBtn: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  cartBadge: {
    position: 'absolute',
    right: 4,
    top: -8,
    minWidth: 24,
    paddingHorizontal: 6,
    borderRadius: 99,
    backgroundColor: colors.primary,
  },
  cartBadgeText: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  continueBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  continueDisabled: { opacity: 0.5 },
  continueText: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 24, color: '#FFFFFF' },
});
