/**
 * 订房流程的表单字段(设计稿 1675:6316 起「Lead Traveler Form」/ 1675:5796「Add New Guest」)
 *
 * 三种形态共用同一套壳(label + 高 56、圆角 12、1px `--secondary` 的控件):
 *   `FormInput`  普通输入框(placeholder `#6B7280`)
 *   `FormSelect` 下拉,右侧一枚 24 的描边箭头(设计稿是 image 节点,不是实心 chevron)
 *   `FormAction` 点开二级浮层的行(出生日期那种,右侧箭头朝右)
 *
 * label 是「文案 + 红星」两段,必填才渲染星号(设计稿 `--tertiary`)。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import HomeIcon from '@/components/home/HomeIcon';
import { PLACEHOLDER, bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors } from '@/config/theme';

interface LabelProps {
  label: string;
  required?: boolean;
}

export function FormLabel({ label, required }: LabelProps) {
  return (
    <View style={styles.labelRow}>
      <Text style={bookingShared.fieldLabel}>{label}</Text>
      {required ? <Text style={bookingShared.required}>*</Text> : null}
    </View>
  );
}

interface InputProps extends LabelProps, Omit<TextInputProps, 'style'> {}

export function FormInput({ label, required, ...input }: InputProps) {
  return (
    <View style={styles.field}>
      <FormLabel label={label} required={required} />
      <View style={bookingShared.control}>
        <TextInput
          style={bookingShared.controlText}
          placeholderTextColor={PLACEHOLDER}
          {...input}
        />
      </View>
    </View>
  );
}

interface SelectProps extends LabelProps {
  /** 已选值;为空时按 placeholder 渲染 */
  value?: string | null;
  placeholder: string;
  onPress: () => void;
  /** 出生日期那种点开二级浮层的行,箭头朝右 */
  action?: boolean;
}

export function FormSelect({ label, required, value, placeholder, onPress, action }: SelectProps) {
  return (
    <View style={styles.field}>
      <FormLabel label={label} required={required} />
      <Pressable
        style={({ pressed }) => [
          bookingShared.control,
          styles.selectRow,
          pressed && bookingShared.pressed,
        ]}
        onPress={onPress}
      >
        <Text
          style={[bookingShared.controlText, styles.flex, !value && bookingShared.controlPlaceholder]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        {/* 设计稿的下拉箭头是描边字形;action 行是同一枚旋转 -90° 变成朝右 */}
        <View style={action ? styles.caretRight : undefined}>
          <HomeIcon name="caretDown" size={24} color={colors.textSoft} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 4 },
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  caretRight: { transform: [{ rotate: '-90deg' }] },
});
