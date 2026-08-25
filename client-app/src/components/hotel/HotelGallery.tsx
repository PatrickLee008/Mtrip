/**
 * 酒店详情图库(Figma M-Trip / Hotel Details Overview 94:897 Hero Section / Gallery)
 *
 * 设计稿实测:
 *   容器 402x300,整屏宽横滑翻页(设计稿三张 Container 各 402 宽)
 *   —— 页宽以容器 onLayout 实测为准,圆点由 onScroll 实时回算(见下方 Props / syncIndex 注释)
 *   底部渐变 94:905:自下而上 rgba(0,0,0,0.6) → 到 50% 处透明(RN 无 CSS 渐变,用 react-native-svg)
 *   底部一行 361:1548:padding 12,左侧圆点条 / 右侧张数胶囊
 *     圆点条 361:1549  底 rgba(0,0,0,0.25) 圆角 999 px12 py8 gap6,圆点 8,当前白、其余白 40%
 *     张数胶囊 361:1553 底同上 圆角 40 px12 py4 gap10,图标 20 + Inter 400/20 白
 *   设计稿的模糊(backdrop-blur 6)RN 无原生等价,只保留底色。
 *
 * 设计稿计数写的是 2/12,但只导出了 3 张图 —— 这里按传进来的实际张数算,不硬写总数。
 */

import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { fonts } from '@/config/typography';

interface Props {
  images: ImageSourcePropType[];
  /** 图库高度,缺省取设计稿的 300 */
  height?: number;
  /**
   * 单页宽度的初始值(= 屏宽),由页面把窗口宽度传进来。
   * 实际翻页宽度以自身 onLayout 量到的为准 —— web 端 `useWindowDimensions()` 拿的是
   * `window.innerWidth`,多数桌面浏览器把纵向滚动条也算进去,直接拿它当页宽会让图片比容器宽一点、
   * 翻页位置逐页偏移。
   */
  width: number;
}

export default function HotelGallery({ images, height = 300, width }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  /** 容器实测宽度,量到之前先用传进来的屏宽顶着 */
  const [pageWidth, setPageWidth] = useState(width);

  /**
   * 按滚动位置回算当前页,四舍五入避免半页时抖动。
   * 用 `onScroll` 而不是只挂 `onMomentumScrollEnd`:web 端鼠标/触控板滚动没有惯性阶段,
   * react-native-web 不会派发 momentum 事件,只挂它的话圆点永远停在第 1 页。
   * 原生端仍额外挂一次 momentum,保证停下时精确落到整页。
   */
  const syncIndex = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setIndex(Math.max(0, Math.min(images.length - 1, next)));
  };

  return (
    <View
      style={[styles.root, { height }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        /* 量到 0 就先不覆盖,免得图片被压成 0 宽 */
        if (w > 0) setPageWidth(w);
      }}
    >
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={syncIndex}
        onMomentumScrollEnd={syncIndex}
        scrollEventThrottle={16}
      >
        {images.map((source, i) => (
          <Image
            key={i}
            source={source}
            style={{ width: pageWidth, height }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ))}
      </ScrollView>

      {/* 底部渐变:压暗图片底部,保证圆点条与张数可读 */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="hotelGalleryShade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#000000" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.6} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#hotelGalleryShade)" />
        </Svg>
      </View>

      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.dots}>
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === index ? styles.dotActive : styles.dotIdle]} />
          ))}
        </View>

        <View style={styles.counter}>
          <HomeIcon name="imageCopy" size={20} color="#FFFFFF" />
          <Text style={styles.counterText}>
            {t('hotels.detail.photoCount', { index: index + 1, total: images.length })}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', overflow: 'hidden' },

  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },

  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    /* 设计稿还叠了 6px 背景模糊,RN 无原生 backdrop-blur,只保留底色 */
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  dotActive: { backgroundColor: '#FFFFFF' },
  dotIdle: { backgroundColor: 'rgba(255, 255, 255, 0.4)' },

  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  counterText: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#FFFFFF',
  },
});
