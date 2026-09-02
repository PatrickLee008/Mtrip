/**
 * 「Who's Coming?」的加减行(设计稿 1675:6180 Adults / 1675:6196 Children)
 *
 * 设计稿实测:行 padding 24、两端对齐;左侧标题 Inter 600/18 + 副行 Inter 500/14 tracking .14 `#747686`;
 * 右侧 gap 24 的三件套 —— 40 圆的减号(1px 主色描边;不可减时描边转 `rgba(116,118,134,0.3)` + 50% 透明)、
 * 宽 16 居中的数字 Inter 600/24、40 圆的加号(**Adults 那行是主色实心白加号,Children 那行是主色描边**,
 * 设计稿即如此,不统一)。第二行上方一条 1px `rgba(211,228,254,0.3)` 分隔线。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import HomeIcon from '@/components/home/HomeIcon';
import { ROW_DIVIDER, bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  title: string;
  hint: string;
  value: number;
  min?: number;
  max?: number;
  /** 加号是否实心(设计稿只有 Adults 行是实心) */
  solidPlus?: boolean;
  /** 是否画顶部分隔线(设计稿第二行才有) */
  divider?: boolean;
  onChange: (value: number) => void;
}

export default function GuestCounterRow({
  title,
  hint,
  value,
  min = 0,
  max = 30,
  solidPlus = false,
  divider = false,
  onChange,
}: Props) {
  const canMinus = value > min;
  const canPlus = value < max;

  return (
    <View style={[styles.row, divider && styles.divider]}>
      <View style={styles.flex}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [
            styles.circle,
            styles.circleOutline,
            !canMinus && styles.circleDisabled,
            pressed && canMinus && bookingShared.pressed,
          ]}
          disabled={!canMinus}
          onPress={() => onChange(value - 1)}
          hitSlop={4}
        >
          <HomeIcon
            name="minus"
            width={14}
            height={2}
            color={canMinus ? colors.primary : colors.label}
          />
        </Pressable>

        <View style={styles.valueBox}>
          <Text style={styles.value}>{value}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.circle,
            solidPlus ? styles.circleSolid : styles.circleOutline,
            !canPlus && styles.circleDisabled,
            pressed && canPlus && bookingShared.pressed,
          ]}
          disabled={!canPlus}
          onPress={() => onChange(value + 1)}
          hitSlop={4}
        >
          <HomeIcon name="plus" size={14} color={solidPlus ? '#FFFFFF' : colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 24,
  },
  divider: { borderTopWidth: 1, borderTopColor: ROW_DIVIDER },
  flex: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.interSemi, fontSize: 18, lineHeight: 28, color: colors.heading },
  hint: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.label,
  },

  controls: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  circle: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  circleOutline: { borderWidth: 1, borderColor: colors.primary },
  circleSolid: { backgroundColor: colors.primary },
  circleDisabled: { opacity: 0.5, borderColor: 'rgba(116, 118, 134, 0.3)' },

  valueBox: { width: 16, alignItems: 'center' },
  value: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
    color: colors.heading,
  },
});
