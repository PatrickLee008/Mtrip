/**
 * 酒店详情二级导航(Figma M-Trip / Hotel Details Overview 222:1216 Sticky Secondary Nav)
 *
 * 设计稿实测:容器高 56、底边 2px --secondary,页签间距 32、左右内边距 16;
 *   选中项主色文字 + 2px 主色下划线(pb 2),未选中 --text-2;字号 Inter 500/16。
 * 设计稿是整宽 402 的一条,页签排不下时横滑(设计稿里 Policies 已被裁掉一半)。
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props<T extends string> {
  tabs: readonly T[];
  value: T;
  onChange: (next: T) => void;
}

export default function HotelDetailTabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.root}
    >
      {tabs.map((key) => {
        const active = key === value;
        return (
          <Pressable
            key={key}
            style={({ pressed }) => [
              styles.tab,
              active && styles.tabActive,
              pressed && styles.pressed,
            ]}
            onPress={() => onChange(key)}
          >
            <Text style={[styles.label, active ? styles.labelActive : styles.labelIdle]}>
              {t(`hotels.detail.tabs.${key}`)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** 页面要按这个高度给吸顶留位,导出避免两处各写一遍 */
export const HOTEL_DETAIL_TABS_HEIGHT = 56;

const styles = StyleSheet.create({
  root: {
    height: HOTEL_DETAIL_TABS_HEIGHT,
    borderBottomWidth: 2,
    borderBottomColor: colors.softBlue,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 32, paddingHorizontal: 16 },

  tab: { height: '100%', justifyContent: 'center', paddingHorizontal: 4 },
  /* 下划线压在容器底边上:自身 2px 主色边 + pb 2,与设计稿一致 */
  tabActive: { paddingBottom: 2, borderBottomWidth: 2, borderBottomColor: colors.primary },

  label: { fontFamily: fonts.interMedium, fontSize: 16, lineHeight: 24 },
  labelActive: { color: colors.primary },
  labelIdle: { color: colors.textSoft },

  pressed: { opacity: 0.85 },
});
