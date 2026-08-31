/**
 * 分段页签(设计稿反复出现的 `Tab Navigation`:优惠中心 1390:2921 / 推荐明细 1690:5543 /
 * 教程与指南 2206:7881 / 通知 1685:3610,四处取值完全一致)
 *
 * 设计稿:`--tab` 底、圆角 32、padding 8;选中项主色底、圆角 16、py8、白字 + Effect/DS 投影,
 * 未选中项无底色、文字走 `--text-2`。文字统一 Inter 500/14 tracking 0.14。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props<T extends string> {
  tabs: readonly T[];
  value: T;
  onChange: (tab: T) => void;
  /** 取每个页签的显示文案(通常是 t(...)) */
  label: (tab: T) => string;
}

export default function SegmentedTabs<T extends string>({ tabs, value, onChange, label }: Props<T>) {
  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const active = tab === value;
        return (
          <Pressable
            key={tab}
            style={[styles.item, active && styles.itemActive]}
            accessibilityRole="tab"
            accessibilityState={active ? { selected: true } : {}}
            onPress={() => onChange(tab)}
          >
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
              {label(tab)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  item: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 16,
  },
  itemActive: { backgroundColor: colors.primary, ...shadows.subtle },
  label: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
  },
  labelActive: { color: '#FFFFFF' },
  labelInactive: { color: colors.textSoft },
});
