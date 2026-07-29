/**
 * 导航结构:RootStack + 底部 Tab(首页/订单/我的)
 * 需登录页面由页面内守卫(useUserStore.isLogin)跳转 Login
 */

import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { colors, fontSize } from '@/config/theme';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';
import GoodsDetailScreen from '@/screens/goods/GoodsDetailScreen';
import GoodsListScreen from '@/screens/goods/GoodsListScreen';
import HomeScreen from '@/screens/home/HomeScreen';
import OrderConfirmScreen from '@/screens/order/OrderConfirmScreen';
import OrderDetailScreen from '@/screens/order/OrderDetailScreen';
import OrderListScreen from '@/screens/order/OrderListScreen';
import SiteSelectScreen from '@/screens/site/SiteSelectScreen';
import LoginScreen from '@/screens/user/LoginScreen';
import MineScreen from '@/screens/user/MineScreen';
import RegisterScreen from '@/screens/user/RegisterScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  HomeTab: '🏠',
  OrderTab: '📋',
  MineTab: '👤',
};

function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: fontSize.lg, opacity: focused ? 1 : 0.55 }}>
            {TAB_ICONS[route.name]}
          </Text>
        ),
        headerTitleAlign: 'center',
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ title: t('tab.home'), headerShown: false }}
      />
      <Tab.Screen name="OrderTab" component={OrderListScreen} options={{ title: t('tab.order') }} />
      <Tab.Screen name="MineTab" component={MineScreen} options={{ title: t('tab.mine') }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { t } = useTranslation();
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerTitleAlign: 'center', headerTintColor: colors.text }}>
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="SiteSelect"
          component={SiteSelectScreen}
          options={{ title: t('site.title') }}
        />
        <Stack.Screen
          name="GoodsList"
          component={GoodsListScreen}
          options={({ route }) => ({ title: route.params?.title ?? t('goods.listTitle') })}
        />
        <Stack.Screen
          name="GoodsDetail"
          component={GoodsDetailScreen}
          options={{ title: t('goods.detailTitle') }}
        />
        <Stack.Screen
          name="OrderConfirm"
          component={OrderConfirmScreen}
          options={{ title: t('order.confirmTitle') }}
        />
        <Stack.Screen
          name="OrderDetail"
          component={OrderDetailScreen}
          options={{ title: t('order.detailTitle') }}
        />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: t('user.loginTitle') }} />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ title: t('user.registerTitle') }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
