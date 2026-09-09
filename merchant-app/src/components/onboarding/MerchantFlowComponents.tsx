import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import PrimaryButton from '@/components/common/PrimaryButton';
import { colors, PAGE_PADDING, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

const cardShadow = Platform.select({
  web: { boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.08)' } as unknown as ViewStyle,
  default: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  } as ViewStyle,
});

const softShadow = Platform.select({
  web: { boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.03)' } as unknown as ViewStyle,
  default: {
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  } as ViewStyle,
});

const modalShadow = Platform.select({
  web: { boxShadow: '0px 10px 40px -10px rgba(0, 0, 0, 0.08)' } as unknown as ViewStyle,
  default: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  } as ViewStyle,
});

const notificationShadow = Platform.select({
  web: { boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.25)' } as unknown as ViewStyle,
  default: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  } as ViewStyle,
});

const heroTextShadow = Platform.select({
  web: { textShadow: '0px 0px 4px rgba(0, 0, 0, 0.25)' } as unknown as TextStyle,
  default: {
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 0 },
  } as TextStyle,
});

interface BackIconProps {
  color?: string;
}

export function BackIcon({ color = colors.surface }: BackIconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M13.125 16.25L6.875 10L13.125 3.75" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ArrowRightIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M4.2 10H15.2M10.8 5.6L15.2 10L10.8 14.4" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CheckIcon({ color = colors.surface, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M16.2 5.4L8.3 13.3L4.2 9.2" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SimpleIcon({ name, color = colors.primary, size = 24 }: { name: 'shield' | 'phone' | 'sms' | 'mail' | 'file' | 'upload' | 'info' | 'lock' | 'qr' | 'copy' | 'refresh' | 'fingerprint' | 'bolt' | 'user'; color?: string; size?: number }) {
  const stroke = color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'shield' ? <Path d="M12 3.3L18.5 5.9V11.2C18.5 15.3 15.8 18.9 12 20.1C8.2 18.9 5.5 15.3 5.5 11.2V5.9L12 3.3Z" fill={stroke} /> : null}
      {name === 'phone' ? <><Rect x={7} y={3.5} width={10} height={17} rx={2.1} stroke={stroke} strokeWidth={1.8} /><Circle cx={12} cy={17.4} r={0.8} fill={stroke} /></> : null}
      {name === 'sms' ? <><Path d="M4 5.5H20V16H8L4 19V5.5Z" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" /><Line x1={7.5} y1={9} x2={16.5} y2={9} stroke={stroke} strokeWidth={1.8} strokeLinecap="round" /><Line x1={7.5} y1={12.2} x2={14} y2={12.2} stroke={stroke} strokeWidth={1.8} strokeLinecap="round" /></> : null}
      {name === 'mail' ? <><Rect x={3.5} y={5.5} width={17} height={13} rx={2} stroke={stroke} strokeWidth={1.8} /><Path d="M4.5 7L12 12.5L19.5 7" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></> : null}
      {name === 'file' ? <><Path d="M7 3.5H14L18 7.5V20.5H7V3.5Z" stroke={stroke} strokeWidth={1.7} strokeLinejoin="round" /><Path d="M14 3.8V8H18" stroke={stroke} strokeWidth={1.7} strokeLinejoin="round" /><Line x1={9.5} y1={12} x2={15} y2={12} stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Line x1={9.5} y1={15} x2={14} y2={15} stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /></> : null}
      {name === 'upload' ? <><Path d="M12 15V4.8" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" /><Path d="M8.5 8.2L12 4.8L15.5 8.2" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /><Path d="M5 14.5V19H19V14.5" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></> : null}
      {name === 'info' ? <><Circle cx={12} cy={12} r={9} fill={stroke} /><Line x1={12} y1={10.5} x2={12} y2={16} stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" /><Circle cx={12} cy={7.8} r={1.1} fill="#FFFFFF" /></> : null}
      {name === 'lock' ? <><Rect x={5.5} y={10} width={13} height={9} rx={1.8} stroke={stroke} strokeWidth={1.8} /><Path d="M8.5 10V7.8C8.5 5.8 10.1 4.3 12 4.3C13.9 4.3 15.5 5.8 15.5 7.8V10" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" /></> : null}
      {name === 'qr' ? <><Rect x={4} y={4} width={6} height={6} rx={1} stroke={stroke} strokeWidth={1.9} /><Rect x={14} y={4} width={6} height={6} rx={1} stroke={stroke} strokeWidth={1.9} /><Rect x={4} y={14} width={6} height={6} rx={1} stroke={stroke} strokeWidth={1.9} /><Path d="M14 14H16V16H14V14ZM18 14H20V16H18V14ZM14 18H16V20H14V18ZM18 18H20V20H18V18Z" fill={stroke} /></> : null}
      {name === 'copy' ? <><Rect x={8} y={8} width={10} height={10} rx={1.5} stroke={stroke} strokeWidth={1.8} /><Path d="M6 15H5.5C4.7 15 4 14.3 4 13.5V5.5C4 4.7 4.7 4 5.5 4H13.5C14.3 4 15 4.7 15 5.5V6" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" /></> : null}
      {name === 'refresh' ? <><Path d="M18.5 9A6.5 6.5 0 1 0 17 15.2" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" /><Path d="M18.5 4.8V9H14.3" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></> : null}
      {name === 'fingerprint' ? <><Path d="M7.5 12.5C7.5 9.8 9.5 8 12 8C14.5 8 16.5 9.8 16.5 12.5" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Path d="M5.8 9.7C6.9 7.4 9.2 6 12 6C14.8 6 17.1 7.4 18.2 9.7" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Path d="M9.2 14C9.2 12.2 10.2 10.8 12 10.8C13.8 10.8 14.8 12.2 14.8 14C14.8 16.2 13.6 17.5 12.6 19" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Path d="M9.2 18.4C9.8 17.4 10.4 16.2 10.4 14.4" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /></> : null}
      {name === 'bolt' ? <Path d="M13 2.8L5.8 13H11L10 21.2L18.2 10H12.8L13 2.8Z" fill={stroke} /> : null}
      {name === 'user' ? <><Circle cx={11} cy={9} r={4} stroke={stroke} strokeWidth={1.8} /><Path d="M4.8 20C5.6 16.8 8 15 11 15C12.8 15 14.4 15.6 15.5 16.8" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" /><Path d="M15.2 18.1L17.2 20.1L21 16.3" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></> : null}
    </Svg>
  );
}

export function StepHeader({ current, total, progress, onBack, skip }: { current: number; total: number; progress: number; onBack?: () => void; skip?: () => void }) {
  return (
    <View style={styles.stepNav}>
      <View style={styles.navRow}>
        {skip ? (
          <Pressable onPress={skip} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onBack} style={({ pressed }) => [styles.backGroup, pressed && styles.pressed]} hitSlop={8}>
            <View style={styles.backCircle}><BackIcon /></View>
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
        )}
        <Text style={styles.stepText}>{`Step ${current}/${total}`}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%` }]} />
      </View>
    </View>
  );
}

export function WhiteStepScaffold({
  children,
  footer,
  current,
  total,
  progress,
  onBack,
  skip,
  scroll = false,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  current: number;
  total: number;
  progress: number;
  onBack?: () => void;
  skip?: () => void;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const body = (
    <View style={[styles.whiteContent, { paddingBottom: footer ? 32 : 32 }]}>
      <StepHeader current={current} total={total} progress={progress} onBack={onBack} skip={skip} />
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.whiteRoot} edges={['top', 'bottom']}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      {scroll ? (
        <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: footer ? 112 + insets.bottom : 24 }} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : body}
      {footer ? <View style={[styles.footer, { paddingBottom: 24 + insets.bottom }]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function AnimatedPopIcon({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 85, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  return <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>{children}</Animated.View>;
}

export function IconBubble({ icon, size = 80 }: { icon: React.ReactNode; size?: number }) {
  return <View style={[styles.iconBubble, { width: size, height: size, borderRadius: size / 2 }]}>{icon}</View>;
}

export function OTPVisual({ filled = false }: { filled?: boolean }) {
  return (
    <View style={styles.otpBox}>
      <Text style={styles.otpText}>{filled ? '1 2 3 4 5 6' : '-  -  -  -  -  -'}</Text>
    </View>
  );
}

export function FullScreenSpinner() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={styles.spinnerOuter}>
      <View style={styles.spinnerTrack} />
      <Animated.View style={[styles.spinnerArc, { transform: [{ rotate }] }]} />
    </View>
  );
}

export function SuccessAnimation() {
  return (
    <AnimatedPopIcon style={styles.successCircle}>
      <CheckIcon color={colors.primary} size={58} />
    </AnimatedPopIcon>
  );
}

export function ResultStatusScreen({
  status,
  title,
  subtitle,
  cardTitle,
  cardBody,
  cardIcon = 'info',
  buttonLabel,
  buttonDisabled,
  onButtonPress,
  notificationTitle,
  notificationHeading,
  notificationBody,
}: {
  status: 'loading' | 'success';
  title: string;
  subtitle: string;
  cardTitle: string;
  cardBody: string;
  cardIcon?: 'file' | 'info';
  buttonLabel: string;
  buttonDisabled?: boolean;
  onButtonPress?: () => void;
  notificationTitle?: string;
  notificationHeading?: string;
  notificationBody?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.resultRoot} edges={['top', 'bottom']}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      {notificationTitle ? (
        <View style={[styles.pushNotice, { top: 16 + insets.top }]}>
          <View style={styles.pushIcon}><Text style={styles.pushCheck}>✓</Text></View>
          <View style={styles.pushTextBlock}>
            <Text style={styles.pushTiny}>{notificationTitle}</Text>
            <Text style={styles.pushTitle} numberOfLines={1}>{notificationHeading}</Text>
            <Text style={styles.pushBody} numberOfLines={1}>{notificationBody}</Text>
          </View>
        </View>
      ) : null}
      <View style={styles.resultTop}>
        {status === 'loading' ? <FullScreenSpinner /> : <SuccessAnimation />}
        <View style={styles.resultCopy}>
          <Text style={styles.resultTitle}>{title}</Text>
          <Text style={styles.resultSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={[styles.resultSheet, shadows.sheet]}>
        <View style={[styles.infoCard, softShadow]}>
          <View style={styles.infoIconCircle}>
            <SimpleIcon name={cardIcon} size={22} color={colors.primary} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoTitle}>{cardTitle}</Text>
            <Text style={styles.infoBody}>{cardBody}</Text>
          </View>
        </View>
        <View style={[styles.footer, { paddingBottom: 40 + insets.bottom }]}>
          <PrimaryButton
            label={buttonLabel}
            disabled={buttonDisabled}
            onPress={onButtonPress}
            textStyle={styles.resultButtonText}
            style={styles.resultButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

export function AppDownloadModal({ visible, onNext }: { visible: boolean; onNext: () => void }) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={[styles.twoFaModal, modalShadow]}>
          <View style={styles.modalTop}>
            <View style={styles.appIconWrap}>
              <View style={styles.appIconBox}><SimpleIcon name="shield" size={48} /></View>
              <View style={styles.phoneBadge}><SimpleIcon name="phone" size={20} color="#64748B" /></View>
            </View>
            <View style={styles.modalCopy}>
              <Text style={styles.modalTitle}>Step 1: Get the Authenticator App</Text>
              <Text style={styles.modalBody}>
                To secure your account, you will need an authenticator app like Google Authenticator. Please download it on your phone before proceeding to the next step.
              </Text>
            </View>
            <View style={styles.storeRow}>
              <StoreBadge label="App Store" caption="DOWNLOAD ON THE" icon="apple" />
              <StoreBadge label="Google Play" caption="GET IT ON" icon="play" />
            </View>
          </View>
          <View style={styles.modalFooter}>
            <Pressable onPress={onNext} style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
              <Text style={styles.outlineButtonText}>I already have the app - Next Step →</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StoreBadge({ label, caption, icon }: { label: string; caption: string; icon: 'apple' | 'play' }) {
  return (
    <View style={styles.storeBadge}>
      <Text style={styles.storeIcon}>{icon === 'apple' ? '●' : '▶'}</Text>
      <View>
        <Text style={styles.storeCaption}>{caption}</Text>
        <Text style={styles.storeLabel}>{label}</Text>
      </View>
    </View>
  );
}

export function SetupCompleteModal({ visible, onDashboard }: { visible: boolean; onDashboard: () => void }) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={[styles.completeModal, modalShadow]}>
          <View style={styles.completeTop}>
            <SuccessAnimation />
            <Text style={styles.modalTitle}>Setup Complete!</Text>
            <Text style={styles.modalBody}>Your mTrip Merchant Dashboard is now fully secured with active multi-factor authentication.</Text>
          </View>
          <View style={styles.modalFooter}>
            <PrimaryButton label="Go to Dashboard" onPress={onDashboard} textStyle={styles.largeButtonText} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  whiteRoot: { flex: 1, backgroundColor: colors.surface },
  whiteContent: { paddingHorizontal: PAGE_PADDING, paddingTop: 16, gap: 36 },
  stepNav: { gap: 16 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backCircle: { width: 32, height: 32, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  backLabel: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.slate900, opacity: 0.8 },
  skipButton: { minHeight: 32, justifyContent: 'center' },
  skipText: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 21, color: colors.primary },
  stepText: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 21, color: colors.primary },
  progressTrack: { width: '100%', height: 6, borderRadius: 999, backgroundColor: colors.primaryLight, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.primary },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: PAGE_PADDING, paddingTop: 25, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: '#E0F2FE' },
  pressed: { opacity: 0.75 },
  iconBubble: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  otpBox: { width: '100%', minHeight: 64, borderWidth: 1, borderColor: colors.slate900, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 17 },
  otpText: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 28, color: colors.primary, letterSpacing: 6, textAlign: 'center' },
  resultRoot: { flex: 1, backgroundColor: colors.primary },
  resultTop: { height: 268, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: PAGE_PADDING },
  resultCopy: { width: '100%', gap: 8, alignItems: 'center' },
  resultTitle: { fontFamily: fonts.outfitBold, fontSize: 20, lineHeight: 30, color: colors.surface, textTransform: 'uppercase', textAlign: 'center', ...heroTextShadow },
  resultSubtitle: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 21, color: colors.surface, textAlign: 'center', opacity: 0.92 },
  resultSheet: { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface, paddingHorizontal: PAGE_PADDING, paddingTop: 48 },
  infoCard: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, backgroundColor: colors.canvas, padding: 21 },
  infoIconCircle: { width: 48, height: 48, borderRadius: 999, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  infoCopy: { flex: 1, minWidth: 0, gap: 4 },
  infoTitle: { fontFamily: fonts.outfitSemi, fontSize: 16, lineHeight: 24, color: colors.slate900 },
  infoBody: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.slate900, opacity: 0.8 },
  resultButton: { flexDirection: 'row' },
  resultButtonText: { fontSize: 16, lineHeight: 24 },
  spinnerOuter: { width: 80, height: 80, borderRadius: 67, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  spinnerTrack: { position: 'absolute', width: 53, height: 53, borderRadius: 27, borderWidth: 5, borderColor: colors.primaryLight },
  spinnerArc: { width: 53, height: 53, borderRadius: 27, borderTopWidth: 5, borderRightWidth: 5, borderTopColor: colors.primary, borderRightColor: colors.primary, borderLeftColor: 'transparent', borderBottomColor: 'transparent' },
  successCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  pushNotice: { position: 'absolute', left: 16, right: 16, zIndex: 5, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 16, borderRadius: 16, backgroundColor: colors.slate900, ...notificationShadow },
  pushIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  pushCheck: { color: colors.surface, fontFamily: fonts.interBold, fontSize: 20 },
  pushTextBlock: { flex: 1, minWidth: 0, gap: 2 },
  pushTiny: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 18, color: colors.surface },
  pushTitle: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 21, color: colors.surface },
  pushBody: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 18, color: colors.surface, opacity: 0.8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(30, 41, 59, 0.24)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  twoFaModal: { width: '100%', maxWidth: 448, borderRadius: 24, backgroundColor: colors.surface, overflow: 'hidden' },
  modalTop: { alignItems: 'center', gap: 24, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  appIconWrap: { position: 'relative' },
  appIconBox: { width: 96, height: 96, borderRadius: 16, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  phoneBadge: { position: 'absolute', right: -8, bottom: -8, width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  modalCopy: { width: '100%', gap: 8, alignItems: 'center' },
  modalTitle: { width: '100%', fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, letterSpacing: -0.6, color: colors.slate900, textAlign: 'center' },
  modalBody: { width: '100%', fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.slate900, opacity: 0.8, textAlign: 'center' },
  storeRow: { flexDirection: 'row', gap: 8, width: '100%' },
  storeBadge: { flex: 1, minWidth: 0, height: 48, borderRadius: 12, backgroundColor: colors.slate900, borderWidth: 1, borderColor: colors.slate900, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  storeIcon: { color: colors.surface, fontSize: 16, lineHeight: 18 },
  storeCaption: { fontFamily: fonts.inter, fontSize: 8, lineHeight: 12, color: '#E2E8F0', opacity: 0.8 },
  storeLabel: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 22, color: colors.surface },
  modalFooter: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingTop: 25, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#E0F2FE', backgroundColor: colors.surface },
  outlineButton: { width: '100%', minHeight: 59, borderWidth: 1, borderColor: colors.slate900, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  outlineButtonText: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.slate900, textAlign: 'center' },
  completeModal: { width: '100%', maxWidth: 448, borderRadius: 24, backgroundColor: colors.surface, overflow: 'hidden' },
  completeTop: { alignItems: 'center', gap: 16, padding: 16 },
  largeButtonText: { fontSize: 18, lineHeight: 27 },
});
