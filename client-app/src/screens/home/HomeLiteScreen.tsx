/**
 * 关怀模式首页(按 Figma Lite Home `2540:21338` 实现)
 *
 * 完整模式首页是「搜索 + 九宫格 + 七八个横滑区块」;关怀模式把整页收成**一句话标题 + 四张大卡**,
 * 一屏之内不再有横滑、不再有需要辨认的小图标。落地规则与完整模式的快捷入口同一份
 * (见 homeSections.ts 的 LITE_SERVICES),所以两种模式点 Hotels 去的是同一个页面。
 *
 * **本页不请求任何接口** —— 四张卡是固定的业务线入口,完整模式首页那些推荐位在这里全部不出现。
 *
 * 设计稿实测:
 *   页面   168.18° 渐变 #F8FAFF 0% → --background #EBF0FF 23.56%;右上角一枚
 *          320 的 rgba(78,115,255,0.1) 模糊光斑(blur 50)
 *   Main   px16,块间距 24;标题上方 pt8
 *   标题   Outfit Bold 24 / 行高 1.2,--text
 *   卡片   高 140(= 插画框高),圆角 24,1px --secondary 描边,DS_AG 投影(= shadows.card),
 *          底色 180° 渐变:主色 20% → 白 20% 叠在 #4169ED 上,压平后 #4169ED → #6787F1
 *   装饰圆 白 20%,直径 158,卡内 left229 top40(超出部分被卡片圆角裁掉)
 *   文案   左内边距 32;标题 Inter 600/40(行高 36),副标 Inter 600/16,均为白色,两者间距 10
 *   插画   贴卡片右端,高 140,宽各卡不同(140 / 140 / 161 / 192)
 *
 * 与设计稿的偏差(均已核对过是设计稿自身的不一致,不是实现取巧):
 *   - Hotels 那张的副标行高写的是 36、其余三张是 24,这里统一取 24(单行文案看不出差别,
 *     留着会让四张卡的文案基线对不齐)。
 *   - 标题文案复用完整模式已有的 `home.quickAction.*`,因此 Car 一项显示的是 "Cars"
 *     (设计稿写 "Car")—— 同一个业务线在两种模式下不该有两个名字。
 *   - 光斑在 RN 没有等价的 blur 滤镜,用 SVG 径向渐变近似(纯色圆会是硬边,反而更不像)。
 */

import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import HomeHeader from '@/components/home/HomeHeader';
import { PAGE_PADDING, SECTION_GAP, colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { LITE_SERVICES, type LiteService } from '@/screens/home/homeSections';
import { useCommonStore } from '@/store/commonStore';
import { useUserStore } from '@/store/userStore';

/** 设计稿卡高 = 插画框高 */
const CARD_HEIGHT = 140;
/** 卡底渐变压平后的两端(计算见文件头) */
const CARD_TOP = '#4169ED';
const CARD_BOTTOM = '#6787F1';
/** 卡内装饰圆(白 20%,直径 158,卡内 left229 top40) */
const BLOB = { size: 158, left: 229, top: 40 };
/** 页面右上角光斑直径 */
const BLOB_GLOW = 320;

export default function HomeLiteScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isLogin = useUserStore((s) => s.isLogin);
  const profile = useUserStore((s) => s.profile);
  const showToast = useCommonStore((s) => s.showToast);

  const comingSoon = () => showToast(t('home.comingSoon'));

  /* 与完整模式 HomeScreen.quickActionPress 同一套规则 */
  const press = (item: LiteService) => {
    if (item.route) {
      navigation.navigate(item.route);
      return;
    }
    if (item.goodsType) {
      navigation.navigate('GoodsList', {
        goodsType: item.goodsType,
        title: t(`home.quickAction.${item.key}`),
      });
      return;
    }
    comingSoon();
  };

  return (
    <View style={styles.root}>
      <PageBackdrop />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <HomeHeader
          points={profile?.points ?? 0}
          onPressPoints={() => (isLogin ? comingSoon() : navigation.navigate('Login'))}
          onPressMessage={() =>
            isLogin ? navigation.navigate('Notifications') : navigation.navigate('Login')
          }
        />

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.main}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{t('home.lite.title')}</Text>
          </View>

          <View style={styles.cards}>
            {LITE_SERVICES.map((item) => (
              <ServiceCard key={item.key} item={item} onPress={() => press(item)} />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** 页面底：斜向渐变 + 右上角模糊光斑(光斑超出屏幕的部分被外层裁掉,与设计稿一致) */
function PageBackdrop() {
  return (
    <View style={styles.backdrop} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          {/* 设计稿 168.18°:几乎是自上而下,略微右倾 */}
          <LinearGradient id="litePage" x1="0" y1="0" x2="0.2" y2="1">
            <Stop offset="0" stopColor="#F8FAFF" />
            <Stop offset="0.2356" stopColor={colors.pageBg} />
            <Stop offset="1" stopColor={colors.pageBg} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#litePage)" />
      </Svg>

      {/* 设计稿 right:-170 top:-80,直径 320 */}
      <View style={styles.blobGlow}>
        <Svg width={BLOB_GLOW} height={BLOB_GLOW}>
          <Defs>
            {/* 中心 10% 不透明、向外淡出,近似设计稿的 blur 50 */}
            <RadialGradient id="liteBlob" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#4E73FF" stopOpacity={0.1} />
              <Stop offset="1" stopColor="#4E73FF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={BLOB_GLOW / 2} cy={BLOB_GLOW / 2} r={BLOB_GLOW / 2} fill="url(#liteBlob)" />
        </Svg>
      </View>
    </View>
  );
}

function ServiceCard({ item, onPress }: { item: LiteService; onPress: () => void }) {
  const { t } = useTranslation();

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      onPress={onPress}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={`liteCard-${item.key}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={CARD_TOP} />
            <Stop offset="1" stopColor={CARD_BOTTOM} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#liteCard-${item.key})`} />
      </Svg>

      <View style={styles.blob} />

      <View style={[styles.illustrationBox, { width: item.imageWidth }]}>
        {item.crop ? (
          /* 设计稿给了显式的宽高与偏移(浏览器里是 object-fit:fill),故用 stretch 而非 cover */
          <Image
            source={item.image}
            style={{
              position: 'absolute',
              left: item.crop.left * item.imageWidth,
              top: item.crop.top * CARD_HEIGHT,
              width: item.crop.width * item.imageWidth,
              height: item.crop.height * CARD_HEIGHT,
            }}
            resizeMode="stretch"
          />
        ) : (
          <Image source={item.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
      </View>

      <View style={[styles.cardText, { paddingRight: item.textPaddingRight }]}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {t(`home.quickAction.${item.key}`)}
        </Text>
        <Text style={styles.cardSubtitle}>{t(`home.lite.${item.key}`)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  /* 裁掉光斑超出屏幕的部分(Android 默认不裁绝对定位的溢出子节点) */
  backdrop: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  blobGlow: { position: 'absolute', right: -170, top: -80 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  main: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 8,
    paddingBottom: 32,
    gap: SECTION_GAP,
  },

  titleWrap: { paddingTop: 8 },
  title: {
    fontFamily: fonts.outfitBold,
    fontSize: 24,
    lineHeight: 28.8,
    color: colors.heading,
  },

  cards: { gap: 16 },
  card: {
    height: CARD_HEIGHT,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    overflow: 'hidden',
    justifyContent: 'center',
    ...shadows.card,
  },
  pressed: { opacity: 0.9 },

  blob: {
    position: 'absolute',
    left: BLOB.left,
    top: BLOB.top,
    width: BLOB.size,
    height: BLOB.size,
    borderRadius: BLOB.size / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  /* 插画贴右端;文案压在它上面(Package 那张设计稿就是这么重叠的) */
  illustrationBox: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: CARD_HEIGHT,
    overflow: 'hidden',
  },

  cardText: { paddingLeft: 32, gap: 10 },
  cardTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 40,
    lineHeight: 36,
    color: '#FFFFFF',
  },
  cardSubtitle: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
