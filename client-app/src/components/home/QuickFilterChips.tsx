/**
 * 快捷筛选 chips(设计稿 03):两枚 180x40 r32 #FEFEFE,文字 Inter 600/16 主色
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius } from '@/config/theme';
import { text } from '@/config/typography';
import { QUICK_FILTERS } from '@/screens/home/homeSections';

export default function QuickFilterChips({ onPress }: { onPress: (key: string) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {QUICK_FILTERS.map((key) => (
        <Pressable
          key={key}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          onPress={() => onPress(key)}
        >
          <Text style={text.linkStrong}>{t(`home.filter.${key}`)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    height: 40,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
});
