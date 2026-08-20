/**
 * 首页封面图:有 uri 走远程图,无 uri 用主色渐变占位(设计稿大图暂无本地素材)
 * 渐变用 react-native-svg 实现,避免为此引入 expo-linear-gradient
 */

import React from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  uri?: string | null;
  width: number;
  height: number;
  radius?: number;
  /** 无图时居中显示的占位文字 */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export default function CoverImage({ uri, width, height, radius = 0, label, style }: Props) {
  const box = { width, height, borderRadius: radius };
  if (uri) {
    return <Image source={{ uri }} style={[box, style as StyleProp<ImageStyle>]} resizeMode="cover" />;
  }
  return (
    <View style={[box, styles.wrap, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="coverGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.deepBlue} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} rx={radius} fill="url(#coverGrad)" />
      </Svg>
      {label ? (
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  label: {
    position: 'absolute',
    paddingHorizontal: 12,
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily: fonts.interSemi,
    fontSize: 14,
  },
});
