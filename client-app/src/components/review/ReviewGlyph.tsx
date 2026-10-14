/** 评价页的表情 / 点赞图标渲染(数据见 reviewAssets.ts) */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

import type { Glyph } from '@/components/review/reviewAssets';

interface Props {
  glyph: Glyph;
  size: number;
  /** 覆盖所有 path 的填充色(点赞图标按主题色着色用);不传则用设计稿原色 */
  color?: string;
}

export default function ReviewGlyph({ glyph, size, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox={glyph.viewBox}>
      {glyph.paths.map((p, i) => (
        <Path
          key={i}
          d={p.d}
          fill={color ?? p.fill}
          fillOpacity={p.fillOpacity}
          stroke={p.stroke}
        />
      ))}
    </Svg>
  );
}
