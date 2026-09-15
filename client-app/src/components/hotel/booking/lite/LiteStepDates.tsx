/**
 * 关怀模式 Step 1 · 日期确认(推导自 Figma `Booking Flow` `759:9777` 的 Booking step 1 `224:4368`)
 *
 * 结构与完整模式 `BookingStepDates` 逐块相同:摘要卡 → Selected Dates 日历 →
 * Who's Coming? 人数卡 → Enhance Your Stay 加购卡 → Special Requests,
 * 只是每个元素按 `liteBookingShared` 的换算表放大一档。
 *
 * 改日期只有一个入口:**常驻的 `BookingCalendar`**(复用完整模式那一份,传 `lite`)。
 * 顶部摘要卡的日期胶囊是纯展示 —— 同一件事两个入口反而容易误触,完整模式当初也是这么收的。
 *
 * 人数行与加购卡在别处没有第二个使用者,就地写在本文件,不另开组件文件
 * (与 `LiteRoomCard` 里的 `Meta` 同一处理)。
 */

import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { TEMP_ADDON_COVERS } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import BookingCalendar from '@/components/hotel/booking/BookingCalendar';
import { TINT_BUTTON } from '@/components/hotel/booking/bookingShared';
import {
  formatWeekdayDate,
  nightsBetween,
  nightsLabel,
} from '@/components/hotel/booking/bookingFormat';
import { liteBooking } from '@/components/hotel/booking/lite/liteBookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { BOOKING_ADDONS, type BookingAddonKey } from '@/screens/hotel/bookingDemo';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

interface Props {
  checkIn: string;
  checkOut: string;
  adults: number;
  /** `children` 是 React 保留 prop 名(传数字会被当成子节点),这里改名 */
  childCount: number;
  rooms: number;
  addons: BookingAddonKey[];
  request: string;
  onChangeDates: (checkIn: string, checkOut: string) => void;
  onChangeAdults: (value: number) => void;
  onChangeChildCount: (value: number) => void;
  onToggleAddon: (key: BookingAddonKey) => void;
  onChangeRequest: (value: string) => void;
  /** 保险那张卡的「Add to booking」跳独立页,不在这里就地勾选 */
  onOpenInsurance: () => void;
}

export default function LiteStepDates({
  checkIn,
  checkOut,
  adults,
  childCount,
  rooms,
  addons,
  request,
  onChangeDates,
  onChangeAdults,
  onChangeChildCount,
  onToggleAddon,
  onChangeRequest,
  onOpenInsurance,
}: Props) {
  const { t, i18n } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  const nights = nightsBetween(checkIn, checkOut);

  /** 日历里点日期:已成区间或点到入住日之前 → 重新起头;否则收尾 */
  const pickDate = (key: string) => {
    if (!checkIn || checkOut || key <= checkIn) {
      onChangeDates(key, '');
      return;
    }
    onChangeDates(checkIn, key);
  };

  return (
    <View style={styles.root}>
      <View style={styles.summaryGroup}>
        <View style={liteBooking.card}>
          <View style={styles.summaryRow}>
            <View style={styles.tile}>
              <HomeIcon name="calendarOutline" width={22} height={24} color={colors.primary} />
            </View>
            <View style={liteBooking.flexCol}>
              <Text style={liteBooking.overline}>{t('hotels.booking.dates.duration')}</Text>
              <View style={styles.chipRow}>
                <View style={[styles.chip, liteBooking.flexCol]}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {formatWeekdayDate(checkIn, i18n.language)}
                  </Text>
                </View>
                <View style={styles.arrow}>
                  <HomeIcon name="arrowLeft" size={22} color={colors.primary} />
                </View>
                <View style={[styles.chip, liteBooking.flexCol]}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {checkOut ? formatWeekdayDate(checkOut, i18n.language) : '—'}
                  </Text>
                </View>
              </View>
              <Text style={styles.nights}>{nightsLabel(t, nights)}</Text>
            </View>
          </View>

          <View style={liteBooking.divider} />

          <View style={styles.summaryRow}>
            <View style={styles.tile}>
              <HomeIcon name="travelers" width={26} height={20} color={colors.primary} />
            </View>
            <View style={liteBooking.flexCol}>
              <Text style={liteBooking.overline}>{t('hotels.booking.dates.guestsRooms')}</Text>
              <Text style={styles.summaryValue}>
                {t('hotels.booking.dates.guestsRoomsValue', { adults, rooms })}
              </Text>
            </View>
          </View>
        </View>

        <BookingCalendar checkIn={checkIn} checkOut={checkOut} onPickDate={pickDate} lite />
      </View>

      <View style={styles.section}>
        <Text style={liteBooking.sectionTitle}>{t('hotels.booking.dates.whosComing')}</Text>
        <View style={liteBooking.cardPlain}>
          <CounterRow
            title={t('hotels.booking.dates.adults')}
            hint={t('hotels.booking.dates.adultsHint')}
            value={adults}
            min={1}
            solidPlus
            onChange={onChangeAdults}
          />
          <CounterRow
            title={t('hotels.booking.dates.children')}
            hint={t('hotels.booking.dates.childrenHint')}
            value={childCount}
            divider
            onChange={onChangeChildCount}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={liteBooking.rowBetween}>
          <Text style={[liteBooking.sectionTitle, liteBooking.flexCol]}>
            {t('hotels.booking.dates.enhance')}
          </Text>
          <Text style={styles.optional}>{t('hotels.booking.dates.optional')}</Text>
        </View>
        <View style={styles.addonList}>
          {BOOKING_ADDONS.map((addon) => (
            <AddOn
              key={addon.key}
              cover={addon.cover ? TEMP_ADDON_COVERS[addon.key] : null}
              title={t(`hotels.booking.addons.${addon.key}.title`)}
              desc={t(`hotels.booking.addons.${addon.key}.desc`)}
              price={formatMoney(addon.price, currency)}
              selected={addons.includes(addon.key)}
              addLabel={t('hotels.booking.dates.addToBooking')}
              selectedLabel={t('hotels.booking.dates.selected')}
              onToggle={() => (addon.route ? onOpenInsurance() : onToggleAddon(addon.key))}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={liteBooking.sectionTitle}>{t('hotels.booking.dates.specialRequests')}</Text>
        <View style={liteBooking.cardWhite}>
          <Text style={liteBooking.body}>{t('hotels.booking.dates.requestLabel')}</Text>
          <View style={styles.textarea}>
            <TextInput
              style={styles.textareaInput}
              value={request}
              onChangeText={onChangeRequest}
              placeholder={t('hotels.booking.dates.requestPlaceholder')}
              placeholderTextColor="rgba(116, 118, 134, 0.5)"
              multiline
              textAlignVertical="top"
            />
          </View>
          <View style={styles.noteRow}>
            <HomeIcon name="infoSmall" size={18} color={colors.label} />
            <Text style={[liteBooking.note, liteBooking.flexCol]}>
              {t('hotels.booking.dates.requestNote')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** 「Who's Coming?」的加减行。加号只有 Adults 那行是实心(沿用完整模式的设计稿口径) */
function CounterRow({
  title,
  hint,
  value,
  min = 0,
  max = 30,
  solidPlus = false,
  divider = false,
  onChange,
}: {
  title: string;
  hint: string;
  value: number;
  min?: number;
  max?: number;
  solidPlus?: boolean;
  divider?: boolean;
  onChange: (value: number) => void;
}) {
  const canMinus = value > min;
  const canPlus = value < max;

  return (
    <View style={[styles.counterRow, divider && styles.counterDivider]}>
      <View style={liteBooking.flexCol}>
        <Text style={liteBooking.itemTitle}>{title}</Text>
        <Text style={liteBooking.note}>{hint}</Text>
      </View>

      <View style={styles.counterControls}>
        <Pressable
          style={({ pressed }) => [
            styles.circle,
            styles.circleOutline,
            !canMinus && styles.circleDisabled,
            pressed && canMinus && liteBooking.pressed,
          ]}
          disabled={!canMinus}
          onPress={() => onChange(value - 1)}
          hitSlop={6}
        >
          <HomeIcon
            name="minus"
            width={20}
            height={3}
            color={canMinus ? colors.primary : colors.label}
          />
        </Pressable>

        <Text style={styles.counterValue}>{value}</Text>

        <Pressable
          style={({ pressed }) => [
            styles.circle,
            solidPlus ? styles.circleSolid : styles.circleOutline,
            !canPlus && styles.circleDisabled,
            pressed && canPlus && liteBooking.pressed,
          ]}
          disabled={!canPlus}
          onPress={() => onChange(value + 1)}
          hitSlop={6}
        >
          <HomeIcon name="plus" size={20} color={solidPlus ? '#FFFFFF' : colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

/** 「Enhance Your Stay」的一张加购卡(保险那张没有封面,结构一样) */
function AddOn({
  cover,
  title,
  desc,
  price,
  selected,
  addLabel,
  selectedLabel,
  onToggle,
}: {
  cover?: ImageSourcePropType | null;
  title: string;
  desc: string;
  price: string;
  selected: boolean;
  addLabel: string;
  selectedLabel: string;
  onToggle: () => void;
}) {
  return (
    <View style={liteBooking.cardPlain}>
      {cover ? (
        <View style={styles.cover}>
          <Image source={cover} style={styles.coverImage} resizeMode="cover" />
        </View>
      ) : null}

      <View style={styles.addonBody}>
        <View style={styles.addonTitleRow}>
          <Text style={[liteBooking.itemTitle, liteBooking.flexCol]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.addonPrice}>{price}</Text>
        </View>
        <Text style={liteBooking.body}>{desc}</Text>

        <Pressable
          style={({ pressed }) => [
            selected ? liteBooking.primaryBtn : liteBooking.tintBtn,
            pressed && liteBooking.pressed,
          ]}
          onPress={onToggle}
        >
          {selected ? (
            <HomeIcon name="checkSlim" width={16} height={12} color="#FFFFFF" />
          ) : (
            <HomeIcon name="plus" size={16} color={colors.primary} />
          )}
          <Text style={selected ? liteBooking.primaryBtnText : liteBooking.tintBtnText}>
            {selected ? selectedLabel : addLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  summaryGroup: { gap: 16 },
  section: { gap: 16 },

  /* ---- 摘要卡 ---- */
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tile: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: TINT_BUTTON,
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.pageBg },
  chipText: { fontFamily: fonts.interSemi, fontSize: 18, lineHeight: 28, color: colors.heading },
  /* 设计稿这枚是 arrow-left 旋转 180° */
  arrow: { transform: [{ rotate: '180deg' }] },
  nights: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft },
  summaryValue: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.heading },

  /* ---- 人数行 ---- */
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 24,
  },
  counterDivider: { borderTopWidth: 1, borderTopColor: 'rgba(211, 228, 254, 0.3)' },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  circle: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  circleOutline: { borderWidth: 1, borderColor: colors.primary },
  circleSolid: { backgroundColor: colors.primary },
  circleDisabled: { opacity: 0.5, borderColor: 'rgba(116, 118, 134, 0.3)' },
  counterValue: {
    minWidth: 32,
    fontFamily: fonts.interBold,
    fontSize: 32,
    lineHeight: 40,
    textAlign: 'center',
    color: colors.heading,
  },

  /* ---- 加购卡 ---- */
  optional: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 28, color: colors.primary },
  addonList: { gap: 24 },
  cover: { height: 200, width: '100%', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  addonBody: { padding: 24, gap: 12 },
  addonTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  addonPrice: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 32, color: colors.primary },

  /* ---- 特殊要求 ---- */
  textarea: {
    minHeight: 132,
    padding: 16,
    borderRadius: radius.btn,
    backgroundColor: 'rgba(229, 238, 255, 0.5)',
  },
  textareaInput: {
    flex: 1,
    padding: 0,
    fontFamily: fonts.inter,
    fontSize: 20,
    lineHeight: 28,
    color: colors.heading,
  },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
