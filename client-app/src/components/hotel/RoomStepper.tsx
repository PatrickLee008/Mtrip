/**
 * 房型加减器(Figma M-Trip / Room Cart `2659:12366`)
 *
 * 购物车页与酒店详情 Rooms 页签的房型卡**共用这一份** —— 两处原本各画一遍,
 * 改一处忘另一处就会出现「同一个控件两种样子」。
 *
 * 设计稿实测:
 *   外框    `--secondary` 底、圆角 12
 *   ±键     36 方、`--tab` 底 + 1px `--secondary` 描边、圆角 12、Inter 700/16(行高 20)
 *   数值格  宽 36(最小 28),px12 py8,同字号
 *
 * 减到 0 的处理**交给调用方**:房型卡是直接移出(变回 Choose),
 * 购物车页要先弹确认框(设计稿 Alert Overlay `2659:12483`),两者不能写死在这里。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  quantity: number;
  onIncrease: () => void;
  /** 点「−」,含 quantity 为 1 的那一下(是移出还是弹确认,由调用方决定) */
  onDecrease: () => void;
}

export default function RoomStepper({ quantity, onIncrease, onDecrease }: Props) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
        onPress={onDecrease}
        hitSlop={4}
      >
        <Text style={styles.stepSign}>-</Text>
      </Pressable>
      <View style={styles.stepValueBox}>
        <Text style={styles.stepValue}>{quantity}</Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
        onPress={onIncrease}
        hitSlop={4}
      >
        <Text style={styles.stepSign}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.btn,
    backgroundColor: colors.softBlue,
  },
  stepBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },
  stepValueBox: {
    width: 36,
    minWidth: 28,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stepSign: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.heading,
  },
  stepValue: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.heading,
  },
});
