import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

export interface MerchantReview {
  id: number;
  site_id: number;
  goods_id: number;
  user_id: number;
  order_id: number;
  rating: number;
  content: string;
  images: string[];
  reply_content: string;
  status: number;
  created_at: string;
  updated_at: string;
  merchant_flag_status: number;
  merchant_flag_reason: string;
  merchant_flagged_at: string | null;
  goods_name: string;
  merchant_id: number;
  order_no: string | null;
  nickname: string | null;
  avatar: string | null;
  is_replied: boolean;
  is_flagged: boolean;
}

export interface ReviewSummary {
  total: number;
  avgRating: number;
  replied: number;
  flagged: number;
  pending: number;
  published: number;
  hidden: number;
}

export function apiReviewList(params: Record<string, unknown>): Promise<PageData<MerchantReview>> {
  return get('/merchant/reviews/list', params);
}

export function apiReviewSummary(): Promise<ReviewSummary> {
  return get('/merchant/reviews/summary');
}

export function apiReviewReply(data: { id: number; content: string }): Promise<null> {
  return post('/merchant/reviews/reply', data);
}

export function apiReviewFlag(data: { id: number; reason: string }): Promise<null> {
  return post('/merchant/reviews/flag', data);
}
