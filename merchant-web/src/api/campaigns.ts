import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/**
 * Merchant M8 平台活动参与接口(功能需求「参与平台活动」)。
 *
 * 活动本体由平台在 admin 端建立(`marketing_campaign`),商户端只做:
 * 看活动详情 / 参与资格要求 / 出资模式 / 活动条款,并接受或拒绝邀请。
 * 参与关系落在 `marketing_campaign_participant`(后端 `Merchant/CampaignController`)。
 */

/** 参与状态(与 marketing_campaign_participant.status 一致;null = 尚未参与) */
export const PARTICIPATION_STATUS = {
  invited: 0,
  accepted: 1,
  declined: 2,
  withdrawn: 3,
} as const;

/** 出资方(与 marketing_campaign.funding_source 一致) */
export const CAMPAIGN_FUNDING_SOURCE = {
  platform: 1,
  merchant: 2,
  partner: 3,
  shared: 4,
} as const;

/** 参与方式 */
export const CAMPAIGN_INVITE_MODE = {
  invited: 1,
  open: 2,
} as const;

export interface CampaignCoupon {
  id: number;
  coupon_name: string;
  coupon_type: number;
  discount_value: number;
}

export interface MerchantCampaign {
  id: number;
  site_id: number;
  title: string;
  subtitle: string;
  banner: string;
  landing_url: string;
  coupon_ids: number[];
  funding_source: number;
  funding_rules: Record<string, number>;
  requirements: string;
  terms: string;
  invite_mode: number;
  start_time: string | null;
  end_time: string | null;
  sort: number;
  status: number;
  created_at: string;
  participation_id: number;
  /** null = 未参与(公开报名尚未响应) */
  participation_status: number | null;
  participation_funding_source: number;
  responded_at: string | null;
  participation_remark: string;
  can_respond: boolean;
  coupons?: CampaignCoupon[];
}

export interface CampaignSummary {
  total: number;
  pending: number;
  accepted: number;
  declined: number;
  withdrawn: number;
}

export function apiCampaignSummary(): Promise<CampaignSummary> {
  return get('/merchant/campaigns/summary');
}

export function apiCampaignList(params: Record<string, unknown>): Promise<PageData<MerchantCampaign>> {
  return get('/merchant/campaigns/list', params);
}

export function apiCampaignDetail(id: number): Promise<MerchantCampaign> {
  return get('/merchant/campaigns/detail', { id });
}

/**
 * 接受 / 拒绝邀请(`action`: accept | decline)。
 *
 * 集团账号的可见商户不止一家,后端**强制**要求显式传 `merchantId`(不能替商户猜),
 * 页面因此有一个「以哪家商户响应」的选择器;商户/门店账号由后端取范围内唯一商户。
 */
export function apiCampaignRespond(
  id: number,
  action: 'accept' | 'decline',
  remark = '',
  merchantId = 0,
): Promise<{ id: number; status: number }> {
  return post('/merchant/campaigns/respond', { id, action, remark, merchantId });
}
