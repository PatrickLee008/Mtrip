/**
 * 住宿汇总卡(设计稿 Trip 的 Stay n `1675:9554` 与支付页的 Booking Summary `1675:6549`,同一张卡)
 *
 * 设计稿实测:共用壳 padding 25 / gap 16
 *   可选眉头行  「Stay 1」Inter 600/16 主色 + 20 的编辑铅笔(Trip 有,支付页没有)
 *              多住宿支付页(1675:9158)则是一行「Multi Booking (2 Stay)」主色文案
 *   酒店名      Inter 600/24 `#0B1C30`
 *   日期行      10.5x11.667 日历 + Inter 400/16 `#434655`
 *   房型行      Inter 500/14 tracking .14 `#434655` + 右「View Details」Inter 700/14 `#204DDA`
 *   分隔线      1px
 *   总额        TOTAL AMOUNT + Earn Points 徽章 / 价格 Inter 700/32 lh40 tracking -.96 主色
 *   代付条      `--secondary` 底、圆角 32、px12 py4:「Pay by other」+「Share」(只有支付页有)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import HomeIcon from '@/components/home/HomeIcon';
import {
  CARD_HEADING,
  DEEP_PRIMARY,
  FORM_TEXT,
  TINT_CHIP,
  bookingShared,
} from '@/components/hotel/booking/bookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  /** 「Stay 1」;不传就不渲染眉头行 */
  stayLabel?: string | null;
  onEdit?: () => void;
  /** 「Multi Booking (2 Stay)」;与 stayLabel 二选一 */
  eyebrow?: string | null;
  hotelName: string;
  dateLabel: string;
  roomLabel: string;
  viewDetailsLabel: string;
  onViewDetails: () => void;
  totalLabel: string;
  pointsLabel: string;
  total: string;
  /** 代付条(只有支付页有) */
  payByOtherLabel?: string | null;
  shareLabel?: string | null;
  onShare?: () => void;
}

export default function StaySummaryCard({
  stayLabel,
  onEdit,
  eyebrow,
  hotelName,
  dateLabel,
  roomLabel,
  viewDetailsLabel,
  onViewDetails,
  totalLabel,
  pointsLabel,
  total,
  payByOtherLabel,
  shareLabel,
  onShare,
}: Props) {
  return (
    <View style={[bookingShared.panel, styles.card]}>
      {stayLabel ? (
        <View style={styles.stayRow}>
          <Text style={styles.stayLabel}>{stayLabel}</Text>
          <Pressable onPress={onEdit} hitSlop={8}>
            <HomeIcon name="edit" size={20} color={colors.primary} />
          </Pressable>
        </View>
      ) : null}
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}

      <Text style={styles.hotel}>{hotelName}</Text>

      <View style={styles.dateRow}>
        <HomeIcon name="calendar" width={10.5} height={11.667} color={FORM_TEXT} />
        <Text style={styles.dateText}>{dateLabel}</Text>
      </View>

      <View style={styles.roomRow}>
        <Text style={styles.roomText} numberOfLines={1}>
          {roomLabel}
        </Text>
        <Pressable onPress={onViewDetails} hitSlop={8}>
          {({ pressed }) => (
            <Text style={[styles.link, pressed && bookingShared.pressed]}>{viewDetailsLabel}</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.divider} />

      <View>
        <View style={styles.totalHead}>
          <Text style={bookingShared.overline}>{totalLabel}</Text>
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsText}>{pointsLabel}</Text>
          </View>
        </View>
        <Text style={styles.total}>{total}</Text>
      </View>

      {payByOtherLabel ? (
        <View style={styles.payByOther}>
          <Text style={styles.roomText}>{payByOtherLabel}</Text>
          <Pressable style={styles.shareBtn} onPress={onShare} hitSlop={8}>
            <Text style={styles.link}>{shareLabel}</Text>
            <HomeIcon name="shareAndroid" size={20} color={DEEP_PRIMARY} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16 },
  stayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stayLabel: { fontFamily: fonts.interSemi, fontSize: 16, color: colors.primary },
  eyebrow: { fontFamily: fonts.interMedium, fontSize: 16, lineHeight: 24, color: colors.primary },

  hotel: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: CARD_HEADING },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: FORM_TEXT },

  roomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  roomText: {
    flexShrink: 1,
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: FORM_TEXT,
  },
  link: {
    fontFamily: fonts.interBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: DEEP_PRIMARY,
  },

  divider: { height: 1, backgroundColor: colors.softBlue },

  totalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pointsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: TINT_CHIP,
  },
  pointsText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textAlign: 'right',
    color: colors.heading,
  },
  total: {
    fontFamily: fonts.interBold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.96,
    color: colors.primary,
  },

  payByOther: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.card,
    backgroundColor: colors.softBlue,
  },
  shareBtn: { flexDirection: 'row', alignItems: 'center' },
});
