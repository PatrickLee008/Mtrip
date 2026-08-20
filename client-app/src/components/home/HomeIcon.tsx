/**
 * 首页小图标(react-native-svg)
 *
 * 每枚图标自带 viewBox:从 Figma 提取的 path 用的是设计稿原始画布(且带子节点偏移,
 * 用负的 minX/minY 把偏移抵消掉),顶替用的图标则统一 24 网格。
 *
 * 已按设计稿 fillGeometry 精确对齐:
 *   bell    ← fluent:alert-16-filled(顶部栏消息按钮,20x20 框内偏移 3.1256/2.5)
 *   diamond ← fluent:diamond-12-filled(积分/评分,16x16 框内偏移 0.6661/0.6641)
 * 其余为同一视觉体系的标准 24 网格顶替(设计稿对应节点未具名或未取到 path),
 * 拿到 path 后只需改下面这张表的 d/viewBox,组件接口不变。
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export type HomeIconName =
  | 'search'
  | 'heart'
  | 'location'
  | 'gift'
  | 'diamond'
  | 'bell'
  | 'alert'
  | 'chat'
  | 'document';

interface IconDef {
  d: string;
  viewBox?: string;
  /** true=实心填充,false/省略=描边 */
  filled?: boolean;
}

const ICONS: Record<HomeIconName, IconDef> = {
  search: { d: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4.05-4.05' },
  heart: {
    d: 'M12 20s-7.5-4.35-7.5-9.5A4.5 4.5 0 0 1 12 7.6a4.5 4.5 0 0 1 7.5 2.9C19.5 15.65 12 20 12 20Z',
  },
  location: {
    d: 'M12 21s6.5-5.6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21Z M12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  },
  chat: { d: 'M20 12a8 8 0 0 1-11.6 7.1L4 20l.9-4.4A8 8 0 1 1 20 12Z' },
  document: {
    d: 'M14 3v5h5 M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8l-4-5Z M9 13h6 M9 17h4',
  },
  gift: {
    filled: true,
    d: 'M3 11.5h8v10H5a2 2 0 0 1-2-2v-8Zm10 0h8v8a2 2 0 0 1-2 2h-6v-10ZM2.5 7h19a.5.5 0 0 1 .5.5V10a.5.5 0 0 1-.5.5h-19A.5.5 0 0 1 2 10V7.5a.5.5 0 0 1 .5-.5Zm5.9-4.5c1.7 0 2.9 1.6 3.6 3.1.7-1.5 1.9-3.1 3.6-3.1a2.25 2.25 0 0 1 0 4.5H8.4a2.25 2.25 0 0 1 0-4.5Z',
  },
  alert: {
    filled: true,
    d: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4.4a1.1 1.1 0 0 1 1.1 1.1v5.2a1.1 1.1 0 0 1-2.2 0V7.5A1.1 1.1 0 0 1 12 6.4Zm0 11.3a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z',
  },
  diamond: {
    filled: true,
    viewBox: '-0.6661 -0.6641 16 16',
    d: 'M5.44743 0.782098C5.69509 0.534161 5.9892 0.33747 6.31292 0.203272C6.63665 0.0690738 6.98366 0 7.3341 0C7.68454 0 8.03154 0.0690738 8.35527 0.203272C8.679 0.33747 8.9731 0.534161 9.22076 0.782098L13.8874 5.44876C14.3869 5.94878 14.6675 6.62665 14.6675 7.33343C14.6675 8.04021 14.3869 8.71808 13.8874 9.2181L9.22076 13.8848C8.1781 14.9248 6.48876 14.9248 5.44743 13.8848L0.780764 9.2181C0.280841 8.71802 0 8.03987 0 7.33277C0 6.62566 0.280841 5.9475 0.780764 5.44743L5.44743 0.782098Z',
  },
  bell: {
    filled: true,
    viewBox: '-3.1256 -2.5 20 20',
    d: 'M6.87436 0C5.38251 0 3.95177 0.592632 2.89688 1.64752C1.84199 2.70242 1.24936 4.13316 1.24936 5.625L1.24936 8.62625L0.0443554 11.6437C0.00661398 11.7385 -0.00735961 11.8411 0.00365403 11.9425C0.0146677 12.0439 0.0503338 12.1411 0.10754 12.2255C0.164745 12.31 0.241752 12.3791 0.331838 12.427C0.421924 12.4748 0.522352 12.4999 0.624355 12.5L13.1244 12.5C13.2264 12.4999 13.3268 12.4748 13.4169 12.427C13.507 12.3791 13.584 12.31 13.6412 12.2255C13.6984 12.1411 13.734 12.0439 13.7451 11.9425C13.7561 11.8411 13.7421 11.7385 13.7044 11.6437L12.4994 8.625L12.4994 5.625C12.4994 4.13316 11.9067 2.70242 10.8518 1.64752C9.79694 0.592632 8.3662 0 6.87436 0ZM6.87436 15.625C6.32001 15.6251 5.78133 15.441 5.34304 15.1016C4.90475 14.7622 4.59169 14.2867 4.45311 13.75L9.29561 13.75C9.15702 14.2867 8.84396 14.7622 8.40567 15.1016C7.96738 15.441 7.4287 15.6251 6.87436 15.625Z',
  },
};

interface Props {
  name: HomeIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function HomeIcon({ name, size = 20, color = '#191A25', strokeWidth = 1.8 }: Props) {
  const icon = ICONS[name];
  const viewBox = icon.viewBox ?? '0 0 24 24';
  if (icon.filled) {
    return (
      <Svg width={size} height={size} viewBox={viewBox}>
        <Path d={icon.d} fill={color} fillRule="evenodd" clipRule="evenodd" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox={viewBox}>
      <Path
        d={icon.d}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
