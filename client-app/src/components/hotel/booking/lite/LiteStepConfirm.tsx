/**
 * 关怀模式订房 Step 1 · Confirm Your Room & Date(Figma `2540:19394`)
 *
 * 新稿把旧的三步(日期 `dates` / 住客 `guests` / 复核 `review`)合成这一屏:
 * 房型摘要卡 → Guest Info 表单 → Add On Service 折叠条 → Cancellation Policy。
 *
 * 设计稿实测:
 *   房型卡   `2540:19406` 白底 1px --secondary 圆角 24 投影 0/1/2;内层 p24 gap12
 *            房型名 Outfit 600 24/24 + 「N Room ▾」主色药丸(圆角 12 px8 py4,Inter 600 16/24 白)
 *            日期行 20 日历图标 + Inter 500 16/24 --text-2
 *            住客行 people + 「N Guests」/ bed + 床型,同字号
 *   表单卡   `2540:19537` --tab 底 圆角 24 padding 25 gap16
 *            标题 Inter 600 20/32 + 「Select 👥」药丸(rgba(78,115,255,.1) 圆角 8 px8 py4)
 *            输入框高 56 圆角 12 1px --secondary;Full Name 的占位里 `*` 是 --tertiary 红
 *            区号固定 +95(选择器未实现,同完整模式)
 *            邮箱默认收起成一行主色链接,点开才出输入框 + 斜体提示
 *   加购条   `2540:19593` --secondary 底 1px 主色 圆角 24 px24 py8 投影 DS_AG
 *   退改卡   `2540:19595` --tab 底、**左侧 4px 主色竖条**、圆角 24、pl16 pr12 py12
 *
 * **两处「稿上是只读、这里可点」**(用户确认):日期行点开 `DatePickerSheet`、
 * 「N Room」药丸与住客行点开 `GuestRoomSheet` —— 新稿没画改日期/改人数的入口,
 * 但进了订房页才发现日期错了却只能退两层,实际用不了。弹层都是现成的,不新写。
 *
 * **「View More」是就地展开**,展开后是加购卡列表(含保险那张,点它跳 `Insurance` 独立页),
 * 不是跳新页 —— 否则保险与加购两条既有链路会断。
 */

import React, { useEffect, useRef, useState } from 'react';
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
import { formatDayMonth, nightsBetween, nightsLabel } from '@/components/hotel/booking/bookingFormat';
import { CARD_HEADING, FORM_TEXT, PLACEHOLDER, TINT_CHIP } from '@/components/hotel/booking/bookingShared';
import { liteBooking } from '@/components/hotel/booking/lite/liteBookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import {
  BOOKING_ADDONS,
  type BookingAddonKey,
  type LeadGuestForm,
} from '@/screens/hotel/bookingDemo';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

interface Props {
  roomName: string;
  rooms: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  /** `children` 是 React 保留 prop 名,这里改名 */
  childCount: number;
  /** 房型床型文案;接口没给就不画那一格 */
  bedType?: string | null;
  form: LeadGuestForm;
  onChangeForm: (patch: Partial<LeadGuestForm>) => void;
  addons: BookingAddonKey[];
  onToggleAddon: (key: BookingAddonKey) => void;
  /** 退改说明(由页面按真实 `refundRules` 算好后传进来) */
  cancellationDesc: string;
  onOpenDates: () => void;
  onOpenGuests: () => void;
  onSelectTraveler: () => void;
  onOpenInsurance: () => void;
  onComingSoon: () => void;
}

export default function LiteStepConfirm({
  roomName,
  rooms,
  checkIn,
  checkOut,
  adults,
  childCount,
  bedType,
  form,
  onChangeForm,
  addons,
  onToggleAddon,
  cancellationDesc,
  onOpenDates,
  onOpenGuests,
  onSelectTraveler,
  onOpenInsurance,
  onComingSoon,
}: Props) {
  const { t, i18n } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  /** 邮箱默认收起(设计稿的 Variant2),点「+ Add Email」才展开;已有值就直接展开 */
  const [emailOpen, setEmailOpen] = useState(Boolean(form.email));
  /** 加购区默认收起,点「View More」展开 */
  const [addonOpen, setAddonOpen] = useState(false);

  /**
   * 设计稿只有一栏 Full Name,数据层仍是 `firstName` / `lastName`(后端 `travelers` 两栏都收)。
   * 这里用一份本地草稿承接输入,**按第一个空格拆分**回写;外部改动(自动带入默认常旅客、
   * 从常旅客页选回来)再同步回草稿 —— `pushed` 记住自己刚推上去的值,避免来回打架。
   */
  const joined = [form.firstName, form.lastName].filter(Boolean).join(' ');
  const [fullName, setFullName] = useState(joined);
  const pushed = useRef(joined);
  useEffect(() => {
    if (joined === pushed.current) return;
    pushed.current = joined;
    setFullName(joined);
  }, [joined]);

  const changeFullName = (text: string) => {
    setFullName(text);
    const trimmed = text.trim();
    const gap = trimmed.indexOf(' ');
    const firstName = gap < 0 ? trimmed : trimmed.slice(0, gap);
    const lastName = gap < 0 ? '' : trimmed.slice(gap + 1).trim();
    pushed.current = [firstName, lastName].filter(Boolean).join(' ');
    onChangeForm({ firstName, lastName });
  };

  const nights = nightsBetween(checkIn, checkOut);
  const dateLabel = checkOut
    ? t('hotels.booking.lite.dateRange', {
        checkIn: formatDayMonth(checkIn, i18n.language),
        checkOut: formatDayMonth(checkOut, i18n.language),
        nights: nightsLabel(t, nights),
      })
    : formatDayMonth(checkIn, i18n.language);

  return (
    <View style={styles.root}>
      {/* ---------------------------------------------------------- 房型摘要卡 */}
      <View style={styles.roomCard}>
        <View style={liteBooking.rowBetween}>
          <Text style={styles.roomName} numberOfLines={1}>
            {roomName}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.roomsPill, pressed && liteBooking.pressed]}
            onPress={onOpenGuests}
            hitSlop={6}
          >
            {/* 复数走仓库既有写法:嵌套 one/many 自己挑,不用 i18next 的复数后缀
                (本项目 `compatibilityJSON: 'v3'`,与 `nightsLabel` 同一处理) */}
            <Text style={styles.roomsPillText}>
              {rooms === 1
                ? t('hotels.booking.lite.roomsValue.one')
                : t('hotels.booking.lite.roomsValue.many', { count: rooms })}
            </Text>
            <HomeIcon name="caretDown" size={12} color="#FFFFFF" />
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [liteBooking.row, pressed && liteBooking.pressed]}
          onPress={onOpenDates}
          hitSlop={4}
        >
          <HomeIcon name="calendar" size={20} color={colors.textSoft} />
          <Text style={[liteBooking.body, liteBooking.flexCol]} numberOfLines={1}>
            {dateLabel}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.metaRow, pressed && liteBooking.pressed]}
          onPress={onOpenGuests}
          hitSlop={4}
        >
          <View style={styles.meta}>
            <HomeIcon name="people" size={16} color={colors.textSoft} />
            <Text style={liteBooking.body}>
              {t('hotels.lite.guestsCount', { count: adults + childCount })}
            </Text>
          </View>
          {bedType ? (
            <View style={styles.meta}>
              <HomeIcon name="bedSize" size={16} color={colors.textSoft} />
              <Text style={liteBooking.body} numberOfLines={1}>
                {bedType}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* ---------------------------------------------------------- Guest Info */}
      <View style={styles.formCard}>
        <View style={liteBooking.rowBetween}>
          <Text style={liteBooking.cardTitle}>{t('hotels.booking.lite.guestInfo')}</Text>
          <Pressable
            style={({ pressed }) => [styles.selectPill, pressed && liteBooking.pressed]}
            onPress={onSelectTraveler}
            hitSlop={6}
          >
            <Text style={styles.selectPillText}>{t('hotels.booking.guests.select')}</Text>
            <HomeIcon name="peopleAdd" size={16} color={colors.heading} />
          </Pressable>
        </View>

        {/* Full Name:占位文字里的 `*` 要是红的,RN 的 placeholder 没法分段着色,
            所以空值时改画一层不吃点击的覆盖文本 */}
        <View style={liteBooking.control}>
          <TextInput
            style={liteBooking.controlText}
            value={fullName}
            onChangeText={changeFullName}
            autoCapitalize="words"
          />
          {fullName.length === 0 ? (
            <View style={styles.placeholderRow} pointerEvents="none">
              <Text style={styles.placeholderText}>{t('hotels.booking.lite.fullName')}</Text>
              <Text style={styles.required}>*</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.phoneRow}>
          {/* 区号固定 +95,选择器未实现(同完整模式) */}
          <Pressable
            style={({ pressed }) => [
              liteBooking.control,
              styles.dialCode,
              pressed && liteBooking.pressed,
            ]}
            onPress={onComingSoon}
          >
            <Text style={styles.dialText}>+95</Text>
            <HomeIcon name="caretDown" size={16} color={colors.textSoft} />
          </Pressable>
          <View style={[liteBooking.control, liteBooking.flexCol]}>
            <TextInput
              style={liteBooking.controlText}
              value={form.phone}
              onChangeText={(v) => onChangeForm({ phone: v })}
              placeholder={t('hotels.booking.guests.phonePlaceholder')}
              placeholderTextColor={colors.textSoft}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {emailOpen ? (
          <View style={styles.emailGroup}>
            <View style={liteBooking.control}>
              <TextInput
                style={liteBooking.controlText}
                value={form.email}
                onChangeText={(v) => onChangeForm({ email: v })}
                placeholder={t('hotels.booking.guests.emailPlaceholder')}
                placeholderTextColor={PLACEHOLDER}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.emailNoteRow}>
              <HomeIcon name="infoSmall" size={14} color={FORM_TEXT} />
              <Text style={[styles.emailNote, liteBooking.flexCol]}>
                {t('hotels.booking.lite.emailHint')}
              </Text>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setEmailOpen(true)} hitSlop={6}>
            {({ pressed }) => (
              <Text style={[styles.addEmail, pressed && liteBooking.pressed]}>
                {t('hotels.booking.lite.addEmail')}
              </Text>
            )}
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.checkRow, pressed && liteBooking.pressed]}
          onPress={() => onChangeForm({ saveInfo: !form.saveInfo })}
          hitSlop={6}
        >
          <HomeIcon
            name={form.saveInfo ? 'checkboxIndeterminate' : 'checkbox'}
            size={20}
            color={form.saveInfo ? colors.primary : colors.softBlue}
          />
          <Text style={styles.checkLabel}>{t('hotels.booking.lite.rememberInfo')}</Text>
        </Pressable>
      </View>

      {/* ------------------------------------------------------ Add On Service */}
      <View style={styles.addonGroup}>
        <Pressable
          style={({ pressed }) => [liteBooking.foldBar, pressed && liteBooking.pressed]}
          onPress={() => setAddonOpen((v) => !v)}
        >
          <Text style={liteBooking.cardTitle}>{t('hotels.booking.lite.addOnService')}</Text>
          <Text style={liteBooking.link}>
            {t(addonOpen ? 'hotels.booking.lite.viewLess' : 'hotels.booking.lite.viewMore')}
          </Text>
        </Pressable>

        {addonOpen
          ? BOOKING_ADDONS.map((addon) => (
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
            ))
          : null}
      </View>

      {/* --------------------------------------------------- Cancellation Policy */}
      <View style={styles.policyCard}>
        <HomeIcon name="infoCircle" size={20} color={colors.primary} />
        <View style={liteBooking.flexCol}>
          <Text style={styles.policyTitle}>{t('hotels.booking.review.cancellationPolicy')}</Text>
          <Text style={liteBooking.note}>{cancellationDesc}</Text>
        </View>
      </View>
    </View>
  );
}

/** 「Add On Service」展开后的一张加购卡(保险那张没有封面,结构一样) */
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
      {cover ? <Image source={cover} style={styles.addonCover} resizeMode="cover" /> : null}
      <View style={styles.addonBody}>
        <View style={liteBooking.rowBetween}>
          <Text style={[liteBooking.itemTitle, liteBooking.flexCol]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.addonPrice}>{price}</Text>
        </View>
        <Text style={liteBooking.note}>{desc}</Text>
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
  root: { gap: 20 },

  /* ---- 房型摘要卡 ---- */
  roomCard: {
    width: '100%',
    padding: 24,
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.card,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  roomName: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 24,
    color: colors.heading,
  },
  roomsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  roomsPillText: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
  /* 设计稿:两格之间 gap8,格内图标与文字 gap4 */
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },

  /* ---- Guest Info ---- */
  formCard: {
    width: '100%',
    padding: 25,
    gap: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },
  selectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: TINT_CHIP,
  },
  selectPillText: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 16, color: colors.heading },

  placeholderRow: {
    position: 'absolute',
    left: 17 + 4,
    right: 17,
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeholderText: {
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },
  required: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 20, color: colors.hot },

  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dialCode: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 13 },
  dialText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: CARD_HEADING },

  emailGroup: { gap: 6 },
  emailNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  emailNote: {
    fontFamily: fonts.interSemi,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: FORM_TEXT,
  },
  addEmail: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    paddingLeft: 4,
    color: colors.primary,
  },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: FORM_TEXT },

  /* ---- 加购 ---- */
  addonGroup: { gap: 12 },
  addonCover: { width: '100%', height: 140 },
  addonBody: { padding: 16, gap: 8 },
  addonPrice: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: colors.primary },

  /* ---- 退改政策(左侧 4px 主色竖条) ---- */
  policyCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 12,
    borderRadius: 24,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surface,
  },
  policyTitle: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: colors.heading },
});
