import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { apiMerchantContacts } from '@/api/merchant';
import type { RootStackParamList } from '@/navigation/types';
import type { Lang } from '@/config/global';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { changeLanguage } from '@/i18n';
import { useCommonStore } from '@/store/commonStore';
import { useMerchantStore } from '@/store/merchantStore';
import { MenuAvatar, MenuDialog, MenuHeader, MenuIcon, ui } from './MenuUi';
import type { MenuIconName } from './MenuUi';

export default function MenuSettingsScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'MenuSettings'>) {
  const { section } = route.params;
  const { t } = useTranslation();
  const profile = useMerchantStore((s) => s.profile);
  const lang = useCommonStore((s) => s.lang);
  const setLang = useCommonStore((s) => s.setLang);
  const showToast = useCommonStore((s) => s.showToast);
  const [language, setLanguage] = useState<Lang>(lang);
  const [languagePicker, setLanguagePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closure, setClosure] = useState(false);
  const [reason, setReason] = useState('');
  const [company, setCompany] = useState(profile?.subjectName || '');
  const [contacts, setContacts] = useState({ email: '', sms: '' });
  const [contactsFailed, setContactsFailed] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(section === 'profile');
  const [alerts, setAlerts] = useState<Record<string, boolean>>({ booking: true, cancellation: true, finance: false, security: true });
  const unavailable = () => showToast(t('menu.unavailable'));
  useEffect(() => {
    if (section !== 'profile') return;
    let active = true;
    apiMerchantContacts().then(({ contacts: rows }) => {
      if (active) setContacts({ email: rows.find((r) => r.channel === 'email')?.recipient || '', sms: rows.find((r) => r.channel === 'sms')?.recipient || '' });
    }).catch(() => { if (active) setContactsFailed(true); }).finally(() => { if (active) setContactsLoading(false); });
    return () => { active = false; };
  }, [section]);
  const saveLanguage = async () => {
    if (saving || language === lang) return;
    setSaving(true);
    try { await setLang(language); changeLanguage(language); showToast(t('menu.languageSaved', { lng: language })); }
    catch { showToast(t('menu.saveFailed')); }
    finally { setSaving(false); }
  };
  const field = (key: string, value: string, editable = false, multiline = false) => <View style={[styles.field, multiline && styles.address]} key={key}>
    <Text style={styles.fieldLabel}>{t(`menu.profile.${key}`)}</Text>
    <TextInput style={styles.input} accessibilityLabel={t(`menu.profile.${key}`)} value={value} onChangeText={editable ? setCompany : undefined} editable={editable} placeholder={t('menu.notAvailable')} placeholderTextColor="#94A3B8" multiline={multiline} />
  </View>;
  const select = (icon: MenuIconName, value: string, onPress?: () => void) => <Pressable style={[styles.select, !onPress && ui.disabled]} onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityState={{ disabled: !onPress }}><MenuIcon name={icon} size={18} color={colors.primary} /><Text style={styles.selectText}>{value}</Text><MenuIcon name="down" size={16} /></Pressable>;
  const preference = (key: string) => <View style={styles.alertRow} key={key}><View style={styles.copy}><Text style={ui.title}>{t(`menu.alerts.${key}`)}</Text><Text style={[ui.body, styles.description]}>{t(`menu.alerts.${key}Copy`)}</Text></View><Switch accessibilityLabel={t(`menu.alerts.${key}`)} value={!!alerts[key]} onValueChange={(value) => setAlerts((current) => ({ ...current, [key]: value }))} trackColor={{ false: '#E2E8F0', true: colors.primary }} thumbColor="#FFFFFF" /></View>;
  const disabledSave = <Pressable style={[ui.button, ui.disabled]} disabled accessibilityRole="button" accessibilityState={{ disabled: true }}><Text style={ui.buttonText}>{t('menu.save')}</Text></Pressable>;
  return <SafeAreaView style={ui.root} edges={['top', 'bottom']}><StatusBar style="dark" /><View style={ui.shell}>
    <MenuHeader title={t(`menu.pages.${section}`)} onBack={() => navigation.goBack()} onNotifications={() => navigation.navigate('Notifications')} />
    <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      {section === 'profile' ? <>
        <View style={styles.logo}><MenuAvatar name={profile?.realName || profile?.username || ''} large /><Pressable style={[ui.button, ui.outline]} onPress={unavailable} accessibilityRole="button"><Text style={[ui.buttonText, ui.outlineText]}>{t('menu.profile.changeLogo')}</Text></Pressable><Text style={ui.body}>{t('menu.profile.logoSize')}</Text></View>
        {field('company', company, true)}{field('registration', '')}
        {contactsLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {contactsFailed ? <Text style={[ui.body, styles.notice]}>{t('menu.contactsFailed')}</Text> : null}
        {field('email', contacts.email)}{field('phone', contacts.sms)}{field('address', '', false, true)}
        <View style={ui.footer}><Text style={[ui.body, ui.footerCopy]}>{t('menu.profile.pending')}</Text>{disabledSave}</View>
      </> : null}
      {section === 'notifications' ? <>
        <Text style={ui.section}>{t('menu.alerts.email')}</Text>
        {['booking', 'cancellation', 'finance'].map(preference)}
        <Text style={[ui.section, { marginTop: 38 }]}>{t('menu.alerts.sms')}</Text>{preference('security')}
        <View style={ui.footer}><Text style={[ui.body, ui.footerCopy]}>{t('menu.alerts.preview')}</Text>{disabledSave}</View>
      </> : null}
      {section === 'security' ? <>
        <View style={ui.card}><View style={styles.iconTile}><MenuIcon name="shield" color={colors.primary} /></View><Text style={ui.title}>{t('menu.security.twoFa')}</Text><Text style={[ui.body, styles.description]}>{t('menu.security.twoFaCopy')}</Text><Text style={[ui.body, styles.description]}>{t('menu.security.statusUnknown')}</Text><View style={styles.securityBottom}><Pressable onPress={unavailable} accessibilityRole="button"><Text style={styles.dangerText}>{t('menu.security.reset')}</Text></Pressable><Text style={ui.body}>--</Text></View></View>
        {Platform.OS !== 'web' ? <View style={ui.card}><Text style={ui.title}>{t('menu.security.biometric')}</Text><Text style={[ui.body, styles.description]}>{t('menu.security.biometricPending')}</Text></View> : null}
        {profile?.isOwner ? <Pressable style={ui.card} accessibilityRole="button" onPress={() => setClosure(true)}><View style={styles.inline}><Text style={[ui.title, styles.copy]}>{t('menu.security.closure')}</Text><MenuIcon name="right" size={16} /></View><Text style={[ui.body, styles.description]}>{t('menu.security.closureCopy')}</Text></Pressable> : null}
        <Text style={[ui.section, { marginTop: 20 }]}>{t('menu.security.sessions')}</Text><View style={styles.emptySessions}><MenuIcon name="shield" size={28} /><Text style={ui.body}>{t('menu.security.sessionsUnavailable')}</Text></View>
        <Pressable style={[ui.button, ui.outline, styles.sessionButton, ui.disabled]} disabled accessibilityRole="button" accessibilityState={{ disabled: true }}><Text style={styles.dangerText}>{t('menu.security.logoutOthers')}</Text></Pressable>
      </> : null}
      {section === 'localization' ? <>
        <View style={ui.card}><Text style={ui.title}>{t('menu.locale.language')}</Text><Text style={[ui.body, styles.description]}>{t('menu.locale.languageCopy')}</Text>{select('globe', language === 'zh-CN' ? '简体中文' : 'English (US)', () => setLanguagePicker(true))}</View>
        <View style={ui.card}><Text style={ui.title}>{t('menu.locale.timezone')}</Text><Text style={[ui.body, styles.description]}>{t('menu.locale.timezoneCopy')}</Text>{select('clock', Intl.DateTimeFormat().resolvedOptions().timeZone || t('menu.notAvailable'))}</View>
        <View style={ui.card}><Text style={ui.title}>{t('menu.locale.currency')}</Text><Text style={[ui.body, styles.description]}>{t('menu.locale.currencyCopy')}</Text>{select('currency', t('menu.locale.currencyUnavailable'))}</View>
        <View style={ui.card}><Text style={ui.title}>{t('menu.locale.dateTime')}</Text><Text style={[ui.body, styles.description]}>{t('menu.locale.dateTimeCopy')}</Text><View style={styles.formatGroup}><Text style={ui.title}>{t('menu.locale.date')}</Text>{['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((format) => <View style={styles.format} key={format}><Text style={ui.body}>{format}</Text></View>)}</View><Text style={ui.title}>{t('menu.locale.time')}</Text>{['24', '12'].map((format) => <View style={styles.format} key={format}><Text style={ui.body}>{t(`menu.locale.hour${format}`)}</Text></View>)}</View>
        <View style={ui.footer}><Pressable style={[ui.button, ui.outline, styles.copy]} disabled={saving} onPress={() => setLanguage(lang)} accessibilityRole="button"><Text style={[ui.buttonText, ui.outlineText]}>{t('menu.reset')}</Text></Pressable><Pressable style={[ui.button, styles.copy, (saving || language === lang) && ui.disabled]} disabled={saving || language === lang} onPress={() => void saveLanguage()} accessibilityRole="button" accessibilityState={{ disabled: saving || language === lang }}><Text style={ui.buttonText}>{t(saving ? 'menu.saving' : 'menu.save')}</Text></Pressable></View>
        <Text style={[ui.body, styles.notice]}>{t('menu.locale.languageOnly')}</Text>
      </> : null}
    </ScrollView>
  </View>
    <MenuDialog visible={languagePicker} title={t('menu.locale.language')} onClose={() => setLanguagePicker(false)}>{(['en-US', 'zh-CN'] as const).map((value) => <Pressable key={value} style={[ui.option, language === value && ui.selected]} accessibilityRole="radio" accessibilityState={{ checked: language === value }} onPress={() => { setLanguage(value); setLanguagePicker(false); }}><Text style={ui.title}>{value === 'zh-CN' ? '简体中文' : 'English (US)'}</Text></Pressable>)}</MenuDialog>
    <MenuDialog visible={closure} title={t('menu.security.closure')} onClose={() => setClosure(false)}><View style={styles.warning}><MenuIcon name="shield" color="#DC2626" /><Text style={[ui.body, styles.copy]}>{t('menu.security.closureCopy')}</Text></View><Text style={ui.title}>{t('menu.security.reason')}</Text><View style={styles.reasons}>{['unused', 'privacy', 'other'].map((key) => <Pressable style={[styles.reason, reason === key && ui.selected]} key={key} accessibilityRole="radio" accessibilityState={{ checked: reason === key }} onPress={() => setReason(key)}><Text style={ui.body}>{t(`menu.security.${key}`)}</Text></Pressable>)}</View><TextInput style={styles.reasonInput} multiline accessibilityLabel={t('menu.security.reasonDetails')} placeholder={t('menu.security.reasonDetails')} /><Text style={[ui.body, styles.notice]}>{t('menu.security.closurePending')}</Text><Pressable style={[ui.button, ui.disabled]} disabled accessibilityRole="button" accessibilityState={{ disabled: true }}><Text style={ui.buttonText}>{t('menu.security.submitRequest')}</Text></Pressable><Pressable style={[ui.button, ui.outline, { marginTop: 12 }]} onPress={() => setClosure(false)} accessibilityRole="button"><Text style={[ui.buttonText, ui.outlineText]}>{t('dashboardHome.cancel')}</Text></Pressable></MenuDialog>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  copy: { flex: 1 }, inline: { flexDirection: 'row', alignItems: 'center', gap: 12 }, logo: { alignItems: 'center', gap: 16, marginBottom: 28, marginTop: 8 },
  field: { position: 'relative', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, marginBottom: 24, minHeight: 54, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  fieldLabel: { position: 'absolute', top: -9, left: 14, paddingHorizontal: 5, backgroundColor: colors.canvas, fontFamily: fonts.inter, fontSize: 12, color: '#64748B' },
  input: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 22, color: '#64748B', padding: 0, minHeight: 24 }, address: { minHeight: 78 },
  description: { marginTop: 8 }, alertRow: { flexDirection: 'row', alignItems: 'center', gap: 18, minHeight: 92, paddingVertical: 18, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  notice: { marginVertical: 16 }, iconTile: { width: 40, height: 40, backgroundColor: colors.canvas, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  securityBottom: { borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  dangerText: { fontFamily: fonts.interMedium, fontSize: 12, color: '#DC2626' }, emptySessions: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingVertical: 24, gap: 14 },
  sessionButton: { borderColor: '#DC2626', alignSelf: 'flex-start', marginTop: 'auto', marginBottom: 24 },
  select: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, minHeight: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 8, marginTop: 18 }, selectText: { flex: 1, fontFamily: fonts.inter, fontSize: 12, color: '#1E293B' },
  formatGroup: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0', marginBottom: 20 }, format: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, padding: 10, marginTop: 8, opacity: 0.5 },
  warning: { backgroundColor: '#FEF2F2', borderRadius: 6, padding: 12, gap: 10, flexDirection: 'row', marginBottom: 24 }, reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, reason: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, padding: 8 },
  reasonInput: { minHeight: 80, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, padding: 12, marginTop: 12, fontFamily: fonts.inter, fontSize: 13, color: '#1E293B', textAlignVertical: 'top' },
});
