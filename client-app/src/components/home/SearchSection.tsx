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
        <Text style={styles.btnText}>{t('home.explore')}</Text>
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
  input: {
    flex: 1,
    marginLeft: 12,
    fontFamily: fonts.inter,
    fontSize: 16,
    color: colors.body,
    padding: 0,
  },
  btn: {
    marginLeft: 12,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  pressed: { opacity: 0.85 },
  btnText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
});
