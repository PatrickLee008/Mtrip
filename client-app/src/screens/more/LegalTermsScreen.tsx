/**
 * 条款与隐私(按 Figma M-Trip / More `1697:7249` Terms & Conditions 实现)
 *
 * 五节纯文本:小节标题 Inter 400/16 主色(带序号)+ 正文 Inter 400/16 `#434655` 行高 26
 * + 圆点列表(行高 24)。第 3 节正文下面额外挂一块主色 10% 底、圆角 24 的退款时间表。
 *
 * 设计稿页尾还有一枚未具名的 CTA(1697:7517/7520,文案未标注),含义不明,未实现 ——
 * 这是一页只读的法律文本,顶部返回即可退出。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { REFUND_TIMELINE, TERMS_SECTIONS } from '@/screens/more/moreDemo';

export default function LegalTermsScreen() {
  const { t } = useTranslation();

  return (
    <MorePageLayout title={t('more.legal.title')}>
      {TERMS_SECTIONS.map((section, index) => (
        <View key={section.key} style={styles.section}>
          <Text style={styles.heading}>
            {`${index + 1}. ${t(`more.legal.sections.${section.key}.title`)}`}
          </Text>
          <Text style={styles.body}>{t(`more.legal.sections.${section.key}.body`)}</Text>

          {section.bullets.length > 0 ? (
            <View style={styles.list}>
              {section.bullets.map((bullet) => (
                <View key={bullet} style={styles.bulletItem}>
                  <View style={styles.dot} />
                  <Text style={styles.bulletText}>
                    {t(`more.legal.sections.${section.key}.bullets.${bullet}`)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* 第 3 节的退款时间表 */}
          {section.key === 'payment' ? (
            <View style={styles.refundBox}>
              <Text style={styles.refundTitle}>{t('more.legal.refund.title')}</Text>
              <View style={styles.refundList}>
                {REFUND_TIMELINE.map((row) => (
                  <View key={row.key} style={styles.refundRow}>
                    <Text style={styles.refundLabel}>{t(`more.legal.refund.${row.key}`)}</Text>
                    <Text style={[styles.refundValue, row.danger && styles.refundValueDanger]}>
                      {row.refund
                        ? t('more.legal.refund.amount', { percent: row.refund })
                        : t('more.legal.refund.none')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ))}
    </MorePageLayout>
  );
}

/** 设计稿正文色,只在这一页出现 */
const BODY_COLOR = '#434655';

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.primary },
  body: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 26, color: BODY_COLOR },

  list: { gap: 8, paddingTop: 8 },
  bulletItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dot: { width: 6, height: 6, marginTop: 9, borderRadius: 3, backgroundColor: BODY_COLOR },
  bulletText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: BODY_COLOR,
  },

  refundBox: {
    gap: 8,
    marginTop: 8,
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(65, 105, 237, 0.1)',
  },
  refundTitle: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },
  refundList: { gap: 8 },
  refundRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  refundLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: BODY_COLOR,
  },
  refundValue: {
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'right',
    color: colors.heading,
  },
  refundValueDanger: { color: colors.hot },
});
