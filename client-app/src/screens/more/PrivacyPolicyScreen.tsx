/**
 * 隐私政策(按 Figma M-Trip / Legal Content Pages `3256:19233` Privacy Policy 实现)
 *
 * 与条款页 LegalTermsScreen(3256:19131)同属「Legal Content Pages」,但排版不同:
 * 整篇政策装在一张大白卡里 —— 卡头(标题 + 最后更新日期)→ 主色 10% 底的导言框 →
 * 编号小节(1 节两个「说明 + 列表」小节,1.2 末尾挂灰底提示;2/3 节两段纯文本;4 节联系卡)→
 * 文末印章(对号圆章 + End of Privacy Policy + 版权)。卡下面一枚整宽 CTA 进「联系我们」。
 *
 * 设计稿实测:
 *   大卡   白底、1px #D9E1FB、圆角 24、px20 py24、gap 10,0/2 blur12 spread-3 rgba(15,23,42,0.06)
 *   卡头   下边框 #F1F5F9、pt6.5 pb11 gap5;标题 Inter 700/22 行高 27.5 字距 -0.55 主色;
 *          「Last Updated:」Inter 500/13 #64748B + 日期 Inter 600/13 #0F172A
 *   导言   主色 10% 底 + 主色 15% 描边、圆角 12、p15 gap7;正文 Inter 400/14 行高 22.75 #334155
 *          (品牌名 Inter 600 #0F172A),末句 Inter 500/13.5 主色
 *   节标题 Inter 700/17.5 行高 28 字距 -0.437:序号主色 + 标题 #0F172A,gap 8
 *   小节   标题 Inter 600/15.5 行高 24.8 #0F172A;正文 Inter 400/14.5 行高 23.2 #334155;
 *          列表左缩进 20、行距 4(设计稿列表没有圆点,只靠缩进)
 *   提示框 #F8FAFC 底、1px #F1F5F9、圆角 8、p13;Inter 400/14 行高 22.4 #64748B
 *   联系卡 #F8FAFC 底、1px rgba(226,232,240,0.8)、圆角 12、p17 gap8;
 *          标签列宽 64 Inter 500/14 #64748B,链接 Inter 500/14 主色,地址 Inter 400/14 #334155
 *   印章   上边框 #F1F5F9、pt29;32 圆 #F1F5F9 + 16 描边对号 #94A3B8;Inter 400/12 #64748B;版权 Inter 400/11 #94A3B8
 *   CTA    主色、py16 圆角 12;Inter 400/16 #FFFBFF
 *
 * 设计稿 1、2 节之间画了两条分隔线、2、3 节之间没有,应是稿面遗留,这里统一为每节之间一条。
 * 文本照搬设计稿(没有法律文本接口),走 more.privacy.*;邮箱 / 网址可点。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import {
  PRIVACY_COLLECT_SUBSECTIONS,
  PRIVACY_CONTACT,
  PRIVACY_TEXT_SECTIONS,
  PRIVACY_UPDATED_AT,
} from '@/screens/more/moreDemo';
import { useCommonStore } from '@/store/commonStore';
import { openExternal } from '@/utils/openExternal';

/** 本页的 slate 色阶(设计稿 Tailwind slate,色板里没有,只在法律长文页出现) */
const INK = '#0F172A';
const BODY = '#334155';
const MUTED = '#64748B';
const FAINT = '#94A3B8';
const RULE = '#F1F5F9';
const TINT = '#F8FAFC';

export default function PrivacyPolicyScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const showToast = useCommonStore((s) => s.showToast);
  const fail = () => showToast(t('more.contact.openFailed'));

  /** 节号:1 = 收集的信息,随后是纯文本节,最后是联系我们 */
  const contactNo = PRIVACY_TEXT_SECTIONS.length + 2;

  return (
    <MorePageLayout title={t('more.privacy.title')}>
      <View style={styles.card}>
        {/* 卡头 */}
        <View style={styles.cardHead}>
          <Text style={styles.heading}>{t('more.privacy.heading')}</Text>
          <Text style={styles.updated}>
            {`${t('more.privacy.updated')} `}
            <Text style={styles.updatedDate}>{PRIVACY_UPDATED_AT}</Text>
          </Text>
        </View>

        {/* 导言 */}
        <View style={styles.intro}>
          <Text style={styles.introText}>
            <Text style={styles.introBrand}>{t('more.privacy.intro.brand')}</Text>
            {t('more.privacy.intro.lead')}
          </Text>
          <Text style={styles.introText}>{t('more.privacy.intro.scope')}</Text>
          <Text style={styles.introAgree}>{t('more.privacy.intro.agree')}</Text>
        </View>

        {/* 1. 收集的信息 */}
        <View style={[styles.section, styles.firstSection]}>
          <SectionTitle no={1} title={t('more.privacy.collect.title')} />
          {PRIVACY_COLLECT_SUBSECTIONS.map((sub, index) => (
            <View key={sub.key} style={[styles.sub, index > 0 && styles.subSpaced]}>
              <Text style={styles.subTitle}>{t(`more.privacy.collect.${sub.key}.title`)}</Text>
              <Text style={styles.body}>{t(`more.privacy.collect.${sub.key}.body`)}</Text>
              <View style={styles.list}>
                {sub.items.map((item) => (
                  <Text key={item} style={styles.body}>
                    {t(`more.privacy.collect.${sub.key}.items.${item}`)}
                  </Text>
                ))}
              </View>
              {sub.note ? (
                <View style={styles.note}>
                  <Text style={styles.noteText}>{t(`more.privacy.collect.${sub.key}.note`)}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>

        {/* 2..n. 纯文本节 */}
        {PRIVACY_TEXT_SECTIONS.map((key, index) => (
          <React.Fragment key={key}>
            <View style={styles.rule} />
            <View style={styles.section}>
              <SectionTitle no={index + 2} title={t(`more.privacy.sections.${key}.title`)} />
              <Text style={styles.body}>{t(`more.privacy.sections.${key}.p1`)}</Text>
              <Text style={styles.body}>{t(`more.privacy.sections.${key}.p2`)}</Text>
            </View>
          </React.Fragment>
        ))}

        {/* 联系我们 */}
        <View style={styles.rule} />
        <View style={styles.section}>
          <SectionTitle no={contactNo} title={t('more.privacy.contact.title')} />
          <Text style={styles.body}>{t('more.privacy.contact.body')}</Text>
          <View style={styles.contactBox}>
            <Text style={styles.company}>{t('more.privacy.contact.company')}</Text>
            <View style={styles.contactRows}>
              <View style={styles.contactRow}>
                <Text style={styles.contactLabel}>{t('more.privacy.contact.email')}</Text>
                <Text
                  style={styles.contactLink}
                  onPress={() => void openExternal(`mailto:${PRIVACY_CONTACT.email}`, fail)}
                >
                  {PRIVACY_CONTACT.email}
                </Text>
              </View>
              <View style={styles.contactRow}>
                <Text style={styles.contactLabel}>{t('more.privacy.contact.website')}</Text>
                <Text style={styles.contactLink} onPress={() => void openExternal(PRIVACY_CONTACT.website, fail)}>
                  {PRIVACY_CONTACT.website}
                </Text>
              </View>
              <View style={[styles.contactRow, styles.contactRowTop]}>
                <Text style={styles.contactLabel}>{t('more.privacy.contact.address')}</Text>
                <Text style={styles.contactValue}>{t('more.privacy.contact.addressValue')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 文末印章 */}
        <View style={styles.seal}>
          <View style={styles.sealIcon}>
            <HomeIcon name="checkSeal" size={16} color={FAINT} strokeWidth={1.33333} />
          </View>
          <Text style={styles.sealText}>{t('more.privacy.end')}</Text>
          <Text style={styles.copyright}>{t('more.privacy.copyright')}</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [moreShared.cta, pressed && moreShared.pressed]}
        onPress={() => navigation.navigate('ContactUs')}
      >
        <Text style={styles.ctaText}>{t('more.privacy.cta')}</Text>
      </Pressable>
    </MorePageLayout>
  );
}

function SectionTitle({ no, title }: { no: number; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, styles.sectionNo]}>{`${no}.`}</Text>
      <Text style={[styles.sectionTitle, styles.flex]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },

  card: {
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  cardHead: { gap: 5, paddingTop: 6.5, paddingBottom: 11, borderBottomWidth: 1, borderBottomColor: RULE },
  heading: {
    fontFamily: fonts.interBold,
    fontSize: 22,
    lineHeight: 27.5,
    letterSpacing: -0.55,
    color: colors.primary,
  },
  updated: { fontFamily: fonts.interMedium, fontSize: 13, lineHeight: 19.5, color: MUTED },
  updatedDate: { fontFamily: fonts.interSemi, color: INK },

  intro: {
    gap: 7,
    paddingHorizontal: 15,
    paddingTop: 13.75,
    paddingBottom: 15,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: 'rgba(65, 105, 237, 0.15)',
    backgroundColor: 'rgba(65, 105, 237, 0.1)',
  },
  introText: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 22.75, color: BODY },
  introBrand: { fontFamily: fonts.interSemi, color: INK },
  introAgree: { fontFamily: fonts.interMedium, fontSize: 13.5, lineHeight: 21.94, color: colors.primary },

  section: { gap: 12 },
  firstSection: { gap: 11, paddingTop: 8 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  sectionTitle: {
    fontFamily: fonts.interBold,
    fontSize: 17.5,
    lineHeight: 28,
    letterSpacing: -0.437,
    color: INK,
  },
  sectionNo: { color: colors.primary },

  sub: { gap: 8 },
  subSpaced: { paddingTop: 8 },
  subTitle: { fontFamily: fonts.interSemi, fontSize: 15.5, lineHeight: 24.8, color: INK },
  body: { fontFamily: fonts.inter, fontSize: 14.5, lineHeight: 23.2, color: BODY },
  list: { gap: 4, paddingLeft: 20 },
  note: { padding: 13, borderRadius: 8, borderWidth: 1, borderColor: RULE, backgroundColor: TINT },
  noteText: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 22.4, color: MUTED },

  rule: { height: 1, backgroundColor: RULE },

  contactBox: {
    gap: 8,
    padding: 17,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    backgroundColor: TINT,
  },
  company: { fontFamily: fonts.interSemi, fontSize: 15, lineHeight: 24, color: INK },
  contactRows: { gap: 6 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactRowTop: { alignItems: 'flex-start' },
  contactLabel: { width: 64, fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 22.4, color: MUTED },
  contactLink: { flexShrink: 1, fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 22.4, color: colors.primary },
  contactValue: { flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 14, lineHeight: 22.4, color: BODY },

  seal: { alignItems: 'center', paddingTop: 29, borderTopWidth: 1, borderTopColor: RULE },
  sealIcon: {
    width: 32,
    height: 32,
    marginBottom: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RULE,
  },
  sealText: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 16, textAlign: 'center', color: MUTED },
  copyright: {
    paddingTop: 2,
    fontFamily: fonts.inter,
    fontSize: 11,
    lineHeight: 16.5,
    textAlign: 'center',
    color: FAINT,
  },

  /* 设计稿 CTA 是 Inter 400/16 #FFFBFF(不是 moreShared.ctaText 的 Outfit) */
  ctaText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, textAlign: 'center', color: '#FFFBFF' },
});
