/**
 * 关怀模式底部导航栏(Figma `2540:21475` / `2540:21335` / `2540:21658` 的 BottomNavBar)
 *
 * 与完整模式的底栏是两套排版,不是同一套换个尺寸:
 *   完整模式 每个页签固定 92×48,栏内 space-between
 *   关怀模式 四个页签**等分整行**(flex 1),字号 14 而不是 12,图标 24 而不是各自原始宽高
 * 等分是刻意的 —— 字大了之后固定宽 92 放不下 "Promotions"。
 *
 * 设计稿实测:
 *   栏   --tab #FEFEFE,px12 py16,上方两角圆角 20
 *   页签 flex1,圆角 20,px4 py8,图标与文字 gap4
 *   选中 主色底 + 文字/图标 --tab;未选中 无底 + 文字/图标 --text-2
 *   文字 Inter 600/14,行高 16,字距 0.6,居中
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TabBarIcon from '@/components/common/TabBarIcon';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { MainTabParamList } from '@/navigation/types';

/** 设计稿底栏底色与未选中前景(与完整模式同值) */
const BAR_BG = '#FEFEFE';

export default function LiteTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: 16 + insets.bottom }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const fg = focused ? BAR_BG : colors.textSoft;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            style={[styles.item, focused && styles.itemActive]}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            onPress={onPress}
          >
            <TabBarIcon name={route.name as keyof MainTabParamList} color={fg} variant="lite" />
            {/* 字大了容易顶破等分格,窄屏 / 缅甸语长词一律收成一行省略号 */}
            <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
              {label}
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
    justifyContent: 'space-between',
    backgroundColor: BAR_BG,
    paddingTop: 16,
    paddingHorizontal: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  item: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 20,
  },
  itemActive: { backgroundColor: colors.primary },
  label: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 16,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
});
