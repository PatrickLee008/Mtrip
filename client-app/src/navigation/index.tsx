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
import AddGuestScreen from '@/screens/hotel/AddGuestScreen';
import BookingSuccessScreen from '@/screens/hotel/BookingSuccessScreen';
import HotelBookingScreen from '@/screens/hotel/HotelBookingScreen';
import HotelDetailScreen from '@/screens/hotel/HotelDetailScreen';
import HotelResultsScreen from '@/screens/hotel/HotelResultsScreen';
import HotelsScreen from '@/screens/hotel/HotelsScreen';
import InsuranceScreen from '@/screens/hotel/InsuranceScreen';
import StayDetailScreen from '@/screens/hotel/StayDetailScreen';
import AccountScreen from '@/screens/more/AccountScreen';
import EditEmailScreen from '@/screens/more/EditEmailScreen';
import GuidesScreen from '@/screens/more/GuidesScreen';
import HowReferralWorksScreen from '@/screens/more/HowReferralWorksScreen';
import LegalTermsScreen from '@/screens/more/LegalTermsScreen';
import ReferralScreen from '@/screens/more/ReferralScreen';
import ReferralStatusScreen from '@/screens/more/ReferralStatusScreen';
import TravelersScreen from '@/screens/more/TravelersScreen';
import MyPickScreen from '@/screens/mypick/MyPickScreen';
import NotificationScreen from '@/screens/notification/NotificationScreen';
import OrderConfirmScreen from '@/screens/order/OrderConfirmScreen';
import OrderDetailScreen from '@/screens/order/OrderDetailScreen';
import OrderListScreen from '@/screens/order/OrderListScreen';
import CouponDetailScreen from '@/screens/promotions/CouponDetailScreen';
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
      {/* 我的精选自带设计稿顶部栏(HomeHeader),隐藏 Tab 导航头 */}
      <Tab.Screen
        name="MyPickTab"
        component={MyPickScreen}
        options={{ title: t('tab.myPick'), headerShown: false }}
      />
      {/* 优惠中心自带设计稿顶部栏(Promotion Center),隐藏 Tab 导航头 */}
      <Tab.Screen
        name="PromotionsTab"
        component={PromotionsScreen}
        options={{ title: t('tab.promotions'), headerShown: false }}
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
          name="Hotels"
          component={HotelsScreen}
          options={{ title: t('hotels.title'), headerShown: false }}
        />
        <Stack.Screen
          name="HotelResults"
          component={HotelResultsScreen}
          options={{ title: t('hotels.title'), headerShown: false }}
        />
        {/* 详情页自带设计稿顶部栏(返回 / 提醒 / 分享)且图库要铺到状态栏,故关掉 Stack 头 */}
        <Stack.Screen
          name="HotelDetail"
          component={HotelDetailScreen}
          options={{ title: t('hotels.title'), headerShown: false }}
        />
        {/* 订房流程(Figma section 1675:5776)整组都自带设计稿顶栏 / 吸底栏,关掉 Stack 头 */}
        <Stack.Screen
          name="HotelBooking"
          component={HotelBookingScreen}
          options={{ title: t('hotels.booking.steps.dates'), headerShown: false }}
        />
        <Stack.Screen
          name="AddGuest"
          component={AddGuestScreen}
          options={{ title: t('hotels.booking.addGuest.title'), headerShown: false }}
        />
        <Stack.Screen
          name="Insurance"
          component={InsuranceScreen}
          options={{ title: t('hotels.booking.insurance.title'), headerShown: false }}
        />
        <Stack.Screen
          name="StayDetail"
          component={StayDetailScreen}
          options={{ title: t('hotels.booking.trip.stayDetailTitle'), headerShown: false }}
        />
        <Stack.Screen
          name="BookingSuccess"
          component={BookingSuccessScreen}
          options={{ title: t('hotels.booking.success.title'), headerShown: false }}
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
        {/* 通知页与「更多」子页共用同一套顶部栏,同样关掉 Stack 头 */}
        <Stack.Screen
          name="Notifications"
          component={NotificationScreen}
          options={{ title: t('notifications.title'), headerShown: false }}
        />
        {/* 「更多」section 的子页都自带设计稿顶部栏(返回 + 标题),统一关掉 Stack 头 */}
        <Stack.Screen
          name="Account"
          component={AccountScreen}
          options={{ title: t('more.account.title'), headerShown: false }}
        />
        <Stack.Screen
          name="Travelers"
          component={TravelersScreen}
          options={{ title: t('more.travelers.title'), headerShown: false }}
        />
        <Stack.Screen
          name="EditEmail"
          component={EditEmailScreen}
          options={{ title: t('more.editEmail.title'), headerShown: false }}
        />
        <Stack.Screen
          name="Referral"
          component={ReferralScreen}
          options={{ title: t('more.referral.title'), headerShown: false }}
        />
        <Stack.Screen
          name="ReferralStatus"
          component={ReferralStatusScreen}
          options={{ title: t('more.referral.status.title'), headerShown: false }}
        />
        <Stack.Screen
          name="HowReferralWorks"
          component={HowReferralWorksScreen}
          options={{ title: t('more.referral.how.title'), headerShown: false }}
        />
        <Stack.Screen
          name="Guides"
          component={GuidesScreen}
          options={{ title: t('more.guides.title'), headerShown: false }}
        />
        <Stack.Screen
          name="LegalTerms"
          component={LegalTermsScreen}
          options={{ title: t('more.legal.title'), headerShown: false }}
        />
        {/* 券详情自带设计稿顶部栏(返回 / Coupon Details) */}
        <Stack.Screen
          name="CouponDetail"
          component={CouponDetailScreen}
          options={{ title: t('promotions.detail.title'), headerShown: false }}
        />
        {/* 登录/注册页按设计稿自带顶部栏(返回 / Sign Up|Sign In)且插画要铺到状态栏,故关掉 Stack 头 */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: t('user.loginTitle'), headerShown: false }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ title: t('user.registerTitle'), headerShown: false }}
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
