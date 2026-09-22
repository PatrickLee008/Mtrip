/**
 * 「Payment Status / Booking Status (Room n)」状态行组(Figma `2661:16931` Triple Status Confirmation Card)
 *
 * **预订结果页与订单详情页共用这一份**:
 *   结果页   `2659:13475` —— logo 卡里的那段状态行
 *   详情页   `2659:16092` —— Confirmation 卡里的那段状态行(同一个 Figma 组件实例)
 * 两处必须长一样,所以抽出来;各自的外壳(logo / 酒店名 / Booking ID 行)留在各自页面里。
 *
 * 设计稿实测:
 *   整组 gap12;每行 py4 两端对齐
 *   行首   32 圆形主色底 + 20 白图标
 *   文案   Inter 500 16/20 `--text-2`;多房间时第二行是「(Room n)」
 *   药丸   px12 py4 圆角 999:12 图标 + Inter 600 12/16 白色大写 tracking .24
 *   分隔线 1px `--secondary`,**只有一条**(Payment 与第一条 Booking 之间),房间行之间没有
 *
 * ⚠️ 稿面药丸文字是 Plus Jakarta Sans,本项目没装该字族(只加载 Outfit + Inter),用 Inter 顶替。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import HomeIcon, { type HomeIconName } from '@/components/home/HomeIcon';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';

export interface BookingStatusRow {
  key: string;
  /** 第二行的房号「(Room n)」;单房间传空串即不显示 */
  roomLabel: string;
  /** 药丸文案(组件内按大写渲染) */
  badge: string;
  badgeIcon: HomeIconName;
  badgeColor: string;
}

interface Props {
  /** 「Payment Status」行的药丸(本 App 只在支付成功后才进这两页,所以恒为已支付) */
  paymentLabel: string;
  paymentBadge: string;
  /** 「Booking Status」行的文案(每行都用它,房号接在第二行) */
  bookingLabel: string;
  /** 一行一个预订 */
  rows: BookingStatusRow[];
}

export default function BookingStatusRows({
  paymentLabel,
  paymentBadge,
  bookingLabel,
  rows,
}: Props) {
  return (
    <View style={styles.block}>
      <StatusRow
        icon="walletCreditCard"
        label={paymentLabel}
        badge={paymentBadge}
        badgeIcon="checkmarkCircle"
        badgeColor={colors.statusPaid}
      />
      <View style={styles.divider} />
      {rows.map((row) => (
        <StatusRow
          key={row.key}
          icon="calendarClock"
          label={bookingLabel}
          subLabel={row.roomLabel}
          badge={row.badge}
          badgeIcon={row.badgeIcon}
          badgeColor={row.badgeColor}
        />
      ))}
    </View>
  );
}

function StatusRow({
  icon,
  label,
  subLabel,
  badge,
  badgeIcon,
  badgeColor,
}: {
  icon: HomeIconName;
  label: string;
  subLabel?: string;
  badge: string;
  badgeIcon: HomeIconName;
  badgeColor: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.icon}>
          <HomeIcon name={icon} size={20} color="#FFFFFF" />
        </View>
        <Text style={styles.label}>
          {label}
          {subLabel ? `\n${subLabel}` : ''}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <HomeIcon name={badgeIcon} size={12} color="#FFFFFF" />
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { width: '100%', gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  left: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 20,
    color: colors.textSoft,
  },
  divider: { height: 1, backgroundColor: colors.softBlue },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.24,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
});
