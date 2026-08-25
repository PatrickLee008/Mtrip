/**
 * 酒店详情 · Amenities 页签(Figma M-Trip / Hotel Details Amenities 222:2539)
 *
 * 三张卡,自上而下:
 *   01 Amenities 222:2705    卡内 gap 32;分组标题 Inter 700/12 大写 letterSpacing 1.2 #204DDA,
 *                            条目 图标 + Inter 400/16 #0B1C30,条目间距 16、组间距 24
 *   02 Stay Longer, Save More 1695:6754  标题 Inter 700/16 `--text-2`;每档「N Nights」左、折扣右(主色),
 *                            当前档满不透明,其余档设计稿是 50% 透明度
 *   03 Long Stay Benefits 1695:6794      同一张壳,每行 20px 勾 + Inter 500/14(设计稿有三条用粗体)
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { detailShared } from '@/components/hotel/detailShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import {
  DETAIL_AMENITY_GROUPS,
  DETAIL_LONG_STAY_BENEFITS,
  DETAIL_LONG_STAY_TIERS,
} from '@/screens/hotel/detailDemo';

/** 设计稿分组标题与条目文字用的是这一版深蓝/近黑,不是通用的 heading */
const GROUP_TITLE_COLOR = '#204DDA';
const ITEM_TEXT_COLOR = '#0B1C30';

export default function HotelAmenitiesTab() {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      {/* 01 设施分组 */}
      <View style={[detailShared.panel, styles.amenityPanel]}>
        <Text style={[detailShared.panelTitleDark, styles.amenityTitle]}>
          {t('hotels.detail.tabs.amenities')}
        </Text>
        <View style={styles.groups}>
          {DETAIL_AMENITY_GROUPS.map((group) => (
            <View key={group.key} style={styles.group}>
              <Text style={styles.groupTitle}>
                {t(`hotels.detail.amenityGroups.${group.key}`)}
              </Text>
              <View style={styles.groupList}>
                {group.items.map((item) => (
                  <View key={item.key} style={styles.item}>
                    <HomeIcon
                      name={item.icon}
                      width={item.width}
                      height={item.height}
                      color={colors.primary}
                    />
                    <Text style={styles.itemText}>
                      {t(`hotels.detail.amenityList.${item.key}`)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 02 长住折扣阶梯 */}
      <View style={[detailShared.panel, styles.listPanel]}>
        <Text style={styles.listTitle}>{t('hotels.stayLonger')}</Text>
        {DETAIL_LONG_STAY_TIERS.map((tier) => (
          <View key={tier.nights} style={[styles.tierRow, !tier.current && styles.tierDim]}>
            <Text style={styles.tierNights}>{t('hotels.nights', { nights: tier.nights })}</Text>
            <Text style={styles.tierPercent}>{tier.percent}%</Text>
          </View>
        ))}
      </View>

      {/* 03 长住权益 */}
      <View style={[detailShared.panel, styles.listPanel]}>
        <Text style={styles.listTitle}>{t('hotels.detail.longStay.title')}</Text>
        {DETAIL_LONG_STAY_BENEFITS.map((benefit) => (
          <View key={benefit.key} style={styles.benefitRow}>
            <HomeIcon name="check" size={20} color={colors.primary} />
            <Text style={[styles.benefitText, benefit.strong && styles.benefitStrong]}>
              {t(`hotels.detail.longStay.benefits.${benefit.key}`)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },

  amenityPanel: { gap: 32 },
  amenityTitle: { width: '100%' },
  groups: { gap: 24 },
  group: { gap: 24 },
  groupTitle: {
    fontFamily: fonts.interBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    color: GROUP_TITLE_COLOR,
    textTransform: 'uppercase',
  },
  groupList: { gap: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemText: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: ITEM_TEXT_COLOR,
  },

  listPanel: { gap: 16 },
  listTitle: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSoft,
  },

  /* 设计稿每行左侧还留了 4px 内缩(Label:margin) */
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 4,
  },
  tierDim: { opacity: 0.5 },
  tierNights: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  tierPercent: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },

  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4 },
  benefitText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  benefitStrong: { fontFamily: fonts.interBold },
});
