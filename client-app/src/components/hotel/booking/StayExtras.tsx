/**
 * 订房向导里两块与日期无关的区块:增值服务(Enhance Your Stay)与特殊要求(Special Requests)。
 *
 * 日期确认步(设计稿 1675:6069,加购在前)与多房间第 1 步「日期与住客信息」(新稿 2659:12801,
 * 特殊要求在前)共用 —— 两稿这两块样式相同,只是先后顺序不同,顺序由调用方决定。
 */

import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TEMP_ADDON_COVERS } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import AddOnCard from '@/components/hotel/booking/AddOnCard';
import { bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { BOOKING_ADDONS, type BookingAddonKey } from '@/screens/hotel/bookingDemo';
import type { HotelAddon } from '@/types/models';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

/** 设计稿只给了早餐与接送两张封面,真实键 airport_transfer 复用接送那张 */
const COVER_KEY: Record<string, string> = { airport_transfer: 'transfer' };

/**
 * 增值服务:标题行(Enhance Your Stay + Optional)+ 加购卡列表。
 *
 * `options` 为 null = 演示模式,沿用设计稿三张卡(保险跳保险页);
 * 真实酒店传物业已发布的附加服务(商户端配置、平台审核),一项都没有就整块不显示 ——
 * 以前真实酒店也显示设计稿的三张卡,选了不计价也不下单(QA CA_TC_034)。
 */
export function AddOnsSection({
  addons,
  options = null,
  onToggleAddon,
  onOpenInsurance,
}: {
  addons: BookingAddonKey[];
  options?: HotelAddon[] | null;
  onToggleAddon: (key: BookingAddonKey) => void;
  onOpenInsurance: () => void;
}) {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  if (options) {
    if (options.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={bookingShared.sectionTitle}>{t('hotels.booking.dates.enhance')}</Text>
          <Text style={styles.optional}>{t('hotels.booking.dates.optional')}</Text>
        </View>
        <View style={styles.addonList}>
          {options.map((addon) => {
            const unitLabel = addon.units.length
              ? addon.units.map((unit) => t(`hotels.booking.addonUnits.${unit}`)).join(' · ')
              : t('hotels.booking.addonUnits.once');
            return (
              <AddOnCard
                key={addon.key}
                cover={TEMP_ADDON_COVERS[COVER_KEY[addon.key] ?? addon.key] ?? null}
                title={t(`hotels.booking.addons.${addon.key}.title`)}
                desc={addon.description || t(`hotels.booking.addons.${addon.key}.desc`)}
                price={`${formatMoney(addon.price, currency)} / ${unitLabel}`}
                selected={addons.includes(addon.key)}
                addLabel={t('hotels.booking.dates.addToBooking')}
                selectedLabel={t('hotels.booking.dates.selected')}
                onToggle={() => onToggleAddon(addon.key)}
              />
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={bookingShared.sectionTitle}>{t('hotels.booking.dates.enhance')}</Text>
        <Text style={styles.optional}>{t('hotels.booking.dates.optional')}</Text>
      </View>
      <View style={styles.addonList}>
        {BOOKING_ADDONS.map((addon) => (
          <AddOnCard
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
  );
}

/** 特殊要求:标题 + 白卡(标签 / 浅蓝多行输入框 / 说明) */
export function SpecialRequestsSection({
  request,
  onChangeRequest,
}: {
  request: string;
  onChangeRequest: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <Text style={bookingShared.sectionTitle}>{t('hotels.booking.dates.specialRequests')}</Text>
      <View style={styles.requestCard}>
        <Text style={bookingShared.note}>{t('hotels.booking.dates.requestLabel')}</Text>
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
          <HomeIcon name="infoSmall" size={13.333} color={colors.label} />
          <Text style={styles.noteText}>{t('hotels.booking.dates.requestNote')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optional: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  addonList: { gap: 24 },

  /* 特殊要求卡是纯白 + 更柔的投影(设计稿 0/8 blur15 黑 4%),不走共用壳 */
  requestCard: {
    gap: 8,
    padding: 24,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  textarea: {
    minHeight: 106,
    padding: 17,
    borderRadius: radius.btn,
    backgroundColor: 'rgba(229, 238, 255, 0.5)',
  },
  textareaInput: {
    flex: 1,
    padding: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingTop: 3.5 },
  noteText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.label,
  },
});
