/**
 * 优惠中心的两段式页签(设计稿 1390:2921 Tab Navigation)
 *
 * 样式与推荐明细 / 教程 / 通知那三处完全一致,已统一收敛到 components/common/SegmentedTabs,
 * 这里只保留优惠中心自己的页签枚举与文案取法。
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import SegmentedTabs from '@/components/common/SegmentedTabs';

export type PromoTab = 'promotions' | 'coupons';

export const PROMO_TABS: PromoTab[] = ['promotions', 'coupons'];

interface Props {
  value: PromoTab;
  onChange: (tab: PromoTab) => void;
}

export default function PromoTabs({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <SegmentedTabs
      tabs={PROMO_TABS}
      value={value}
      onChange={onChange}
      label={(tab) => t(`promotions.tabs.${tab}`)}
    />
  );
}
