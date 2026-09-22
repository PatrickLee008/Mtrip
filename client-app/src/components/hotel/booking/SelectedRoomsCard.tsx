/**
 * 复核步的「已选房型」卡(Figma Booking Flow Multi Room `2659:14990`)
 *
 * 设计稿实测:
 *   卡壳    白底 / 圆角 12 / padding 16 / gap 16 / 投影 Effect/DS
 *   标题行  左:40 圆底 `rgba(32,77,218,0.1)` + 20 图标(fluent:conference-room-20-filled)
 *              + 「Selected Rooms (n)」Inter 600/18(行高 24)主色 tracking -0.18
 *           右:「Edit Rooms」Inter 600/14 #1F4ED3 + 12 右箭头 —— 点它回购物车页改
 *   房间项  `#F9F9FF` 底 / 圆角 8 / padding 12 / gap 8
 *           「Room n」Inter 600/16(行高 16)主色;90 方图圆角 8;右侧名称 Outfit 600/16
 *           + 「x n」Inter 600/12 主色;属性格 宽 100、Inter 500/12 `--text-2`
 *           价格行 划线原价 + 促销 Inter 600/10、主价 Inter 600/16 主色 +「/ night」
 *
 * 数据来自 `roomCartStore` —— 与房型页、购物车页同一份,避免复核步再算一遍对不上。
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { CartRoom } from '@/store/roomCartStore';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

interface Props {
  rooms: CartRoom[];
  /**
   * 「Edit Rooms」:回购物车页增删改数量。
   * **不传就不渲染那枚按钮** —— 订单详情页(Figma `2659:16386`)复用这张卡但订单已成立、不能再改房,
   * 稿面那里也没有这个入口。
   */
  onEdit?: () => void;
}

export default function SelectedRoomsCard({ rooms, onEdit }: Props) {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  if (rooms.length === 0) return null;

  const roomCount = rooms.reduce((sum, room) => sum + room.quantity, 0);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <View style={styles.headIcon}>
            <HomeIcon name="bed" size={20} color={colors.primary} />
          </View>
          <Text style={styles.headTitle}>
            {t('hotels.booking.review.selectedRooms', { rooms: roomCount })}
          </Text>
        </View>
        {onEdit ? (
        <Pressable
          style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
          onPress={onEdit}
          hitSlop={8}
        >
          <Text style={styles.editText}>{t('hotels.booking.review.editRooms')}</Text>
          <HomeIcon name="chevronRight" size={12} color="#1F4ED3" />
        </Pressable>
        ) : null}
      </View>

      {rooms.map((room, index) => (
        <View key={room.roomKey} style={styles.item}>
          <Text style={styles.roomIndex}>
            {t('hotels.cart.roomIndex', { index: index + 1 })}
          </Text>

          <View style={styles.itemBody}>
            {room.cover ? (
              <Image source={room.cover} style={styles.cover} resizeMode="cover" />
            ) : (
              <View style={[styles.cover, styles.coverBlank]} />
            )}

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {room.name}
                </Text>
                <Text style={styles.times}>
                  {t('hotels.booking.review.roomTimes', { count: room.quantity })}
                </Text>
              </View>

              <View style={styles.attrs}>
                {room.attrs.map((attr) => (
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

          <View>
            {room.strike || room.promoKey ? (
              <View style={styles.promoRow}>
                {room.strike ? (
                  <Text style={styles.strike}>{formatMoney(room.strike, currency)}</Text>
                ) : null}
                {room.promoKey ? <Text style={styles.promo}>{t(room.promoKey)}</Text> : null}
              </View>
            ) : null}
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatMoney(room.price, currency)}</Text>
              <Text style={styles.perNight}>{t('hotels.detail.rooms.perNight')}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    gap: 16,
    padding: 16,
    borderRadius: radius.btn,
    backgroundColor: '#FFFFFF',
    ...shadows.card,
  },
  pressed: { opacity: 0.85 },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(32, 77, 218, 0.1)',
  },
  headTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interSemi,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.18,
    color: colors.primary,
  },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  editText: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#1F4ED3',
  },

  item: {
    width: '100%',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F9F9FF',
  },
  roomIndex: {
    paddingVertical: 4,
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 16,
    color: colors.primary,
  },
  itemBody: { flexDirection: 'row', alignItems: 'flex-start' },
  cover: { width: 90, height: 90, borderRadius: 8 },
  coverBlank: { backgroundColor: colors.softBlue },
  info: { flex: 1, minWidth: 0, gap: 4, paddingLeft: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: {
    flexShrink: 1,
    fontFamily: fonts.outfitSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },
  times: {
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
});
