/**
 * 忘记密码 · 第一步:输入手机号发验证码(Figma Onboarding · Login Forgot Password `3602:9946`)
 *
 * 改版稿四张按顺序是同一条链路:
 *   `3602:9946`  本页:输入手机号 → Send OTP / Cancel
 *   `3606:10208` 验证码空态 / `3606:10672` 填满态 → `VerifyOtp`(scene=reset)
 *   `3606:10832` 设新密码 → `ResetPassword`,成功弹 Success Overlay `3606:11034` → 回登录
 * 本页发码失败且是「号码不能重置」时弹 Error Phone number overlay `3712:10240`。
 *
 * 设计稿实测:
 *   外壳   AuthShell,**无顶部栏**(无返回键 / 无右上角入口,只保留 pt68 占位)
 *   卡片   `--tab` 圆角 24,padding 24,无描边无投影;内容两段 gap 16
 *   上段   gap 16:小标题 Inter 400/16(行高 24)`--text` 左对齐
 *          → 手机号框 `--secondary` #D9E1FB 高 52 圆角 12 p16,行内 gap 12:
 *            fluent:phone-20-filled 主色 → 「+95」Inter 400/16 `--text` → gap 8 → 输入框
 *          → 说明 Inter 400/16(行高 26)`--text-2`
 *   下段   两枚按钮 gap 10:
 *          Send OTP  主色底 py16 圆角 12,Inter 400/16(行高 24)白字
 *          Cancel    1px 主色描边 py17 圆角 12,Inter 500/14(行高 20)tracking 0.14 #204DDA
 *
 * 对设计稿的偏离:
 *   - 占位符稿面是 Inter Light Italic,RN 的 TextInput 占位符与正文共用一个 fontFamily,
 *     且项目未加载 Inter Light,这里用常规体(与登录页一致)。
 *   - 稿里区号旁没有下拉箭头和竖线(登录页有),按稿去掉;区号固定 +95,本页不提供切换。
 *
 * 错误分流(后端 `SmsVerifyService::send` scene=reset):
 *   40401 该手机号尚未注册 / 40301 账号已冻结或已注销 → 弹 Error overlay(这两个码不 Toast)
 *   其余(42911 限流、50021/50022 短信渠道不可用、40001 格式)→ request 层按后端文案 Toast
 *   ⚠ 后端先校验短信渠道再校验号码,所以**站点没配短信渠道时**未注册号码也只会拿到 50021。
 * 号码格式不对(前端 isMobile)仍用 Toast,不弹 overlay —— 那不是「账号不符合条件」。
 */

import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/request';
import { API_CODE } from '@/api/types';
import { apiSmsSend } from '@/api/user';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import HomeIcon from '@/components/home/HomeIcon';
import AuthShell from '@/components/user/AuthShell';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { digitsOnly, isMobile } from '@/utils/validate';

/** 与登录/注册页一致:固定 +95(缅甸),区号选择未实现 */
const COUNTRY_CODE = '+95';
/** 号码本身不能走重置的两类:未注册(40401)、冻结 / 注销(40301) */
const NOT_ELIGIBLE_CODES: number[] = [API_CODE.NOT_FOUND, API_CODE.FORBIDDEN];

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const showToast = useCommonStore((s) => s.showToast);

  const [mobile, setMobile] = useState('');
  const [sending, setSending] = useState(false);
  const [notEligible, setNotEligible] = useState(false);
  const inputRef = useRef<TextInput | null>(null);

  /* 稿面空号码时 Send OTP 也是实色(不是 50% 禁用态),空号 / 格式错交给 submit 里的 Toast */
  const canSubmit = !sending;

  /** 退出整个找回流程:本页由登录页 push 而来,返回即回登录页 */
  const leave = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Login');
  };

  const submit = async () => {
    if (!isMobile(mobile)) {
      showToast(t('user.invalidMobile'));
      return;
    }
    const target = mobile.trim();
    setSending(true);
    try {
      const sent = await apiSmsSend({ mobile: target, scene: 'reset' }, { silentCodes: NOT_ELIGIBLE_CODES });
      navigation.navigate('VerifyOtp', {
        scene: 'reset',
        mobile: target,
        resendAfter: sent.resendAfter,
        pinLength: sent.pinLength,
        maskedMobile: sent.mobile,
      });
    } catch (e) {
      if (e instanceof ApiError && NOT_ELIGIBLE_CODES.includes(e.code)) {
        setNotEligible(true);
      } else if (!(e instanceof ApiError)) {
        // 限流 / 未配渠道等 ApiError 已由 request 层按后端文案 Toast;没短信就重置不了,只能停在本页
        showToast(e instanceof Error ? e.message : 'Error');
      }
    } finally {
      setSending(false);
    }
  };

  /** Retry:关掉弹窗回到号码框让用户改号 */
  const retry = () => {
    setNotEligible(false);
    inputRef.current?.focus();
  };

  /** 弹窗里的 Cancel 与页面上的 Cancel 同义:放弃找回,回登录页 */
  const cancelFromDialog = () => {
    setNotEligible(false);
    leave();
  };

  return (
    <AuthShell>
      <View style={styles.card}>
        <View style={styles.top}>
          <Text style={styles.heading}>{t('user.forgot.heading')}</Text>

          <Pressable style={styles.field} onPress={() => inputRef.current?.focus()}>
            <HomeIcon name="phone" size={20} color={colors.primary} />
            <View style={styles.fieldInner}>
              <Text style={styles.codeText}>{COUNTRY_CODE}</Text>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={mobile}
                onChangeText={(v) => setMobile(digitsOnly(v))}
                placeholder={t('user.forgot.mobilePlaceholder')}
                placeholderTextColor={colors.textSoft}
                keyboardType="phone-pad"
                maxLength={20}
                autoCapitalize="none"
                returnKeyType="send"
                onSubmitEditing={() => {
                  if (canSubmit) void submit();
                }}
              />
            </View>
          </Pressable>

          <Text style={styles.hint}>{t('user.forgot.subtitle')}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              !canSubmit && styles.ctaDisabled,
              pressed && canSubmit && styles.pressed,
            ]}
            disabled={!canSubmit}
            onPress={() => void submit()}
          >
            <Text style={styles.ctaText}>{t('user.forgot.continue')}</Text>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]} onPress={leave}>
            <Text style={styles.cancelText}>{t('user.forgot.cancel')}</Text>
          </Pressable>
        </View>
      </View>

      <ConfirmDialog
        visible={notEligible}
        icon="dismissCircle"
        iconColor={colors.hot}
        titleColor={colors.hot}
        title={t('user.forgot.notEligibleTitle')}
        message={t('user.forgot.notEligibleMessage')}
        cancelLabel={t('user.forgot.cancel')}
        confirmLabel={t('user.forgot.retry')}
        onCancel={cancelFromDialog}
        onConfirm={retry}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },

  top: { width: '100%', gap: 16 },
  heading: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.softBlue,
  },
  fieldInner: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeText: { fontFamily: fonts.inter, fontSize: 16, color: colors.heading },
  /* minWidth 0 同登录页:web 端 <input> 的 min-width:auto 会撑破字段 */
  input: { flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 16, color: colors.heading },

  hint: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 26, color: colors.textSoft },

  actions: { width: '100%', gap: 10 },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  cancelText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#204DDA',
    textAlign: 'center',
  },
  pressed: { opacity: 0.85 },
});
