/**
 * 价格区间滑块(Figma M-Trip / Filter overlay 864:1746)
 *
 * 设计稿实测(容器宽 354 = 402 - 面板左右各 24):
 *   直方图  21 根柱子,宽 8、space-between 排布,最高 104;顶部圆角(8 宽下等效 4)
 *           柱色:落在选中区间内 --text #1B1D30,区间外 --text-2 50% 透明
 *   轨道    高 20 的容器:底轨 h8 / top6 / 圆角、选中段同高深色、两个 20x20 圆滑块
 *   设计稿两个滑块的 left 是 43 / 184(即中心 53 / 194,选中段宽 141)
 *
 * 柱子高度是设计稿的静态曲线(后端没有价格分布接口),但**染色是实时算的**:
 * 按柱子中心是否落在两个滑块中心之间上色,拖动时与设计稿同样的观感。
 *
 * 未引入 @react-native-community/slider 与 gesture-handler,双滑块用 RN 自带的
 * PanResponder 实现;手势回调里读 ref 而非闭包里的 props,避免拿到过期值。
 */

import React, { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';

import { colors } from '@/config/theme';

/** 设计稿 21 根柱子的高度 */
const BAR_HEIGHTS = [
  86, 104, 89, 64, 64, 55, 25, 25, 25, 20, 20, 15, 15, 15, 11, 11, 11, 11, 6, 6, 6,
];
const BAR_W = 8;
const HIST_H = 104;
const THUMB = 20;
const TRACK_H = 8;

export interface PriceRange {
  low: number;
  high: number;
}

interface Props {
  /** 区间下界 / 上界 / 步进(域值,单位由调用方决定) */
  min: number;
  max: number;
  step: number;
  value: PriceRange;
  onChange: (value: PriceRange) => void;
}

export default function PriceRangeSlider({ min, max, step, value, onChange }: Props) {
  const [width, setWidth] = useState(0);

  /* 手势回调只在挂载时创建一次,内部一律读 ref */
  const widthRef = useRef(0);
  const valueRef = useRef(value);
  const boundsRef = useRef({ min, max, step });
  const changeRef = useRef(onChange);
  const startRef = useRef(0);
  valueRef.current = value;
  boundsRef.current = { min, max, step };
  changeRef.current = onChange;

  const span = Math.max(max - min, 1);
  /** 滑块中心可走的像素跨度:左右各让出半个滑块 */
  const travel = Math.max(width - THUMB, 1);
  /** 域值 → 滑块左上角相对轨道左端的偏移 */
  const toLeft = (v: number) => ((v - min) / span) * travel;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const responders = useMemo(() => {
    const make = (key: 'low' | 'high') => {
      const offsetOf = (v: number) => {
        const b = boundsRef.current;
        const t = Math.max(widthRef.current - THUMB, 1);
        return ((v - b.min) / Math.max(b.max - b.min, 1)) * t;
      };
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startRef.current = offsetOf(valueRef.current[key]);
        },
        onPanResponderMove: (_e, gesture) => {
          const b = boundsRef.current;
          const t = Math.max(widthRef.current - THUMB, 1);
          const left = Math.min(Math.max(startRef.current + gesture.dx, 0), t);
          const raw = b.min + (left / t) * Math.max(b.max - b.min, 1);
          const snapped = Math.min(Math.max(Math.round(raw / b.step) * b.step, b.min), b.max);
          const cur = valueRef.current;
          /* 两个滑块不许交叉,越界时顶到对方身上 */
          const next =
            key === 'low'
              ? { low: Math.min(snapped, cur.high), high: cur.high }
              : { low: cur.low, high: Math.max(snapped, cur.low) };
          if (next.low !== cur.low || next.high !== cur.high) changeRef.current(next);
        },
      });
    };
    return { low: make('low'), high: make('high') };
  }, []);

  /* space-between 的实际间距,用来求每根柱子的中心横坐标 */
  const gap = width > 0 ? (width - BAR_HEIGHTS.length * BAR_W) / (BAR_HEIGHTS.length - 1) : 0;
  const lowCenter = toLeft(value.low) + THUMB / 2;
  const highCenter = toLeft(value.high) + THUMB / 2;

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={styles.hist}>
        {BAR_HEIGHTS.map((h, i) => {
          const center = i * (BAR_W + gap) + BAR_W / 2;
          const active = width > 0 && center >= lowCenter && center <= highCenter;
          return (
            <View
              key={i}
              style={[
                styles.bar,
                { height: h, backgroundColor: active ? colors.heading : colors.textSoft },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.track}>
        <View style={styles.trackBase} />
        <View
          style={[
            styles.trackActive,
            { left: lowCenter, width: Math.max(highCenter - lowCenter, 0) },
          ]}
        />
        <View
          style={[styles.thumb, { left: toLeft(value.low) }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          {...responders.low.panHandlers}
        />
        <View
          style={[styles.thumb, { left: toLeft(value.high) }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          {...responders.high.panHandlers}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', gap: 8 },

  hist: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: HIST_H,
  },
  /* 设计稿写的是顶部圆角 32,柱子只有 8 宽,取半宽即为设计意图的「半圆顶」 */
  bar: { width: BAR_W, borderTopLeftRadius: BAR_W / 2, borderTopRightRadius: BAR_W / 2 },

  track: { width: '100%', height: THUMB },
  trackBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (THUMB - TRACK_H) / 2,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: colors.textSoft,
  },
  trackActive: {
    position: 'absolute',
    top: (THUMB - TRACK_H) / 2,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: colors.heading,
  },
  thumb: {
    position: 'absolute',
    top: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.heading,
  },
});
