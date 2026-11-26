import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { apiCancelDeletion, apiCurrentDeletion, apiSendDeletionOtp, apiSubmitDeletion, type DeletionChannel, type DeletionRequest } from '@/api/deletion';
import { useCommonStore } from '@/store/commonStore';
import { clearDeletionReceipt, saveDeletionReceipt } from '@/utils/deletionReceipt';
import { MenuDialog, ui } from './MenuUi';

export default function MerchantDeletionDialog({ visible, accountId, onClose }: { visible: boolean; accountId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const [data, setData] = useState<Awaited<ReturnType<typeof apiCurrentDeletion>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [channel, setChannel] = useState<DeletionChannel | ''>('');
  const [token, setToken] = useState('');
  const [otp, setOtp] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [seconds, setSeconds] = useState(0);

  async function keepReceipt(request: DeletionRequest) {
    try {
      if (request.status === 'pending') await saveDeletionReceipt(request, accountId);
      else await clearDeletionReceipt(request.id);
    } catch { showToast(t('menu.security.deletion.receiptFailed')); }
  }

  async function load() {
    setBusy(true);
    setFailed(false);
    try {
      const result = await apiCurrentDeletion();
      setData(result);
      setChannel(result.channels[0]?.channel ?? '');
      if (result.request) await keepReceipt(result.request);
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!visible) return;
    setData(null);
    setReason('');
    setDetails('');
    setToken('');
    setOtp('');
    setResendAt(0);
    setSeconds(0);
    void load();
  }, [visible, accountId]);

  useEffect(() => {
    if (!visible || !resendAt) return;
    function tick() { setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000))); }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [resendAt, visible]);

  async function send() {
    if (busy || !channel || seconds > 0) return;
    setBusy(true);
    try {
      const challenge = await apiSendDeletionOtp(channel);
      setToken(challenge.challengeToken);
      setOtp('');
      setSeconds(challenge.resendAfter);
      setResendAt(Date.now() + challenge.resendAfter * 1000);
      showToast(t('menu.security.deletion.sent', { recipient: challenge.recipient }));
    } catch { /* The API displays the error. */ }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!reason || !token || busy) return;
    setBusy(true);
    try {
      const request = await apiSubmitDeletion({ reason, details: details.trim(), challengeToken: token, otpCode: otp });
      setData({ request, channels: [] });
      setToken('');
      setOtp('');
      await keepReceipt(request);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error.code === 40901 || error.code === -1)) await load();
    } finally { setBusy(false); }
  }

  async function cancel(request: DeletionRequest) {
    setBusy(true);
    try {
      const result = await apiCancelDeletion(request.id);
      await keepReceipt(result);
      await load();
    } catch { await load(); }
    finally { setBusy(false); }
  }

  function confirmCancel(request: DeletionRequest) {
    Alert.alert(t('menu.security.deletion.withdraw'), t('menu.security.deletion.withdrawConfirm'), [
      { text: t('dashboardHome.cancel'), style: 'cancel' },
      { text: t('menu.security.deletion.withdraw'), onPress: () => void cancel(request) },
    ]);
  }

  const request = data?.request;
  const pending = request?.status === 'pending';
  const allowed = reason !== '' && (reason !== 'other' || details.trim() !== '');
  const key = 'menu.security.deletion';
  function button(label: string, action: () => void, disabled = false, outline = false) {
    return <Pressable style={[ui.button, outline && ui.outline, disabled && ui.disabled]} onPress={action} disabled={disabled}
      accessibilityRole="button" accessibilityState={{ disabled }}>
      <Text style={[ui.buttonText, outline && ui.outlineText]}>{label}</Text>
    </Pressable>;
  }

  return <MenuDialog visible={visible} title={t('menu.security.closure')} onClose={() => { if (!busy) onClose(); }}>
    <View style={styles.content}>
      {!data && busy ? <ActivityIndicator /> : null}
      {failed ? button(t(key + '.retry'), () => void load(), busy, true) : null}
      {request ? <>
        <Text style={ui.title}>{t(key + '.' + request.status)}</Text>
        {request.reviewNote ? <Text style={ui.body}>{request.reviewNote}</Text> : null}
        {pending ? <>
          <Text style={ui.body}>{t(key + '.pendingCopy')}</Text>
          {button(t(key + '.withdraw'), () => confirmCancel(request), busy, true)}
        </> : null}
      </> : null}
      {data && !pending && !failed ? <>
        <Text style={ui.body}>{t(key + '.confirmCopy')}</Text>
        {data.channels.length === 0 ? <Text style={ui.body}>{t(key + '.noChannels')}</Text> : <>
          <Text style={ui.title}>{t('menu.security.reason')}</Text>
          <View style={styles.options}>
            {['unused', 'privacy', 'other'].map((item) => <Pressable key={item} style={[ui.option, reason === item && ui.selected]}
              disabled={busy} onPress={() => setReason(item)} accessibilityRole="radio" accessibilityState={{ checked: reason === item }}>
              <Text style={ui.body}>{t('menu.security.' + item)}</Text>
            </Pressable>)}
          </View>
          <TextInput style={styles.input} value={details} onChangeText={setDetails} maxLength={500} multiline editable={!busy}
            placeholder={t('menu.security.reasonDetails')} accessibilityLabel={t('menu.security.reasonDetails')} />
          <Text style={ui.title}>{t(key + '.channel')}</Text>
          {data.channels.map((item) => <Pressable key={item.channel} style={[ui.option, channel === item.channel && ui.selected]}
            disabled={busy} onPress={() => { setChannel(item.channel); setToken(''); setOtp(''); }}
            accessibilityRole="radio" accessibilityState={{ checked: channel === item.channel }}>
            <Text style={ui.body}>{t(key + '.' + item.channel)} · {item.recipient}</Text>
          </Pressable>)}
          {button(t(seconds > 0 ? key + '.resendAfter' : key + '.send', { seconds }), () => void send(), busy || !allowed || !channel || seconds > 0, true)}
          {token ? <TextInput style={styles.input} value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, ''))}
            maxLength={6} keyboardType="number-pad" autoComplete="one-time-code" editable={!busy}
            placeholder={t(key + '.otp')} accessibilityLabel={t(key + '.otp')} /> : null}
          {button(t('menu.security.submitRequest'), () => void submit(), busy || !allowed || !token || otp.length !== 6)}
        </>}
      </> : null}
    </View>
  </MenuDialog>;
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, minHeight: 44, padding: 10, color: '#1E293B' },
});
