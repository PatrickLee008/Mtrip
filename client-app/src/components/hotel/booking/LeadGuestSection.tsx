/**
 * 主要入住人:标题行(40 圆头像 + Lead Guest + 右上 Select)+ 表单卡。
 *
 * 旅客信息步(设计稿 1675:6292)与多房间第 1 步「日期与住客信息」(新稿 2659:12801)共用,
 * 两稿这一块逐像素相同。返回两个兄弟节点(Fragment),标题与表单卡之间的间距由父容器的 gap 决定 ——
 * 旅客信息步是 24,多房间第 1 步与摘要卡同组是 16。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { FormInput } from '@/components/hotel/booking/FormField';
import {
  AVATAR_BG,
  DEEP_PRIMARY,
  FORM_TEXT,
  PLACEHOLDER,
  bookingShared,
} from '@/components/hotel/booking/bookingShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { LeadGuestForm } from '@/screens/hotel/bookingDemo';

interface Props {
  form: LeadGuestForm;
  onChange: (patch: Partial<LeadGuestForm>) => void;
  onSelectTraveler: () => void;
  /** 区号选择等未实现动作 */
  onComingSoon: () => void;
}

export default function LeadGuestSection({ form, onChange, onSelectTraveler, onComingSoon }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <View style={styles.avatar}>
            <HomeIcon name="personSmall" size={16} color={DEEP_PRIMARY} />
          </View>
          <Text style={bookingShared.sectionTitle}>{t('hotels.booking.guests.leadGuest')}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.selectBtn, pressed && bookingShared.pressed]}
          onPress={onSelectTraveler}
        >
          <Text style={styles.selectText}>{t('hotels.booking.guests.select')}</Text>
          <HomeIcon name="peopleAdd" size={20} color={colors.heading} />
        </Pressable>
      </View>

      <View style={bookingShared.panel}>
        <View style={styles.form}>
          <FormInput
            label={t('hotels.booking.guests.firstName')}
            required
            value={form.firstName}
            onChangeText={(v) => onChange({ firstName: v })}
            placeholder={t('hotels.booking.guests.firstNamePlaceholder')}
          />
          <FormInput
            label={t('hotels.booking.guests.lastName')}
            required
            value={form.lastName}
            onChangeText={(v) => onChange({ lastName: v })}
            placeholder={t('hotels.booking.guests.lastNamePlaceholder')}
          />

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={bookingShared.fieldLabel}>{t('hotels.booking.guests.phone')}</Text>
              <Text style={bookingShared.required}>*</Text>
            </View>
            <View style={styles.phoneRow}>
              {/* 区号固定 +95,选择器未实现 */}
              <Pressable
                style={({ pressed }) => [
                  bookingShared.control,
                  styles.dialCode,
                  pressed && bookingShared.pressed,
                ]}
                onPress={onComingSoon}
              >
                <Text style={bookingShared.controlText}>+95</Text>
                <HomeIcon name="caretDown" size={24} color={colors.textSoft} />
              </Pressable>
              <View style={[bookingShared.control, styles.flex]}>
                <TextInput
                  style={bookingShared.controlText}
                  value={form.phone}
                  onChangeText={(v) => onChange({ phone: v })}
                  placeholder={t('hotels.booking.guests.phonePlaceholder')}
                  placeholderTextColor={PLACEHOLDER}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>

          <View style={styles.field}>
            <FormInput
              label={t('hotels.booking.guests.email')}
              required
              value={form.email}
              onChangeText={(v) => onChange({ email: v })}
              placeholder={t('hotels.booking.guests.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.emailNote}>
              <HomeIcon name="infoSmall" size={13.333} color={FORM_TEXT} />
              <Text style={styles.emailNoteText}>{t('hotels.booking.guests.emailNote')}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.checkRow, pressed && bookingShared.pressed]}
            onPress={() => onChange({ saveInfo: !form.saveInfo })}
          >
            <HomeIcon
              name={form.saveInfo ? 'checkboxIndeterminate' : 'checkbox'}
              size={20}
              color={form.saveInfo ? colors.primary : colors.softBlue}
            />
            <Text style={styles.checkLabel}>{t('hotels.booking.guests.saveInfo')}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: AVATAR_BG,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(78, 115, 255, 0.1)',
  },
  selectText: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 32, color: colors.heading },

  form: { gap: 16 },
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 4 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dialCode: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 13 },

  emailNote: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  emailNoteText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    fontStyle: 'italic',
    color: FORM_TEXT,
  },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: FORM_TEXT },
});
