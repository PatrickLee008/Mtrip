/**
 * 下拉选项浮层(设计稿 1675:7737「Container」—— 性别 Male / Female / Other)
 *
 * 设计稿是一张贴在下拉框下方的白卡:整体圆角 12、overflow clip,
 * 每行高 56、白底、1px `#C4C5D7` 描边、px17 py9,文案 Inter 400/16 `--text`。
 * 行与行之间靠各自的描边叠出分隔线(设计稿即如此,不是单独的 divider)。
 *
 * 设计稿只画了这一种下拉,所以国籍 / NRC 段码 / 保险人数与天数都复用它。
 * 交互按 `DatePickerSheet` 的既有模式:RN 自带 Modal + Animated,关闭动画放完才卸载;
 * 设计稿没画遮罩,这里同 `PromoDialog` 补一层黑 25%,否则浮层压在长列表上分不清层级。
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

export interface SelectOption {
  key: string;
  label: string;
}

interface Props {
  visible: boolean;
  title?: string;
  options: SelectOption[];
  value?: string | null;
  onClose: () => void;
  onSelect: (key: string) => void;
}

export default function SelectSheet({ visible, title, options, value, onClose, onSelect }: Props) {
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [anim, visible]);

  if (!mounted) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, { opacity: anim, transform: [{ translateY }] }]}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <ScrollView style={styles.list} bounces={false}>
            {options.map((option) => {
              const active = option.key === value;
              return (
                <Pressable
                  key={option.key}
                  style={({ pressed }) => [styles.row, pressed && bookingShared.pressed]}
                  onPress={() => {
                    onSelect(option.key);
                    onClose();
                  }}
                >
                  <Text style={[styles.rowText, active && styles.rowTextActive]} numberOfLines={1}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.25)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: radius.btn,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  title: {
    paddingHorizontal: 17,
    paddingVertical: 12,
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.label,
    backgroundColor: colors.card,
  },
  list: { maxHeight: 336 },
  row: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
  },
  rowText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },
  rowTextActive: { fontFamily: fonts.interSemi, color: colors.primary },
});
