/**
 * 订单评价接口(goods-service /api/v1/app/hotels/review/*,图片与视频上传走 user-service /app/user/review-media)
 *
 * 一单一评;可评条件由后端判定(本人酒店订单、入住/完成后、未评过),这里只负责展示与提交。
 * 图片最多 20 张(单张 ≤10MB)、视频最多 3 个(单个 ≤50MB):数量上限以 `fetchReviewContext` 下发的为准。
 */

import { get, post, request } from '@/api/request';

/** 出行类型(与后端 TRAVELER_TYPES 一致) */
export const TRAVELER_TYPES = ['solo', 'couple', 'family', 'friends', 'business'] as const;
export type TravelerType = (typeof TRAVELER_TYPES)[number];

/** 已提交的评价(snake_case 直出) */
export interface ReviewView {
  id: number;
  rating: number;
  rating_cleanliness: number;
  rating_location: number;
  rating_service: number;
  rating_amenities: number;
  traveler_type: string;
  content: string;
  images: string[];
  videos: string[];
  created_at: string;
}

/** 评价页上下文:订单摘要 + 能不能评 + 已评内容 */
export interface ReviewContext {
  orderId: number;
  propertyId: number;
  hotelName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  /** 酒店图库(头图轮播),可能为空 */
  images: string[];
  canReview: boolean;
  reviewed: boolean;
  review: ReviewView | null;
  /** 评价成功奖励的积分 */
  points: number;
  maxImages: number;
  maxVideos: number;
}

export function fetchReviewContext(orderId: number): Promise<ReviewContext> {
  return get<ReviewContext>('/api/v1/app/hotels/review/context', { orderId });
}

/** 本地选好的媒体(expo-image-picker 结果);web 端带 File,原生端只有 uri */
export interface LocalMedia {
  uri: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'video';
  /** 字节数(选择器给不出时为 0,交给后端校验) */
  size: number;
  file?: Blob;
}

/** 上传一张图或一个视频,返回 `/uploads/user/{id}/review-...` 相对地址 */
export function uploadReviewMedia(media: LocalMedia): Promise<{ url: string; kind: string }> {
  const body = new FormData();
  body.append('kind', media.kind);
  if (media.file) body.append('file', media.file, media.name);
  // RN 的 FormData 认 { uri, name, type } 形态的文件描述,类型声明里没有,只能断言
  else body.append('file', { uri: media.uri, name: media.name, type: media.mimeType } as unknown as Blob);
  // 视频最大 50MB,弱网下可能传很久,超时放宽到 5 分钟
  return request<{ url: string; kind: string }>({
    method: 'POST',
    url: '/api/v1/app/user/review-media',
    data: body,
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  });
}

export interface SubmitReviewParams {
  orderId: number;
  /** 总体评分 1-5(必填) */
  rating: number;
  /** 分项评分 0-5,0 = 没评 */
  ratingCleanliness: number;
  ratingLocation: number;
  ratingService: number;
  ratingAmenities: number;
  travelerType: TravelerType;
  content: string;
  images: string[];
  videos: string[];
}

export function submitReview(params: SubmitReviewParams): Promise<{ points: number }> {
  return post<{ points: number }>('/api/v1/app/hotels/review/add', { ...params });
}
