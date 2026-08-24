/**
 * 日期选择器(Figma M-Trip / Choose Date 695:1428)—— 覆盖在酒店页上的居中卡片
 *
 * 结构:标题 → 入住/离店两张卡(中间悬一枚箭头徽章)→ 总晚数 → 分隔线
 *      → 月份切换 → 分隔线 → 七列日历 → 节假日说明 → 分隔线 → 弹性日期档 → Confirm。
 *
 * 设计稿实测:
 *   卡片     白底,1px rgba(196,197,215,0.3) 描边,圆角 32,padding 25,gap 16,投影 shadows.subtle
 *   日期卡   --tab-2 #EFF4FF 底,圆角 16,高 60,padding 12,gap 12;图标 18x20
 *   箭头徽章 --tab 底,padding 4,圆角 40,内含 16px arrow-left 旋转 180°(设计稿即如此拼)
 *   总晚数   --background 底,圆角 16,padding 12,左右分列 Inter 600/12,行高 24
 *   分隔线   1px #555555 @10%(导出资产 Line 11 的 stroke)
 *   月份行   px40/py8,两侧 15x12 细箭头(caretLeftSlim,右侧旋转 180°),中间 Inter 600/12
 *   日历     7 列 gap 8;表头 py8,Inter 600/12 行高 16 字距 0.6,周一~周五 #747686、周六日 --tertiary
 *            日期格 py12,Inter 400/16 行高 24;区间首尾主色白字(外侧圆角 12)、
 *            区间中间主色 20% 底,其余圆角 8;过去/非本月 50% 灰 + 40% 透明
 *   档位条   圆角 8、padding 4、Inter 400/12 行高 24;选中主色描边+主色字,未选中 --secondary 描边
 *   CTA      主色、圆角 8、px16/py8、Inter 600/14 白字
 *
 * 与设计稿的取舍:
 *   - 设计稿把日历画成了「Mini Calendar Mockup」(只有 9 号往后的四周),这里按真实月份铺满整月,
 *     今天之前的日期沿用设计稿里 9~11 号那一档的置灰样式并禁点。
 *   - 首尾日期格下方 4px 白点(696:1643)落在白色卡片上不可见,未实现。
 *   - 节假日(设计稿「Oct 19 National Day」)后端暂无接口,先按下面的静态表按月日命中。
 *   - 弹性日期档只回传天数;goods 列表接口没有日期参数,调用方目前只用于展示。
 *   - 设计稿的 ±3Day/±7Day 少了复数,这里统一按 1 天/多天两个文案键。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

export interface DateRangeValue {
  /** 入住日,YYYY-MM-DD */
  checkIn: string;
  /** 离店日,YYYY-MM-DD;只点了入住日时为空串 */
  checkOut: string;
  /** 弹性天数,0 = Exact Dates */
  flexDays: number;
}

/** 设计稿的弹性日期档 */
const FLEX_DAYS = [0, 1, 2, 3, 7] as const;

/** 节假日(键为 MM-DD,值为 i18n 键)。后端暂无节假日接口,先按设计稿静态值 */
const HOLIDAYS: Record<string, string> = {
  '10-19': 'nationalDay',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** 卡片尺寸常量:日历列宽要按这几个值算出来,故抽成单一出处 */
const CARD_MARGIN = 16;
const CARD_PADDING = 25;
const CARD_BORDER = 1;
const GRID_GAP = 8;

/** 2024-01-01 是周一,用来生成「周一起」的星期表头 */
const MONDAY_ANCHOR = new Date(2024, 0, 1);

export function dateKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** 两个日期键之间的晚数;跨夏令时会差几小时,故取整 */
export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  return Math.round((parseKey(checkOut).getTime() - parseKey(checkIn).getTime()) / DAY_MS);
}

/** 默认区间:今天 → nights 天后(设计稿示例是两晚) */
export function defaultDateRange(nights = 2): DateRangeValue {
  const today = new Date();
  return { checkIn: dateKey(today), checkOut: dateKey(addDays(today, nights)), flexDays: 0 };
}

interface Props {
  visible: boolean;
  value: DateRangeValue;
  onClose: () => void;
  onConfirm: (value: DateRangeValue) => void;
}

export default function DatePickerSheet({ visible, value, onClose, onConfirm }: Props) {
  const { t, i18n } = useTranslation();
  const { width: winW, height: winH } = useWindowDimensions();

  /**
   * 七列等宽:RN 的 flexWrap + gap 不会像 CSS grid 那样自动扣掉列间距,
   * 百分比宽度会因为 6 道 8px 间距而挤到第二行,所以这里直接算出列宽的像素值
   */
  const cellWidth = Math.floor(
    ((winW - CARD_MARGIN * 2 - (CARD_PADDING + CARD_BORDER) * 2 - GRID_GAP * 6) / 7) * 100,
  ) / 100;

  /* 关闭动画要放完才能卸载 Modal,故内部自己维持一份挂载态(同筛选面板) */
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  /* 面板内是草稿:改动到点 Confirm 才回传,点遮罩关闭则丢弃 */
  const [draft, setDraft] = useState<DateRangeValue>(value);
  /** 当前展示的月份(取该月 1 号) */
  const [cursor, setCursor] = useState<Date>(() => monthOf(value.checkIn));

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setCursor(monthOf(value.checkIn));
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // value 只在打开的那一刻取一次,编辑草稿时不该被父级回灌
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const translateY = useMemo(
    () => anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
    [anim],
  );

  /** 今天(零点),用于判断过去的日期 */
  const todayKey = dateKey(new Date());

  /* 表头字母跟随语言:en-US 得到 M T W T F S S,zh-CN 得到 一 二 三… */
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        addDays(MONDAY_ANCHOR, i).toLocaleDateString(i18n.language, { weekday: 'narrow' }),
      ),
    [i18n.language],
  );

  /** 整月网格:补齐月初的前置日与月末的后置日,凑成整周 */
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const total = Math.ceil((lead + daysInMonth) / 7) * 7;
    const start = addDays(first, -lead);
    return Array.from({ length: total }, (_, i) => addDays(start, i));
  }, [cursor]);

  /** 本月命中的节假日,渲染成设计稿的「Oct 19 National Day」 */
  const holidays = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const list: { key: string; label: string }[] = [];
    for (let d = 1; d <= days; d += 1) {
      const date = new Date(y, m, d);
      const name = HOLIDAYS[dateKey(date).slice(5)];
      if (!name) continue;
      const md = date.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
      list.push({ key: dateKey(date), label: `${md} ${t(`hotels.datePicker.holidays.${name}`)}` });
    }
    return list;
    // t 随语言变化,列表依赖的其实是 i18n.language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, i18n.language]);

  /** 不能翻到当月之前 */
  const atCurrentMonth =
    cursor.getFullYear() === new Date().getFullYear() && cursor.getMonth() === new Date().getMonth();

  const shiftMonth = (step: number) => {
    if (step < 0 && atCurrentMonth) return;
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + step, 1));
  };

  /** 先点入住、再点离店;已选满或点到入住日之前,则重新起头 */
  const pick = (key: string) =>
    setDraft((d) => {
      if (!d.checkIn || d.checkOut || key <= d.checkIn) {
        return { ...d, checkIn: key, checkOut: '' };
      }
      return { ...d, checkOut: key };
    });

  const nights = nightsBetween(draft.checkIn, draft.checkOut);
  const canConfirm = Boolean(draft.checkIn && draft.checkOut);

  const formatField = (key: string) =>
    key
      ? parseKey(key).toLocaleDateString(i18n.language, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : '--';

  const renderCell = (date: Date) => {
    const key = dateKey(date);
    const outside = date.getMonth() !== cursor.getMonth();
    const past = key < todayKey;
    const disabled = past;
    const isStart = key === draft.checkIn;
    const isEnd = key === draft.checkOut;
    const inRange = Boolean(
      draft.checkOut && key > draft.checkIn && key < draft.checkOut,
    );
    const isHoliday = Boolean(HOLIDAYS[key.slice(5)]);

    return (
      <Pressable
        key={key}
        style={({ pressed }) => [
          styles.cell,
          { width: cellWidth },
          inRange && styles.cellInRange,
          (isStart || isEnd) && styles.cellEdge,
          /* 首尾各自只圆外侧;只选了入住日时四角都圆 */
          isStart && (draft.checkOut ? styles.cellStart : styles.cellSingle),
          isEnd && styles.cellEnd,
          disabled && styles.cellDisabled,
          pressed && !disabled && styles.pressed,
        ]}
        onPress={() => pick(key)}
        disabled={disabled}
      >
        <Text
          style={[
            styles.cellText,
            (outside || past) && styles.cellTextMuted,
            isHoliday && !(isStart || isEnd) && styles.cellTextHoliday,
            (isStart || isEnd) && styles.cellTextEdge,
          ]}
        >
          {date.getDate()}
        </Text>
      </Pressable>
    );
  };

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        {/* 设计稿没有遮罩(背后大图保持原亮度),这里只留一层透明的点击区用于关闭 */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          style={[
            styles.card,
            { maxHeight: winH * 0.88, opacity: anim, transform: [{ translateY }] },
          ]}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Text style={styles.title}>{t('hotels.datePicker.title')}</Text>

            {/* 01 入住 / 离店 */}
            <View style={styles.rangeRow}>
              {(['checkIn', 'checkOut'] as const).map((field) => (
                <View key={field} style={styles.rangeField}>
                  <HomeIcon name="calendar" size={20} color={colors.primary} />
                  <View style={styles.rangeCol}>
                    <Text style={styles.fieldLabel}>
                      {t(field === 'checkIn' ? 'hotels.checkIn' : 'hotels.checkOut')}
                    </Text>
                    <Text style={styles.fieldValue}>{formatField(draft[field])}</Text>
                  </View>
                </View>
              ))}
              {/* 悬在两张卡中间的箭头徽章 */}
              <View style={styles.arrowBadgeWrap} pointerEvents="none">
                <View style={styles.arrowBadge}>
                  <View style={styles.flip}>
                    <HomeIcon name="arrowLeft" size={16} color={colors.heading} />
                  </View>
                </View>
              </View>
            </View>

            {/* 02 总晚数 */}
            <View style={styles.durationRow}>
              <Text style={styles.durationLabel}>{t('hotels.datePicker.totalDuration')}</Text>
              <Text style={styles.durationValue}>{t('hotels.nights', { nights })}</Text>
            </View>

            {/* 03 日历 */}
            <View style={styles.calendar}>
              <View style={styles.divider} />

              <View style={styles.monthRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.monthNav,
                    atCurrentMonth && styles.monthNavDisabled,
                    pressed && !atCurrentMonth && styles.pressed,
                  ]}
                  onPress={() => shiftMonth(-1)}
                  disabled={atCurrentMonth}
                  hitSlop={12}
                >
                  <HomeIcon name="caretLeftSlim" size={12} color={colors.heading} />
                </Pressable>
                <Text style={styles.monthLabel}>
                  {cursor.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.monthNav, styles.flip, pressed && styles.pressed]}
                  onPress={() => shiftMonth(1)}
                  hitSlop={12}
                >
                  <HomeIcon name="caretLeftSlim" size={12} color={colors.heading} />
                </Pressable>
              </View>

              <View style={styles.divider} />

              <View style={styles.grid}>
                {weekdays.map((w, i) => (
                  <View key={`w${i}`} style={[styles.weekCell, { width: cellWidth }]}>
                    <Text style={[styles.weekText, i >= 5 && styles.weekTextEnd]}>{w}</Text>
                  </View>
                ))}
                {cells.map(renderCell)}
              </View>
            </View>

            {/* 04 节假日说明 */}
            {holidays.map((h) => (
              <View key={h.key} style={styles.holidayRow}>
                <View style={styles.holidayDot} />
                <Text style={styles.holidayText}>{h.label}</Text>
              </View>
            ))}

            <View style={styles.divider} />

            {/* 05 弹性日期档 */}
            <View style={styles.flexRow}>
              {FLEX_DAYS.map((days) => {
                const active = draft.flexDays === days;
                return (
                  <Pressable
                    key={days}
                    style={({ pressed }) => [
                      styles.flexChip,
                      days > 0 && styles.flexChipGrow,
                      active && styles.flexChipActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setDraft((d) => ({ ...d, flexDays: days }))}
                  >
                    <Text style={[styles.flexChipText, active && styles.flexChipTextActive]}>
                      {days === 0
                        ? t('hotels.datePicker.exactDates')
                        : t(days === 1 ? 'hotels.datePicker.flexDay' : 'hotels.datePicker.flexDays', {
                            days,
                          })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 06 确认 */}
            <Pressable
              style={({ pressed }) => [
                styles.cta,
                !canConfirm && styles.ctaDisabled,
                pressed && canConfirm && styles.pressed,
              ]}
              onPress={() => onConfirm(draft)}
              disabled={!canConfirm}
            >
              <Text style={styles.ctaText}>{t('hotels.datePicker.confirm')}</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** 取某个日期键所在月的 1 号;空值退回本月 */
function monthOf(key: string): Date {
  const d = key ? parseKey(key) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },

  card: {
    marginHorizontal: CARD_MARGIN,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    borderWidth: CARD_BORDER,
    /* 设计稿 rgba(196,197,215,0.3),即分隔线色 --divider 叠 30% */
    borderColor: 'rgba(196, 197, 215, 0.3)',
    ...shadows.subtle,
  },
  /* RN 的 flexShrink 默认 0:不显式给 1,内容撑高后会顶穿卡片的 maxHeight */
  scroll: { flexShrink: 1 },
  body: { padding: CARD_PADDING, gap: 16 },

  /* 设计稿标题左对齐(Button 节点里只有一个子元素) */
  title: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    /* 设计稿 #0B1C30,比卡片标题色略亮 */
    color: '#0B1C30',
  },

  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rangeField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 60,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.tintBg,
  },
  rangeCol: { flexShrink: 1 },
  fieldLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSoft,
  },
  fieldValue: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  arrowBadgeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 18,
    alignItems: 'center',
  },
  arrowBadge: {
    padding: 4,
    borderRadius: 40,
    backgroundColor: colors.surface,
  },
  /** 设计稿用 arrow-left 旋转 180° 当右箭头,月份的「下一月」同理 */
  flip: { transform: [{ rotate: '180deg' }] },

  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.pageBg,
  },
  durationLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 24,
    color: colors.textSoft,
  },
  durationValue: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 24,
    color: colors.heading,
  },

  calendar: { gap: 8 },
  /** 导出资产 Line 11:1px #555555 @10% */
  divider: { height: 1, backgroundColor: 'rgba(85, 85, 85, 0.1)' },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingVertical: 8,
  },
  monthNav: { padding: 2 },
  monthNavDisabled: { opacity: 0.3 },
  monthLabel: {
    flex: 1,
    fontFamily: fonts.interSemi,
    fontSize: 12,
    color: colors.heading,
    textAlign: 'center',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  weekCell: { alignItems: 'center', paddingVertical: 8 },
  weekText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    /* 设计稿 #747686,介于正文与次要文字之间 */
    color: '#747686',
    textAlign: 'center',
  },
  weekTextEnd: { color: colors.hot },

  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  /* 设计稿 rgba(66,104,244,0.2),即主色 20% */
  cellInRange: { backgroundColor: 'rgba(65, 105, 237, 0.2)', borderRadius: 0 },
  cellEdge: { backgroundColor: colors.primary, borderRadius: 0 },
  cellStart: { borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  cellEnd: { borderTopRightRadius: 12, borderBottomRightRadius: 12 },
  cellSingle: { borderRadius: 12 },
  cellDisabled: { opacity: 0.4 },
  cellText: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
    textAlign: 'center',
  },
  cellTextMuted: { color: colors.textSoft },
  cellTextHoliday: { color: colors.hot },
  cellTextEdge: { color: '#FFFFFF' },

  holidayRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  holidayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.heading },
  holidayText: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 24,
    color: colors.heading,
  },

  flexRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  flexChip: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.softBlue,
  },
  /* 设计稿里 Exact Dates 按内容宽,其余四档均分剩余宽度 */
  flexChipGrow: { flex: 1 },
  flexChipActive: { borderColor: colors.primary },
  flexChipText: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 24,
    color: colors.textSoft,
    textAlign: 'center',
  },
  flexChipTextActive: { color: colors.primary },

  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  pressed: { opacity: 0.85 },
});
