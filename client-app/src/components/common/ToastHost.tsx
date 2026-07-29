/**
 * 全局 Toast 宿主:挂载在 App 根部,消费 commonStore.toastMessage
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { fontSize, radius, spacing } from '@/config/theme';
import { useCommonStore } from '@/store/commonStore';

export default function ToastHost() {
  const toastMessage = useCommonStore((s) => s.toastMessage);
  const toastVersion = useCommonStore((s) => s.toastVersion);
  const clearToast = useCommonStore((s) => s.clearToast);
  const opacity = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toastMessage) return;
    setVisible(true);
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
        setVisible(false);
        clearToast();
      });
    }, 2200);
    return () => clearTimeout(timer);
  }, [toastMessage, toastVersion, opacity, clearToast]);

  if (!visible || !toastMessage) return null;
  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Text style={styles.text}>{toastMessage}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 100,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    zIndex: 9999,
  },
  text: { color: '#fff', fontSize: fontSize.sm, textAlign: 'center' },
});
