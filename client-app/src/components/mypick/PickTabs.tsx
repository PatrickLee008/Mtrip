/**
 * 订单分类页签(设计稿 `Tab Navigation` node 289:1195)
 *
 * 设计稿实测:370x52,底色 --tab #FEFEFE,圆角 32,内边距 8,三等分,按钮间距 8。
 *   选中:主色底、圆角 16、上下 8、Inter Medium 14/20 字距 0.14 白字,投影 0/1 blur1 黑 5%
 *   未选中:透明底、圆角 8、文字 --text-2 rgba(25,26,37,0.5)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

export interface PickTabItem {
  key: string;
  label: string;
}

interface Props {
  items: PickTabItem[];
  value: string;
  onChange: (key: string) => void;
}

export default function PickTabs({ items, value, onChange }: Props) {
  return (
    <View style={styles.bar}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            style={[styles.item, active && styles.itemActive]}
            accessibilityRole="tab"
            accessibilityState={active ? { selected: true } : {}}
            onPress={() => onChange(item.key)}
          >
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
              {item.label}
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
    alignItems: 'center',
    gap: 8,
    height: 52,
    padding: 8,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  item: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  itemActive: {
    borderRadius: 16,
    backgroundColor: colors.primary,
    /* 设计稿 DROP_SHADOW 0/1 blur1 黑 5% */
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
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
