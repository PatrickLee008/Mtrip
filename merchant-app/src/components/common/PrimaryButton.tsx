import React from 'react';
import { Pressable, StyleSheet, Text, type PressableProps, type TextStyle } from 'react-native';

import { colors, radius } from '@/config/theme';
import { text } from '@/config/typography';

interface PrimaryButtonProps extends PressableProps {
  label: string;
  textStyle?: TextStyle;
}

export default function PrimaryButton({ label, style, disabled, textStyle, ...props }: PrimaryButtonProps) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && !disabled && styles.pressed, typeof style === 'function' ? style({ pressed }) : style]}
    >
      <Text style={[styles.label, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  label: { ...text.button, textAlign: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.86 },
});
