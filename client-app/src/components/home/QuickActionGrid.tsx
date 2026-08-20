/**
 * 快捷入口(设计稿 01 `Quick Action Dashboard`):一行 4 项
 *
 * 设计稿实测:行宽 370、itemSpacing 16;每项 80.5x80.5 圆角 24 的**图片填充**方块
 * (4x80.5 + 3x16 = 370 正好铺满),方块与文字间距 8,文字 Inter 400/16。
 * 导出的 PNG 本身就是那块蓝色图标(整张满幅,圆角靠 borderRadius 裁),所以**不能再垫白色底板**。
 *
 * 边长按实测行宽算,四个格子写死同一个 width/height —— 不用 aspectRatio 推导,
 * 避免 web 端因图片固有比例/像素取整导致四个格子宽高不一致。
 */

import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PAGE_PADDING } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { QuickAction } from '@/screens/home/homeSections';

/** 设计稿 itemSpacing */
const GAP = 16;

interface Props {
  items: QuickAction[];
  onPress: (item: QuickAction) => void;
}

export default function QuickActionGrid({ items, onPress }: Props) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  // 先用窗口宽度估一个初值,onLayout 拿到真实行宽后校正(web 端竖向滚动条会占宽)
  const [rowWidth, setRowWidth] = useState(width - PAGE_PADDING * 2);
  const size = Math.floor((rowWidth - GAP * (items.length - 1)) / items.length);

  return (
    <View
      style={styles.row}
      onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
    >
      {items.map((item) => (
        <Pressable
          key={item.key}
          style={({ pressed }) => [styles.item, { width: size }, pressed && styles.pressed]}
          onPress={() => onPress(item)}
        >
          <Image
            source={item.icon}
            style={[styles.tile, { width: size, height: size }]}
            resizeMode="cover"
          />
          <Text style={styles.label} numberOfLines={1}>
            {t(`home.quickAction.${item.key}`)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: GAP },
  item: { alignItems: 'center' },
  pressed: { opacity: 0.8 },
  /* 图标即底板:正方形 + 圆角 24,不加白底与阴影 */
  tile: { borderRadius: 24 },
  label: {
    marginTop: 8,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: '#1B1D30',
  },
});
