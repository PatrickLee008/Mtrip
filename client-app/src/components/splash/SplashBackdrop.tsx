/**
 * 开屏系列页面共用的底衬(Figma M-Trip / Splash section `752:9379`)
 *
 * 该 section 下的三屏 —— 纯开屏 `452:2190`、语言选择 `2163:8057`、模式选择 `2485:7324` ——
 * 共用同一层主色底 + 底部两条白色 10% 波浪 + 同一张 logo(同比例裁切)。
 * 这里只抽「波浪」与「logo」两件,页面自己的卡片留在各自的屏里。
 *
 * 设计稿实测:
 *   波浪 Vector1 576×182 left-93 bottom0;Vector2 576×140.354 left-92.79 bottom-39.35 且水平镜像
 *        (设计稿写的是 rotate180 + scaleY(-1),净效果等于 scaleX(-1));两条都是白色 10%
 *        设计稿画布宽 402,这里按 屏宽/402 等比放大
 *   logo 内部图片固定 180.6%×245.45%、偏移 -40.3%/-72.73%(与登录页同一张 logo-badge),
 *        外框尺寸各屏不同,由 `box` 传入
 */

import React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const LOGO = require('../../../assets/images/login/logo-badge.png');

/** 设计稿画布宽,波浪按屏宽等比放大 */
const DESIGN_WIDTH = 402;

/** logo 图片相对外框的裁切参数(三屏一致,只有外框大小不同) */
const LOGO_CROP = { width: 1.806, height: 2.4545, left: 0.403, top: 0.7273 } as const;

export interface LogoBox {
  width: number;
  height: number;
}

/** 底部两条波浪(设计稿 Vector 1 / Vector 2,白色 10%) */
export function SplashWaves() {
  const { width } = useWindowDimensions();
  const scale = width / DESIGN_WIDTH;
  const w = 576 * scale;

  return (
    <View style={styles.waves} pointerEvents="none">
      <Svg
        width={w}
        height={182 * scale}
        viewBox="0 0 576 182"
        preserveAspectRatio="none"
        style={[styles.wave, { left: -93 * scale, bottom: 0 }]}
      >
        <Path
          d="M105.592 0.373454C27.9242 6.25793 2.83579 87.6975 0 127.682V182H576C568.493 151.257 550.278 86.151 537.467 71.6662C521.453 53.5601 453.894 33.7565 335.791 65.4421C217.689 97.1277 202.676 -6.98214 105.592 0.373454Z"
          fill="#FFFFFF"
          fillOpacity={0.1}
        />
      </Svg>
      <Svg
        width={w}
        height={140.354 * scale}
        viewBox="0 0 576 140.354"
        preserveAspectRatio="none"
        style={[
          styles.wave,
          { left: -92.79 * scale, bottom: -39.35 * scale, transform: [{ scaleX: -1 }] },
        ]}
      >
        <Path
          d="M105.592 0.287998C27.9242 4.82595 2.83579 67.63 0 98.4648V140.354H576C568.493 116.646 550.278 66.4374 537.467 55.2671C521.453 41.3041 453.894 26.0321 335.791 50.4673C217.689 74.9024 202.676 -5.38444 105.592 0.287998Z"
          fill="#FFFFFF"
          fillOpacity={0.1}
        />
      </Svg>
    </View>
  );
}

/** 主色底上的 mTrip logo:外框按 `box` 尺寸裁切,内部图片按设计稿比例放大后偏移 */
export function SplashLogo({ box }: { box: LogoBox }) {
  return (
    <View style={[styles.logoBox, box]}>
      <Image
        source={LOGO}
        style={{
          position: 'absolute',
          width: box.width * LOGO_CROP.width,
          height: box.height * LOGO_CROP.height,
          left: -box.width * LOGO_CROP.left,
          top: -box.height * LOGO_CROP.top,
        }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  waves: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  wave: { position: 'absolute' },
  logoBox: { overflow: 'hidden' },
});
