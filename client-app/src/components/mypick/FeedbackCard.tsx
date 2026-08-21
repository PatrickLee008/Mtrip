/**
 * 入住反馈卡(设计稿 `Section - Upcoming Trip Card` node 800:2252)
 *
 * 设计稿实测:370x176,底色 --tab #FEFEFE,1px 边框 --secondary #D9E1FB,圆角 32,
 * 投影 0/20 blur40 spread-10 rgba(15,41,77,0.08),padding 24,内容 gap 8。
 *   标题 Inter 600/16 主色(容器透明度 .9)→ 说明 Outfit 600/16 --text-2(两行)
 *   → 右对齐按钮 主色底 圆角 12、上下 8 左右 24、Inter 400/16 白字
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

export default function FeedbackCard({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('myPick.feedback.title')}</Text>
      <Text style={styles.desc}>{t('myPick.feedback.desc')}</Text>
      <View style={styles.actionRow}>
        <Pressable style={({ pressed }) => [styles.btn, pressed && styles.pressed]} onPress={onPress}>
          <Text style={styles.btnText}>{t('myPick.feedback.action')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    padding: 24,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    /* 设计稿 DS_AG:0/20 blur40 spread-10 rgba(15,41,77,0.08) */
    shadowColor: '#0F294D',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  title: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.primary,
    opacity: 0.9,
  },
  desc: { fontFamily: fonts.outfitSemi, fontSize: 16, lineHeight: 24, color: colors.textSoft },
  actionRow: { alignItems: 'flex-end' },
  btn: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  pressed: { opacity: 0.85 },
  btnText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
});
