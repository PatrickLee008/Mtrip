/**
 * 出生日期滚轮浮层(设计稿 1675:7673「Date of birth Overlay」)
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
import { DOB_YEAR_MAX, DOB_YEAR_MIN } from '@/screens/hotel/bookingDemo';

/** 一行的高度(设计稿行文 12/normal + gap 10,取整到 34 便于 snap) */
const ROW_HEIGHT = 34;
/** 设计稿分隔线色(与列内 Line 11/12 的实际描边一致) */
const LINE = 'rgba(85, 85, 85, 0.1)';

interface Props {
  visible: boolean;
  /** `YYYY-MM-DD`,为空时默认停在 1995-01-01 */
  value?: string | null;
  onClose: () => void;
  onConfirm: (value: string) => void;
}

interface ColumnProps {
  items: string[];
  index: number;
  onChange: (index: number) => void;
  width?: number;
}

function WheelColumn({ items, index, onChange, width }: ColumnProps) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    /* 首次挂载把选中项滚到中间;后续由手势驱动,不再强行回滚 */
    const timer = setTimeout(() => ref.current?.scrollTo({ y: index * ROW_HEIGHT, animated: false }), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.y / ROW_HEIGHT);
    onChange(Math.min(Math.max(next, 0), items.length - 1));
  };

  return (
    <View style={[styles.column, width ? { width } : styles.columnFlex]}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleEnd}
        onScrollEndDrag={handleEnd}
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

export default function WheelPickerSheet({ visible, value, onClose, onConfirm }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  const years = useMemo(
    () => Array.from({ length: DOB_YEAR_MAX - DOB_YEAR_MIN + 1 }, (_, i) => `${DOB_YEAR_MIN + i}`),
    [],
  );
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Date(2024, i, 1).toLocaleDateString(i18n.language, { month: 'long' }),
      ),
    [i18n.language],
  );

  const initial = value ? value.split('-').map(Number) : [1995, 1, 1];
  const [yearIdx, setYearIdx] = useState(Math.max(years.indexOf(`${initial[0]}`), 0));
  const [monthIdx, setMonthIdx] = useState((initial[1] || 1) - 1);
  const [dayIdx, setDayIdx] = useState((initial[2] || 1) - 1);

  const year = Number(years[yearIdx] ?? DOB_YEAR_MAX);
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
            <Text style={styles.title}>{t('hotels.booking.addGuest.dobTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <HomeIcon name="close" size={12} color={colors.textSoft} />
            </Pressable>
          </View>

          <View style={styles.wheels}>
            <WheelColumn items={years} index={yearIdx} onChange={setYearIdx} width={100} />
            <WheelColumn items={months} index={monthIdx} onChange={setMonthIdx} />
            <WheelColumn
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
            <Text style={bookingShared.primaryBtnText}>
              {t('hotels.booking.addGuest.confirm')}
            </Text>
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
