/**
 * Step 2 · 旅客信息(设计稿 1675:6292)
 *
 * 结构:标题行(40 圆头像 + Lead Guest + 右上 Select)→ 表单卡 → 整宽 Save Info →
 *      Additional Guests 折叠卡 → Secure Booking 提示条。
 *
 * 设计稿的「Save Info」出现了两次(卡内勾选框 + 卡外整宽主色按钮),这里照原样都留着:
 * 勾选框是「记住这份资料」的开关,按钮是显式保存动作(静态页阶段走 comingSoon)。
 * 「Select」跳已有的常用旅客页 `Travelers`;折叠卡展开后是「新增旅客」入口(路由 `AddGuest`)。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { FormInput } from '@/components/hotel/booking/FormField';
import {
  AVATAR_BG,
  CARD_HEADING,
  DEEP_PRIMARY,
  FORM_TEXT,
  PAY_TILE_BG,
  PLACEHOLDER,
  TINT_BUTTON,
  bookingShared,
} from '@/components/hotel/booking/bookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

export interface LeadGuestForm {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  saveInfo: boolean;
}

interface Props {
  form: LeadGuestForm;
  /** 还能再加几位同行人(设计稿写死 2) */
  additionalQuota: number;
  onChange: (patch: Partial<LeadGuestForm>) => void;
  onSelectTraveler: () => void;
  onAddGuest: () => void;
  onSaveInfo: () => void;
  /** 区号选择等未实现动作 */
  onComingSoon: () => void;
}

export default function BookingStepGuests({
  form,
  additionalQuota,
  onChange,
  onSelectTraveler,
  onAddGuest,
  onSaveInfo,
  onComingSoon,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
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

      <Pressable
        style={({ pressed }) => [styles.saveBtn, pressed && bookingShared.pressed]}
        onPress={onSaveInfo}
      >
        <Text style={styles.saveText}>{t('hotels.booking.guests.saveInfo')}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [bookingShared.panelPlain, styles.additional, pressed && bookingShared.pressed]}
        onPress={onAddGuest}
      >
        <View style={styles.headLeft}>
          <View style={styles.additionalIcon}>
            <HomeIcon name="peopleDuo" width={24} height={16} color={FORM_TEXT} />
          </View>
          <View>
            <Text style={styles.additionalTitle}>{t('hotels.booking.guests.additional')}</Text>
            <Text style={styles.additionalHint}>
              {t('hotels.booking.guests.additionalHint', { guests: additionalQuota })}
            </Text>
          </View>
        </View>
        <HomeIcon name="chevronDown" width={12} height={7.4} color={FORM_TEXT} />
      </Pressable>

      <View style={styles.secure}>
        <HomeIcon name="shieldLock" width={16} height={20} color={DEEP_PRIMARY} />
        <View style={styles.flex}>
          <Text style={styles.secureTitle}>{t('hotels.booking.guests.secureTitle')}</Text>
          <Text style={styles.secureDesc}>{t('hotels.booking.guests.secureDesc')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
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

  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  saveText: {
    fontFamily: fonts.outfit,
    fontSize: 16,
    lineHeight: 28,
    textAlign: 'center',
    color: '#FFFFFF',
  },

  additional: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 24,
  },
  additionalIcon: {
    width: 39.19,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: PAY_TILE_BG,
  },
  additionalTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    color: CARD_HEADING,
  },
  additionalHint: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: FORM_TEXT,
  },

  secure: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 17,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(32, 77, 218, 0.2)',
    backgroundColor: TINT_BUTTON,
  },
  secureTitle: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: CARD_HEADING,
  },
  secureDesc: { fontFamily: fonts.inter, fontSize: 13, lineHeight: 19.5, color: FORM_TEXT },
});
