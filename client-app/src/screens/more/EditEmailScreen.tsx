/**
 * 换绑邮箱(按 Figma M-Trip / More `1797:4630` Edit Email 实现)
 *
 * 页面很轻:一张卡里是「Linked email」标题 + 当前邮箱 + 一段说明,底部一枚主色 CTA
 * 「Send Verification Code」。设计稿里这一页还带着一张隐藏的钱包卡,是复制页面时留下的,未实现。
 *
 * 后端没有换绑邮箱接口(`/app/user/update` 只收 nickname / avatar),CTA 走 comingSoon。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import { maskEmail } from '@/utils/format';

export default function EditEmailScreen() {
  const { t } = useTranslation();
  const profile = useUserStore((s) => s.profile);
  const showToast = useCommonStore((s) => s.showToast);

  return (
    <MorePageLayout
      title={t('more.editEmail.title')}
      footer={
        <Pressable
          style={({ pressed }) => [moreShared.cta, pressed && moreShared.pressed]}
          onPress={() => showToast(t('home.comingSoon'))}
        >
          <Text style={moreShared.ctaText}>{t('more.editEmail.sendCode')}</Text>
        </Pressable>
      }
    >
      <View style={[moreShared.panel, styles.panel]}>
        <Text style={styles.label}>{t('more.account.security.email')}</Text>
        <Text style={styles.value}>
          {maskEmail(profile?.email) || t('more.account.notSet')}
        </Text>
        <Text style={styles.desc}>{t('more.editEmail.desc')}</Text>
      </View>
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 8 },
  label: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 32, color: colors.heading },
  value: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft },
  desc: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 26, color: colors.textSoft },
});
