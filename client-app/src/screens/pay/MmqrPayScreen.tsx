/**
 * KBZPay MMQR 扫码支付页(方案 `docs/plans/22-KBZPay-MMQR支付接入方案.md` §8)
 *
 * 入参是 `order/pay` / `trip/pay`(payMethod=5)的返回(见 `navigation/types` 的 `MmqrPay`)。
 *
 *   - 显示二维码、金额币种、码倒计时与订单支付窗口倒计时;提示可用 KBZPay 或任意 MMQR 银行 App 扫码。
 *   - 保存二维码:Web 端把页面上的 SVG 画到 canvas 导出 PNG 下载;
 *     原生端需要 `expo-media-library`(本工程未安装,未新增依赖),改为提示用户截图保存。
 *   - 每 3 秒轮询 `pay/status`;App 切到后台暂停,回前台立即查一次;「我已付款」带 `refresh=1` 让服务端实时查 KBZ。
 *   - paid → 结果页(订房向导进来走 BookingSuccess/Lite,详情页进来回预订详情);
 *     码过期/关闭而订单仍在窗口内 → 「刷新二维码」(重新调 pay 接口出新码);
 *     订单窗口已过 → 提示并回订单详情;late(超时后到账)→ 说明后端会恢复或自动退款。
 *   - 时间一律按 UTC 解析(`utils/time.parseUtcTime`)。卸载时清理所有定时器与监听。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';

import { getPayStatus, type PayTxStatus } from '@/api/pay';
import HomeIcon from '@/components/home/HomeIcon';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { formatCountdown } from '@/screens/hotel/useBookingResult';
import { requestMmqr } from '@/screens/pay/mmqrPay';
import { useCommonStore } from '@/store/commonStore';
import { formatMoney } from '@/utils/format';
import { secondsUntilUtc } from '@/utils/time';

/** 轮询间隔(毫秒) */
const POLL_INTERVAL = 3000;
/** 二维码边长 */
const QR_SIZE = 232;
/** Web 端导出 PNG 时用来找 SVG 的容器 id(RN Web 把 nativeID 渲染成 DOM id) */
const QR_DOM_ID = 'mtrip-mmqr-code';

/** 不会再变化的流水状态:到这里就停止轮询 */
const TERMINAL: PayTxStatus[] = ['paid', 'late', 'closed', 'failed'];

interface CodeState {
  payNo: string;
  qrCode: string;
  amount: number | string;
  currency: string;
  expireAt: string;
  orderExpireAt: string;
}

/**
 * Web:把容器里的 SVG 序列化 → 画进 canvas(白底留边)→ 导出 PNG 下载。
 * 不依赖 react-native-svg 的 toDataURL(Web 实现各版本不一),直接走 DOM。
 */
function downloadQrPng(containerId: string, fileName: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (typeof document === 'undefined') {
        resolve(false);
        return;
      }
      const svg = document.getElementById(containerId)?.querySelector('svg');
      if (!svg) {
        resolve(false);
        return;
      }
      let xml = new XMLSerializer().serializeToString(svg);
      if (!xml.includes('xmlns=')) {
        xml = xml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      const out = 720;
      const pad = 48;
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(false);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, out, out);
        ctx.drawImage(img, pad, pad, out - pad * 2, out - pad * 2);
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    } catch {
      resolve(false);
    }
  });
}

export default function MmqrPayScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MmqrPay'>>();
  const insets = useSafeAreaInsets();
  const showToast = useCommonStore((s) => s.showToast);
  const p = route.params;

  const [code, setCode] = useState<CodeState>({
    payNo: p.payNo,
    qrCode: p.qrCode,
    amount: p.amount,
    currency: p.currency,
    expireAt: p.expireAt,
    orderExpireAt: p.orderExpireAt,
  });
  const [status, setStatus] = useState<PayTxStatus | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background');
  const [checking, setChecking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /** 当前码的流水号(异步回来的结果若属于旧码就丢掉) */
  const payNoRef = useRef(code.payNo);
  payNoRef.current = code.payNo;
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  /* 秒表:倒计时用 */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* 前后台:后台暂停轮询,回到前台 effect 重启时会立即查一次 */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      setAppActive(next === 'active');
    });
    return () => sub.remove();
  }, []);

  const codeLeft = secondsUntilUtc(code.expireAt, now);
  const orderLeft = secondsUntilUtc(code.orderExpireAt, now);
  const codeExpired = codeLeft !== null && codeLeft <= 0;
  const orderExpired = orderLeft !== null && orderLeft <= 0;
  const terminal = status !== null && TERMINAL.includes(status);

  /** 查一次状态;返回最新状态(属于旧码或失败时返回 null) */
  const check = useCallback(async (refresh: boolean): Promise<PayTxStatus | null> => {
    const payNo = payNoRef.current;
    try {
      const res = await getPayStatus(payNo, refresh);
      if (!mounted.current || payNo !== payNoRef.current) return null;
      setStatus(res.status);
      /* 后端可能顺带给出更准的截止时间 */
      if (res.orderExpireAt) {
        setCode((prev) =>
          prev.payNo === payNo && prev.orderExpireAt !== res.orderExpireAt
            ? { ...prev, orderExpireAt: res.orderExpireAt as string }
            : prev,
        );
      }
      return res.status;
    } catch {
      return null;
    }
  }, []);

  /* 轮询:前台且未到终态时每 3 秒一次;用 setTimeout 串行,上一次没回来不会叠请求 */
  useEffect(() => {
    if (!appActive || terminal) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      await check(false);
      if (alive) timer = setTimeout(() => void tick(), POLL_INTERVAL);
    };
    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [appActive, terminal, code.payNo, check]);

  /* 支付成功:进结果页(只跳一次) */
  const leftRef = useRef(false);
  useEffect(() => {
    if (status !== 'paid' || leftRef.current) return;
    leftRef.current = true;
    showToast(t('pay.mmqr.paidToast'));
    const base = { name: 'MainTabs' as const, params: { screen: 'MyPickTab' as const } };
    if (p.successRoute) {
      const params = {
        ...(p.result ?? {}),
        orderId: p.orderId,
        tripId: p.tripId,
        paidTotal: Number(code.amount) || undefined,
        status: 'confirmed' as const,
      };
      if (p.successRoute === 'BookingSuccessLite') {
        navigation.reset({ index: 1, routes: [base, { name: 'BookingSuccessLite', params }] });
      } else {
        navigation.reset({ index: 1, routes: [base, { name: 'BookingSuccess', params }] });
      }
      return;
    }
    goDetail();
    // 只在状态变成 paid 时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  /** 回订单详情(订单失效 / 已付款 / 超时到账) */
  const goDetail = () => {
    const base = { name: 'MainTabs' as const, params: { screen: 'MyPickTab' as const } };
    if (!p.orderId) {
      navigation.reset({ index: 0, routes: [base] });
      return;
    }
    if (p.detailRoute === 'OrderDetail') {
      navigation.reset({ index: 1, routes: [base, { name: 'OrderDetail', params: { orderId: p.orderId } }] });
      return;
    }
    navigation.reset({
      index: 1,
      routes: [base, { name: 'BookingDetail', params: { orderId: p.orderId, tripId: p.tripId } }],
    });
  };

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else goDetail();
  };

  /** 「我已付款」:让服务端实时查 KBZ */
  const onPaid = async () => {
    if (checking) return;
    setChecking(true);
    const next = await check(true);
    if (mounted.current) setChecking(false);
    if (next === 'pending' || next === null) showToast(t('pay.mmqr.notYet'));
  };

  /** 刷新二维码:对同一张单重新调 pay 接口(码过期而订单仍在窗口内,后端出新码) */
  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await requestMmqr({ orderId: p.orderId, tripId: p.tripId });
      if (!mounted.current) return;
      setCode({
        payNo: res.payNo,
        qrCode: res.qrCode,
        amount: res.amount,
        currency: res.currency,
        expireAt: res.expireAt,
        orderExpireAt: res.orderExpireAt,
      });
      setStatus(null);
    } catch {
      /* 请求层已 Toast 后端原因(如订单已失效);再查一次状态让页面落到正确分支 */
      void check(false);
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  };

  const onSave = async () => {
    const ok = await downloadQrPng(QR_DOM_ID, `mmqr-${code.payNo}.png`);
    showToast(t(ok ? 'pay.mmqr.saved' : 'pay.mmqr.saveFailed'));
  };

  /**
   * 页面分支:
   *   late        超时后才到账(后端自动恢复或退款)
   *   orderClosed 订单支付窗口已过(或码已关闭且窗口也过了)
   *   codeExpired 码过期 / 关闭,但订单仍在窗口内 → 可刷新
   *   active      正常等待扫码
   */
  const phase: 'late' | 'orderClosed' | 'codeExpired' | 'active' = (() => {
    if (status === 'late') return 'late';
    if (orderExpired) return 'orderClosed';
    if (status === 'closed' || status === 'failed' || codeExpired) return 'codeExpired';
    return 'active';
  })();
  const qrDimmed = phase !== 'active';
  const isWeb = Platform.OS === 'web';

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.main, { paddingTop: insets.top + 88, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.overline}>{t('pay.mmqr.amountLabel')}</Text>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(code.amount, code.currency)}
          </Text>

          <View style={styles.qrBox} nativeID={QR_DOM_ID}>
            {code.qrCode ? (
              <View style={qrDimmed ? styles.qrDimmed : undefined}>
                <QRCode value={code.qrCode} size={QR_SIZE} backgroundColor="#FFFFFF" color="#000000" ecl="M" />
              </View>
            ) : (
              <Text style={styles.desc}>{t('pay.mmqr.invalid')}</Text>
            )}
          </View>

          {phase === 'active' ? (
            <>
              <Text style={styles.countdown}>
                {codeLeft === null
                  ? t('pay.mmqr.waiting')
                  : t('pay.mmqr.codeExpiresIn', { time: formatCountdown(codeLeft) })}
              </Text>
              {orderLeft !== null ? (
                <Text style={styles.desc}>
                  {t('pay.mmqr.orderExpiresIn', { time: formatCountdown(orderLeft) })}
                </Text>
              ) : null}
            </>
          ) : null}

          {phase === 'codeExpired' ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>{t('pay.mmqr.codeExpired')}</Text>
              <Text style={styles.desc}>{t('pay.mmqr.refreshHint')}</Text>
              {orderLeft !== null ? (
                <Text style={styles.desc}>
                  {t('pay.mmqr.orderExpiresIn', { time: formatCountdown(orderLeft) })}
                </Text>
              ) : null}
            </View>
          ) : null}

          {phase === 'orderClosed' ? (
            <View style={styles.notice}>
              <Text style={[styles.noticeTitle, styles.warn]}>{t('pay.mmqr.orderClosedTitle')}</Text>
              <Text style={styles.desc}>{t('pay.mmqr.orderClosedDesc')}</Text>
            </View>
          ) : null}

          {phase === 'late' ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>{t('pay.mmqr.lateTitle')}</Text>
              <Text style={styles.desc}>{t('pay.mmqr.lateDesc')}</Text>
            </View>
          ) : null}
        </View>

        {phase === 'active' ? (
          <View style={styles.tip}>
            <HomeIcon name="shieldSimple" width={16} height={20} color={colors.primary} />
            <Text style={[styles.desc, styles.flex]}>{t('pay.mmqr.scanHint')}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {phase === 'active' ? (
            <>
              <PrimaryButton
                label={checking ? t('pay.mmqr.checking') : t('pay.mmqr.paidCheck')}
                disabled={checking}
                onPress={() => void onPaid()}
              />
              {isWeb ? (
                <GhostButton label={t('pay.mmqr.save')} onPress={() => void onSave()} />
              ) : (
                <Text style={[styles.desc, styles.center]}>{t('pay.mmqr.saveHintNative')}</Text>
              )}
            </>
          ) : null}

          {phase === 'codeExpired' ? (
            <>
              <PrimaryButton
                label={refreshing ? t('common.loading') : t('pay.mmqr.refresh')}
                disabled={refreshing}
                onPress={() => void onRefresh()}
              />
              {/* 码刚过期的边界上用户可能已经扫过,仍给一次实时查单的机会 */}
              <GhostButton
                label={checking ? t('pay.mmqr.checking') : t('pay.mmqr.paidCheck')}
                onPress={() => void onPaid()}
              />
            </>
          ) : null}

          {phase === 'orderClosed' || phase === 'late' ? (
            <PrimaryButton label={t('pay.mmqr.viewBooking')} onPress={goDetail} />
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.topBar, { paddingTop: insets.top + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.topBack, pressed && styles.pressed]}
          onPress={goBack}
          hitSlop={8}
        >
          <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
          <Text style={styles.topTitle} numberOfLines={1}>
            {t('pay.mmqr.title')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.primaryBtn, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1 },
  main: { paddingHorizontal: PAGE_PADDING, gap: 20 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  center: { textAlign: 'center' },

  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  topBack: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 },
  topTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary,
  },

  card: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  overline: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.label,
  },
  amount: {
    fontFamily: fonts.interBold,
    fontSize: 32,
    lineHeight: 44,
    color: colors.primary,
  },
  qrBox: {
    marginTop: 8,
    padding: 16,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: '#FFFFFF',
  },
  qrDimmed: { opacity: 0.15 },
  countdown: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
    textAlign: 'center',
  },
  desc: {
    fontFamily: fonts.inter,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
  },
  notice: { alignItems: 'center', gap: 6 },
  noticeTitle: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
    textAlign: 'center',
  },
  warn: { color: colors.hot },

  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: radius.tile,
    backgroundColor: colors.tintBg,
  },

  actions: { gap: 12 },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  primaryText: { fontFamily: fonts.interMedium, fontSize: 18, lineHeight: 22, color: '#FFFFFF' },
  ghostBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  ghostText: { fontFamily: fonts.interMedium, fontSize: 18, lineHeight: 22, color: colors.primary },
});
