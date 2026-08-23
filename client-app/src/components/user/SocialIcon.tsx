/**
 * 第三方登录品牌图标(设计稿 505:1293 Social Logins)
 *
 * 品牌标是多色的,走不了单色的 HomeIcon;Google / Facebook 的 path 由脚本从设计稿导出的
 * SVG 直接提取(viewBox 0 0 20 20,未手抄),Apple 在设计稿里本就是位图,用导出的 PNG。
 * 不要改动 path 与 fill —— 品牌标的形状和配色有使用规范。
 */

import React from 'react';
import { Image, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const APPLE = require('../../../assets/images/login/social-apple.png');

export type SocialProvider = 'google' | 'facebook' | 'apple';

interface Props {
  provider: SocialProvider;
  /** 设计稿图标框 20x20 */
  size?: number;
}

export default function SocialIcon({ provider, size = 20 }: Props) {
  if (provider === 'apple') {
    return <Image source={APPLE} style={[styles.apple, { width: size, height: size }]} />;
  }
  if (provider === 'facebook') {
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M20 10.0608C20 4.53833 15.5225 0.0608333 10 0.0608333C4.4775 0.0608333 0 4.53833 0 10.0608C0 15.0525 3.65667 19.1892 8.4375 19.9392V12.9517H5.89833V10.06H8.4375V7.85833C8.4375 5.3525 9.93083 3.9675 12.215 3.9675C13.3083 3.9675 14.4533 4.16333 14.4533 4.16333V6.62417H13.1917C11.9492 6.62417 11.5617 7.395 11.5617 8.18583V10.0608H14.335L13.8917 12.9525H11.5617V19.94C16.3433 19.1892 20 15.0517 20 10.0608V10.0608" fill="#1877F2" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M18.8 10.2083C18.8 9.55833 18.7417 8.93333 18.6333 8.33333H10V11.8833H14.9333C14.7167 13.025 14.0667 13.9917 13.0917 14.6417V16.95H16.0667C17.8 15.35 18.8 13 18.8 10.2083V10.2083" fill="#4285F4" />
      <Path d="M10 19.1667C12.475 19.1667 14.55 18.35 16.0667 16.95L13.0917 14.6417C12.275 15.1917 11.2333 15.525 10 15.525C7.61667 15.525 5.59167 13.9167 4.86667 11.75H1.81667V14.1167C3.325 17.1083 6.41667 19.1667 10 19.1667V19.1667" fill="#34A853" />
      <Path d="M4.86667 11.7417C4.68333 11.1917 4.575 10.6083 4.575 10C4.575 9.39167 4.68333 8.80833 4.86667 8.25833V5.89167H1.81667C1.19167 7.125 0.833333 8.51667 0.833333 10C0.833333 11.4833 1.19167 12.875 1.81667 14.1083L4.86667 11.7417V11.7417" fill="#FBBC05" />
      <Path d="M10 4.48333C11.35 4.48333 12.55 4.95 13.5083 5.85L16.1333 3.225C14.5417 1.74167 12.475 0.833333 10 0.833333C6.41667 0.833333 3.325 2.89167 1.81667 5.89167L4.86667 8.25833C5.59167 6.09167 7.61667 4.48333 10 4.48333V4.48333" fill="#EA4335" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  apple: { resizeMode: 'contain' },
});
