/**
 * 支付结果浮层(设计稿 1675:7715「Payment Success」/ 1675:7726「Payment Fail!」)
 *
 * 设计稿实测:`--tab` 底、圆角 32、padding 24、gap 16、内容居中
 *   成功 60 的 `fluent:checkmark-circle-20-filled` 主色 + 标题 Inter 600/20 tracking .14 主色 + 一枚 Close
 *   失败 60 的 `fluent:dismiss-circle-20-filled` `--tertiary` + 同款标题(红) + 说明 Inter 400/16 `--text-2`
 *        + Cancel(1px 主色描边、红字)/ Retry(主色底白字)两枚,各占一半
 *   两枚按钮圆角 12、py16、Inter 500/14 tracking .14
 *
 * 两张稿是独立画板、**没画遮罩**,这里同 `PromoDialog` 的既有处理补一层黑 25%。
 * 动画沿用 `DatePickerSheet` 的模式:关闭动画放完才卸载,组件内自持挂载态。
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import HomeIcon from '@/components/home/HomeIcon';
import { bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  visible: boolean;
  tone: 'success' | 'error';
  title: string;
  desc?: string | null;
  /** 主按钮(成功=Close,失败=Retry) */
  primaryLabel: string;
  onPrimary: () => void;
  /** 次按钮(只有失败态有) */
  secondaryLabel?: string | null;
  onSecondary?: () => void;
  onClose: () => void;
}

export default function AlertDialog({
  visible,
  tone,
  title,
  desc,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [anim, visible]);

  if (!mounted) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const success = tone === 'success';

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, { opacity: anim, transform: [{ translateY }] }]}>
          <HomeIcon
            name={success ? 'checkmarkCircle' : 'dismissCircle'}
            size={60}
            color={success ? colors.primary : colors.hot}
          />
          <Text style={[styles.title, !success && styles.titleError]}>{title}</Text>
          {desc ? <Text style={styles.desc}>{desc}</Text> : null}

          <View style={styles.actions}>
            {secondaryLabel ? (
              <Pressable
                style={({ pressed }) => [styles.ghostBtn, pressed && bookingShared.pressed]}
                onPress={onSecondary}
              >
                <Text style={styles.ghostText}>{secondaryLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && bookingShared.pressed]}
              onPress={onPrimary}
            >
              <Text style={styles.primaryText}>{primaryLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.25)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  card: {
    width: '100%',
    maxWidth: 370,
    alignItems: 'center',
    gap: 16,
    padding: 24,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  title: {
    width: '100%',
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.primary,
  },
  titleError: { color: colors.hot },
  desc: {
    width: '100%',
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
  },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, width: '100%' },
  ghostBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ghostText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.hot,
  },
  primaryBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  primaryText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
