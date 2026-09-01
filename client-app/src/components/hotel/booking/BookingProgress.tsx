/**
 * 向导进度条(设计稿 1675:6071「Progress Indicator」)
 *
 * 设计稿实测:整块 gap 8;上行两端对齐 ——
 *   左「Step n of 4」Inter 500/14 tracking .14(第 1、2 步是 `#204DDA`,第 3、4 步换成 `--primary`,
 *   这里统一取主色系的深色 `#204DDA`,两者肉眼几乎不可分,避免为一像素差再开一个状态)
 *   右步骤名 Inter 500/14 tracking .14(第 1、2 步 `#434655`,第 3、4 步 `--text-2`,同上取 `#434655`)
 *   下条 h8、圆角 9999、`--secondary` 轨道 + 主色填充,填充宽度 = step/4
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DEEP_PRIMARY, FORM_TEXT } from '@/components/hotel/booking/bookingShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { BOOKING_PROGRESS_TOTAL } from '@/screens/hotel/bookingDemo';

interface Props {
  /** 1 起算 */
  step: number;
  /** 右侧步骤名 */
  title: string;
}

export default function BookingProgress({ step, title }: Props) {
  const { t } = useTranslation();
  const ratio = Math.min(Math.max(step / BOOKING_PROGRESS_TOTAL, 0), 1);

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Text style={styles.step}>
          {t('hotels.booking.stepOf', { step, total: BOOKING_PROGRESS_TOTAL })}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  step: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: DEEP_PRIMARY,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'right',
    color: FORM_TEXT,
  },
  track: {
    height: 8,
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.softBlue,
  },
  fill: { height: '100%', backgroundColor: colors.primary },
});
