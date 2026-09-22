/**
 * 取消流程里的「Booking Details」摘要卡(Figma `1205:2462` 取消页 / `1205:2679` 结果页,同一规格)
 *
 * 96 方图(圆角 12.8)+ 酒店名 / 日期行 / 金额。取消页与取消成功页两处共用。
 *
 * ⚠️ 预订成功页(`2659:13583`)也有一张同规格的卡,但它内联在那一页里 ——
 * 本轮没有动它(那一页与它的契约脚本都已验过)。**第三处再出现时应把它一并收到这里**。
 *
 * 设计稿实测:`--tab` 底 1px `#E5EEFF` 圆角 24 p25 gap16 投影 0 10 15 `rgba(78,115,255,.08)`;
 *   96 方图圆角 12.8;酒店名 Inter 400 18/22.5;日期行 10.5x11.667 图标 + Inter 500 14/20 `--text-2`;
 *   金额 Inter 700 16/24 主色(与日期行之间 8 的上间距)
 */

import React from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import HomeIcon from '@/components/home/HomeIcon';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  cover: ImageSourcePropType;
  hotelName: string;
  dateRange: string;
  /** 已格式化的金额;不传就不渲染那一行 */
  amount?: string;
}

export default function BookingSummaryCard({ cover, hotelName, dateRange, amount }: Props) {
  return (
    <View style={styles.card}>
      <Image source={cover} style={styles.thumb} resizeMode="cover" />
      <View style={styles.info}>
        <Text style={styles.hotel} numberOfLines={2}>
          {hotelName}
        </Text>
        <View style={styles.dateRow}>
          <HomeIcon name="calendarOutline" width={10.5} height={11.667} color={colors.textSoft} />
          <Text style={styles.dateText} numberOfLines={1}>
            {dateRange}
          </Text>
        </View>
        {amount ? <Text style={styles.amount}>{amount}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5EEFF',
    backgroundColor: colors.surface,
    shadowColor: '#4E73FF',
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  thumb: { width: 96, height: 96, borderRadius: 12.8 },
  info: { flex: 1, minWidth: 0, justifyContent: 'center' },
  hotel: { fontFamily: fonts.inter, fontSize: 18, lineHeight: 22.5, color: colors.heading },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 },
  dateText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },
  amount: {
    paddingTop: 8,
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.primary,
  },
});
