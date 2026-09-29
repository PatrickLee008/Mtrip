/** Local-only merchant registration, KYC, and 2FA prototype flow from Figma. */

import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PrimaryButton from '@/components/common/PrimaryButton';
import {
  AnimatedPopIcon,
  AppDownloadModal,
  BackIcon,
  CheckIcon,
  IconBubble,
  ResultStatusScreen,
  SetupCompleteModal,
  SignatureCard,
  SignatureModal,
  SimpleIcon,
  TermsModal,
  WhiteStepScaffold,
} from '@/components/onboarding/MerchantFlowComponents';
import { colors, PAGE_PADDING } from '@/config/theme';
import { ONBOARDING_PROTOTYPE } from '@/config/env';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';
import { useMerchantStore } from '@/store/merchantStore';
import { useRegistrationStore } from '@/store/registrationStore';
import { apiApplicationStatus, apiKycRequirements, apiKycSubmit, apiKycUpload, apiRegistrationChannels, apiRegistrationOtpSend, apiRegistrationOtpVerify } from '@/api/merchant';
import type { KycDocument, RegistrationChannel } from '@/api/types';

const OTP_LENGTH = 6;

function Heading({ title, subtitle, centered = false }: { title: string; subtitle: string; centered?: boolean }) {
  return <View style={[styles.heading, centered && styles.center]}><Text style={[styles.headingTitle, centered && styles.centerText]}>{title}</Text><Text style={[styles.headingSub, centered && styles.centerText]}>{subtitle}</Text></View>;
}

/**
 * OTP 输入框:占位符与已输入数字都要居中。
 * 注意 `textAlign` 必须写在 style 里 —— react-native-web 的 TextInput `forwardPropsList` 不转发 `textAlign` prop,
 * 以 prop 传入在 Web 上会被静默丢弃(原生端有效),所以两端统一用 style。
 * `paddingLeft` 比 `paddingRight` 多出 letterSpacing,用于抵消最后一个字符的尾部字距造成的左偏。
 */
function OtpInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <View style={styles.otpBox}><TextInput value={value} onChangeText={(next) => onChange(next.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH))} keyboardType="number-pad" maxLength={OTP_LENGTH} autoFocus style={styles.otpInput} placeholder="- - - - - -" placeholderTextColor={colors.primary} /></View>;
}

/**
 * 渠道选项卡:配色随选中态切换,与渠道类型无关(Figma `344:827` 选中 / `344:856` 未选中)。
 * 选中:卡片 teal light + Info Blue 2px 描边、图标底白、图标主色;未选中:卡片白 + Slate 200 描边、图标底 teal light、图标 Slate 900。
 */
function Option({ selected, icon, label, value, onPress }: { selected: boolean; icon: 'sms' | 'mail'; label: string; value: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}><View style={[styles.optionIcon, selected ? styles.optionIconSelected : styles.optionIconIdle]}><SimpleIcon name={icon} size={20} color={selected ? colors.primary : colors.slate900} /></View><View style={styles.optionCopy}><Text style={styles.optionLabel}>{label}</Text><Text style={styles.optionValue}>{value}</Text></View>{selected ? <View style={styles.checkCircle}><CheckIcon size={14} /></View> : null}</Pressable>;
}

export function RegisterVerificationScreen() {
  const navigation = useNavigation();
  const showToast = useCommonStore((s) => s.showToast); const business = useRegistrationStore((s) => s.business); const beginOtp = useRegistrationStore((s) => s.beginOtp);
  // 默认渠道是 SMS;站点未启用 SMS 时才回退到后端返回的第一个可用渠道。
  const [channels, setChannels] = useState<RegistrationChannel[]>([]); const [method, setMethod] = useState<RegistrationChannel>('sms'); const [sending, setSending] = useState(false);
  useEffect(() => { if (ONBOARDING_PROTOTYPE) return; apiRegistrationChannels().then((data) => { const next = data.channels.map((item) => item.channel); setChannels(next); setMethod((current) => (next.includes(current) ? current : next[0] ?? current)); }).catch(() => undefined); }, []);
  // 静态原型不清求 `/register/config`,渠道列表为空时按稿面同时展示 SMS 与 Email。
  const visibleChannels = channels.length > 0 ? channels : ONBOARDING_PROTOTYPE ? (['sms', 'email'] as RegistrationChannel[]) : channels;
  const recipient = method === 'email' ? business.contactEmail : business.contactPhone;
  const send = async () => {
    if (ONBOARDING_PROTOTYPE) {
      // 静态原型:不发送真实验证码,用本地草稿里的联系方式(没有就用稿面示例值)直接进入 Step 3。
      beginOtp(method, recipient || (method === 'email' ? 'contact@property.com' : '9 123 456 789'), 6);
      navigation.navigate('RegisterOtp');
      return;
    }
    if (!recipient) { showToast(`Enter a ${method === 'email' ? 'business email' : 'mobile number'} first`); return; }
    setSending(true);
    try { const result = await apiRegistrationOtpSend(business.contactPhone, business.contactEmail, method); beginOtp(method, recipient, result.pinLength); navigation.navigate('RegisterOtp'); } catch { } finally { setSending(false); }
  };
  return <WhiteStepScaffold current={2} total={5} progress={0.4} onBack={() => navigation.goBack()} footer={<PrimaryButton label={sending ? 'Sending...' : 'Send OTP'} disabled={sending || visibleChannels.length === 0} onPress={send} textStyle={styles.largeButton} />}>
    <AnimatedPopIcon><IconBubble size={80} icon={<SimpleIcon name="shield" size={34} />} /></AnimatedPopIcon>
    <Heading centered title="Verify Account" subtitle="Where should we send your OTP verification code?" />
    <View style={styles.options}>{visibleChannels.includes('sms') ? <Option selected={method === 'sms'} icon="sms" label="SMS" value={business.contactPhone || 'No business phone entered'} onPress={() => setMethod('sms')} /> : null}{visibleChannels.includes('email') ? <Option selected={method === 'email'} icon="mail" label="Email" value={business.contactEmail || 'No business email entered'} onPress={() => setMethod('email')} /> : null}</View>
  </WhiteStepScaffold>;
}

export function RegisterOtpScreen() {
  const navigation = useNavigation();
  const [code, setCode] = useState(''); const showToast = useCommonStore((s) => s.showToast); const state = useRegistrationStore(); const [saving, setSaving] = useState(false);
  // Step 3 只负责校验 OTP 并保存 registration token;草稿保存与正式提交移到 Step 5 Business Details。
  const verify = async () => {
    if (ONBOARDING_PROTOTYPE) {
      // 静态原型:任意 6 位都视为通过,不取真实 registration token。
      state.verified('');
      navigation.navigate('Register');
      return;
    }
    if (!state.channel) return;
    setSaving(true);
    try { const verified = await apiRegistrationOtpVerify(state.business.contactPhone, state.business.contactEmail, state.channel, code); state.verified(verified.registrationToken); navigation.navigate('Register'); } catch (error) { showToast(error instanceof Error ? error.message : 'Verification failed'); } finally { setSaving(false); }
  };
  return <WhiteStepScaffold current={3} total={5} progress={0.6} onBack={() => navigation.goBack()} footer={<PrimaryButton label={saving ? 'Verifying...' : 'Verify & Continue'} disabled={saving || code.length !== state.pinLength} onPress={verify} textStyle={styles.largeButton} />}>
    <AnimatedPopIcon><IconBubble size={80} icon={<SimpleIcon name="shield" size={34} />} /></AnimatedPopIcon>
    <Heading centered title="Enter Code" subtitle={`Enter the ${state.pinLength}-digit OTP sent to ${state.recipient}`} />
    <View style={styles.otpGroup}><OtpInput value={code} onChange={setCode} /><View style={styles.otpHelp}><View style={styles.otpTimer}><SimpleIcon name="refresh" size={14} color={colors.slate900} /><Text style={styles.otpTimerText}>4:58</Text></View><Text style={styles.resendLink}>Resend Code?</Text></View></View>
  </WhiteStepScaffold>;
}
function ReviewScreen({ kyc = false }: { kyc?: boolean }) {
  const navigation = useNavigation();
  const registration = !kyc;
  const state = useRegistrationStore();
  const [status, setStatus] = useState(state.status);
  const refresh = async () => {
    if (!state.registrationToken || !state.applicationId) return;
    try {
      const next = await apiApplicationStatus(state.registrationToken, state.applicationId);
      state.setApplication(next);
      setStatus(next);
    } catch {
      // The request interceptor already presents a transport or business error.
    }
  };
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 20000);
    return () => clearInterval(timer);
  }, [state.applicationId, state.registrationToken]);
  const canUpload = status?.canUploadKyc === true;
  const approved = status?.status === 'approved';
  // 静态原型没有真实申请单可查,直接按「已通过」渲染,保证能继续点进 KYC 与下一步。
  const success = ONBOARDING_PROTOTYPE ? true : (registration ? canUpload : approved);
  const title = registration
    ? (canUpload ? 'KYC Documents Requested' : 'Your Registration Under Review')
    : (approved ? 'Your Application Approved By Admin' : 'Your KYC Is Under Review');
  const cardTitle = registration ? (canUpload ? 'Next Step: KYC Upload' : 'Registration Review in Progress') : (approved ? 'System Notice' : 'KYC Review in Progress');
  const cardBody = registration
    ? (canUpload ? 'Our team has requested your KYC documents. Upload the unified checklist to continue.' : 'We will notify you after an administrator reviews your registration.')
    : (approved ? 'Your Merchant Access Code has been sent to your registered mobile number or email. Use it to continue with 2-Step Verification.' : 'We will notify you as soon as your documents have been approved.');
  return <ResultStatusScreen
    status={success ? 'success' : 'loading'} title={title}
    subtitle={success ? 'Your application status has been updated.' : 'Our team will contact you within 1-3 business days.'}
    cardTitle={cardTitle} cardBody={cardBody} cardIcon={registration ? 'file' : 'info'}
    buttonLabel={registration ? 'Proceed to KYC Upload' : 'Login to dashboard'} buttonDisabled={!success}
    onButtonPress={() => navigation.navigate(registration ? 'KycDocuments' : 'MerchantLogin')}
    notificationTitle={success ? registration ? 'KYC Request' : 'KYC Verify' : undefined}
    notificationHeading={success ? registration ? 'Documents Requested' : 'KYC Documents Confirmed!' : undefined}
    notificationBody={success ? cardBody : undefined}
  />;
}

export function RegistrationReviewScreen() { return <ReviewScreen />; }
export function KycReviewScreen() { return <ReviewScreen kyc />; }

/**
 * 静态样张:接口还没返回 KYC 清单时按 Figma 展示三份必需材料,
 * 让界面在没有注册 token 时也能走查。接入真实清单后可删除这段常量。
 */
const FIGMA_SAMPLE_DOCUMENTS: KycDocument[] = [
  { id: -1, docType: 'business_registration', name: 'Business Registration', required: true, fileUrl: '', fileSize: '' },
  { id: -2, docType: 'hotel_operating_license', name: 'Hotel Operating License', required: true, fileUrl: '', fileSize: '' },
  { id: -3, docType: 'owner_id_passport', name: 'Owner ID / Passport', required: true, fileUrl: '', fileSize: '' },
];

function DocumentRow({ document, uploading, onPress }: { document: KycDocument; uploading: boolean; onPress: () => void }) {
  const uploaded = Boolean(document.fileUrl);
  return (
    <Pressable disabled={uploading} onPress={onPress} style={({ pressed }) => [styles.documentRow, uploaded && styles.documentUploaded, pressed && styles.pressed]}>
      <View style={[styles.docIcon, uploaded && styles.docIconUploaded]}>
        <SimpleIcon name="file" size={20} color={uploaded ? colors.success : colors.primary} />
        {uploaded ? <View style={styles.docBadge}><CheckIcon size={10} /></View> : null}
      </View>
      <View style={styles.docCopy}>
        <Text style={styles.docTitle}>{document.name}</Text>
        {uploaded ? <Text style={styles.fileName}>{document.fileUrl.split('/').pop() || 'Uploaded file'}</Text> : <View style={styles.requiredBadge}><Text style={styles.requiredText}>{document.required ? 'REQUIRED' : 'OPTIONAL'}</Text></View>}
      </View>
      <View style={[styles.uploadAction, uploaded && styles.replaceAction]}>
        {uploading ? <Text style={styles.fileName}>...</Text> : <SimpleIcon name={uploaded ? 'refresh' : 'upload'} size={18} color={uploaded ? colors.slate900 : colors.primary} />}
      </View>
    </Pressable>
  );
}

export function KycDocumentsScreen() {
  const navigation = useNavigation();
  const showToast = useCommonStore((s) => s.showToast);
  const registration = useRegistrationStore();
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [termsVisible, setTermsVisible] = useState(false);
  const [signatureVisible, setSignatureVisible] = useState(false);
  const [signed, setSigned] = useState(false);
  const loadRequirements = async () => {
    if (ONBOARDING_PROTOTYPE || !registration.registrationToken || !registration.applicationId) { setLoading(false); return; }
    setLoading(true);
    try {
      const response = await apiKycRequirements(registration.registrationToken, registration.applicationId);
      setDocuments(response.documents);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void loadRequirements(); }, [registration.applicationId, registration.registrationToken]);
  const chooseFile = async (document: KycDocument) => {
    if (ONBOARDING_PROTOTYPE) {
      // 静态原型:不打开文件选择器、不真实上传,直接把该行置为已上传,方便验证「全部必需资料 + 已签名」才放开提交。
      setDocuments((items) => (items.length > 0 ? items : FIGMA_SAMPLE_DOCUMENTS).map((item) => item.docType === document.docType ? { ...item, fileUrl: `prototype://${document.docType}.pdf`, fileSize: '1.2 MB' } : item));
      showToast('Prototype: file marked as uploaded');
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0] || !registration.registrationToken || !registration.applicationId) return;
    const file = result.assets[0];
    setUploading((value) => ({ ...value, [document.docType]: true }));
    try {
      const uploaded = await apiKycUpload(registration.registrationToken, registration.applicationId, document.docType, file);
      setDocuments((items) => items.map((item) => item.docType === document.docType ? { ...item, fileUrl: uploaded.fileUrl, fileSize: uploaded.fileSize } : item));
      showToast('File uploaded successfully');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'File upload failed');
    } finally {
      setUploading((value) => ({ ...value, [document.docType]: false }));
    }
  };
  const submit = async () => {
    if (ONBOARDING_PROTOTYPE) { navigation.navigate('KycReview'); return; }
    if (!registration.registrationToken || !registration.applicationId) return;
    setSubmitting(true);
    try {
      const status = await apiKycSubmit(registration.registrationToken, registration.applicationId);
      registration.setApplication(status);
      navigation.navigate('KycReview');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'KYC submission failed');
    } finally {
      setSubmitting(false);
    }
  };
  // Figma 的 KYC 页先接受 Terms & Conditions,再签名,最后才允许 Submit to Admin。
  const shownDocuments = documents.length > 0 ? documents : FIGMA_SAMPLE_DOCUMENTS;
  const allRequiredUploaded = shownDocuments.filter((document) => document.required).every((document) => Boolean(document.fileUrl));
  return <WhiteStepScaffold current={1} total={1} progress={1} onBack={() => navigation.goBack()} scroll footer={<PrimaryButton label={submitting ? 'Submitting...' : 'Submit to Admin'} disabled={loading || submitting || !allRequiredUploaded || !signed} onPress={submit} textStyle={styles.largeButton} />}>
    <Text style={styles.pageTitle}>KYC Documents</Text>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>Upload required documents for <Text style={styles.sectionHeaderStrong}>all 1 properties</Text> to proceed.</Text>
      <View style={styles.alert}><SimpleIcon name="info" size={20} color={colors.warning} /><Text style={styles.alertText}>Our admin team must review and approve these documents before you receive dashboard access.</Text></View>
    </View>
    <View style={styles.documents}>
      <View style={styles.documentsHeader}>
        <View style={styles.numberBadge}><Text style={styles.numberText}>1</Text></View>
        <Text style={styles.documentsTitle}>Business 1 Documents</Text>
        <Text style={styles.fileType}>PDF/JPG/PNG</Text>
      </View>
      {loading ? <Text style={styles.mutedText}>Loading document requirements...</Text> : shownDocuments.map((document) => <DocumentRow key={document.docType} document={document} uploading={uploading[document.docType] === true} onPress={() => void chooseFile(document)} />)}
    </View>
    <SignatureCard signed={signed} onSign={() => setTermsVisible(true)} />
    <TermsModal visible={termsVisible} onAccept={() => { setTermsVisible(false); setSignatureVisible(true); }} onCancel={() => setTermsVisible(false)} />
    <SignatureModal visible={signatureVisible} onConfirm={() => { setSignatureVisible(false); setSigned(true); showToast('Signature confirmed'); }} onCancel={() => setSignatureVisible(false)} />
  </WhiteStepScaffold>;
}

export function MerchantLoginScreen() {
  const navigation = useNavigation();
  const showToast = useCommonStore((s) => s.showToast);
  const beginAccessCode = useMerchantStore((s) => s.beginAccessCode);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const login = async () => { setSubmitting(true); try { const challenge = await beginAccessCode(code.trim()); navigation.navigate(challenge.requiresEnrollment ? 'TwoFaSetup' : 'TwoFaVerify'); } catch (error) { showToast(error instanceof Error ? error.message : 'Access Code verification failed'); } finally { setSubmitting(false); } };
  return <SafeAreaView style={styles.loginRoot} edges={['top', 'bottom']}><StatusBar style="light" translucent backgroundColor="transparent" /><View style={styles.loginHeader}><Pressable onPress={() => navigation.goBack()} style={styles.loginBack}><BackIcon /></Pressable><Image source={require('../../../assets/images/onboarding/logo.png')} style={styles.logo} resizeMode="contain" /><Text style={styles.loginTitle}>Merchant Login</Text><Text style={styles.loginSub}>Access your dashboard using your assigned Merchant Access Code.</Text></View><View style={styles.loginSheet}><View style={styles.accessField}><Text style={styles.accessLabel}>Merchant Access Code</Text><TextInput value={code} onChangeText={setCode} placeholder="MTRP - XXXX" placeholderTextColor="rgba(30,41,59,0.6)" style={styles.accessInput} autoCapitalize="characters" /></View><View style={styles.loginFooter}><PrimaryButton label={submitting ? 'Verifying...' : 'Login to Dashboard'} disabled={!code.trim() || submitting} onPress={() => void login()} /><View style={styles.orRow}><View style={styles.line} /><Text style={styles.orText}>FIRST-TIME SETUP</Text><View style={styles.line} /></View><Pressable onPress={() => navigation.navigate('QrLogin')} style={styles.qrButton}><SimpleIcon name="qr" size={24} color={colors.slate900} /><Text style={styles.qrText}>Set up with Merchant Web</Text></Pressable></View></View></SafeAreaView>;
}

export function QrLoginScreen() {
  const navigation = useNavigation();
  return <SafeAreaView style={styles.scannerRoot} edges={['top', 'bottom']}><StatusBar style="light" translucent backgroundColor="transparent" /><Pressable onPress={() => navigation.goBack()} style={styles.scannerBack}><BackIcon /><Text style={styles.scannerBackText}>Back</Text></Pressable><View style={styles.scanArea}><View style={styles.scanFrame} /><View style={styles.scannerInfo}><SimpleIcon name="qr" size={40} color={colors.surface} /><Text style={styles.scannerText}>Scan the one-time QR code shown by Merchant Web to begin secure Authenticator setup.</Text></View></View></SafeAreaView>;
}

export function TwoFaSetupScreen() {
  const navigation = useNavigation();
  const showToast = useCommonStore((s) => s.showToast);
  const { setup, loadAppTwoFaSetup } = useMerchantStore();
  const [showDownload, setShowDownload] = useState(true);
  useEffect(() => { void loadAppTwoFaSetup().catch((error) => showToast(error instanceof Error ? error.message : 'Authenticator setup expired')); }, [loadAppTwoFaSetup, showToast]);
  return <WhiteStepScaffold current={2} total={3} progress={2 / 3} onBack={() => navigation.goBack()} footer={<PrimaryButton label="I have added the setup key" disabled={!setup} onPress={() => navigation.navigate('TwoFaVerify')} textStyle={styles.largeButton} />}>
    <Heading title="Link Authenticator" subtitle="Step 2: Add this unique setup key in your Authenticator app, then continue." />
    <View style={styles.manualKey}><Text style={styles.manualLabel}>Manual Setup Key</Text><Pressable onPress={() => showToast('Copy the setup key into your Authenticator app')} style={styles.keyBox}><Text style={styles.keyText}>{setup?.manualKey || 'Loading secure key...'}</Text><View style={styles.copyAction}><SimpleIcon name="copy" size={14} /><Text style={styles.copyText}>Copy</Text></View></Pressable></View>
    <AppDownloadModal visible={showDownload} onNext={() => setShowDownload(false)} />
  </WhiteStepScaffold>;
}

export function TwoFaVerifyScreen() {
  const navigation = useNavigation();
  const showToast = useCommonStore((s) => s.showToast);
  const verifyAppTwoFa = useMerchantStore((s) => s.verifyAppTwoFa);
  const [code, setCode] = useState('');
  const [complete, setComplete] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const verify = async () => { setVerifying(true); try { await verifyAppTwoFa(code); setComplete(true); } catch (error) { showToast(error instanceof Error ? error.message : 'Authenticator code verification failed'); } finally { setVerifying(false); } };
  return <WhiteStepScaffold current={3} total={3} progress={1} onBack={() => navigation.goBack()} footer={<PrimaryButton label={verifying ? 'Verifying...' : 'Verify & Continue'} disabled={verifying || code.length !== OTP_LENGTH} onPress={() => void verify()} textStyle={styles.largeButton} />}><Heading title="Enter Code" subtitle="Step 3: Enter the 6-digit code generated by your Authenticator app." /><OtpInput value={code} onChange={setCode} /><SetupCompleteModal visible={complete} onDashboard={() => navigation.reset({ index: 0, routes: [{ name: 'BiometricOptIn' }] })} /></WhiteStepScaffold>;
}

export function BiometricOptInScreen() {
  const navigation = useNavigation();
  const finish = () => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  return <WhiteStepScaffold current={1} total={1} progress={1} skip={finish} footer={<View style={styles.biometricFooter}><PrimaryButton label="Enable Face ID / Touch ID" onPress={finish} /><Pressable onPress={finish}><Text style={styles.later}>Maybe Later</Text></Pressable></View>}><View style={styles.biometric}><AnimatedPopIcon style={styles.ring}><AnimatedPopIcon style={styles.core}><SimpleIcon name="user" size={44} /></AnimatedPopIcon><View style={styles.shield}><SimpleIcon name="shield" size={14} color={colors.surface} /></View><View style={styles.bolt}><SimpleIcon name="bolt" size={12} color={colors.info} /></View></AnimatedPopIcon></View><Heading centered title="Enable Quick Login" subtitle="Use Face ID or Fingerprint to securely access your merchant dashboard without entering your Access Code and 2FA PIN every time." /><View style={styles.trust}><SimpleIcon name="lock" size={14} color="#64748B" /><Text style={styles.trustText}>Biometric data never leaves your device</Text></View></WhiteStepScaffold>;
}

const styles = StyleSheet.create({
  heading: { width: '100%', gap: 8 }, center: { alignItems: 'center' }, centerText: { textAlign: 'center' }, headingTitle: { fontFamily: fonts.interBold, fontSize: 24, lineHeight: 36, color: colors.slate900 }, headingSub: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.slate900, opacity: 0.8 }, largeButton: { fontSize: 18, lineHeight: 27 }, pressed: { opacity: 0.76 },
  options: { width: '100%', gap: 12 }, option: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 24, padding: 14, borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 8 }, optionSelected: { borderColor: colors.info, backgroundColor: colors.primaryLight }, optionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, optionIconSelected: { backgroundColor: colors.surface }, optionIconIdle: { backgroundColor: colors.primaryLight }, optionCopy: { flex: 1, gap: 4 }, optionLabel: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 20, color: colors.slate900 }, optionValue: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 20, color: colors.slate900, opacity: 0.8 }, checkCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  otpGroup: { width: '100%', gap: 16 }, otpBox: { width: '100%', minHeight: 64, borderWidth: 1, borderColor: colors.slate900, borderRadius: 12 }, otpInput: { minHeight: 62, paddingRight: 18, paddingLeft: 26, textAlign: 'center', fontFamily: fonts.interBold, fontSize: 20, letterSpacing: 8, color: colors.primary }, otpHelp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, otpTimer: { flexDirection: 'row', alignItems: 'center', gap: 4 }, otpTimerText: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 18, color: colors.slate900 }, resendLink: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 18, color: colors.slate900, textDecorationLine: 'underline' }, mutedText: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.slate900, opacity: 0.8 }, tealText: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 21, color: colors.primary },
  pageTitle: { fontFamily: fonts.outfitBold, fontSize: 24, lineHeight: 36, color: colors.slate900 },
  sectionHeader: { width: '100%', gap: 24 }, sectionHeaderText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.slate900, opacity: 0.8 }, sectionHeaderStrong: { fontFamily: fonts.interBold },
  alert: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 16, borderWidth: 1, borderColor: colors.warning, borderRadius: 12, backgroundColor: 'rgba(254,243,199,0.4)' }, alertText: { flex: 1, fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.warning, opacity: 0.8 }, documents: { width: '100%', gap: 24, padding: 16, borderWidth: 0.5, borderColor: colors.slate900, borderRadius: 16 }, documentsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 }, numberBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, numberText: { fontFamily: fonts.interSemi, fontSize: 16, color: colors.surface }, documentsTitle: { flex: 1, fontFamily: fonts.interSemi, fontSize: 16, color: colors.slate900 }, fileType: { fontFamily: fonts.outfit, fontSize: 12, color: colors.slate900, opacity: 0.6 }, documentRow: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E2E8F0', borderRadius: 12, backgroundColor: colors.canvas }, documentUploaded: { borderStyle: 'solid', borderColor: colors.success, backgroundColor: colors.successLight }, docIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }, docIconUploaded: { borderRadius: 7, backgroundColor: colors.successLight }, docBadge: { position: 'absolute', right: -3, top: -3, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success, borderWidth: 1.7, borderColor: colors.successLight }, docCopy: { flex: 1, gap: 4 }, docTitle: { fontFamily: fonts.interSemi, fontSize: 14, color: colors.slate900 }, requiredBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: '#FEE2E2' }, requiredText: { fontFamily: fonts.interBold, fontSize: 10, letterSpacing: 0.5, color: '#DC2626' }, fileName: { fontFamily: fonts.inter, fontSize: 12, color: colors.slate900, opacity: 0.8 }, uploadAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, replaceAction: { width: 34, height: 34, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 4, backgroundColor: colors.surface },
  loginRoot: { flex: 1, backgroundColor: colors.primary }, loginHeader: { alignItems: 'center', gap: 8, paddingHorizontal: PAGE_PADDING, paddingTop: 4 }, loginBack: { position: 'absolute', top: 4, left: PAGE_PADDING, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }, logo: { width: 109, height: 80, marginTop: 8 }, loginTitle: { fontFamily: fonts.outfitBold, fontSize: 20, lineHeight: 30, color: colors.surface, textTransform: 'uppercase' }, loginSub: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 21, color: colors.surface, opacity: 0.8, textAlign: 'center' }, loginSheet: { flex: 1, marginTop: 32, paddingTop: 48, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface }, accessField: { marginHorizontal: PAGE_PADDING, position: 'relative', borderWidth: 1, borderColor: colors.slate900, borderRadius: 8 }, accessLabel: { position: 'absolute', zIndex: 1, top: -9, left: 12, paddingHorizontal: 4, backgroundColor: colors.surface, fontFamily: fonts.inter, fontSize: 12, color: colors.slate900, opacity: 0.6 }, accessInput: { minHeight: 54, paddingHorizontal: 17, fontFamily: fonts.inter, fontSize: 16, color: colors.slate900 }, loginFooter: { marginTop: 'auto', gap: 24, padding: PAGE_PADDING, paddingTop: 25, paddingBottom: 40, borderTopWidth: 1, borderTopColor: colors.canvas }, orRow: { flexDirection: 'row', alignItems: 'center', gap: 16 }, line: { flex: 1, height: 1, backgroundColor: '#E2E8F0' }, orText: { fontFamily: fonts.inter, fontSize: 12, color: colors.slate900, opacity: 0.8 }, qrButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.slate900, borderRadius: 12 }, qrText: { fontFamily: fonts.outfit, fontSize: 16, color: colors.slate900 },
  scannerRoot: { flex: 1, backgroundColor: colors.slate900 }, scannerBack: { zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: PAGE_PADDING, paddingTop: 4 }, scannerBackText: { fontFamily: fonts.inter, fontSize: 14, color: colors.surface, opacity: 0.8 }, scanArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 38 }, scanFrame: { width: 215, height: 215, overflow: 'hidden', borderWidth: 2, borderColor: colors.primary, borderRadius: 24 }, scannerInfo: { width: 358, alignItems: 'center', gap: 16 }, scannerText: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 21, color: colors.surface, opacity: 0.8, textAlign: 'center' },
  authQr: { width: 260, height: 260, alignSelf: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8 }, manualKey: { width: '100%', gap: 8 }, manualLabel: { fontFamily: fonts.interSemi, fontSize: 12, color: '#64748B' }, keyBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: colors.canvas }, keyText: { fontFamily: fonts.interBold, fontSize: 14, color: colors.slate900 }, copyAction: { flexDirection: 'row', alignItems: 'center', gap: 4 }, copyText: { fontFamily: fonts.interBold, fontSize: 12, color: colors.primary },
  biometricFooter: { width: '100%', alignItems: 'center', gap: 16 }, later: { fontFamily: fonts.inter, fontSize: 14, color: colors.slate900, opacity: 0.8 }, biometric: { width: 160, height: 160, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderRadius: 80, backgroundColor: 'rgba(13,148,136,0.05)' }, ring: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: 'rgba(13,148,136,0.07)' }, core: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, shield: { position: 'absolute', top: 10, right: -10, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, bolt: { position: 'absolute', bottom: 10, left: -8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0F2FE' }, trust: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: colors.canvas }, trustText: { fontFamily: fonts.interMedium, fontSize: 12, color: '#64748B' },
});
