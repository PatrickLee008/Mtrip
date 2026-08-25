/**
 * 酒店详情 · Policies 页签(Figma M-Trip / Hotel Details Policies 222:3503)
 *
 * 七块,自上而下:
 *   01 页头大图 222:3504     370x192 圆角 32,底部黑色渐变 + Hotel Policies(Inter 600/24 白)
 *   02 Booking Policies 222:3509  白底描边卡:CANCELLATION / PREPAYMENT 两段
 *                                 + Taxes & Fees 提示块(主色底 10%、圆角 12)
 *   03/04 Check-in / Check-out 222:3533 / 222:3556  纯白无描边卡,时间 Inter 700/48 主色
 *                                 (Check-in 卡底部还有一条分隔线 + Required Documents 列表)
 *   05 Children & Extra Beds 222:3568  三行,前两行带下分隔线;右侧要么 Complimentary 绿胶囊、要么价格
 *   06 Pet Policy 222:3600   左 36x64 圆底爪印 + 标题正文
 *   07 Property Rules 222:3611  三张小卡(白底 `--secondary` 描边 圆角 12 padding 17):图标 + 名称 + 说明
 */

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { TEMP_POLICIES_HEADER } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import { DETAIL_DIVIDER, detailShared } from '@/components/hotel/detailShared';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import {
  DETAIL_CHECK_TIMES,
  DETAIL_EXTRA_BEDS,
  DETAIL_PROPERTY_RULES,
  DETAIL_REQUIRED_DOCS,
} from '@/screens/hotel/detailDemo';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

/** 设计稿这一页的小标题用的是这一版深蓝 */
const HEADING_BLUE = '#204DDA';

export default function HotelPoliciesTab() {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  return (
    <View style={styles.root}>
      {/* 01 页头大图 */}
      <View style={styles.header}>
        <Image source={TEMP_POLICIES_HEADER} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="policiesHeaderShade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.6} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#policiesHeaderShade)" />
        </Svg>
        <Text style={styles.headerTitle}>{t('hotels.detail.policies.title')}</Text>
      </View>

      {/* 02 预订政策 */}
      <View style={styles.bookingCard}>
        <View style={detailShared.panelHeadRow}>
          <HomeIcon name="bookingPolicy" width={18} height={20} color={HEADING_BLUE} />
          <Text style={[detailShared.panelTitle, styles.headingBlue]}>
            {t('hotels.detail.policies.booking.title')}
          </Text>
        </View>

        {(['cancellation', 'prepayment'] as const).map((key) => (
          <View key={key} style={styles.clause}>
            <Text style={styles.clauseTitle}>
              {t(`hotels.detail.policies.booking.${key}.title`)}
            </Text>
            <Text style={detailShared.body}>
              {t(`hotels.detail.policies.booking.${key}.body`)}
            </Text>
          </View>
        ))}

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{t('hotels.detail.policies.taxes.title')}</Text>
          <Text style={detailShared.body}>{t('hotels.detail.policies.taxes.body')}</Text>
        </View>
      </View>

      {/* 03/04 入住 / 退房 */}
      {DETAIL_CHECK_TIMES.map((item) => (
        <View key={item.key} style={detailShared.panelPlain}>
          <View style={styles.checkBlock}>
            <View style={detailShared.panelHeadRow}>
              <HomeIcon name={item.icon} size={18} color={colors.primary} />
              <Text style={detailShared.panelTitle}>
                {t(`hotels.detail.policies.${item.key}.title`)}
              </Text>
            </View>
            <Text style={styles.checkTime}>{item.time}</Text>
            <Text style={detailShared.body}>{t(`hotels.detail.policies.${item.key}.body`)}</Text>
          </View>

          {/* Required Documents 只有入住卡有 */}
          {item.key === 'checkIn' ? (
            <View style={styles.docsBlock}>
              <Text style={styles.docsTitle}>{t('hotels.detail.policies.requiredDocs')}</Text>
              {DETAIL_REQUIRED_DOCS.map((doc) => (
                <Text key={doc} style={styles.docItem}>
                  {t(`hotels.detail.policies.docs.${doc}`)}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ))}

      {/* 05 加床政策 */}
      <View style={[detailShared.panel, styles.gap24]}>
        <View style={detailShared.panelHeadRow}>
          <HomeIcon name="children" width={20.5} height={20} color={colors.primary} />
          <Text style={detailShared.panelTitle}>{t('hotels.detail.policies.extraBeds.title')}</Text>
        </View>

        <View style={styles.bedList}>
          {DETAIL_EXTRA_BEDS.map((bed, i) => (
            <View
              key={bed.key}
              style={[styles.bedRow, i < DETAIL_EXTRA_BEDS.length - 1 && styles.bedRowBordered]}
            >
              <View style={styles.bedText}>
                <Text style={styles.bedLabel}>
                  {t(`hotels.detail.policies.extraBeds.${bed.key}.label`)}
                </Text>
                <Text style={detailShared.body}>
                  {t(`hotels.detail.policies.extraBeds.${bed.key}.body`)}
                </Text>
              </View>

              {bed.complimentary ? (
                <View style={styles.complimentary}>
                  <Text style={styles.complimentaryText}>
                    {t('hotels.detail.policies.extraBeds.complimentary')}
                  </Text>
                </View>
              ) : (
                <Text style={styles.bedPrice}>
                  {formatMoney(bed.price ?? 0, currency)}
                  {'\n'}
                  {t('hotels.detail.rooms.perNight')}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* 06 宠物政策 */}
      <View style={[detailShared.panel, styles.petCard]}>
        <View style={styles.petIcon}>
          <HomeIcon name="paw" width={30} height={28.5} color={colors.primary} />
        </View>
        <View style={styles.petText}>
          <Text style={detailShared.panelTitleDark}>{t('hotels.detail.policies.pet.title')}</Text>
          <Text style={detailShared.body}>{t('hotels.detail.policies.pet.body')}</Text>
        </View>
      </View>

      {/* 07 住店规则 */}
      <View style={[detailShared.panel, styles.gap24]}>
        <View style={detailShared.panelHeadRow}>
          <HomeIcon name="propertyRules" width={18} height={19} color={colors.primary} />
          <Text style={detailShared.panelTitle}>{t('hotels.detail.policies.rules.title')}</Text>
        </View>

        <View style={styles.gap24}>
          {DETAIL_PROPERTY_RULES.map((rule) => (
            <View key={rule.key} style={styles.ruleCard}>
              <HomeIcon
                name={rule.icon}
                width={rule.width}
                height={rule.height}
                color={colors.primary}
              />
              <Text style={styles.ruleTitle}>
                {t(`hotels.detail.policies.rules.${rule.key}.title`)}
              </Text>
              <Text style={styles.ruleBody}>
                {t(`hotels.detail.policies.rules.${rule.key}.body`)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  gap24: { gap: 24 },
  headingBlue: { color: HEADING_BLUE },

  header: {
    height: 192,
    borderRadius: radius.card,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 24,
  },
  headerTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    color: '#FFFFFF',
  },

  bookingCard: {
    gap: 24,
    padding: 24,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.card,
    ...shadows.subtle,
  },
  clause: { gap: 8 },
  clauseTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.7,
    color: colors.heading,
    textTransform: 'uppercase',
  },
  notice: {
    gap: 4,
    padding: 16,
    borderRadius: radius.btn,
    backgroundColor: 'rgba(65, 105, 237, 0.1)',
  },
  noticeTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: HEADING_BLUE,
  },

  checkBlock: { gap: 16 },
  checkTime: {
    fontFamily: fonts.interBold,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -0.96,
    color: colors.primary,
  },
  docsBlock: {
    gap: 8,
    marginTop: 24,
    paddingTop: 25,
    borderTopWidth: 1,
    borderTopColor: DETAIL_DIVIDER,
  },
  docsTitle: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.hot,
  },
  /* 设计稿每条前面留了一段空占位(项目符号是空的),这里用左内缩还原 */
  docItem: {
    paddingLeft: 15,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },

  bedList: { gap: 16 },
  bedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  bedRowBordered: { paddingBottom: 17, borderBottomWidth: 1, borderBottomColor: DETAIL_DIVIDER },
  bedText: { flexShrink: 1 },
  bedLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  bedPrice: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
    textAlign: 'right',
  },
  complimentary: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  complimentaryText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.statusPaid,
  },

  petCard: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  petIcon: {
    width: 36,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#E5EEFF',
  },
  petText: { flexShrink: 1 },

  ruleCard: {
    gap: 4,
    padding: 17,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.card,
  },
  ruleTitle: {
    marginTop: 4,
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  ruleBody: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.textSoft,
  },
});
