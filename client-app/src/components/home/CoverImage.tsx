/**
 * 首页封面图,三级降级:
 *   1. uri —— 接口返回的远程图(经 `resolveMediaUri` 解析:相对路径补 API_BASE_URL,
 *      脏值如 `'111'` 一律当作没有图,否则会绕过下面两级兜底、渲染成加载失败的空白块)
 *   2. fallback —— 设计稿导出的本地临时图(assets/images/temp/,见该目录 README)
 *   3. 主色渐变 + 文字占位
 * 两种图都用 resizeMode="cover" 居中裁切,与设计稿图片框的裁切方式一致。
 * 渐变用 react-native-svg 实现,避免为此引入 expo-linear-gradient
 */

import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { resolveMediaUri } from '@/utils/media';

interface Props {
  uri?: string | null;
  width: number;
  height: number;
  radius?: number;
  /** 无 uri 时使用的本地图(设计稿临时素材);再无则走渐变占位 */
  fallback?: ImageSourcePropType;
  /** 两者都没有时居中显示的占位文字 */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export default function CoverImage({
  uri,
  width,
  height,
  radius = 0,
  fallback,
  label,
  style,
}: Props) {
  const box = { width, height, borderRadius: radius };
  const remote = resolveMediaUri(uri);
  const source = remote ? { uri: remote } : fallback;
  if (source) {
    return <Image source={source} style={[box, style as StyleProp<ImageStyle>]} resizeMode="cover" />;
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
