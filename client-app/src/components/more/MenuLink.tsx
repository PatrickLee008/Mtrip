/**
 * 「更多」页的菜单项(设计稿 1690:4994 等 Link)
 *
 * 设计稿:48 圆形 `#ECF5FE` 底 + 20 图标 → 标题 Inter 400/16 + 副标题 Inter 400/14 `--text-2`
 * → 右侧 7.4×12 箭头;同一张卡里除最后一项外,每项下方带一条 `--secondary` 分隔线(间距 16)。
 * 无障碍模式那项右侧不是箭头而是一枚开关,故 right 做成可替换的插槽。
 *
 * `lite` 是关怀模式的排版(Figma Lite More `2540:21522`):图标底板与箭头不变,
 * 标题放大到 Inter 400/20,**且整行只有标题没有副标题** —— 设计稿这几行就没画副标题,
 * 关怀模式要的是「一行一件事」,补一行灰色小字与这个目的相反。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import HomeIcon, { type HomeIconName } from '@/components/home/HomeIcon';
import { MENU_ICON_BG, moreShared } from '@/components/more/moreShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  icon: HomeIconName;
  title: string;
  /** 副标题;`lite` 排版下不展示 */
  desc?: string;
  /** 右侧插槽;缺省是箭头 */
  right?: React.ReactNode;
  /** 是否画下方分隔线(卡内最后一项不画) */
  divider?: boolean;
  /** 关怀模式排版:标题 20、无副标题 */
  lite?: boolean;
  onPress?: () => void;
}

export default function MenuLink({ icon, title, desc, right, divider, lite, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.link, pressed && onPress ? moreShared.pressed : null]}
      disabled={!onPress}
      onPress={onPress}
    >
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <HomeIcon name={icon} size={20} color={colors.primary} />
        </View>

        <View style={styles.text}>
          <Text style={[styles.title, lite && styles.titleLite]} numberOfLines={1}>
            {title}
          </Text>
          {!lite && desc ? (
            <Text style={styles.desc} numberOfLines={1}>
              {desc}
            </Text>
          ) : null}
        </View>

        {right ?? <HomeIcon name="chevronRight" width={7.4} height={12} color={colors.divider} />}
      </View>

      {divider ? <View style={moreShared.divider} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { width: '100%', gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: MENU_ICON_BG,
  },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },
  titleLite: { fontSize: 20 },
  desc: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 24, color: colors.textSoft },
});
