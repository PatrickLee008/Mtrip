/**
 * 日期确认页的「Selected Dates」日历(设计稿 1675:6105「Calendar Module」)
 *
 * 设计稿实测:卡片 `--tab` 底 / 1px `--secondary` / 圆角 32 / padding 24 / gap 16
 *   标题行 「Selected Dates」Inter 600/20 与月份 Inter 500/20,两端对齐
 *   7 列 gap 8;表头 py8 Inter 600/12 tracking .6 `#747686`,周六日 `--tertiary`
 *   日期格 py12 Inter 400/16 居中;区间首尾主色白字(外侧圆角 12)、
 *          区间中间 `rgba(66,104,244,0.2)` 底 + 主色 600;过去日 `--text-2` + 40% 透明
 *
 * 与设计稿的取舍:
 *   - 设计稿是「Mini Calendar Mockup」(只画了四周),这里按真实月份铺满整月,同 `DatePickerSheet`。
 *   - 首尾格下方那枚 4px 白点(1675:6172)落在白卡上不可见,未实现(同日期选择器的处理)。
 *   - 7 列等宽用像素算,不用百分比 —— RN 的 flexWrap + gap 不会自动扣列间距,会挤到第二行。
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { bookingShared } from '@/components/hotel/booking/bookingShared';
import { PAGE_PADDING, colors } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 卡片尺寸常量:列宽由它们算出来,改内边距时一起改 */
const CARD_PADDING = 24;
const CARD_BORDER = 1;
const GRID_GAP = 8;

/** 2024-01-01 是周一,用来生成「周一起」的星期表头(同 DatePickerSheet) */
const MONDAY_ANCHOR = new Date(2024, 0, 1);

function toKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

interface Props {
  /** `YYYY-MM-DD` */
  checkIn: string;
  checkOut: string;
  /** 点日期格:调用方决定是重新起头还是收尾(这里只上报) */
  onPickDate: (key: string) => void;
}

export default function BookingCalendar({ checkIn, checkOut, onPickDate }: Props) {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();

  const cellWidth =
    Math.floor(
      ((width - PAGE_PADDING * 2 - (CARD_PADDING + CARD_BORDER) * 2 - GRID_GAP * 6) / 7) * 100,
    ) / 100;

  /** 以入住月为准展示 */
  const cursor = useMemo(() => {
    const [y, m] = checkIn.split('-').map(Number);
    return new Date(y || new Date().getFullYear(), (m || 1) - 1, 1);
  }, [checkIn]);

  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(MONDAY_ANCHOR);
        d.setDate(d.getDate() + i);
        return d.toLocaleDateString(i18n.language, { weekday: 'narrow' });
      }),
    [i18n.language],
  );

  /** 整月网格:前面补齐到周一开头 */
  const cells = useMemo(() => {
    const first = new Date(cursor);
    const lead = (first.getDay() + 6) % 7;
    const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const list: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let i = 1; i <= total; i += 1) {
      list.push(new Date(cursor.getFullYear(), cursor.getMonth(), i));
    }
    return list;
  }, [cursor]);

  const today = toKey(new Date());
  const monthLabel = cursor.toLocaleDateString(i18n.language, { month: 'short', year: 'numeric' });

  return (
    <View style={[bookingShared.panel, styles.card]}>
      <View style={styles.head}>
        <Text style={styles.headTitle}>{t('hotels.booking.dates.selectedDates')}</Text>
        <Text style={styles.headMonth}>{monthLabel}</Text>
      </View>

      <View style={styles.grid}>
        {weekdays.map((w, i) => (
          <View key={`w${i}`} style={[styles.weekCell, { width: cellWidth }]}>
            <Text style={[styles.weekText, i >= 5 && styles.weekend]}>{w}</Text>
          </View>
        ))}

        {cells.map((date, i) => {
          if (!date) return <View key={`p${i}`} style={{ width: cellWidth }} />;
          const key = toKey(date);
          const past = key < today;
          const isStart = key === checkIn;
          const isEnd = key === checkOut;
          const inRange = !!checkOut && key > checkIn && key < checkOut;
          return (
            <Pressable
              key={key}
              style={[
                styles.dayCell,
                { width: cellWidth },
                inRange && styles.dayInRange,
                (isStart || isEnd) && styles.dayEdge,
                isStart && styles.dayStart,
                isEnd && styles.dayEnd,
                past && styles.dayPast,
              ]}
              disabled={past}
              onPress={() => onPickDate(key)}
            >
              <Text
                style={[
                  styles.dayText,
                  inRange && styles.dayTextRange,
                  (isStart || isEnd) && styles.dayTextEdge,
                  past && styles.dayTextPast,
                ]}
              >
                {date.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* 这张卡的内边距是 24(不是共用壳的 25),列宽按 CARD_PADDING 算,两处保持同一出处 */
  card: { padding: CARD_PADDING, gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headTitle: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 32, color: colors.heading },
  headMonth: { fontFamily: fonts.interMedium, fontSize: 20, lineHeight: 32, color: colors.heading },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  weekCell: { alignItems: 'center', paddingVertical: 8 },
  weekText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textAlign: 'center',
    color: colors.label,
  },
  weekend: { color: colors.hot },

  dayCell: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
  /* 区间中间是主色 20% 的方块(设计稿两端不出圆角,靠首尾格的单侧圆角收边) */
  dayInRange: { borderRadius: 0, backgroundColor: 'rgba(66, 104, 244, 0.2)' },
  dayEdge: { backgroundColor: colors.primary },
  dayStart: { borderTopLeftRadius: 12, borderBottomLeftRadius: 12, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  dayEnd: { borderTopRightRadius: 12, borderBottomRightRadius: 12, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  dayPast: { opacity: 0.4 },
  dayText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, textAlign: 'center', color: colors.heading },
  dayTextRange: { fontFamily: fonts.interSemi, color: colors.primary },
  dayTextEdge: { fontFamily: fonts.interSemi, color: '#FFFFFF' },
  dayTextPast: { color: colors.textSoft },
});
