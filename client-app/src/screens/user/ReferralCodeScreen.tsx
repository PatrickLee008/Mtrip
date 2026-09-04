/**
 * 推荐码页(按 Figma Onboarding / Referral Code node `1077:1734` 重做)
 *
 * 结构:公共外壳 `components/user/AuthShell` → 白卡:标题 → 说明 → 推荐码输入 → Continue + Skip。
 *
 * 设计稿实测:
 *   卡片   与验证码页同一张:`--tab` 圆角 32,padding 24,gap 24,1px `--secondary` 描边,投影 DS_AG
 *   输入框 `#EFF4FF` 高 52 圆角 12 padding 16,行内 gap 12,左侧 fluent:people-add-20-filled
 *   按钮   Continue 主色 py16 圆角 12(未填时 50% 透明);Skip 1px 主色描边 py17,Inter Medium 14/20 #204DDA
 *
 * **注册在这一页才真正发生**:后端 `/app/auth/register` 是一次性收单(手机号 + 密码 + 推荐码),
 * 而设计稿把推荐码排在注册表单与验证码之后,所以前两页只收集、不落库,
 * `draft` 一路透传到这里,Continue(带推荐码)与 Skip(不带)分别提交。
 *
 * 推荐码是**真的会上送**的(与短信不同,后端 `UserAuthService::setupReferral` 有这条链路):
 * 填错会被后端判「推荐码无效」而注册失败,不填则只生成自己的推荐码。
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import AuthShell from '@/components/user/AuthShell';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import { setGdprConsent } from '@/utils/gdpr';

export default function ReferralCodeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { draft } = useRoute<RouteProp<RootStackParamList, 'ReferralCode'>>().params;
  const register = useUserStore((s) => s.register);
  const showToast = useCommonStore((s) => s.showToast);
  const setGdprAccepted = useCommonStore((s) => s.setGdprAccepted);

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* 设计稿的 Continue 是 50% 透明的禁用态,对应推荐码没填(不想填就走下面的 Skip) */
  const canSubmit = code.trim().length > 0 && !submitting;

  /** 注册落库:`referralCode` 传空即「不绑定推荐人」,后端只生成本人推荐码 */
  const finish = async (referralCode: string) => {
    setSubmitting(true);
    try {
      await register(draft.mobile, draft.password, {
        email: draft.email || undefined,
        referralCode: referralCode || undefined,
      });
      // 注册表单已勾选条款,即视为同意隐私政策(GDPR 授权落地)
      await setGdprConsent(true);
      setGdprAccepted(true);
      showToast(t('common.success'));
      // 整条注册流程由登录页 push 而来,完成后回到栈底(MainTabs)
      navigation.popToTop();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      actionLabel={t('user.loginTitle')}
      onAction={() => navigation.navigate('Login')}
      onBack={() => navigation.goBack()}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('user.referral.title')}</Text>
          <Text style={styles.desc}>{t('user.referral.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <HomeIcon name="peopleAdd" size={20} color={colors.primary} />
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder={t('user.referral.placeholder')}
              placeholderTextColor={colors.textSoft}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={32}
            />
          </View>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.cta,
                !canSubmit && styles.ctaDisabled,
                pressed && canSubmit && styles.pressed,
              ]}
              disabled={!canSubmit}
              onPress={() => void finish(code.trim())}
            >
              <Text style={styles.ctaText}>{t('user.referral.continue')}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.skipBtn,
                submitting && styles.ctaDisabled,
                pressed && !submitting && styles.pressed,
              ]}
              disabled={submitting}
              onPress={() => void finish('')}
            >
              <Text style={styles.skipText}>{t('user.referral.skip')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    padding: 24,
    gap: 24,
    ...shadows.card,
  },

  header: { width: '100%', alignItems: 'center' },
  title: {
    marginBottom: 8,
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.heading,
    textAlign: 'center',
  },
  desc: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.label,
    textAlign: 'center',
  },

  form: { width: '100%', gap: 32 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.tintBg,
  },
  /* minWidth 0 同登录页:web 端 <input> 的 min-width:auto 会撑破字段 */
  input: { flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 16, color: colors.heading },

  actions: { gap: 8 },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: {
    fontFamily: fonts.outfit,
    fontSize: 16,
    lineHeight: 28,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  skipText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#204DDA',
    textAlign: 'center',
  },
  pressed: { opacity: 0.85 },
});
