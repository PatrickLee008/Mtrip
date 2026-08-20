/**
 * 优惠活动:占位页(设计稿 BottomNavBar 的 Promotions 页签,业务待接入)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyView } from '@/components/common/StateViews';
import PageLayout from '@/components/layout/PageLayout';

export default function PromotionsScreen() {
  const { t } = useTranslation();
  return (
    <PageLayout>
      <EmptyView text={t('promotions.empty')} />
    </PageLayout>
  );
}
