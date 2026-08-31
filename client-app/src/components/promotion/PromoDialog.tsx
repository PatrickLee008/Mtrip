/**
 * 优惠中心的居中弹层(设计稿 1626:3207 How to use Overlay / 1627:3239 Alert Overlay)
 *
 * 两张稿是同一张壳:`--tab` 底、圆角 32、padding 24、gap 16、内容居中,
 * 底部一枚整宽主色 Close 按钮(py16 圆角 12,Inter 500/14)。差异只在中间内容,
 * 故做成一个壳 + children,两处调用各自传内容。
 *
 * 设计稿里这两张是独立画板,没画遮罩;这里补了一层黑 25% 的半透明遮罩 ——
 * 弹层浮在长列表上没有遮罩会分不清层级,取值与 App 其它半透明层一致。
 */

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function PromoDialog({ visible, onClose, children }: Props) {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.card}>
          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            onPress={onClose}
          >
            <Text style={styles.closeText}>{t('promotions.howToUseSheet.close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  card: {
    maxHeight: '80%',
    padding: 24,
    gap: 16,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  body: { gap: 16 },

  close: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  closeText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  pressed: { opacity: 0.85 },
});
