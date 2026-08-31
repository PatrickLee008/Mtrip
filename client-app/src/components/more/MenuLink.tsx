/**
 * 「更多」页的菜单项(设计稿 1690:4994 等 Link)
 *
 * 设计稿:48 圆形 `#ECF5FE` 底 + 20 图标 → 标题 Inter 400/16 + 副标题 Inter 400/14 `--text-2`
 * → 右侧 7.4×12 箭头;同一张卡里除最后一项外,每项下方带一条 `--secondary` 分隔线(间距 16)。
 * 无障碍模式那项右侧不是箭头而是一枚开关,故 right 做成可替换的插槽。
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
  desc: string;
  /** 右侧插槽;缺省是箭头 */
  right?: React.ReactNode;
  /** 是否画下方分隔线(卡内最后一项不画) */
  divider?: boolean;
  onPress?: () => void;
}

export default function MenuLink({ icon, title, desc, right, divider, onPress }: Props) {
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
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.desc} numberOfLines={1}>
            {desc}
          </Text>
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
  desc: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 24, color: colors.textSoft },
});
