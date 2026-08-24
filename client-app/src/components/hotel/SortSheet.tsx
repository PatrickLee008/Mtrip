/**
 * 排序面板(Figma M-Trip / Sort by 901:1673)—— 从「Sort by」chip 下方弹出的卡片
 *
 * 设计稿实测:
 *   卡片   白底,1px #C4C5D7(--divider)描边,圆角 32,padding 25,行间距 20
 *   行     20px 勾选框 + 8px 间距 + Inter 500/14 行高 20 字距 0.14,字色 --text-2
 *          选中 fluent:checkbox-indeterminate-16-filled、未选 fluent:checkbox-unchecked-16-filled
 *          (即项目图标表里的 checkboxIndeterminate / checkbox)
 *   六项   mTrip Recommended / Lowest Price / Highest Price / Nearest Distance /
 *          Star Rating(High to low) / Top Guest Ratings
 *
 * 取舍:
 *   - 设计稿只给了这张卡片、没有遮罩与定位信息,这里锚定到 chip 下方 8px 弹出,
 *     背板是一层透明的点击关闭区(不压暗背景,同日期选择器)。
 *   - 选中态的图标用主色(设计稿两态同为 --text-2,只靠内芯区分,辨识度太弱),
 *     文字沿用设计稿的 --text-2。
 *   - Nearest Distance 对应后端 `sortBy=distance`,但要带 lat/lng,client-app 尚未接定位,
 *     没有坐标时后端会静默回退成综合排序 —— 故该项点击走 onUnavailable,不改排序。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import type { GoodsSortBy } from '@/api/goods';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 设计稿的六项排序,顺序即设计稿顺序 */
export const SORT_OPTIONS: GoodsSortBy[] = [
  'default',
  'price_asc',
  'price_desc',
  'distance',
  'star',
  'rating',
];

/** i18n 键用驼峰,避免键名里带下划线 */
const I18N_KEY: Record<string, string> = {
  default: 'recommended',
  price_asc: 'priceAsc',
  price_desc: 'priceDesc',
  distance: 'distance',
  star: 'star',
  rating: 'rating',
};

/** 卡片宽度:够放下最长的一项「Star Rating (High to low)」,窄屏再按屏宽收 */
const PANEL_WIDTH = 260;

export interface SortAnchor {
  /** chip 左边界的窗口坐标 */
  x: number;
  /** chip 下边界的窗口坐标(面板从这里往下 8px 弹) */
  y: number;
}

interface Props {
  visible: boolean;
  value: GoodsSortBy;
  /** 「Sort by」chip 的位置;拿不到时面板落在屏幕上方居中 */
  anchor?: SortAnchor | null;
  onClose: () => void;
  onSelect: (value: GoodsSortBy) => void;
  /** 选了当前没有能力支撑的项(Nearest Distance) */
  onUnavailable: () => void;
}

export default function SortSheet({
  visible,
  value,
  anchor,
  onClose,
  onSelect,
  onUnavailable,
}: Props) {
  const { t } = useTranslation();
  const { width: winW, height: winH } = useWindowDimensions();

  /* 关闭动画放完才卸载,同项目其它浮层 */
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 140,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [anim, visible]);

  const translateY = useMemo(
    () => anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
    [anim],
  );

  const width = Math.min(PANEL_WIDTH, winW - PAGE_PADDING * 2);
  /* 靠左对齐 chip,右侧不越界;拿不到锚点时退到屏幕上方三分之一处居中 */
  const left = anchor
    ? Math.min(Math.max(anchor.x, PAGE_PADDING), winW - width - PAGE_PADDING)
    : (winW - width) / 2;
  const top = anchor ? anchor.y + 8 : winH * 0.3;

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* 设计稿没有遮罩,只留一层透明的点击关闭区 */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <Animated.View
        style={[
          styles.panel,
          { width, left, top, opacity: anim, transform: [{ translateY }] },
        ]}
      >
        {SORT_OPTIONS.map((key) => {
          const active = key === value;
          return (
            <Pressable
              key={key}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => (key === 'distance' ? onUnavailable() : onSelect(key))}
            >
              <HomeIcon
                name={active ? 'checkboxIndeterminate' : 'checkbox'}
                size={20}
                color={active ? colors.primary : colors.textSoft}
              />
              <Text style={styles.rowText}>{t(`hotels.results.sort.${I18N_KEY[key]}`)}</Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    gap: 20,
    padding: 25,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: '#FFFFFF',
    ...shadows.subtle,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: {
    flexShrink: 1,
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },
  pressed: { opacity: 0.85 },
});
