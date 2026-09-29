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
 *
 * `max` = 所选日期内该房型最多可订间数(详情接口 `available`)。到上限时「+」置灰,
 * 再点只提示「仅剩 N 间」、不回调 —— 两处共用这一份,上限不会一处有一处没有(QA CA_TC_067/070)。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';

interface Props {
  quantity: number;
  /** 最多可订间数;不传则不设上限(没有日期或演示房型) */
  max?: number;
  onIncrease: () => void;
  /** 点「−」,含 quantity 为 1 的那一下(是移出还是弹确认,由调用方决定) */
  onDecrease: () => void;
}

export default function RoomStepper({ quantity, max, onIncrease, onDecrease }: Props) {
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const atMax = max !== undefined && quantity >= max;
  const increase = () => {
    if (atMax) showToast(t('hotels.detail.rooms.left', { rooms: max }));
    else onIncrease();
  };
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
        style={({ pressed }) => [styles.stepBtn, atMax && styles.stepBtnDisabled, pressed && styles.pressed]}
        onPress={increase}
        hitSlop={4}
      >
        <Text style={styles.stepSign}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  stepBtnDisabled: { opacity: 0.4 },

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
