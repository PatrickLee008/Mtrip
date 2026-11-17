/**
 * 账户注销(Consumer App PRD 模块 19;入口:更多 → 账户 → 管理您的账户 → 账户删除)
 *
 * 三个状态,同一页内切换(PRD UI 页面流程图 image_25):
 *   warning  注销警告 + 规则说明(进行中预订 / 钱包余额 / 90 天保留 / 新账号不恢复)→ Continue
 *   confirm  输入 DELETE(区分大小写,前后端都校验)→ Confirm account deletion
 *   blocked  后端判定拦截(40933):按 blockers 列出原因 + 「Contact customer support」进在线客服
 * 任一状态下「Cancel and keep my account」直接返回,不做任何改动。
 * 注销成功:后端已吊销旧 Token,这里只清本地登录态(不再调 logout 接口),回到登录 / 注册页。
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/request';
import { API_CODE } from '@/api/types';
import { apiDeleteAccount, type AccountDeletionBlocked } from '@/api/user';
import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';

/** 与后端 AccountDeletionPolicy::CONFIRM_WORD 一致 */
const CONFIRM_WORD = 'DELETE';

function formatAmount(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : value;
}

export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const clearLocal = useUserStore((s) => s.clearLocal);
  const showToast = useCommonStore((s) => s.showToast);

  const [step, setStep] = useState<'warning' | 'confirm' | 'blocked'>('warning');
  const [word, setWord] = useState('');
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState<AccountDeletionBlocked | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const keep = () => navigation.goBack();

  const confirmDeletion = async () => {
    if (submitting) return;
    if (word !== CONFIRM_WORD) {
      setError(t('more.deleteAccount.confirmMismatch'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiDeleteAccount(word, { silentCodes: [API_CODE.ACCOUNT_DELETION_BLOCKED, API_CODE.PARAM_ERROR] });
      clearLocal();
      showToast(t('more.deleteAccount.success'));
      navigation.reset({ index: 1, routes: [{ name: 'MainTabs' }, { name: 'Login' }] });
    } catch (e) {
      if (e instanceof ApiError && e.code === API_CODE.ACCOUNT_DELETION_BLOCKED) {
        setBlocked((e.data as AccountDeletionBlocked | null) ?? { blockers: [], ongoingBookings: 0, walletBalance: '0' });
        setStep('blocked');
      } else if (e instanceof ApiError && e.code === API_CODE.PARAM_ERROR) {
        setError(t('more.deleteAccount.confirmMismatch'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const rules = [
    t('more.deleteAccount.ruleBookings'),
    t('more.deleteAccount.ruleWallet'),
    t('more.deleteAccount.ruleRetention'),
    t('more.deleteAccount.ruleNewAccount'),
  ];

  const primary =
    step === 'warning'
      ? { label: t('more.deleteAccount.continue'), onPress: () => setStep('confirm'), enabled: true, danger: false }
      : step === 'confirm'
        ? {
            label: t('more.deleteAccount.confirm'),
            onPress: () => void confirmDeletion(),
            enabled: word !== '' && !submitting,
            danger: true,
          }
        : {
            label: t('more.deleteAccount.contactSupport'),
            onPress: () => navigation.navigate('Chat', { type: 2 }),
            enabled: true,
            danger: false,
          };

  return (
    <MorePageLayout
      title={t('more.deleteAccount.title')}
      footer={
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              moreShared.cta,
              primary.danger && styles.dangerCta,
              !primary.enabled && styles.disabled,
              pressed && primary.enabled && moreShared.pressed,
            ]}
            disabled={!primary.enabled}
            onPress={primary.onPress}
          >
            <Text style={moreShared.ctaText}>{primary.label}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.secondary, pressed && moreShared.pressed]} onPress={keep}>
            <Text style={styles.secondaryText}>{t('more.deleteAccount.keep')}</Text>
          </Pressable>
        </View>
      }
    >
      {step === 'warning' ? (
        <View style={[moreShared.panel, styles.panel]}>
          <HomeIcon name="alert" size={40} color={colors.hot} />
          <Text style={styles.title}>{t('more.deleteAccount.warningTitle')}</Text>
          <Text style={styles.body}>{t('more.deleteAccount.warningBody')}</Text>
          {rules.map((rule) => (
            <View key={rule} style={styles.ruleRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={[styles.body, styles.flex]}>{rule}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {step === 'confirm' ? (
        <View style={[moreShared.panel, styles.panel]}>
          <Text style={styles.title}>{t('more.deleteAccount.confirmTitle')}</Text>
          <Text style={styles.body}>{t('more.deleteAccount.confirmHint')}</Text>
          <TextInput
            style={[styles.input, error !== '' && styles.inputError]}
            value={word}
            onChangeText={(text) => {
              setWord(text);
              if (error) setError('');
            }}
            placeholder={t('more.deleteAccount.confirmPlaceholder')}
            placeholderTextColor={colors.textSoft}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            onSubmitEditing={() => void confirmDeletion()}
          />
          {error !== '' ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}

      {step === 'blocked' && blocked ? (
        <View style={[moreShared.panel, styles.panel]}>
          <HomeIcon name="dismissCircle" size={40} color={colors.hot} />
          <Text style={styles.title}>{t('more.deleteAccount.blockedTitle')}</Text>
          {blocked.blockers.includes('ongoing_booking') ? (
            <View style={styles.ruleRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={[styles.body, styles.flex]}>
                {t('more.deleteAccount.blockedBooking', { count: blocked.ongoingBookings })}
              </Text>
            </View>
          ) : null}
          {blocked.blockers.includes('wallet_balance') ? (
            <View style={styles.ruleRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={[styles.body, styles.flex]}>
                {t('more.deleteAccount.blockedWallet', { amount: formatAmount(blocked.walletBalance) })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  flex: { flex: 1 },
  title: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 28, color: colors.heading },
  body: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 22, color: colors.label },
  ruleRow: { flexDirection: 'row', gap: 8 },
  bullet: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 22, color: colors.label },
  input: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: '#FFFFFF',
    fontFamily: fonts.interMedium,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.heading,
  },
  inputError: { borderColor: colors.hot },
  error: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 20, color: colors.hot },
  footer: { gap: 12 },
  dangerCta: { backgroundColor: colors.hot },
  disabled: { opacity: 0.5 },
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
