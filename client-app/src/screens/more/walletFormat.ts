/**
 * 钱包流水的展示口径(列表卡与交易详情共用,改一处两处生效)。
 *
 * change_type:1 充值 2 消费 3 退款 4 调账(推荐返利也记 4,备注以「推荐返利」开头) 5 提现 6 过期(预留)。
 * 后端备注是中文运营文案(含单号),不直接展示;类型名与说明一律走 i18n `more.wallet.kinds.*`。
 */

import type { BalanceLog } from '@/api/user';
import type { HomeIconName } from '@/components/home/HomeIcon';
import { colors } from '@/config/theme';
import { parseUtcTime } from '@/utils/time';

/** 设计稿 --green:入账金额 / Completed 胶囊 */
export const WALLET_GREEN = '#00A66F';

export type WalletKind = 'topUp' | 'booking' | 'refund' | 'referral' | 'adjustment' | 'withdrawal' | 'expired';

export function walletKind(log: BalanceLog): WalletKind {
  switch (Number(log.change_type)) {
    case 1:
      return 'topUp';
    case 2:
      return 'booking';
    case 3:
      return 'refund';
    case 4:
      return log.remark.startsWith('推荐返利') ? 'referral' : 'adjustment';
    case 5:
      return 'withdrawal';
    default:
      return 'expired';
  }
}

/** 列表卡 / 详情类型行的图标(设计稿:退款 history-dismiss、订房 building、过期 calendar-cancel) */
export const WALLET_KIND_ICON: Record<WalletKind, HomeIconName> = {
  topUp: 'wallet',
  booking: 'building',
  refund: 'historyDismiss',
  referral: 'gift',
  adjustment: 'wallet',
  withdrawal: 'wallet',
  expired: 'calendarCancel',
};

/** 金额颜色:入账绿、出账红、过期灰 */
export function walletAmountColor(log: BalanceLog): string {
  if (walletKind(log) === 'expired') return colors.textSoft;
  return Number(log.amount) >= 0 ? WALLET_GREEN : colors.hot;
}

/** 金额符号前缀:设计稿「+ MMK 5,000」/「- MMK 50,000」 */
export function walletSign(log: BalanceLog): '+' | '-' {
  return Number(log.amount) >= 0 ? '+' : '-';
}

/** UTC 流水时间 → 本地 Date;无效时返回 null */
export function walletTime(log: BalanceLog): Date | null {
  const ms = parseUtcTime(log.created_at);
  return ms === null ? null : new Date(ms);
}

/** 列表卡时间:设计稿「3:50 PM, Sep 22, 2026」 */
export function walletListTime(log: BalanceLog, lang: string): string {
  const d = walletTime(log);
  if (!d) return '';
  const time = d.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' });
  const date = d.toLocaleDateString(lang, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${time}, ${date}`;
}

/** 详情时间:设计稿「24 Sep 2026, 14:30:58」 */
export function walletDetailTime(log: BalanceLog, lang: string): string {
  const d = walletTime(log);
  if (!d) return '';
  const date = d.toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${date}, ${time}`;
}

/** 最近 12 个自然月(含本月),月份筛选的选项;key 为 YYYY-MM */
export function recentMonths(lang: string, now = new Date()): { key: string; label: string }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { key, label: d.toLocaleDateString(lang, { month: 'short', year: 'numeric' }) };
  });
}
