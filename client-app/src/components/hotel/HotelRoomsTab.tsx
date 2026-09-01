/**
 * 酒店详情 · Rooms 页签(Figma M-Trip / Hotel Details Rooms 222:1594「Section 3: Room Explorer」)
 *
 * 结构:标题行(Room Explorer + 面积单位切换)→ 三张房型卡(gap 16)。
 *
 * 设计稿的面积单位在 Standard/Deluxe 写 sq Ft、Family 写 sqm,页头还给了个 `Unit Sq Ft ⇄` 的切换按钮。
 * 两种单位之间的换算口径没有依据(设计稿数值本身也对不上),故**单位按卡片各自的原值展示**,
 * 切换按钮走 comingSoon。
 *
 * 设计稿这一页的底部价格栏是 hidden 的(每张卡自带 Select),页面据此在本页签隐藏底栏。
 *
 * 房型卡的 Select 已接上订房流程(Figma section 1675:5776):由页面传 `onSelectRoom` 进来,
 * 落到 `HotelBooking` 路由;其余交互(收藏、See Details、360°/全景、面积单位切换)仍是 comingSoon。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TEMP_ROOM_COVERS } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import HotelRoomCard from '@/components/hotel/HotelRoomCard';
import { detailShared } from '@/components/hotel/detailShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { DETAIL_ROOMS, ROOM_FACILITY_ICONS } from '@/screens/hotel/detailDemo';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

interface Props {
  /** 设计稿有、当前没有对应实现的交互统一走这里 */
  onComingSoon: () => void;
  /** 点 Select 进订房流程 */
  onSelectRoom: (roomKey: string) => void;
}

export default function HotelRoomsTab({ onComingSoon, onSelectRoom }: Props) {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

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

      <View style={styles.list}>
        {DETAIL_ROOMS.map((room) => (
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
            selectLabel={t('hotels.detail.rooms.select')}
            bestsellerLabel={room.bestseller ? t('hotels.detail.rooms.bestseller') : null}
            favorite={room.favorite}
            viewer={room.viewer}
            onPress={onComingSoon}
            onToggleFavorite={onComingSoon}
            onSelect={() => onSelectRoom(room.key)}
            onOpenViewer={onComingSoon}
          />
        ))}
      </View>
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
  pressed: { opacity: 0.85 },
});
