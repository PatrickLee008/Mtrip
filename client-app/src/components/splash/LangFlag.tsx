/**
 * 语言选项前面的 40 圆形国旗(开屏语言卡 2163:8057 与「更多」Change language 3256:18986 共用)
 *
 * 英美/缅甸是矩形旗,按 275/183 比例撑满高度后左右居中裁进圆框;
 * 中国旗导出的是带阴影的方形圆标,设计稿另做了 150.27%/left10.02%/top-11.12% 的二次裁切。
 */

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import type { Lang } from '@/config/global';

const FLAGS: Record<Lang, number> = {
  'en-US': require('../../../assets/images/splash/flag-en.png'),
  'my-MM': require('../../../assets/images/splash/flag-my.png'),
  'zh-CN': require('../../../assets/images/splash/flag-zh.png'),
};

const FLAG_SIZE = 40;
const FLAG_IMAGE_WIDTH = (FLAG_SIZE * 275) / 183;

function flagImageStyle(lang: Lang) {
  if (lang === 'zh-CN') {
    return {
      position: 'absolute' as const,
      width: FLAG_IMAGE_WIDTH,
      height: FLAG_IMAGE_WIDTH,
      left: FLAG_IMAGE_WIDTH * 0.1002 - (FLAG_IMAGE_WIDTH - FLAG_SIZE) / 2,
      top: -FLAG_SIZE * 0.1112,
    };
  }
  return {
    position: 'absolute' as const,
    width: FLAG_IMAGE_WIDTH,
    height: FLAG_SIZE,
    left: -(FLAG_IMAGE_WIDTH - FLAG_SIZE) / 2,
    top: 0,
  };
}

export default function LangFlag({ lang }: { lang: Lang }) {
  return (
    <View style={styles.box}>
      <Image source={FLAGS[lang]} style={flagImageStyle(lang)} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  /* 设计稿圆角 99 = 正圆 */
  box: {
    width: FLAG_SIZE,
    height: FLAG_SIZE,
    borderRadius: FLAG_SIZE / 2,
    overflow: 'hidden',
  },
});
