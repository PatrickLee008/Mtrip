/**
 * 日期确认页顶部的摘要卡(设计稿 1675:6081)
 *
 * 两行,每行 = 圆角 8 的浅底图标板 + 两行文案:
 *   行 1 「BOOKING DURATION」+ 入住 / 离店两枚 `--background` 底的日期胶囊 + 中间箭头 + 晚数胶囊
 *        —— **纯展示,不可点**:改日期走它下面那张常驻的 `BookingCalendar`,
 *        再叠一个日期选择弹层等于同一件事有两个入口,反而容易误触。
 *   行 2 「GUESTS & ROOMS」+「2 Adults, 1 Room」Inter 600/16
 * 图标板设计稿是 42x44 / 46x40 的 `rgba(66,104,244,0.1)` 圆角矩形,里面各是 18x20 / 22x16 的图标。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { TINT_BUTTON, bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  checkInLabel: string;
  checkOutLabel: string;
  nightsLabel: string;
  guestsLabel: string;
}

export default function BookingSummaryBar({
  checkInLabel,
  checkOutLabel,
  nightsLabel,
  guestsLabel,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={bookingShared.panel}>
      <View style={styles.row}>
        <View style={[styles.tile, styles.tileDate]}>
          <HomeIcon name="calendarOutline" width={18} height={20} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={bookingShared.overline}>{t('hotels.booking.dates.duration')}</Text>
          <View style={styles.chipRow}>
            <View style={[styles.chip, styles.flex]}>
              <Text style={styles.chipText} numberOfLines={1}>
                {checkInLabel}
              </Text>
            </View>
            <View style={styles.arrow}>
              <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
            </View>
            <View style={[styles.chip, styles.flex]}>
              <Text style={styles.chipText} numberOfLines={1}>
                {checkOutLabel}
              </Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipMuted} numberOfLines={1}>
                {nightsLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.row, styles.rowSecond]}>
        <View style={[styles.tile, styles.tileGuests]}>
          <HomeIcon name="travelers" width={22} height={16} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={bookingShared.overline}>{t('hotels.booking.dates.guestsRooms')}</Text>
          <Text style={styles.guests}>{guestsLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  rowSecond: { marginTop: 24 },
  flex: { flex: 1, minWidth: 0 },

  tile: { alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: TINT_BUTTON },
  tileDate: { width: 42, height: 44 },
  tileGuests: { width: 46, height: 40 },

  chipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  chip: {
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.pageBg,
  },
  chipText: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 24, color: colors.heading },
  chipMuted: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
  },
  /* 设计稿这枚是 arrow-left 旋转 180° */
  arrow: { transform: [{ rotate: '180deg' }] },

  guests: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.heading },
});
