/**
 * 首页搜索区(设计稿 `Search Section` node 81:2466)
 *
 * 设计稿实测:370x45 r24 #FEFEFE,pad 13/25,gap 12,
 * 1px --secondary #D9E1FB 描边 + DS_AG 投影(0/20 blur40 spread-10 #0F294D 8%)
 * 设计稿里 Explore 按钮(81:2473)已隐藏,搜索靠键盘回车提交。
 */

import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors, shadows } from '@/config/theme';
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
        placeholderTextColor="#8B8C91"
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 45,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    paddingHorizontal: 25,
    ...shadows.card,
  },
  /**
   * `minWidth: 0` 不能省(登录页 / 酒店搜索框同款):web 端 TextInput 落成 `<input>`,
   * 其 `min-width: auto` 约等于 20 个字符宽,`flex: 1` 压不下去,富余空间为负时整行溢出。
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
});
