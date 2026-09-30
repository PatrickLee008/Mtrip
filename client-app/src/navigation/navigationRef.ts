/**
 * 导航容器 ref:给挂在 Stack 之外的全局浮层(如「Set Up Profile Now?」弹窗)跳页用。
 * 页面内一律用 useNavigation,不要拿它顶替。
 */

import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
