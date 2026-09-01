/**
 * 年 / 月 / 日 三列滚轮浮层(设计稿 1675:7673「Date of birth Overlay」)
 *
 * 设计稿画的是「出生日期」,但结构是通用的日期选择;常旅客的**证件到期日**复用同一个浮层,
 * 故标题与年份区间都做成 props(到期日要选未来年份,出生日期要选过去年份)。
 *
 * 设计稿实测:白卡、1px `rgba(196,197,215,0.3)`、**只有上两角圆角 32**、padding 25、gap 16;
 *   标题行 「Date Of Birth」Inter 700/16 + 右侧 12 的关闭叉(`--text-2`)
 *   三列(年 100 宽 / 月、日各占一份)每列 py8 gap10,行文 Inter 600/12 居中,
 *     选中行 `--text`,上下两行 `--text-2`,行间一条 1px 分隔线
 *   底部一条分隔线 + 主色 Confirm(圆角 8、px16 py8、Inter 600/14 白)
 *
 * 设计稿把它画成贴底的浮层(上圆角、无下圆角),这里照此从底部升起。
 * 三列滚轮 RN 没有原生控件,用三个 `ScrollView` + `snapToInterval` 自绘:
 * 上下各垫一行占位,让选中项永远停在中间那一行,与设计稿的三行结构一致。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { BORDER_SOFT_STRONG, bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 一行的高度(设计稿行文 12/normal + gap 10,取整到 34 便于 snap) */
const ROW_HEIGHT = 34;
/** 设计稿分隔线色(与列内 Line 11/12 的实际描边一致) */
const LINE = 'rgba(85, 85, 85, 0.1)';

interface Props {
  visible: boolean;
  /** 浮层标题 */
  title: string;
  /** `YYYY-MM-DD`,为空时停在 `fallbackYear`-01-01 */
  value?: string | null;
  /** 年份区间(含),默认取当年往后 20 年 —— 证件到期日的口径 */
  minYear?: number;
  maxYear?: number;
  /** 确认按钮文案 */
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}

const THIS_YEAR = new Date().getFullYear();

interface ColumnProps {
  items: string[];
  index: number;
  onChange: (index: number) => void;
  width?: number;
}

function WheelColumn({ items, index, onChange, width }: ColumnProps) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    /* 挂载时把选中项滚到中间;之后由手势/滚轮驱动,不再强行回滚(靠外层换 key 重挂载来重置) */
    const timer = setTimeout(() => ref.current?.scrollTo({ y: index * ROW_HEIGHT, animated: false }), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 选中项**必须由 onScroll 实时推导**,不能只依赖 onMomentumScrollEnd / onScrollEndDrag ——
   * react-native-web 下用滚轮/触控板滚动时那两个事件不会触发,导致索引永远停在初始值,
   * 表现就是「滚得动但选不动,确认后拿到的还是原来那天」。
   * 末尾两个事件保留:原生端惯性停下后再校准一次。
   */
  const sync = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.min(
      Math.max(Math.round(e.nativeEvent.contentOffset.y / ROW_HEIGHT), 0),
      items.length - 1,
    );
    if (next !== index) onChange(next);
  };

  return (
    <View style={[styles.column, width ? { width } : styles.columnFlex]}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={sync}
        onMomentumScrollEnd={sync}
        onScrollEndDrag={sync}
        contentContainerStyle={styles.columnContent}
      >
        {items.map((item, i) => (
          <View key={item} style={styles.cell}>
            <Text style={[styles.cellText, i === index && styles.cellTextActive]} numberOfLines={1}>
              {item}
            </Text>
          </View>
        ))}
      </ScrollView>
      {/* 中间一行的上下两条线(设计稿 Line 11/12),不随滚动 */}
      <View pointerEvents="none" style={[styles.line, { top: ROW_HEIGHT }]} />
      <View pointerEvents="none" style={[styles.line, { top: ROW_HEIGHT * 2 }]} />
    </View>
  );
}

export default function WheelPickerSheet({
  visible,
  title,
  value,
  minYear = THIS_YEAR,
  maxYear = THIS_YEAR + 20,
  confirmLabel,
  onClose,
  onConfirm,
}: Props) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  /**
   * 年份区间要**兜住当前值** —— 已存的到期日可能早于 minYear(比如证件已过期),
   * 区间不含它的话 `indexOf` 返回 -1、被夹到第 0 项,一打开就把日期悄悄改掉了。
   */
  const valueYear = value ? Number(value.split('-')[0]) : 0;
  const years = useMemo(() => {
    const from = valueYear ? Math.min(minYear, valueYear) : minYear;
    const to = valueYear ? Math.max(maxYear, valueYear) : maxYear;
    return Array.from({ length: Math.max(to - from + 1, 1) }, (_, i) => `${from + i}`);
  }, [minYear, maxYear, valueYear]);
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Date(2024, i, 1).toLocaleDateString(i18n.language, { month: 'long' }),
      ),
    [i18n.language],
  );

  const initial = value ? value.split('-').map(Number) : [minYear, 1, 1];
  const [yearIdx, setYearIdx] = useState(Math.max(years.indexOf(`${initial[0]}`), 0));
  const [monthIdx, setMonthIdx] = useState((initial[1] || 1) - 1);
  const [dayIdx, setDayIdx] = useState((initial[2] || 1) - 1);

  /**
   * 每次打开都按当前 `value` 重置三列。
   * 上面那三个 useState 的初值**只在组件第一次渲染时算一次** —— 而本组件在关闭时只是 `return null`、
   * 实例并不卸载(挂载态由 `mounted` 自持,为的是放完关闭动画),所以第一次渲染时 `value` 往往还是空的。
   * 不重置的话,带着已有到期日再打开,列位置还停在旧值上。
   * `session` 用作三列的 key:换 key 让 WheelColumn 重挂载,它的挂载副作用才会滚到新位置。
   */
  const [session, setSession] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const [y, m, d] = value ? value.split('-').map(Number) : [minYear, 1, 1];
    setYearIdx(Math.max(years.indexOf(`${y}`), 0));
    setMonthIdx(Math.min(Math.max((m || 1) - 1, 0), 11));
    setDayIdx(Math.max((d || 1) - 1, 0));
    setSession((s) => s + 1);
  }, [visible, value, minYear, years]);

  const year = Number(years[yearIdx] ?? maxYear);
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`),
    [daysInMonth],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [anim, visible]);

  if (!mounted) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [280, 0] });

  const confirm = () => {
    const m = `${monthIdx + 1}`.padStart(2, '0');
    const d = `${Math.min(dayIdx + 1, daysInMonth)}`.padStart(2, '0');
    onConfirm(`${year}-${m}-${d}`);
    onClose();
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <View style={styles.bottom} pointerEvents="box-none">
        <Animated.View
          style={[styles.card, { paddingBottom: 25 + insets.bottom, transform: [{ translateY }] }]}
        >
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <HomeIcon name="close" size={12} color={colors.textSoft} />
            </Pressable>
          </View>

          {/* key 带 session:每次打开都让三列重挂载,挂载副作用才会滚到 value 对应的位置 */}
          <View style={styles.wheels}>
            <WheelColumn
              key={`y${session}`}
              items={years}
              index={yearIdx}
              onChange={setYearIdx}
              width={100}
            />
            <WheelColumn
              key={`m${session}`}
              items={months}
              index={monthIdx}
              onChange={setMonthIdx}
            />
            <WheelColumn
              key={`d${session}`}
              items={days}
              index={Math.min(dayIdx, days.length - 1)}
              onChange={setDayIdx}
            />
          </View>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [bookingShared.primaryBtn, pressed && bookingShared.pressed]}
            onPress={confirm}
          >
            <Text style={bookingShared.primaryBtnText}>{confirmLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.25)' },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  card: {
    gap: 16,
    padding: 25,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    borderColor: BORDER_SOFT_STRONG,
    backgroundColor: colors.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: colors.heading },

  wheels: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  column: { height: ROW_HEIGHT * 3 },
  columnFlex: { flex: 1, minWidth: 0 },
  /* 上下各垫一行,选中项才会停在中间 */
  columnContent: { paddingVertical: ROW_HEIGHT },
  cell: { height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  cellText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    textAlign: 'center',
    color: colors.textSoft,
  },
  cellTextActive: { color: colors.heading },
  line: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: LINE },

  divider: { height: 1, backgroundColor: LINE },
});
