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
 *
 * 钱包部分抵扣(Figma「Hotel Payment - mTrip Wallet」`3465:8719`,PRD 模块 25):
 *   用了钱包时合计显示**还需另付的部分**,胶囊换成主色「Wallet applied」(`3465:9461`);
 *   钱包付清全额时合计 MMK 0,金额右侧加绿色「Zero Out of Pocket」标(`3465:9540`,--green #00A66F);
 *   付不清时合计上方多一行「订单总额 / 钱包抵扣」(`walletLines`,稿面之外补的,说明合计为什么变小)。
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

/** 稿面 --green(「Zero Out of Pocket」),主题里没有同值令牌 */
const ZERO_GREEN = '#00A66F';

interface Props {
  /** 「Stay 1」;不传就不渲染眉头行 */
  stayLabel?: string | null;
  onEdit?: () => void;
  /** 右侧红色删除(多酒店第 2 步 Stay 卡片 2863:7532);不传不显示 */
  onDelete?: () => void;
  /** 「Multi Booking (2 Stay)」;与 stayLabel 二选一 */
  eyebrow?: string | null;
  hotelName: string;
  dateLabel: string;
  roomLabel: string;
  viewDetailsLabel: string;
  onViewDetails: () => void;
  totalLabel: string;
  /** 合计右上的胶囊文字;空串不渲染 */
  pointsLabel: string;
  /** 胶囊用主色字(多房间新稿的「Wallet applied」);默认正文色(积分) */
  pointsAccent?: boolean;
  total: string;
  /** 合计金额右侧的绿色标(钱包付清时的「Zero Out of Pocket」,`3465:9540`);不传不渲染 */
  totalTag?: string | null;
  /** 合计上方的明细行(钱包部分抵扣:订单总额 / 钱包抵扣);`accent` 行用主色 */
  walletLines?: { key: string; label: string; value: string; accent?: boolean }[] | null;
  /** 「Pay Within 00:10:00」行(多房间新稿 2659:13318),前后各一条分隔线;不传不渲染 */
  payWithin?: { label: string; value: string } | null;
  /** 代付条(只有支付页有) */
  payByOtherLabel?: string | null;
  shareLabel?: string | null;
  onShare?: () => void;
}

export default function StaySummaryCard({
  stayLabel,
  onEdit,
  onDelete,
  eyebrow,
  hotelName,
  dateLabel,
  roomLabel,
  viewDetailsLabel,
  onViewDetails,
  totalLabel,
  pointsLabel,
  pointsAccent = false,
  total,
  totalTag,
  walletLines,
  payWithin,
  payByOtherLabel,
  shareLabel,
  onShare,
}: Props) {
  return (
    <View style={[bookingShared.panel, styles.card]}>
      {stayLabel ? (
        <View style={styles.stayRow}>
          <Text style={styles.stayLabel}>{stayLabel}</Text>
          {onEdit ? (
            <Pressable onPress={onEdit} hitSlop={8}>
              <HomeIcon name="edit" size={20} color={colors.primary} />
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable style={styles.deleteBtn} onPress={onDelete} hitSlop={8}>
              <HomeIcon name="delete" size={20} color={colors.hot} />
            </Pressable>
          ) : null}
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

      {payWithin ? (
        <>
          <View style={styles.payWithinRow}>
            <Text style={styles.payWithinLabel}>{payWithin.label}</Text>
            <Text style={styles.payWithinValue}>{payWithin.value}</Text>
          </View>
          <View style={styles.divider} />
        </>
      ) : null}

      <View>
        {walletLines && walletLines.length > 0 ? (
          <View style={styles.walletLines}>
            {walletLines.map((line) => (
              <View key={line.key} style={styles.walletLine}>
                <Text style={[styles.walletLineLabel, line.accent && styles.accentText]}>{line.label}</Text>
                <Text style={[styles.walletLineValue, line.accent && styles.accentText]}>{line.value}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.totalHead}>
          <Text style={bookingShared.overline}>{totalLabel}</Text>
          {pointsLabel ? (
            <View style={styles.pointsBadge}>
              <Text style={[styles.pointsText, pointsAccent && styles.pointsTextAccent]}>{pointsLabel}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.total}>{total}</Text>
          {totalTag ? (
            <View style={styles.totalTag}>
              <HomeIcon name="checkmarkCircle" size={18} color={ZERO_GREEN} />
              <Text style={styles.totalTagText}>{totalTag}</Text>
            </View>
          ) : null}
        </View>
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
  deleteBtn: { marginLeft: 'auto' },
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

  payWithinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  payWithinLabel: { fontFamily: fonts.inter, fontSize: 16, color: colors.heading },
  /* 稿面 --tertiary #EC1317,主题里同值的是 hot */
  payWithinValue: { fontFamily: fonts.interSemi, fontSize: 20, color: colors.hot },

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
  pointsTextAccent: { color: colors.primary },
  walletLines: { gap: 4, marginBottom: 12 },
  walletLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  walletLineLabel: { flexShrink: 1, fontFamily: fonts.inter, fontSize: 14, lineHeight: 20, color: FORM_TEXT },
  walletLineValue: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 20, color: colors.heading },
  accentText: { color: colors.primary },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  /* 稿面 3465:9540:px12 py6 全圆角,勾 + Inter 700 12/16 tracking .24 --green */
  totalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  totalTagText: {
    fontFamily: fonts.interBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.24,
    color: ZERO_GREEN,
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
