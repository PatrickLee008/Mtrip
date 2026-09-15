/**
 * 关怀模式 Step 2 · 旅客信息(推导自 `Booking Flow` `759:9777` 的 Booking step 2 `224:4808`)
 *
 * 结构与完整模式 `BookingStepGuests` 同:标题行(头像 + Lead Guest + Select)→ 表单卡 →
 * Additional Guests 折叠入口 → Secure Booking 提示条,字号整体大一档。
 *
 * 与完整版的**唯一取舍**:完整版在表单卡外还有一枚整宽的主色「Save Info」按钮
 * (设计稿里 Save Info 出现了两次:卡内勾选框 + 卡外按钮,当时照原样都留着)。
 * 关怀版只留卡内那个勾选框 —— 一屏上两个同名控件、其中一个还只是 comingSoon,
 * 对关怀模式用户是纯粹的干扰。勾选框本身行为不变。
 *
 * 「Select」跳已有的常用旅客页 `Travelers`(pick 模式);折叠卡是「新增旅客」入口(`AddGuest`)。
 * 两个子页复用完整模式那两个路由,不另做 Lite 版。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import {
  AVATAR_BG,
  CARD_HEADING,
  DEEP_PRIMARY,
  FORM_TEXT,
  PAY_TILE_BG,
  PLACEHOLDER,
  TINT_BUTTON,
} from '@/components/hotel/booking/bookingShared';
import { liteBooking } from '@/components/hotel/booking/lite/liteBookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { LeadGuestForm } from '@/screens/hotel/bookingDemo';

interface Props {
  form: LeadGuestForm;
  /** 还能再加几位同行人(设计稿写死 2) */
  additionalQuota: number;
  onChange: (patch: Partial<LeadGuestForm>) => void;
  onSelectTraveler: () => void;
  onAddGuest: () => void;
  /** 区号选择等未实现动作 */
  onComingSoon: () => void;
}

export default function LiteStepGuests({
  form,
  additionalQuota,
  onChange,
  onSelectTraveler,
  onAddGuest,
  onComingSoon,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <View style={liteBooking.rowBetween}>
        <View style={styles.headLeft}>
          <View style={styles.avatar}>
            <HomeIcon name="personSmall" size={22} color={DEEP_PRIMARY} />
          </View>
          <Text style={[liteBooking.sectionTitle, liteBooking.flexCol]} numberOfLines={1}>
            {t('hotels.booking.guests.leadGuest')}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.selectBtn, pressed && liteBooking.pressed]}
          onPress={onSelectTraveler}
          hitSlop={6}
        >
          <Text style={styles.selectText}>{t('hotels.booking.guests.select')}</Text>
          <HomeIcon name="peopleAdd" size={24} color={colors.heading} />
        </Pressable>
      </View>

      <View style={liteBooking.card}>
        <Field
          label={t('hotels.booking.guests.firstName')}
          required
          value={form.firstName}
          placeholder={t('hotels.booking.guests.firstNamePlaceholder')}
          onChangeText={(v) => onChange({ firstName: v })}
        />
        <Field
          label={t('hotels.booking.guests.lastName')}
          required
          value={form.lastName}
          placeholder={t('hotels.booking.guests.lastNamePlaceholder')}
          onChangeText={(v) => onChange({ lastName: v })}
        />

        <View style={liteBooking.field}>
          <Label label={t('hotels.booking.guests.phone')} required />
          <View style={styles.phoneRow}>
            {/* 区号固定 +95,选择器未实现 */}
            <Pressable
              style={({ pressed }) => [
                liteBooking.control,
                styles.dialCode,
                pressed && liteBooking.pressed,
              ]}
              onPress={onComingSoon}
            >
              <Text style={liteBooking.controlText}>+95</Text>
              <HomeIcon name="caretDown" size={24} color={colors.textSoft} />
            </Pressable>
            <View style={[liteBooking.control, liteBooking.flexCol]}>
              <TextInput
                style={liteBooking.controlText}
                value={form.phone}
                onChangeText={(v) => onChange({ phone: v })}
                placeholder={t('hotels.booking.guests.phonePlaceholder')}
                placeholderTextColor={PLACEHOLDER}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        <View style={liteBooking.field}>
          <Field
            label={t('hotels.booking.guests.email')}
            required
            value={form.email}
            placeholder={t('hotels.booking.guests.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={(v) => onChange({ email: v })}
          />
          <View style={styles.noteRow}>
            <HomeIcon name="infoSmall" size={18} color={FORM_TEXT} />
            <Text style={[liteBooking.note, liteBooking.flexCol]}>
              {t('hotels.booking.guests.emailNote')}
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.checkRow, pressed && liteBooking.pressed]}
          onPress={() => onChange({ saveInfo: !form.saveInfo })}
          hitSlop={6}
        >
          <HomeIcon
            name={form.saveInfo ? 'checkboxIndeterminate' : 'checkbox'}
            size={28}
            color={form.saveInfo ? colors.primary : colors.softBlue}
          />
          <Text style={styles.checkLabel}>{t('hotels.booking.guests.saveInfo')}</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.additional, pressed && liteBooking.pressed]}
        onPress={onAddGuest}
      >
        <View style={styles.headLeft}>
          <View style={styles.additionalIcon}>
            <HomeIcon name="peopleDuo" width={28} height={19} color={FORM_TEXT} />
          </View>
          <View style={liteBooking.flexCol}>
            <Text style={liteBooking.itemTitle}>{t('hotels.booking.guests.additional')}</Text>
            <Text style={liteBooking.note}>
              {t('hotels.booking.guests.additionalHint', { guests: additionalQuota })}
            </Text>
          </View>
        </View>
        <HomeIcon name="chevronDown" width={16} height={10} color={FORM_TEXT} />
      </Pressable>

      <View style={styles.secure}>
        <HomeIcon name="shieldLock" width={20} height={25} color={DEEP_PRIMARY} />
        <View style={liteBooking.flexCol}>
          <Text style={styles.secureTitle}>{t('hotels.booking.guests.secureTitle')}</Text>
          <Text style={liteBooking.note}>{t('hotels.booking.guests.secureDesc')}</Text>
        </View>
      </View>
    </View>
  );
}

function Label({ label, required }: { label: string; required?: boolean }) {
  return (
    <View style={liteBooking.labelRow}>
      <Text style={liteBooking.fieldLabel}>{label}</Text>
      {required ? <Text style={liteBooking.required}>*</Text> : null}
    </View>
  );
}

function Field({
  label,
  required,
  value,
  placeholder,
  keyboardType,
  autoCapitalize,
  onChangeText,
}: {
  label: string;
  required?: boolean;
  value: string;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={liteBooking.field}>
      <Label label={label} required={required} />
      <View style={liteBooking.control}>
        <TextInput
          style={liteBooking.controlText}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={PLACEHOLDER}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },

  headLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: AVATAR_BG,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(78, 115, 255, 0.1)',
  },
  selectText: { fontFamily: fonts.interSemi, fontSize: 18, lineHeight: 24, color: colors.heading },

  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dialCode: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12 },

  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 4 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkLabel: { fontFamily: fonts.inter, fontSize: 20, lineHeight: 28, color: FORM_TEXT },

  additional: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },
  additionalIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: PAY_TILE_BG,
  },

  secure: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 24,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(32, 77, 218, 0.2)',
    backgroundColor: TINT_BUTTON,
  },
  secureTitle: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 28, color: CARD_HEADING },
});
