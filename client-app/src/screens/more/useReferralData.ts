/**
 * 推荐返利(Refer & Earn)的数据层,Refer & Earn 页与 Referral Status 页共用。
 *
 * 取数口径必须是同一份 —— 两页顶部是同一枚统计卡,数字对不上会很明显。
 * 与 `useMyPickData` 一样用 `useFocusEffect` 而不是 `useEffect`:奖励由后端在
 * **商户办理入住核销**时入账,用户切回来必须看到新的战绩,挂载不会重来。
 *
 * 进度条口径(设计稿五步:邀请→注册→下单→入住→奖励):
 * 奖励在入住核销时发放(order-service `BookingLifecycleService::checkIn` → `ReferralService`),
 * 所以「已发放」=确实住完了,第5步是实的。但 `user_referral` 只落「绑定」与「奖励状态」两个事实,
 * **中间的「下单」「入住」没有单独跟踪**,因此待达成一律停在第3步(下单)这个当前节点,
 * 无法区分「刚注册」与「已下单未入住」。要精确点亮中间两步,需后端在 user_referral 上补记首单订单状态。
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import {
  fetchReferralInvitees,
  fetchReferralMy,
  REFERRAL_STATUS,
  type RefereeItem,
  type ReferralSummary,
} from '@/api/user';
import { REFERRAL_LINK_BASE } from '@/config/env';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';

/** 未登录 / 请求失败时统计卡的兜底值(显示 0 而不是设计稿假数据) */
const EMPTY_SUMMARY: ReferralSummary = {
  referralCode: '',
  inviteeCount: 0,
  pendingCount: 0,
  rewardedCount: 0,
  rewardTotal: 0,
};

export interface ReferralSummaryData {
  isLogin: boolean;
  summary: ReferralSummary;
  /** 分享链接:后端只给码,链接在前端按 `REFERRAL_LINK_BASE` 拼 */
  link: string;
  loading: boolean;
}

/** 我的推荐码与战绩(两页的统计卡 + Refer & Earn 页的码/链接卡) */
export function useReferralSummary(): ReferralSummaryData {
  const isLogin = useUserStore((s) => s.isLogin);
  const showToast = useCommonStore((s) => s.showToast);

  const [summary, setSummary] = useState<ReferralSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isLogin) {
      setSummary(EMPTY_SUMMARY);
      return;
    }
    setLoading(true);
    try {
      setSummary(await fetchReferralMy());
    } catch (e) {
      setSummary(EMPTY_SUMMARY);
      showToast(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [isLogin, showToast]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return {
    isLogin,
    summary,
    link: summary.referralCode ? `${REFERRAL_LINK_BASE}/${summary.referralCode}` : '',
    loading,
  };
}

export interface ReferralInviteesData {
  list: RefereeItem[];
  loading: boolean;
}

/** 我邀请的人,按奖励状态取(推荐明细页两个页签各取一次) */
export function useReferralInvitees(status: number): ReferralInviteesData {
  const isLogin = useUserStore((s) => s.isLogin);
  const showToast = useCommonStore((s) => s.showToast);

  const [list, setList] = useState<RefereeItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isLogin) {
      setList([]);
      return;
    }
    setLoading(true);
    try {
      const page = await fetchReferralInvitees({ page: 1, pageSize: 50, status });
      setList(page.list);
    } catch (e) {
      setList([]);
      showToast(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [isLogin, showToast, status]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { list, loading };
}

/** 进度条已完成到第几步(含):待达成走到「下单」,已发放五步走完 */
export function refereeDoneUntil(rewardStatus: number): number {
  return rewardStatus === REFERRAL_STATUS.REWARDED ? 5 : 2;
}

/** 卡片说明文案 key(`more.referral.status.desc.<key>`) */
export function refereeDescKey(rewardStatus: number): 'waitingBooking' | 'rewarded' {
  return rewardStatus === REFERRAL_STATUS.REWARDED ? 'rewarded' : 'waitingBooking';
}
