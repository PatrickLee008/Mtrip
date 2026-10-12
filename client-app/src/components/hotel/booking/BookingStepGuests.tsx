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
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import LeadGuestSection from '@/components/hotel/booking/LeadGuestSection';
import {
  CARD_HEADING,
  DEEP_PRIMARY,
  FORM_TEXT,
  PAY_TILE_BG,
  TINT_BUTTON,
  bookingShared,
} from '@/components/hotel/booking/bookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { LeadGuestForm } from '@/screens/hotel/bookingDemo';

/* 表单形状与关怀模式共用一份(`bookingDemo.ts`),这里转出去保持原有引用路径可用 */
export type { LeadGuestForm };

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
      <LeadGuestSection
        form={form}
        onChange={onChange}
        onSelectTraveler={onSelectTraveler}
        onComingSoon={onComingSoon}
      />

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

  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },

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
