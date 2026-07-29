/**
 * 页面布局:安全区 + 统一背景,可选滚动
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/config/theme';

interface Props {
  children: React.ReactNode;
  /** true 时内容包裹在 ScrollView 中 */
  scrollable?: boolean;
  /** 安全区边,默认不含 top(Tab/Stack 有导航头) */
  edges?: Edge[];
  padded?: boolean;
}

export default function PageLayout({
  children,
  scrollable = false,
  edges = ['bottom'],
  padded = false,
}: Props) {
  const content = scrollable ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[padded && styles.padded, styles.scrollContent]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  padded: { padding: spacing.lg },
  scrollContent: { paddingBottom: spacing.xl },
});
