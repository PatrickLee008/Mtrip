/**
 * 关联邮箱 / 关联手机号(Consumer App PRD 模块 19.2「账户安全」),路由参数 `kind` 区分两条流程
 *
 * 页壳沿用「更多」子页的 MorePageLayout(取代原 UI-only 的 Edit Email 页 `1797:4630`:
 * 「Linked email」卡 + 说明 + 底部主色 CTA),同一页分两步:
 *   1. 输入:显示当前已关联值 → 输入新邮箱 / +95 手机号 → 前端先做格式校验 → Send Verification Code
 *      后端再判「与当前相同」(40931 → 行内提示,不发码)与「已被其他账号关联」(40932 → 行内提示)
 *   2. 验证码:「已发送到 …」+ 验证码输入 + 倒计时重发 → Verify and Save,验码通过后端才写库
 *      码错(40021)留在本步重填;过期(40022)清空并提示重新获取
 * 任一步点 Cancel / 返回都不改动现有的邮箱或手机号(PRD「退出或取消,现有信息必须保持不变」)。
 * 底部提供「无法访问当前邮箱 / 手机号?联系客服」入口(PRD 账户找回 / 客服流程)。
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/request';
import { API_CODE } from '@/api/types';
import {
  apiEmailBind,
  apiEmailSendCode,
  apiPhoneBind,
  apiPhoneSendCode,
  type ContactCodeResult,
} from '@/api/user';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';
import { maskEmail, maskMobile } from '@/utils/format';
import { isEmail } from '@/utils/validate';

/** 缅甸手机号:去掉 +95 / 前导 0 后为 9 开头共 8~10 位(与后端 AccountContact::myanmarMobile 同口径) */
export function normalizeMyanmarMobile(input: string): string | null {
  const raw = input.trim();
  if (raw === '' || /[^\d\s\-()+]/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+') || (digits.startsWith('959') && digits.length >= 11)) {
    if (!digits.startsWith('95')) return null;
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) digits = digits.slice(1);
  return /^9\d{7,9}$/.test(digits) ? digits : null;
}

function formatCountdown(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** 本页自行给出文案的业务码:不让 request 层再弹一遍后端文案 */
const SILENT: number[] = [
  API_CODE.CONTACT_UNCHANGED,
  API_CODE.CONTACT_IN_USE,
  API_CODE.SMS_CODE_INVALID,
  API_CODE.SMS_CODE_EXPIRED,
  API_CODE.SMS_CHANNEL_UNAVAILABLE,
  API_CODE.SMS_REQUIRED_UNAVAILABLE,
  API_CODE.PARAM_ERROR,
];

export default function LinkContactScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { kind } = useRoute<RouteProp<RootStackParamList, 'LinkContact'>>().params;
  const isEmailKind = kind === 'email';
  const profile = useUserStore((s) => s.profile);
  const setProfile = useUserStore((s) => s.setProfile);
  const showToast = useCommonStore((s) => s.showToast);

  const current = isEmailKind ? maskEmail(profile?.email) : maskMobile(profile?.mobile);
  const hasCurrent = Boolean(current);

  const [step, setStep] = useState<'input' | 'code'>('input');
  const [value, setValue] = useState('');
  /** 已发码的规范化目标:验码时用它,防止用户在第二步回头改了输入框 */
  const [target, setTarget] = useState('');
  const [sent, setSent] = useState<ContactCodeResult | null>(null);
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const counting = left > 0;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  /** 业务码 → 本页文案;其余错误交给 request 层的 Toast */
  const messageOf = (e: unknown): string => {
    if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Error';
    switch (e.code) {
      case API_CODE.CONTACT_UNCHANGED:
        return t(isEmailKind ? 'more.linkContact.sameEmail' : 'more.linkContact.samePhone');
      case API_CODE.CONTACT_IN_USE:
        return t(isEmailKind ? 'more.linkContact.emailInUse' : 'more.linkContact.phoneInUse');
      case API_CODE.SMS_CODE_INVALID:
        return t('more.linkContact.codeInvalid');
      case API_CODE.SMS_CODE_EXPIRED:
        return t('more.linkContact.codeExpired');
      case API_CODE.SMS_CHANNEL_UNAVAILABLE:
      case API_CODE.SMS_REQUIRED_UNAVAILABLE:
        return t('more.linkContact.unavailable');
      case API_CODE.PARAM_ERROR:
        return t(isEmailKind ? 'more.linkContact.invalidEmail' : 'more.linkContact.invalidPhone');
      default:
        return e.message;
    }
  };

  const sendCode = async (normalized: string) => {
    const options = { silentCodes: SILENT };
    const result = isEmailKind
      ? await apiEmailSendCode(normalized, options)
      : await apiPhoneSendCode(normalized, options);
    setSent(result);
    setLeft(result.resendAfter);
    setCode('');
  };

  /** 第 1 步:前端格式校验 → 发码(与当前相同 / 已被占用由后端判定,结果行内展示) */
  const submitInput = async () => {
    if (submitting) return;
    const normalized = isEmailKind
      ? isEmail(value) ? value.trim().toLowerCase() : null
      : normalizeMyanmarMobile(value);
    if (!normalized) {
      setError(t(isEmailKind ? 'more.linkContact.invalidEmail' : 'more.linkContact.invalidPhone'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await sendCode(normalized);
      setTarget(normalized);
      setStep('code');
    } catch (e) {
      if (!(e instanceof ApiError) || SILENT.includes(e.code)) setError(messageOf(e));
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (left > 0 || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await sendCode(target);
      showToast(t('more.linkContact.codeSent'));
    } catch (e) {
      if (!(e instanceof ApiError) || SILENT.includes(e.code)) setError(messageOf(e));
    } finally {
      setSubmitting(false);
    }
  };

  /** 第 2 步:验码通过后端才保存;成功后刷新本地资料并返回账户页 */
  const submitCode = async () => {
    if (submitting || code.length < 4) return;
    setSubmitting(true);
    setError('');
    try {
      const options = { silentCodes: SILENT };
      const next = isEmailKind
        ? await apiEmailBind(target, code, options)
        : await apiPhoneBind(target, code, options);
      await setProfile(next);
      showToast(t(isEmailKind ? 'more.linkContact.emailLinked' : 'more.linkContact.phoneLinked'));
      navigation.goBack();
    } catch (e) {
      if (e instanceof ApiError && e.code === API_CODE.SMS_CODE_EXPIRED) setCode('');
      if (!(e instanceof ApiError) || SILENT.includes(e.code)) setError(messageOf(e));
    } finally {
      setSubmitting(false);
    }
  };

  /** 回到第 1 步改目标(已发出的码作废由后端按新目标覆盖) */
  const editTarget = () => {
    setStep('input');
    setCode('');
    setError('');
  };

  const title = t(isEmailKind ? 'more.linkContact.emailTitle' : 'more.linkContact.phoneTitle');
  const canSubmit = step === 'input' ? value.trim() !== '' && !submitting : code.length >= 4 && !submitting;

  return (
    <MorePageLayout
      title={title}
      footer={
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [moreShared.cta, !canSubmit && styles.disabled, pressed && canSubmit && moreShared.pressed]}
            disabled={!canSubmit}
            onPress={() => void (step === 'input' ? submitInput() : submitCode())}
          >
            <Text style={moreShared.ctaText}>
              {step === 'input' ? t('more.linkContact.sendCode') : t('more.linkContact.verify')}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && moreShared.pressed]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryText}>{t('more.linkContact.cancel')}</Text>
          </Pressable>
        </View>
      }
    >
      <View style={[moreShared.panel, styles.panel]}>
        <Text style={styles.label}>
          {t(isEmailKind ? 'more.linkContact.currentEmail' : 'more.linkContact.currentPhone')}
        </Text>
        <Text style={styles.value}>{current || t('more.linkContact.notLinked')}</Text>

        {step === 'input' ? (
          <>
            <Text style={styles.desc}>
              {isEmailKind
                ? t(hasCurrent ? 'more.linkContact.emailDescChange' : 'more.linkContact.emailDescAdd')
                : t(hasCurrent ? 'more.linkContact.phoneDescChange' : 'more.linkContact.phoneDescAdd')}
            </Text>
            <Text style={styles.fieldLabel}>
              {t(isEmailKind ? 'more.linkContact.emailLabel' : 'more.linkContact.phoneLabel')}
            </Text>
            <View style={[styles.inputRow, error !== '' && styles.inputError]}>
              {isEmailKind ? null : <Text style={styles.prefix}>+95</Text>}
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={(text) => {
                  setValue(text);
                  if (error) setError('');
                }}
                placeholder={t(isEmailKind ? 'more.linkContact.emailPlaceholder' : 'more.linkContact.phonePlaceholder')}
                placeholderTextColor={colors.textSoft}
                keyboardType={isEmailKind ? 'email-address' : 'phone-pad'}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={isEmailKind ? 254 : 20}
                onSubmitEditing={() => void submitInput()}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.sentRow}>
              <Text style={[styles.desc, styles.flex]}>
                {t('more.linkContact.codeSentTo', {
                  target: (isEmailKind ? sent?.email : sent?.mobile) || target,
                  length: sent?.pinLength ?? 6,
                })}
              </Text>
              <Pressable onPress={editTarget} hitSlop={8}>
                <Text style={styles.link}>{t('more.linkContact.change')}</Text>
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>{t('more.linkContact.codeTitle')}</Text>
            <View style={[styles.inputRow, error !== '' && styles.inputError]}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={(text) => {
                  setCode(text.replace(/\D/g, '').slice(0, sent?.pinLength ?? 8));
                  if (error) setError('');
                }}
                placeholder={t('more.linkContact.codePlaceholder')}
                placeholderTextColor={colors.textSoft}
                keyboardType="number-pad"
                maxLength={sent?.pinLength ?? 8}
                onSubmitEditing={() => void submitCode()}
              />
            </View>
            <Pressable disabled={left > 0 || submitting} onPress={() => void resend()} hitSlop={8}>
              <Text style={[styles.link, (left > 0 || submitting) && styles.disabled]}>
                {left > 0
                  ? t('more.linkContact.resendIn', { seconds: formatCountdown(left) })
                  : t('more.linkContact.resend')}
              </Text>
            </Pressable>
          </>
        )}

        {error !== '' ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={[moreShared.panel, styles.helpPanel]}>
        <Text style={styles.desc}>{t('more.linkContact.needHelp')}</Text>
        <Pressable onPress={() => navigation.navigate('Chat', { type: 2 })} hitSlop={8}>
          <Text style={styles.link}>{t('more.linkContact.contactSupport')}</Text>
        </Pressable>
      </View>
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 8 },
  helpPanel: { gap: 4 },
  flex: { flex: 1 },
  label: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 32, color: colors.heading },
  value: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft },
  desc: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 22, color: colors.textSoft },
  fieldLabel: { marginTop: 8, fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 20, color: colors.heading },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 14,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  inputError: { borderColor: colors.hot },
  prefix: { fontFamily: fonts.interMedium, fontSize: 16, color: colors.heading },
  /* minWidth 0:web 端 <input> 的 min-width:auto 会把行撑破(同 VerifyOtpScreen) */
  input: { flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 16, color: colors.heading },
  codeInput: { letterSpacing: 4 },
  sentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  link: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 22, color: colors.primary },
  error: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 20, color: colors.hot },
  disabled: { opacity: 0.5 },
  footer: { gap: 12 },
  secondary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryText: { fontFamily: fonts.outfit, fontSize: 16, lineHeight: 28, color: colors.primary },
});
