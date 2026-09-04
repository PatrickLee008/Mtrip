/**
 * 登录页(按 Figma M-Trip / Login 505:1293 重做)
 *
 * 结构:公共外壳 `components/user/AuthShell`(主色底 + 插画铺底 → 顶部栏(返回 / Sign Up)
 * → logo + 标语)+ 本页的白色表单卡。卡内:手机号(+95 区号)→ 密码(眼睛切换)→ 记住我
 * → 登录 → 分隔线 → 三方登录。
 *
 * 设计稿实测(外壳部分的取值见 AuthShell 顶部注释):
 *   表单卡   --tab #FEFEFE,圆角 32,padding 24,gap 8
 *   输入框   #EFF4FF,高 52,圆角 12,padding 16,行内 gap 12;两框之间 gap 16
 *   登录按钮 主色,py16,圆角 12,文字 Outfit 400/16;未填完时整体 50% 透明(设计稿即禁用态)
 *   三方按钮 高 48,圆角 12,px31,1px --secondary 描边
 *
 * 「记住我」= **记住手机号**(不含密码):进页面回填上次保存的号码并默认勾上,
 * 登录成功时按当前勾选状态写入 / 清除 `STORAGE_KEYS.REMEMBER_MOBILE`。
 * 它管的不是免登录 —— token 本来就无条件持久化(见 `store/userStore.ts` 的 applyAuth / hydrate)。
 *
 * 未实现的能力(设计稿有、后端没有),一律走 comingSoon:
 *   区号选择(固定 +95)、三方登录
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import AuthShell from '@/components/user/AuthShell';
import SocialIcon, { type SocialProvider } from '@/components/user/SocialIcon';
import { STORAGE_KEYS } from '@/config/global';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import { storage } from '@/utils/storage';
import { isMobile, isPassword } from '@/utils/validate';

/** 设计稿固定展示 +95(缅甸),区号选择未实现 */
const COUNTRY_CODE = '+95';
const SOCIALS: SocialProvider[] = ['google', 'facebook', 'apple'];

export default function LoginScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const login = useUserStore((s) => s.login);
  const showToast = useCommonStore((s) => s.showToast);

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* 进页面回填上次「记住我」保存的手机号,并把勾选框恢复成勾上 */
  useEffect(() => {
    let alive = true;
    void storage.getString(STORAGE_KEYS.REMEMBER_MOBILE).then((saved) => {
      if (!alive || !saved) return;
      setMobile(saved);
      setRemember(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* 设计稿的登录按钮是 50% 透明的禁用态,对应两栏未填完 */
  const canSubmit = mobile.trim().length > 0 && password.length > 0 && !submitting;

  const comingSoon = () => showToast(t('home.comingSoon'));

  const submit = async () => {
    if (!isMobile(mobile)) {
      showToast(t('user.invalidMobile'));
      return;
    }
    if (!isPassword(password)) {
      showToast(t('user.invalidPassword'));
      return;
    }
    setSubmitting(true);
    try {
      await login(mobile.trim(), password);
      /* 只在登录成功后按当前勾选状态落盘,单纯勾/取消勾不改本地值 */
      if (remember) {
        await storage.setString(STORAGE_KEYS.REMEMBER_MOBILE, mobile.trim());
      } else {
        await storage.remove(STORAGE_KEYS.REMEMBER_MOBILE);
      }
      showToast(t('common.success'));
      navigation.goBack();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      actionLabel={t('user.registerTitle')}
      onAction={() => navigation.navigate('Register')}
      onBack={() => navigation.goBack()}
    >
      <View style={styles.card}>
        <View style={styles.fields}>
          {/* 手机号:区号固定 +95,竖线右侧为号码输入 */}
          <View style={styles.field}>
            <HomeIcon name="phone" size={20} color={colors.primary} />
            <Pressable
              style={({ pressed }) => [styles.codeBtn, pressed && styles.pressed]}
              onPress={comingSoon}
              hitSlop={6}
            >
              <Text style={styles.codeText}>{COUNTRY_CODE}</Text>
              <HomeIcon name="chevronDown" size={12} color="#204DDA" />
            </Pressable>
            <View style={styles.vDivider} />
            <TextInput
              style={styles.input}
              value={mobile}
              onChangeText={setMobile}
              placeholder={t('user.mobilePlaceholder')}
              placeholderTextColor={colors.textSoft}
              keyboardType="phone-pad"
              maxLength={20}
              autoCapitalize="none"
            />
          </View>

          {/* 密码:右侧眼睛切换明文 */}
          <View style={styles.field}>
            <HomeIcon name="lock" size={20} color={colors.primary} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t('user.passwordPlaceholder')}
              placeholderTextColor={colors.textSoft}
              secureTextEntry={secure}
              maxLength={32}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setSecure((v) => !v)} hitSlop={10}>
              <HomeIcon name="eyeOff" size={16} color={colors.body} />
            </Pressable>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.rememberRow, pressed && styles.pressed]}
          onPress={() => setRemember((v) => !v)}
          hitSlop={6}
        >
          {/* 选中态换成实心方块的 checkboxIndeterminate,与酒店页 Myanmar Citizen 一致 */}
          <HomeIcon
            name={remember ? 'checkboxIndeterminate' : 'checkbox'}
            size={20}
            color={remember ? colors.primary : colors.softBlue}
          />
          <Text style={styles.rememberText}>{t('user.rememberMe')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.loginBtn,
            !canSubmit && styles.loginBtnDisabled,
            pressed && canSubmit && styles.pressed,
          ]}
          disabled={!canSubmit}
          onPress={() => void submit()}
        >
          <Text style={styles.loginText}>{t('user.login')}</Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.hLine} />
          <Text style={styles.dividerText}>{t('user.orLoginWith')}</Text>
          <View style={styles.hLine} />
        </View>

        <View style={styles.socials}>
          {SOCIALS.map((p) => (
            <Pressable
              key={p}
              style={({ pressed }) => [styles.socialBtn, pressed && styles.pressed]}
              onPress={comingSoon}
            >
              <SocialIcon provider={p} />
            </Pressable>
          ))}
        </View>

        {/* 设计稿没有这段,但登录页需要保留隐私告知,放在卡片末尾弱化处理 */}
        <Text style={styles.gdprTip}>{t('user.gdprTip')}</Text>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 24,
    gap: 8,
  },
  fields: { gap: 16 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.tintBg,
  },
  codeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  codeText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  /* 设计稿区号与号码之间的竖线:1x20,#191A25 50% */
  vDivider: { width: 1, height: 20, backgroundColor: colors.textSoft },
  /* minWidth 0 同酒店页搜索框:web 端 <input> 的 min-width:auto 会撑破字段,把右侧眼睛图标挤出去 */
  input: { flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 16, color: colors.heading },

  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rememberText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.muted },

  loginBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  loginBtnDisabled: { opacity: 0.5 },
  loginText: {
    fontFamily: fonts.outfit,
    fontSize: 16,
    lineHeight: 28,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  hLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  dividerText: {
    paddingHorizontal: 8,
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },

  socials: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  /**
   * 设计稿是 px31 的固定宽(20 的图标 → 82 宽),三枚 + 两道 16 间距 = 278。
   * 卡片可用宽 = 屏宽 - 32(页边距)- 48(卡片内边距),屏宽小于约 358 时会被挤破,
   * 故改成等分 + 上限 82:402 宽下与设计稿一致,窄屏自动收窄。
   */
  socialBtn: {
    flex: 1,
    minWidth: 0,
    maxWidth: 82,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },

  gdprTip: {
    marginTop: 8,
    fontFamily: fonts.inter,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    color: colors.textSoft,
  },
  pressed: { opacity: 0.85 },
});
