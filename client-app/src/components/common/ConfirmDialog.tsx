/**
 * 确认弹窗(Figma M-Trip / Alert Overlay `2659:12483`)
 *
 * 设计稿实测:
 *   遮罩  居中,卡片 `--tab` 底 / 圆角 24 / padding 24 / gap 16 / 整体居中
 *   图标  fluent:question-circle-20-filled,60
 *   标题  Inter 600/20(行高 20)tracking 0.14 `--text` 居中
 *   正文  Inter 400/16(行高 24)`--text-2` 居中
 *   按钮  两枚等宽 gap 16,圆角 12
 *         Cancel  1px `--primary` 描边、py17、文字 **`--tertiary` #EC1317**(稿面如此:蓝边红字)
 *         Confirm 主色底、py16、白字;两枚均 Inter 500/14(行高 20)tracking 0.14
 *
 * 遮罩底色设计稿没给(Overlay 是单独一层),这里用与 App 其余浮层一致的半透明黑。
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {/* 点遮罩等于取消(与 Android 返回键一致) */}
      <Pressable style={styles.mask} onPress={onCancel}>
        {/* 卡片自身吞掉点击,免得点在卡片上也关掉 */}
        <Pressable style={styles.card} onPress={() => {}}>
          <HomeIcon name="questionCircle" size={60} color={colors.orange} />

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  title: {
    width: '100%',
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.heading,
  },
  message: {
    width: '100%',
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
  },

  actions: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, width: '100%' },
  cancelBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  /* 稿面就是蓝边红字:--tertiary #EC1317 == theme 的 colors.hot(不是 danger #ff4d4f) */
  cancelText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.hot,
  },
  confirmBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  confirmText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: '#FFFFFF',
  },

  pressed: { opacity: 0.85 },
});
