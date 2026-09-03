/**
 * 首页搜索区(设计稿 `Search Section` node 81:2466)
 *
 * 设计稿实测:370x66 r32 #FEFEFE,pad 12/24,gap 12,
 * 1px --secondary #D9E1FB 描边 + DS_AG 投影(0/20 blur40 spread-10 #0F294D 8%)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
}

export default function SearchSection({ value, onChangeText, onSubmit }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <HomeIcon name="search" size={18} color={colors.primary} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={t('home.searchPlaceholder')}
        placeholderTextColor="rgba(25, 26, 37, 0.5)"
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
      <Pressable style={({ pressed }) => [styles.btn, pressed && styles.pressed]} onPress={onSubmit}>
        {/* 极窄屏 / 超大系统字号下宁可省略号,也不让按钮把搜索框顶破 */}
        <Text style={styles.btnText} numberOfLines={1}>
          {t('home.explore')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 66,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 12,
    ...shadows.card,
  },
  /**
   * `minWidth: 0` 不能省(登录页 / 酒店搜索框同款):web 端 TextInput 落成 `<input>`,
   * 其 `min-width: auto` 约等于 20 个字符宽,`flex: 1` 压不下去,
   * 富余空间为负时整行溢出 —— 表现就是 Explore 按钮被挤出搜索框的圆角白底。
   */
  input: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    fontFamily: fonts.inter,
    fontSize: 16,
    color: colors.body,
    padding: 0,
  },
  /**
   * 按钮兜底可收缩:`input` 的 flexBasis 是 0,负富余空间全落在按钮上,
   * 默认 flexShrink=0 时它只会溢出。给 1 之后窄屏改为文字省略号,不再顶破外框。
   */
  btn: {
    marginLeft: 12,
    flexShrink: 1,
    minWidth: 0,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  pressed: { opacity: 0.85 },
  btnText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
});
