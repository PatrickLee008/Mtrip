/**
 * 账号设置(按 Figma M-Trip / More `1797:3913` Account 实现)
 *
 * 三张分组卡:Personal Info / Account Security / Payment,每张 = Heading 3(Inter 600/20 `--text-2`)
 * + 若干菜单项(样式同「更多」页),尾部一行版本号。
 *
 * 后端现状:`/app/user/update` 只支持改昵称与头像,`/app/user/change-password` 支持改密码,
 * 其余字段(性别 / 常住城市 / 换绑邮箱手机 / 常用旅客 / 钱包 / 银行卡 / 支付 PIN)都没有接口。
 * 因此本页当前只做**展示与跳转**:Save Traveler 进已实现的旅客列表页,其余一律 comingSoon。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import MenuLink from '@/components/more/MenuLink';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import { maskEmail, maskMobile } from '@/utils/format';

export default function AccountScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useUserStore((s) => s.profile);
  const showToast = useCommonStore((s) => s.showToast);

  const comingSoon = () => showToast(t('home.comingSoon'));
  const notSet = t('more.account.notSet');

  return (
    <MorePageLayout title={t('more.account.title')} showVersion>
      <View style={[moreShared.panel, styles.panel]}>
        <Text style={styles.groupTitle}>{t('more.account.personal.title')}</Text>
        <MenuLink
          icon="renameA"
          title={t('more.account.personal.displayName')}
          desc={profile?.nickname || notSet}
          divider
          onPress={comingSoon}
        />
        <MenuLink
          icon="personQuestion"
          title={t('more.account.personal.gender')}
          desc={t('more.account.choose')}
          divider
          onPress={comingSoon}
        />
        <MenuLink
          icon="map"
          title={t('more.account.personal.city')}
          desc={t('more.account.choose')}
          divider
          onPress={comingSoon}
        />
        <MenuLink
          icon="peopleAdd"
          title={t('more.account.personal.traveler')}
          desc={t('more.account.manage')}
          onPress={() => navigation.navigate('Travelers')}
        />
      </View>

      <View style={[moreShared.panel, styles.panel]}>
        <Text style={styles.groupTitle}>{t('more.account.security.title')}</Text>
        <MenuLink
          icon="mail"
          title={t('more.account.security.email')}
          desc={maskEmail(profile?.email) || notSet}
          divider
          onPress={() => navigation.navigate('EditEmail')}
        />
        <MenuLink
          icon="phone"
          title={t('more.account.security.phone')}
          desc={maskMobile(profile?.mobile) || notSet}
          divider
          onPress={comingSoon}
        />
        <MenuLink
          icon="lock"
          title={t('more.account.security.password')}
          desc="*********"
          onPress={comingSoon}
        />
      </View>

      <View style={[moreShared.panel, styles.panel]}>
        <Text style={styles.groupTitle}>{t('more.account.payment.title')}</Text>
        <MenuLink
          icon="wallet20"
          title={t('more.wallet.title')}
          desc={t('more.account.manage')}
          divider
          onPress={comingSoon}
        />
        <MenuLink
          icon="viewDesktopMobile"
          title={t('more.account.payment.banking')}
          desc={t('more.account.payment.bankingDesc')}
          divider
          onPress={comingSoon}
        />
        <MenuLink
          icon="shieldKeyhole"
          title={t('more.account.payment.pin')}
          desc={notSet}
          onPress={comingSoon}
        />
      </View>
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 16 },
  /* 设计稿分组标题:Inter 600/20 `--text-2` */
  groupTitle: {
    width: '100%',
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 32,
    color: colors.textSoft,
  },
});
