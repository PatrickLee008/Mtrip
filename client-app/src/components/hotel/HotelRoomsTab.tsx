/**
 * 酒店详情 · Rooms 页签(Figma M-Trip / Hotel Details Rooms 222:1594「Section 3: Room Explorer」)
 *
 * 结构:标题行(Room Explorer + 面积单位切换)→ 三张房型卡(gap 16)。
 *
 * 设计稿的面积单位在 Standard/Deluxe 写 sq Ft、Family 写 sqm,页头还给了个 `Unit Sq Ft ⇄` 的切换按钮。
 * 两种单位之间的换算口径没有依据(设计稿数值本身也对不上),故**单位按卡片各自的原值展示**,
 * 切换按钮走 comingSoon。
 *
 * 新稿 222:1428 把底栏改成了**购物车栏**:每张卡的按钮由 Select 改为 Choose,点一下把该房型
 * 加入购物车,按钮**就地换成加减器**(与购物车页同一个 `RoomStepper`),减到 0 直接移出、
 * 变回 Choose 且**不弹确认**(购物车页那张确认框是删除整条时才有的,这里点错再点一下就回来了);
 * 底栏显示合计与已选件数,由「Continue」统一进订房流程 —— 所以本页签不再隐藏底栏,
 * 卡片按钮也不再直接跳转。选中态与间数由页面持有(`roomCartStore`),本组件只做展示与回调。
 *
 * 真实房型的 See Details 进正常模式房型详情页(`RoomDetail`,Figma 281:1041);
 * 其余交互(演示房型的 See Details、收藏、360°/全景、面积单位切换)仍是 comingSoon。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { TEMP_ROOM_COVERS } from '@/assets/tempImages';
import { EmptyView } from '@/components/common/StateViews';
import HomeIcon, { type HomeIconName } from '@/components/home/HomeIcon';
import HotelRoomCard from '@/components/hotel/HotelRoomCard';
import { detailShared } from '@/components/hotel/detailShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { DETAIL_ROOMS, ROOM_FACILITY_ICONS } from '@/screens/hotel/detailDemo';
import { useSiteStore } from '@/store/siteStore';
import type { GoodsSku } from '@/types/models';
import { formatMoney } from '@/utils/format';
import { resolveMediaUri } from '@/utils/media';

interface Props {
  /** 设计稿有、当前没有对应实现的交互统一走这里 */
  onComingSoon: () => void;
  /**
   * 点 Choose 把房型加入购物车(置 1 间)。
   * 单价与 `extra`(名称/封面/属性)一并回传:演示房型没有 `GoodsSku`,
   * 且购物车页不重新请求详情,展示所需的字段只能在加购这一刻带过去。
   */
  onChooseRoom: (
    roomKey: string,
    price: number,
    sku?: GoodsSku,
    extra?: {
      name: string;
      cover?: ImageSourcePropType;
      attrs: { key: string; icon: HomeIconName; label: string }[];
    },
  ) => void;
  /** 加减器改间数;0 表示移出购物车(按钮变回 Choose,**不弹确认**) */
  onChangeQuantity: (roomKey: string, quantity: number) => void;
  /** 各房型在购物车里的间数(未选的不在表里 = 0),决定卡片显示 Choose 还是加减器 */
  quantities: Record<string, number>;
  /** 真实商品详情下发的房型;不传时仍显示设计稿演示房型 */
  rooms?: GoodsSku[];
  /** 真实房型的 See Details;演示房型没有详情数据,仍走 comingSoon */
  onSeeDetails?: (room: GoodsSku) => void;
}

const FALLBACK_COVERS = [TEMP_ROOM_COVERS.standard, TEMP_ROOM_COVERS.deluxe, TEMP_ROOM_COVERS.family];

/** 房型图:接口没给或给了脏值时落到设计稿的临时房型封面 */
function mediaSource(uri: string | undefined, fallback: ImageSourcePropType): ImageSourcePropType {
  const remote = resolveMediaUri(uri);
  return remote ? { uri: remote } : fallback;
}

/** 购物车卡片那排属性;走函数而不是对象字面量,icon 才能自然推成 HomeIconName */
function attr(key: string, icon: HomeIconName, label: string) {
  return { key, icon, label };
}

/** 真实房型的封面:接口图优先,没有就按卡片序号轮流用设计稿临时图(房型详情页也按同一序号取,两处封面一致) */
export function realRoomCover(room: GoodsSku, index: number): ImageSourcePropType {
  const images = Array.isArray(room.images) ? room.images : [];
  return mediaSource(images[0], FALLBACK_COVERS[index % FALLBACK_COVERS.length]);
}

/**
 * 真实房型加购所需的全部参数(`onChooseRoom` 的入参)。房型卡的 Choose 与房型详情页的
 * Book This Room / Reserve now 共用这一份,购物车里同一房型的名称/封面/属性不会因入口不同而走样。
 */
export function realRoomCartEntry(room: GoodsSku, index: number, t: TFunction) {
  return {
    roomKey: `room-${room.id}`,
    price: Number(room.base_price),
    sku: room,
    extra: {
      name: room.room_name ?? `#${room.id}`,
      cover: realRoomCover(room, index),
      attrs: [
        attr('guests', 'guests', t('hotels.detail.rooms.guests', { guests: room.max_guests ?? 2 })),
        attr('bed', 'bedSize', room.bed_type || t('hotels.detail.rooms.beds.king')),
        ...(room.breakfast
          ? [attr('breakfast', 'breakfast', t('hotels.detail.rooms.facilities.breakfast'))]
          : []),
      ],
    },
  };
}

function facilityIcon(label: string) {
  const key = label.toLowerCase();
  if (key.includes('breakfast') || key.includes('餐')) return ROOM_FACILITY_ICONS.breakfast;
  if (key.includes('pool') || key.includes('泳')) return ROOM_FACILITY_ICONS.pool;
  if (key.includes('parking') || key.includes('停')) return ROOM_FACILITY_ICONS.parking;
  return ROOM_FACILITY_ICONS.wifi;
}

export default function HotelRoomsTab({
  onComingSoon,
  onChooseRoom,
  onChangeQuantity,
  quantities,
  rooms,
  onSeeDetails,
}: Props) {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);
  const realMode = Array.isArray(rooms);

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={detailShared.sectionTitle}>{t('hotels.detail.rooms.title')}</Text>
        <Pressable
          style={({ pressed }) => [styles.unitBtn, pressed && styles.pressed]}
          onPress={onComingSoon}
          hitSlop={6}
        >
          <Text style={styles.unitLabel}>{t('hotels.detail.rooms.unit')}</Text>
          <Text style={styles.unitValue}>{t('hotels.detail.rooms.units.sqft')}</Text>
          <View style={styles.unitSwap}>
            <HomeIcon name="swapUnit" size={20} color={colors.primary} />
          </View>
        </Pressable>
      </View>

      {realMode && rooms.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyView text={t('common.empty')} />
        </View>
      ) : (
        <View style={styles.list}>
          {realMode ? rooms.map((room, index) => {
            const images = Array.isArray(room.images) ? room.images : [];
            const facilities = (Array.isArray(room.facilities) && room.facilities.length > 0
              ? room.facilities
              : ['WiFi']).slice(0, 4);
            return (
              <HotelRoomCard
                key={room.id}
                gradientKey={`room-${room.id}`}
                cover={realRoomCover(room, index)}
                photoCount={t('hotels.detail.photoCount', { index: Math.min(1, images.length || 1), total: Math.max(1, images.length || 1) })}
                name={room.room_name ?? `#${room.id}`}
                leftLabel={room.base_stock > 0 ? t('hotels.detail.rooms.left', { rooms: room.base_stock }) : null}
                seeDetailsLabel={t('hotels.detail.rooms.seeDetails')}
                guestsLabel={t('hotels.detail.rooms.guests', { guests: room.max_guests ?? 2 })}
                bedLabel={room.bed_type || t('hotels.detail.rooms.beds.king')}
                bedCount={1}
                areaLabel={t('hotels.detail.rooms.area', {
                  area: room.area || '-',
                  unit: '',
                })}
                facilities={facilities.map((label) => {
                  const meta = facilityIcon(label);
                  return { key: label, icon: meta.icon, size: meta.size, label };
                })}
                strike={null}
                promo={null}
                price={formatMoney(room.base_price, currency)}
                perNightLabel={t('hotels.detail.rooms.perNight')}
                selectLabel={t('hotels.detail.rooms.choose')}
                quantity={quantities[`room-${room.id}`] ?? 0}
                bestsellerLabel={index === 0 ? t('hotels.detail.rooms.bestseller') : null}
                favorite={false}
                viewer={images.length > 1}
                onPress={onSeeDetails ? () => onSeeDetails(room) : onComingSoon}
                onToggleFavorite={onComingSoon}
                onChangeQuantity={(quantity) => onChangeQuantity(`room-${room.id}`, quantity)}
                onSelect={() => {
                  const entry = realRoomCartEntry(room, index, t);
                  onChooseRoom(entry.roomKey, entry.price, entry.sku, entry.extra);
                }}
                onOpenViewer={onComingSoon}
              />
            );
          }) : DETAIL_ROOMS.map((room) => (
          <HotelRoomCard
            key={room.key}
            gradientKey={room.key}
            cover={TEMP_ROOM_COVERS[room.key]}
            /* 设计稿写死 2/12,素材只导出了封面一张,这里沿用设计稿文案 */
            photoCount={t('hotels.detail.photoCount', { index: 2, total: 12 })}
            name={t(`hotels.detail.rooms.names.${room.key}`)}
            /* 插值键一律避开 i18next 保留字 count(会触发复数查找),同 hotels.results.* 的约定 */
            leftLabel={room.left ? t('hotels.detail.rooms.left', { rooms: room.left }) : null}
            seeDetailsLabel={t('hotels.detail.rooms.seeDetails')}
            guestsLabel={t('hotels.detail.rooms.guests', { guests: room.guests })}
            bedLabel={
              room.bedCount > 1
                ? t('hotels.detail.rooms.bedsMultiple', {
                    beds: room.bedCount,
                    bed: t(`hotels.detail.rooms.beds.${room.bed}`),
                  })
                : t(`hotels.detail.rooms.beds.${room.bed}`)
            }
            bedCount={room.bedCount}
            areaLabel={t('hotels.detail.rooms.area', {
              area: room.area,
              unit: t(`hotels.detail.rooms.units.${room.areaUnit}`),
            })}
            facilities={room.facilities.map((key) => ({
              key,
              icon: ROOM_FACILITY_ICONS[key].icon,
              size: ROOM_FACILITY_ICONS[key].size,
              label: t(`hotels.detail.rooms.facilities.${key}`),
            }))}
            strike={room.strike ? formatMoney(room.strike, currency) : null}
            promo={room.promoKey ? t(room.promoKey) : null}
            price={formatMoney(room.price, currency)}
            perNightLabel={room.perNight ? t('hotels.detail.rooms.perNight') : null}
            selectLabel={t('hotels.detail.rooms.choose')}
            quantity={quantities[room.key] ?? 0}
            bestsellerLabel={room.bestseller ? t('hotels.detail.rooms.bestseller') : null}
            favorite={room.favorite}
            viewer={room.viewer}
            onPress={onComingSoon}
            onToggleFavorite={onComingSoon}
            onChangeQuantity={(quantity) => onChangeQuantity(room.key, quantity)}
            onSelect={() =>
              onChooseRoom(room.key, room.price, undefined, {
                name: t(`hotels.detail.rooms.names.${room.key}`),
                cover: TEMP_ROOM_COVERS[room.key],
                attrs: [
                  attr('guests', 'guests', t('hotels.detail.rooms.guests', { guests: room.guests })),
                  attr('bed', 'bedSize', t(`hotels.detail.rooms.beds.${room.bed}`)),
                ],
              })
            }
            onOpenViewer={onComingSoon}
          />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  unitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  unitLabel: {
    fontFamily: fonts.outfit,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSoft,
  },
  unitValue: {
    fontFamily: fonts.outfitSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },
  unitSwap: { padding: 4, borderRadius: 32, backgroundColor: colors.softBlue },

  list: { gap: 16 },
  emptyWrap: { minHeight: 180 },
  pressed: { opacity: 0.85 },
});
