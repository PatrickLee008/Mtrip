/**
 * 语言选择弹层(「更多」页的语言行调起)
 *
 * 设计稿的 More 页没有这一项 —— 多语言是设计稿未覆盖、项目自有的需求(见开屏语言选择页)。
 * 这里复用开屏页 `2163:8057` 的选项行样式(1px `--secondary` 描边、圆角 12、padding 16、
 * 勾选框 20),避免另造一套。
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import HomeIcon from '@/components/home/HomeIcon';
import { moreShared } from '@/components/more/moreShared';
import { SUPPORTED_LANGS, type Lang } from '@/config/global';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 每种语言用它自己的文字标注,与开屏语言选择页一致 */
const LANG_LABELS: Record<Lang, string> = {
  'en-US': 'English',
  'my-MM': 'မြန်မာ',
  'zh-CN': '中文',
};

interface Props {
  visible: boolean;
  value: Lang;
  onSelect: (lang: Lang) => void;
  onClose: () => void;
}

export default function LanguageDialog({ visible, value, onSelect, onClose }: Props) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          {SUPPORTED_LANGS.map((l) => (
            <Pressable
              key={l}
              style={({ pressed }) => [styles.option, pressed && moreShared.pressed]}
              onPress={() => onSelect(l)}
            >
              <Text style={[styles.label, l === value && styles.labelOn]}>{LANG_LABELS[l]}</Text>
              <HomeIcon
                name={l === value ? 'checkboxIndeterminate' : 'checkbox'}
                size={20}
                color={l === value ? colors.primary : colors.body}
              />
            </Pressable>
          ))}
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
    padding: 24,
    gap: 16,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
  },
  label: { flexShrink: 1, fontFamily: fonts.inter, fontSize: 16, color: colors.textSoft },
  labelOn: { color: colors.heading },
});
