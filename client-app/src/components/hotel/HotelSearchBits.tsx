/**
 * 酒店搜索页与结果页共用的两块小控件(Search 1 `91:200`、Long Stay Search Results `1695:6325`):
 *
 *   GuidePill    顶栏筛选左侧「how do I book ?」胶囊(实例 2203:6857 / 2206:7423),
 *                px12 py8 圆角 20、黑 40% 底,Inter 400/12 白字 + 20 问号,间距 4;点开用户指引
 *   CitizenCheck 「Myanmar Citizen」勾选 + 其后 10px 的 fluent:info-20-filled 说明按钮
 *                (2150:4785 / 2291:5910),点 i 弹本地居民价说明
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';

export function GuidePill({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      onPress={onPress}
      hitSlop={8}
    >
      <Text style={styles.pillText}>{t('hotels.howToBook')}</Text>
      <HomeIcon name="questionCircle" size={20} color="#FFFFFF" />
    </Pressable>
  );
}

export function CitizenCheck({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  return (
    <View style={styles.line}>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() => onChange(!value)}
        hitSlop={6}
      >
        <HomeIcon
          name={value ? 'checkboxIndeterminate' : 'checkbox'}
          size={20}
          color={value ? colors.primary : colors.textSoft}
        />
        <Text style={styles.label}>{t('hotels.myanmarCitizen')}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => pressed && styles.pressed}
        onPress={() => showToast(t('hotels.citizenTip'))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('hotels.citizenTip')}
      >
        <HomeIcon name="info20" size={20} color={colors.textSoft} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    /* 设计稿还叠了 4px 背景模糊,RN 无原生 backdrop-blur,只保留底色(同顶栏圆钮) */
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  pillText: { fontFamily: fonts.inter, fontSize: 12, color: '#FFFFFF' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 24,
    color: colors.textSoft,
  },
});
