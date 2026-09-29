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
 *   - 设计稿月份只是一行文字;这里在两侧加翻月箭头(同 `DatePickerSheet` 的 caretLeftSlim),
 *     否则只能在入住月内选日期,跨月入住/离店无从下手。不能翻到当月之前。
 *   - 首尾格下方那枚 4px 白点(1675:6172)落在白卡上不可见,未实现(同日期选择器的处理)。
 *   - 7 列等宽用像素算,不用百分比 —— RN 的 flexWrap + gap 不会自动扣列间距,会挤到第二行。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
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
  /**
   * 关怀模式:整块放大一档(标题 20→24、日期 16→22、格高 12→16)。
   * 排布与选区逻辑两种模式完全一样,所以这里只叠尺寸,不复制一份日历。
   */
  lite?: boolean;
}

export default function BookingCalendar({ checkIn, checkOut, onPickDate, lite = false }: Props) {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();

  const cellWidth =
    Math.floor(
      ((width - PAGE_PADDING * 2 - (CARD_PADDING + CARD_BORDER) * 2 - GRID_GAP * 6) / 7) * 100,
    ) / 100;

  /** 当前展示的月份(1 号);入住日变了就跟到入住月 */
  const [cursor, setCursor] = useState(() => monthOf(checkIn));
  useEffect(() => {
    setCursor(monthOf(checkIn));
  }, [checkIn]);

  const now = new Date();
  const atCurrentMonth =
    cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth();
  const shiftMonth = (step: number) => {
    if (step < 0 && atCurrentMonth) return;
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + step, 1));
  };

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
        <Text style={[styles.headTitle, lite && styles.headTitleLite]}>
          {t('hotels.booking.dates.selectedDates')}
        </Text>
        <View style={styles.monthNav}>
          <Pressable
            style={({ pressed }) => [styles.monthBtn, atCurrentMonth && styles.monthBtnDisabled, pressed && styles.pressed]}
            onPress={() => shiftMonth(-1)}
            disabled={atCurrentMonth}
            hitSlop={12}
          >
            <HomeIcon name="caretLeftSlim" size={lite ? 16 : 12} color={colors.heading} />
          </Pressable>
          <Text style={[styles.headMonth, lite && styles.headMonthLite]}>{monthLabel}</Text>
          <Pressable
            style={({ pressed }) => [styles.monthBtn, styles.flip, pressed && styles.pressed]}
            onPress={() => shiftMonth(1)}
            hitSlop={12}
          >
            <HomeIcon name="caretLeftSlim" size={lite ? 16 : 12} color={colors.heading} />
          </Pressable>
        </View>
      </View>

      <View style={styles.grid}>
        {weekdays.map((w, i) => (
          <View key={`w${i}`} style={[styles.weekCell, { width: cellWidth }]}>
            <Text style={[styles.weekText, lite && styles.weekTextLite, i >= 5 && styles.weekend]}>
              {w}
            </Text>
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
                lite && styles.dayCellLite,
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
                  lite && styles.dayTextLite,
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
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  monthBtn: { padding: 4 },
  monthBtnDisabled: { opacity: 0.3 },
  /** caretLeftSlim 旋转 180° 当右箭头 */
  flip: { transform: [{ rotate: '180deg' }] },
  pressed: { opacity: 0.85 },

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

  /* ---- 关怀模式:只叠尺寸,颜色与选区样式与完整模式共用上面那几条 ---- */
  headTitleLite: { fontSize: 24, lineHeight: 32 },
  headMonthLite: { fontSize: 24, lineHeight: 32 },
  weekTextLite: { fontSize: 16, lineHeight: 20, letterSpacing: 1.2 },
  dayCellLite: { paddingVertical: 16 },
  dayTextLite: { fontSize: 22, lineHeight: 28 },
});

/** 日期键所在月的 1 号;空值退回本月 */
function monthOf(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  return y && m ? new Date(y, m - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
}
