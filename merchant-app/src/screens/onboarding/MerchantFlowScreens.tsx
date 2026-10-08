/** Local-only merchant registration, KYC, and 2FA prototype flow from Figma. */

import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as LocalAuthentication from 'expo-local-authentication';
import QRCode from 'react-native-qrcode-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
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
import { apiActivationFinish, apiActivationTotpSetup, apiActivationTotpVerify, apiAgreement, apiAgreementRead, apiAgreementSign, apiApplicationDetail, apiApplicationStatus, apiKycRequirements, apiKycSubmit, apiKycUpload, apiRecoveryTotpSetup, apiRecoveryTotpVerify, apiRegistrationChannels, apiRegistrationOtpSend, apiRegistrationOtpVerify } from '@/api/merchant';
import type { AgreementDetail, KycDocument, KycRequirements, RegistrationVerifyResult } from '@/api/types';
import type { RootStackParamList } from '@/navigation/types';
import { enableBiometric } from '@/utils/merchantSession';
import { removeOnboardingSession } from '@/utils/onboardingSession';

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
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const registration = useRegistrationStore();
  const [emailAvailable, setEmailAvailable] = useState(ONBOARDING_PROTOTYPE);
  const [configFailed, setConfigFailed] = useState(false);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (ONBOARDING_PROTOTYPE) return;
    apiRegistrationChannels()
      .then((data) => setEmailAvailable(data.channels.some((item) => item.channel === 'email')))
      .catch(() => setConfigFailed(true));
  }, []);
  const send = async () => {
    if (ONBOARDING_PROTOTYPE) {
      registration.beginOtp({ channel: 'email', recipient: registration.registrationEmail || 'contact@property.com', pinLength: 6, expiresIn: 300, resendAfter: 60, testMode: true });
      navigation.navigate('RegisterOtp');
      return;
    }
    if (!registration.registrationEmail) { showToast(t('flow.registration.emailFirst')); return; }
    setSending(true);
    try {
      const result = await apiRegistrationOtpSend(registration.registrationPhone, registration.registrationEmail, 'email');
      registration.beginOtp(result);
      navigation.navigate('RegisterOtp');
    } catch {
      // The request interceptor presents the server error.
    } finally {
      setSending(false);
    }
  };
  return <WhiteStepScaffold current={2} total={5} progress={0.4} onBack={() => navigation.goBack()} footer={<PrimaryButton label={sending ? t('flow.common.sending') : t('flow.registration.sendOtp')} disabled={sending || !emailAvailable} onPress={send} textStyle={styles.largeButton} />}>
    <AnimatedPopIcon><IconBubble size={80} icon={<SimpleIcon name="shield" size={34} />} /></AnimatedPopIcon>
    <Heading centered title={t('flow.registration.verifyTitle')} subtitle={t('flow.registration.verifySubtitle')} />
    <View style={styles.options}>{emailAvailable ? <Option selected icon="mail" label={t('register.contactInfo.email')} value={registration.registrationEmail || t('flow.registration.noEmail')} onPress={() => undefined} /> : <Text style={styles.mutedText}>{configFailed ? t('flow.registration.optionsFailed') : t('flow.registration.emailUnavailable')}</Text>}</View>
  </WhiteStepScaffold>;
}

export function RegisterOtpScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const siteId = useCommonStore((s) => s.siteId);
  const [code, setCode] = useState('');
  const showToast = useCommonStore((s) => s.showToast);
  const state = useRegistrationStore();
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [verifiedSession, setVerifiedSession] = useState<RegistrationVerifyResult | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => setVerifiedSession(null), [state.registrationPhone, state.registrationEmail]);
  const resendRemaining = Math.max(0, Math.ceil((state.resendAvailableAt - now) / 1000));
  // Step 3 只负责校验 OTP 并保存 registration token;草稿保存与正式提交移到 Step 5 Business Details。
  const verify = async () => {
    if (ONBOARDING_PROTOTYPE) {
      // 静态原型:任意 6 位都视为通过,不取真实 registration token。
      navigation.navigate('Register');
      return;
    }
    if (!state.channel) return;
    setSaving(true);
    let otpConfirmed = verifiedSession !== null;
    try {
      const verified = verifiedSession ?? await apiRegistrationOtpVerify(state.registrationPhone, state.registrationEmail, state.channel, code);
      otpConfirmed = true;
      setVerifiedSession(verified);
      await state.verified(verified, siteId);
      const detail = await apiApplicationDetail(verified.registrationToken, verified.applicationId);
      state.setApplicationDetail(detail);
      if (detail.canEdit) navigation.navigate('Register');
      else navigation.reset({ index: 0, routes: [{ name: 'RegistrationReview' }] });
    } catch (error) {
      showToast(otpConfirmed ? t('flow.registration.detailRetry') : error instanceof Error ? error.message : t('flow.common.verifyFailed'));
    } finally {
      setSaving(false);
    }
  };
  const resend = async () => {
    if (ONBOARDING_PROTOTYPE || resendRemaining > 0 || resending) return;
    setResending(true);
    try {
      const result = await apiRegistrationOtpSend(state.registrationPhone, state.registrationEmail, 'email');
      state.beginOtp(result);
      setCode('');
      setVerifiedSession(null);
      setNow(Date.now());
    } catch {
      // The request interceptor presents the server error.
    } finally {
      setResending(false);
    }
  };
  return <WhiteStepScaffold current={3} total={5} progress={0.6} onBack={() => navigation.goBack()} footer={<PrimaryButton label={saving ? t('flow.common.verifying') : verifiedSession ? t('flow.registration.continueApplication') : t('flow.common.verifyContinue')} disabled={saving || (!verifiedSession && code.length !== state.pinLength)} onPress={verify} textStyle={styles.largeButton} />}>
    <AnimatedPopIcon><IconBubble size={80} icon={<SimpleIcon name="shield" size={34} />} /></AnimatedPopIcon>
    <Heading centered title={t('flow.common.enterCode')} subtitle={t('flow.registration.otpSubtitle', { digits: state.pinLength, recipient: state.recipient })} />
    {state.testMode ? <View style={styles.testModeAlert}><SimpleIcon name="info" size={18} color={colors.warning} /><Text style={styles.testModeText}>{t('register.otp.testMode')}</Text></View> : null}
    <View style={styles.otpGroup}><OtpInput value={code} onChange={setCode} /><View style={styles.otpHelp}><View style={styles.otpTimer}><SimpleIcon name="refresh" size={14} color={colors.slate900} /><Text style={styles.otpTimerText}>{resendRemaining > 0 ? `${resendRemaining}s` : t('register.otp.ready')}</Text></View><Pressable disabled={verifiedSession !== null || resendRemaining > 0 || resending} onPress={() => void resend()}><Text style={[styles.resendLink, (verifiedSession !== null || resendRemaining > 0 || resending) && styles.resendDisabled]}>{resending ? t('register.otp.resending') : t('register.otp.resend')}</Text></Pressable></View></View>
  </WhiteStepScaffold>;
}
function ReviewScreen({ kyc = false }: { kyc?: boolean }) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const state = useRegistrationStore();
  const status = state.status;
  const refresh = async () => {
    if (!state.registrationToken || !state.applicationId) return;
    try {
      const next = await apiApplicationStatus(state.registrationToken, state.applicationId);
      state.setApplication(next);
    } catch {
      // The request interceptor already presents a transport or business error.
    }
  };
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 20000);
    return () => clearInterval(timer);
  }, [state.applicationId, state.registrationToken]);
  const needsCorrection = status?.registrationStatus === 'resubmit_required';
  const awaitingRegistration = status?.registrationStatus === 'submitted' || status?.registrationStatus === 'under_review';
  const canUpload = status?.registrationStatus === 'approved'
    && (['draft', 'resubmit_required'].includes(status.merchantKycStatus)
      || status.initialProperties.some((property) => ['draft', 'resubmit_required'].includes(property.kycStatus)));
  const pendingActivation = status?.accountStatus === 'pending_activation';
  const active = status?.accountStatus === 'active';
  const accountUnavailable = status?.accountStatus === 'suspended' || status?.accountStatus === 'disabled';
  const rejectedProperty = status?.initialProperties.find((property) => property.kycStatus === 'rejected');
  const rejected = status?.registrationStatus === 'rejected' || status?.merchantKycStatus === 'rejected' || !!rejectedProperty;
  const success = ONBOARDING_PROTOTYPE || needsCorrection || canUpload || pendingActivation || active || rejected || accountUnavailable;
  const title = needsCorrection ? t('flow.review.changesRequested')
    : rejected ? t('flow.review.rejected')
      : accountUnavailable ? t('flow.review.unavailable')
      : canUpload ? t('flow.review.submitted')
        : pendingActivation ? t('flow.review.approved')
          : active ? t('flow.review.activated')
            : status?.registrationStatus === 'approved' ? t('flow.review.kycProgress') : t('flow.review.registrationProgress');
  const cardBody = needsCorrection ? status?.reviewReason || t('flow.review.correctionBody')
    : rejected ? status?.reviewReason || status?.merchantKyc?.reviewReason || rejectedProperty?.reviewReason || t('flow.review.rejectedBody')
      : accountUnavailable ? t('flow.review.unavailableBody')
      : canUpload ? t('flow.review.uploadBody')
        : pendingActivation ? (status?.testMode ? t('flow.review.activationTestBody') : t('flow.review.activationBody'))
          : active ? t('flow.review.activeBody')
            : awaitingRegistration ? t('flow.review.awaitingBody')
              : t('flow.review.reviewBody');
  const action = () => {
    if (ONBOARDING_PROTOTYPE) navigation.navigate(kyc ? 'MerchantLogin' : 'KycDocuments');
    else if (needsCorrection) navigation.navigate('Register');
    else if (canUpload) navigation.navigate('KycDocuments');
    else if (pendingActivation) navigation.navigate('MerchantAccount', { mode: 'activation' });
    else navigation.navigate('MerchantLogin');
  };
  const startAnother = async () => {
    await removeOnboardingSession();
    state.clear();
    navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  };
  return <ResultStatusScreen
    status={success ? 'success' : 'loading'} title={title}
    subtitle={status?.appNo ? t('flow.review.applicationNo', { appNo: status.appNo }) : t('flow.review.status')}
    cardTitle={awaitingRegistration || canUpload ? t('flow.review.nextKyc') : title} cardBody={cardBody} cardIcon={kyc ? 'file' : 'info'}
    buttonLabel={rejected ? t('flow.review.rejected') : accountUnavailable ? t('flow.review.unavailable') : needsCorrection ? t('flow.review.edit') : awaitingRegistration || canUpload ? t('flow.review.proceedKyc') : pendingActivation ? t('flow.review.activate') : t('flow.twoFa.dashboardLogin')}
    buttonDisabled={!success || rejected || accountUnavailable}
    onButtonPress={action}
    secondaryLabel={kyc ? undefined : t('flow.review.anotherPhone')}
    onSecondaryPress={() => void startAnother()}
  />;
}

export function RegistrationReviewScreen() { return <ReviewScreen />; }
export function KycReviewScreen() { return <ReviewScreen kyc />; }

/**
 * 静态样张:接口还没返回 KYC 清单时按 Figma 展示三份必需材料,
 * 让界面在没有注册 token 时也能走查。接入真实清单后可删除这段常量。
 */
const FIGMA_SAMPLE_DOCUMENTS: KycDocument[] = [
  { id: -1, docType: 'business_registration', name: 'Business Registration', required: true, status: 'missing', hasFile: false, fileName: '', fileSize: '', documentVersion: 0, rejectReason: '' },
  { id: -2, docType: 'hotel_operating_license', name: 'Hotel Operating License', required: true, status: 'missing', hasFile: false, fileName: '', fileSize: '', documentVersion: 0, rejectReason: '' },
  { id: -3, docType: 'owner_id_passport', name: 'Owner ID / Passport', required: true, status: 'missing', hasFile: false, fileName: '', fileSize: '', documentVersion: 0, rejectReason: '' },
];

function DocumentRow({ document, uploading, editable, onPress }: { document: KycDocument; uploading: boolean; editable: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const uploaded = document.hasFile;
  const name = t(`flow.kyc.documentTypes.${document.docType}`, { defaultValue: document.name });
  return (
    <Pressable disabled={uploading || !editable} onPress={onPress} style={({ pressed }) => [styles.documentRow, uploaded && styles.documentUploaded, pressed && styles.pressed]}>
      <View style={[styles.docIcon, uploaded && styles.docIconUploaded]}>
        <SimpleIcon name="file" size={20} color={uploaded ? colors.success : colors.primary} />
        {uploaded ? <View style={styles.docBadge}><CheckIcon size={10} /></View> : null}
      </View>
      <View style={styles.docCopy}>
        <Text style={styles.docTitle}>{name}</Text>
        {uploaded ? <Text style={styles.fileName}>{document.fileName || t('flow.kyc.uploadedFile')}</Text> : <View style={styles.requiredBadge}><Text style={styles.requiredText}>{document.required ? t('flow.kyc.required') : t('flow.kyc.optional')}</Text></View>}
        {document.rejectReason ? <Text style={styles.fileName}>{document.rejectReason}</Text> : null}
      </View>
      <View style={[styles.uploadAction, uploaded && styles.replaceAction]}>
        {uploading ? <Text style={styles.fileName}>...</Text> : <SimpleIcon name={uploaded ? 'refresh' : 'upload'} size={18} color={uploaded ? colors.slate900 : colors.primary} />}
      </View>
    </Pressable>
  );
}

export function KycDocumentsScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const registration = useRegistrationStore();
  const [requirements, setRequirements] = useState<KycRequirements | null>(null);
  const [prototypeDocuments, setPrototypeDocuments] = useState(FIGMA_SAMPLE_DOCUMENTS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [termsVisible, setTermsVisible] = useState(false);
  const [signatureVisible, setSignatureVisible] = useState(false);
  const [prototypeSigned, setPrototypeSigned] = useState(false);
  const [agreement, setAgreement] = useState<AgreementDetail | null>(null);
  const [readReceipt, setReadReceipt] = useState('');
  const [signerName, setSignerName] = useState(registration.businesses[0]?.contactName ?? '');
  const loadRequirements = async () => {
    if (ONBOARDING_PROTOTYPE || !registration.registrationToken || !registration.applicationId) { setLoading(false); return; }
    setLoading(true);
    try {
      const response = await apiKycRequirements(registration.registrationToken, registration.applicationId);
      setRequirements(response);
    } catch {
      setRequirements(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void loadRequirements(); }, [registration.applicationId, registration.registrationToken]);
  const chooseFile = async (scopeType: 'merchant' | 'property', businessId: number, document: KycDocument) => {
    if (ONBOARDING_PROTOTYPE) {
      setPrototypeDocuments((items) => items.map((item) => item.docType === document.docType ? { ...item, status: 'pending_review', hasFile: true, fileName: `${document.docType}.pdf` } : item));
      showToast(t('flow.kyc.prototypeUploaded'));
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0] || !registration.registrationToken || !registration.applicationId) return;
    const file = result.assets[0];
    const key = `${scopeType}:${businessId}:${document.docType}`;
    setUploading((value) => ({ ...value, [key]: true }));
    try {
      await apiKycUpload(registration.registrationToken, registration.applicationId, scopeType, businessId, document.docType, file);
      await loadRequirements();
      showToast(t('flow.kyc.uploadSuccess'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('flow.kyc.uploadFailed'));
    } finally {
      setUploading((value) => ({ ...value, [key]: false }));
    }
  };
  const openTerms = async () => {
    if (ONBOARDING_PROTOTYPE) { setTermsVisible(true); return; }
    if (!registration.registrationToken || !registration.applicationId) return;
    try {
      const current = await apiAgreement(registration.registrationToken, registration.applicationId);
      setAgreement(current);
      setTermsVisible(true);
    } catch (error) { showToast(error instanceof Error ? error.message : t('flow.kyc.agreementUnavailable')); }
  };
  const confirmRead = async () => {
    if (ONBOARDING_PROTOTYPE) { setTermsVisible(false); setSignatureVisible(true); return; }
    if (!agreement || !registration.registrationToken || !registration.applicationId) return;
    try {
      const result = await apiAgreementRead(registration.registrationToken, registration.applicationId, agreement.agreementId, agreement.version);
      setReadReceipt(result.readReceipt);
      setTermsVisible(false);
      setSignatureVisible(true);
    } catch (error) { showToast(error instanceof Error ? error.message : t('flow.kyc.agreementFailed')); }
  };
  const confirmSignature = async (signature: string) => {
    if (ONBOARDING_PROTOTYPE) { setPrototypeSigned(true); setSignatureVisible(false); return; }
    if (!agreement || !readReceipt || !signerName.trim() || !registration.registrationToken || !registration.applicationId) {
      showToast(t('flow.kyc.signerRequired')); return;
    }
    try {
      await apiAgreementSign(registration.registrationToken, registration.applicationId, agreement.agreementId, agreement.version, readReceipt, signerName.trim(), signature);
      setSignatureVisible(false);
      await loadRequirements();
    } catch (error) { showToast(error instanceof Error ? error.message : t('flow.kyc.signatureFailed')); }
  };
  const submit = async () => {
    if (ONBOARDING_PROTOTYPE) { navigation.navigate('KycReview'); return; }
    if (!registration.registrationToken || !registration.applicationId) return;
    setSubmitting(true);
    try {
      const result = await apiKycSubmit(registration.registrationToken, registration.applicationId);
      setRequirements(result.status);
      const status = await apiApplicationStatus(registration.registrationToken, registration.applicationId);
      registration.setApplication(status);
      navigation.navigate('KycReview');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('flow.kyc.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };
  const scopes = ONBOARDING_PROTOTYPE
    ? [{ scopeType: 'merchant' as const, businessId: 0, name: t('flow.kyc.prototypeDocuments'), editable: true, documents: prototypeDocuments }]
    : requirements ? [
      { scopeType: 'merchant' as const, businessId: 0, name: t('flow.kyc.merchantDocuments'), editable: ['draft', 'resubmit_required'].includes(requirements.merchantKyc.status), documents: requirements.merchantKyc.documents },
      ...requirements.initialProperties.map((property) => ({ scopeType: 'property' as const, businessId: property.applicationBusinessId, name: property.businessName, editable: ['draft', 'resubmit_required'].includes(property.kycStatus), documents: property.documents })),
    ] : [];
  const editableScopes = scopes.filter((scope) => scope.editable);
  const allRequiredUploaded = editableScopes.length > 0 && editableScopes.every((scope) => scope.documents.filter((document) => document.required).every((document) => document.hasFile && ['approved', 'pending_review'].includes(document.status)));
  const signed = ONBOARDING_PROTOTYPE ? prototypeSigned : requirements?.agreement.satisfied === true;
  return <WhiteStepScaffold current={1} total={1} progress={1} onBack={() => navigation.goBack()} scroll footer={<PrimaryButton label={submitting ? t('flow.common.submitting') : t('flow.kyc.submitAdmin')} disabled={loading || submitting || !allRequiredUploaded || !signed} onPress={submit} textStyle={styles.largeButton} />}>
    <Text style={styles.pageTitle}>{t('flow.kyc.title')}</Text>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{t('flow.kyc.uploadIntro', { properties: requirements?.initialProperties.length ?? 1 })}</Text>
      <View style={styles.alert}><SimpleIcon name="info" size={20} color={colors.warning} /><Text style={styles.alertText}>{t('flow.kyc.reviewNotice')}</Text></View>
    </View>
    {loading ? <Text style={styles.mutedText}>{t('flow.kyc.loading')}</Text> : scopes.map((scope, index) => <View key={`${scope.scopeType}:${scope.businessId}`} style={styles.documents}>
      <View style={styles.documentsHeader}>
        <View style={styles.numberBadge}><Text style={styles.numberText}>{index + 1}</Text></View>
        <Text style={styles.documentsTitle}>{scope.name}</Text>
        <Text style={styles.fileType}>PDF/JPG/PNG</Text>
      </View>
      {scope.documents.map((document) => <DocumentRow key={document.docType} document={document}
        uploading={uploading[`${scope.scopeType}:${scope.businessId}:${document.docType}`] === true}
        editable={scope.editable && (document.status !== 'approved' || ONBOARDING_PROTOTYPE)}
        onPress={() => void chooseFile(scope.scopeType, scope.businessId, document)} />)}
    </View>)}
    {requirements?.agreement.status === 'test_confirmed' ? <Text style={styles.mutedText}>{t('flow.kyc.testConfirmedNotice')}</Text> : null}
    <TextInput value={signerName} onChangeText={setSignerName} placeholder={t('flow.kyc.signerName')} style={styles.accessInput} />
    <SignatureCard signed={signed} label={requirements?.agreement.status === 'test_confirmed' ? t('flow.kyc.testConfirmed') : undefined} onSign={() => void openTerms()} />
    <TermsModal visible={termsVisible} title={agreement?.title} content={agreement?.content} onAccept={() => void confirmRead()} onCancel={() => setTermsVisible(false)} />
    <SignatureModal visible={signatureVisible} onConfirm={(signature) => void confirmSignature(signature)} onCancel={() => setSignatureVisible(false)} />
  </WhiteStepScaffold>;
}

export function MerchantLoginScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const beginAccessCode = useMerchantStore((s) => s.beginAccessCode);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const login = async () => { setSubmitting(true); try { await beginAccessCode(code.trim()); navigation.navigate('TwoFaVerify', { mode: 'login' }); } catch (error) { showToast(error instanceof Error ? error.message : t('flow.login.accessFailed')); } finally { setSubmitting(false); } };
  return <SafeAreaView style={styles.loginRoot} edges={['top', 'bottom']}><StatusBar style="light" translucent backgroundColor="transparent" /><View style={styles.loginHeader}><Pressable onPress={() => navigation.goBack()} style={styles.loginBack}><BackIcon /></Pressable><Image source={require('../../../assets/images/onboarding/logo.png')} style={styles.logo} resizeMode="contain" /><Text style={styles.loginTitle}>{t('auth.loginTitle')}</Text><Text style={styles.loginSub}>{t('flow.login.subtitle')}</Text></View><ScrollView style={styles.loginSheet} contentContainerStyle={styles.loginSheetContent} keyboardShouldPersistTaps="handled"><View style={styles.accessField}><Text style={styles.accessLabel}>{t('flow.account.accessCode')}</Text><TextInput value={code} onChangeText={setCode} placeholder={t('flow.account.accessCode')} placeholderTextColor="rgba(30,41,59,0.6)" style={styles.accessInput} autoCapitalize="characters" /></View><View style={styles.loginFooter}><PrimaryButton label={submitting ? t('flow.common.verifying') : t('flow.twoFa.dashboardLogin')} disabled={!code.trim() || submitting} onPress={() => void login()} /><Pressable onPress={() => navigation.navigate('MerchantAccount', { mode: 'activation' })}><Text style={styles.tealText}>{t('flow.login.firstTime')}</Text></Pressable><Pressable onPress={() => navigation.navigate('MerchantAccount', { mode: 'login' })}><Text style={styles.tealText}>{t('flow.login.emailInstead')}</Text></Pressable><Pressable onPress={() => navigation.navigate('MerchantAccount', { mode: 'recovery' })}><Text style={styles.tealText}>{t('flow.login.authenticatorHelp')}</Text></Pressable><View style={styles.orRow}><View style={styles.line} /><Text style={styles.orText}>{t('flow.login.orContinue')}</Text><View style={styles.line} /></View><Pressable onPress={() => navigation.navigate('QrLogin')} style={styles.qrButton}><SimpleIcon name="qr" size={24} color={colors.slate900} /><Text style={styles.qrText}>{t('flow.login.scanWebQr')}</Text></Pressable></View></ScrollView></SafeAreaView>;
}

export function QrLoginScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const beginAppPairing = useMerchantStore((s) => s.beginAppPairing);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const scanInFlight = useRef(false);
  const exchange = async (data: string) => {
    if (scanInFlight.current) return;
    scanInFlight.current = true;
    setScanning(true);
    try {
      if (!/^[A-Za-z0-9_-]{43}$/.test(data)) throw new Error(t('flow.login.invalidPairing'));
      await beginAppPairing(data);
      navigation.navigate('TwoFaVerify', { mode: 'login' });
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('flow.login.pairingExpired'));
      scanInFlight.current = false;
      setScanning(false);
    }
  };
  return <SafeAreaView style={styles.scannerRoot} edges={['top', 'bottom']}><StatusBar style="light" translucent backgroundColor="transparent" /><Pressable onPress={() => navigation.goBack()} style={styles.scannerBack}><BackIcon /><Text style={styles.scannerBackText}>{t('register.back')}</Text></Pressable><View style={styles.scanArea}>{Platform.OS !== 'web' && permission?.granted ? <View style={styles.scanFrame}><CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanning ? undefined : ({ data }) => void exchange(data)} /></View> : <View style={styles.scanFrame} />}{Platform.OS === 'web' ? <Text style={styles.scannerText}>{t('flow.login.nativeScanOnly')}</Text> : permission?.granted ? null : <PrimaryButton label={t('flow.login.allowCamera')} onPress={() => void requestPermission()} />}<View style={styles.scannerInfo}><SimpleIcon name="qr" size={40} color={colors.surface} /><Text style={styles.scannerText}>{t('flow.login.scanInstruction')}</Text></View></View></SafeAreaView>;
}

export function TwoFaSetupScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const route = useRoute();
  const params = route.params as RootStackParamList['TwoFaSetup'];
  const { mode } = params;
  const showToast = useCommonStore((s) => s.showToast);
  const loadAppTwoFaSetup = useMerchantStore((s) => s.loadAppTwoFaSetup);
  const [setup, setSetup] = useState<{ manualKey: string; otpauthUri: string } | null>(null);
  const [showDownload, setShowDownload] = useState(true);
  useEffect(() => { void (mode === 'login' ? loadAppTwoFaSetup() : mode === 'activation' ? apiActivationTotpSetup(params.token) : apiRecoveryTotpSetup(params.token)).then(setSetup).catch((error) => showToast(error instanceof Error ? error.message : t('flow.twoFa.setupExpired'))); }, [mode, mode === 'login' ? '' : params.token, loadAppTwoFaSetup, showToast, t]);
  const copyKey = async () => { if (!setup) return; try { if (await Clipboard.setStringAsync(setup.manualKey)) showToast(t('flow.twoFa.keyCopied')); } catch { showToast(t('flow.twoFa.keyCopyFailed')); } };
  return <WhiteStepScaffold current={2} total={3} progress={2 / 3} onBack={() => navigation.reset({ index: 0, routes: [{ name: 'MerchantAccount', params: { mode } }] })} footer={<PrimaryButton label={t('flow.twoFa.keyAdded')} disabled={!setup} onPress={() => navigation.navigate('TwoFaVerify', params)} textStyle={styles.largeButton} />}>
    <Heading title={t('flow.twoFa.linkTitle')} subtitle={t('flow.twoFa.linkSubtitle')} />
    {setup ? <View style={styles.authQr}><QRCode value={setup.otpauthUri} size={220} backgroundColor="#FFFFFF" /></View> : <Text style={styles.mutedText}>{t('flow.twoFa.loadingQr')}</Text>}
    <View style={styles.manualKey}><Text style={styles.manualLabel}>{t('flow.twoFa.manualHint')}</Text><Pressable onPress={() => void copyKey()} style={styles.keyBox}><Text selectable style={styles.keyText}>{setup?.manualKey || t('flow.twoFa.loadingKey')}</Text><View style={styles.copyAction}><SimpleIcon name="copy" size={14} /><Text style={styles.copyText}>{t('flow.twoFa.copy')}</Text></View></Pressable></View>
    <AppDownloadModal visible={showDownload} onNext={() => setShowDownload(false)} />
  </WhiteStepScaffold>;
}

export function TwoFaVerifyScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const route = useRoute();
  const params = route.params as RootStackParamList['TwoFaVerify'];
  const showToast = useCommonStore((s) => s.showToast);
  const verifyAppTwoFa = useMerchantStore((s) => s.verifyAppTwoFa);
  const acceptSession = useMerchantStore((s) => s.acceptSession);
  const clearRegistration = useRegistrationStore((s) => s.clear);
  const [code, setCode] = useState('');
  const [complete, setComplete] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const verify = async () => { setVerifying(true); try { if (params.mode === 'login') { await verifyAppTwoFa(code); navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] }); return; } if (params.mode === 'activation') { await apiActivationTotpVerify(params.token, code); await acceptSession(await apiActivationFinish(params.token)); clearRegistration(); } else await acceptSession(await apiRecoveryTotpVerify(params.token, code)); setComplete(true); } catch (error) { showToast(error instanceof Error ? error.message : t('flow.twoFa.verifyFailed')); } finally { setVerifying(false); } };
  return <WhiteStepScaffold current={3} total={3} progress={1} onBack={() => navigation.goBack()} footer={<PrimaryButton label={verifying ? t('flow.common.verifying') : t('flow.common.verifyContinue')} disabled={verifying || code.length !== OTP_LENGTH} onPress={() => void verify()} textStyle={styles.largeButton} />}><Heading title={t('flow.common.enterCode')} subtitle={t('flow.twoFa.verifySubtitle')} /><OtpInput value={code} onChange={setCode} /><SetupCompleteModal visible={complete} onDashboard={() => navigation.reset({ index: 0, routes: [{ name: 'BiometricOptIn' }] })} /></WhiteStepScaffold>;
}

export function BiometricOptInScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const [available, setAvailable] = useState(false);
  const [enabling, setEnabling] = useState(false);
  useEffect(() => { if (Platform.OS !== 'web') void Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]).then(([hardware, enrolled]) => setAvailable(hardware && enrolled)).catch(() => setAvailable(false)); }, []);
  const finish = () => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  const enable = async () => { if (!available || enabling) return; setEnabling(true); try { const result = await LocalAuthentication.authenticateAsync({ promptMessage: t('flow.biometric.title'), disableDeviceFallback: true }); if (!result.success) return; await enableBiometric(); finish(); } catch { showToast(t('flow.biometric.enableFailed')); } finally { setEnabling(false); } };
  return <WhiteStepScaffold current={1} total={1} progress={1} skip={finish} footer={<View style={styles.biometricFooter}><PrimaryButton label={enabling ? t('flow.biometric.enabling') : t('flow.biometric.enable')} disabled={!available || enabling} onPress={() => void enable()} />{!available ? <Text style={styles.mutedText}>{t('flow.biometric.unavailable')}</Text> : null}<Pressable onPress={finish}><Text style={styles.later}>{t('flow.biometric.later')}</Text></Pressable></View>}><View style={styles.biometric}><AnimatedPopIcon style={styles.ring}><AnimatedPopIcon style={styles.core}><SimpleIcon name="user" size={44} /></AnimatedPopIcon><View style={styles.shield}><SimpleIcon name="shield" size={14} color={colors.surface} /></View><View style={styles.bolt}><SimpleIcon name="bolt" size={12} color={colors.info} /></View></AnimatedPopIcon></View><Heading centered title={t('flow.biometric.title')} subtitle={t('flow.biometric.subtitle')} /><View style={styles.trust}><SimpleIcon name="lock" size={14} color="#64748B" /><Text style={styles.trustText}>{t('flow.biometric.trust')}</Text></View></WhiteStepScaffold>;
}

const styles = StyleSheet.create({
  heading: { width: '100%', gap: 8 }, center: { alignItems: 'center' }, centerText: { textAlign: 'center' }, headingTitle: { fontFamily: fonts.interBold, fontSize: 24, lineHeight: 36, color: colors.slate900 }, headingSub: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.slate900, opacity: 0.8 }, largeButton: { fontSize: 18, lineHeight: 27 }, pressed: { opacity: 0.76 },
  options: { width: '100%', gap: 12 }, option: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 24, padding: 14, borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 8 }, optionSelected: { borderColor: colors.info, backgroundColor: colors.primaryLight }, optionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, optionIconSelected: { backgroundColor: colors.surface }, optionIconIdle: { backgroundColor: colors.primaryLight }, optionCopy: { flex: 1, gap: 4 }, optionLabel: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 20, color: colors.slate900 }, optionValue: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 20, color: colors.slate900, opacity: 0.8 }, checkCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  otpGroup: { width: '100%', gap: 16 }, otpBox: { width: '100%', minHeight: 64, borderWidth: 1, borderColor: colors.slate900, borderRadius: 12 }, otpInput: { minHeight: 62, paddingRight: 18, paddingLeft: 26, textAlign: 'center', fontFamily: fonts.interBold, fontSize: 20, letterSpacing: 8, color: colors.primary }, otpHelp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, otpTimer: { flexDirection: 'row', alignItems: 'center', gap: 4 }, otpTimerText: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 18, color: colors.slate900 }, resendLink: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 18, color: colors.slate900, textDecorationLine: 'underline' }, mutedText: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.slate900, opacity: 0.8 }, tealText: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 21, color: colors.primary },
  resendDisabled: { opacity: 0.4 }, testModeAlert: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderWidth: 1, borderColor: colors.warning, borderRadius: 10, backgroundColor: 'rgba(254,243,199,0.45)' }, testModeText: { flex: 1, fontFamily: fonts.interMedium, fontSize: 13, lineHeight: 19, color: colors.warning },
  pageTitle: { fontFamily: fonts.outfitBold, fontSize: 24, lineHeight: 36, color: colors.slate900 },
  sectionHeader: { width: '100%', gap: 24 }, sectionHeaderText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.slate900, opacity: 0.8 }, sectionHeaderStrong: { fontFamily: fonts.interBold },
  alert: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 16, borderWidth: 1, borderColor: colors.warning, borderRadius: 12, backgroundColor: 'rgba(254,243,199,0.4)' }, alertText: { flex: 1, fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.warning, opacity: 0.8 }, documents: { width: '100%', gap: 24, padding: 16, borderWidth: 0.5, borderColor: colors.slate900, borderRadius: 16 }, documentsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 }, numberBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, numberText: { fontFamily: fonts.interSemi, fontSize: 16, color: colors.surface }, documentsTitle: { flex: 1, fontFamily: fonts.interSemi, fontSize: 16, color: colors.slate900 }, fileType: { fontFamily: fonts.outfit, fontSize: 12, color: colors.slate900, opacity: 0.6 }, documentRow: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E2E8F0', borderRadius: 12, backgroundColor: colors.canvas }, documentUploaded: { borderStyle: 'solid', borderColor: colors.success, backgroundColor: colors.successLight }, docIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }, docIconUploaded: { borderRadius: 7, backgroundColor: colors.successLight }, docBadge: { position: 'absolute', right: -3, top: -3, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success, borderWidth: 1.7, borderColor: colors.successLight }, docCopy: { flex: 1, gap: 4 }, docTitle: { fontFamily: fonts.interSemi, fontSize: 14, color: colors.slate900 }, requiredBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: '#FEE2E2' }, requiredText: { fontFamily: fonts.interBold, fontSize: 10, letterSpacing: 0.5, color: '#DC2626' }, fileName: { fontFamily: fonts.inter, fontSize: 12, color: colors.slate900, opacity: 0.8 }, uploadAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, replaceAction: { width: 34, height: 34, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 4, backgroundColor: colors.surface },
  loginRoot: { flex: 1, backgroundColor: colors.primary }, loginHeader: { alignItems: 'center', gap: 8, paddingHorizontal: PAGE_PADDING, paddingTop: 4 }, loginBack: { position: 'absolute', top: 4, left: PAGE_PADDING, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }, logo: { width: 109, height: 80, marginTop: 8 }, loginTitle: { fontFamily: fonts.outfitBold, fontSize: 20, lineHeight: 30, color: colors.surface, textTransform: 'uppercase' }, loginSub: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 21, color: colors.surface, opacity: 0.8, textAlign: 'center' }, loginSheet: { flex: 1, marginTop: 32, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface }, loginSheetContent: { flexGrow: 1, paddingTop: 48 }, accessField: { marginHorizontal: PAGE_PADDING, position: 'relative', borderWidth: 1, borderColor: colors.slate900, borderRadius: 8 }, accessLabel: { position: 'absolute', zIndex: 1, top: -9, left: 12, paddingHorizontal: 4, backgroundColor: colors.surface, fontFamily: fonts.inter, fontSize: 12, color: colors.slate900, opacity: 0.6 }, accessInput: { minHeight: 54, paddingHorizontal: 17, fontFamily: fonts.inter, fontSize: 16, color: colors.slate900 }, loginFooter: { marginTop: 'auto', gap: 24, padding: PAGE_PADDING, paddingTop: 25, paddingBottom: 40, borderTopWidth: 1, borderTopColor: colors.canvas }, orRow: { flexDirection: 'row', alignItems: 'center', gap: 16 }, line: { flex: 1, height: 1, backgroundColor: '#E2E8F0' }, orText: { fontFamily: fonts.inter, fontSize: 12, color: colors.slate900, opacity: 0.8 }, qrButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.slate900, borderRadius: 12 }, qrText: { fontFamily: fonts.outfit, fontSize: 16, color: colors.slate900 },
  scannerRoot: { flex: 1, backgroundColor: colors.slate900 }, scannerBack: { zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: PAGE_PADDING, paddingTop: 4 }, scannerBackText: { fontFamily: fonts.inter, fontSize: 14, color: colors.surface, opacity: 0.8 }, scanArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 38 }, scanFrame: { width: 215, height: 215, overflow: 'hidden', borderWidth: 2, borderColor: colors.primary, borderRadius: 24 }, camera: { flex: 1 }, scannerInfo: { width: 358, alignItems: 'center', gap: 16 }, scannerText: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 21, color: colors.surface, opacity: 0.8, textAlign: 'center' },
  authQr: { width: 260, height: 260, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8 }, manualKey: { width: '100%', gap: 8 }, manualLabel: { fontFamily: fonts.interSemi, fontSize: 12, color: '#64748B' }, keyBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: colors.canvas }, keyText: { fontFamily: fonts.interBold, fontSize: 14, color: colors.slate900 }, copyAction: { flexDirection: 'row', alignItems: 'center', gap: 4 }, copyText: { fontFamily: fonts.interBold, fontSize: 12, color: colors.primary },
  biometricFooter: { width: '100%', alignItems: 'center', gap: 16 }, later: { fontFamily: fonts.inter, fontSize: 14, color: colors.slate900, opacity: 0.8 }, biometric: { width: 160, height: 160, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderRadius: 80, backgroundColor: 'rgba(13,148,136,0.05)' }, ring: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: 'rgba(13,148,136,0.07)' }, core: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, shield: { position: 'absolute', top: 10, right: -10, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, bolt: { position: 'absolute', bottom: 10, left: -8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0F2FE' }, trust: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: colors.canvas }, trustText: { fontFamily: fonts.interMedium, fontSize: 12, color: '#64748B' },
});
