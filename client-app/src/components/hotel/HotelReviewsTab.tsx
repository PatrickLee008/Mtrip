/**
 * 酒店详情 · Reviews 页签(Figma M-Trip / `Hotel Details` `222:2978`)
 *
 * 内容整块就是 `HotelReviewDashboard` —— 它与住客评价整页(`Hotel Details Reviews Page`
 * `1133:2998`)顶部的「Section 7: Reviews Dashboard」是**同一组设计**(两个 Figma 节点
 * 222:3117 / 1133:3257 的几何与文案逐项一致),所以只保留一份实现,不再各画一套。
 *
 * 本组件的唯一职责:把这个页签接到「Read All Reviews」的落地页上 ——
 * 那个按钮在本页签有、在评价整页没有(整页自己就是落地页),由 `onReadAll` 是否传入区分。
 * 分数与条数由 `HotelDetailScreen` 传进来(它拿着 `/hotels/detail` 的 `reviewSummary`)。
 */

import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import HotelReviewDashboard from '@/components/hotel/HotelReviewDashboard';
import type { RootStackParamList } from '@/navigation/types';

interface Props {
  /** 10 分制总分(`reviewSummary.rating × 2`);演示酒店回落到设计稿数值 */
  score: number;
  /** 评价条数 */
  total: number;
  /** 以下三个原样透传给评价整页,供它取数并在底栏回跳详情时带回上下文 */
  propertyId?: number;
  checkIn?: string;
  checkOut?: string;
}

export default function HotelReviewsTab({ score, total, propertyId, checkIn, checkOut }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <HotelReviewDashboard
      score={score}
      total={total}
      onReadAll={() => navigation.navigate('HotelReviews', { propertyId, checkIn, checkOut })}
    />
  );
}
