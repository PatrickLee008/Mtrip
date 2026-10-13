/**
 * 多房间 Step 1 · 日期与住客信息(新稿 2659:12801,四步收成三步:原「确认日期」+「旅客信息」合并)
 *
 * 结构:摘要卡(入住时长 / 人数与间数,只读)→ Lead Guest 标题 + 表单卡 → Special Requests → Enhance Your Stay。
 * 摘要卡、标题与表单卡同组 gap 16,区块之间 gap 24(稿面 Main gap 24,「Summary & Date Picker Section」gap 16)。
 *
 * 日期与间数在多房间链路里来自购物车(详情页 / 购物车页已选定),所以这里不再放日历和人数加减器 ——
 * 在向导里改日期会让车里的房型与库存对不上。
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import BookingSummaryBar from '@/components/hotel/booking/BookingSummaryBar';
import LeadGuestSection from '@/components/hotel/booking/LeadGuestSection';
import { AddOnsSection, SpecialRequestsSection } from '@/components/hotel/booking/StayExtras';
import type { HotelAddon } from '@/types/models';
import {
  formatWeekdayDate,
  nightsBetween,
  nightsLabel,
} from '@/components/hotel/booking/bookingFormat';
import type { BookingAddonKey, LeadGuestForm } from '@/screens/hotel/bookingDemo';

interface Props {
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
  form: LeadGuestForm;
  onChangeForm: (patch: Partial<LeadGuestForm>) => void;
  onSelectTraveler: () => void;
  request: string;
  onChangeRequest: (value: string) => void;
  addons: BookingAddonKey[];
  onToggleAddon: (key: BookingAddonKey) => void;
  onOpenInsurance: () => void;
  /** 真实酒店的附加服务选项;null = 演示模式(设计稿三张卡) */
  addonOptions?: HotelAddon[] | null;
  onComingSoon: () => void;
}

export default function BookingStepDetails({
  checkIn,
  checkOut,
  adults,
  rooms,
  form,
  onChangeForm,
  onSelectTraveler,
  request,
  onChangeRequest,
  addons,
  onToggleAddon,
  onOpenInsurance,
  addonOptions = null,
  onComingSoon,
}: Props) {
  const { t, i18n } = useTranslation();

  return (
    <View style={styles.root}>
      <View style={styles.group}>
        <BookingSummaryBar
          checkInLabel={formatWeekdayDate(checkIn, i18n.language)}
          checkOutLabel={checkOut ? formatWeekdayDate(checkOut, i18n.language) : '—'}
          nightsLabel={nightsLabel(t, nightsBetween(checkIn, checkOut))}
          guestsLabel={t('hotels.booking.dates.guestsRoomsValue', { adults, rooms })}
        />
        <LeadGuestSection
          form={form}
          onChange={onChangeForm}
          onSelectTraveler={onSelectTraveler}
          onComingSoon={onComingSoon}
        />
      </View>

      <SpecialRequestsSection request={request} onChangeRequest={onChangeRequest} />

      <AddOnsSection addons={addons} options={addonOptions} onToggleAddon={onToggleAddon} onOpenInsurance={onOpenInsurance} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  group: { gap: 16 },
});
