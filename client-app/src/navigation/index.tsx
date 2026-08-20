/**
 * 导航结构:RootStack + 底部 Tab(首页/精选/优惠/更多)
 * 底部 Tab 样式还原 Figma M-Trip / Home 81:2464 的 BottomNavBar
 * 需登录页面由页面内守卫(useUserStore.isLogin)跳转 Login
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import TabBarIcon from '@/components/common/TabBarIcon';
import { colors } from '@/config/theme';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';
import GoodsDetailScreen from '@/screens/goods/GoodsDetailScreen';
import GoodsListScreen from '@/screens/goods/GoodsListScreen';
import HomeScreen from '@/screens/home/HomeScreen';
import MyPickScreen from '@/screens/mypick/MyPickScreen';
import OrderConfirmScreen from '@/screens/order/OrderConfirmScreen';
import OrderDetailScreen from '@/screens/order/OrderDetailScreen';
import OrderListScreen from '@/screens/order/OrderListScreen';
import PromotionsScreen from '@/screens/promotions/PromotionsScreen';
import SiteSelectScreen from '@/screens/site/SiteSelectScreen';
import LoginScreen from '@/screens/user/LoginScreen';
import MineScreen from '@/screens/user/MineScreen';
import RegisterScreen from '@/screens/user/RegisterScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/** 设计稿取值:底栏底色 / 未选中前景色(50% 透明度叠加) */
const TAB_BAR_BG = '#FEFEFE';
const TAB_INACTIVE_FG = 'rgba(25, 26, 37, 0.5)';
/** 单个页签 92x48、圆角 20、内边距 4、图标与文字间距 4 */
const TAB_ITEM_WIDTH = 92;
const TAB_ITEM_HEIGHT = 48;
const TAB_BAR_PADDING = 16;

function MainTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: TAB_BAR_PADDING + insets.bottom }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const iconColor = focused ? TAB_BAR_BG : TAB_INACTIVE_FG;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };
        return (
          <Pressable
            key={route.key}
            style={[styles.tabItem, focused && styles.tabItemActive]}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            onPress={onPress}
          >
            <TabBarIcon name={route.name as keyof MainTabParamList} color={iconColor} />
            <Text style={[styles.tabLabel, focused ? styles.tabFgActive : styles.tabFgInactive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator tabBar={(props) => <MainTabBar {...props} />} screenOptions={{ headerTitleAlign: 'center' }}>
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ title: t('tab.home'), headerShown: false }}
      />
      <Tab.Screen name="MyPickTab" component={MyPickScreen} options={{ title: t('tab.myPick') }} />
      <Tab.Screen
        name="PromotionsTab"
        component={PromotionsScreen}
        options={{ title: t('tab.promotions') }}
      />
      <Tab.Screen name="MoreTab" component={MineScreen} options={{ title: t('tab.more') }} />
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
          name="OrderList"
          component={OrderListScreen}
          options={{ title: t('order.listTitle') }}
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

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: TAB_BAR_BG,
    paddingTop: TAB_BAR_PADDING,
    paddingHorizontal: TAB_BAR_PADDING,
  },
  tabItem: {
    width: TAB_ITEM_WIDTH,
    height: TAB_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderRadius: 20,
  },
  tabItemActive: { backgroundColor: colors.primary },
  tabLabel: { marginTop: 4, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  tabFgActive: { color: TAB_BAR_BG },
  tabFgInactive: { color: TAB_INACTIVE_FG },
});
