/** Local-only merchant registration, KYC, and 2FA prototype flow from Figma. */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
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
  SimpleIcon,
  WhiteStepScaffold,
} from '@/components/onboarding/MerchantFlowComponents';
import { colors, PAGE_PADDING } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useCommonStore } from '@/store/commonStore';
import { useMerchantStore } from '@/store/merchantStore';
import { useRegistrationStore } from '@/store/registrationStore';
import { apiApplicationSave, apiApplicationStatus, apiApplicationSubmit, apiKycRequirements, apiKycSubmit, apiKycUpload, apiRegistrationChannels, apiRegistrationOtpSend, apiRegistrationOtpVerify } from '@/api/merchant';
import type { KycDocument, RegistrationChannel } from '@/api/types';

const OTP_LENGTH = 6;

function Heading({ title, subtitle, centered = false }: { title: string; subtitle: string; centered?: boolean }) {
  return <View style={[styles.heading, centered && styles.center]}><Text style={[styles.headingTitle, centered && styles.centerText]}>{title}</Text><Text style={[styles.headingSub, centered && styles.centerText]}>{subtitle}</Text></View>;
}

function OtpInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <View style={styles.otpBox}><TextInput value={value} onChangeText={(next) => onChange(next.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH))} keyboardType="number-pad" maxLength={OTP_LENGTH} autoFocus style={styles.otpInput} placeholder="- - - - - -" placeholderTextColor={colors.primary} textAlign="center" /></View>;
}

function Option({ selected, icon, label, value, onPress }: { selected: boolean; icon: 'sms' | 'mail'; label: string; value: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}><View style={[styles.optionIcon, icon === 'mail' && styles.optionIconMail]}><SimpleIcon name={icon} size={20} /></View><View style={styles.optionCopy}><Text style={styles.optionLabel}>{label}</Text><Text style={styles.optionValue}>{value}</Text></View>{selected ? <View style={styles.checkCircle}><CheckIcon size={14} /></View> : null}</Pressable>;
}

export function RegisterVerificationScreen() {
  const navigation = useNavigation();
  const showToast = useCommonStore((s) => s.showToast); const business = useRegistrationStore((s) => s.business); const beginOtp = useRegistrationStore((s) => s.beginOtp);
  const [channels, setChannels] = useState<RegistrationChannel[]>([]); const [method, setMethod] = useState<RegistrationChannel>('email'); const [sending, setSending] = useState(false);
  useEffect(() => { apiRegistrationChannels().then((data) => { const next = data.channels.map((item) => item.channel); setChannels(next); if (next[0]) setMethod(next[0]); }).catch(() => undefined); }, []);
  const recipient = method === 'email' ? business.contactEmail : business.contactPhone;
  const send = async () => { if (!recipient) { showToast(`Enter a ${method === 'email' ? 'business email' : 'mobile number'} first`); return; } setSending(true); try { const result = await apiRegistrationOtpSend(method, recipient); beginOtp(method, recipient, result.pinLength); navigation.navigate('RegisterOtp'); } catch { } finally { setSending(false); } };
  return <WhiteStepScaffold current={3} total={4} progress={0.75} onBack={() => navigation.goBack()} footer={<PrimaryButton label={sending ? 'Sending...' : 'Send OTP'} disabled={sending || channels.length === 0} onPress={send} textStyle={styles.largeButton} />}>
    <AnimatedPopIcon><IconBubble size={80} icon={<SimpleIcon name="shield" size={34} />} /></AnimatedPopIcon>
    <Heading centered title="Verify Account" subtitle="Where should we send your OTP verification code?" />
    <View style={styles.options}>{channels.includes('sms') ? <Option selected={method === 'sms'} icon="sms" label="SMS" value={business.contactPhone || 'No business phone entered'} onPress={() => setMethod('sms')} /> : null}{channels.includes('email') ? <Option selected={method === 'email'} icon="mail" label="Email" value={business.contactEmail || 'No business email entered'} onPress={() => setMethod('email')} /> : null}</View>
  </WhiteStepScaffold>;
}

export function RegisterOtpScreen() {
  const navigation = useNavigation();
  const [code, setCode] = useState(''); const showToast = useCommonStore((s) => s.showToast); const state = useRegistrationStore(); const [saving, setSaving] = useState(false);
  const verify = async () => { if (!state.channel) return; setSaving(true); try { const verified = await apiRegistrationOtpVerify(state.channel, state.recipient, code); state.verified(verified.registrationToken); const draft = await apiApplicationSave(verified.registrationToken, { companyName: state.companyName, businesses: [{ businessName: state.companyName, ...state.business }] }); const submitted = await apiApplicationSubmit(verified.registrationToken, draft.applicationId); state.setApplication(submitted); navigation.navigate('RegistrationReview'); } catch (error) { showToast(error instanceof Error ? error.message : 'Verification failed'); } finally { setSaving(false); } };
  return <WhiteStepScaffold current={4} total={4} progress={1} onBack={() => navigation.goBack()} footer={<PrimaryButton label={saving ? 'Verifying...' : 'Verify Account'} disabled={saving || code.length !== state.pinLength} onPress={verify} textStyle={styles.largeButton} />}>
    <AnimatedPopIcon><IconBubble size={80} icon={<SimpleIcon name="shield" size={34} />} /></AnimatedPopIcon>
    <Heading centered title="Enter Code" subtitle={`Enter the ${state.pinLength}-digit OTP sent to ${state.recipient}`} />
    <View style={styles.otpGroup}><OtpInput value={code} onChange={setCode} /><View style={styles.otpHelp}><Text style={styles.mutedText}>Didn't receive a code?</Text><Text style={styles.tealText}>Resend OTP</Text></View></View>
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
  const success = registration ? canUpload : approved;
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

function DocumentRow({ document, uploading, onPress }: { document: KycDocument; uploading: boolean; onPress: () => void }) {
  const uploaded = Boolean(document.fileUrl);
  return <Pressable disabled={uploading} onPress={onPress} style={({ pressed }) => [styles.documentRow, uploaded && styles.documentUploaded, pressed && styles.pressed]}><View style={styles.docIcon}><SimpleIcon name="file" size={20} color={uploaded ? colors.success : colors.primary} /></View><View style={styles.docCopy}><Text style={styles.docTitle}>{document.name}</Text>{uploaded ? <Text style={styles.fileName}>{document.fileUrl.split('/').pop() || 'Uploaded file'}</Text> : <Text style={[styles.required]}>{document.required ? 'REQUIRED' : 'OPTIONAL'}</Text>}</View><View style={[styles.uploadAction, uploaded && styles.uploadedAction]}>{uploading ? <Text style={styles.fileName}>...</Text> : uploaded ? <CheckIcon color={colors.success} size={18} /> : <SimpleIcon name="upload" size={20} />}</View></Pressable>;
}

export function KycDocumentsScreen() {
  const navigation = useNavigation();
  const showToast = useCommonStore((s) => s.showToast);
  const registration = useRegistrationStore();
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const loadRequirements = async () => {
    if (!registration.registrationToken || !registration.applicationId) { setLoading(false); return; }
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
  const allRequiredUploaded = documents.length > 0 && documents.filter((document) => document.required).every((document) => Boolean(document.fileUrl));
  return <WhiteStepScaffold current={1} total={1} progress={1} onBack={() => navigation.goBack()} scroll footer={<PrimaryButton label={submitting ? 'Submitting...' : 'Submit to Admin'} disabled={loading || submitting || !allRequiredUploaded} onPress={submit} textStyle={styles.largeButton} />}>
    <Heading title="KYC Documents" subtitle="Upload the documents requested by the administrator to proceed." />
    <View style={styles.alert}><SimpleIcon name="info" size={20} color={colors.warning} /><Text style={styles.alertText}>KYC upload is available only after an administrator sends a request. Required documents must be uploaded before submission.</Text></View>
    <View style={styles.documents}><View style={styles.documentsHeader}><View style={styles.numberBadge}><Text style={styles.numberText}>1</Text></View><Text style={styles.documentsTitle}>Requested Documents</Text><Text style={styles.fileType}>PDF/JPG/PNG</Text></View>{loading ? <Text style={styles.mutedText}>Loading document requirements...</Text> : documents.map((document) => <DocumentRow key={document.docType} document={document} uploading={uploading[document.docType] === true} onPress={() => void chooseFile(document)} />)}</View>
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
  options: { width: '100%', gap: 12 }, option: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 24, padding: 14, borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 8 }, optionSelected: { borderColor: colors.info, backgroundColor: colors.primaryLight }, optionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, optionIconMail: { backgroundColor: colors.primaryLight }, optionCopy: { flex: 1, gap: 4 }, optionLabel: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 20, color: colors.slate900 }, optionValue: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 20, color: colors.slate900, opacity: 0.8 }, checkCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  otpGroup: { width: '100%', gap: 16 }, otpBox: { width: '100%', minHeight: 64, borderWidth: 1, borderColor: colors.slate900, borderRadius: 12 }, otpInput: { minHeight: 62, paddingHorizontal: 18, fontFamily: fonts.interBold, fontSize: 20, letterSpacing: 8, color: colors.primary }, otpHelp: { flexDirection: 'row', justifyContent: 'space-between' }, mutedText: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.slate900, opacity: 0.8 }, tealText: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 21, color: colors.primary },
  alert: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 17, borderWidth: 1, borderColor: colors.warning, borderRadius: 12, backgroundColor: 'rgba(254,243,199,0.4)' }, alertText: { flex: 1, fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 21, color: colors.warning, opacity: 0.86 }, documents: { width: '100%', gap: 16, padding: 16, borderWidth: 0.5, borderColor: colors.slate900, borderRadius: 16 }, documentsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 }, numberBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, numberText: { fontFamily: fonts.interSemi, fontSize: 16, color: colors.surface }, documentsTitle: { flex: 1, fontFamily: fonts.interSemi, fontSize: 16, color: colors.slate900 }, fileType: { fontFamily: fonts.outfit, fontSize: 12, color: colors.slate900, opacity: 0.6 }, documentRow: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E2E8F0', borderRadius: 12, backgroundColor: colors.canvas }, documentUploaded: { borderStyle: 'solid', borderColor: colors.successLight, backgroundColor: '#F4FBF5' }, docIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, docCopy: { flex: 1, gap: 4 }, docTitle: { fontFamily: fonts.interSemi, fontSize: 14, color: colors.slate900 }, required: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: '#FEE2E2', fontFamily: fonts.interBold, fontSize: 10, color: '#DC2626' }, fileName: { fontFamily: fonts.inter, fontSize: 12, color: colors.slate900, opacity: 0.8 }, uploadAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, uploadedAction: { borderRadius: 18, backgroundColor: colors.successLight },
  loginRoot: { flex: 1, backgroundColor: colors.primary }, loginHeader: { alignItems: 'center', gap: 8, paddingHorizontal: PAGE_PADDING, paddingTop: 4 }, loginBack: { position: 'absolute', top: 4, left: PAGE_PADDING, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }, logo: { width: 109, height: 80, marginTop: 8 }, loginTitle: { fontFamily: fonts.outfitBold, fontSize: 20, lineHeight: 30, color: colors.surface, textTransform: 'uppercase' }, loginSub: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 21, color: colors.surface, opacity: 0.8, textAlign: 'center' }, loginSheet: { flex: 1, marginTop: 32, paddingTop: 48, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface }, accessField: { marginHorizontal: PAGE_PADDING, position: 'relative', borderWidth: 1, borderColor: colors.slate900, borderRadius: 8 }, accessLabel: { position: 'absolute', zIndex: 1, top: -9, left: 12, paddingHorizontal: 4, backgroundColor: colors.surface, fontFamily: fonts.inter, fontSize: 12, color: colors.slate900, opacity: 0.6 }, accessInput: { minHeight: 54, paddingHorizontal: 17, fontFamily: fonts.inter, fontSize: 16, color: colors.slate900 }, loginFooter: { marginTop: 'auto', gap: 24, padding: PAGE_PADDING, paddingTop: 25, paddingBottom: 40, borderTopWidth: 1, borderTopColor: colors.canvas }, orRow: { flexDirection: 'row', alignItems: 'center', gap: 16 }, line: { flex: 1, height: 1, backgroundColor: '#E2E8F0' }, orText: { fontFamily: fonts.inter, fontSize: 12, color: colors.slate900, opacity: 0.8 }, qrButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.slate900, borderRadius: 12 }, qrText: { fontFamily: fonts.outfit, fontSize: 16, color: colors.slate900 },
  scannerRoot: { flex: 1, backgroundColor: colors.slate900 }, scannerBack: { zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: PAGE_PADDING, paddingTop: 4 }, scannerBackText: { fontFamily: fonts.inter, fontSize: 14, color: colors.surface, opacity: 0.8 }, scanArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 38 }, scanFrame: { width: 215, height: 215, overflow: 'hidden', borderWidth: 2, borderColor: colors.primary, borderRadius: 24 }, scanLine: { width: 195, height: 3, marginLeft: 8, borderRadius: 2, backgroundColor: colors.primary }, scannerInfo: { width: 358, alignItems: 'center', gap: 16 }, scannerText: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 21, color: colors.surface, opacity: 0.8, textAlign: 'center' },
  authQr: { width: 260, height: 260, alignSelf: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8 }, manualKey: { width: '100%', gap: 8 }, manualLabel: { fontFamily: fonts.interSemi, fontSize: 12, color: '#64748B' }, keyBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: colors.canvas }, keyText: { fontFamily: fonts.interBold, fontSize: 14, color: colors.slate900 }, copyAction: { flexDirection: 'row', alignItems: 'center', gap: 4 }, copyText: { fontFamily: fonts.interBold, fontSize: 12, color: colors.primary },
  biometricFooter: { width: '100%', alignItems: 'center', gap: 16 }, later: { fontFamily: fonts.inter, fontSize: 14, color: colors.slate900, opacity: 0.8 }, biometric: { width: 160, height: 160, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderRadius: 80, backgroundColor: 'rgba(13,148,136,0.05)' }, ring: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: 'rgba(13,148,136,0.07)' }, core: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, shield: { position: 'absolute', top: 10, right: -10, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, bolt: { position: 'absolute', bottom: 10, left: -8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0F2FE' }, trust: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: colors.canvas }, trustText: { fontFamily: fonts.interMedium, fontSize: 12, color: '#64748B' },
});
