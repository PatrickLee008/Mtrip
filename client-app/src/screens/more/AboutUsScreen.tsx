/**
 * 关于 mTrip(按 Figma M-Trip / Legal Content Pages `3256:19381` About Us 实现)
 *
 * 一张白卡装全文:品牌区(2026 字标 + 标题 + 标语 + 浅蓝导言框)→ 分隔线 →
 * 六节(Your Journey / Stay Your Way / Food / Transportation / Built for Myanmar / Our Vision,
 * 中间三节标题前带 36 方块图标)→ 分隔线 → 品牌落款。
 *
 * 设计稿实测:
 *   卡     白底、圆角 16、padding 20、gap 16、Effect/DS
 *   品牌区 居中 gap 6 pb16;字标 96×70;标题 Inter 700/22 行高 28 字距 -0.55 主色(字标下 12);
 *          标语 Inter 600/16 行高 22 #1F4ED3(pt4);导言框 #EBEFFC 底、圆角 12、p16、gap 3,
 *          正文 Inter 400/14 行高 22.75 #434654(品牌名 Inter 700 主色)
 *   分隔线 #E4E7FF
 *   节标题 Inter 600/18 行高 24 字距 -0.09 #151A31;图标块 36 #E4E7FF 圆角 8,图标 #1F4ED3
 *   正文   Inter 400/14 行高 22.75 #434654,段间距约 3
 *   高亮条 #E4E7FF 圆角 12,Inter 600/12 行高 16 字距 0.24 #1F4ED3
 *   标签   #E4E7FF 胶囊 px12 py6,Inter 600/12 行高 16 #1F4ED3,横 8 纵 8 换行
 *   引言框 #EBEFFC→白 横向渐变、右侧圆角 12、pl16 pr14 py14,Inter 600/16 行高 22 #151A31
 *   落款   居中 pt12 pb16:mTrip Inter 700/18;标语 Inter 600/14 #1F4ED3;版权 Inter 700/11 字距 0.55 #8A94A6
 */

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import HomeIcon, { type HomeIconName } from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import { ABOUT_TRANSPORT_TAGS } from '@/screens/more/moreDemo';

const LOGO = require('../../../assets/images/logo-2026.png');

/** 本页色(设计稿 Material 风格的蓝灰,只在这页出现) */
const INK = '#151A31';
const BODY = colors.muted;
const ACCENT = colors.badgeBg;
const TINT = '#EBEFFC';
const CHIP = '#E4E7FF';

export default function AboutUsScreen() {
  const { t } = useTranslation();

  return (
    <MorePageLayout title={t('more.about.title')}>
      <View style={styles.card}>
        {/* 品牌区 */}
        <View style={styles.brand}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandTitle}>{t('more.about.heading')}</Text>
          <Text style={styles.tagline}>{t('more.about.tagline')}</Text>
          <View style={styles.introBox}>
            <Text style={styles.body}>
              <Text style={styles.brandName}>{t('more.about.intro.brand')}</Text>
              {t('more.about.intro.p1')}
            </Text>
            <Text style={styles.body}>{t('more.about.intro.p2')}</Text>
          </View>
        </View>

        <View style={styles.rule} />

        <Section title={t('more.about.journey.title')}>
          <Text style={styles.body}>{t('more.about.journey.p1')}</Text>
        </Section>

        <Section title={t('more.about.stay.title')} icon="hotelBed" iconSize={{ width: 18.333, height: 12.5 }}>
          <View style={styles.highlight}>
            <Text style={styles.highlightText}>{t('more.about.stay.highlight')}</Text>
          </View>
          <Text style={styles.body}>{t('more.about.stay.p1')}</Text>
        </Section>

        <Section title={t('more.about.food.title')} icon="restaurant" iconSize={{ width: 12.5, height: 16.667 }}>
          <Text style={styles.body}>{t('more.about.food.p1')}</Text>
          <Text style={styles.body}>{t('more.about.food.p2')}</Text>
          <Text style={styles.body}>{t('more.about.food.p3')}</Text>
        </Section>

        <Section title={t('more.about.transport.title')} icon="carSide" iconSize={{ width: 15, height: 13.333 }}>
          <Text style={styles.body}>{t('more.about.transport.p1')}</Text>
          <View style={styles.tags}>
            {ABOUT_TRANSPORT_TAGS.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{t(`more.about.transport.tags.${tag}`)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.body}>{t('more.about.transport.p2')}</Text>
          <Text style={styles.body}>{t('more.about.transport.p3')}</Text>
        </Section>

        <Section title={t('more.about.built.title')}>
          <Text style={styles.body}>{t('more.about.built.p1')}</Text>
          <Text style={[styles.body, styles.beforeCallout]}>{t('more.about.built.p2')}</Text>
          <View style={styles.callout}>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                <LinearGradient id="aboutCallout" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={TINT} />
                  <Stop offset="1" stopColor="#FFFFFF" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#aboutCallout)" />
            </Svg>
            <Text style={styles.calloutText}>{t('more.about.built.callout')}</Text>
          </View>
        </Section>

        <Section title={t('more.about.vision.title')} padded>
          <Text style={styles.body}>{t('more.about.vision.p1')}</Text>
          <Text style={styles.body}>{t('more.about.vision.p2')}</Text>
        </Section>

        <View style={styles.rule} />

        {/* 落款 */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>{t('more.about.brand')}</Text>
          <Text style={styles.footerTagline}>{t('more.about.tagline')}</Text>
          <Text style={styles.copyright}>{t('more.about.copyright')}</Text>
        </View>
      </View>
    </MorePageLayout>
  );
}

interface SectionProps {
  title: string;
  icon?: HomeIconName;
  /** 图标原生宽高(三枚都是非正方字形) */
  iconSize?: { width: number; height: number };
  /** Our Vision 一节上下各多 8 */
  padded?: boolean;
  children: React.ReactNode;
}

function Section({ title, icon, iconSize, padded, children }: SectionProps) {
  return (
    <View style={[styles.section, padded && styles.sectionPadded]}>
      <View style={styles.sectionHead}>
        {icon ? (
          <View style={styles.sectionIcon}>
            <HomeIcon name={icon} width={iconSize?.width} height={iconSize?.height} color={ACCENT} />
          </View>
        ) : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    ...shadows.subtle,
  },

  brand: { alignItems: 'center', gap: 6, paddingBottom: 16 },
  logo: { width: 96, height: 70 },
  brandTitle: {
    marginTop: 6,
    fontFamily: fonts.interBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.55,
    textAlign: 'center',
    color: colors.primary,
  },
  tagline: {
    paddingTop: 4,
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: ACCENT,
  },
  introBox: { alignSelf: 'stretch', gap: 3, marginTop: 16, padding: 16, borderRadius: radius.btn, backgroundColor: TINT },
  brandName: { fontFamily: fonts.interBold, color: colors.primary },

  rule: { height: 1, backgroundColor: CHIP },

  section: { gap: 3, paddingTop: 0 },
  sectionPadded: { paddingVertical: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CHIP,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interSemi,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.09,
    color: INK,
  },
  body: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 22.75, color: BODY },

  highlight: { marginVertical: 4, paddingHorizontal: 7, paddingVertical: 8, borderRadius: radius.btn, backgroundColor: CHIP },
  highlightText: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.24, color: ACCENT },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.round, backgroundColor: CHIP },
  tagText: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.24, color: ACCENT },

  beforeCallout: { paddingBottom: 8 },
  callout: {
    overflow: 'hidden',
    paddingLeft: 16,
    paddingRight: 14,
    paddingVertical: 14,
    borderTopRightRadius: radius.btn,
    borderBottomRightRadius: radius.btn,
    ...shadows.subtle,
  },
  calloutText: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 22, color: INK },

  footer: { alignItems: 'center', paddingTop: 12, paddingBottom: 16 },
  footerBrand: {
    fontFamily: fonts.interBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.09,
    textAlign: 'center',
    color: INK,
  },
  footerTagline: {
    paddingTop: 2,
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: ACCENT,
  },
  copyright: {
    paddingTop: 12,
    fontFamily: fonts.interBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.55,
    textAlign: 'center',
    color: '#8A94A6',
  },
});
