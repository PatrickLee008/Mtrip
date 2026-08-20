/**
 * 会员引导卡(设计稿 05):370x176 r32 #FEFEFE,礼物图标 + 说明 + 登录按钮
 * 已登录时由调用方隐藏
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius } from '@/config/theme';
import { fonts, text } from '@/config/typography';

export default function MemberCard({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <HomeIcon name="gift" size={20} color={colors.primary} />
        <Text style={[text.linkStrong, styles.title]}>{t('home.member.title')}</Text>
      </View>
      <Text style={text.subtitle}>{t('home.member.desc')}</Text>
      <Pressable style={({ pressed }) => [styles.btn, pressed && styles.pressed]} onPress={onPress}>
        <Text style={styles.btnText}>{t('home.member.action')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    padding: 24,
    gap: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { marginLeft: 12 },
  btn: {
    alignSelf: 'flex-start',
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  pressed: { opacity: 0.85 },
  btnText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
});
