/**
 * 图片上下压的那条主色渐变(主色 50% → 全透明)
 *
 * 抽自 `components/hotel/lite/LiteHotelCard` 封面上下那两条(那里原本是本地函数)。
 * 房型详情页顶栏的填充(`2352:9557` 的 `Text Bg top`)是同一规格,两处共用一份,
 * 免得改一次要改两遍(与 `liteShared` / `detailShared` 同一做法)。
 *
 * 设计稿原始规格:`linear-gradient(0deg, rgba(65,105,237,0) 0%, rgba(65,105,237,0.5) 100%)`,
 * 即 `colors.primary`(#4169ED)从透明到 50%。
 *
 * `reverse` = **自上而下**由深到浅(压在图片顶部当遮罩时用这个);默认自下而上。
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/config/theme';

export default function EdgeGradient({ id, reverse = false }: { id: string; reverse?: boolean }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity={reverse ? 0.5 : 0} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={reverse ? 0 : 0.5} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
