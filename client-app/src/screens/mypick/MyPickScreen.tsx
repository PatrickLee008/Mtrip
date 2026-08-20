/**
 * 我的精选:占位页(设计稿 BottomNavBar 的 My Pick 页签,业务待接入)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyView } from '@/components/common/StateViews';
import PageLayout from '@/components/layout/PageLayout';

export default function MyPickScreen() {
  const { t } = useTranslation();
  return (
    <PageLayout>
      <EmptyView text={t('myPick.empty')} />
    </PageLayout>
  );
}
